-- PostgreSQL Schema Migration from SQLite
-- CrewAI Team Database
-- Version: 001
-- Date: 2025-08-22

-- ============================================
-- 1. EMAILS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    from_email TEXT NOT NULL,
    to_email TEXT,
    subject TEXT,
    body TEXT,
    html_body TEXT,
    received_at TIMESTAMPTZ,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,
    category TEXT,
    sentiment_score DECIMAL(3,2),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for emails
CREATE INDEX IF NOT EXISTS idx_emails_from_email ON emails(from_email);
CREATE INDEX IF NOT EXISTS idx_emails_processed ON emails(processed);
CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority DESC);
CREATE INDEX IF NOT EXISTS idx_emails_category ON emails(category);
CREATE INDEX IF NOT EXISTS idx_emails_metadata ON emails USING GIN(metadata);

-- ============================================
-- 2. WALMART PRODUCTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS walmart_products (
    id TEXT PRIMARY KEY,
    product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    department TEXT,
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),
    in_stock BOOLEAN DEFAULT TRUE,
    stock_quantity INTEGER,
    rating DECIMAL(2,1),
    review_count INTEGER,
    image_url TEXT,
    product_url TEXT,
    description TEXT,
    features JSONB,
    specifications JSONB,
    last_checked TIMESTAMPTZ,
    price_history JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for walmart_products
CREATE INDEX IF NOT EXISTS idx_walmart_products_product_id ON walmart_products(product_id);
CREATE INDEX IF NOT EXISTS idx_walmart_products_category ON walmart_products(category);
CREATE INDEX IF NOT EXISTS idx_walmart_products_price ON walmart_products(price);
CREATE INDEX IF NOT EXISTS idx_walmart_products_in_stock ON walmart_products(in_stock);
CREATE INDEX IF NOT EXISTS idx_walmart_products_rating ON walmart_products(rating DESC);
CREATE INDEX IF NOT EXISTS idx_walmart_products_features ON walmart_products USING GIN(features);

-- ============================================
-- 3. GROCERY LISTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS grocery_lists (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    items JSONB NOT NULL,
    total_items INTEGER DEFAULT 0,
    total_price DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    shared_with JSONB,
    notes TEXT,
    scheduled_for TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for grocery_lists
CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_id ON grocery_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_status ON grocery_lists(status);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_scheduled_for ON grocery_lists(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_items ON grocery_lists USING GIN(items);

-- ============================================
-- 4. AGENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'inactive',
    configuration JSONB,
    capabilities JSONB,
    permissions JSONB,
    last_active TIMESTAMPTZ,
    total_tasks_completed INTEGER DEFAULT 0,
    average_response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for agents
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active DESC);

-- ============================================
-- 5. AGENT TASKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for agent_tasks
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_id ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_priority ON agent_tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at DESC);

-- ============================================
-- 6. CONVERSATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    agent_id TEXT REFERENCES agents(id),
    title TEXT,
    context JSONB,
    message_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- ============================================
-- 7. MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL, -- 'user' or 'agent'
    sender_id TEXT,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',
    attachments JSONB,
    metadata JSONB,
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- 8. SYSTEM METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value DECIMAL,
    unit TEXT,
    tags JSONB,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for system_metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_tags ON system_metrics USING GIN(tags);

-- ============================================
-- 9. USER PREFERENCES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    preferences JSONB NOT NULL,
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for user_preferences
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- ============================================
-- 10. AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_walmart_products_updated_at BEFORE UPDATE ON walmart_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grocery_lists_updated_at BEFORE UPDATE ON grocery_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION METADATA
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES (1, '001_sqlite_to_postgresql')
ON CONFLICT (version) DO NOTHING;