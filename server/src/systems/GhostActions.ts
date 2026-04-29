import { GamePhase, Objective, Position } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from '../core/EventBus';
import { BeliefStateEngine } from '../core/BeliefStateEngine';
import { EntityManager } from '../core/EntityManager';
import { PhaseController } from '../core/PhaseController';
import { GameRole } from '../types/game.types';

const DECOY_MAGNITUDE = 0.30;
const NOISE_MAGNITUDE = 0.15;
const FALSE_TRAIL_MAGNITUDE = 0.20;
const NOISE_RADIUS = 2;

// AP costs for Ghost actions
const DECOY_AP_COST = 2;
const NOISE_AP_COST = 2;
const FALSE_TRAIL_AP_COST = 3;
const MOVE_AP_COST = 1;

/**
 * Processes all Ghost player actions.
 * Validates phase and deducts AP before executing each action.
 */
export class GhostActions {
  constructor(
    private beliefEngine: BeliefStateEngine,
    private entityManager: EntityManager,
    private phaseController: PhaseController,
    private objectives: Objective[]
  ) {}

  /**
   * Throw Decoy: spike probability at target cell by +30%.
   * Costs 2 AP. Allowed in MANIPULATION phase.
   */
  throwDecoy(x: number, y: number): boolean {
    if (!this.phaseController.validateAction('THROW_DECOY')) return false;
    if (!this.entityManager.deductAP(GameRole.GHOST, DECOY_AP_COST)) return false;

    this.beliefEngine.spike(x, y, DECOY_MAGNITUDE);
    return true;
  }

  /**
   * Make Noise: spike all cells within radius 2 by +15% each.
   * Costs 2 AP. Allowed in MANIPULATION phase.
   */
  makeNoise(x: number, y: number, radius: number = NOISE_RADIUS): boolean {
    if (!this.phaseController.validateAction('MAKE_NOISE')) return false;
    if (!this.entityManager.deductAP(GameRole.GHOST, NOISE_AP_COST)) return false;

    const cells = this.getCellsInRadius(x, y, radius);
    this.beliefEngine.spikeRegion(cells, NOISE_MAGNITUDE);
    return true;
  }

  /**
   * Lay False Trail: spike each cell along a path by +20%.
   * Costs 3 AP. Allowed in MANIPULATION phase.
   */
  layFalseTrail(cells: Position[]): boolean {
    if (!this.phaseController.validateAction('LAY_FALSE_TRAIL')) return false;
    if (!this.entityManager.deductAP(GameRole.GHOST, FALSE_TRAIL_AP_COST)) return false;

    for (const cell of cells) {
      this.beliefEngine.spike(cell.x, cell.y, FALSE_TRAIL_MAGNITUDE);
    }
    return true;
  }

  /**
   * Move: update Ghost position one step adjacently (up/down/left/right only).
   * Costs 1 AP. Allowed in OBJECTIVE phase.
   * Target must be exactly 1 Manhattan step from current position.
   */
  move(x: number, y: number): boolean {
    if (!this.phaseController.validateAction('MOVE')) return false;

    const ghost = this.entityManager.getEntity(GameRole.GHOST);
    if (!ghost) return false;

    // Enforce adjacency — only cardinal directions, no diagonals, no teleporting
    const dx = Math.abs(x - ghost.position.x);
    const dy = Math.abs(y - ghost.position.y);
    if (dx + dy !== 1) {
      // Not an adjacent cell
      return false;
    }

    if (!this.entityManager.deductAP(GameRole.GHOST, MOVE_AP_COST)) return false;

    this.entityManager.updatePosition(GameRole.GHOST, x, y);
    this.beliefEngine.diffuse();
    return true;
  }

  /**
   * Complete Objective: mark an objective as completed if Ghost is at its position.
   * Allowed in OBJECTIVE phase.
   */
  completeObjective(objectiveId: string): boolean {
    if (!this.phaseController.validateAction('COMPLETE_OBJECTIVE')) return false;

    const objective = this.objectives.find(o => o.id === objectiveId);
    if (!objective || objective.completed) return false;

    const ghost = this.entityManager.getEntity(GameRole.GHOST);
    if (!ghost) return false;

    // Ghost must be at the objective position
    if (ghost.position.x !== objective.position.x || ghost.position.y !== objective.position.y) {
      return false;
    }

    objective.completed = true;

    const completedCount = this.objectives.filter(o => o.completed).length;

    eventBus.publish(EventType.OBJECTIVE_REACHED, {
      objectiveId,
      position: objective.position,
      completedCount,
    });

    // Ghost must ALSO survive both Collapse phases to win.
    // Completing objectives alone does NOT end the round — the round ends
    // after the final Collapse in GameEngine.advancePhase().

    return true;
  }

  getObjectives(): Objective[] {
    return [...this.objectives];
  }

  setObjectives(objectives: Objective[]): void {
    this.objectives = objectives;
  }

  getRemainingAP(): number {
    return this.entityManager.getEntity(GameRole.GHOST)?.ap ?? 0;
  }

  canThrowDecoy(): boolean { return this.getRemainingAP() >= DECOY_AP_COST; }
  canMakeNoise(): boolean  { return this.getRemainingAP() >= NOISE_AP_COST; }
  canLayFalseTrail(): boolean { return this.getRemainingAP() >= FALSE_TRAIL_AP_COST; }
  canMove(): boolean       { return this.getRemainingAP() >= MOVE_AP_COST; }

  private getCellsInRadius(cx: number, cy: number, radius: number): Position[] {
    const cells: Position[] = [];
    const GRID_SIZE = 10;
    for (let y = Math.max(0, cy - radius); y <= Math.min(GRID_SIZE - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(GRID_SIZE - 1, cx + radius); x++) {
        cells.push({ x, y });
      }
    }
    return cells;
  }
}
