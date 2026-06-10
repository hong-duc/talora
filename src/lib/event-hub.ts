import type { AppEvent, EventType } from './event-types';

type Handler = (event: AppEvent) => void;

/**
 * A simple, synchronous in-memory pub/sub event bus.
 *
 * Use-cases (API routes) call `eventHub.emit(event)` AFTER a DB mutation
 * succeeds. NotificationService subscribes via `eventHub.on(type, handler)`.
 *
 * Fire-and-forget — no return value, handlers run in the same tick.
 */
export class EventHub {
  private listeners = new Map<EventType | '*', Set<Handler>>();

  /** Register a handler for a specific event type, or '*' for all types. */
  on(type: EventType | '*', handler: Handler): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler);
  }

  /** Remove a previously registered handler. */
  off(type: EventType | '*', handler: Handler): void {
    this.listeners.get(type)?.delete(handler);
  }

  /**
   * Dispatch an event to matching listeners.
   * - Listeners registered for the exact event type are called first.
   * - Listeners registered for '*' (catch-all) are called second.
   * Errors inside handlers are caught and logged — they never propagate to the
   * caller so a misbehaving notification handler won't break the API response.
   */
  emit(event: AppEvent): void {
    const handlers = [
      ...(this.listeners.get(event.type) ?? []),
      ...(this.listeners.get('*') ?? []),
    ];

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error(
          `[EventHub] handler for "${event.type}" threw:`,
          err,
        );
      }
    }
  }
}

/** Singleton instance used across the whole app. */
export const eventHub = new EventHub();

// Init notification handler after the singleton exists (avoids circular import)
// notification-service.ts only uses `import type` from this file, so no runtime cycle.
import { register } from './notification-service';
register(eventHub);
