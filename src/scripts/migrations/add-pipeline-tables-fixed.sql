-- Migration: Add Pipeline Tracking Tables
-- Date: January 23, 2025
-- Purpose: Support three-stage hybrid pipeline execution tracking

-- Create pipeline execution tracking table
CREATE TABLE IF NOT EXISTS pipeline_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  stage1_count INTEGER DEFAULT 0,
  stage2_count INTEGER DEFAULT 0,
  stage3_count INTEGER DEFAULT 0,
  total_processing_time_seconds REAL,
  status TEXT CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'running',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create stage results tracking table
CREATE TABLE IF NOT EXISTS stage_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id INTEGER REFERENCES pipeline_executions(id),
  email_id INTEGER,
  stage INTEGER CHECK(stage IN (1, 2, 3)),
  priority_score REAL,
  processing_time_seconds REAL,
  model_used TEXT,
  analysis_quality_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(execution_id, email_id, stage)
);

-- Check if email_analysis table exists, create if not
CREATE TABLE IF NOT EXISTS email_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER REFERENCES emails_enhanced(id),
  pipeline_stage INTEGER DEFAULT NULL,
  pipeline_priority_score REAL DEFAULT NULL,
  llama_analysis TEXT DEFAULT NULL,
  phi4_analysis TEXT DEFAULT NULL,
  final_model_used TEXT DEFAULT NULL,
  analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_status ON pipeline_executions(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_executions_started_at ON pipeline_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_stage_results_execution_id ON stage_results(execution_id);
CREATE INDEX IF NOT EXISTS idx_stage_results_email_id ON stage_results(email_id);
CREATE INDEX IF NOT EXISTS idx_stage_results_stage ON stage_results(stage);
CREATE INDEX IF NOT EXISTS idx_email_analysis_pipeline_stage ON email_analysis(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_email_analysis_pipeline_priority ON email_analysis(pipeline_priority_score);