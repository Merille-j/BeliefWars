import { GameRole } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from './EventBus';
import { RoleAndRoundStore } from '../state/RoleAndRoundStore';

/**
 * Randomly assigns Ghost and Seeker roles to players.
 * In single-player mode, the human gets one role and AI gets the other.
 */
export class RoleAssign {
  constructor(private store: RoleAndRoundStore) {}

  /**
   * Assign roles to two player IDs randomly (50/50).
   * Returns the assignment map.
   */
  assignRoles(playerIds: string[]): Record<string, GameRole> {
    if (playerIds.length < 2) {
      // Single player: human + AI
      const humanId = playerIds[0] ?? 'human';
      const aiId = 'ai';
      const humanIsGhost = Math.random() < 0.5;

      this.store.assignRole(humanId, humanIsGhost ? GameRole.GHOST : GameRole.SEEKER);
      this.store.assignRole(aiId, humanIsGhost ? GameRole.SEEKER : GameRole.GHOST);
    } else {
      // Two players: random assignment
      const shuffled = Math.random() < 0.5 ? playerIds : [playerIds[1], playerIds[0]];
      this.store.assignRole(shuffled[0], GameRole.GHOST);
      this.store.assignRole(shuffled[1], GameRole.SEEKER);
    }

    const assignments = this.store.getRoleAssignments();
    eventBus.publish(EventType.ROLES_ASSIGNED, { assignments });
    return assignments;
  }

  /**
   * Re-assign roles randomly for the next round.
   * Each round is a fresh 50/50 draw — not a guaranteed swap.
   */
  swapRoles(): void {
    const humanId = Object.keys(this.store.getRoleAssignments()).find(id => id !== 'ai') ?? 'human';
    this.store.reassignRandom(humanId);

    eventBus.publish(EventType.ROLES_ASSIGNED, {
      assignments: this.store.getRoleAssignments(),
      randomised: true,
    });
  }

  getHumanRole(): GameRole {
    return this.store.getRole('human') ?? GameRole.GHOST;
  }

  getAIRole(): GameRole {
    const humanRole = this.getHumanRole();
    return humanRole === GameRole.GHOST ? GameRole.SEEKER : GameRole.GHOST;
  }
}
