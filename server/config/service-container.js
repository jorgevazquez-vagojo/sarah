/**
 * Service Container
 * Centralized Dependency Injection & Configuration Management
 */

const ServiceFactory = require('../patterns/factory');
const EventBus = require('../patterns/observer');
const logger = require('../services/logger');
const { db } = require('../utils/db');
const redis = require('../utils/redis');

class ServiceContainer {
  constructor() {
    this.factory = ServiceFactory;
    this.eventBus = new EventBus();
    this.config = {
      env: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60'),
    };
  }

  registerServices() {
    // Register core services as singletons
    this.factory.register('logger', class Logger { execute() { return logger; } }, { singleton: true });
    this.factory.register('db', class DB { execute() { return db; } }, { singleton: true });
    this.factory.register('redis', class Redis { execute() { return redis; } }, { singleton: true });
    this.factory.register('eventBus', class EB { execute() { return this.eventBus; } }, { singleton: true });

    // Register business logic services
    this.factory.register('AIService', require('../services/ai'), { singleton: true });
    this.factory.register('ChatHandler', require('../ws/chat-handler'), { singleton: false });
    this.factory.register('Analytics', require('../services/analytics'), { singleton: true });
  }

  getService(name) {
    return this.factory.create(name);
  }

  getConfig(key) {
    return this.config[key];
  }

  setConfig(key, value) {
    this.config[key] = value;
  }

  on(event, callback) {
    this.eventBus.on(event, callback);
  }

  emit(event, data) {
    this.eventBus.emit(event, data);
  }
}

module.exports = new ServiceContainer();
