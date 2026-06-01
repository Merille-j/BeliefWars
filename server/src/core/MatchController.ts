import { GameRole, Objective, RoundHistoryEntry, MoveRecord } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from './EventBus';
import { RoleAndRoundStore } from '../state/RoleAndRoundStore';

export class MatchController {
  private roundHistory: RoundHistoryEntry[] = [];
  /** Moves accumulated for the round currently in progress */
  private currentRoundMoves: MoveRecord[] = [];

  constructor(private store: RoleAndRoundStore) {}

  startMatch(): void {
    this.roundHistory = [];
    this.currentRoundMoves = [];
    this.startRound();
  }

  startRound(): void {
    this.currentRoundMoves = [];
    // Note: PHASE_STARTED for the actual first phase is published by PhaseController.reset()
    // called from GameEngine.startNewRound(). No need to publish here.
  }

  /** Record a single move during the current round */
  recordMove(move: MoveRecord): void {
    this.currentRoundMoves.push(move);
  }

  endRound(
    winningRole: GameRole,
    winCondition: RoundHistoryEntry['winCondition'] = 'ghost_survived',
    objectivesCompleted: number = 0
  ): void {
    const round = this.store.currentRound;
    const humanRole = this.store.getHumanRole();
    const aiRole = humanRole === GameRole.GHOST ? GameRole.SEEKER : GameRole.GHOST;
    const humanWon = humanRole === winningRole;

    const entry: RoundHistoryEntry = {
      round,
      winnerRole: winningRole,
      humanWon,
      humanRole,
      aiRole,
      winCondition,
      objectivesCompleted,
      moves: [...this.currentRoundMoves],
    };

    this.roundHistory.push(entry);
    this.currentRoundMoves = [];
    this.store.recordWin(winningRole);

    eventBus.publish(EventType.ROUND_WON, {
      winner: winningRole,
      round,
      ghostWins: this.store.ghostWins,
      seekerWins: this.store.seekerWins,
      humanWins: this.store.humanWins,
      aiWins: this.store.aiWins,
      entry,
    });

    if (this.store.hasMatchWinner()) {
      eventBus.publish(EventType.MATCH_WON, {
        winnerPlayerId: this.store.getMatchWinnerPlayerId(),
        roundHistory: this.roundHistory,
        ghostWins: this.store.ghostWins,
        seekerWins: this.store.seekerWins,
        humanWins: this.store.humanWins,
        aiWins: this.store.aiWins,
      });
    } else {
      this.startRound();
    }
  }

  isMatchOver(): boolean {
    return this.store.hasMatchWinner();
  }

  getMatchWinner(): GameRole | null {
    return this.store.getMatchWinnerRole();
  }

  getMatchWinnerPlayerId(): string | null {
    return this.store.getMatchWinnerPlayerId();
  }

  getRoundHistory(): RoundHistoryEntry[] {
    return [...this.roundHistory];
  }

  generateObjectives(): Objective[] {
    const positions = [
      { x: 1, y: 1 },
      { x: 8, y: 1 },
      { x: 1, y: 8 },
      { x: 8, y: 8 },
      { x: 5, y: 5 },
    ];
    return positions.map((pos, i) => ({
      id: crypto.randomUUID(),
      position: pos,
      completed: false,
      label: `Objective ${String.fromCharCode(65 + i)}`,
    }));
  }
}
