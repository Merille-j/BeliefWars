import { GamePhase, GameRole, Position } from '../types/game.types';
import { BeliefStateEngine } from '../core/BeliefStateEngine';
import { EntityManager } from '../core/EntityManager';
import { PhaseController } from '../core/PhaseController';
import { MapGridSystem } from '../core/MapGridSystem';
import { AStarPathfinding } from '../algorithms/AStarPathfinding';
import { MCTS } from '../algorithms/MCTS';
import { HumanPatternMemory } from '../algorithms/HumanPatternMemory';
import { GhostActions } from './GhostActions';
import { SeekerActions } from './SeekerActions';

/**
 * AI Opponent — Pattern-Learning Intelligence
 *
 * Uses HumanPatternMemory to adapt strategy based on observed human behaviour:
 *
 * As Seeker (human is Ghost):
 *   - Biases scan priority toward zones the human Ghost frequents
 *   - Discounts probability spikes in the human's known decoy zones
 *   - Predicts which objective the human will target and pre-scans that area
 *   - Locks earlier when confidence from pattern data is high
 *
 * As Ghost (human is Seeker):
 *   - Places decoys in the human Seeker's preferred scan zones (wastes their AP)
 *   - Avoids moving through zones the human Seeker scans most
 *   - Adapts manipulation to counter the human's scan-first vs lock-first tendency
 */
export class AIOpponent {
  private astar: AStarPathfinding;
  private mcts: MCTS;

  private ghostMoveHistory: Position[] = [];
  private phaseTickCount: number = 0;
  private lastPhase: GamePhase | null = null;

  // ── Grace Period & Random Activation Configuration ───────────────────────
  /** AI doesn't use pattern learning until this round (e.g., 2 = grace until round 2) */
  private gracePeriodUntilRound: number = 2;
  
  /** Each round, AI has this chance (0-1) to activate pattern learning early */
  private randomActivationChance: number = 0.25; // 25% chance per round
  
  /** Whether pattern learning is currently active this round */
  private patternLearningActive: boolean = false;
  
  /** Whether learning was randomly activated this round (for tracking) */
  private wasRandomlyActivated: boolean = false;

  constructor(
    private role: GameRole,
    private grid: MapGridSystem,
    private beliefEngine: BeliefStateEngine,
    private entityManager: EntityManager,
    _phaseController: PhaseController, // reserved for future use; not read internally
    private ghostActions: GhostActions,
    private seekerActions: SeekerActions,
    private _roundNumber: number = 1,
    private memory: HumanPatternMemory = new HumanPatternMemory()
  ) {
    this.astar = new AStarPathfinding();
    this.mcts = new MCTS();
    this.updatePatternLearningStatus();
  }

  /**
   * Determine if pattern learning should be active this round.
   * Either grace period is over OR we randomly activate early.
   */
  private updatePatternLearningStatus(): void {
    if (this._roundNumber >= this.gracePeriodUntilRound) {
      // Grace period is over — enable pattern learning
      this.patternLearningActive = true;
      this.wasRandomlyActivated = false;
    } else {
      // Still in grace period — check if we randomly wake up
      this.wasRandomlyActivated = Math.random() < this.randomActivationChance;
      this.patternLearningActive = this.wasRandomlyActivated;
    }
  }

  /** Inject a recorder so AI moves are captured in round history */
  setMoveRecorder(recorder: (role: GameRole, actionType: string, x?: number, y?: number, detail?: string) => void): void {
    this.moveRecorder = recorder;
  }

  private moveRecorder?: (role: GameRole, actionType: string, x?: number, y?: number, detail?: string) => void;

  private aiRecord(role: GameRole, actionType: string, x?: number, y?: number, detail?: string): void {
    this.moveRecorder?.(role, actionType, x, y, detail);
  }

