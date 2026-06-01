import { GamePhase, ActionType } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from './EventBus';

// Which actions are allowed in each phase
const PHASE_ALLOWED_ACTIONS: Record<GamePhase, ActionType[]> = {
  [GamePhase.RECON]:         ['END_PHASE'],
  [GamePhase.MANIPULATION]:  ['THROW_DECOY', 'MAKE_NOISE', 'LAY_FALSE_TRAIL', 'END_PHASE'],
  [GamePhase.OBJECTIVE]:     ['MOVE', 'COMPLETE_OBJECTIVE', 'END_PHASE'],
  [GamePhase.AND_OR_EVENTS]: ['END_PHASE'],
  [GamePhase.COLLAPSE]:      ['SCAN', 'LOCK', 'END_PHASE'],
};

const PHASE_ORDER: GamePhase[] = [
  GamePhase.RECON,
  GamePhase.MANIPULATION,
  GamePhase.OBJECTIVE,
  GamePhase.AND_OR_EVENTS,
  GamePhase.COLLAPSE,
];

const PHASE_DESCRIPTIONS: Record<GamePhase, string> = {
  [GamePhase.RECON]:         'Observe the map and plan your strategy.',
  [GamePhase.MANIPULATION]:  'Ghost: Use decoys, noise, and false trails to mislead the Seeker.',
  [GamePhase.OBJECTIVE]:     'Ghost: Move across the grid and complete your objectives.',
  [GamePhase.AND_OR_EVENTS]: 'Nondeterministic events occur. Contingency plans activate.',
  [GamePhase.COLLAPSE]:      'Seeker: Use AP to scan zones and lock onto the Ghost.',
};

/**
 * Per-phase duration in seconds.
 * Ghost OBJECTIVE phase has 120 seconds; COLLAPSE still gives the Seeker 30 seconds.
 */
 export const PHASE_DURATIONS: Record<GamePhase, number> = {
   [GamePhase.RECON]:         20,
   [GamePhase.MANIPULATION]:  20,
   [GamePhase.OBJECTIVE]:     120,
   [GamePhase.AND_OR_EVENTS]: 20,
   [GamePhase.COLLAPSE]:      30,
};

/**
 * Enforces the five-phase sequence, validates actions, and tracks a
 * per-phase countdown. Supports multi-cycle rounds: a round runs
 * PHASE_ORDER twice before COLLAPSE triggers a round end.
 */
export class PhaseController {
  private _currentPhase: GamePhase = GamePhase.RECON;
  private _phaseIndex: number = 0;
  private _timeRemaining: number = PHASE_DURATIONS[GamePhase.RECON];
  /** How many full cycles (RECON→COLLAPSE) have completed this round. */
  private _cyclesCompleted: number = 0;
  /** Total cycles required before COLLAPSE ends the round. */
  static readonly CYCLES_PER_ROUND = 2;

  get currentPhase(): GamePhase {
    return this._currentPhase;
  }

  get phaseIndex(): number {
    return this._phaseIndex;
  }

  get phaseDescription(): string {
    return PHASE_DESCRIPTIONS[this._currentPhase];
  }

  get timeRemaining(): number {
    return this._timeRemaining;
  }

  /** Full duration of the current phase (used by client for progress bar). */
  get phaseDuration(): number {
    return PHASE_DURATIONS[this._currentPhase];
  }

  /** How many cycles have completed this round (0 or 1 during play). */
  get cyclesCompleted(): number {
    return this._cyclesCompleted;
  }

  /**
   * Whether the current COLLAPSE is the final one for this round.
   * Checked BEFORE advancePhase() increments the counter.
   * True when cyclesCompleted == CYCLES_PER_ROUND - 1 (i.e. this is the last cycle).
   */
  get isLastCycle(): boolean {
    return this._cyclesCompleted === PhaseController.CYCLES_PER_ROUND - 1;
  }

  /**
   * Decrement the phase timer by `deltaSeconds`.
   * Returns true when the timer has expired (caller should advance phase).
   */
  tickTimer(deltaSeconds: number): boolean {
    this._timeRemaining = Math.max(0, this._timeRemaining - deltaSeconds);
    return this._timeRemaining === 0;
  }

  /**
   * Advance to the next phase in the sequence.
   * After COLLAPSE, if more cycles remain, wraps back to RECON for the next cycle.
   * Returns the new phase.
   */
  advancePhase(): GamePhase {
    const previousPhase = this._currentPhase;
    eventBus.publish(EventType.PHASE_ENDED, { phase: previousPhase });

    // If we just finished COLLAPSE, count the completed cycle
    if (previousPhase === GamePhase.COLLAPSE) {
      this._cyclesCompleted++;
    }

    this._phaseIndex = (this._phaseIndex + 1) % PHASE_ORDER.length;
    this._currentPhase = PHASE_ORDER[this._phaseIndex];
    this._timeRemaining = PHASE_DURATIONS[this._currentPhase];

    eventBus.publish(EventType.PHASE_STARTED, { phase: this._currentPhase });
    return this._currentPhase;
  }

  isActionAllowed(actionType: ActionType): boolean {
    return PHASE_ALLOWED_ACTIONS[this._currentPhase].includes(actionType);
  }

  validateAction(actionType: ActionType): boolean {
    if (!this.isActionAllowed(actionType)) {
      eventBus.publish(EventType.PHASE_VIOLATION_ERROR, {
        action: actionType,
        currentPhase: this._currentPhase,
        allowedActions: PHASE_ALLOWED_ACTIONS[this._currentPhase],
      });
      return false;
    }
    return true;
  }

  reset(): void {
    this._phaseIndex = 0;
    this._currentPhase = GamePhase.RECON;
    this._timeRemaining = PHASE_DURATIONS[GamePhase.RECON];
    this._cyclesCompleted = 0;
    eventBus.publish(EventType.PHASE_STARTED, { phase: this._currentPhase });
  }

  setPhase(phase: GamePhase): void {
    this._phaseIndex = PHASE_ORDER.indexOf(phase);
    this._currentPhase = phase;
    this._timeRemaining = PHASE_DURATIONS[phase];
    this._cyclesCompleted = 0;
  }

  isLastPhase(): boolean {
    return this._phaseIndex === PHASE_ORDER.length - 1;
  }

  getAllPhases(): GamePhase[] {
    return [...PHASE_ORDER];
  }
}
