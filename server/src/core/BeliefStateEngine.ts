import { Position } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from './EventBus';
import { MapGridSystem } from './MapGridSystem';

/**
 * Algorithm 1 — Belief-State Search Engine
 *
 * Manages the probability distribution over the grid representing
 * the Seeker's belief about where the Ghost might be.
 *
 * All operations normalize the grid so probabilities sum to 1.
 */
export class BeliefStateEngine {
  /**
   * Pre-allocated delta buffer for diffusion — avoids a fresh allocation on every call.
   * Sized to the grid dimensions at construction time.
   */
  private readonly delta: number[][];

  constructor(private grid: MapGridSystem) {
    this.delta = Array.from(
      { length: grid.height },
      () => new Array(grid.width).fill(0)
    );
  }

  /**
   * Diffuse: each tick, 10% of each cell's probability spreads equally
   * to its 4 neighbors. The grid is renormalized after diffusion.
   *
   * Uses a pre-allocated delta buffer to avoid per-call heap allocation.
   */
  diffuse(): void {
    const DIFFUSION_RATE = 0.10;
    const width = this.grid.width;
    const height = this.grid.height;
    const snapshot = this.grid.getCells();

    // Clear the reusable delta buffer
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.delta[y][x] = 0;
      }
    }

    // Compute outflow and inflow
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cell = snapshot[y][x];
        const outflow = cell.probability * DIFFUSION_RATE;
        const neighbors = this.grid.getNeighbors(x, y);
        const share = outflow / neighbors.length;

        this.delta[y][x] -= outflow;
        for (const n of neighbors) {
          this.delta[n.y][n.x] += share;
        }
      }
    }

    // Apply deltas
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const current = snapshot[y][x].probability;
        const newProb = Math.max(0, current + this.delta[y][x]);
        this.grid.setCell(x, y, { probability: newProb });
      }
    }

    this.grid.normalize();
    eventBus.publish(EventType.BELIEF_UPDATED, { reason: 'diffuse' });
  }

  /**
   * Spike: increase probability at a single cell by magnitude (0–1 scale addition),
   * then renormalize.
   */
  spike(x: number, y: number, magnitude: number): void {
    const cell = this.grid.getCell(x, y);
    if (!cell) return;

    const newProb = Math.min(1, cell.probability + magnitude);
    this.grid.setCell(x, y, { probability: newProb });
    this.grid.normalize();

    eventBus.publish(EventType.BELIEF_UPDATED, { reason: 'spike', x, y, magnitude });
  }

  /**
   * SpikeRegion: spike multiple cells simultaneously, then renormalize once.
   */
  spikeRegion(cells: Position[], magnitude: number): void {
    for (const pos of cells) {
      const cell = this.grid.getCell(pos.x, pos.y);
      if (!cell) continue;
      const newProb = Math.min(1, cell.probability + magnitude);
      this.grid.setCell(pos.x, pos.y, { probability: newProb });
    }
    this.grid.normalize();

    eventBus.publish(EventType.BELIEF_UPDATED, { reason: 'spikeRegion', cells, magnitude });
  }

  /**
   * Scan: increase probability for all cells within a zone (Chebyshev radius),
   * then renormalize.
   */
  scan(zone: { x: number; y: number; radius: number }, increment: number): void {
    const cells = this.grid.getCellsInRadius(zone.x, zone.y, zone.radius);
    for (const cell of cells) {
      const newProb = Math.min(1, cell.probability + increment);
      this.grid.setCell(cell.x, cell.y, { probability: newProb });
    }
    this.grid.normalize();

    eventBus.publish(EventType.BELIEF_UPDATED, { reason: 'scan', zone, increment });
  }

  /**
   * Lock: attempt to confirm Ghost position.
   * - If (x,y) matches ghostPosition → collapse to 100% at that cell.
   * - Otherwise → set (x,y) to 0% and renormalize remaining cells.
   */
  lock(x: number, y: number, ghostPosition: Position): boolean {
    if (ghostPosition.x === x && ghostPosition.y === y) {
      this.collapse(x, y);
      return true;
    } else {
      this.grid.setCell(x, y, { probability: 0 });
      this.grid.normalize();
      eventBus.publish(EventType.BELIEF_UPDATED, { reason: 'lock_miss', x, y });
      return false;
    }
  }

  /**
   * Collapse: set one cell to 100% probability, all others to 0%.
   * Publishes BELIEF_COLLAPSE event.
   */
  collapse(x: number, y: number): void {
    const width = this.grid.width;
    const height = this.grid.height;

    for (let cy = 0; cy < height; cy++) {
      for (let cx = 0; cx < width; cx++) {
        this.grid.setCell(cx, cy, { probability: cx === x && cy === y ? 1 : 0 });
      }
    }

    eventBus.publish(EventType.BELIEF_COLLAPSE, { x, y });
    eventBus.publish(EventType.BELIEF_UPDATED, { reason: 'collapse', x, y });
  }

  /**
   * Get the cell with the highest probability (most likely Ghost location).
   */
  getHighestProbabilityCell(): { x: number; y: number; probability: number } {
    let best = { x: 0, y: 0, probability: 0 };
    const cells = this.grid.getFlatCells();
    for (const cell of cells) {
      if (cell.probability > best.probability) {
        best = { x: cell.x, y: cell.y, probability: cell.probability };
      }
    }
    return best;
  }

  /**
   * Get top N cells by probability.
   */
  getTopCells(n: number): Array<{ x: number; y: number; probability: number }> {
    return this.grid
      .getFlatCells()
      .sort((a, b) => b.probability - a.probability)
      .slice(0, n)
      .map(c => ({ x: c.x, y: c.y, probability: c.probability }));
  }
}
