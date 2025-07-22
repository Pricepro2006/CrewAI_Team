-- Migration: Unified Email Dashboard Features
-- Version: 001
-- Date: 2025-07-22
-- Description: Adds tables and indexes for unified email dashboard with real-time processing

-- Migration metadata table
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Check if migration already applied
INSERT OR IGNORE INTO migrations (version, name) VALUES ('001', 'unified_email_dashboard');

-- =====================================================
-- Add new columns to emails_enhanced if not exists
-- =====================================================

-- SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS
-- So we need to check column existence programmatically
-- These would be handled by the migration runner

-- Add workflow tracking columns
-- ALTER TABLE emails_enhanced ADD COLUMN workflow_state TEXT DEFAULT 'START_POINT';
-- ALTER TABLE emails_enhanced ADD COLUMN workflow_type TEXT;
-- ALTER TABLE emails_enhanced ADD COLUMN workflow_chain_id TEXT;
-- ALTER TABLE emails_enhanced ADD COLUMN is_workflow_complete BOOLEAN DEFAULT FALSE;
-- ALTER TABLE emails_enhanced ADD COLUMN processing_version TEXT;

-- =====================================================
-- Workflow Chain Tables (from workflow_chains.sql)
-- =====================================================

-- Workflow Chains Table
CREATE TABLE IF NOT EXISTS workflow_chains (
    id TEXT PRIMARY KEY,
    workflow_type TEXT NOT NULL,
    start_email_id TEXT NOT NULL,
    current_state TEXT NOT NULL CHECK (current_state IN ('START_POINT', 'IN_PROGRESS', 'COMPLETION')),
    email_count INTEGER DEFAULT 1,
    is_complete BOOLEAN DEFAULT FALSE,
    
    -- Metrics
    total_duration_hours REAL,
    avg_response_time_hours REAL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    FOREIGN KEY (start_email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Workflow Chain Emails Junction Table
CREATE TABLE IF NOT EXISTS workflow_chain_emails (
    chain_id TEXT NOT NULL,
    email_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    state_at_addition TEXT NOT NULL DEFAULT 'START_POINT',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (chain_id, email_id),
    FOREIGN KEY (chain_id) REFERENCES workflow_chains(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Workflow Bottlenecks Table
CREATE TABLE IF NOT EXISTS workflow_bottlenecks (
    id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,
    email_id TEXT NOT NULL,
    bottleneck_type TEXT NOT NULL,
    wait_time_hours REAL,
    stage TEXT NOT NULL,
    
    -- Resolution tracking
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolution_method TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (chain_id) REFERENCES workflow_chains(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Workflow Metrics Cache
CREATE TABLE IF NOT EXISTS workflow_metrics_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date DATE NOT NULL,
    metric_hour INTEGER, -- NULL for daily metrics
    
    -- Chain metrics
    total_chains INTEGER DEFAULT 0,
    complete_chains INTEGER DEFAULT 0,
    partial_chains INTEGER DEFAULT 0,
    broken_chains INTEGER DEFAULT 0,
    
    -- Completion metrics
    completion_rate REAL,
    avg_chain_duration_hours REAL,
    avg_emails_per_chain REAL,
    
    -- Type breakdown
    quote_chains INTEGER DEFAULT 0,
    order_chains INTEGER DEFAULT 0,
    support_chains INTEGER DEFAULT 0,
    other_chains INTEGER DEFAULT 0,
    
    -- Performance metrics
    chains_created_count INTEGER DEFAULT 0,
    chains_completed_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(metric_date, metric_hour)
);

-- =====================================================
-- Real-time Processing Support Tables
-- =====================================================

-- Email Processing Queue State
CREATE TABLE IF NOT EXISTS email_processing_queue (
    id TEXT PRIMARY KEY,
    graph_id TEXT UNIQUE NOT NULL,
    job_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    priority INTEGER DEFAULT 3,
    
    -- Job data
    email_data TEXT NOT NULL, -- JSON
    
    -- Processing metadata
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Graph API Webhook Subscriptions
CREATE TABLE IF NOT EXISTS graph_subscriptions (
    id TEXT PRIMARY KEY,
    subscription_id TEXT UNIQUE NOT NULL,
    resource TEXT NOT NULL,
    change_type TEXT NOT NULL,
    notification_url TEXT NOT NULL,
    expiration_date TIMESTAMP NOT NULL,
    client_state TEXT,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'error')),
    last_renewal_at TIMESTAMP,
    renewal_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Performance Monitoring Tables
-- =====================================================

-- Email Processing Performance
CREATE TABLE IF NOT EXISTS email_processing_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    
    -- Stage timings (milliseconds)
    webhook_received_ms INTEGER,
    queue_time_ms INTEGER,
    analysis_time_ms INTEGER,
    db_write_time_ms INTEGER,
    total_time_ms INTEGER,
    
    -- Processing metadata
    pipeline_version TEXT,
    model_used TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Dashboard Performance Metrics
CREATE TABLE IF NOT EXISTS dashboard_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    
    -- Context
    user_id TEXT,
    session_id TEXT,
    page_load BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Workflow chain indexes
CREATE INDEX IF NOT EXISTS idx_workflow_chains_type ON workflow_chains(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_state ON workflow_chains(current_state);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_complete ON workflow_chains(is_complete);
CREATE INDEX IF NOT EXISTS idx_workflow_chains_created ON workflow_chains(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_chain_emails_chain ON workflow_chain_emails(chain_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chain_emails_email ON workflow_chain_emails(email_id);
CREATE INDEX IF NOT EXISTS idx_workflow_chain_emails_sequence ON workflow_chain_emails(chain_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_workflow_bottlenecks_chain ON workflow_bottlenecks(chain_id);
CREATE INDEX IF NOT EXISTS idx_workflow_bottlenecks_resolved ON workflow_bottlenecks(resolved);
CREATE INDEX IF NOT EXISTS idx_workflow_bottlenecks_stage ON workflow_bottlenecks(stage);

CREATE INDEX IF NOT EXISTS idx_workflow_metrics_date ON workflow_metrics_cache(metric_date DESC);

-- Queue indexes
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON email_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON email_processing_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_processing_queue_graph_id ON email_processing_queue(graph_id);

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_graph_subscriptions_status ON graph_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_graph_subscriptions_expiration ON graph_subscriptions(expiration_date);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_processing_performance_email ON email_processing_performance(email_id);
CREATE INDEX IF NOT EXISTS idx_processing_performance_created ON email_processing_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_performance_type ON dashboard_performance(metric_type, metric_name);

-- =====================================================
-- Views for Analytics
-- =====================================================

-- Active workflow chains view
CREATE VIEW IF NOT EXISTS v_active_workflow_chains AS
SELECT 
    wc.*,
    COUNT(wce.email_id) as actual_email_count,
    MIN(e.received_at) as first_email_date,
    MAX(e.received_at) as last_email_date,
    CASE 
        WHEN wc.is_complete THEN 'Complete'
        WHEN wc.email_count > 1 THEN 'Partial'
        ELSE 'Broken'
    END as chain_status
FROM workflow_chains wc
LEFT JOIN workflow_chain_emails wce ON wc.id = wce.chain_id
LEFT JOIN emails_enhanced e ON wce.email_id = e.id
GROUP BY wc.id;

-- Workflow completion metrics view
CREATE VIEW IF NOT EXISTS v_workflow_completion_metrics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_chains,
    SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as complete_chains,
    ROUND(100.0 * SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as completion_rate,
    AVG(total_duration_hours) as avg_duration_hours
FROM workflow_chains
GROUP BY DATE(created_at);

-- Email processing performance view
CREATE VIEW IF NOT EXISTS v_email_processing_performance AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as emails_processed,
    AVG(total_time_ms) as avg_total_time_ms,
    AVG(queue_time_ms) as avg_queue_time_ms,
    AVG(analysis_time_ms) as avg_analysis_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_time_ms) as p95_total_time_ms
FROM email_processing_performance
GROUP BY DATE(created_at);

-- =====================================================
-- Triggers
-- =====================================================

-- Update workflow chain timestamp
CREATE TRIGGER IF NOT EXISTS update_workflow_chain_timestamp 
AFTER UPDATE ON workflow_chains
FOR EACH ROW
BEGIN
    UPDATE workflow_chains SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update processing queue timestamp
CREATE TRIGGER IF NOT EXISTS update_processing_queue_timestamp 
AFTER UPDATE ON email_processing_queue
FOR EACH ROW
BEGIN
    UPDATE email_processing_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update graph subscription timestamp
CREATE TRIGGER IF NOT EXISTS update_graph_subscription_timestamp 
AFTER UPDATE ON graph_subscriptions
FOR EACH ROW
BEGIN
    UPDATE graph_subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;