import {
  Action,
  GamePhase,
  GameRole,
  SerializedGameState,
  MoveRecord,
  MCTSRecommendation,
  NondeterministicEvent,
} from './types/game.types';
import { EventType } from './types/game.types';
import { eventBus } from './core/EventBus';

// Core systems
import { MapGridSystem } from './core/MapGridSystem';
import { BeliefStateEngine } from './core/BeliefStateEngine';
import { EntityManager } from './core/EntityManager';
import { PhaseController } from './core/PhaseController';
import { MatchController } from './core/MatchController';
import { RoleAssign } from './core/RoleAssign';

// State stores
import { GameStateStore } from './state/GameStateStore';
import { ProbabilityGridStore } from './state/ProbabilityGridStore';
import { RoleAndRoundStore } from './state/RoleAndRoundStore';

// Action systems
import { GhostActions } from './systems/GhostActions';
import { SeekerActions } from './systems/SeekerActions';
import { EventSystem } from './systems/EventSystem';
import { AIOpponent } from './systems/AIOpponent';

// Algorithms
import { MCTS } from './algorithms/MCTS';
import { AStarPathfinding } from './algorithms/AStarPathfinding';
import { HumanPatternMemory } from './algorithms/HumanPatternMemory';

export interface GameConfig {
  humanPlayerId: string;
  gridWidth?: number;
  gridHeight?: number;
}

/**
 * Main game engine orchestrator.
 * Instantiates all systems, wires up event subscriptions,
 * and provides the public API for the server layer.
 */
export class GameEngine {
  // State stores
  private gameStateStore: GameStateStore;
  private gridStore: ProbabilityGridStore;
  private roleAndRoundStore: RoleAndRoundStore;

  // Core systems
  private grid: MapGridSystem;
  private beliefEngine: BeliefStateEngine;
  private entityManager: EntityManager;
  private phaseController: PhaseController;
  private matchController: MatchController;
  private roleAssign: RoleAssign;

  // Action systems
  private ghostActions!: GhostActions;
  private seekerActions: SeekerActions;
  private eventSystem: EventSystem;
  private aiOpponent!: AIOpponent;

  // Algorithms
  private mcts: MCTS;
  private patternMemory: HumanPatternMemory;

  // State
  private humanPlayerId: string = 'human';
  private isInitialized: boolean = false;
  private seekerFoundGhost: boolean = false;
  /** Cached MCTS recommendations — computed in tick(), reused in getFullState(). */
  private cachedRecommendations: MCTSRecommendation[] = [];

  // Event unsubscribe functions
  private unsubscribers: Array<() => void> = [];

  constructor() {
    // Initialize stores
    this.gameStateStore = new GameStateStore();
    this.gridStore = new ProbabilityGridStore(10, 10);
    this.roleAndRoundStore = new RoleAndRoundStore();

    // Initialize core systems
    this.grid = this.gridStore.getGridSystem();
    this.beliefEngine = new BeliefStateEngine(this.grid);
    this.entityManager = new EntityManager();
    this.phaseController = new PhaseController();
    this.matchController = new MatchController(this.roleAndRoundStore);
    this.roleAssign = new RoleAssign(this.roleAndRoundStore);

    // Initialize action systems
    this.seekerActions = new SeekerActions(
      this.beliefEngine,
      this.entityManager,
      this.phaseController
    );
    this.eventSystem = new EventSystem(this.grid);

    // Initialize algorithms
    this.mcts = new MCTS();
    this.patternMemory = new HumanPatternMemory();
  }

  /**
   * Development helper: force-generate a nondeterministic event immediately.
   * Returns the generated event or null if none was generated.
   */
  triggerEvent(): NondeterministicEvent | null {
    if (!this.isInitialized) return null;
    return this.eventSystem.generateEvent();
  }