  takeTurn(phase: GamePhase): void {
    if (phase !== this.lastPhase) {
      this.phaseTickCount = 0;
      this.lastPhase = phase;
      if (phase === GamePhase.RECON) {
        this.ghostMoveHistory = [];
        this.mcts.reset();
        // Pattern learning status is updated by updateRound() at the start of each round.
        // No need to recalculate here.
      }
    }
    this.phaseTickCount++;

    if (this.role === GameRole.GHOST) {
      this.takeGhostTurn(phase);
    } else {
      this.takeSeekerTurn(phase);
    }
  }

  // ─── Ghost AI ─────────────────────────────────────────────────────────────

  private takeGhostTurn(phase: GamePhase): void {
    switch (phase) {
      case GamePhase.MANIPULATION: this.aiGhostManipulate(); break;
      case GamePhase.OBJECTIVE:    this.aiGhostMove();       break;
      default: break;
    }
  }

  /**
   * Pattern-aware Ghost manipulation.
   *
   * Uses memory to:
   * 1. Place decoys in the human Seeker's most-scanned zone (bait their AP)
   * 2. Make noise in the human's first-scan zone (reinforce the bait)
   * 3. Lay false trails away from the human's least-scanned zone (safe corridor)
   *
   * Falls back to belief-map strategy when confidence is low or pattern learning is disabled.
   * Any remaining AP after the main strategy is spent on random noise/decoys
   * to keep the belief map noisy and avoid passing silently.
   */
  private aiGhostManipulate(): void {
    const ghost = this.entityManager.getEntity(GameRole.GHOST);
    if (!ghost) return;

    const gx = ghost.position.x;
    const gy = ghost.position.y;
    
    // Only use pattern confidence if pattern learning is active this round
    const confidence = this.patternLearningActive 
      ? this.memory.getConfidence() 
      : 0;  // Force fallback strategy during grace period or if not randomly activated

    // ── Pattern-based strategy (confidence > 0.3 = at least ~6 data points) ─
    if (confidence > 0.3) {
      const mostScannedZone = this.memory.getMostScannedZone();
      const firstScanZone   = this.memory.getPredictedFirstScanZone();

      // Place decoy in the human's most-scanned zone — they'll waste AP there
      if (mostScannedZone && this.ghostActions.canThrowDecoy()) {
        const target = HumanPatternMemory.quadrantCentre(mostScannedZone);
        // Add slight jitter so it doesn't look mechanical
        const jx = this.clamp(target.x + Math.floor(Math.random() * 5 - 2), 0, 9);
        const jy = this.clamp(target.y + Math.floor(Math.random() * 5 - 2), 0, 9);
        this.ghostActions.throwDecoy(jx, jy);
        this.aiRecord(GameRole.GHOST, 'THROW_DECOY', jx, jy, `AI decoy → (${jx},${jy})`);
      }

      // Make noise in the human's first-scan zone (reinforce the bait)
      if (firstScanZone && this.ghostActions.canMakeNoise()) {
        const target = HumanPatternMemory.quadrantCentre(firstScanZone);
        const jx = this.clamp(target.x + Math.floor(Math.random() * 4 - 2), 0, 9);
        const jy = this.clamp(target.y + Math.floor(Math.random() * 4 - 2), 0, 9);
        this.ghostActions.makeNoise(jx, jy, 2);
        this.aiRecord(GameRole.GHOST, 'MAKE_NOISE', jx, jy, `AI noise → (${jx},${jy})`);
      }

      // Lay false trail pointing toward the human's most-scanned zone
      if (mostScannedZone && this.ghostActions.canLayFalseTrail()) {
        const zoneCenter = HumanPatternMemory.quadrantCentre(mostScannedZone);
        const dx = Math.sign(zoneCenter.x - gx);
        const dy = Math.sign(zoneCenter.y - gy);
        const midX = Math.round((gx + zoneCenter.x) / 2);
        const midY = Math.round((gy + zoneCenter.y) / 2);
        const trail = [
          { x: this.clamp(midX - dx, 0, 9), y: this.clamp(midY - dy, 0, 9) },
          { x: this.clamp(midX,       0, 9), y: this.clamp(midY,       0, 9) },
          { x: this.clamp(midX + dx,  0, 9), y: this.clamp(midY + dy,  0, 9) },
        ];
        this.ghostActions.layFalseTrail(trail);
        this.aiRecord(GameRole.GHOST, 'LAY_FALSE_TRAIL', midX, midY, `AI trail → (${midX},${midY})`);
      }
    } else {
      // ── Belief-map fallback (not enough pattern data yet) ─────────────────
      const topCells = this.beliefEngine.getTopCells(10);
      const hottest  = topCells[0];
      const heatNearGhost = hottest
        ? Math.max(Math.abs(hottest.x - gx), Math.abs(hottest.y - gy)) < 4
        : false;

      if (heatNearGhost && this.ghostActions.canThrowDecoy()) {
        const coldFarCell = this.grid
          .getFlatCells()
          .filter(c => Math.max(Math.abs(c.x - gx), Math.abs(c.y - gy)) > 4)
          .sort((a, b) => {
            const distA = Math.abs(a.x - gx) + Math.abs(a.y - gy);
            const distB = Math.abs(b.x - gx) + Math.abs(b.y - gy);
            return (distB - distA * 0.3) - (distA - distB * 0.3);
          })[0];
        if (coldFarCell) {
          this.ghostActions.throwDecoy(coldFarCell.x, coldFarCell.y);
          this.aiRecord(GameRole.GHOST, 'THROW_DECOY', coldFarCell.x, coldFarCell.y, `AI decoy → (${coldFarCell.x},${coldFarCell.y})`);
          if (this.ghostActions.canMakeNoise()) {
            this.ghostActions.makeNoise(coldFarCell.x, coldFarCell.y, 2);
            this.aiRecord(GameRole.GHOST, 'MAKE_NOISE', coldFarCell.x, coldFarCell.y, `AI noise → (${coldFarCell.x},${coldFarCell.y})`);
          }
        }
      }

      if (this.ghostActions.canLayFalseTrail() && topCells.length >= 3) {
        const farHotCell = topCells
          .filter(c => Math.max(Math.abs(c.x - gx), Math.abs(c.y - gy)) > 3)
          .sort((a, b) => b.probability - a.probability)[0];
        if (farHotCell) {
          const dx = Math.sign(farHotCell.x - gx);
          const dy = Math.sign(farHotCell.y - gy);
          const midX = Math.round((gx + farHotCell.x) / 2);
          const midY = Math.round((gy + farHotCell.y) / 2);
          const trail = [
            { x: this.clamp(midX - dx, 0, 9), y: this.clamp(midY - dy, 0, 9) },
            { x: this.clamp(midX,       0, 9), y: this.clamp(midY,       0, 9) },
            { x: this.clamp(midX + dx,  0, 9), y: this.clamp(midY + dy,  0, 9) },
          ];
          this.ghostActions.layFalseTrail(trail);
          this.aiRecord(GameRole.GHOST, 'LAY_FALSE_TRAIL', midX, midY, `AI trail → (${midX},${midY})`);
        }
      }

      if (this.ghostActions.canThrowDecoy() && topCells.length > 0) {
        const target = topCells
          .filter(c => Math.max(Math.abs(c.x - gx), Math.abs(c.y - gy)) > 3)
          .sort((a, b) => b.probability - a.probability)[0] ?? topCells[0];
        this.ghostActions.throwDecoy(target.x, target.y);
        this.aiRecord(GameRole.GHOST, 'THROW_DECOY', target.x, target.y, `AI decoy → (${target.x},${target.y})`);
      }

      if (this.ghostActions.canMakeNoise()) {
        const noiseX = this.clamp(gx + (Math.random() > 0.5 ? 4 : -4) + Math.floor(Math.random() * 3 - 1), 0, 9);
        const noiseY = this.clamp(gy + (Math.random() > 0.5 ? 4 : -4) + Math.floor(Math.random() * 3 - 1), 0, 9);
        this.ghostActions.makeNoise(noiseX, noiseY, 2);
        this.aiRecord(GameRole.GHOST, 'MAKE_NOISE', noiseX, noiseY, `AI noise → (${noiseX},${noiseY})`);
      }
    }

    // ── Drain any remaining AP with random noise/decoys ───────────────────
    // Rather than passing silently, spend leftover AP on extra misdirection.
    this.drainRemainingManipulationAP(gx, gy);
  }

