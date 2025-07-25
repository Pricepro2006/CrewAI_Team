-- Migration Script 01: Create Migration Tables
-- Purpose: Create temporary tables for data transformation

-- Create temporary table for parsed analysis results
CREATE TABLE IF NOT EXISTS migration_analysis_temp (
    batch_id TEXT PRIMARY KEY,
    batch_number INTEGER,
    analysis_date TEXT,
    raw_json TEXT,
    workflow_state TEXT,
    primary_focus TEXT,
    urgency_level TEXT,
    business_impact TEXT,
    customer_name TEXT,
    customer_email TEXT,
    processed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create temporary table for extracted entities
CREATE TABLE IF NOT EXISTS migration_entities_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    entity_context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES migration_analysis_temp(batch_id)
);

-- Create temporary table for participants
CREATE TABLE IF NOT EXISTS migration_participants_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    participant_name TEXT NOT NULL,
    participant_email TEXT,
    participant_role TEXT,
    participant_type TEXT CHECK (participant_type IN ('customer', 'internal', 'external')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES migration_analysis_temp(batch_id)
);

-- Create temporary table for action items
CREATE TABLE IF NOT EXISTS migration_action_items_temp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    description TEXT NOT NULL,
    owner TEXT,
    priority TEXT,
    deadline TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES migration_analysis_temp(batch_id)
);

-- Create mapping table for workflow types
CREATE TABLE IF NOT EXISTS migration_workflow_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_workflow TEXT NOT NULL UNIQUE,
    target_workflow TEXT NOT NULL,
    workflow_category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default workflow mappings
INSERT OR IGNORE INTO migration_workflow_mapping (source_workflow, target_workflow, workflow_category) VALUES
('Renewal Quote Processing', 'Quote Processing', 'Sales'),
('Order Status Inquiry', 'Order Management', 'Operations'),
('Quote Request Processing', 'Quote Processing', 'Sales'),
('Order Placement', 'Order Management', 'Operations'),
('Invoice Inquiry', 'Billing Support', 'Finance'),
('Product Information Request', 'Product Support', 'Support'),
('Technical Support', 'Technical Support', 'Support'),
('Return/RMA Processing', 'RMA Processing', 'Operations'),
('Shipping Inquiry', 'Shipping Management', 'Operations'),
('Account Management', 'Account Management', 'Sales');

-- Create status mapping table
CREATE TABLE IF NOT EXISTS migration_status_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_state TEXT NOT NULL,
    target_status TEXT NOT NULL CHECK (target_status IN ('red', 'yellow', 'green')),
    target_status_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default status mappings
INSERT OR IGNORE INTO migration_status_mapping (source_state, target_status, target_status_text) VALUES
('🔴 Started', 'red', 'Critical'),
('🔴 Urgent', 'red', 'Critical'),
('🟡 In-Progress', 'yellow', 'In Progress'),
('🟡 Processing', 'yellow', 'In Progress'),
('🟢 Completed', 'green', 'Completed'),
('🟢 Resolved', 'green', 'Completed'),
('🟢 Pending', 'green', 'Pending Review');

-- Create migration log table
CREATE TABLE IF NOT EXISTS migration_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_step TEXT NOT NULL,
    status TEXT NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_analysis_processed ON migration_analysis_temp(processed);
CREATE INDEX IF NOT EXISTS idx_migration_entities_batch ON migration_entities_temp(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_participants_batch ON migration_participants_temp(batch_id);
CREATE INDEX IF NOT EXISTS idx_migration_action_items_batch ON migration_action_items_temp(batch_id);