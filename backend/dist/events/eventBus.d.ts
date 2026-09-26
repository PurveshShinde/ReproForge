import type { InvestigationEvent } from './eventTypes';
type EventListener = (event: InvestigationEvent) => void;
export declare class EventBus {
    private listeners;
    on(investigationId: string, listener: EventListener): void;
    off(investigationId: string, listener: EventListener): void;
    emit(investigationId: string, event: InvestigationEvent): void;
    clear(investigationId: string): void;
}
export declare const eventBus: EventBus;
export {};
