-- Enhanced Database Schema for CrewAI Team Project
-- Production-ready schema with proper constraints, indexing, and relationships
-- Compatible with existing data while adding new features

-- Enable foreign keys and performance optimizations
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB memory map

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Enhanced Users table with roles and permissions
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'viewer')),
    department TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    permissions TEXT, -- JSON array of permissions
    last_login_at TIMESTAMP,
    password_hash TEXT,
    salt TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Conversations table with metadata
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    user_id TEXT NOT NULL,
    agent_type TEXT,
    conversation_type TEXT DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'analysis', 'automation')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    metadata TEXT, -- JSON with conversation metadata
    tags TEXT, -- JSON array of tags
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enhanced Messages table with better structure
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT,
    agent_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'agent')),
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'json', 'code')),
    metadata TEXT, -- JSON with message metadata
    attachments TEXT, -- JSON array of attachment references
    parent_message_id TEXT,
    thread_id TEXT,
    confidence_score REAL,
    processing_time INTEGER,
    model_used TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- =====================================================
-- EMAIL SYSTEM TABLES (Enhanced from existing)
-- =====================================================

-- Enhanced Emails table (extends existing schema)
CREATE TABLE IF NOT EXISTS emails_enhanced (
    id TEXT PRIMARY KEY,
    graph_id TEXT UNIQUE,
    message_id TEXT UNIQUE NOT NULL,
    
    -- Email content
    subject TEXT NOT NULL,
    body_text TEXT,
    body_html TEXT,
    body_preview TEXT,
    
    -- Sender/Recipient info
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    recipients TEXT, -- JSON array of recipients
    cc_recipients TEXT, -- JSON array of CC recipients
    bcc_recipients TEXT, -- JSON array of BCC recipients
    
    -- Email metadata
    received_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    importance TEXT,
    categories TEXT, -- JSON array
    has_attachments BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    
    -- Threading
    thread_id TEXT,
    conversation_id_ref TEXT, -- Link to conversations table
    in_reply_to TEXT,
    "references" TEXT, -- JSON array of message references
    
    -- Workflow fields
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    assigned_to TEXT,
    assigned_at TIMESTAMP,
    due_date TIMESTAMP,
    
    -- Processing metadata
    processed_at TIMESTAMP,
    processing_version TEXT,
    analysis_confidence REAL,
    
    -- Audit trail
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (conversation_id_ref) REFERENCES conversations(id) ON DELETE SET NULL
);

-- Email attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
    id TEXT PRIMARY KEY,
    email_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    content_id TEXT,
    is_inline BOOLEAN DEFAULT FALSE,
    storage_path TEXT,
    checksum TEXT,
    virus_scan_result TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Email entities (extracted references like PO numbers, etc.)
CREATE TABLE IF NOT EXISTS email_entities (
    id TEXT PRIMARY KEY,
    email_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    entity_format TEXT,
    confidence REAL DEFAULT 1.0,
    extraction_method TEXT, -- 'regex', 'llm', 'manual'
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- =====================================================
-- DEAL DATA TABLES (Enhanced)
-- =====================================================

-- Enhanced Deals table
CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    deal_id TEXT UNIQUE NOT NULL, -- 8-digit deal ID
    deal_name TEXT,
    customer_name TEXT NOT NULL,
    customer_id TEXT,
    
    -- Deal timing
    start_date DATE,
    end_date DATE NOT NULL,
    extended_date DATE,
    
    -- Deal status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
    version INTEGER DEFAULT 1,
    
    -- Financial data
    total_value DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    discount_percentage DECIMAL(5,2),
    
    -- Deal metadata
    deal_type TEXT,
    sales_rep TEXT,
    channel_partner TEXT,
    region TEXT,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_by TEXT,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Deal items with enhanced product information
CREATE TABLE IF NOT EXISTS deal_items (
    id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL,
    
    -- Product information
    product_number TEXT NOT NULL, -- SKU
    product_name TEXT,
    product_family TEXT,
    product_category TEXT,
    manufacturer TEXT,
    
    -- Quantities
    original_quantity INTEGER NOT NULL,
    remaining_quantity INTEGER NOT NULL,
    reserved_quantity INTEGER DEFAULT 0,
    
    -- Pricing
    list_price DECIMAL(10,2),
    dealer_net_price DECIMAL(10,2) NOT NULL,
    final_price DECIMAL(10,2), -- After IPG/PSG calculation
    cost DECIMAL(10,2),
    margin_percentage DECIMAL(5,2),
    
    -- Item metadata
    description TEXT,
    part_type TEXT,
    warranty_period TEXT,
    availability_status TEXT,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (deal_id) REFERENCES deals(deal_id) ON DELETE CASCADE
);

-- Product families and pricing rules
CREATE TABLE IF NOT EXISTS product_families (
    id TEXT PRIMARY KEY,
    family_code TEXT UNIQUE NOT NULL, -- 'IPG', 'PSG', etc.
    family_name TEXT NOT NULL,
    pricing_multiplier DECIMAL(5,4) DEFAULT 1.0000,
    pricing_rules TEXT, -- JSON with complex pricing rules
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TASK AND WORKFLOW TABLES
-- =====================================================

-- Enhanced Tasks table
CREATE TABLE IF NOT EXISTS tasks_enhanced (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    
    -- Task classification
    task_type TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    
    -- Assignment
    assigned_to TEXT,
    created_by TEXT NOT NULL,
    team_id TEXT,
    
    -- Status and priority
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'blocked')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    
    -- Timing
    due_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2),
    
    -- Dependencies and relationships
    parent_task_id TEXT,
    depends_on_tasks TEXT, -- JSON array of task IDs
    blocks_tasks TEXT, -- JSON array of task IDs
    
    -- Metadata
    tags TEXT, -- JSON array
    custom_fields TEXT, -- JSON object
    progress_percentage INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (parent_task_id) REFERENCES tasks_enhanced(id) ON DELETE SET NULL
);