  /**
   * Spend any leftover MANIPULATION AP on random noise and decoys far from
   * the Ghost's actual position. This keeps the belief map noisy and ensures
   * the AI never silently passes with unspent AP.
   */
  private drainRemainingManipulationAP(gx: number, gy: number): void {
    // Alternate between noise and decoy until AP is exhausted
    let useNoise = Math.random() > 0.5;
    let safetyLimit = 10; // prevent infinite loop if AP deduction fails

    while (safetyLimit-- > 0) {
      if (!this.ghostActions.canMakeNoise() && !this.ghostActions.canThrowDecoy()) break;

      // Pick a random cell at least 3 steps away from the Ghost
      const rx = this.clamp(
        gx + (Math.random() > 0.5 ? 1 : -1) * (3 + Math.floor(Math.random() * 5)),
        0, 9
      );
      const ry = this.clamp(
        gy + (Math.random() > 0.5 ? 1 : -1) * (3 + Math.floor(Math.random() * 5)),
        0, 9
      );

      if (useNoise && this.ghostActions.canMakeNoise()) {
        this.ghostActions.makeNoise(rx, ry, 2);
        this.aiRecord(GameRole.GHOST, 'MAKE_NOISE', rx, ry, `AI drain noise → (${rx},${ry})`);
      } else if (this.ghostActions.canThrowDecoy()) {
        this.ghostActions.throwDecoy(rx, ry);
        this.aiRecord(GameRole.GHOST, 'THROW_DECOY', rx, ry, `AI drain decoy → (${rx},${ry})`);
      } else {
        break;
      }

      useNoise = !useNoise; // alternate
    }
  }

