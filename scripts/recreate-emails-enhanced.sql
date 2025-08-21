-- Safe migration script to recreate emails_enhanced with proper schema
-- Backs up existing data first

BEGIN TRANSACTION;

-- Step 1: Rename existing table to backup
ALTER TABLE emails_enhanced RENAME TO emails_enhanced_old;

-- Step 2: Create new table with correct schema
CREATE TABLE emails_enhanced (
  id TEXT PRIMARY KEY,
  graph_id TEXT UNIQUE,
  internet_message_id TEXT,
  subject TEXT,
  body_content TEXT,
  body_content_type TEXT DEFAULT 'text',
  body_preview TEXT,
  sender_email TEXT,
  sender_name TEXT,
  received_date_time TEXT,
  sent_date_time TEXT,
  importance TEXT,
  categories TEXT,
  has_attachments INTEGER DEFAULT 0,
  is_read INTEGER DEFAULT 0,
  is_flagged INTEGER DEFAULT 0,
  thread_id TEXT,
  conversation_id_ref TEXT,
  in_reply_to TEXT,
  "references" TEXT,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  -- Legacy columns for compatibility
  email_id TEXT,
  from_address TEXT,
  body TEXT,
  timestamp INTEGER,
  raw_content TEXT,
  phase_1_results TEXT,
  phase_2_results TEXT,
  phase_3_results TEXT,
  chain_id TEXT,
  position_in_chain INTEGER,
  is_complete_chain INTEGER,
  processing_status TEXT,
  retry_count INTEGER DEFAULT 0,
  last_processed_at INTEGER
);

-- Step 3: Copy data from old table, mapping columns appropriately
INSERT INTO emails_enhanced (
  id,
  email_id,
  subject,
  body_content,
  body,
  sender_email,
  from_address,
  timestamp,
  raw_content,
  phase_1_results,
  phase_2_results,
  phase_3_results,
  chain_id,
  position_in_chain,
  is_complete_chain,
  processing_status,
  status,
  priority,
  retry_count,
  last_processed_at,
  created_at,
  updated_at
)
SELECT 
  id,
  email_id,
  subject,
  body,
  body,
  from_address,
  from_address,
  timestamp,
  raw_content,
  phase_1_results,
  phase_2_results,
  phase_3_results,
  chain_id,
  position_in_chain,
  is_complete_chain,
  processing_status,
  COALESCE(processing_status, 'pending'),
  priority,
  retry_count,
  last_processed_at,
  created_at,
  updated_at
FROM emails_enhanced_old;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_graph_id ON emails_enhanced(graph_id);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_sender_email ON emails_enhanced(sender_email);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_received_date_time ON emails_enhanced(received_date_time);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_thread_id ON emails_enhanced(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_email_id ON emails_enhanced(email_id);
CREATE INDEX IF NOT EXISTS idx_emails_enhanced_processing_status ON emails_enhanced(processing_status);

-- Step 5: Create email_recipients table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_recipients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  email_address TEXT NOT NULL,
  name TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (email_id) REFERENCES emails_enhanced(id)
);

CREATE INDEX IF NOT EXISTS idx_email_recipients_email_id ON email_recipients(email_id);

COMMIT;

-- Keep the backup table for safety
-- DROP TABLE emails_enhanced_old; -- Uncomment to remove backup after verification