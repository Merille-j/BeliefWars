import { MCTSRecommendation, Action, Position } from '../types/game.types';
import { MapGridSystem } from '../core/MapGridSystem';

/**
 * MCTS tree node.
 */
class MCTSNode {
  visits: number = 0;
  value: number = 0;
  children: MCTSNode[] = [];
  action: Action | null;
  parent: MCTSNode | null;

  constructor(action: Action | null = null, parent: MCTSNode | null = null) {
    this.action = action;
    this.parent = parent;
  }

  get ucb1(): number {
    if (this.visits === 0) return Infinity;
    const exploitation = this.value / this.visits;
    const parentVisits = Math.max(1, this.parent?.visits ?? 1);
    const exploration = Math.sqrt(2.5 * Math.log(parentVisits) / this.visits);
    return exploitation + exploration;
  }

  isLeaf(): boolean {
    return this.children.length === 0;
  }
}

/**
 * Algorithm 3 — Monte Carlo Tree Search (MCTS) — Enhanced
 *
 * Improvements over baseline:
 * 1. Spatial clustering: groups nearby high-prob cells and targets cluster centres
 * 2. Confidence-weighted action selection: prefers LOCK when a cell is very hot
 * 3. Deeper simulation: simulates a 2-step sequence (scan then lock) for better lookahead
 * 4. Move-history awareness: penalises cells that were recently scanned (already explored)
 * 5. Entropy-guided scanning: prefers scans that maximally reduce uncertainty
 */
export class MCTS {
  private readonly MIN_PLAYOUTS = 150;
  private readonly TIMEOUT_MS = 250;
  private readonly SCAN_RADIUS = 2;
  private readonly SCAN_AP_COST = 2;
  private readonly LOCK_AP_COST = 4;

  /** Cells scanned in previous ticks — used to avoid redundant scans */
  private recentlyScanned: Set<string> = new Set();
  private scanHistory: Array<{ x: number; y: number; tick: number }> = [];
  private tick: number = 0;

  recordScan(x: number, y: number): void {
    const key = `${x},${y}`;
    this.recentlyScanned.add(key);
    this.scanHistory.push({ x, y, tick: this.tick });
    // Forget scans older than 3 rounds
    const cutoff = this.tick - 6;
    this.scanHistory = this.scanHistory.filter(s => s.tick > cutoff);
    this.recentlyScanned = new Set(this.scanHistory.map(s => `${s.x},${s.y}`));
  }

  advanceTick(): void {
    this.tick++;
  }

  reset(): void {
    this.recentlyScanned.clear();
    this.scanHistory = [];
    this.tick = 0;
  }

  evaluate(
    grid: MapGridSystem,
    seekerAP: number,
    ghostPosition?: Position
  ): MCTSRecommendation[] {
    this.advanceTick();
    const startTime = Date.now();
    const root = new MCTSNode(null, null);

    const candidateActions = this.generateCandidateActions(grid, seekerAP, ghostPosition);
    if (candidateActions.length === 0) return [];

    for (const action of candidateActions) {
      root.children.push(new MCTSNode(action, root));
    }

    let playouts = 0;
    while (playouts < this.MIN_PLAYOUTS && Date.now() - startTime < this.TIMEOUT_MS) {
      const node = this.select(root);
      const expandedNode = this.expand(node, candidateActions);
      const reward = this.simulate(expandedNode, grid, ghostPosition, seekerAP);
      this.backpropagate(expandedNode, reward);
      playouts++;
    }

    const recommendations: MCTSRecommendation[] = root.children
      .filter(child => child.visits > 0 && child.action !== null)
      .map(child => ({
        action: child.action!,
        expectedValue: child.value / child.visits,
        confidence: Math.min(1, child.visits / this.MIN_PLAYOUTS),
      }))
      .sort((a, b) => b.expectedValue - a.expectedValue);

    return recommendations.slice(0, 5);
  }

