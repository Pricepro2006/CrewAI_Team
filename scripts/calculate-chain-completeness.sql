-- Chain Completeness Scoring Algorithm
-- Scores conversation threads based on multiple factors

WITH thread_metrics AS (
  SELECT 
    conversation_id as thread_id,
    COUNT(*) as email_count,
    COUNT(DISTINCT sender_email) as unique_senders,
    MIN(received_date_time) as thread_start,
    MAX(received_date_time) as thread_end,
    JULIANDAY(MAX(received_date_time)) - JULIANDAY(MIN(received_date_time)) as thread_duration_days,
    
    -- Content richness indicators
    AVG(LENGTH(body_content)) as avg_body_length,
    COUNT(CASE WHEN has_attachments = 1 THEN 1 END) as attachment_count,
    
    -- Analysis completeness
    COUNT(CASE WHEN phase_completed >= 1 THEN 1 END) as phase1_count,
    COUNT(CASE WHEN phase_completed >= 2 THEN 1 END) as phase2_count,
    
    -- Priority indicators
    SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) as critical_count,
    SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_count
    
  FROM emails_enhanced 
  WHERE conversation_id IS NOT NULL
  GROUP BY conversation_id
),

completeness_scores AS (
  SELECT 
    thread_id,
    email_count,
    unique_senders,
    thread_duration_days,
    
    -- Base completeness factors (0-100 scale)
    CASE 
      WHEN email_count >= 10 THEN 25
      WHEN email_count >= 5 THEN 20
      WHEN email_count >= 3 THEN 15
      ELSE 10
    END as size_score,
    
    CASE 
      WHEN unique_senders >= 3 THEN 20
      WHEN unique_senders >= 2 THEN 15
      ELSE 10
    END as diversity_score,
    
    CASE 
      WHEN thread_duration_days >= 7 THEN 15
      WHEN thread_duration_days >= 3 THEN 12
      WHEN thread_duration_days >= 1 THEN 8
      ELSE 5
    END as duration_score,
    
    CASE 
      WHEN avg_body_length >= 500 THEN 10
      WHEN avg_body_length >= 200 THEN 8
      WHEN avg_body_length >= 100 THEN 5
      ELSE 2
    END as content_score,
    
    CASE 
      WHEN (critical_count + high_count) >= 3 THEN 15
      WHEN (critical_count + high_count) >= 1 THEN 10
      ELSE 5
    END as priority_score,
    
    CASE
      WHEN attachment_count >= 3 THEN 10
      WHEN attachment_count >= 1 THEN 7
      ELSE 3
    END as attachment_score
    
  FROM thread_metrics
)

UPDATE emails_enhanced
SET chain_completeness_score = (
  SELECT 
    size_score + diversity_score + duration_score + 
    content_score + priority_score + attachment_score
  FROM completeness_scores
  WHERE completeness_scores.thread_id = emails_enhanced.conversation_id
)
WHERE conversation_id IS NOT NULL;