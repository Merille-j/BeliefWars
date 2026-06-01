import { Position, GamePhase } from '../types/game.types';

/**
 * Quadrant of the 10×10 grid (2×2 split).
 * TL = top-left (0–4, 0–4), TR = top-right (5–9, 0–4), etc.
 */
export type GridQuadrant = 'TL' | 'TR' | 'BL' | 'BR' | 'CENTER';

function posToQuadrant(x: number, y: number): GridQuadrant {
  if (x >= 3 && x <= 6 && y >= 3 && y <= 6) return 'CENTER';
  if (x < 5 && y < 5) return 'TL';
  if (x >= 5 && y < 5) return 'TR';
  if (x < 5 && y >= 5) return 'BL';
  return 'BR';
}

/** Frequency table: maps a string key to a count */
type FreqTable = Record<string, number>;

function topKey(table: FreqTable, n = 1): string[] {
  return Object.entries(table)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function increment(table: FreqTable, key: string, weight = 1): void {
  table[key] = (table[key] ?? 0) + weight;
}

/**
 * HumanPatternMemory — persists across rounds within a match.
 *
 * Observes every human action and builds frequency tables that the AI
 * uses to predict future behaviour:
 *
 * As Seeker AI (human is Ghost):
 *   - Predicts which grid zone the human Ghost will move to next
 *   - Predicts which objectives the human will target first
 *   - Adjusts scan priority toward the human's preferred movement corridors
 *
 * As Ghost AI (human is Seeker):
 *   - Predicts which zones the human Seeker will scan
 *   - Avoids those zones during movement
 *   - Places decoys in the human's preferred scan zones to waste their AP
 */
export class HumanPatternMemory {
  // ── Ghost behaviour patterns (observed when human plays Ghost) ────────────

  /** How often the human throws decoys in each quadrant */
  private decoyQuadrants: FreqTable = {};
  /** How often the human makes noise in each quadrant */
  private noiseQuadrants: FreqTable = {};
  /** Which grid zones the human Ghost moves through */
  private movementZones: FreqTable = {};
  /** Which objective index the human completes first (0, 1, 2) */
  private objectiveOrder: FreqTable = {};
  /** How many moves the human makes per OBJECTIVE phase */
  private movesPerPhase: number[] = [];
  /** Cells the human Ghost has visited (for movement prediction) */
  private visitedCells: Array<{ x: number; y: number; round: number }> = [];

  // ── Seeker behaviour patterns (observed when human plays Seeker) ──────────

  /** Which quadrant the human Seeker scans first each COLLAPSE phase */
  private firstScanQuadrant: FreqTable = {};
  /** How often the human scans each quadrant */
  private scanQuadrants: FreqTable = {};
  /** How quickly the human commits to a LOCK (ticks into COLLAPSE phase) */
  private lockTimings: number[] = [];
  /** Whether the human tends to scan-first or lock-first */
  private scanFirstCount: number = 0;
  private lockFirstCount: number = 0;

  // ── Round tracking ────────────────────────────────────────────────────────
  private collapseTickCount: number = 0;
  private firstActionThisCollapse: string | null = null;
  private objectivesCompletedThisRound: number[] = [];
  private movesThisPhase: number = 0;

  // ─────────────────────────────────────────────────────────────────────────

  /** Called by GameEngine when the human submits an action */
  observeHumanAction(
    actionType: string,
    x: number | undefined,
    y: number | undefined,
    phase: GamePhase,
    round: number,
    objectiveIndex?: number
  ): void {
    // round is used only to filter stale visited-cell data
    const currentRound = round;

    switch (actionType) {
      case 'THROW_DECOY':
        if (x !== undefined && y !== undefined) {
          increment(this.decoyQuadrants, posToQuadrant(x, y));
        }
        break;

      case 'MAKE_NOISE':
        if (x !== undefined && y !== undefined) {
          increment(this.noiseQuadrants, posToQuadrant(x, y));
        }
        break;

      case 'MOVE':
        if (x !== undefined && y !== undefined) {
          increment(this.movementZones, posToQuadrant(x, y));
          this.visitedCells.push({ x, y, round: currentRound });
          // Keep only last 3 rounds of movement data
          this.visitedCells = this.visitedCells.filter(c => c.round >= currentRound - 2);
          this.movesThisPhase++;
        }
        break;

      case 'COMPLETE_OBJECTIVE':
        if (objectiveIndex !== undefined) {
          increment(this.objectiveOrder, String(objectiveIndex));
          this.objectivesCompletedThisRound.push(objectiveIndex);
        }
        break;

      case 'SCAN':
        if (x !== undefined && y !== undefined) {
          const quad = posToQuadrant(x, y);
          increment(this.scanQuadrants, quad);
          if (this.firstActionThisCollapse === null) {
            this.firstActionThisCollapse = 'SCAN';
            increment(this.firstScanQuadrant, quad);
            this.scanFirstCount++;
          }
        }
        break;

      case 'LOCK':
        if (this.firstActionThisCollapse === null) {
          this.firstActionThisCollapse = 'LOCK';
          this.lockFirstCount++;
          this.lockTimings.push(this.collapseTickCount);
        }
        break;

      case 'END_PHASE':
        if (phase === GamePhase.OBJECTIVE) {
          this.movesPerPhase.push(this.movesThisPhase);
          this.movesThisPhase = 0;
        }
        break;
    }
  }

  /** Called each tick during COLLAPSE to track timing */
  tickCollapse(): void {
    this.collapseTickCount++;
  }

  /** Called when a new phase starts */
  onPhaseStart(phase: GamePhase): void {
    if (phase === GamePhase.COLLAPSE) {
      this.collapseTickCount = 0;
      this.firstActionThisCollapse = null;
    }
    if (phase === GamePhase.OBJECTIVE) {
      this.movesThisPhase = 0;
    }
    if (phase === GamePhase.RECON) {
      this.objectivesCompletedThisRound = [];
    }
  }

  // ─── Prediction API ───────────────────────────────────────────────────────

  /**
   * Returns the quadrant the human Ghost most frequently moves through.
   * Used by AI Seeker to bias scan priority.
   */
  getPredictedGhostZone(): GridQuadrant | null {
    const top = topKey(this.movementZones, 1);
    return top.length > 0 ? (top[0] as GridQuadrant) : null;
  }

  /**
   * Returns the top-N cells the human Ghost has visited recently.
   * Used by AI Seeker to weight the belief map.
   */
  getFrequentGhostCells(n: number): Array<{ x: number; y: number; weight: number }> {
    const cellFreq: FreqTable = {};
    for (const c of this.visitedCells) {
      increment(cellFreq, `${c.x},${c.y}`);
    }
    return Object.entries(cellFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => {
        const [x, y] = key.split(',').map(Number);
        return { x, y, weight: count };
      });
  }

  /**
   * Returns the quadrant the human Seeker most frequently scans first.
   * Used by AI Ghost to place decoys in that zone (waste their AP).
   */
  getPredictedFirstScanZone(): GridQuadrant | null {
    const top = topKey(this.firstScanQuadrant, 1);
    return top.length > 0 ? (top[0] as GridQuadrant) : null;
  }

  /**
   * Returns the quadrant the human Seeker scans most overall.
   * Used by AI Ghost to avoid that zone during movement.
   */
  getMostScannedZone(): GridQuadrant | null {
    const top = topKey(this.scanQuadrants, 1);
    return top.length > 0 ? (top[0] as GridQuadrant) : null;
  }

  /**
   * Returns the quadrant the human Ghost throws decoys in most.
   * Used by AI Seeker to discount those spikes (they're likely fake).
   */
  getPredictedDecoyZone(): GridQuadrant | null {
    const top = topKey(this.decoyQuadrants, 1);
    return top.length > 0 ? (top[0] as GridQuadrant) : null;
  }

  /**
   * Returns the objective index the human completes first most often.
   */
  getPredictedFirstObjective(): number | null {
    const top = topKey(this.objectiveOrder, 1);
    return top.length > 0 ? Number(top[0]) : null;
  }

  /**
   * Returns true if the human Seeker tends to lock early (within first 3 ticks).
   */
  isHumanEarlyLocker(): boolean {
    if (this.lockTimings.length < 2) return false;
    const avg = this.lockTimings.reduce((s, t) => s + t, 0) / this.lockTimings.length;
    return avg < 3;
  }

  /**
   * Returns true if the human Seeker tends to scan before locking.
   */
  isHumanScanFirst(): boolean {
    return this.scanFirstCount >= this.lockFirstCount;
  }

  /**
   * Returns the average number of moves the human makes per OBJECTIVE phase.
   */
  getAverageMovesPerPhase(): number {
    if (this.movesPerPhase.length === 0) return 16; // Ghost has 20 AP, realistically uses most of it
    return this.movesPerPhase.reduce((s, m) => s + m, 0) / this.movesPerPhase.length;
  }

  /**
   * Returns a confidence score (0–1) for how reliable the predictions are.
   * Low confidence = not enough data yet (early rounds).
   */
  getConfidence(): number {
    const dataPoints = Object.values(this.movementZones).reduce((s, v) => s + v, 0)
      + Object.values(this.scanQuadrants).reduce((s, v) => s + v, 0)
      + Object.values(this.decoyQuadrants).reduce((s, v) => s + v, 0);
    // Confidence saturates at ~20 data points
    return Math.min(1, dataPoints / 20);
  }

  /**
   * Returns the centre coordinates of a quadrant (for targeting).
   */
  static quadrantCentre(q: GridQuadrant): Position {
    switch (q) {
      case 'TL':     return { x: 2,  y: 2  };
      case 'TR':     return { x: 7,  y: 2  };
      case 'BL':     return { x: 2,  y: 7  };
      case 'BR':     return { x: 7,  y: 7  };
      case 'CENTER': return { x: 5,  y: 5  };
    }
  }

  /**
   * Returns true if a position is in the given quadrant.
   */
  static isInQuadrant(pos: Position, q: GridQuadrant): boolean {
    return posToQuadrant(pos.x, pos.y) === q;
  }

  reset(): void {
    // Keep cross-round data — only reset per-round counters
    this.objectivesCompletedThisRound = [];
    this.movesThisPhase = 0;
    this.collapseTickCount = 0;
    this.firstActionThisCollapse = null;
  }

  /** Full reset (new match) */
  fullReset(): void {
    this.decoyQuadrants = {};
    this.noiseQuadrants = {};
    this.movementZones = {};
    this.objectiveOrder = {};
    this.movesPerPhase = [];
    this.visitedCells = [];
    this.firstScanQuadrant = {};
    this.scanQuadrants = {};
    this.lockTimings = [];
    this.scanFirstCount = 0;
    this.lockFirstCount = 0;
    this.reset();
  }
}
