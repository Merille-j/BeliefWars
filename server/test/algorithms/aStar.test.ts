import { describe, it, expect } from 'vitest';
import { MapGridSystem } from '../../src/core/MapGridSystem';
import { AStarPathfinding } from '../../src/algorithms/AStarPathfinding';

describe('AStarPathfinding', () => {
  it('finds a shortest path on an empty grid', () => {
    const grid = new MapGridSystem(5, 5);
    const astar = new AStarPathfinding();

    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 4 };

    const path = astar.findPath(grid as any, start, goal);
    expect(path).not.toBeNull();
    expect(path!.cells.length).toBeGreaterThan(0);

    // Manhattan distance on empty grid should be 8 steps (cells count 9 including start)
    expect(path!.cells.length).toBe(9);
  });
});
