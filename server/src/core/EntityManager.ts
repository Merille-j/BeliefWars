import { Entity, GameRole, Position } from '../types/game.types';
import { EventType } from '../types/game.types';
import { eventBus } from './EventBus';

/**
 * Manages all game entities (Ghost, Seeker).
 * Handles position updates, AP deduction, and status effects.
 */
export class EntityManager {
  private entities: Map<GameRole, Entity> = new Map();

  constructor() {
    this.initializeEntities();
  }

  private initializeEntities(): void {
    this.entities.set(GameRole.GHOST, {
      id: crypto.randomUUID(),
      role: GameRole.GHOST,
      position: {
        x: Math.floor(Math.random() * 10),
        y: Math.floor(Math.random() * 10),
      },
      ap: 8,
      statusEffects: [],
    });

    this.entities.set(GameRole.SEEKER, {
      id: crypto.randomUUID(),
      role: GameRole.SEEKER,
      position: { x: 9, y: 9 },
      ap: 10,
      statusEffects: [],
    });
  }

  getEntity(role: GameRole): Entity | null {
    const entity = this.entities.get(role);
    return entity ? { ...entity } : null;
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values()).map(e => ({ ...e }));
  }

  updatePosition(role: GameRole, x: number, y: number): void {
    const entity = this.entities.get(role);
    if (!entity) return;

    const oldPosition = { ...entity.position };
    entity.position = { x, y };

    eventBus.publish(EventType.ENTITY_MOVED, {
      role,
      from: oldPosition,
      to: { x, y },
    });
  }

  /**
   * Deduct AP from an entity. Returns false if insufficient AP.
   */
  deductAP(role: GameRole, cost: number): boolean {
    const entity = this.entities.get(role);
    if (!entity) return false;

    if (entity.ap < cost) {
      eventBus.publish(EventType.INSUFFICIENT_AP_ERROR, {
        role,
        required: cost,
        available: entity.ap,
      });
      return false;
    }

    entity.ap -= cost;
    return true;
  }

  /**
   * Reset AP to a given amount (called at start of each round/phase).
   */
  resetAP(role: GameRole, amount: number): void {
    const entity = this.entities.get(role);
    if (!entity) return;
    entity.ap = amount;
  }

  addStatusEffect(role: GameRole, effect: string): void {
    const entity = this.entities.get(role);
    if (!entity) return;
    if (!entity.statusEffects.includes(effect)) {
      entity.statusEffects.push(effect);
    }
  }

  removeStatusEffect(role: GameRole, effect: string): void {
    const entity = this.entities.get(role);
    if (!entity) return;
    entity.statusEffects = entity.statusEffects.filter(e => e !== effect);
  }

  hasStatusEffect(role: GameRole, effect: string): boolean {
    return this.entities.get(role)?.statusEffects.includes(effect) ?? false;
  }

  /**
   * Reset entities to starting positions for a new round.
   */
  reset(ghostStart: Position, seekerStart: Position): void {
    const ghost = this.entities.get(GameRole.GHOST);
    const seeker = this.entities.get(GameRole.SEEKER);

    if (ghost) {
      ghost.position = { ...ghostStart };
      ghost.ap = 8;  // starts at RECON → MANIPULATION AP
      ghost.statusEffects = [];
    }

    if (seeker) {
      seeker.position = { ...seekerStart };
      seeker.ap = 10;
      seeker.statusEffects = [];
    }
  }

  serialize(): Entity[] {
    return this.getAllEntities();
  }
}
