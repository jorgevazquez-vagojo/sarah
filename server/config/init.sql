-- Redegal Chatbot Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Conversations ───
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id VARCHAR(64) NOT NULL,
    language VARCHAR(5) DEFAULT 'es',
    business_line VARCHAR(32),
    state VARCHAR(32) DEFAULT 'chat_idle',
    agent_id UUID,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE INDEX idx_conv_visitor ON conversations(visitor_id);
CREATE INDEX idx_conv_state ON conversations(state);
CREATE INDEX idx_conv_agent ON conversations(agent_id);

-- ─── Messages ───
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(16) NOT NULL CHECK (sender IN ('visitor', 'bot', 'agent', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_conv ON messages(conversation_id, created_at);

-- ─── Leads ───
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id),
    name VARCHAR(200),
    email VARCHAR(320),
    phone VARCHAR(30),
    company VARCHAR(200),
    business_line VARCHAR(32),
    language VARCHAR(5),
    quality_score INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email ON leads(email);

-- ─── Agents ───
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    languages TEXT[] DEFAULT '{es}',
    business_lines TEXT[] DEFAULT '{}',
    sip_extension VARCHAR(20),
    status VARCHAR(16) DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'away', 'offline')),
    max_concurrent INTEGER DEFAULT 3,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);

-- ─── Knowledge Entries ───
CREATE TABLE knowledge_entries (
    id SERIAL PRIMARY KEY,
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
    USING GIN (to_tsvector('spanish', title || ' ' || content));

-- ─── Calls ───
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id),
    agent_id UUID REFERENCES agents(id),
    visitor_sip_id VARCHAR(100),
    queue VARCHAR(64),
    status VARCHAR(20) DEFAULT 'connecting' CHECK (status IN ('connecting', 'ringing', 'active', 'ended', 'failed')),
    duration_seconds INTEGER,
    recording_url TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ─── Analytics Events ───
CREATE TABLE analytics_events (
    id BIGSERIAL PRIMARY KEY,
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

-- ─── Config ───
CREATE TABLE config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Default config values ───
INSERT INTO config (key, value) VALUES
    ('widget_settings', '{"primaryColor": "#E30613", "position": "bottom-right", "greeting": true}'),
    ('business_hours', '{"timezone": "Europe/Madrid", "start": 9, "end": 19, "days": [1,2,3,4,5]}'),
    ('ai_settings', '{"provider": "gemini", "maxTokens": 2048, "temperature": 0.4}')
ON CONFLICT DO NOTHING;
