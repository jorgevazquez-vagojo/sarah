/**
 * Observer Pattern for Event-Driven Architecture
 * Decouples event producers from consumers
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(
        event,
        callbacks.filter(cb => cb !== callback)
      );
    }
  }

  async emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    for (const callback of callbacks) {
      try {
        await callback(data);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    }
  }

  once(event, callback) {
    const wrapper = async (data) => {
      await callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

module.exports = EventBus;
