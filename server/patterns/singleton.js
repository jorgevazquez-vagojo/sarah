/**
 * Singleton Pattern for Shared Resources
 * Ensures only one instance of critical services
 */

class Singleton {
  static instance;

  constructor() {
    if (Singleton.instance) {
      return Singleton.instance;
    }
    Singleton.instance = this;
  }
}

function createSingleton(Class) {
  let instance;

  return class Singleton extends Class {
    constructor(...args) {
      if (instance) {
        return instance;
      }
      super(...args);
      instance = this;
    }
  };
}

module.exports = {
  Singleton,
  createSingleton,
};