  /**
   * Initialize a new game with the given config.
   */
  initialize(config: GameConfig): void {
    this.humanPlayerId = config.humanPlayerId;

    // Reset all state — including match scores and role assignments
    this.roleAndRoundStore.resetMatch();
    this.roleAndRoundStore.setHumanPlayerId(config.humanPlayerId);
    this.gridStore.reset();
    this.gameStateStore.reset();
    this.phaseController.reset();
    this.seekerFoundGhost = false;
    this.cachedRecommendations = [];
    this.patternMemory.fullReset();

    // Assign roles
    this.roleAssign.assignRoles([this.humanPlayerId]);
    const humanRole = this.roleAndRoundStore.getRole(this.humanPlayerId) ?? GameRole.GHOST;
    const aiRole = humanRole === GameRole.GHOST ? GameRole.SEEKER : GameRole.GHOST;

    // Generate objectives for this round
    const objectives = this.matchController.generateObjectives();
    this.gameStateStore.update({ objectives });

    // Initialize ghost actions with objectives
    this.ghostActions = new GhostActions(
      this.beliefEngine,
      this.entityManager,
      this.phaseController,
      objectives,
      this.grid
    );

    // Reset entities — Ghost starts at a random grid cell, Seeker at bottom-right
    this.entityManager.reset(this.randomPosition(), { x: 9, y: 9 });

    // Initialize AI opponent
    this.aiOpponent = new AIOpponent(
      aiRole,
      this.grid,
      this.beliefEngine,
      this.entityManager,
      this.phaseController,
      this.ghostActions,
      this.seekerActions,
      this.roleAndRoundStore.currentRound,
      this.patternMemory
    );

    // Wire AI move recorder so AI actions appear in round history
    this.aiOpponent.setMoveRecorder((role, actionType, x, y, detail) => {
      this.recordMove('ai', role, actionType, x, y, detail);
    });

    // Wire up event subscriptions
    this.wireEvents();

    this.isInitialized = true;

    // Start the match
    this.matchController.startMatch();
  }

  private wireEvents(): void {
    // Clear previous subscriptions
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];

    // Track belief collapse (Seeker found Ghost)
    this.unsubscribers.push(
      eventBus.subscribe(EventType.BELIEF_COLLAPSE, () => {
        this.gameStateStore.update({ alertLevel: 100 });
        if (!this.seekerFoundGhost) {
          this.seekerFoundGhost = true;
          const objCompleted = this.ghostActions.getObjectives().filter(o => o.completed).length;
          this.matchController.endRound(GameRole.SEEKER, 'ghost_locked', objCompleted);
          this.startNewRound();
        }
      })
    );

