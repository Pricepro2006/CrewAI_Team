# Composite Database Indexes for Email Analytics

## Overview

This document describes the composite indexes added to improve query performance for the email analytics system. These indexes are specifically designed to optimize common query patterns identified in `EmailStorageService` and related services.

## Migration Information

- **Migration File**: `src/database/migrations/007_add_composite_indexes.ts`
- **Test File**: `src/database/__tests__/composite-indexes.test.ts`
- **Version**: 7
- **Priority**: Medium

## Index Categories

### 1. Email Table View Indexes

These indexes optimize queries for displaying emails in table views with filtering, sorting, and pagination.

#### `idx_emails_received_sender_subject`
- **Table**: `emails`
- **Columns**: `received_at DESC, sender_email, subject`
- **Purpose**: Optimizes email listing queries with timestamp ordering
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails 
  WHERE sender_email = ? 
  ORDER BY received_at DESC
  ```

#### `idx_emails_graph_received`
- **Table**: `emails`
- **Columns**: `graph_id, received_at DESC`
- **Purpose**: Optimizes graph ID lookups with timestamp ordering
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails 
  WHERE graph_id = ? 
  ORDER BY received_at DESC
  ```

### 2. Email Analysis Indexes

These indexes optimize queries for workflow analytics and status monitoring.

#### `idx_analysis_workflow_priority`
- **Table**: `email_analysis`
- **Columns**: `workflow_state, quick_priority, email_id`
- **Purpose**: Optimizes workflow state queries with priority filtering
- **Query Pattern**: 
  ```sql
  SELECT COUNT(*) FROM email_analysis 
  WHERE workflow_state = ? AND quick_priority = ?
  ```

#### `idx_analysis_sla_workflow`
- **Table**: `email_analysis`
- **Columns**: `action_sla_status, workflow_state, email_id`
- **Purpose**: Optimizes SLA monitoring queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM email_analysis 
  WHERE workflow_state NOT IN ('Completed', 'Archived') 
  AND action_sla_status IN ('at-risk', 'overdue')
  ```

#### `idx_analysis_priority_email`
- **Table**: `email_analysis`
- **Columns**: `quick_priority, email_id`
- **Purpose**: Optimizes priority-based queries with email joins
- **Query Pattern**: 
  ```sql
  SELECT e.*, ea.* FROM emails e 
  JOIN email_analysis ea ON e.id = ea.email_id 
  WHERE ea.quick_priority = ?
  ```

#### `idx_analysis_deep_workflow`
- **Table**: `email_analysis`
- **Columns**: `deep_workflow_primary, deep_confidence DESC, email_id`
- **Purpose**: Optimizes deep workflow analysis queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM email_analysis 
  WHERE deep_workflow_primary = ? 
  ORDER BY deep_confidence DESC
  ```

### 3. Enhanced Emails Indexes

These indexes optimize queries for the enhanced email tracking system.

#### `idx_emails_enhanced_assigned_status`
- **Table**: `emails_enhanced`
- **Columns**: `assigned_to, status, received_at DESC`
- **Purpose**: Optimizes user workload queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails_enhanced 
  WHERE assigned_to = ? AND status = ? 
  ORDER BY received_at DESC
  ```

#### `idx_emails_enhanced_priority_due`
- **Table**: `emails_enhanced`
- **Columns**: `priority, due_date, status`
- **Purpose**: Optimizes priority and due date queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails_enhanced 
  WHERE priority = ? AND due_date < ? 
  AND status != 'completed'
  ```

#### `idx_emails_enhanced_thread_received`
- **Table**: `emails_enhanced`
- **Columns**: `thread_id, received_at DESC`
- **Purpose**: Optimizes email thread queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails_enhanced 
  WHERE thread_id = ? 
  ORDER BY received_at DESC
  ```

#### `idx_emails_enhanced_conversation`
- **Table**: `emails_enhanced`
- **Columns**: `conversation_id_ref, received_at DESC`
- **Purpose**: Optimizes conversation-based email queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails_enhanced 
  WHERE conversation_id_ref = ? 
  ORDER BY received_at DESC
  ```

### 4. Entity Extraction Indexes

These indexes optimize entity lookup and validation queries.

#### `idx_email_entities_type_value_conf`
- **Table**: `email_entities`
- **Columns**: `entity_type, entity_value, confidence DESC`
- **Purpose**: Optimizes entity searches with confidence scoring
- **Query Pattern**: 
  ```sql
  SELECT * FROM email_entities 
  WHERE entity_type = ? AND entity_value = ? 
  ORDER BY confidence DESC
  ```

#### `idx_email_entities_type_method`
- **Table**: `email_entities`
- **Columns**: `entity_type, extraction_method, verified`
- **Purpose**: Optimizes entity extraction method queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM email_entities 
  WHERE entity_type = ? AND extraction_method = ? 
  AND verified = true
  ```

### 5. Conversation and Message Indexes

These indexes optimize conversation and message retrieval.

#### `idx_conversations_user_status_created`
- **Table**: `conversations`
- **Columns**: `user_id, status, created_at DESC`
- **Purpose**: Optimizes user conversation queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM conversations 
  WHERE user_id = ? AND status = ? 
  ORDER BY created_at DESC
  ```

