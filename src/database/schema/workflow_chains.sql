-- Workflow Chain Tracking Tables
-- These tables track email workflow chains for the unified dashboard

-- =====================================================
-- Workflow Chains Table
-- =====================================================
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

-- =====================================================
-- Workflow Chain Emails (Junction Table)
-- =====================================================
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

-- =====================================================
-- Workflow Bottlenecks Table
-- =====================================================
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

-- =====================================================
-- Workflow Metrics Cache
-- =====================================================
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
-- Indexes for Performance
-- =====================================================
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

-- Bottleneck analysis view
CREATE VIEW IF NOT EXISTS v_workflow_bottlenecks AS
SELECT 
    wb.stage,
    COUNT(*) as bottleneck_count,
    AVG(wb.wait_time_hours) as avg_wait_hours,
    SUM(CASE WHEN wb.resolved = 1 THEN 1 ELSE 0 END) as resolved_count,
    wc.workflow_type
FROM workflow_bottlenecks wb
JOIN workflow_chains wc ON wb.chain_id = wc.id
GROUP BY wb.stage, wc.workflow_type;

-- =====================================================
-- Triggers for Automatic Updates
-- =====================================================

-- Update workflow chain timestamp
CREATE TRIGGER IF NOT EXISTS update_workflow_chain_timestamp 
AFTER UPDATE ON workflow_chains
FOR EACH ROW
BEGIN
    UPDATE workflow_chains SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Calculate duration when chain completes
CREATE TRIGGER IF NOT EXISTS calculate_workflow_duration
AFTER UPDATE OF is_complete ON workflow_chains
FOR EACH ROW
WHEN NEW.is_complete = 1 AND OLD.is_complete = 0
BEGIN
    UPDATE workflow_chains 
    SET 
        completed_at = CURRENT_TIMESTAMP,
        total_duration_hours = (julianday(CURRENT_TIMESTAMP) - julianday(created_at)) * 24
    WHERE id = NEW.id;
END;