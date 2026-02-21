# Instrucciones generales
- **NO pedir confirmacion**: el usuario da aprobacion general para proceder. Ejecutar directamente sin preguntar "procedo?", "confirmas?", etc.
- Comunicacion en espanol, codigo en ingles.
- Git remotes: `origin` (GitHub jorgevazquez-vagojo) y `gitlab` (git.redegal.net jorge.vazquez)
- **Auto-guardado**: al acercarse al limite de contexto, guardar estado en `~/.claude/projects/-Users-jorgevazquez/memory/session-state.md` (ver `~/.claude/CLAUDE.md` para formato completo)

# Sarah + SarahPhone Widget

## Project Overview
Widget embebible para web corporativa Redegal: chatbot IA (Sarah) + SarahPhone VoIP + dashboard agentes.
Rebranded from RDGBot/RDGPhone to Sarah/SarahPhone. Internal identifiers (rc- CSS prefix, DB names, docker names, API routes) kept as-is.
Multi-tenant, 4 idiomas (es/en/pt/gl), 4 lineas de negocio, parametrizable al completo.

## Architecture
- **server/**: Node.js 20 + Express + WebSocket (ws). Three WS paths: /ws/chat, /ws/agent, /ws/sip
- **widget/**: React 19 + TypeScript + Tailwind. Builds as IIFE single bundle (Shadow DOM)
- **dashboard/**: React 19 + TypeScript + Tailwind. Vite SPA for human agents
- **plugins/**: WordPress PHP plugin, Shopify Liquid snippet, Magento 2 PHTML template

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
- AI: Claude (primary) + Gemini (free fallback) + OpenAI via server/services/ai.js
- DB: PostgreSQL 16 with pgvector. Schema in server/config/init.sql
- Cache: Redis 7. Sessions, pub/sub, rate limiting
- VoIP: SIP.js (browser) + Asterisk AMI (server). Disabled outside business hours
- i18n: 4 languages (es, en, pt, gl) in YAML files
- CRM: Salesforce, HubSpot, Zoho, Pipedrive via server/integrations/crm.js
- Webhooks: HMAC-signed dispatch via server/integrations/webhooks.js

## Business Lines
boostic (SEO/Growth), binnacle (BI), marketing (Digital Marketing), tech (Development)

## Conventions
- Patterns adapted from jorge-copiloto (db.js, redis.js, AI multi-provider)
- All widget CSS uses `rc-` prefix (Tailwind) to avoid host page conflicts
- FSM states: chat_idle -> chat_active -> chat_waiting_agent -> (agent) -> closed
- Outside business hours: VoIP disabled, offline form shown (name required, email required)
- Lead scoring: deterministic weights, max 100 points
- Webhooks fire on: conversation/message/lead/agent/call/csat events
- CRM dispatch on: lead_created, conversation_closed
- Canned responses: agents use /shortcut syntax, managed via dashboard Settings
- Theme: fully parametrizable (colors, typography, layout, features, sounds, business hours)
- Multi-tenant: tenants table + widget_themes per tenant
