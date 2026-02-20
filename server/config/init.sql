-- ═══════════════════════════════════════════════════════════════
-- Redegal Chatbot + WebPhone — Premium Schema
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Widget Tenants (multi-tenant support) ───
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(200),
    api_key VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Widget Theme Configuration ───
CREATE TABLE widget_themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'default',
    is_active BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- ─── Conversations ───
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    visitor_id VARCHAR(64) NOT NULL,
    language VARCHAR(5) DEFAULT 'es',
    business_line VARCHAR(32),
    state VARCHAR(32) DEFAULT 'chat_idle',
    agent_id UUID,
    tags TEXT[] DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    visitor_info JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_conv_visitor ON conversations(visitor_id);
CREATE INDEX idx_conv_state ON conversations(state);
CREATE INDEX idx_conv_agent ON conversations(agent_id);
CREATE INDEX idx_conv_tenant ON conversations(tenant_id);
CREATE INDEX idx_conv_priority ON conversations(priority DESC, updated_at ASC);

-- ─── Messages (supports rich types) ───
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(16) NOT NULL CHECK (sender IN ('visitor', 'bot', 'agent', 'system', 'note')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN (
        'text', 'image', 'file', 'audio', 'card', 'carousel', 'buttons', 'quick_reply', 'system'
    )),
    rich_content JSONB,
    attachments JSONB DEFAULT '[]',
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_conv ON messages(conversation_id, created_at);
CREATE INDEX idx_msg_type ON messages(message_type);

-- ─── Leads ───
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    conversation_id UUID REFERENCES conversations(id),
    name VARCHAR(200),
    email VARCHAR(320),
    phone VARCHAR(30),
    company VARCHAR(200),
    job_title VARCHAR(200),
    website VARCHAR(500),
    business_line VARCHAR(32),
    language VARCHAR(5),
    source VARCHAR(50) DEFAULT 'widget',
    quality_score INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_leads_score ON leads(quality_score DESC);

-- ─── Agents ───
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    avatar_url VARCHAR(500),
    email VARCHAR(320),
    role VARCHAR(20) DEFAULT 'agent' CHECK (role IN ('agent', 'supervisor', 'admin', 'architect', 'developer', 'qa')),
    languages TEXT[] DEFAULT '{es}',
    business_lines TEXT[] DEFAULT '{}',
    sip_extension VARCHAR(20),
    status VARCHAR(16) DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'away', 'offline')),
    max_concurrent INTEGER DEFAULT 3,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_tenant ON agents(tenant_id);

-- ─── Canned Responses ───
CREATE TABLE canned_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    shortcut VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    language VARCHAR(5) DEFAULT 'es',
    business_line VARCHAR(32),
    category VARCHAR(64),
    created_by UUID REFERENCES agents(id),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canned_tenant ON canned_responses(tenant_id);
CREATE INDEX idx_canned_shortcut ON canned_responses(shortcut);

