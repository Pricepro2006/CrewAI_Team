-- Fix Database Schema for CrewAI Team
-- This script adds all missing columns and tables

-- Add missing columns to emails table
ALTER TABLE emails ADD COLUMN IF NOT EXISTS phase_1_complete INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS phase_2_complete INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS phase_3_complete INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS phase_1_results TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS phase_2_results TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS phase_3_results TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS chain_id TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS is_complete_chain INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS completed_at TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE emails ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS assigned_at TEXT;

-- Add missing columns to email_chains table if it exists
CREATE TABLE IF NOT EXISTS email_chains (
  id TEXT PRIMARY KEY,
  start_email_id TEXT,
  current_state TEXT,
  email_count INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  workflow_type TEXT,
  confidence_score REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

-- Create workflow_states table if missing
CREATE TABLE IF NOT EXISTS workflow_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id TEXT NOT NULL,
  state TEXT NOT NULL,
  confidence REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id)
);

-- Create business_intelligence table if missing
CREATE TABLE IF NOT EXISTS business_intelligence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id TEXT NOT NULL,
  revenue_amount REAL,
  risk_level TEXT,
  opportunity_score REAL,
  action_items TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_chain_id ON emails(chain_id);
CREATE INDEX IF NOT EXISTS idx_emails_processing_status ON emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_email_chains_workflow ON email_chains(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_states_email ON workflow_states(email_id);