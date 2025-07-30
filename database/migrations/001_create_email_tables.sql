-- Migration: Create Email Tables
-- Date: 2025-01-26
-- Description: Creates tables for email analytics system

-- Create emails table
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE NOT NULL,
    sender TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME NOT NULL,
    folder TEXT DEFAULT 'inbox',
    has_attachments BOOLEAN DEFAULT 0,
    priority TEXT DEFAULT 'normal',
    is_read BOOLEAN DEFAULT 0,
    CONSTRAINT chk_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- Create email_analysis table
CREATE TABLE IF NOT EXISTS email_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    primary_workflow TEXT NOT NULL,
    workflow_state TEXT DEFAULT 'PENDING',
    confidence_score REAL,
    urgency_level TEXT,
    analysis_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER,
    model_used TEXT,
    error_message TEXT,
    metadata JSON,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_state CHECK (workflow_state IN ('PENDING', 'PROCESSING', 'COMPLETE', 'ERROR')),
    CONSTRAINT chk_urgency CHECK (urgency_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- Create entity_extractions table
CREATE TABLE IF NOT EXISTS entity_extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_value TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.0,
    position_start INTEGER,
    position_end INTEGER,
    extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- Create automation_rules table
CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_name TEXT NOT NULL UNIQUE,
    rule_type TEXT NOT NULL,
    conditions JSON NOT NULL,
    actions JSON NOT NULL,
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    last_executed DATETIME,
    CONSTRAINT chk_rule_type CHECK (rule_type IN ('categorization', 'routing', 'notification', 'escalation'))
);

-- Create rule_executions table for tracking automation history
CREATE TABLE IF NOT EXISTS rule_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id INTEGER NOT NULL,
    email_id INTEGER NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    execution_time_ms INTEGER,
    error_message TEXT,
    FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
    CONSTRAINT chk_status CHECK (status IN ('SUCCESS', 'FAILURE', 'SKIPPED'))
);

-- Create indexes for performance as specified in checklist
CREATE INDEX idx_emails_created_at ON emails(created_at);
CREATE INDEX idx_emails_sender ON emails(sender);
CREATE INDEX idx_emails_priority ON emails(priority);

CREATE INDEX idx_email_analysis_timestamp ON email_analysis(analysis_timestamp);
CREATE INDEX idx_email_analysis_workflow ON email_analysis(primary_workflow);
CREATE INDEX idx_email_analysis_workflow_state ON email_analysis(workflow_state);
CREATE INDEX idx_email_analysis_confidence ON email_analysis(confidence_score);
CREATE INDEX idx_email_analysis_workflow_timestamp ON email_analysis(primary_workflow, analysis_timestamp);

CREATE INDEX idx_entity_extractions_email_id ON entity_extractions(email_id);
CREATE INDEX idx_entity_extractions_type ON entity_extractions(entity_type);
CREATE INDEX idx_entity_extractions_value ON entity_extractions(entity_value);

CREATE INDEX idx_automation_rules_active ON automation_rules(is_active);
CREATE INDEX idx_rule_executions_rule_id ON rule_executions(rule_id);
CREATE INDEX idx_rule_executions_email_id ON rule_executions(email_id);
CREATE INDEX idx_rule_executions_executed_at ON rule_executions(executed_at);