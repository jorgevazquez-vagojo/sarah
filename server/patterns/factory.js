/**
 * Factory Pattern for Service Creation
 * Centralizes object creation and dependency injection
 */

class ServiceFactory {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  register(name, ServiceClass, options = {}) {
    this.services.set(name, { ServiceClass, options, singleton: options.singleton || false });
  }

  create(name, ...args) {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service not registered: ${name}`);

    // Singleton pattern
    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, new service.ServiceClass(...args));
      }
      return this.singletons.get(name);
    }

    return new service.ServiceClass(...args);
  }

  get(name) {
    return this.create(name);
  }
}

module.exports = new ServiceFactory();