  /**
   * Pattern-aware Ghost movement.
   *
   * Uses memory to:
   * - Avoid zones the human Seeker scans most (stay in their blind spots)
   * - Adjust A* cost surface to penalise the human's preferred scan zones
   *
   * After reaching all reachable objectives, any remaining AP is spent on
   * random adjacent moves to low-probability cells (keeps position uncertain).
   */
  private aiGhostMove(): void {
    const ghost = this.entityManager.getEntity(GameRole.GHOST);
    if (!ghost) return;

    // Only use pattern memory if pattern learning is active this round
    const mostScannedZone = this.patternLearningActive 
      ? this.memory.getMostScannedZone() 
      : null;
    const confidence = this.patternLearningActive 
      ? this.memory.getConfidence() 
      : 0;

    while (this.ghostActions.canMove()) {
      const currentGhost = this.entityManager.getEntity(GameRole.GHOST);
      if (!currentGhost) break;

      const objectives = this.ghostActions.getObjectives();
      const incomplete = objectives.filter(o => !o.completed);

      if (incomplete.length === 0) {
        // All objectives done — burn remaining AP on random low-prob moves
        this.drainRemainingMoveAP(currentGhost.position);
        break;
      }

      // Pick nearest incomplete objective
      const target = incomplete.reduce((best, obj) => {
        const distBest = Math.abs(best.position.x - currentGhost.position.x)
                       + Math.abs(best.position.y - currentGhost.position.y);
        const distObj  = Math.abs(obj.position.x  - currentGhost.position.x)
                       + Math.abs(obj.position.y  - currentGhost.position.y);
        return distObj < distBest ? obj : best;
      });

      if (
        currentGhost.position.x === target.position.x &&
        currentGhost.position.y === target.position.y
      ) {
        this.ghostActions.completeObjective(target.id);
        continue;
      }

      const path = this.astar.findPath(this.grid, currentGhost.position, target.position);
      if (!path || path.cells.length < 2) {
        // No path to this objective — burn remaining AP on random moves
        this.drainRemainingMoveAP(currentGhost.position);
        break;
      }

      let nextStep = path.cells[1];

      // Pattern-aware: if the next step is in the human's most-scanned zone
      // and we have enough confidence, try an alternative step
      if (confidence > 0.4 && mostScannedZone) {
        const stepInDangerZone = HumanPatternMemory.isInQuadrant(nextStep, mostScannedZone);
        if (stepInDangerZone) {
          const alternatives = this.getAdjacentCells(currentGhost.position)
            .filter(c => !HumanPatternMemory.isInQuadrant(c, mostScannedZone))
            .sort((a, b) => {
              const cellA = this.grid.getCell(a.x, a.y);
              const cellB = this.grid.getCell(b.x, b.y);
              return (cellA?.probability ?? 1) - (cellB?.probability ?? 1);
            });
          if (alternatives.length > 0) {
            nextStep = alternatives[0];
          }
        }
      }

      // Loop detection
      const recentPositions = this.ghostMoveHistory.slice(-4);
      const isLooping = recentPositions.some(p => p.x === nextStep.x && p.y === nextStep.y);
      if (isLooping) {
        const alternatives = this.getAdjacentCells(currentGhost.position)
          .filter(c => !recentPositions.some(p => p.x === c.x && p.y === c.y))
          .sort((a, b) => {
            const cellA = this.grid.getCell(a.x, a.y);
            const cellB = this.grid.getCell(b.x, b.y);
            return (cellA?.probability ?? 1) - (cellB?.probability ?? 1);
          });
        if (alternatives.length > 0) {
          const moved = this.ghostActions.move(alternatives[0].x, alternatives[0].y);
          if (moved) {
            this.aiRecord(GameRole.GHOST, 'MOVE', alternatives[0].x, alternatives[0].y,
              `AI loop-break → (${alternatives[0].x},${alternatives[0].y})`);
            this.ghostMoveHistory.push(alternatives[0]);
            if (this.ghostMoveHistory.length > 8) this.ghostMoveHistory.shift();
          }
        }
        break;
      }

      const moved = this.ghostActions.move(nextStep.x, nextStep.y);
      if (!moved) break;

      this.aiRecord(GameRole.GHOST, 'MOVE', nextStep.x, nextStep.y, `AI → (${nextStep.x},${nextStep.y})`);
      this.ghostMoveHistory.push(nextStep);
      if (this.ghostMoveHistory.length > 8) this.ghostMoveHistory.shift();

      const updatedGhost = this.entityManager.getEntity(GameRole.GHOST);
      if (
        updatedGhost &&
        updatedGhost.position.x === target.position.x &&
        updatedGhost.position.y === target.position.y
      ) {
        this.ghostActions.completeObjective(target.id);
      }
    }
  }

