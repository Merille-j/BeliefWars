import { Cell, ProbabilityGrid } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from './EventBus';

/**
 * Core grid data structure for the 10×10 probability map.
 * Each cell stores a probability (0–1) and a movement cost.
 */
export class MapGridSystem {
  private cells: Cell[][];
  readonly width: number;
  readonly height: number;

  constructor(width: number = 10, height: number = 10) {
    this.width = width;
    this.height = height;
    this.cells = this.initializeCells();
  }

  private initializeCells(): Cell[][] {
    const uniformProb = 1 / (this.width * this.height);
    const grid: Cell[][] = [];
    for (let y = 0; y < this.height; y++) {
      grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        grid[y][x] = {
          probability: uniformProb,
          cost: 1,
          x,
          y,
        };
      }
    }
    return grid;
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getCell(x: number, y: number): Cell | null {
    if (!this.isInBounds(x, y)) return null;
    return { ...this.cells[y][x] };
  }

  setCell(x: number, y: number, updates: Partial<Omit<Cell, 'x' | 'y'>>): void {
    if (!this.isInBounds(x, y)) {
      eventBus.publish(EventType.GRID_BOUNDARY_ERROR, { x, y, width: this.width, height: this.height });
      return;
    }
    this.cells[y][x] = { ...this.cells[y][x], ...updates };
  }

  /**
   * Returns a deep-copy snapshot of all cells as a flat array.
   */
  getCells(): Cell[][] {
    return this.cells.map(row => row.map(cell => ({ ...cell })));
  }

  /**
   * Returns all cells as a flat array (read-only snapshot).
   */
  getFlatCells(): Cell[] {
    return this.cells.flat().map(c => ({ ...c }));
  }

  /**
   * Get neighbors (4-directional) of a cell.
   */
  getNeighbors(x: number, y: number): Cell[] {
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];
    const neighbors: Cell[] = [];
    for (const { dx, dy } of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isInBounds(nx, ny)) {
        neighbors.push({ ...this.cells[ny][nx] });
      }
    }
    return neighbors;
  }

  /**
   * Get all cells within a given radius (Chebyshev distance).
   */
  getCellsInRadius(cx: number, cy: number, radius: number): Cell[] {
    const result: Cell[] = [];
    for (let y = Math.max(0, cy - radius); y <= Math.min(this.height - 1, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x <= Math.min(this.width - 1, cx + radius); x++) {
        result.push({ ...this.cells[y][x] });
      }
    }
    return result;
  }

  /**
   * Normalize all probabilities so they sum to 1.
   */
  normalize(): void {
    let total = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        total += this.cells[y][x].probability;
      }
    }
    if (total === 0) {
      // Reset to uniform if all zeroed out
      const uniform = 1 / (this.width * this.height);
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          this.cells[y][x].probability = uniform;
        }
      }
      return;
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x].probability = this.cells[y][x].probability / total;
      }
    }
  }

  /**
   * Serialize the grid to a plain object for state snapshots.
   */
  serialize(): ProbabilityGrid {
    return {
      cells: this.getCells(),
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Restore grid state from a serialized snapshot.
   */
  deserialize(data: ProbabilityGrid): void {
    if (data.width !== this.width || data.height !== this.height) {
      throw new Error(`Grid size mismatch: expected ${this.width}×${this.height}, got ${data.width}×${data.height}`);
    }
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.cells[y][x] = { ...data.cells[y][x] };
      }
    }
  }

  /**
   * Reset grid to uniform probability distribution.
   */
  reset(): void {
    this.cells = this.initializeCells();
  }
}