-- Task comments and updates
CREATE TABLE IF NOT EXISTS task_comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    comment_text TEXT NOT NULL,
    comment_type TEXT DEFAULT 'comment' CHECK (comment_type IN ('comment', 'status_change', 'assignment', 'attachment')),
    metadata TEXT, -- JSON with additional data
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks_enhanced(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- KNOWLEDGE BASE AND DOCUMENT STORAGE
-- =====================================================

-- Documents table for knowledge base
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    content_type TEXT DEFAULT 'text',
    file_path TEXT,
    file_size INTEGER,
    file_hash TEXT,
    
    -- Document metadata
    author_id TEXT,
    category TEXT,
    tags TEXT, -- JSON array
    language TEXT DEFAULT 'en',
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_document_id TEXT,
    is_current_version BOOLEAN DEFAULT TRUE,
    
    -- Access control
    visibility TEXT DEFAULT 'internal' CHECK (visibility IN ('public', 'internal', 'restricted', 'private')),
    access_permissions TEXT, -- JSON with user/role permissions
    
    -- Processing status
    indexed BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_document_id) REFERENCES documents(id) ON DELETE SET NULL
);

-- Document chunks for vector storage
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT,
    
    -- Chunk metadata
    start_position INTEGER,
    end_position INTEGER,
    token_count INTEGER,
    
    -- Vector storage reference
    vector_id TEXT, -- Reference to ChromaDB document ID
    embedding_model TEXT,
    embedding_created_at TIMESTAMP,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- =====================================================
-- AGENT AND AI SYSTEM TABLES
-- =====================================================

-- Agent instances and configurations
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    description TEXT,
    
    -- Configuration
    config TEXT, -- JSON configuration
    model_name TEXT,
    system_prompt TEXT,
    temperature REAL,
    max_tokens INTEGER,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'training', 'error')),
    last_active_at TIMESTAMP,
    
    -- Performance metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    average_response_time REAL,
    
    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Agent execution logs
CREATE TABLE IF NOT EXISTS agent_executions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    conversation_id TEXT,
    
    -- Execution details
    input_data TEXT, -- JSON
    output_data TEXT, -- JSON
    execution_time INTEGER, -- milliseconds
    
    -- Status and results
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'timeout')),
    error_message TEXT,
    
    -- Resource usage
    tokens_used INTEGER,
    cost DECIMAL(10,4),
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

-- =====================================================
-- COMPREHENSIVE INDEXES FOR PERFORMANCE
-- =====================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);

