# Sarah Architecture Reference

## Overview
Sarah uses layered architecture with domain-driven design patterns for maintainability and scalability.

## Architecture Layers

### 1. Presentation Layer
- **Widget**: React component (IIFE)
- **Dashboard**: React SPA
- **API Routes**: Express endpoints

### 2. Application Layer (Services)
- AI orchestration
- Chat routing
- Lead scoring
- Analytics

### 3. Domain Layer (Business Logic)
- Conversation model
- Lead model
- Business unit routing
- Intent detection

### 4. Data Layer
- PostgreSQL (conversations, leads, agents)
- Redis (sessions, cache, pub/sub)
- File storage (recordings, documents)

## Design Patterns

### 1. Factory Pattern
Creates objects without exposing creation logic
```javascript
const ServiceContainer = require('./config/service-container');
const aiService = ServiceContainer.getService('AIService');
```

### 2. Strategy Pattern
Encapsulates interchangeable algorithms
```javascript
const strategy = new AIStrategy('claude');
const context = new StrategyContext(strategy);
context.execute(message);

// Switch providers at runtime
context.setStrategy(new AIStrategy('gemini'));
```

### 3. Observer Pattern
Event-driven architecture
```javascript
const bus = ServiceContainer.eventBus;
bus.on('lead:created', (lead) => { /* handle */ });
bus.emit('lead:created', newLead);
```

### 4. Singleton Pattern
Shared resources (logger, DB, Redis)
```javascript
const logger = ServiceContainer.getService('logger');
// Same instance returned every time
```

## Service Container

Centralized dependency injection:
```javascript
// Register services
container.registerServices();

// Retrieve services
const service = container.getService('AIService');

// Configuration
container.getConfig('logLevel');
container.setConfig('rateLimitRequests', 200);

// Events
container.on('conversation:closed', handler);
container.emit('conversation:closed', data);
```

## File Structure

```
server/
├── patterns/
│   ├── factory.js       (Factory pattern)
│   ├── strategy.js      (Strategy pattern)
│   ├── observer.js      (Observer pattern)
│   └── singleton.js     (Singleton pattern)
├── domain/
│   ├── conversation.js  (Conversation model)
│   ├── lead.js         (Lead model)
│   └── agent.js        (Agent model)
├── services/
│   ├── ai.js           (AI orchestration)
│   ├── chat-router.js  (Conversation routing)
│   └── analytics.js    (Analytics)
├── routes/
│   ├── chat.js         (Chat API)
│   └── leads.js        (Lead API)
├── ws/
│   ├── chat-handler.js (WebSocket chat)
│   └── agent-handler.js (Agent WS)
├── config/
│   └── service-container.js (DI container)
└── middleware/
    └── auth.js         (JWT auth)
```

## Data Flow

```
User Message
    ↓
[Widget] → HTTP/WS → [API Route]
    ↓
[Service Container] → Dependency Resolution
    ↓
[Domain Logic] → Business Rules
    ↓
[AI Service] → Claude/Gemini/OpenAI
    ↓
[Event Bus] → Emit 'message:processed'
    ↓
[Analytics] → Track metrics
    ↓
[Response] → WebSocket → [Widget]
```

## Dependency Injection

All services are retrieved from the container:
```javascript
// ❌ Bad: Direct imports
const logger = require('./logger');
const db = require('./db');

// ✅ Good: Through container
const container = require('./config/service-container');
const logger = container.getService('logger');
const db = container.getService('db');
```

## Event-Driven Communication

Services communicate through events, not direct calls:
```javascript
// ✅ Good: Event-driven
container.on('lead:created', notifyBU);
container.emit('lead:created', lead);

// ❌ Bad: Direct coupling
notifyBU(lead);
```

## Testing Strategy

### Unit Tests
Test individual domain models and strategies
```javascript
const Conversation = require('./domain/conversation');
const conv = new Conversation(id, tenantId, sessionId);
expect(conv.isActive()).toBe(true);
```

### Integration Tests
Test services working together
```javascript
const aiService = container.getService('AIService');
const result = await aiService.getResponse(message);
expect(result).toBeDefined();
```

### E2E Tests
Test complete user flows
```javascript
// Playwright E2E: user → widget → API → response
```

## Performance Optimization

### Caching Strategy
- **Application**: Redis cache with TTL
- **Domain**: Computed properties cached
- **Response**: HTTP caching headers

### Load Testing
```bash
k6 run tests/load-tests/spike-test.js
k6 run tests/load-tests/stress-test.js
```

## Monitoring & Observability

### Logging
```javascript
logger.info('Lead created', { leadId, score });
logger.error('AI call failed', error);
```

### Metrics (Prometheus)
```javascript
// Tracked automatically
// - HTTP request duration
// - Error rate
// - Custom metrics
```

### Events
```javascript
container.on('conversation:escalated', (data) => {
  // Log to analytics
  // Send notification
  // Update dashboard
});
```

---
Last Updated: 2026-02-24