    // Track phase changes
    this.unsubscribers.push(
      eventBus.subscribe(EventType.PHASE_STARTED, (payload) => {
        const p = payload as { phase: GamePhase };
        if (p.phase) {
          this.gameStateStore.update({ phase: p.phase });
          this.patternMemory.onPhaseStart(p.phase);
        }
      })
    );
    // Note: OBJECTIVES_COMPLETED is no longer used as a win trigger.
    // Ghost wins only if it BOTH survives the final Collapse AND completes ≥3 objectives.
    // That check happens in advancePhase() after the final Collapse.
  }

  /**
   * Main game tick — called every TICK_INTERVAL_MS (500ms).
   * Decrements the phase timer, auto-advances on expiry, runs AI, checks win conditions.
   */
  tick(): void {
    if (!this.isInitialized) return;

    const TICK_DELTA_SECONDS = 0.5; // matches TICK_INTERVAL_MS in index.ts

    // Decrement phase timer — auto-advance if expired
    const timerExpired = this.phaseController.tickTimer(TICK_DELTA_SECONDS);
    if (timerExpired) {
      this.advancePhase();
      return; // skip AI turn this tick; next tick will run in the new phase
    }

    const phase = this.phaseController.currentPhase;

    // Tick pattern memory collapse counter
    if (phase === GamePhase.COLLAPSE) {
      this.patternMemory.tickCollapse();
    }

    // Run AI turn
    this.aiOpponent.takeTurn(phase);

    // Check win conditions (AP exhaustion)
    this.checkWinConditions();

    // Update and cache recommendations for Seeker (reused in getFullState)
    if (phase === GamePhase.COLLAPSE) {
      const seeker = this.entityManager.getEntity(GameRole.SEEKER);
      const ghost = this.entityManager.getEntity(GameRole.GHOST);
      if (seeker && seeker.ap > 0) {
        this.cachedRecommendations = this.mcts.evaluate(this.grid, seeker.ap, ghost?.position);
      } else {
        this.cachedRecommendations = [];
      }
    } else {
      this.cachedRecommendations = [];
    }
  }

  /** Record a move into the current round's history */
  private recordMove(actor: 'human' | 'ai', role: GameRole, actionType: string, x?: number, y?: number, detail?: string): void {
    const move: MoveRecord = {
      actor,
      role,
      phase: this.phaseController.currentPhase,
      actionType: actionType as MoveRecord['actionType'],
      x,
      y,
      detail,
    };
    this.matchController.recordMove(move);
  }

  /**
   * Handle a player action submitted via API or Socket.IO.
   */
  handlePlayerAction(action: Action): { success: boolean; message: string } {
    if (!this.isInitialized) {
      return { success: false, message: 'Game not initialized' };
    }

    const humanRole = this.roleAndRoundStore.getRole(this.humanPlayerId);

    try {
      switch (action.type) {
        case 'THROW_DECOY': {
          if (humanRole !== GameRole.GHOST) return { success: false, message: 'Not Ghost role' };
          if (typeof action.x !== 'number' || typeof action.y !== 'number') return { success: false, message: 'Invalid coordinates' };
          const ok = this.ghostActions.throwDecoy(action.x, action.y);
          if (ok) {
            this.patternMemory.observeHumanAction('THROW_DECOY', action.x, action.y, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
            this.recordMove('human', GameRole.GHOST, 'THROW_DECOY', action.x, action.y, `Decoy at (${action.x},${action.y})`);
          }
          return { success: ok, message: ok ? 'Decoy thrown' : 'Action not allowed in current phase' };
        }

        case 'MAKE_NOISE': {
          if (humanRole !== GameRole.GHOST) return { success: false, message: 'Not Ghost role' };
          if (typeof action.x !== 'number' || typeof action.y !== 'number') return { success: false, message: 'Invalid coordinates' };
          const radius = typeof action.radius === 'number' ? action.radius : 2;
          const ok = this.ghostActions.makeNoise(action.x, action.y, radius);
          if (ok) {
            this.patternMemory.observeHumanAction('MAKE_NOISE', action.x, action.y, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
            this.recordMove('human', GameRole.GHOST, 'MAKE_NOISE', action.x, action.y, `Noise at (${action.x},${action.y}) r=${radius}`);
          }
          return { success: ok, message: ok ? 'Noise made' : 'Action not allowed in current phase' };
        }

        case 'LAY_FALSE_TRAIL': {
          if (humanRole !== GameRole.GHOST) return { success: false, message: 'Not Ghost role' };
          if (!Array.isArray(action.cells) || action.cells.length === 0) return { success: false, message: 'Invalid trail cells' };
          const ok = this.ghostActions.layFalseTrail(action.cells);
          if (ok) {
            const mid = action.cells[Math.floor(action.cells.length / 2)];
            this.patternMemory.observeHumanAction('LAY_FALSE_TRAIL', mid.x, mid.y, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
            this.recordMove('human', GameRole.GHOST, 'LAY_FALSE_TRAIL', mid.x, mid.y, `Trail: ${action.cells.map(c => `(${c.x},${c.y})`).join('→')}`);
          }
          return { success: ok, message: ok ? 'False trail laid' : 'Action not allowed in current phase' };
        }

        case 'MOVE': {
          if (humanRole !== GameRole.GHOST) return { success: false, message: 'Not Ghost role' };
          if (typeof action.x !== 'number' || typeof action.y !== 'number') return { success: false, message: 'Invalid coordinates' };
          const ok = this.ghostActions.move(action.x, action.y);
          if (ok) {
            this.patternMemory.observeHumanAction('MOVE', action.x, action.y, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
            this.recordMove('human', GameRole.GHOST, 'MOVE', action.x, action.y, `→ (${action.x},${action.y})`);
          }
          return { success: ok, message: ok ? 'Moved' : 'Action not allowed in current phase' };
        }

        case 'COMPLETE_OBJECTIVE': {
          if (humanRole !== GameRole.GHOST) return { success: false, message: 'Not Ghost role' };
          if (typeof action.objectiveId !== 'string' || !action.objectiveId) return { success: false, message: 'Invalid objectiveId' };
          const objectives = this.ghostActions.getObjectives();
          const objIndex = objectives.findIndex(o => o.id === action.objectiveId);
          const obj = objectives[objIndex];
          const ok = this.ghostActions.completeObjective(action.objectiveId);
          if (ok) {
            this.patternMemory.observeHumanAction('COMPLETE_OBJECTIVE', undefined, undefined, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound, objIndex >= 0 ? objIndex : undefined);
            this.recordMove('human', GameRole.GHOST, 'COMPLETE_OBJECTIVE', obj?.position.x, obj?.position.y, `Completed ${obj?.label ?? 'objective'}`);
          }
          return { success: ok, message: ok ? 'Objective completed' : 'Cannot complete objective' };
        }

        case 'SCAN': {
          if (humanRole !== GameRole.SEEKER) return { success: false, message: 'Not Seeker role' };
          if (typeof action.x !== 'number' || typeof action.y !== 'number') return { success: false, message: 'Invalid coordinates' };
          const scanRadius = typeof action.radius === 'number' ? action.radius : 2;
          const ok = this.seekerActions.scan(action.x, action.y, scanRadius);
          if (ok) {
            this.patternMemory.observeHumanAction('SCAN', action.x, action.y, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
            this.recordMove('human', GameRole.SEEKER, 'SCAN', action.x, action.y, `Scan (${action.x},${action.y}) r=${scanRadius}`);
          }
          return { success: ok, message: ok ? 'Zone scanned' : 'Insufficient AP or wrong phase' };
        }

        case 'LOCK': {
          if (humanRole !== GameRole.SEEKER) return { success: false, message: 'Not Seeker role' };
          if (typeof action.x !== 'number' || typeof action.y !== 'number') return { success: false, message: 'Invalid coordinates' };
          const ghost = this.entityManager.getEntity(GameRole.GHOST);
          if (!ghost) return { success: false, message: 'Ghost entity not found' };
          const hit = this.seekerActions.lock(action.x, action.y, ghost.position);
          this.patternMemory.observeHumanAction('LOCK', action.x, action.y, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
          this.recordMove('human', GameRole.SEEKER, 'LOCK', action.x, action.y, hit ? `🔒 HIT at (${action.x},${action.y})` : `Miss at (${action.x},${action.y})`);
          if (hit) {
            return { success: true, message: 'GHOST FOUND! Belief collapsed!' };
          }
          return { success: true, message: 'Lock missed' };
        }

        case 'END_PHASE': {
          this.patternMemory.observeHumanAction('END_PHASE', undefined, undefined, this.phaseController.currentPhase, this.roleAndRoundStore.currentRound);
          this.advancePhase();
          return { success: true, message: `Phase advanced to ${this.phaseController.currentPhase}` };
        }

        default:
          return { success: false, message: 'Unknown action type' };
      }
    } catch (err) {
      console.error('[GameEngine] Error handling action:', err);
      return { success: false, message: 'Internal error' };
    }
  }

  private advancePhase(): void {
    if (this._advancingPhase) return; // re-entrancy guard
    this._advancingPhase = true;
    try {
      this._doAdvancePhase();
    } finally {
      this._advancingPhase = false;
    }
  }

  private _advancingPhase = false;

  private _doAdvancePhase(): void {
    const previousPhase = this.phaseController.currentPhase;

    // Check if this COLLAPSE is the final one BEFORE advancing
    // (cyclesCompleted is still the count of completed cycles, not yet incremented)
    const isRoundEndingCollapse =
      previousPhase === GamePhase.COLLAPSE &&
      this.phaseController.isLastCycle;

    const newPhase = this.phaseController.advancePhase();
    // Note: advancePhase() increments cyclesCompleted when previousPhase === COLLAPSE
    this.gameStateStore.update({ phase: newPhase });

    // COLLAPSE ended — decide whether to end the round or start the next cycle
    if (previousPhase === GamePhase.COLLAPSE) {
      if (isRoundEndingCollapse) {
        // Final cycle complete — evaluate Ghost win condition:
        // Ghost wins ONLY if it survived AND completed at least 3 objectives.
        const allObjectives = this.ghostActions.getObjectives();
        const objCompleted = allObjectives.filter(o => o.completed).length;
        const ghostWins = objCompleted >= 3;

        if (ghostWins) {
          this.matchController.endRound(GameRole.GHOST, 'objectives_completed', objCompleted);
        } else {
          // Ghost survived but captured fewer than 3 objectives → Seeker wins
          this.matchController.endRound(GameRole.SEEKER, 'ghost_survived', objCompleted);
        }
        this.startNewRound();
        return;
      }
      // Cycle 1 done — start cycle 2: diffuse belief and reset AP for BOTH roles
      this.beliefEngine.diffuse();
      this.entityManager.resetAP(GameRole.GHOST, 8);
      this.entityManager.resetAP(GameRole.SEEKER, 10);
      return;
    }

    // Handle AND_OR_EVENTS phase
    if (newPhase === GamePhase.AND_OR_EVENTS) {
      this.eventSystem.generateEvent();
    }

    // Reset Ghost AP at the start of each Ghost action phase
    if (newPhase === GamePhase.MANIPULATION) {
      this.entityManager.resetAP(GameRole.GHOST, 8);
    }
    if (newPhase === GamePhase.OBJECTIVE) {
      this.entityManager.resetAP(GameRole.GHOST, 10);
    }

    // Reset Seeker AP at the start of COLLAPSE phase
    if (newPhase === GamePhase.COLLAPSE) {
      this.eventSystem.clearActiveEvent();
      this.entityManager.resetAP(GameRole.SEEKER, 10);
    }

    // Diffuse belief state at the start of every RECON phase
    if (newPhase === GamePhase.RECON) {
      this.beliefEngine.diffuse();
    }
  }

  private checkWinConditions(): void {
    // Belief collapse is handled directly in wireEvents via BELIEF_COLLAPSE event.
    // Auto-advance phase when an entity runs out of AP.
    // Guard: don't advance if we're already mid-advance (re-entrancy).
    if (this._advancingPhase) return;

    const phase = this.phaseController.currentPhase;

    // Seeker out of AP in COLLAPSE → Ghost survived → advance phase (triggers round end)
    if (phase === GamePhase.COLLAPSE) {
      const seeker = this.entityManager.getEntity(GameRole.SEEKER);
      if (seeker && seeker.ap <= 0) {
        this.advancePhase();
      }
    }

    // Ghost out of AP in action phases → auto-advance to next phase
    if (phase === GamePhase.MANIPULATION || phase === GamePhase.OBJECTIVE) {
      const ghost = this.entityManager.getEntity(GameRole.GHOST);
      if (ghost && ghost.ap <= 0) {
        this.advancePhase();
      }
    }
  }

  private startNewRound(): void {
    if (this.matchController.isMatchOver()) return;

    // Reset grid, game state, and phase for the new round
    this.gridStore.reset();
    this.gameStateStore.reset();
    this.phaseController.reset();
    this.seekerFoundGhost = false;
    this.cachedRecommendations = [];
    this.eventSystem.clearActiveEvent();
    this.patternMemory.reset(); // keep cross-round data, reset per-round counters

    // Swap roles for the new round
    this.roleAssign.swapRoles();
    const humanRole = this.roleAndRoundStore.getRole(this.humanPlayerId) ?? GameRole.GHOST;
    const aiRole = humanRole === GameRole.GHOST ? GameRole.SEEKER : GameRole.GHOST;

    const objectives = this.matchController.generateObjectives();
    // currentRound was already incremented by recordWin() inside endRound()
    this.gameStateStore.update({
      objectives,
      roundNumber: this.roleAndRoundStore.currentRound,
    });

    this.ghostActions.setObjectives(objectives);
    this.entityManager.reset(this.randomPosition(), { x: 9, y: 9 });

    // Update AI role and round number
    this.aiOpponent.updateRole(aiRole);
    this.aiOpponent.updateRound(this.roleAndRoundStore.currentRound);
  }

  /**
   * Serialize the complete game state for the client.
   */
  getFullState(): SerializedGameState {
    // Use cached recommendations from tick() — avoids running MCTS twice per cycle
    const recommendations = this.cachedRecommendations;

    return {
      gameState: this.gameStateStore.get(),
      grid: this.gridStore.serialize(),
      entities: this.entityManager.serialize(),
      ghostWins: this.roleAndRoundStore.ghostWins,
      seekerWins: this.roleAndRoundStore.seekerWins,
      humanWins: this.roleAndRoundStore.humanWins,
      aiWins: this.roleAndRoundStore.aiWins,
      currentRound: this.roleAndRoundStore.currentRound,
      humanPlayerId: this.humanPlayerId,
      roleAssignments: this.roleAndRoundStore.getRoleAssignments(),
      recommendations,
      activeEvent: this.eventSystem.getActiveEvent(),
      phaseTimeRemaining: Math.ceil(this.phaseController.timeRemaining),
      phaseDuration: this.phaseController.phaseDuration,
      cyclesCompleted: this.phaseController.cyclesCompleted,
      cyclesPerRound: PhaseController.CYCLES_PER_ROUND,
      roundHistory: this.matchController.getRoundHistory(),
    };
  }

  isMatchOver(): boolean {
    return this.matchController.isMatchOver();
  }

  getMatchWinner(): GameRole | null {
    return this.matchController.getMatchWinner();
  }

  getHumanRole(): GameRole {
    return this.roleAndRoundStore.getRole(this.humanPlayerId) ?? GameRole.GHOST;
  }

  /** Returns a random position anywhere on the 10×10 grid. */
  private randomPosition(): { x: number; y: number } {
    return {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };
  }

  /**
   * Compute A* path from the Ghost's current position to a goal cell.
   * Used to give the human Ghost player pathfinding assistance.
   * Returns the path cells (excluding start), or null if no path.
   */
  getPathToGoal(goalX: number, goalY: number): Array<{ x: number; y: number }> | null {
    if (!this.isInitialized) return null;
    const ghost = this.entityManager.getEntity(GameRole.GHOST);
    if (!ghost) return null;

    const astar = new AStarPathfinding();
    const path = astar.findPath(this.grid, ghost.position, { x: goalX, y: goalY });
    if (!path) return null;
    // Return path excluding the start cell (Ghost's current position)
    return path.cells.slice(1);
  }

  /** Returns true if a game has been initialized and is running. */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Singleton game engine instance
export const gameEngine = new GameEngine();
