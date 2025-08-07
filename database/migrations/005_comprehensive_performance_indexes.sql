-- Comprehensive Database Performance Optimization
-- Migration 005: High-Impact Index Creation for CrewAI Team
-- Date: 2025-08-05
-- Focus: Email processing pipeline, workflow analytics, and UI performance

-- ==========================================
-- CRITICAL EMAIL PROCESSING INDEXES
-- ==========================================

-- 1. Primary email filtering and sorting (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_emails_status_received_desc 
  ON emails_enhanced(status, received_date_time DESC) 
  WHERE status IS NOT NULL;

-- 2. Workflow state transitions (for pipeline processing)
CREATE INDEX IF NOT EXISTS idx_emails_workflow_analyzed 
  ON emails_enhanced(workflow_state, analyzed_at DESC) 
  WHERE workflow_state IS NOT NULL;

-- 3. Priority-based email processing
CREATE INDEX IF NOT EXISTS idx_emails_priority_status 
  ON emails_enhanced(priority, status, received_date_time DESC) 
  WHERE priority IS NOT NULL;

-- 4. Phase-based processing optimization
CREATE INDEX IF NOT EXISTS idx_emails_phase_processing 
  ON emails_enhanced(phase_completed, processing_status, analyzed_at DESC);

-- 5. Conversation threading performance
CREATE INDEX IF NOT EXISTS idx_emails_conversation_received 
  ON emails_enhanced(conversation_id, received_date_time DESC) 
  WHERE conversation_id IS NOT NULL;

-- 6. Chain analysis optimization
CREATE INDEX IF NOT EXISTS idx_emails_chain_completeness 
  ON emails_enhanced(chain_id, chain_completeness_score DESC, is_chain_complete) 
  WHERE chain_id IS NOT NULL;

-- ==========================================
-- EMAIL ANALYSIS PERFORMANCE INDEXES
-- ==========================================

-- 7. Email analysis primary workflow lookup
CREATE INDEX IF NOT EXISTS idx_analysis_workflow_confidence 
  ON email_analysis(primary_workflow, confidence_score DESC, analysis_timestamp DESC);

-- 8. Processing time analysis for optimization
CREATE INDEX IF NOT EXISTS idx_analysis_processing_performance 
  ON email_analysis(processing_time_ms ASC, model_used, analysis_timestamp DESC) 
  WHERE processing_time_ms IS NOT NULL;

-- 9. Error analysis and debugging
CREATE INDEX IF NOT EXISTS idx_analysis_error_states 
  ON email_analysis(workflow_state, error_message, analysis_timestamp DESC) 
  WHERE error_message IS NOT NULL;

-- 10. Urgency-based prioritization
CREATE INDEX IF NOT EXISTS idx_analysis_urgency_workflow 
  ON email_analysis(urgency_level, primary_workflow, analysis_timestamp DESC) 
  WHERE urgency_level IS NOT NULL;

-- ==========================================
-- ENTITY EXTRACTION OPTIMIZATION
-- ==========================================

-- 11. Entity type aggregation queries
CREATE INDEX IF NOT EXISTS idx_entities_type_confidence 
  ON entity_extractions(entity_type, confidence_score DESC, extracted_at DESC);

-- 12. Email-entity relationship optimization
CREATE INDEX IF NOT EXISTS idx_entities_email_type_value 
  ON entity_extractions(email_id, entity_type, entity_value);

-- 13. High-confidence entity filtering
CREATE INDEX IF NOT EXISTS idx_entities_high_confidence 
  ON entity_extractions(confidence_score DESC, entity_type, extracted_at DESC) 
  WHERE confidence_score >= 0.8;

-- ==========================================
-- DASHBOARD AND ANALYTICS INDEXES
-- ==========================================

-- 14. Dashboard overview statistics
CREATE INDEX IF NOT EXISTS idx_dashboard_date_status 
  ON emails_enhanced(received_date_time, status, priority) 
  WHERE received_date_time >= date('now', '-30 days');

-- 15. Processing metrics aggregation
CREATE INDEX IF NOT EXISTS idx_processing_metrics_time 
  ON processing_metrics(created_at DESC, processing_time_seconds, status);

-- 16. Daily analytics optimization
CREATE INDEX IF NOT EXISTS idx_emails_daily_analytics 
  ON emails_enhanced(date(received_date_time), status, phase_completed);

-- ==========================================
-- AUTOMATION AND WORKFLOW INDEXES
-- ==========================================

-- 17. Active automation rules lookup
CREATE INDEX IF NOT EXISTS idx_automation_active_priority 
  ON automation_rules(is_active, priority DESC, rule_type) 
  WHERE is_active = 1;

-- 18. Rule execution performance tracking
CREATE INDEX IF NOT EXISTS idx_rule_executions_performance 
  ON rule_executions(rule_id, executed_at DESC, execution_time_ms ASC, status);

-- 19. Recent rule execution analysis
CREATE INDEX IF NOT EXISTS idx_rule_executions_recent 
  ON rule_executions(executed_at DESC, status, rule_id) 
  WHERE executed_at >= date('now', '-7 days');

-- ==========================================
-- SPECIALIZED QUERY PATTERN INDEXES
-- ==========================================

-- 20. Sender-based email grouping
CREATE INDEX IF NOT EXISTS idx_emails_sender_received 
  ON emails_enhanced(sender_email, received_date_time DESC, status);

-- 21. Attachment processing optimization
CREATE INDEX IF NOT EXISTS idx_emails_attachments_processing 
  ON emails_enhanced(has_attachments, processing_status, received_date_time DESC) 
  WHERE has_attachments = 1;

-- 22. Draft and unread email management
CREATE INDEX IF NOT EXISTS idx_emails_read_status 
  ON emails_enhanced(is_read, is_draft, received_date_time DESC);

-- 23. Email threading and references
CREATE INDEX IF NOT EXISTS idx_emails_threading 
  ON emails_enhanced(in_reply_to, internet_message_id) 
  WHERE in_reply_to IS NOT NULL;

-- ==========================================
-- FULL-TEXT SEARCH OPTIMIZATION
-- ==========================================

-- 24. Subject-based search optimization
CREATE INDEX IF NOT EXISTS idx_emails_subject_search 
  ON emails_enhanced(subject) 
  WHERE subject IS NOT NULL AND length(subject) > 0;

-- 25. Body content search optimization (for non-FTS queries)
CREATE INDEX IF NOT EXISTS idx_emails_body_preview 
  ON emails_enhanced(body_preview) 
  WHERE body_preview IS NOT NULL AND length(body_preview) > 10;

-- ==========================================
-- MAINTENANCE AND CLEANUP INDEXES
-- ==========================================

-- 26. Data archival and cleanup
CREATE INDEX IF NOT EXISTS idx_emails_archival 
  ON emails_enhanced(last_modified_date_time, status) 
  WHERE status IN ('archived', 'deleted');

-- 27. Processing log maintenance
CREATE INDEX IF NOT EXISTS idx_processing_logs_cleanup 
  ON processing_logs(created_at, log_level) 
  WHERE created_at < date('now', '-90 days');

-- ==========================================
-- COVERING INDEXES FOR COMMON QUERIES
-- ==========================================

-- 28. Dashboard summary covering index
CREATE INDEX IF NOT EXISTS idx_emails_dashboard_summary 
  ON emails_enhanced(status, priority, received_date_time DESC) 
  INCLUDE (id, subject, sender_email, has_attachments);

-- 29. Analysis summary covering index
CREATE INDEX IF NOT EXISTS idx_analysis_summary_covering 
  ON email_analysis(email_id, primary_workflow, confidence_score) 
  INCLUDE (analysis_timestamp, processing_time_ms, urgency_level);

-- 30. Entity extraction covering index
CREATE INDEX IF NOT EXISTS idx_entities_summary_covering 
  ON entity_extractions(email_id, entity_type) 
  INCLUDE (entity_value, confidence_score, extracted_at);

-- ==========================================
-- INDEX MAINTENANCE COMMANDS
-- ==========================================

-- Analyze all tables to update SQLite statistics
ANALYZE;

-- Update database statistics for query planner optimization
PRAGMA optimize;

-- ==========================================
-- PERFORMANCE MONITORING QUERIES
-- ==========================================

-- Create view for index usage monitoring
CREATE VIEW IF NOT EXISTS index_usage_stats AS
SELECT 
  'idx_emails_status_received_desc' as index_name,
  'emails_enhanced' as table_name,
  'Critical - Status filtering with time ordering' as purpose,
  'SELECT * FROM emails_enhanced WHERE status = ? ORDER BY received_date_time DESC' as sample_query
UNION ALL
SELECT 
  'idx_emails_workflow_analyzed' as index_name,
  'emails_enhanced' as table_name,
  'Pipeline - Workflow state transitions' as purpose,
  'SELECT * FROM emails_enhanced WHERE workflow_state = ? ORDER BY analyzed_at DESC' as sample_query
UNION ALL
SELECT 
  'idx_analysis_workflow_confidence' as index_name,
  'email_analysis' as table_name,
  'Analytics - Workflow performance analysis' as purpose,
  'SELECT * FROM email_analysis WHERE primary_workflow = ? ORDER BY confidence_score DESC' as sample_query;

-- ==========================================
-- OPTIMIZATION VERIFICATION
-- ==========================================

-- Query to check index effectiveness
CREATE VIEW IF NOT EXISTS optimization_report AS
SELECT 
  'Email Processing' as category,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_emails,
  COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending_emails,
  AVG(CASE WHEN analyzed_at IS NOT NULL THEN 1.0 ELSE 0.0 END) * 100 as analysis_completion_rate
FROM emails_enhanced
UNION ALL
SELECT 
  'Analysis Performance' as category,
  COUNT(*) as total_analyses,
  AVG(processing_time_ms) as avg_processing_time_ms,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count,
  AVG(confidence_score) * 100 as avg_confidence_score
FROM email_analysis
WHERE analysis_timestamp >= date('now', '-30 days');

-- Log optimization completion
INSERT INTO processing_logs (log_level, message, created_at) 
VALUES ('INFO', 'Comprehensive performance indexes created - 30 indexes added for optimal query performance', datetime('now'));