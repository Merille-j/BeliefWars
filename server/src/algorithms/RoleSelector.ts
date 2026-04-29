import { AStarPathfinding } from './AStarPathfinding';
import { MCTS } from './MCTS';

/**
 * Binds algorithms to roles.
 * Ghost uses A* pathfinding; Seeker uses MCTS.
 * Works regardless of whether the role is human or AI.
 */
export class RoleSelector {
  private astar: AStarPathfinding;
  private mcts: MCTS;

  constructor() {
    this.astar = new AStarPathfinding();
    this.mcts = new MCTS();
  }

  /**
   * Returns the A* pathfinding instance for Ghost support.
   */
  getGhostSupport(): AStarPathfinding {
    return this.astar;
  }

  /**
   * Returns the MCTS instance for Seeker support.
   */
  getSeekerSupport(): MCTS {
    return this.mcts;
  }
}
