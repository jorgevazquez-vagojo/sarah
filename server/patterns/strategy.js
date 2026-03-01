/**
 * Strategy Pattern for Pluggable Algorithms
 * Allows runtime algorithm selection (e.g., AI provider, routing strategy)
 */

class Strategy {
  execute(...args) {
    throw new Error('execute() must be implemented');
  }
}

class AIStrategy extends Strategy {
  constructor(provider) {
    super();
    this.provider = provider;
  }

  async execute(message, context) {
    // Implemented by subclasses
    throw new Error('AI strategy must implement execute()');
  }
}

class RoutingStrategy extends Strategy {
  async execute(conversation) {
    // Implemented by subclasses
    throw new Error('Routing strategy must implement execute()');
  }
}

class StrategyContext {
  constructor(strategy) {
    this.strategy = strategy;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  async execute(...args) {
    return this.strategy.execute(...args);
  }
}

module.exports = {
  Strategy,
  AIStrategy,
  RoutingStrategy,
  StrategyContext,
};
