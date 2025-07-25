-- Migration: Add assignment features to email dashboard
-- Date: 2025-01-20

-- Add assignedTo column to emails table if it doesn't exist
ALTER TABLE emails ADD COLUMN IF NOT EXISTS assignedTo TEXT;

-- Add lastUpdated column for tracking changes
ALTER TABLE emails ADD COLUMN IF NOT EXISTS lastUpdated TEXT;

-- Create activity logs table for tracking assignment history
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  email_id TEXT,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL,
  details TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_assignedTo ON emails(assignedTo);
CREATE INDEX IF NOT EXISTS idx_emails_lastUpdated ON emails(lastUpdated);
CREATE INDEX IF NOT EXISTS idx_activity_logs_email_id ON activity_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);

-- Update existing emails to have lastUpdated timestamp if not set
UPDATE emails 
SET lastUpdated = timestamp 
WHERE lastUpdated IS NULL;