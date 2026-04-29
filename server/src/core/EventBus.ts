import { EventType } from '../types/game.types';

type EventHandler = (payload: unknown) => void;

/**
 * Publish-subscribe event bus for decoupled communication between game systems.
 * Subscribers are called synchronously in registration order.
 * Errors in individual subscribers are isolated and logged.
 */
export class EventBus {
  private subscribers: Map<EventType, EventHandler[]> = new Map();

  /**
   * Subscribe to an event type.
   * @returns An unsubscribe function that removes this handler.
   */
  subscribe(eventType: EventType, handler: EventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    const handlers = this.subscribers.get(eventType)!;
    handlers.push(handler);

    return () => {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) {
        handlers.splice(idx, 1);
      }
    };
  }

  /**
   * Publish an event to all subscribers.
   * Each subscriber is called in a try/catch so one failure doesn't block others.
   */
  publish(eventType: EventType, payload: unknown = {}): void {
    const handlers = this.subscribers.get(eventType);
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Error in handler for ${eventType}:`, err);
      }
    }
  }

  /**
   * Remove all subscribers for a given event type.
   */
  clearEvent(eventType: EventType): void {
    this.subscribers.delete(eventType);
  }

  /**
   * Remove all subscribers for all event types.
   */
  clearAll(): void {
    this.subscribers.clear();
  }

  /**
   * Returns the number of subscribers for a given event type.
   */
  subscriberCount(eventType: EventType): number {
    return this.subscribers.get(eventType)?.length ?? 0;
  }
}

// Singleton instance shared across the server
export const eventBus = new EventBus();