#### `idx_conversations_type_status`
- **Table**: `conversations`
- **Columns**: `conversation_type, status, priority DESC`
- **Purpose**: Optimizes conversation type queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM conversations 
  WHERE conversation_type = ? AND status = ?
  ORDER BY priority DESC
  ```

#### `idx_messages_conversation_created`
- **Table**: `messages`
- **Columns**: `conversation_id, created_at DESC`
- **Purpose**: Optimizes message retrieval for conversations
- **Query Pattern**: 
  ```sql
  SELECT * FROM messages 
  WHERE conversation_id = ? 
  ORDER BY created_at DESC
  ```

#### `idx_messages_thread_role`
- **Table**: `messages`
- **Columns**: `thread_id, role, created_at DESC`
- **Purpose**: Optimizes threaded message queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM messages 
  WHERE thread_id = ? AND role = ? 
  ORDER BY created_at DESC
  ```

### 6. Performance Analytics Indexes

These indexes optimize performance monitoring and analytics queries.

#### `idx_analysis_processing_times` (Partial Index)
- **Table**: `email_analysis`
- **Columns**: `total_processing_time, quick_processing_time, deep_processing_time`
- **Condition**: `WHERE total_processing_time IS NOT NULL`
- **Purpose**: Optimizes processing time analytics
- **Query Pattern**: 
  ```sql
  SELECT AVG(total_processing_time), AVG(quick_processing_time) 
  FROM email_analysis 
  WHERE total_processing_time IS NOT NULL
  ```

#### `idx_analysis_models`
- **Table**: `email_analysis`
- **Columns**: `quick_model, deep_model, total_processing_time`
- **Purpose**: Optimizes model performance analysis
- **Query Pattern**: 
  ```sql
  SELECT quick_model, AVG(total_processing_time) 
  FROM email_analysis 
  GROUP BY quick_model
  ```

### 7. Workflow Pattern Indexes

#### `idx_workflow_patterns_category_rate`
- **Table**: `workflow_patterns`
- **Columns**: `workflow_category, success_rate DESC`
- **Purpose**: Optimizes workflow pattern matching
- **Query Pattern**: 
  ```sql
  SELECT * FROM workflow_patterns 
  WHERE workflow_category = ? 
  ORDER BY success_rate DESC
  ```

### 8. Audit and Activity Log Indexes

These indexes optimize audit trail and activity tracking queries.

#### `idx_audit_logs_entity`
- **Table**: `audit_logs`
- **Columns**: `entity_type, entity_id, created_at DESC`
- **Purpose**: Optimizes entity audit trail queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM audit_logs 
  WHERE entity_type = ? AND entity_id = ? 
  ORDER BY created_at DESC
  ```

#### `idx_audit_logs_performer`
- **Table**: `audit_logs`
- **Columns**: `performed_by, created_at DESC`
- **Purpose**: Optimizes user activity audit queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM audit_logs 
  WHERE performed_by = ? 
  ORDER BY created_at DESC
  ```

#### `idx_activity_logs_email` (Partial Index)
- **Table**: `activity_logs`
- **Columns**: `email_id, timestamp DESC`
- **Condition**: `WHERE email_id IS NOT NULL`
- **Purpose**: Optimizes email activity queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM activity_logs 
  WHERE email_id = ? 
  ORDER BY timestamp DESC
  ```

#### `idx_activity_logs_user_action`
- **Table**: `activity_logs`
- **Columns**: `user_id, action, timestamp DESC`
- **Purpose**: Optimizes user action queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM activity_logs 
  WHERE user_id = ? AND action = ? 
  ORDER BY timestamp DESC
  ```

### 9. Additional Composite Indexes for Complex Queries

These indexes were added to optimize specific complex query patterns identified in the codebase.

#### `idx_emails_enhanced_date_range_status`
- **Table**: `emails_enhanced`
- **Columns**: `status, received_at`
- **Purpose**: Optimizes date range queries with status filtering
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails_enhanced 
  WHERE received_at BETWEEN ? AND ? 
  AND status = ?
  ```

#### `idx_workflow_chain_emails_email`
- **Table**: `workflow_chain_emails`
- **Columns**: `email_id, chain_id`
- **Purpose**: Optimizes workflow chain email joins
- **Query Pattern**: 
  ```sql
  SELECT * FROM workflow_chains wc
  JOIN workflow_chain_emails wce ON wc.id = wce.chain_id
  WHERE wce.email_id = ?
  ```

#### `idx_workflow_chains_date_status`
- **Table**: `workflow_chains`
- **Columns**: `status, created_at DESC`
- **Purpose**: Optimizes workflow chain queries with date filtering
- **Query Pattern**: 
  ```sql
  SELECT * FROM workflow_chains 
  WHERE created_at >= ? AND status = ?
  ```

#### `idx_refresh_tokens_user_expiry`
- **Table**: `refresh_tokens`
- **Columns**: `user_id, expires_at, revoked_at`
- **Purpose**: Optimizes refresh token validation queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM refresh_tokens 
  WHERE user_id = ? 
  AND expires_at > datetime('now') 
  AND revoked_at IS NULL
  ```

