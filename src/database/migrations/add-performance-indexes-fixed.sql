-- Performance Optimization Indexes for CrewAI Team (CORRECTED VERSION)
-- Based on actual database schema analysis

-- =============================================================================
-- CRITICAL: This script addresses the failed indexes by matching actual schema
-- =============================================================================

-- Email attachments lookup optimization (FIXED: filename -> name)
-- Note: email_id index already exists, adding composite for performance
CREATE INDEX IF NOT EXISTS idx_email_attachments_composite_fixed ON email_attachments(email_id, name, size);

-- Email recipients performance indexes (some already exist, adding missing ones)
-- These are CRITICAL for the N+1 query optimization in EmailRepository.ts
CREATE INDEX IF NOT EXISTS idx_email_recipients_address ON email_recipients(email_address);
CREATE INDEX IF NOT EXISTS idx_email_recipients_name ON email_recipients(name);

-- Email table performance indexes (FIXED: column names to match actual schema)
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_conversation_workflow ON emails_enhanced(conversation_id, workflow_state, sent_date_time);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender_date ON emails_enhanced(sender_email, sent_date_time DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_workflow_priority ON emails_enhanced(workflow_state, priority, sent_date_time DESC);

-- Email analysis table optimization
-- Note: email_id index already exists
CREATE INDEX IF NOT EXISTS idx_email_analysis_workflow ON email_analysis(quick_workflow, quick_priority);
CREATE INDEX IF NOT EXISTS idx_email_analysis_confidence ON email_analysis(quick_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_email_analysis_urgency ON email_analysis(quick_urgency, quick_confidence DESC);

-- Composite indexes for common filter combinations (FIXED: column names)
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_status_date ON emails_enhanced(status, sent_date_time DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender_status ON emails_enhanced(sender_email, status, sent_date_time DESC);

-- Analytics and reporting indexes (FIXED: column names)
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_monthly_stats ON emails_enhanced(strftime('%Y-%m', sent_date_time), workflow_state);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_daily_stats ON emails_enhanced(date(sent_date_time), status);

-- Performance indexes for common queries in EmailRepository.ts
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_importance_date ON emails_enhanced(importance, sent_date_time DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_has_attachments ON emails_enhanced(has_attachments, sent_date_time DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_is_read ON emails_enhanced(is_read, sent_date_time DESC);

-- Chain analysis performance (these support the bulk operations)
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_chain_analysis ON emails_enhanced(chain_id, chain_completeness_score DESC, is_chain_complete);

-- Support for entity extraction from body content (for when entities are extracted from email content)
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_body_search ON emails_enhanced(subject COLLATE NOCASE, body_content COLLATE NOCASE);

-- Index usage monitoring view (corrected)
CREATE VIEW IF NOT EXISTS v_index_usage_stats_fixed AS
SELECT 
    name as index_name,
    tbl_name as table_name,
    CASE 
        WHEN name LIKE 'idx_email_recipients%' THEN 'N+1 Query Optimization - Recipients'
        WHEN name LIKE 'idx_email_attachments%' THEN 'N+1 Query Optimization - Attachments'
        WHEN name LIKE 'idx_emails_enhanced%' THEN 'Email Query Performance'
        WHEN name LIKE 'idx_email_analysis%' THEN 'Analysis Performance'
        ELSE 'General Performance'
    END as purpose,
    sql as definition
FROM sqlite_master 
WHERE type = 'index' 
AND name LIKE 'idx_%'
AND tbl_name IN ('emails_enhanced', 'email_recipients', 'email_attachments', 'email_analysis')
ORDER BY tbl_name, name;

-- Performance analysis queries for testing
-- These can be used to verify index effectiveness

-- Check if indexes are being used (run these after creating indexes)
/*
EXPLAIN QUERY PLAN 
SELECT * FROM emails_enhanced 
WHERE sender_email = 'test@example.com' 
ORDER BY sent_date_time DESC;

EXPLAIN QUERY PLAN
SELECT er.* FROM email_recipients er 
WHERE er.email_id IN ('id1', 'id2', 'id3');

EXPLAIN QUERY PLAN
SELECT ea.* FROM email_attachments ea 
WHERE ea.email_id IN ('id1', 'id2', 'id3');
*/