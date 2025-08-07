-- Migration: Add due_date column to grocery_lists table
-- Version: 016
-- Name: Add due_date to grocery_lists 
-- Description: Adds due_date column to grocery_lists table with proper indexing and constraints
-- Database: walmart_grocery.db
-- Author: Claude Code
-- Created: 2025-08-07

-- =============================================================================
-- IMPORTANT: BACKUP YOUR DATABASE BEFORE RUNNING THIS MIGRATION
-- 
-- Backup command:
-- cp data/walmart_grocery.db data/walmart_grocery_backup.db
-- 
-- Verification command after migration:
-- sqlite3 data/walmart_grocery.db "SELECT sql FROM sqlite_master WHERE name='grocery_lists';"
-- =============================================================================

-- UP MIGRATION
-- BEGIN: Add due_date column and indexes

-- Check if the column already exists (safety check in comments)
-- If running interactively, you can run: 
-- SELECT COUNT(*) FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';
-- This should return 0 before migration, 1 after migration

BEGIN TRANSACTION;

-- Add due_date column with NULL default (optional field)
-- This allows existing records to have no due date while new ones can specify it
ALTER TABLE grocery_lists 
ADD COLUMN due_date DATETIME DEFAULT NULL;

-- Add performance indexes for due_date queries
-- Index for filtering by due_date (WHERE due_date IS NOT NULL, ORDER BY due_date)
CREATE INDEX IF NOT EXISTS idx_grocery_lists_due_date 
ON grocery_lists(due_date) 
WHERE due_date IS NOT NULL;

-- Compound index for user + due_date queries (most common pattern)
-- Supports queries like: WHERE user_id = ? AND due_date > ?
CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_due_date 
ON grocery_lists(user_id, due_date) 
WHERE due_date IS NOT NULL;

-- Compound index for active lists with due dates
-- Supports queries like: WHERE is_active = 1 AND due_date BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_grocery_lists_active_due_date 
ON grocery_lists(is_active, due_date) 
WHERE is_active = 1 AND due_date IS NOT NULL;

-- Record this migration in schema_migrations table (create table if it doesn't exist)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  execution_time INTEGER NOT NULL DEFAULT 0,
  checksum TEXT
);

INSERT OR REPLACE INTO schema_migrations (version, name, checksum)
VALUES ('016', 'Add due_date to grocery_lists', '7d4f2a8c3b1e9f6d');

COMMIT;

-- Verification queries (run these after the migration):

-- 1. Verify column was added:
-- SELECT COUNT(*) as column_exists FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';
-- Expected result: 1

-- 2. Verify column type and constraints:
-- SELECT name, type, "notnull", dflt_value FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';
-- Expected result: due_date|DATETIME|0|NULL

-- 3. Verify indexes were created:
-- SELECT name FROM pragma_index_list('grocery_lists') WHERE name LIKE '%due_date%';
-- Expected result: 3 rows with the index names

-- 4. Test the functionality with sample data:
-- INSERT INTO grocery_lists (id, user_id, name, due_date) VALUES ('test-001', 'user-001', 'Test List', datetime('now', '+7 days'));
-- SELECT id, name, due_date FROM grocery_lists WHERE id = 'test-001';
-- DELETE FROM grocery_lists WHERE id = 'test-001';

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- 
-- If you need to rollback this migration, you'll need to recreate the table
-- since SQLite doesn't support DROP COLUMN. Here's the rollback SQL:
-- =============================================================================

-- DOWN MIGRATION (ROLLBACK)
-- To rollback, uncomment and run the following (MAKE SURE TO BACKUP FIRST):

/*
BEGIN TRANSACTION;

-- Create temporary table without due_date column
CREATE TABLE grocery_lists_temp (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_items INTEGER DEFAULT 0,
  estimated_total REAL,
  is_active BOOLEAN DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Copy data from original table (excluding due_date)
INSERT INTO grocery_lists_temp (
  id, user_id, name, description, total_items, 
  estimated_total, is_active, created_at, updated_at
)
SELECT 
  id, user_id, name, description, total_items, 
  estimated_total, is_active, created_at, updated_at
FROM grocery_lists;

-- Drop original table
DROP TABLE grocery_lists;

-- Rename temp table to original name
ALTER TABLE grocery_lists_temp RENAME TO grocery_lists;

-- Recreate original indexes (without due_date indexes)
CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON grocery_lists(user_id);

-- Remove migration record
DELETE FROM schema_migrations WHERE version = '016';

COMMIT;
*/

-- =============================================================================
-- SAMPLE QUERIES AFTER MIGRATION
-- 
-- Here are some example queries you can run after the migration:
-- =============================================================================

-- Find all lists with due dates in the next 7 days:
-- SELECT id, name, due_date FROM grocery_lists 
-- WHERE due_date BETWEEN datetime('now') AND datetime('now', '+7 days')
-- ORDER BY due_date ASC;

-- Find overdue lists:
-- SELECT id, name, due_date FROM grocery_lists 
-- WHERE due_date < datetime('now') AND is_active = 1
-- ORDER BY due_date ASC;

-- Find lists for a specific user with due dates:
-- SELECT id, name, due_date FROM grocery_lists 
-- WHERE user_id = 'your-user-id' AND due_date IS NOT NULL
-- ORDER BY due_date ASC;

-- Update an existing list with a due date (7 days from now):
-- UPDATE grocery_lists SET due_date = datetime('now', '+7 days') WHERE id = 'your-list-id';

-- Create a new list with a due date:
-- INSERT INTO grocery_lists (id, user_id, name, due_date) 
-- VALUES ('new-list-id', 'user-id', 'Weekly Shopping', datetime('now', '+3 days'));

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================