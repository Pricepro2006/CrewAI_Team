# Database Integrity Check Report

## Date: 2025-07-26

## Database: `data/app.db`

### 1. Foreign Key Status

- **Status**: DISABLED (0)
- **Recommendation**: Enable foreign keys for referential integrity

### 2. Orphaned Records Check

- **orphaned_email_analysis**: 0 records ✅
- **orphaned_entity_extractions**: 0 records ✅
- **orphaned_rule_executions**: 0 records ✅

### 3. Constraint Violations

- **invalid_priority**: 0 records ✅
- **invalid_workflow_state**: 0 records ✅
- **invalid_urgency_level**: 0 records ✅

### 4. Data Quality Issues

- **null_message_ids**: 0 records ✅
- **duplicate_message_ids**: 0 records ✅
- **negative_processing_time**: 7,462 records ❌
  - Total records in email_analysis: 24,990
  - Percentage affected: 29.87%
  - Range: -1199ms to -1ms
  - Average: -598.43ms

### 5. Database Integrity

- **PRAGMA integrity_check**: OK ✅

## Critical Issues Found

### 1. Negative Processing Times

Nearly 30% of email_analysis records have negative processing times, which is logically impossible. This suggests:

- Incorrect timestamp calculation in the application logic
- Possible timezone issues when calculating processing duration
- Race condition in recording start/end times

### 2. Foreign Keys Disabled

Foreign key constraints are not enforced, which could lead to:

- Referential integrity issues in the future
- Orphaned records if delete operations are not properly cascaded
- Data inconsistencies

## Recommendations

1. **Fix Negative Processing Times**

   ```sql
   -- Update negative processing times to 0 or recalculate
   UPDATE email_analysis
   SET processing_time_ms = 0
   WHERE processing_time_ms < 0;
   ```

2. **Enable Foreign Keys**

   ```sql
   PRAGMA foreign_keys = ON;
   ```

3. **Add Check Constraint**

   ```sql
   -- For future tables, add constraint
   CHECK (processing_time_ms >= 0)
   ```

4. **Investigate Root Cause**
   - Review the code that calculates `processing_time_ms`
   - Check for timezone handling issues
   - Ensure proper timestamp recording

## SQL Queries for Further Investigation

```sql
-- Find pattern in negative processing times
SELECT
    DATE(created_at) as date,
    COUNT(*) as negative_count,
    AVG(processing_time_ms) as avg_negative_time
FROM email_analysis
WHERE processing_time_ms < 0
GROUP BY DATE(created_at)
ORDER BY date;

-- Check if specific models have this issue
SELECT
    model_used,
    COUNT(*) as count,
    AVG(processing_time_ms) as avg_time
FROM email_analysis
WHERE processing_time_ms < 0
GROUP BY model_used;
```
