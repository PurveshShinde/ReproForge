"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventBus = void 0;
class EventBus {
    listeners = new Map();
    on(investigationId, listener) {
        if (!this.listeners.has(investigationId)) {
            this.listeners.set(investigationId, []);
        }
        this.listeners.get(investigationId).push(listener);
    }
    off(investigationId, listener) {
        const list = this.listeners.get(investigationId);
        if (list) {
            const idx = list.indexOf(listener);
            if (idx >= 0)
                list.splice(idx, 1);
        }
    }
    emit(investigationId, event) {
        const list = this.listeners.get(investigationId);
        if (list) {
            for (const fn of list) {
                try {
                    fn(event);
                }
                catch { /* swallow listener errors */ }
            }
        }
    }
    clear(investigationId) {
        this.listeners.delete(investigationId);
    }
}
exports.EventBus = EventBus;
exports.eventBus = new EventBus();
//# sourceMappingURL=eventBus.js.map