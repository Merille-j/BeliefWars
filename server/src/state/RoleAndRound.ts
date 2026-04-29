import { GameRole, RoundStore } from '../types/game.types';

/**
 * Tracks match-level state: wins per role, wins per player, current round,
 * and role assignments.
 */
export class RoleAndRoundStore {
  private _ghostWins: number = 0;
  private _seekerWins: number = 0;
  private _humanWins: number = 0;
  private _aiWins: number = 0;
  private _currentRound: number = 1;
  private _roleAssignments: Map<string, GameRole> = new Map();

  // The human player's ID — set once per match so we can track player wins
  private _humanPlayerId: string = 'human';

  get ghostWins(): number  { return this._ghostWins; }
  get seekerWins(): number { return this._seekerWins; }
  get humanWins(): number  { return this._humanWins; }
  get aiWins(): number     { return this._aiWins; }
  get currentRound(): number { return this._currentRound; }

  setHumanPlayerId(id: string): void {
    this._humanPlayerId = id;
  }

  getRoleAssignments(): Record<string, GameRole> {
    const result: Record<string, GameRole> = {};
    this._roleAssignments.forEach((role, playerId) => {
      result[playerId] = role;
    });
    return result;
  }

  assignRole(playerId: string, role: GameRole): void {
    this._roleAssignments.set(playerId, role);
  }

  getRole(playerId: string): GameRole | undefined {
    return this._roleAssignments.get(playerId);
  }

  /** Returns the human player's current role. */
  getHumanRole(): GameRole {
    return this._roleAssignments.get(this._humanPlayerId) ?? GameRole.GHOST;
  }

  /**
   * Record a round win for a role.
   * Also increments the per-player win counter based on who held that role.
   */
  recordWin(winningRole: GameRole): void {
    if (winningRole === GameRole.GHOST) {
      this._ghostWins++;
    } else {
      this._seekerWins++;
    }

    // Determine which player held the winning role this round
    const humanRole = this._roleAssignments.get(this._humanPlayerId);
    if (humanRole === winningRole) {
      this._humanWins++;
    } else {
      this._aiWins++;
    }

    this._currentRound++;
  }

  /** Re-assign roles randomly for the next round. Returns the human player's new role. */
  reassignRandom(humanPlayerId: string): void {
    const humanIsGhost = Math.random() < 0.5;
    this._roleAssignments.set(humanPlayerId, humanIsGhost ? GameRole.GHOST : GameRole.SEEKER);
    this._roleAssignments.set('ai', humanIsGhost ? GameRole.SEEKER : GameRole.GHOST);
  }

  resetMatch(): void {
    this._ghostWins = 0;
    this._seekerWins = 0;
    this._humanWins = 0;
    this._aiWins = 0;
    this._currentRound = 1;
    this._roleAssignments.clear();
  }

  hasMatchWinner(): boolean {
    return this._humanWins >= 2 || this._aiWins >= 2;
  }

  /**
   * Returns the winning player ID ('human' or 'ai'), or null if no winner yet.
   */
  getMatchWinnerPlayerId(): string | null {
    if (this._humanWins >= 2) return this._humanPlayerId;
    if (this._aiWins >= 2) return 'ai';
    return null;
  }

  /**
   * Returns the role of the match winner (for display purposes), or null.
   * This is the role the winner held in the final round.
   */
  getMatchWinnerRole(): GameRole | null {
    const winnerId = this.getMatchWinnerPlayerId();
    if (!winnerId) return null;
    return this._roleAssignments.get(winnerId) ?? null;
  }

  serialize(): RoundStore {
    return {
      ghostWins: this._ghostWins,
      seekerWins: this._seekerWins,
      currentRound: this._currentRound,
      roleAssignments: this.getRoleAssignments(),
    };
  }
}
