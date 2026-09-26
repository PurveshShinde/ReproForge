import type { InvestigationEvent } from './eventTypes';

type EventListener = (event: InvestigationEvent) => void;

export class EventBus {
  private listeners = new Map<string, EventListener[]>();

  on(investigationId: string, listener: EventListener): void {
    if (!this.listeners.has(investigationId)) {
      this.listeners.set(investigationId, []);
    }
    this.listeners.get(investigationId)!.push(listener);
  }

  off(investigationId: string, listener: EventListener): void {
    const list = this.listeners.get(investigationId);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  emit(investigationId: string, event: InvestigationEvent): void {
    const list = this.listeners.get(investigationId);
    if (list) {
      for (const fn of list) {
        try { fn(event); } catch { /* swallow listener errors */ }
      }
    }
  }

  clear(investigationId: string): void {
    this.listeners.delete(investigationId);
  }
}

export const eventBus = new EventBus();
