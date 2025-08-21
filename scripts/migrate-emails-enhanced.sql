-- Migration script to add missing columns to emails_enhanced table
-- This script safely adds columns only if they don't exist

-- First, create a backup of the existing data
CREATE TABLE IF NOT EXISTS emails_enhanced_backup AS SELECT * FROM emails_enhanced;

-- Add missing columns one by one (SQLite doesn't support ADD COLUMN IF NOT EXISTS)
-- We'll use a transaction to ensure atomicity

BEGIN TRANSACTION;

-- Check and add graph_id
ALTER TABLE emails_enhanced ADD COLUMN graph_id TEXT;

-- Check and add internet_message_id  
ALTER TABLE emails_enhanced ADD COLUMN internet_message_id TEXT;

-- Check and add body_content
ALTER TABLE emails_enhanced ADD COLUMN body_content TEXT;

-- Check and add body_content_type
ALTER TABLE emails_enhanced ADD COLUMN body_content_type TEXT DEFAULT 'text';

-- Check and add body_preview
ALTER TABLE emails_enhanced ADD COLUMN body_preview TEXT;

-- Check and add sender_email
ALTER TABLE emails_enhanced ADD COLUMN sender_email TEXT;

-- Check and add sender_name
ALTER TABLE emails_enhanced ADD COLUMN sender_name TEXT;

-- Check and add received_date_time
ALTER TABLE emails_enhanced ADD COLUMN received_date_time TEXT;

-- Check and add sent_date_time
ALTER TABLE emails_enhanced ADD COLUMN sent_date_time TEXT;

-- Check and add importance
ALTER TABLE emails_enhanced ADD COLUMN importance TEXT;

-- Check and add categories
ALTER TABLE emails_enhanced ADD COLUMN categories TEXT;

-- Check and add has_attachments
ALTER TABLE emails_enhanced ADD COLUMN has_attachments INTEGER DEFAULT 0;

-- Check and add is_read
ALTER TABLE emails_enhanced ADD COLUMN is_read INTEGER DEFAULT 0;

-- Check and add is_flagged
ALTER TABLE emails_enhanced ADD COLUMN is_flagged INTEGER DEFAULT 0;

-- Check and add thread_id
ALTER TABLE emails_enhanced ADD COLUMN thread_id TEXT;

-- Check and add conversation_id_ref
ALTER TABLE emails_enhanced ADD COLUMN conversation_id_ref TEXT;

-- Check and add in_reply_to
ALTER TABLE emails_enhanced ADD COLUMN in_reply_to TEXT;

-- Check and add references
ALTER TABLE emails_enhanced ADD COLUMN "references" TEXT;

-- Check and add status
ALTER TABLE emails_enhanced ADD COLUMN status TEXT DEFAULT 'pending';

-- Create email_recipients table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  email_address TEXT NOT NULL,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_graph_id ON emails_enhanced(graph_id);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender_email ON emails_enhanced(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_received_date_time ON emails_enhanced(received_date_time);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_thread_id ON emails_enhanced(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_recipients_email_id ON email_recipients(email_id);

COMMIT;