import { ContingencyPlan, AndOrBranch, NondeterministicEvent, Action } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from '../core/EventBus';
import { MapGridSystem } from '../core/MapGridSystem';

/**
 * Algorithm 2 — AND-OR Search Planner
 *
 * Builds contingency trees for nondeterministic events.
 * AND nodes represent situations where ALL branches must be handled.
 * OR nodes represent choices where the best branch is selected.
 */
export class AndOrPlanner {
  /**
   * Build a contingency tree for a nondeterministic event.
   * Returns a ContingencyPlan with branches for each possible outcome.
   */
  buildTree(
    event: NondeterministicEvent,
    affectedRegion: { x: number; y: number; radius: number },
    grid: MapGridSystem
  ): ContingencyPlan {
    let branches: AndOrBranch[];

    switch (event.type) {
      case 'fog':
        branches = this.buildFogPlan(affectedRegion, grid);
        break;
      case 'storm':
        branches = this.buildStormPlan(affectedRegion, grid);
        break;
      case 'sensor_disruption':
        branches = this.buildSensorDisruptionPlan(affectedRegion, grid);
        break;
      default:
        branches = [];
    }

    const plan: ContingencyPlan = {
      eventType: event.type,
      branches,
    };

    eventBus.publish(EventType.CONTINGENCY_PLAN_READY, { plan, event });
    return plan;
  }

  /**
   * Fog event: reduces visibility. Ghost should stay still or move carefully.
   * Seeker should scan the last known high-probability area.
   */
  private buildFogPlan(
    _region: { x: number; y: number; radius: number },
    grid: MapGridSystem
  ): AndOrBranch[] {
    const topCells = grid
      .getFlatCells()
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3);

    // OR node: Seeker chooses best scan target in fog
    const seekerBranches: AndOrBranch[] = topCells.map(cell => ({
      condition: `High probability cell at (${cell.x}, ${cell.y}) — prob: ${(cell.probability * 100).toFixed(1)}%`,
      action: {
        type: 'SCAN' as const,
        playerId: 'ai',
        x: cell.x,
        y: cell.y,
        radius: 3, // Wider scan in fog
      } as Action,
      children: [],
    }));

    // AND node: Ghost must handle fog by either staying or moving to safe cell
    const safeCells = grid
      .getFlatCells()
      .sort((a, b) => a.probability - b.probability)
      .slice(0, 3);

    const ghostBranches: AndOrBranch[] = safeCells.map(cell => ({
      condition: `Safe cell at (${cell.x}, ${cell.y}) — low probability`,
      action: {
        type: 'MOVE' as const,
        playerId: 'human',
        x: cell.x,
        y: cell.y,
      } as Action,
      children: [],
    }));

    return [
      {
        condition: 'Fog reduces visibility — Seeker must scan wider',
        action: null,
        children: seekerBranches,
      },
      {
        condition: 'Fog provides cover — Ghost can move to safer position',
        action: null,
        children: ghostBranches,
      },
    ];
  }

  /**
   * Storm event: disrupts movement. Both players have limited options.
   */
  private buildStormPlan(
    region: { x: number; y: number; radius: number },
    grid: MapGridSystem
  ): AndOrBranch[] {
    // Cells outside the storm region
    const safeCells = grid
      .getFlatCells()
      .filter(c => {
        const dist = Math.max(Math.abs(c.x - region.x), Math.abs(c.y - region.y));
        return dist > region.radius;
      })
      .sort((a, b) => a.probability - b.probability)
      .slice(0, 5);

    const evadeBranches: AndOrBranch[] = safeCells.map(cell => ({
      condition: `Outside storm at (${cell.x}, ${cell.y})`,
      action: {
        type: 'MOVE' as const,
        playerId: 'human',
        x: cell.x,
        y: cell.y,
      } as Action,
      children: [],
    }));

    // Seeker: scan the storm perimeter (Ghost likely to be at edge)
    const perimeterCells = grid
      .getCellsInRadius(region.x, region.y, region.radius + 1)
      .filter(c => {
        const dist = Math.max(Math.abs(c.x - region.x), Math.abs(c.y - region.y));
        return dist === region.radius || dist === region.radius + 1;
      })
      .slice(0, 3);

    const scanBranches: AndOrBranch[] = perimeterCells.map(cell => ({
      condition: `Storm perimeter at (${cell.x}, ${cell.y})`,
      action: {
        type: 'SCAN' as const,
        playerId: 'ai',
        x: cell.x,
        y: cell.y,
        radius: 2,
      } as Action,
      children: [],
    }));

    return [
      {
        condition: 'Storm blocks movement — Ghost must navigate around it',
        action: null,
        children: evadeBranches,
      },
      {
        condition: 'Storm forces Ghost to perimeter — Seeker scans edges',
        action: null,
        children: scanBranches,
      },
    ];
  }

  /**
   * Sensor disruption: scanning is less reliable. Seeker must use lock actions.
   */
  private buildSensorDisruptionPlan(
    region: { x: number; y: number; radius: number },
    grid: MapGridSystem
  ): AndOrBranch[] {
    // Top probability cells for lock attempts
    const topCells = grid
      .getFlatCells()
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5);

    // OR: Seeker picks best lock target
    const lockBranches: AndOrBranch[] = topCells.map(cell => ({
      condition: `Lock attempt at (${cell.x}, ${cell.y}) — prob: ${(cell.probability * 100).toFixed(1)}%`,
      action: {
        type: 'LOCK' as const,
        playerId: 'ai',
        x: cell.x,
        y: cell.y,
      } as Action,
      children: [],
    }));

    // Ghost: sensors disrupted, good time to move toward objectives
    const ghostBranches: AndOrBranch[] = [
      {
        condition: 'Sensors disrupted — Ghost can move freely toward objectives',
        action: {
          type: 'MOVE' as const,
          playerId: 'human',
          // Move away from the disrupted region centre, not into it
          x: Math.min(9, Math.max(0, region.x > 5 ? region.x - 3 : region.x + 3)),
          y: Math.min(9, Math.max(0, region.y > 5 ? region.y - 3 : region.y + 3)),
        } as Action,
        children: [],
      },
      {
        condition: 'Use disruption to lay false trail toward disrupted zone',
        action: {
          type: 'LAY_FALSE_TRAIL' as const,
          playerId: 'human',
          cells: [
            { x: Math.min(9, Math.max(0, region.x - 1)), y: region.y },
            { x: region.x,                               y: region.y },
            { x: Math.min(9, Math.max(0, region.x + 1)), y: region.y },
          ],
        } as Action,
        children: [],
      },
    ];

    return [
      {
        condition: 'Sensor disruption — Seeker must rely on lock actions',
        action: null,
        children: lockBranches,
      },
      {
        condition: 'Sensor disruption — Ghost has movement advantage',
        action: null,
        children: ghostBranches,
      },
    ];
  }

}