#### `idx_emails_priority_received_sla`
- **Table**: `emails`
- **Columns**: `quick_priority, received_at`
- **Purpose**: Optimizes time-based SLA queries with priority
- **Query Pattern**: 
  ```sql
  SELECT * FROM emails 
  WHERE quick_priority = ? 
  AND datetime(received_at, '+4 hours') < datetime('now')
  ```

#### `idx_email_entities_email_type`
- **Table**: `email_entities`
- **Columns**: `email_id, entity_type, confidence DESC`
- **Purpose**: Optimizes entity queries by email
- **Query Pattern**: 
  ```sql
  SELECT * FROM email_entities 
  WHERE email_id = ? AND entity_type = ?
  ORDER BY confidence DESC
  ```

#### `idx_audit_logs_action_date`
- **Table**: `audit_logs`
- **Columns**: `action, created_at DESC`
- **Purpose**: Optimizes audit log action queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM audit_logs 
  WHERE action = ? AND created_at >= ?
  ORDER BY created_at DESC
  ```

#### `idx_messages_conversation_role_count`
- **Table**: `messages`
- **Columns**: `conversation_id, role`
- **Purpose**: Optimizes conversation message count queries
- **Query Pattern**: 
  ```sql
  SELECT COUNT(*) FROM messages 
  WHERE conversation_id = ? AND role = ?
  ```

#### `idx_analysis_confidence_workflow`
- **Table**: `email_analysis`
- **Columns**: `workflow_state, deep_confidence DESC`
- **Purpose**: Optimizes confidence-based workflow queries
- **Query Pattern**: 
  ```sql
  SELECT * FROM email_analysis 
  WHERE workflow_state = ? AND deep_confidence > ?
  ORDER BY deep_confidence DESC
  ```

## Performance Impact

### Expected Improvements

1. **Email Listing Queries**: 70-90% reduction in query time for paginated email lists
2. **Workflow Analytics**: 80-95% reduction in aggregation query time
3. **SLA Monitoring**: 85-95% reduction in SLA status check queries
4. **Entity Searches**: 75-90% reduction in entity lookup time
5. **User Workload Queries**: 80-90% reduction in assignment distribution queries

### Memory Usage

- **Total Index Size**: Approximately 15-20% of table data size
- **Index Maintenance**: Minimal overhead during INSERT/UPDATE operations
- **Cache Efficiency**: Improved due to more selective index scans

## Best Practices

### When to Use These Indexes

1. **High-frequency queries**: All indexed patterns are executed multiple times per minute
2. **JOIN operations**: Composite indexes significantly improve JOIN performance
3. **Sorting operations**: DESC indexes eliminate sort operations
4. **Filtering + Sorting**: Composite indexes handle both in a single scan

### Index Maintenance

1. **Regular ANALYZE**: Run `ANALYZE` after bulk data changes
2. **Monitor Performance**: Use query performance monitoring to validate improvements
3. **Review Usage**: Periodically check index usage statistics
4. **Avoid Duplication**: Don't create indexes that duplicate existing ones

### Query Optimization Tips

1. **Column Order Matters**: Place most selective columns first
2. **Use Index Hints**: SQLite automatically uses appropriate indexes
3. **Partial Indexes**: Use WHERE clauses for sparse data
4. **Covering Indexes**: Include all needed columns to avoid table lookups

## Monitoring and Validation

### Performance Metrics

Use the following queries to monitor index effectiveness:

```sql
-- Check index usage
EXPLAIN QUERY PLAN 
SELECT * FROM emails e
JOIN email_analysis ea ON e.id = ea.email_id
WHERE ea.workflow_state = 'IN_PROGRESS'
ORDER BY e.received_at DESC;

-- Analyze table statistics
ANALYZE emails;
ANALYZE email_analysis;

-- Check index sizes
SELECT 
  name,
  tbl_name,
  sql
FROM sqlite_master
WHERE type = 'index'
ORDER BY name;
```

### Testing

Run the test suite to validate index performance:

```bash
npm test -- src/database/__tests__/composite-indexes.test.ts
```

## Rollback Procedure

If indexes need to be removed:

1. Run the migration rollback:
   ```typescript
   await down(db);
   ```

2. This will drop all composite indexes created by this migration

3. Monitor performance to ensure no critical degradation

## Future Considerations

1. **Additional Indexes**: Monitor slow queries for new index opportunities
2. **Index Consolidation**: Combine overlapping indexes where possible
3. **Partitioning**: Consider table partitioning for very large datasets
4. **Materialized Views**: For complex aggregations that don't change frequently

## Related Documentation

- [Database Schema](./enhanced_schema.sql)
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)
- [Query Best Practices](./QUERY_BEST_PRACTICES.md)