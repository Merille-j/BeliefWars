import { ProbabilityGrid } from '../types/game.types';
import { MapGridSystem } from '../core/MapGridSystem';

/**
 * State layer wrapper around MapGridSystem.
 * Provides a clean interface for the state layer to access grid data.
 */
export class ProbabilityGridStore {
  private gridSystem: MapGridSystem;

  constructor(width: number = 10, height: number = 10) {
    this.gridSystem = new MapGridSystem(width, height);
  }

  getGridSystem(): MapGridSystem {
    return this.gridSystem;
  }

  serialize(): ProbabilityGrid {
    return this.gridSystem.serialize();
  }

  reset(): void {
    this.gridSystem.reset();
  }

  get width(): number {
    return this.gridSystem.width;
  }

  get height(): number {
    return this.gridSystem.height;
  }
}
