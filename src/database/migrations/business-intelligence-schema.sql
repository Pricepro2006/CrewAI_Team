-- Business Intelligence Schema Optimization for CrewAI Team
-- Creates normalized tables for better BI queries and performance

-- =============================================================================
-- BUSINESS INTELLIGENCE ENTITIES TABLE
-- Normalized entity extraction for better querying and analytics
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_entities_bi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'po_number', 'quote_number', 'case_number', 'part_number', 'order_reference', 'contact', etc.
    entity_value TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.0,
    source_field TEXT, -- 'subject', 'body', 'extracted_entities', etc.
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Indexes for high-performance entity queries
CREATE INDEX IF NOT EXISTS idx_email_entities_bi_email_id ON email_entities_bi(email_id);
CREATE INDEX IF NOT EXISTS idx_email_entities_bi_type ON email_entities_bi(entity_type);
CREATE INDEX IF NOT EXISTS idx_email_entities_bi_value ON email_entities_bi(entity_value);
CREATE INDEX IF NOT EXISTS idx_email_entities_bi_composite ON email_entities_bi(email_id, entity_type, entity_value);
CREATE INDEX IF NOT EXISTS idx_email_entities_bi_confidence ON email_entities_bi(entity_type, confidence_score DESC);

-- =============================================================================
-- BUSINESS INTELLIGENCE WORKFLOWS TABLE
-- Track workflow states and business processes
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_workflows_bi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    workflow_type TEXT NOT NULL, -- 'order_processing', 'support_ticket', 'quote_request', etc.
    workflow_state TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'escalated'
    priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    assigned_to TEXT,
    department TEXT,
    sla_deadline TEXT,
    business_impact TEXT, -- 'revenue', 'satisfaction', 'compliance'
    confidence_score REAL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Indexes for workflow management
CREATE INDEX IF NOT EXISTS idx_email_workflows_bi_email_id ON email_workflows_bi(email_id);
CREATE INDEX IF NOT EXISTS idx_email_workflows_bi_type_state ON email_workflows_bi(workflow_type, workflow_state);
CREATE INDEX IF NOT EXISTS idx_email_workflows_bi_priority ON email_workflows_bi(priority, sla_deadline);
CREATE INDEX IF NOT EXISTS idx_email_workflows_bi_assigned ON email_workflows_bi(assigned_to, workflow_state);
CREATE INDEX IF NOT EXISTS idx_email_workflows_bi_department ON email_workflows_bi(department, workflow_type);

-- =============================================================================
-- BUSINESS INTELLIGENCE METRICS TABLE
-- Track key business metrics extracted from emails
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_metrics_bi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'revenue_amount', 'response_time', 'satisfaction_score', etc.
    metric_value REAL NOT NULL,
    metric_unit TEXT, -- 'USD', 'hours', 'score', 'percentage'
    context_data TEXT, -- JSON for additional context
    extracted_from TEXT, -- 'subject', 'body', 'analysis'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails_enhanced(id) ON DELETE CASCADE
);

-- Indexes for metrics analysis
CREATE INDEX IF NOT EXISTS idx_email_metrics_bi_email_id ON email_metrics_bi(email_id);
CREATE INDEX IF NOT EXISTS idx_email_metrics_bi_type ON email_metrics_bi(metric_type);
CREATE INDEX IF NOT EXISTS idx_email_metrics_bi_value ON email_metrics_bi(metric_type, metric_value DESC);

-- =============================================================================
-- POPULATE INITIAL DATA FROM EXISTING ANALYSIS
-- Migrate existing data to new BI structure
-- =============================================================================

-- Populate entities from existing email_analysis data
INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'po_number',
    entities_po_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_po_numbers IS NOT NULL AND entities_po_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'quote_number',
    entities_quote_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_quote_numbers IS NOT NULL AND entities_quote_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'case_number',
    entities_case_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_case_numbers IS NOT NULL AND entities_case_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'part_number',
    entities_part_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_part_numbers IS NOT NULL AND entities_part_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'order_reference',
    entities_order_references,
    'extracted_entities'
FROM email_analysis 
WHERE entities_order_references IS NOT NULL AND entities_order_references != '';

-- Populate workflows from existing email_analysis data
INSERT OR IGNORE INTO email_workflows_bi (email_id, workflow_type, workflow_state, priority, confidence_score)
SELECT 
    email_id,
    COALESCE(quick_workflow, deep_workflow_primary, 'unknown'),
    COALESCE(quick_suggested_state, 'pending'),
    COALESCE(quick_priority, 'normal'),
    COALESCE(quick_confidence, deep_confidence, 0.0)
FROM email_analysis;

-- =============================================================================
-- BUSINESS INTELLIGENCE VIEWS
-- Pre-calculated views for common BI queries
-- =============================================================================

-- Email Entity Summary View
CREATE VIEW IF NOT EXISTS v_email_entities_summary AS
SELECT 
    entity_type,
    COUNT(*) as total_count,
    COUNT(DISTINCT email_id) as unique_emails,
    AVG(confidence_score) as avg_confidence,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM email_entities_bi
GROUP BY entity_type
ORDER BY total_count DESC;

-- Workflow Performance View
CREATE VIEW IF NOT EXISTS v_workflow_performance AS
SELECT 
    workflow_type,
    workflow_state,
    priority,
    COUNT(*) as email_count,
    AVG(confidence_score) as avg_confidence,
    COUNT(CASE WHEN sla_deadline < datetime('now') THEN 1 END) as overdue_count
FROM email_workflows_bi
GROUP BY workflow_type, workflow_state, priority
ORDER BY workflow_type, priority DESC;

-- Business Impact Dashboard View
CREATE VIEW IF NOT EXISTS v_business_impact_dashboard AS
SELECT 
    DATE(e.received_date_time) as date,
    COUNT(DISTINCT e.id) as total_emails,
    COUNT(DISTINCT w.id) as workflow_emails,
    COUNT(DISTINCT ent.id) as entity_emails,
    COUNT(CASE WHEN w.priority = 'urgent' THEN 1 END) as urgent_count,
    COUNT(CASE WHEN w.priority = 'high' THEN 1 END) as high_priority_count,
    AVG(w.confidence_score) as avg_workflow_confidence
FROM emails_enhanced e
LEFT JOIN email_workflows_bi w ON e.id = w.email_id
LEFT JOIN email_entities_bi ent ON e.id = ent.email_id
GROUP BY DATE(e.received_date_time)
ORDER BY date DESC;

-- =============================================================================
-- PERFORMANCE MONITORING
-- =============================================================================

-- Create trigger to update workflow timestamps
CREATE TRIGGER IF NOT EXISTS update_workflow_timestamp
AFTER UPDATE ON email_workflows_bi
BEGIN
  UPDATE email_workflows_bi 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Performance analysis query template
-- Use this to verify index usage:
/*
EXPLAIN QUERY PLAN 
SELECT e.id, e.subject, ent.entity_type, ent.entity_value, w.workflow_state
FROM emails_enhanced e
LEFT JOIN email_entities_bi ent ON e.id = ent.email_id
LEFT JOIN email_workflows_bi w ON e.id = w.email_id
WHERE ent.entity_type = 'po_number'
AND w.workflow_state = 'pending'
ORDER BY e.received_date_time DESC;
*/