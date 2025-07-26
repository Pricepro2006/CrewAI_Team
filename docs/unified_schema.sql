-- Unified Email Dashboard Database Schema
-- Combines IEMS analysis data with Email Dashboard requirements
-- Supports table-based UI with TD SYNNEX workflow patterns

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- =====================================================
-- Core Email Table
-- =====================================================
CREATE TABLE IF NOT EXISTS emails (
    -- Primary identification
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    graph_id TEXT UNIQUE,  -- Microsoft Graph ID if applicable
    message_id TEXT UNIQUE NOT NULL,  -- Unique email identifier
    
    -- Email metadata
    email_alias TEXT NOT NULL,  -- e.g., 'InsightOrderSupport@tdsynnex.com'
    requested_by TEXT NOT NULL,  -- Person who sent/requested
    subject TEXT NOT NULL,
    summary TEXT,  -- AI-generated or manual summary
    body_text TEXT,
    body_html TEXT,
    body_preview TEXT,
    
    -- Status and workflow
    status TEXT NOT NULL CHECK (status IN ('red', 'yellow', 'green')),
    status_text TEXT NOT NULL,  -- e.g., 'Critical', 'In Progress', 'Completed'
    workflow_state TEXT NOT NULL CHECK (workflow_state IN ('START_POINT', 'IN_PROGRESS', 'COMPLETION')),
    workflow_type TEXT,  -- e.g., 'Quote Processing', 'Order Management'
    priority TEXT CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    
    -- Timestamps
    received_date TIMESTAMP NOT NULL,
    sent_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Email properties
    is_read BOOLEAN DEFAULT 0,
    has_attachments BOOLEAN DEFAULT 0,
    importance TEXT,
    
    -- Threading and conversation
    thread_id TEXT,
    conversation_id TEXT,
    in_reply_to TEXT,
    
    -- Source and categorization
    mailbox_source TEXT,  -- Which mailbox this came from
    folder_path TEXT,  -- Folder path in the mailbox
    categories TEXT,  -- JSON array of categories
    tags TEXT,  -- JSON array of tags
    
    -- Assignment and ownership
    assigned_to TEXT,
    assigned_date TIMESTAMP,
    due_date TIMESTAMP,
    
    -- Processing metadata
    processed_flag BOOLEAN DEFAULT 0,
    processed_time TIMESTAMP,
    processing_metadata TEXT,  -- JSON with processing details
    
    -- Archival
    is_archived BOOLEAN DEFAULT 0,
    archived_date TIMESTAMP,
    
    -- Indexing
    INDEX idx_emails_status (status),
    INDEX idx_emails_workflow_state (workflow_state),
    INDEX idx_emails_email_alias (email_alias),
    INDEX idx_emails_requested_by (requested_by),
    INDEX idx_emails_received_date (received_date),
    INDEX idx_emails_thread_id (thread_id),
    INDEX idx_emails_conversation_id (conversation_id),
    INDEX idx_emails_priority (priority),
    INDEX idx_emails_workflow_type (workflow_type)
);

-- =====================================================
-- Email Recipients Table (normalized)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('to', 'cc', 'bcc')),
    name TEXT,
    email_address TEXT NOT NULL,
    
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    INDEX idx_recipients_email_id (email_id),
    INDEX idx_recipients_email_address (email_address)
);

-- =====================================================
-- Email Entities Table (extracted references)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,  -- 'po_number', 'quote_number', 'case_number', etc.
    entity_value TEXT NOT NULL,
    entity_format TEXT,  -- Format pattern if applicable
    confidence REAL DEFAULT 1.0,
    
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    INDEX idx_entities_email_id (email_id),
    INDEX idx_entities_type_value (entity_type, entity_value)
);

-- =====================================================
-- Attachments Table
-- =====================================================
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT,
    size INTEGER,
    content_id TEXT,
    is_inline BOOLEAN DEFAULT 0,
    storage_path TEXT,
    
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    INDEX idx_attachments_email_id (email_id)
);

-- =====================================================
-- Workflow Actions Table
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,  -- 'status_change', 'assignment', 'reply', etc.
    action_details TEXT,  -- JSON with action specifics
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    INDEX idx_actions_email_id (email_id),
    INDEX idx_actions_performed_at (performed_at)
);

-- =====================================================
-- Email Analysis Results Table
-- =====================================================
CREATE TABLE IF NOT EXISTS email_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL UNIQUE,
    
    -- Quick analysis
    quick_workflow_primary TEXT,
    quick_workflow_secondary TEXT,  -- JSON array
    quick_priority TEXT,
    quick_intent TEXT,
    quick_urgency TEXT,
    quick_confidence REAL,
    
    -- Deep analysis (stored as JSON for flexibility)
    deep_analysis TEXT,  -- Full JSON of deep workflow analysis
    
    -- Action items
    action_items TEXT,  -- JSON array of action items
    action_summary TEXT,
    
    -- Processing metadata
    stage1_time_ms INTEGER,
    stage2_time_ms INTEGER,
    total_time_ms INTEGER,
    model_stage1 TEXT,
    model_stage2 TEXT,
    
    -- Analysis timestamps
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    INDEX idx_analysis_email_id (email_id)
);

