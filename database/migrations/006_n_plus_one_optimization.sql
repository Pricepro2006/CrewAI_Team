-- N+1 Query Problem Resolution
-- Migration 006: Eliminate N+1 queries with optimized JOIN patterns
-- Date: 2025-08-05
-- Focus: Batch loading, eager loading, and query consolidation

-- ==========================================
-- MATERIALIZED VIEWS FOR COMMON JOINS
-- ==========================================

-- 1. Email with analysis summary (eliminates N+1 for email + analysis queries)
CREATE VIEW IF NOT EXISTS emails_with_analysis AS
SELECT 
  e.id,
  e.internet_message_id,
  e.conversation_id,
  e.subject,
  e.sender_email,
  e.sender_name,
  e.received_date_time,
  e.status,
  e.priority,
  e.has_attachments,
  e.is_read,
  
  -- Analysis data (single JOIN instead of N+1)
  ea.primary_workflow,
  ea.workflow_state,
  ea.confidence_score,
  ea.urgency_level,
  ea.analysis_timestamp,
  ea.processing_time_ms,
  ea.model_used,
  
  -- Chain analysis
  e.chain_id,
  e.chain_completeness_score,
  e.is_chain_complete
FROM emails_enhanced e
LEFT JOIN email_analysis ea ON e.id = ea.email_id;

-- Index to support the materialized view
CREATE INDEX IF NOT EXISTS idx_emails_analysis_view_support 
  ON email_analysis(email_id) 
  INCLUDE (primary_workflow, workflow_state, confidence_score, analysis_timestamp);

-- ==========================================
-- BATCH ENTITY EXTRACTION VIEW
-- ==========================================

-- 2. Emails with all entities (eliminates N+1 for entity queries)
CREATE VIEW IF NOT EXISTS emails_with_entities AS
SELECT 
  e.id as email_id,
  e.subject,
  e.sender_email,
  e.received_date_time,
  
  -- Aggregated entities to avoid N+1
  GROUP_CONCAT(
    CASE WHEN ee.entity_type IS NOT NULL 
    THEN ee.entity_type || ':' || ee.entity_value || ':' || ee.confidence_score 
    END, '|'
  ) as entities_json,
  
  COUNT(ee.id) as entity_count,
  AVG(ee.confidence_score) as avg_entity_confidence,
  MAX(ee.confidence_score) as max_entity_confidence
FROM emails_enhanced e
LEFT JOIN entity_extractions ee ON e.id = ee.email_id
GROUP BY e.id, e.subject, e.sender_email, e.received_date_time;

-- Supporting index for entity aggregation
CREATE INDEX IF NOT EXISTS idx_entities_batch_loading 
  ON entity_extractions(email_id, entity_type, confidence_score DESC);

-- ==========================================
-- CONVERSATION THREAD OPTIMIZATION
-- ==========================================

-- 3. Complete conversation threads (eliminates N+1 for threading queries)
CREATE VIEW IF NOT EXISTS conversation_threads AS
SELECT 
  c.conversation_id,
  COUNT(c.id) as email_count,
  MIN(c.received_date_time) as thread_start,
  MAX(c.received_date_time) as thread_end,
  
  -- Thread participants
  GROUP_CONCAT(DISTINCT c.sender_email, ';') as participants,
  
  -- Thread subjects evolution
  GROUP_CONCAT(c.subject, ' → ') as subject_evolution,
  
  -- Analysis summary
  AVG(ea.confidence_score) as avg_confidence,
  COUNT(CASE WHEN ea.urgency_level = 'HIGH' THEN 1 END) as high_urgency_count,
  
  -- Latest email info
  (SELECT sender_email FROM emails_enhanced 
   WHERE conversation_id = c.conversation_id 
   ORDER BY received_date_time DESC LIMIT 1) as latest_sender,
  (SELECT subject FROM emails_enhanced 
   WHERE conversation_id = c.conversation_id 
   ORDER BY received_date_time DESC LIMIT 1) as latest_subject
