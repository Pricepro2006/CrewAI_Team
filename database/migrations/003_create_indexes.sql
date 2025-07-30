-- Database Performance Indexes
-- Created as part of b-proof implementation plan

-- Email analysis indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_email_analysis_timestamp 
  ON email_analysis(analysis_timestamp);

CREATE INDEX IF NOT EXISTS idx_email_analysis_workflow 
  ON email_analysis(primary_workflow);

CREATE INDEX IF NOT EXISTS idx_email_analysis_confidence 
  ON email_analysis(confidence_score);

CREATE INDEX IF NOT EXISTS idx_email_analysis_workflow_timestamp 
  ON email_analysis(primary_workflow, analysis_timestamp);

CREATE INDEX IF NOT EXISTS idx_email_analysis_urgency 
  ON email_analysis(urgency_level);

CREATE INDEX IF NOT EXISTS idx_email_analysis_workflow_state 
  ON email_analysis(workflow_state);

-- Entity extraction indexes
CREATE INDEX IF NOT EXISTS idx_entity_extractions_type 
  ON entity_extractions(entity_type);

CREATE INDEX IF NOT EXISTS idx_entity_extractions_email_id 
  ON entity_extractions(email_id);

CREATE INDEX IF NOT EXISTS idx_entity_extractions_confidence 
  ON entity_extractions(confidence_score);

-- Emails table indexes
CREATE INDEX IF NOT EXISTS idx_emails_created_at 
  ON emails(created_at);

CREATE INDEX IF NOT EXISTS idx_emails_subject_text 
  ON emails(subject) WHERE subject IS NOT NULL;

-- Automation rules indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_status 
  ON automation_rules(status);

CREATE INDEX IF NOT EXISTS idx_rule_executions_rule_id 
  ON rule_executions(rule_id);

CREATE INDEX IF NOT EXISTS idx_rule_executions_timestamp 
  ON rule_executions(executed_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_emails_analysis_join 
  ON email_analysis(email_id, workflow_state);

CREATE INDEX IF NOT EXISTS idx_entity_email_type 
  ON entity_extractions(email_id, entity_type);

-- Performance optimization for date range queries
CREATE INDEX IF NOT EXISTS idx_emails_date_range 
  ON emails(created_at) WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_date_range 
  ON email_analysis(analysis_timestamp) WHERE analysis_timestamp IS NOT NULL;