-- =====================================================
-- Dashboard Statistics Table (for caching)
-- =====================================================
CREATE TABLE IF NOT EXISTS dashboard_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL,
    stat_hour INTEGER,  -- 0-23, NULL for daily stats
    
    -- Counts by status
    total_emails INTEGER DEFAULT 0,
    red_count INTEGER DEFAULT 0,
    yellow_count INTEGER DEFAULT 0,
    green_count INTEGER DEFAULT 0,
    
    -- Counts by workflow state
    start_point_count INTEGER DEFAULT 0,
    in_progress_count INTEGER DEFAULT 0,
    completion_count INTEGER DEFAULT 0,
    
    -- Counts by priority
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    
    -- Performance metrics
    avg_response_time_hours REAL,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(stat_date, stat_hour),
    INDEX idx_stats_date (stat_date)
);

-- =====================================================
-- Filter Presets Table
-- =====================================================
CREATE TABLE IF NOT EXISTS filter_presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    filters TEXT NOT NULL,  -- JSON with filter configuration
    is_default BOOLEAN DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_presets_created_by (created_by)
);

-- =====================================================
-- Email Templates Table (for responses)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    subject_template TEXT,
    body_template TEXT,
    variables TEXT,  -- JSON array of variable names
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_templates_category (category)
);

-- =====================================================
-- Audit Log Table
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,  -- 'email', 'filter', 'template', etc.
    entity_id INTEGER,
    action TEXT NOT NULL,  -- 'create', 'update', 'delete', etc.
    old_values TEXT,  -- JSON of previous values
    new_values TEXT,  -- JSON of new values
    performed_by TEXT NOT NULL,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_performed_at (performed_at),
    INDEX idx_audit_performed_by (performed_by)
);

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- Email list view with counts
CREATE VIEW IF NOT EXISTS v_email_list AS
SELECT 
    e.id,
    e.message_id,
    e.email_alias,
    e.requested_by,
    e.subject,
    e.summary,
    e.status,
    e.status_text,
    e.workflow_state,
    e.workflow_type,
    e.priority,
    e.received_date,
    e.is_read,
    e.has_attachments,
    e.assigned_to,
    e.due_date,
    GROUP_CONCAT(DISTINCT ee.entity_value) as entities,
    COUNT(DISTINCT er.id) as recipient_count
FROM emails e
LEFT JOIN email_entities ee ON e.id = ee.email_id
LEFT JOIN email_recipients er ON e.id = er.email_id
WHERE e.is_archived = 0
GROUP BY e.id;

-- Status distribution view
CREATE VIEW IF NOT EXISTS v_status_distribution AS
SELECT 
    status,
    status_text,
    COUNT(*) as count
FROM emails
WHERE is_archived = 0
GROUP BY status, status_text;

-- Workflow state distribution view
CREATE VIEW IF NOT EXISTS v_workflow_distribution AS
SELECT 
    workflow_state,
    workflow_type,
    COUNT(*) as count
FROM emails
WHERE is_archived = 0
GROUP BY workflow_state, workflow_type;

-- =====================================================
-- Triggers for automatic timestamp updates
-- =====================================================
CREATE TRIGGER update_email_timestamp 
AFTER UPDATE ON emails
FOR EACH ROW
BEGIN
    UPDATE emails SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_filter_preset_timestamp 
AFTER UPDATE ON filter_presets
FOR EACH ROW
BEGIN
    UPDATE filter_presets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_template_timestamp 
AFTER UPDATE ON email_templates
FOR EACH ROW
BEGIN
    UPDATE email_templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- Initial Data Seeds
-- =====================================================

-- Default filter presets
INSERT INTO filter_presets (name, description, filters, is_default) VALUES
('My Critical Items', 'Shows all critical emails assigned to me', '{"statuses":["red"],"assignedTo":"@me"}', 0),
('Today''s Emails', 'All emails received today', '{"dateRange":{"start":"@today","end":"@today"}}', 0),
('Unread Urgent', 'Unread emails with high priority', '{"isRead":false,"priorities":["Critical","High"]}', 0),
('Quote Requests', 'All quote processing workflows', '{"workflowTypes":["Quote Processing"]}', 0);

-- Common email templates
INSERT INTO email_templates (name, category, subject_template, body_template, variables) VALUES
('Quote Acknowledgment', 'quotes', 'Re: {{subject}} - Quote Request Received', 'Dear {{requester}},\n\nWe have received your quote request for {{customer}}. Our team is reviewing the requirements and will provide you with a detailed quote within 24 hours.\n\nReference: {{reference_number}}\n\nBest regards,\n{{agent_name}}', '["subject","requester","customer","reference_number","agent_name"]'),
('Order Confirmation', 'orders', 'Order Confirmation - PO# {{po_number}}', 'Dear {{requester}},\n\nThis confirms receipt of your order:\nPO Number: {{po_number}}\nCustomer: {{customer}}\n\nEstimated delivery: {{delivery_date}}\n\nThank you for your business.\n\nBest regards,\n{{agent_name}}', '["po_number","requester","customer","delivery_date","agent_name"]');

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_emails_combined_filter 
ON emails(status, workflow_state, priority, received_date);

CREATE INDEX IF NOT EXISTS idx_emails_search 
ON emails(subject, summary, requested_by, email_alias);

CREATE INDEX IF NOT EXISTS idx_entities_lookup 
ON email_entities(entity_type, entity_value, email_id);