  /**
   * Burn remaining OBJECTIVE-phase AP on random adjacent moves to low-probability
   * cells. This keeps the Ghost's position uncertain and avoids a silent pass.
   */
  private drainRemainingMoveAP(startPos: Position): void {
    let safetyLimit = 12;
    while (this.ghostActions.canMove() && safetyLimit-- > 0) {
      const currentGhost = this.entityManager.getEntity(GameRole.GHOST);
      if (!currentGhost) break;

      // Pick the adjacent cell with the lowest probability (safest to step on)
      const adjacent = this.getAdjacentCells(currentGhost.position)
        .filter(c => !this.ghostMoveHistory.slice(-2).some(h => h.x === c.x && h.y === c.y))
        .sort((a, b) => {
          const ca = this.grid.getCell(a.x, a.y);
          const cb = this.grid.getCell(b.x, b.y);
          return (ca?.probability ?? 1) - (cb?.probability ?? 1);
        });

      if (adjacent.length === 0) break;

      // Pick randomly from the two lowest-probability neighbours for variety
      const pick = adjacent[Math.floor(Math.random() * Math.min(2, adjacent.length))];
      const moved = this.ghostActions.move(pick.x, pick.y);
      if (!moved) break;

      this.aiRecord(GameRole.GHOST, 'MOVE', pick.x, pick.y, `AI wander → (${pick.x},${pick.y})`);
      this.ghostMoveHistory.push(pick);
      if (this.ghostMoveHistory.length > 8) this.ghostMoveHistory.shift();
    }
    // suppress unused param warning — startPos used implicitly via ghostMoveHistory seed
    void startPos;
  }