-- Enhanced emails indexes
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender ON emails_enhanced(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_received_at ON emails_enhanced(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_status ON emails_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_priority ON emails_enhanced(priority);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_assigned_to ON emails_enhanced(assigned_to);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_thread_id ON emails_enhanced(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_due_date ON emails_enhanced(due_date);

-- Email entities indexes
CREATE INDEX IF NOT EXISTS idx_email_entities_email_id ON email_entities(email_id);
CREATE INDEX IF NOT EXISTS idx_email_entities_type_value ON email_entities(entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_email_entities_confidence ON email_entities(confidence DESC);

-- Deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_customer_name ON deals(customer_name);
CREATE INDEX IF NOT EXISTS idx_deals_end_date ON deals(end_date);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_sales_rep ON deals(sales_rep);
CREATE INDEX IF NOT EXISTS idx_deals_region ON deals(region);

-- Deal items indexes
CREATE INDEX IF NOT EXISTS idx_deal_items_deal_id ON deal_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_items_product_number ON deal_items(product_number);
CREATE INDEX IF NOT EXISTS idx_deal_items_product_family ON deal_items(product_family);
CREATE INDEX IF NOT EXISTS idx_deal_items_remaining_quantity ON deal_items(remaining_quantity);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_enhanced_assigned_to ON tasks_enhanced(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_enhanced_created_by ON tasks_enhanced(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_enhanced_status ON tasks_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_tasks_enhanced_priority ON tasks_enhanced(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_enhanced_due_date ON tasks_enhanced(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_enhanced_parent_task_id ON tasks_enhanced(parent_task_id);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_author_id ON documents(author_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
CREATE INDEX IF NOT EXISTS idx_documents_indexed ON documents(indexed);
CREATE INDEX IF NOT EXISTS idx_documents_current_version ON documents(is_current_version);

-- Document chunks indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_vector_id ON document_chunks(vector_id);

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_active ON agents(last_active_at DESC);

-- Agent executions indexes
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_conversation_id ON agent_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at DESC);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

-- Users update trigger
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Conversations update trigger
CREATE TRIGGER IF NOT EXISTS update_conversations_timestamp 
AFTER UPDATE ON conversations
FOR EACH ROW
BEGIN
    UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Messages update trigger
CREATE TRIGGER IF NOT EXISTS update_messages_timestamp 
AFTER UPDATE ON messages
FOR EACH ROW
BEGIN
    UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Emails update trigger
CREATE TRIGGER IF NOT EXISTS update_emails_enhanced_timestamp 
AFTER UPDATE ON emails_enhanced
FOR EACH ROW
BEGIN
    UPDATE emails_enhanced SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Deals update trigger
CREATE TRIGGER IF NOT EXISTS update_deals_timestamp 
AFTER UPDATE ON deals
FOR EACH ROW
BEGIN
    UPDATE deals SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Deal items update trigger
CREATE TRIGGER IF NOT EXISTS update_deal_items_timestamp 
AFTER UPDATE ON deal_items
FOR EACH ROW
BEGIN
    UPDATE deal_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Tasks update trigger
CREATE TRIGGER IF NOT EXISTS update_tasks_enhanced_timestamp 
AFTER UPDATE ON tasks_enhanced
FOR EACH ROW
BEGIN
    UPDATE tasks_enhanced SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Documents update trigger
CREATE TRIGGER IF NOT EXISTS update_documents_timestamp 
AFTER UPDATE ON documents
FOR EACH ROW
BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Agents update trigger
CREATE TRIGGER IF NOT EXISTS update_agents_timestamp 
AFTER UPDATE ON agents
FOR EACH ROW
BEGIN
    UPDATE agents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- INITIAL DATA SEEDS
-- =====================================================

-- Insert default product families
INSERT OR IGNORE INTO product_families (id, family_code, family_name, pricing_multiplier, description) VALUES
('pf_ipg', 'IPG', 'Infrastructure Products Group', 1.0400, 'Infrastructure products with 4% markup'),
('pf_psg', 'PSG', 'Personal Systems Group', 1.0000, 'Personal systems with no markup');

-- Insert default admin user (password should be changed in production)
INSERT OR IGNORE INTO users (id, email, name, role, status) VALUES
('user_admin', 'admin@company.com', 'System Administrator', 'admin', 'active');

-- Insert sample agent configurations
INSERT OR IGNORE INTO agents (id, name, agent_type, description, model_name, status) VALUES
('agent_email', 'Email Analysis Agent', 'email_analysis', 'Analyzes incoming emails and extracts entities', 'gpt-4', 'active'),
('agent_deal', 'Deal Query Agent', 'deal_query', 'Handles deal-related queries and calculations', 'gpt-4', 'active'),
('agent_research', 'Research Agent', 'research', 'Performs research tasks and data collection', 'gpt-4', 'active');

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active deals with item counts
CREATE VIEW IF NOT EXISTS v_active_deals AS
SELECT 
    d.*,
    COUNT(di.id) as item_count,
    SUM(di.remaining_quantity * di.final_price) as total_remaining_value,
    CASE 
        WHEN d.end_date < DATE('now') THEN 'expired'
        WHEN d.end_date < DATE('now', '+30 days') THEN 'expiring_soon'
        ELSE 'active'
    END as deal_health
FROM deals d
LEFT JOIN deal_items di ON d.deal_id = di.deal_id
WHERE d.status = 'active'
GROUP BY d.id;

-- View for email workload by assignee
CREATE VIEW IF NOT EXISTS v_email_workload AS
SELECT 
    assigned_to,
    COUNT(*) as total_emails,
    SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_emails,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_emails,
    SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_emails,
    AVG(CASE WHEN status = 'completed' AND completed_at IS NOT NULL 
         THEN (julianday(completed_at) - julianday(received_at)) * 24 
         ELSE NULL END) as avg_resolution_hours
FROM emails_enhanced
WHERE assigned_to IS NOT NULL
GROUP BY assigned_to;

-- View for task progress by user
CREATE VIEW IF NOT EXISTS v_task_progress AS
SELECT 
    assigned_to,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
    SUM(CASE WHEN due_date < DATETIME('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks,
    AVG(progress_percentage) as avg_progress
FROM tasks_enhanced
WHERE assigned_to IS NOT NULL
GROUP BY assigned_to;