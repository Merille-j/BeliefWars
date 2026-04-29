import { GamePhase, GameState, Objective } from '../types/game.types';

/**
 * Central game state store.
 * Holds phase, alert level, round number, and objectives.
 */
export class GameStateStore {
  private state: GameState;

  constructor() {
    this.state = {
      phase: GamePhase.RECON,
      alertLevel: 0,
      roundNumber: 1,
      objectives: [],
    };
  }

  get phase(): GamePhase {
    return this.state.phase;
  }

  get alertLevel(): number {
    return this.state.alertLevel;
  }

  get roundNumber(): number {
    return this.state.roundNumber;
  }

  get objectives(): Objective[] {
    return this.state.objectives;
  }

  update(partial: Partial<GameState>): void {
    this.state = { ...this.state, ...partial };
  }

  get(): GameState {
    return { ...this.state, objectives: [...this.state.objectives] };
  }

  serialize(): GameState {
    return this.get();
  }

  reset(): void {
    this.state = {
      phase: GamePhase.RECON,
      alertLevel: 0,
      roundNumber: this.state.roundNumber,
      objectives: [],
    };
  }
}
