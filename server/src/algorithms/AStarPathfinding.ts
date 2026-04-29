import { Path, Position } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from '../core/EventBus';
import { MapGridSystem } from '../core/MapGridSystem';

interface AStarNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: AStarNode | null;
}

/**
 * Min-heap priority queue for A* open set.
 */
class MinHeap {
  private heap: AStarNode[] = [];

  push(node: AStarNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): AStarNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].f <= this.heap[i].f) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].f < this.heap[smallest].f) smallest = left;
      if (right < n && this.heap[right].f < this.heap[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

/**
 * Algorithm 4 — A* Pathfinding
 *
 * Finds the lowest-cost path from start to goal on the probability grid.
 * Cell cost = base movement cost + probability value (higher probability = riskier for Ghost).
 * Uses 4-directional movement. Must complete within 50ms.
 */
export class AStarPathfinding {
  private readonly TIMEOUT_MS = 50;

  /**
   * Find a path from start to goal using A*.
   * Returns null if no path exists or timeout exceeded.
   */
  findPath(grid: MapGridSystem, start: Position, goal: Position): Path | null {
    const startTime = Date.now();

    if (!grid.isInBounds(start.x, start.y) || !grid.isInBounds(goal.x, goal.y)) {
      eventBus.publish(EventType.PATHFINDING_ERROR, {
        reason: 'out_of_bounds',
        start,
        goal,
      });
      return null;
    }

    const openSet = new MinHeap();
    const closedSet = new Set<string>();
    const gScores = new Map<string, number>();

    const key = (x: number, y: number) => `${x},${y}`;
    const heuristic = (x: number, y: number) =>
      Math.abs(x - goal.x) + Math.abs(y - goal.y); // Manhattan distance

    const startNode: AStarNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: heuristic(start.x, start.y),
      f: heuristic(start.x, start.y),
      parent: null,
    };

    openSet.push(startNode);
    gScores.set(key(start.x, start.y), 0);

    while (openSet.size > 0) {
      // Timeout guard
      if (Date.now() - startTime > this.TIMEOUT_MS) {
        eventBus.publish(EventType.PATHFINDING_ERROR, {
          reason: 'timeout',
          start,
          goal,
        });
        return null;
      }

      const current = openSet.pop()!;
      const currentKey = key(current.x, current.y);

      if (closedSet.has(currentKey)) continue;
      closedSet.add(currentKey);

      // Goal reached
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(current);
      }

      // Expand neighbors (4-directional)
      const directions = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];

      for (const { dx, dy } of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;

        if (!grid.isInBounds(nx, ny)) continue;
        const neighborKey = key(nx, ny);
        if (closedSet.has(neighborKey)) continue;

        const cell = grid.getCell(nx, ny)!;
        // Cost = base movement cost + probability (Ghost avoids high-probability cells)
        const moveCost = cell.cost + cell.probability * 10;
        const tentativeG = current.g + moveCost;

        const existingG = gScores.get(neighborKey) ?? Infinity;
        if (tentativeG >= existingG) continue;

        gScores.set(neighborKey, tentativeG);
        const h = heuristic(nx, ny);
        openSet.push({
          x: nx,
          y: ny,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }

    // No path found
    eventBus.publish(EventType.PATHFINDING_ERROR, {
      reason: 'PATH_NOT_FOUND',
      start,
      goal,
    });
    return null;
  }

  private reconstructPath(node: AStarNode): Path {
    const cells: Position[] = [];
    let current: AStarNode | null = node;

    while (current !== null) {
      cells.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }

    return {
      cells,
      cost: node.g,
    };
  }
}