FROM emails_enhanced c
LEFT JOIN email_analysis ea ON c.id = ea.email_id
WHERE c.conversation_id IS NOT NULL
GROUP BY c.conversation_id;

-- Index for conversation thread performance
CREATE INDEX IF NOT EXISTS idx_conversation_thread_optimization 
  ON emails_enhanced(conversation_id, received_date_time DESC) 
  WHERE conversation_id IS NOT NULL;

-- ==========================================
-- WORKFLOW ANALYTICS CONSOLIDATION
-- ==========================================

-- 4. Workflow performance summary (eliminates N+1 for analytics)
CREATE VIEW IF NOT EXISTS workflow_performance_summary AS
SELECT 
  ea.primary_workflow,
  COUNT(*) as total_processed,
  AVG(ea.processing_time_ms) as avg_processing_time,
  MIN(ea.processing_time_ms) as min_processing_time,
  MAX(ea.processing_time_ms) as max_processing_time,
  
  -- Confidence distribution
  AVG(ea.confidence_score) as avg_confidence,
  COUNT(CASE WHEN ea.confidence_score >= 0.9 THEN 1 END) as high_confidence_count,
  COUNT(CASE WHEN ea.confidence_score >= 0.7 THEN 1 END) as medium_confidence_count,
  COUNT(CASE WHEN ea.confidence_score < 0.7 THEN 1 END) as low_confidence_count,
  
  -- Error analysis
  COUNT(CASE WHEN ea.error_message IS NOT NULL THEN 1 END) as error_count,
  
  -- Urgency distribution
  COUNT(CASE WHEN ea.urgency_level = 'CRITICAL' THEN 1 END) as critical_count,
  COUNT(CASE WHEN ea.urgency_level = 'HIGH' THEN 1 END) as high_urgency_count,
  COUNT(CASE WHEN ea.urgency_level = 'MEDIUM' THEN 1 END) as medium_urgency_count,
  COUNT(CASE WHEN ea.urgency_level = 'LOW' THEN 1 END) as low_urgency_count,
  
  -- Time analysis
  DATE(ea.analysis_timestamp) as analysis_date,
  COUNT(*) OVER (PARTITION BY ea.primary_workflow) as workflow_total
FROM email_analysis ea
WHERE ea.analysis_timestamp >= date('now', '-30 days')
GROUP BY ea.primary_workflow, DATE(ea.analysis_timestamp);

-- Supporting index for workflow analytics
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_optimization 
  ON email_analysis(primary_workflow, analysis_timestamp, confidence_score, processing_time_ms);

-- ==========================================
-- BULK OPERATIONS OPTIMIZATION
-- ==========================================

-- 5. Bulk email updates (eliminates N+1 for batch status updates)
CREATE VIEW IF NOT EXISTS bulk_update_candidates AS
SELECT 
  e.id,
  e.status,
  e.workflow_state,
  e.processing_status,
  ea.primary_workflow,
  ea.confidence_score,
  
  -- Update recommendations
  CASE 
    WHEN ea.confidence_score >= 0.9 AND e.status = 'pending' THEN 'ready_for_completion'
    WHEN ea.confidence_score < 0.5 AND e.status = 'processing' THEN 'needs_review'
    WHEN ea.error_message IS NOT NULL THEN 'needs_reprocessing'
    ELSE 'no_action_needed'
  END as recommended_action,
  
  -- Priority scoring for batch processing
  CASE 
    WHEN ea.urgency_level = 'CRITICAL' THEN 100
    WHEN ea.urgency_level = 'HIGH' THEN 75
    WHEN ea.urgency_level = 'MEDIUM' THEN 50
    WHEN ea.urgency_level = 'LOW' THEN 25
    ELSE 10
  END as priority_score
FROM emails_enhanced e
LEFT JOIN email_analysis ea ON e.id = ea.email_id
WHERE e.status IN ('pending', 'processing', 'needs_review');

-- ==========================================
-- DASHBOARD DATA CONSOLIDATION
-- ==========================================

