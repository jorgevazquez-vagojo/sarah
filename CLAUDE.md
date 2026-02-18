# Redegal Chatbot + WebPhone Widget

## Project Overview
Widget embebible para web corporativa Redegal: chatbot IA + webphone VoIP + dashboard agentes.

## Architecture
- **server/**: Node.js 20 + Express + WebSocket (ws). Three WS paths: /ws/chat, /ws/agent, /ws/sip
- **widget/**: React 19 + TypeScript + Tailwind. Builds as IIFE single bundle (Shadow DOM)
- **dashboard/**: React 19 + TypeScript + Tailwind. Vite SPA for human agents

## Key Commands
```bash
# Development
docker compose up -d postgres redis
npm -w server run dev

# Build widget + dashboard
npm run build

# Create agent user
node scripts/create-agent.js admin admin123 "Admin" "es,gl,en" "boostic,tech"

# Full stack
docker compose up --build
```

## Stack
- AI: Claude (primary) + Gemini (free fallback) via server/services/ai.js
- DB: PostgreSQL 16 with pgvector. Schema in server/config/init.sql
- Cache: Redis 7. Sessions, pub/sub, rate limiting
- VoIP: SIP.js (browser) + Asterisk AMI (server). Disabled outside business hours
- i18n: 4 languages (gl, es, en, es-MX) in YAML files

## Business Lines
boostic (SEO/Growth), binnacle (BI), marketing (Digital Marketing), tech (Development)

## Conventions
- Patterns adapted from jorge-copiloto (db.js, redis.js, AI multi-provider)
- All widget CSS uses `rc-` prefix (Tailwind) to avoid host page conflicts
- FSM states: chat_idle → chat_active → chat_waiting_agent → (agent) → closed
- Outside business hours: VoIP disabled, offline form shown (name required, email required)
- Lead scoring: deterministic weights, max 100 points
