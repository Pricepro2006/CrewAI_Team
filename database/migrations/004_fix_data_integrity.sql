-- Fix database integrity issues
-- Part of b-proof implementation plan

-- 1. Add foreign key constraints (SQLite requires PRAGMA foreign_keys = ON)
-- Note: SQLite doesn't support adding foreign keys to existing tables, 
-- so we need to recreate tables with proper constraints

-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- 2. Fix negative processing times
UPDATE email_analysis 
SET processing_time_ms = ABS(processing_time_ms)
WHERE processing_time_ms < 0;

-- 3. Add CHECK constraints for data validation
-- Since SQLite doesn't support adding constraints to existing tables,
-- we'll create a view to identify invalid data

CREATE VIEW IF NOT EXISTS invalid_processing_times AS
SELECT id, email_id, processing_time_ms 
FROM email_analysis 
WHERE processing_time_ms < 0;

-- 4. Clean up orphaned records
DELETE FROM entity_extractions 
WHERE email_id NOT IN (SELECT id FROM emails);

DELETE FROM email_analysis 
WHERE email_id NOT IN (SELECT id FROM emails);

-- 5. Set default values for NULL fields
UPDATE email_analysis 
SET workflow_state = 'PENDING' 
WHERE workflow_state IS NULL;

UPDATE email_analysis 
SET confidence_score = 0.5 
WHERE confidence_score IS NULL;

-- 6. Create validation triggers for future inserts
CREATE TRIGGER IF NOT EXISTS validate_processing_time
BEFORE INSERT ON email_analysis
BEGIN
  SELECT CASE
    WHEN NEW.processing_time_ms < 0 THEN
      RAISE(ABORT, 'Processing time cannot be negative')
  END;
END;

CREATE TRIGGER IF NOT EXISTS validate_confidence_score
BEFORE INSERT ON email_analysis
BEGIN
  SELECT CASE
    WHEN NEW.confidence_score < 0 OR NEW.confidence_score > 1 THEN
      RAISE(ABORT, 'Confidence score must be between 0 and 1')
  END;
END;

-- 7. Create summary view for data quality monitoring
CREATE VIEW IF NOT EXISTS data_quality_summary AS
SELECT 
  'Negative Processing Times' as issue,
  COUNT(*) as count
FROM email_analysis
WHERE processing_time_ms < 0
UNION ALL
SELECT 
  'Orphaned Entity Extractions' as issue,
  COUNT(*) as count
FROM entity_extractions
WHERE email_id NOT IN (SELECT id FROM emails)
UNION ALL
SELECT 
  'Invalid Confidence Scores' as issue,
  COUNT(*) as count
FROM email_analysis
WHERE confidence_score < 0 OR confidence_score > 1
UNION ALL
SELECT 
  'Missing Workflow States' as issue,
  COUNT(*) as count
FROM email_analysis
WHERE workflow_state IS NULL;