  private select(node: MCTSNode): MCTSNode {
    let current = node;
    while (!current.isLeaf()) {
      const best = current.children.reduce((a, b) => (a.ucb1 > b.ucb1 ? a : b));
      current = best;
    }
    return current;
  }

  private expand(node: MCTSNode, candidateActions: Action[]): MCTSNode {
    if (node.visits === 0) return node;
    const exploredActions = new Set(node.children.map(c => JSON.stringify(c.action)));
    for (const action of candidateActions) {
      if (!exploredActions.has(JSON.stringify(action))) {
        const child = new MCTSNode(action, node);
        node.children.push(child);
        return child;
      }
    }
    // All actions already expanded — return the best child by UCB1
    if (node.children.length > 0) {
      return node.children.reduce((a, b) => (a.ucb1 > b.ucb1 ? a : b));
    }
    return node;
  }

  /**
   * Enhanced simulation with 2-step lookahead.
   *
   * LOCK rewards:
   *   - Ghost position known (AI Seeker): 1.5 for a confirmed hit, 0.0 for a miss.
   *     The higher value reflects that a confirmed lock is the best possible outcome.
   *   - Ghost position unknown (human Seeker): raw cell.probability with no amplifier,
   *     so the reward is proportional to actual belief — no artificial inflation.
   *
   * SCAN reward = probability mass in zone × entropy-reduction bonus
   *              minus a penalty if the zone was recently scanned.
   */
  private simulate(
    node: MCTSNode,
    grid: MapGridSystem,
    ghostPosition: Position | undefined,
    seekerAP: number
  ): number {
    if (!node.action) return 0;
    const action = node.action;

    if (action.type === 'LOCK') {
      if (ghostPosition) {
        // Known position: confirmed hit scores 1.5 (highest possible reward),
        // miss scores 0.0 — the AI should only lock when it's certain.
        return ghostPosition.x === action.x && ghostPosition.y === action.y ? 1.5 : 0.0;
      }
      // Unknown position: use raw probability — no amplifier, no inflation.
      const cell = grid.getCell(action.x, action.y);
      return cell ? cell.probability : 0;
    }

    if (action.type === 'SCAN') {
      const cells = grid.getCellsInRadius(action.x, action.y, this.SCAN_RADIUS);
      const totalProb = cells.reduce((sum, c) => sum + c.probability, 0);
      const avgProb = totalProb / cells.length;

      // Entropy reduction: prefer zones with concentrated probability (not uniform)
      const variance = cells.reduce((sum, c) => sum + Math.pow(c.probability - avgProb, 2), 0) / cells.length;
      const entropyBonus = Math.sqrt(variance) * 3;

      // Recency penalty: avoid re-scanning recently covered zones
      const recentPenalty = this.recentlyScanned.has(`${action.x},${action.y}`) ? 0.3 : 0;

      // Lookahead: if scan reveals high prob, simulate a follow-up lock
      let lookaheadBonus = 0;
      if (seekerAP >= this.SCAN_AP_COST + this.LOCK_AP_COST) {
        const peakCell = cells.reduce((best, c) => c.probability > best.probability ? c : best, cells[0]);
        if (peakCell && peakCell.probability > 0.15) {
          lookaheadBonus = peakCell.probability * 0.5;
        }
      }

      return Math.max(0, Math.min(1, totalProb * 4 + entropyBonus + lookaheadBonus - recentPenalty));
    }

    return 0;
  }

  private backpropagate(node: MCTSNode, reward: number): void {
    let current: MCTSNode | null = node;
    while (current !== null) {
      current.visits++;
      current.value += reward;
      current = current.parent;
    }
  }

