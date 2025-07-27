# Database Migrations Guide

## Overview

This guide explains how to run database migrations for the CrewAI Team project, including the new composite indexes for email analytics performance optimization.

## Migration Commands

### Check Current Migration Status

```bash
npm run db:status
```

This command shows:
- Current database version
- Applied migrations
- Pending migrations

### Run All Pending Migrations

```bash
npm run db:migrate
```

This applies all pending migrations in order, including:
- Migration 6: Fix negative processing times
- Migration 7: Add composite indexes for performance optimization

### Run Migrations Up to a Specific Version

```bash
npm run db:migrate 7
```

This runs all migrations up to and including version 7.

### Rollback Migrations

```bash
npm run db:rollback 6
```

This rolls back all migrations after version 6, effectively removing the composite indexes.

### Rollback All Migrations

```bash
npm run db:rollback 0
```

This removes all applied migrations.

## Migration Details

### Migration 7: Composite Indexes

This migration adds 23 composite indexes to optimize common query patterns:

- **Email Table View Indexes**: Optimize email listing with filtering and sorting
- **Email Analysis Indexes**: Optimize workflow analytics and SLA monitoring
- **Enhanced Email Indexes**: Optimize user workload and priority queries
- **Entity Extraction Indexes**: Optimize entity searches with confidence scoring
- **Conversation/Message Indexes**: Optimize conversation and message retrieval
- **Performance Analytics Indexes**: Optimize processing time analysis
- **Audit/Activity Log Indexes**: Optimize audit trail queries

## Performance Impact

Expected improvements after applying the composite indexes:

- **Email Listing**: 70-90% faster query execution
- **Workflow Analytics**: 80-95% faster aggregation queries
- **SLA Monitoring**: 85-95% faster status checks
- **Entity Searches**: 75-90% faster lookups
- **User Workload**: 80-90% faster distribution queries

## Testing the Indexes

Run the composite index tests:

```bash
npm test -- src/database/__tests__/composite-indexes.test.ts
```

This validates:
- All indexes are created successfully
- Query plans use the appropriate indexes
- Performance benchmarks meet expectations

## Backup and Recovery

### Automatic Backups

The migration runner automatically creates a backup before applying migrations:

```
database.db.backup_[timestamp]
```

### Manual Backup

Before running migrations in production:

```bash
cp data/database.db data/database.db.manual_backup
```

### Recovery from Backup

If migrations fail:

```bash
cp data/database.db.backup_[timestamp] data/database.db
```

## Monitoring Index Usage

### Check Query Performance

After applying migrations, monitor query performance:

```sql
-- Check if indexes are being used
EXPLAIN QUERY PLAN 
SELECT * FROM emails e
JOIN email_analysis ea ON e.id = ea.email_id
WHERE ea.workflow_state = 'IN_PROGRESS'
ORDER BY e.received_at DESC;
```

### Update Statistics

For optimal query planning:

```sql
ANALYZE emails;
ANALYZE email_analysis;
ANALYZE emails_enhanced;
```

## Troubleshooting

### Migration Fails

1. Check the error message in the console
2. Review the backup created before migration
3. Use `npm run db:rollback` to revert if needed
4. Fix the issue and retry

### Performance Not Improved

1. Run `ANALYZE` on affected tables
2. Check query plans with `EXPLAIN QUERY PLAN`
3. Verify indexes exist with:
   ```sql
   SELECT name FROM sqlite_master WHERE type = 'index';
   ```

### Database Locked

If you get "database is locked" errors:

1. Ensure no other processes are accessing the database
2. Check for long-running queries
3. Restart the application if necessary

## Best Practices

1. **Always backup before migrations** - Automatic backups are created, but manual backups are recommended for production
2. **Test in development first** - Run migrations on a development database before production
3. **Monitor after migration** - Check query performance and application behavior
4. **Document custom migrations** - If you add new migrations, update this guide

## Related Documentation

- [Composite Indexes Documentation](./COMPOSITE_INDEXES_OPTIMIZATION.md)
- [Database Schema](../src/database/schema/enhanced_schema.sql)
- [Performance Optimization Guide](./PERFORMANCE_OPTIMIZATION.md)