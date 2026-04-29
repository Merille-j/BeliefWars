import { Position } from '../types/game.types';
import { BeliefStateEngine } from '../core/BeliefStateEngine';
import { EntityManager } from '../core/EntityManager';
import { PhaseController } from '../core/PhaseController';
import { GameRole } from '../types/game.types';

const SCAN_AP_COST = 2;
const LOCK_AP_COST = 4;
const SCAN_INCREMENT = 0.10; // 10% increase per cell in scan zone

/**
 * Processes all Seeker player actions.
 * Validates AP before executing each action.
 */
export class SeekerActions {
  constructor(
    private beliefEngine: BeliefStateEngine,
    private entityManager: EntityManager,
    private phaseController: PhaseController
  ) {}

  /**
   * Scan: increase probability in a zone. Costs 2 AP.
   * Allowed in COLLAPSE phase.
   */
  scan(x: number, y: number, radius: number): boolean {
    if (!this.phaseController.validateAction('SCAN')) return false;

    const deducted = this.entityManager.deductAP(GameRole.SEEKER, SCAN_AP_COST);
    if (!deducted) return false;

    this.beliefEngine.scan({ x, y, radius }, SCAN_INCREMENT);
    return true;
  }

  /**
   * Lock: attempt to confirm Ghost position. Costs 4 AP.
   * Returns true if Ghost was found (belief collapse).
   * Allowed in COLLAPSE phase.
   */
  lock(x: number, y: number, ghostPosition: Position): boolean {
    if (!this.phaseController.validateAction('LOCK')) return false;

    const deducted = this.entityManager.deductAP(GameRole.SEEKER, LOCK_AP_COST);
    if (!deducted) return false;

    return this.beliefEngine.lock(x, y, ghostPosition);
  }

  /**
   * Get remaining AP for the Seeker.
   */
  getRemainingAP(): number {
    return this.entityManager.getEntity(GameRole.SEEKER)?.ap ?? 0;
  }

  /**
   * Check if Seeker has enough AP for a scan.
   */
  canScan(): boolean {
    return this.getRemainingAP() >= SCAN_AP_COST;
  }

  /**
   * Check if Seeker has enough AP for a lock.
   */
  canLock(): boolean {
    return this.getRemainingAP() >= LOCK_AP_COST;
  }
}
