-- Performance Optimization Indexes for CrewAI Team
-- Based on performance analysis findings

-- Critical indexes for N+1 query fixes
-- Email entities lookup optimization
CREATE INDEX IF NOT EXISTS idx_email_entities_email_id ON email_entities(email_id);
CREATE INDEX IF NOT EXISTS idx_email_entities_composite ON email_entities(email_id, entity_type, entity_value);

-- Email attachments lookup optimization  
CREATE INDEX IF NOT EXISTS idx_email_attachments_email_id ON email_attachments(email_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_composite ON email_attachments(email_id, filename, size_bytes);

-- Email recipients lookup optimization (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_email_recipients_email_id ON email_recipients(email_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_type ON email_recipients(email_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_email_recipients_composite ON email_recipients(email_id, recipient_type, email_address);

-- Email table performance indexes
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_conversation_workflow ON emails_enhanced(conversation_id, workflow_state, sent_date);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_thread_chain ON emails_enhanced(thread_id, chain_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender_date ON emails_enhanced(sender_email, sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_subject_search ON emails_enhanced(subject COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_workflow_priority ON emails_enhanced(workflow_state, priority, sent_date DESC);

-- Conversation and thread performance
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_conversation_ref ON emails_enhanced(conversation_id_ref, sent_date);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_thread_date ON emails_enhanced(thread_id, sent_date DESC);

-- Full-text search optimization (if FTS is enabled)
-- CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(subject, body_plain, content=emails_enhanced, content_rowid=id);

-- Analysis and insights tables
CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
CREATE INDEX IF NOT EXISTS idx_email_analysis_phase ON email_analysis(email_id, analysis_phase);
CREATE INDEX IF NOT EXISTS idx_email_insights_email_id ON email_insights(email_id);
CREATE INDEX IF NOT EXISTS idx_email_insights_type ON email_insights(email_id, insight_type);

-- Performance monitoring
-- SQLite doesn't support execution plans, but we can add query complexity tracking
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_created_at ON emails_enhanced(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_updated_at ON emails_enhanced(updated_at DESC);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_status_date ON emails_enhanced(status, sent_date DESC);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender_status ON emails_enhanced(sender_email, status, sent_date DESC);

-- Analytics and reporting indexes
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_monthly_stats ON emails_enhanced(strftime('%Y-%m', sent_date), workflow_state);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_daily_stats ON emails_enhanced(date(sent_date), status);

-- Index usage and performance analysis
-- Create a view to monitor index usage (SQLite specific)
CREATE VIEW IF NOT EXISTS v_index_usage_stats AS
SELECT 
    name as index_name,
    tbl_name as table_name,
    'Performance optimization index' as purpose
FROM sqlite_master 
WHERE type = 'index' 
AND name LIKE 'idx_%'
ORDER BY tbl_name, name;