  // ─── Seeker AI ────────────────────────────────────────────────────────────

  private takeSeekerTurn(phase: GamePhase): void {
    if (phase === GamePhase.COLLAPSE) {
      this.aiSeekerCollapse();
    }
  }

  /**
   * Pattern-aware Seeker collapse.
   *
   * Uses memory to:
   * 1. Pre-scan the human Ghost's most-frequented zone at the start of COLLAPSE
   * 2. Discount probability spikes in the human's known decoy zones
   * 3. Lock earlier when pattern confidence is high (human is predictable)
   * 4. Bias MCTS toward cells the human Ghost has visited recently
   */
  private aiSeekerCollapse(): void {
    const seeker = this.entityManager.getEntity(GameRole.SEEKER);
    if (!seeker) return;

    const ghost = this.entityManager.getEntity(GameRole.GHOST);
    const ghostPos = ghost?.position;
    
    // Only use pattern confidence if pattern learning is active this round
    const confidence = this.patternLearningActive 
      ? this.memory.getConfidence() 
      : 0;

    // ── Pattern-based pre-scan on first tick of COLLAPSE ──────────────────
    if (this.phaseTickCount === 1 && confidence > 0.35 && this.seekerActions.canScan()) {
      const predictedZone = this.memory.getPredictedGhostZone();
      if (predictedZone) {
        const centre = HumanPatternMemory.quadrantCentre(predictedZone);
        this.seekerActions.scan(centre.x, centre.y, 2);
        this.mcts.recordScan(centre.x, centre.y);
        this.aiRecord(GameRole.SEEKER, 'SCAN', centre.x, centre.y, `AI pre-scan ${predictedZone} zone`);
      }
    }

    // ── Boost belief at cells the human Ghost has visited recently ─────────
    if (confidence > 0.4) {
      const frequentCells = this.memory.getFrequentGhostCells(5);
      for (const fc of frequentCells) {
        // Artificially spike the belief at frequently-visited cells
        // Weight proportional to visit frequency and confidence
        const boost = fc.weight * 0.04 * confidence;
        this.beliefEngine.spike(fc.x, fc.y, boost);
      }
    }

    // ── Discount decoy zones — reduce probability in the human's decoy zone ─
    if (confidence > 0.5) {
      const decoyZone = this.memory.getPredictedDecoyZone();
      if (decoyZone) {
        const centre = HumanPatternMemory.quadrantCentre(decoyZone);
        // Reduce probability in the decoy zone (it's probably fake)
        const cells = this.grid.getCellsInRadius(centre.x, centre.y, 4);
        for (const cell of cells) {
          const current = this.grid.getCell(cell.x, cell.y);
          if (current && current.probability > 0.02) {
            this.grid.setCell(cell.x, cell.y, {
              probability: current.probability * (1 - 0.3 * confidence),
            });
          }
        }
        this.grid.normalize();
      }
    }

    // ── High-confidence direct lock ────────────────────────────────────────
    // Lower the lock threshold when we have good pattern data
    const lockThreshold = confidence > 0.6 ? 0.10 : 0.15;
    if (this.seekerActions.canLock()) {
      const hottest = this.beliefEngine.getHighestProbabilityCell();
      if (hottest.probability > lockThreshold) {
        const ghostPosition = ghostPos ?? { x: -1, y: -1 };
        const hit = this.seekerActions.lock(hottest.x, hottest.y, ghostPosition);
        this.aiRecord(GameRole.SEEKER, 'LOCK', hottest.x, hottest.y,
          hit ? `🔒 AI HIT (${hottest.x},${hottest.y})` : `AI miss (${hottest.x},${hottest.y})`);
        if (hit) return;
        this.mcts.recordScan(hottest.x, hottest.y);
      }
    }

    // ── MCTS-guided scan + lock sequence ──────────────────────────────────
    const updatedSeeker = this.entityManager.getEntity(GameRole.SEEKER);
    if (!updatedSeeker || updatedSeeker.ap <= 0) return;

    const recommendations = this.mcts.evaluate(this.grid, updatedSeeker.ap, ghostPos);

    for (const rec of recommendations) {
      const currentSeeker = this.entityManager.getEntity(GameRole.SEEKER);
      if (!currentSeeker || currentSeeker.ap <= 0) break;

      const action = rec.action;

      if (action.type === 'LOCK' && this.seekerActions.canLock()) {
        const ghostPosition = ghostPos ?? { x: -1, y: -1 };
        const hit = this.seekerActions.lock(action.x, action.y, ghostPosition);
        this.mcts.recordScan(action.x, action.y);
        this.aiRecord(GameRole.SEEKER, 'LOCK', action.x, action.y,
          hit ? `🔒 AI HIT (${action.x},${action.y})` : `AI miss (${action.x},${action.y})`);
        if (hit) return;
      } else if (action.type === 'SCAN' && this.seekerActions.canScan()) {
        this.seekerActions.scan(action.x, action.y, (action as { radius?: number }).radius ?? 2);
        this.mcts.recordScan(action.x, action.y);
        this.aiRecord(GameRole.SEEKER, 'SCAN', action.x, action.y, `AI scan (${action.x},${action.y})`);

        // After scanning, check if we should lock the now-hottest cell
        const afterScanSeeker = this.entityManager.getEntity(GameRole.SEEKER);
        const postScanThreshold = confidence > 0.5 ? 0.14 : 0.18;
        if (afterScanSeeker && afterScanSeeker.ap >= 4) {
          const newHottest = this.beliefEngine.getHighestProbabilityCell();
          if (newHottest.probability > postScanThreshold && this.seekerActions.canLock()) {
            const ghostPosition = ghostPos ?? { x: -1, y: -1 };
            const hit = this.seekerActions.lock(newHottest.x, newHottest.y, ghostPosition);
            this.mcts.recordScan(newHottest.x, newHottest.y);
            this.aiRecord(GameRole.SEEKER, 'LOCK', newHottest.x, newHottest.y,
              hit ? `🔒 AI HIT (${newHottest.x},${newHottest.y})` : `AI miss (${newHottest.x},${newHottest.y})`);
            if (hit) return;
          }
        }
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getAdjacentCells(pos: Position): Position[] {
    return [
      { x: pos.x,     y: pos.y - 1 },
      { x: pos.x,     y: pos.y + 1 },
      { x: pos.x - 1, y: pos.y     },
      { x: pos.x + 1, y: pos.y     },
    ].filter(c => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10);
  }

  private clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
  }

  updateRole(role: GameRole): void {
    this.role = role;
    this.ghostMoveHistory = [];
    this.phaseTickCount = 0;
    this.lastPhase = null;
    // Keep memory — it persists across role swaps within a match
  }

  updateRound(roundNumber: number): void {
    this._roundNumber = roundNumber;
    this.mcts.reset();
    this.ghostMoveHistory = [];
    // Recalculate pattern learning status for the new round number
    this.updatePatternLearningStatus();
    // Keep memory — it accumulates across rounds
  }
}