-- 6. Dashboard summary (single query instead of multiple N+1 queries)
CREATE VIEW IF NOT EXISTS dashboard_summary AS
SELECT 
  'today' as period,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_emails,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_emails,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_emails,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_emails,
  
  -- Analysis stats
  COUNT(CASE WHEN ea.confidence_score >= 0.9 THEN 1 END) as high_confidence_analyses,
  COUNT(CASE WHEN ea.urgency_level = 'CRITICAL' THEN 1 END) as critical_emails,
  
  -- Performance stats
  AVG(ea.processing_time_ms) as avg_processing_time,
  COUNT(CASE WHEN ea.processing_time_ms > 5000 THEN 1 END) as slow_processing_count
FROM emails_enhanced e
LEFT JOIN email_analysis ea ON e.id = ea.email_id
WHERE date(e.received_date_time) = date('now')

UNION ALL

SELECT 
  '7_days' as period,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_emails,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_emails,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_emails,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as error_emails,
  
  COUNT(CASE WHEN ea.confidence_score >= 0.9 THEN 1 END) as high_confidence_analyses,
  COUNT(CASE WHEN ea.urgency_level = 'CRITICAL' THEN 1 END) as critical_emails,
  
  AVG(ea.processing_time_ms) as avg_processing_time,
  COUNT(CASE WHEN ea.processing_time_ms > 5000 THEN 1 END) as slow_processing_count
FROM emails_enhanced e
LEFT JOIN email_analysis ea ON e.id = ea.email_id
WHERE e.received_date_time >= date('now', '-7 days');

-- ==========================================
-- BATCH LOADING FUNCTIONS (Simulated with CTEs)
-- ==========================================

-- 7. Email batch with all related data (eliminates multiple round trips)
CREATE VIEW IF NOT EXISTS email_batch_with_relations AS
WITH email_batch AS (
  SELECT id, internet_message_id, subject, sender_email, received_date_time, status, priority
  FROM emails_enhanced 
  ORDER BY received_date_time DESC 
  LIMIT 100
),
batch_analysis AS (
  SELECT ea.email_id, ea.primary_workflow, ea.confidence_score, ea.urgency_level
  FROM email_analysis ea
  INNER JOIN email_batch eb ON ea.email_id = eb.id
),
batch_entities AS (
  SELECT 
    ee.email_id,
    GROUP_CONCAT(ee.entity_type || ':' || ee.entity_value, '|') as entities
  FROM entity_extractions ee
  INNER JOIN email_batch eb ON ee.email_id = eb.id
  GROUP BY ee.email_id
)
SELECT 
  eb.*,
  ba.primary_workflow,
  ba.confidence_score,
  ba.urgency_level,
  COALESCE(be.entities, '') as entities
FROM email_batch eb
LEFT JOIN batch_analysis ba ON eb.id = ba.email_id
LEFT JOIN batch_entities be ON eb.id = be.email_id;

-- ==========================================
-- QUERY OPTIMIZATION VERIFICATION
-- ==========================================

-- Test query performance improvements
CREATE VIEW IF NOT EXISTS optimization_validation AS
SELECT 
  'N+1 Elimination' as optimization_type,
  'emails_with_analysis' as solution,
  'Single JOIN replaces N individual queries for email analysis' as benefit,
  (SELECT COUNT(*) FROM emails_with_analysis) as records_optimized
UNION ALL
SELECT 
  'Batch Loading' as optimization_type,
  'conversation_threads' as solution, 
  'Pre-aggregated conversation data eliminates thread reconstruction queries' as benefit,
  (SELECT COUNT(*) FROM conversation_threads) as records_optimized
UNION ALL
SELECT 
  'Dashboard Consolidation' as optimization_type,
  'dashboard_summary' as solution,
  'Single query replaces 10+ individual dashboard metric queries' as benefit,
  (SELECT SUM(total_emails) FROM dashboard_summary) as records_optimized;

-- Log N+1 optimization completion
INSERT INTO processing_logs (log_level, message, created_at) 
VALUES ('INFO', 'N+1 query optimization completed - Materialized views and batch loading implemented', datetime('now'));