-- ─── Agent Notes (per conversation) ───
CREATE TABLE agent_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Knowledge Entries ───
CREATE TABLE knowledge_entries (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    business_line VARCHAR(32) NOT NULL,
    language VARCHAR(5) DEFAULT 'es',
    category VARCHAR(64),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_line ON knowledge_entries(business_line);
CREATE INDEX idx_knowledge_ts ON knowledge_entries
    USING GIN (to_tsvector('simple', title || ' ' || content));

-- ─── File Uploads ───
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id),
    original_name VARCHAR(500) NOT NULL,
    stored_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    url VARCHAR(1000),
    uploaded_by VARCHAR(16) CHECK (uploaded_by IN ('visitor', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Calls ───
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(64) UNIQUE NOT NULL,
    conversation_id UUID REFERENCES conversations(id),
    visitor_id VARCHAR(100),
    agent_id UUID REFERENCES agents(id),
    business_line VARCHAR(64),
    status VARCHAR(20) DEFAULT 'connecting' CHECK (status IN ('connecting', 'ringing', 'active', 'on_hold', 'ended', 'failed', 'missed')),
    duration_seconds INTEGER,
    recording_url TEXT,
    quality_score INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

CREATE INDEX idx_calls_call_id ON calls(call_id);
CREATE INDEX idx_calls_conv ON calls(conversation_id);
CREATE INDEX idx_calls_status ON calls(status);

-- ─── Webhooks ───
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    url VARCHAR(1000) NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Analytics Events ───
CREATE TABLE analytics_events (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID,
    event_type VARCHAR(64) NOT NULL,
    conversation_id UUID,
    visitor_id VARCHAR(64),
    agent_id UUID,
    business_line VARCHAR(32),
    language VARCHAR(5),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_type ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_conv ON analytics_events(conversation_id);
CREATE INDEX idx_analytics_tenant ON analytics_events(tenant_id, created_at);

-- ─── Webhook Delivery Log ───
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    attempt INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_del_webhook ON webhook_deliveries(webhook_id, created_at DESC);

-- ─── Scheduled Messages ───
CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    send_at TIMESTAMPTZ,
    send_on_reconnect BOOLEAN DEFAULT false,
    created_by UUID REFERENCES agents(id),
    sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_pending ON scheduled_messages(sent, send_at) WHERE sent = false;

-- ─── Conversation Transfer Log ───
CREATE TABLE conversation_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    from_agent_id UUID REFERENCES agents(id),
    to_agent_id UUID NOT NULL REFERENCES agents(id),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Config ───
CREATE TABLE config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Default data
-- ═══════════════════════════════════════════════════════════════

-- Default tenant
INSERT INTO tenants (id, slug, name, domain) VALUES
    ('00000000-0000-0000-0000-000000000001', 'redegal', 'Redegal', 'redegal.com')
ON CONFLICT DO NOTHING;

-- Default theme with FULL parametrizable config
INSERT INTO widget_themes (tenant_id, name, is_active, config) VALUES
    ('00000000-0000-0000-0000-000000000001', 'default', true, '{
        "branding": {
            "companyName": "Redegal",
            "logoUrl": "",
            "faviconUrl": "",
            "poweredByText": "Powered by Redegal",
            "showPoweredBy": true
        },
        "colors": {
            "primary": "#007fff",
            "primaryDark": "#0066cc",
            "primaryLight": "#E0F0FF",
            "secondary": "#32373c",
            "accent": "#0693e3",
            "background": "#FFFFFF",
            "surface": "#F7F9FC",
            "text": "#1A1A2E",
            "textSecondary": "#5A6178",
            "textOnPrimary": "#FFFFFF",
            "border": "#E5E9F0",
            "success": "#00D084",
            "warning": "#FCB900",
            "error": "#CF2E2E",
            "gradientFrom": "#007fff",
            "gradientTo": "#0055CC",
            "headerGradient": true
        },
        "typography": {
            "fontFamily": "-apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif",
            "fontSize": 14,
            "headerFontSize": 16,
            "messagesFontSize": 14
        },
        "layout": {
            "position": "bottom-right",
            "offsetX": 20,
            "offsetY": 20,
            "width": 400,
            "maxHeight": 650,
            "borderRadius": 16,
            "buttonSize": 60,
            "buttonBorderRadius": 30,
            "headerHeight": 64,
            "zIndex": 2147483647,
            "mobileFullscreen": true
        },
        "features": {
            "enableVoip": true,
            "enableFileUpload": true,
            "enableEmoji": true,
            "enableCsat": true,
            "enableLeadForm": true,
            "enableQuickReplies": true,
            "enableRichMessages": true,
            "enableSoundNotifications": true,
            "enableReadReceipts": true,
            "enableTypingIndicator": true,
            "enableLanguageSelector": true,
            "enableBusinessLines": true,
            "enableDarkMode": false,
            "enableAttachments": true,
            "maxFileSize": 10485760,
            "allowedFileTypes": ["image/*", "application/pdf", ".doc", ".docx", ".xls", ".xlsx"]
        },
        "i18n": {
            "defaultLanguage": "es",
            "availableLanguages": ["es", "en", "pt", "gl"],
            "autoDetect": true
        },
        "businessLines": [
            {"id": "boostic", "icon": "chart-line", "color": "#3B82F6"},
            {"id": "binnacle", "icon": "chart-bar", "color": "#8B5CF6"},
            {"id": "marketing", "icon": "megaphone", "color": "#10B981"},
            {"id": "tech", "icon": "code", "color": "#F59E0B"}
        ],
        "businessHours": {
            "timezone": "Europe/Madrid",
            "schedule": [
                {"days": [1,2,3,4,5], "start": "09:00", "end": "19:00"}
            ],
            "holidays": []
        },
        "messages": {
            "welcomeDelay": 1000,
            "typingDelay": 500,
            "autoGreet": true,
            "autoGreetDelay": 3000,
            "inactivityTimeout": 1800
        },
        "sounds": {
            "newMessage": "notification",
            "agentJoined": "chime",
            "callRinging": "ring"
        }
    }')
ON CONFLICT DO NOTHING;

-- Default config
INSERT INTO config (key, value) VALUES
    ('business_hours', '{"timezone": "Europe/Madrid", "start": 9, "end": 19, "days": [1,2,3,4,5]}'),
    ('ai_settings', '{"provider": "gemini", "maxTokens": 2048, "temperature": 0.4}')
ON CONFLICT DO NOTHING;
