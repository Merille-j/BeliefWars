import { NondeterministicEvent, NondeterministicEventKind } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from '../core/EventBus';
import { AndOrPlanner } from '../algorithms/AndOrPlanner';
import { MapGridSystem } from '../core/MapGridSystem';

/**
 * Generates and resolves nondeterministic events (fog, storm, sensor disruption).
 * Triggers the AND-OR Planner when an event occurs.
 */
export class EventSystem {
  private activeEvent: NondeterministicEvent | null = null;
  private planner: AndOrPlanner;

  constructor(private grid: MapGridSystem) {
    this.planner = new AndOrPlanner();
  }

  /**
   * Randomly generate a nondeterministic event.
   * 40% chance of an event occurring each AND_OR_EVENTS phase.
   */
  generateEvent(): NondeterministicEvent | null {
    if (Math.random() > 0.4) return null;

    const eventTypes: NondeterministicEventKind[] = ['fog', 'storm', 'sensor_disruption'];
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    // Random affected region on the 10×10 grid
    const x = Math.floor(Math.random() * 6) + 2; // 2–7
    const y = Math.floor(Math.random() * 6) + 2;
    const radius = Math.floor(Math.random() * 2) + 1; // 1–2

    const event: NondeterministicEvent = {
      type,
      affectedRegion: { x, y, radius },
      duration: 1,
    };

    this.activeEvent = event;

    // Build contingency plan
    const plan = this.planner.buildTree(event, event.affectedRegion, this.grid);

    eventBus.publish(EventType.NONDETERMINISTIC_EVENT_OCCURRED, {
      event,
      plan,
    });

    return event;
  }

  /**
   * Resolve (clear) the active event and its effects.
   */
  resolveEvent(event: NondeterministicEvent): void {
    if (this.activeEvent?.type === event.type) {
      this.activeEvent = null;
    }

    // Apply event resolution effects to the grid
    switch (event.type) {
      case 'fog':
        // Fog clears — diffuse probability slightly
        this.applyFogResolution(event);
        break;
      case 'storm':
        // Storm passes — no grid changes
        break;
      case 'sensor_disruption':
        // Sensors restored — normalize grid
        this.grid.normalize();
        break;
    }
  }

  private applyFogResolution(event: NondeterministicEvent): void {
    // Fog slightly spreads probability in the affected region
    const cells = this.grid.getCellsInRadius(
      event.affectedRegion.x,
      event.affectedRegion.y,
      event.affectedRegion.radius
    );

    for (const cell of cells) {
      const newProb = Math.min(1, cell.probability * 1.05);
      this.grid.setCell(cell.x, cell.y, { probability: newProb });
    }
    this.grid.normalize();
  }

  getActiveEvent(): NondeterministicEvent | null {
    return this.activeEvent;
  }

  clearActiveEvent(): void {
    this.activeEvent = null;
  }
}