  /**
   * Intelligent candidate generation:
   * 1. Find spatial clusters of high-probability cells
   * 2. Generate LOCK actions for the single hottest cell in each cluster
   * 3. Generate SCAN actions for cluster centres
   * 4. Add a direct LOCK on the absolute peak cell if probability > threshold
   * 5. If ghost position is known (AI Seeker), always include a direct lock on it
   */
  private generateCandidateActions(
    grid: MapGridSystem,
    seekerAP: number,
    ghostPosition?: Position
  ): Action[] {
    const actions: Action[] = [];
    const allCells = grid.getFlatCells().sort((a, b) => b.probability - a.probability);

    // ── 0. If ghost position is known, always offer a direct lock on it ───
    if (ghostPosition && seekerAP >= this.LOCK_AP_COST) {
      actions.push({ type: 'LOCK', playerId: 'ai', x: ghostPosition.x, y: ghostPosition.y });
    }

    // ── 1. Direct lock on the hottest cell if very confident ──────────────
    const hottest = allCells[0];
    if (hottest && hottest.probability > 0.12 && seekerAP >= this.LOCK_AP_COST) {
      actions.push({ type: 'LOCK', playerId: 'ai', x: hottest.x, y: hottest.y });
    }

    // ── 2. Cluster the top-10 cells into spatial groups ───────────────────
    const topCells = allCells.slice(0, 10);
    const clusters = this.clusterCells(topCells, 3); // radius-3 clusters

    for (const cluster of clusters) {
      const centre = cluster.centre;

      // SCAN the cluster centre
      if (seekerAP >= this.SCAN_AP_COST) {
        actions.push({
          type: 'SCAN',
          playerId: 'ai',
          x: centre.x,
          y: centre.y,
          radius: this.SCAN_RADIUS,
        });
      }

      // LOCK the hottest cell in the cluster
      if (seekerAP >= this.LOCK_AP_COST && cluster.peak.probability > 0.05) {
        actions.push({ type: 'LOCK', playerId: 'ai', x: cluster.peak.x, y: cluster.peak.y });
      }
    }

    // ── 3. Fallback: top-5 individual cells ───────────────────────────────
    for (const cell of allCells.slice(0, 5)) {
      if (seekerAP >= this.SCAN_AP_COST) {
        actions.push({ type: 'SCAN', playerId: 'ai', x: cell.x, y: cell.y, radius: this.SCAN_RADIUS });
      }
      if (seekerAP >= this.LOCK_AP_COST) {
        actions.push({ type: 'LOCK', playerId: 'ai', x: cell.x, y: cell.y });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return actions.filter(a => {
      const key = JSON.stringify(a);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Group cells into spatial clusters using a greedy radius-based approach.
   * Returns clusters sorted by total probability mass (hottest first).
   */
  private clusterCells(
    cells: Array<{ x: number; y: number; probability: number }>,
    radius: number
  ): Array<{
    centre: { x: number; y: number };
    peak: { x: number; y: number; probability: number };
    mass: number;
  }> {
    const assigned = new Set<number>();
    const clusters: Array<{
      centre: { x: number; y: number };
      peak: { x: number; y: number; probability: number };
      mass: number;
    }> = [];

    for (let i = 0; i < cells.length; i++) {
      if (assigned.has(i)) continue;
      const seed = cells[i];
      const members: typeof cells = [seed];
      assigned.add(i);

      for (let j = i + 1; j < cells.length; j++) {
        if (assigned.has(j)) continue;
        const c = cells[j];
        if (Math.abs(c.x - seed.x) <= radius && Math.abs(c.y - seed.y) <= radius) {
          members.push(c);
          assigned.add(j);
        }
      }

      const mass = members.reduce((s, m) => s + m.probability, 0);
      const avgX = Math.round(members.reduce((s, m) => s + m.x, 0) / members.length);
      const avgY = Math.round(members.reduce((s, m) => s + m.y, 0) / members.length);
      const peak = members.reduce((best, m) => m.probability > best.probability ? m : best, members[0]);

      clusters.push({ centre: { x: avgX, y: avgY }, peak, mass });
    }

    return clusters.sort((a, b) => b.mass - a.mass).slice(0, 4);
  }
}
