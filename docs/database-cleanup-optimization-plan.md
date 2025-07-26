# Database Cleanup and Optimization Action Plan

## Overview

This document outlines the comprehensive plan for cleaning up and optimizing the CrewAI database (`data/crewai.db`) following the successful completion of the three-stage email analysis pipeline.

## Current Database State

- **Size**: ~237MB (needs optimization)
- **Total Emails**: 33,797 analyzed emails
- **Entity Records**: 124,750 extracted entities
- **Stage Results**: 1,100 pipeline stage results
- **Processing Time**: ~6 hours for complete pipeline

## 4-Week Implementation Timeline

### Week 1: Assessment and Backup (Days 1-7)

**Objectives**: Analyze current state and create safety nets

#### Day 1-2: Database Analysis

```bash
# Analyze table sizes and row counts
sqlite3 data/crewai.db "
SELECT
    name as table_name,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
FROM sqlite_master m
WHERE type='table'
ORDER BY name;"

# Check table sizes
sqlite3 data/crewai.db "
SELECT
    name,
    SUM(pgsize) as size_bytes,
    ROUND(SUM(pgsize)/1024.0/1024.0, 2) as size_mb
FROM dbstat
GROUP BY name
ORDER BY size_bytes DESC;"

# Identify duplicate records
sqlite3 data/crewai.db "
SELECT email_hash, COUNT(*) as duplicates
FROM emails_enhanced
GROUP BY email_hash
HAVING COUNT(*) > 1;"
```

#### Day 3-4: Create Comprehensive Backups

```bash
# Create timestamped backup
cp data/crewai.db "data/backups/crewai.db.$(date +%Y%m%d_%H%M%S).pre-optimization"

# Create compressed backup
sqlite3 data/crewai.db ".backup data/backups/crewai.db.backup"
gzip -c data/backups/crewai.db.backup > "data/backups/crewai.db.$(date +%Y%m%d).sql.gz"

# Export critical data as CSV for recovery
sqlite3 data/crewai.db <<EOF
.mode csv
.output data/backups/emails_enhanced_backup.csv
SELECT * FROM emails_enhanced;
.output data/backups/email_entities_backup.csv
SELECT * FROM email_entities;
.output data/backups/stage_results_backup.csv
SELECT * FROM stage_results;
.quit
EOF
```

#### Day 5-7: Document Current Schema

```bash
# Generate schema documentation
sqlite3 data/crewai.db ".schema" > docs/database-schema-pre-optimization.sql

# Document foreign key relationships
sqlite3 data/crewai.db "PRAGMA foreign_key_list;" > docs/foreign-keys.txt
```

### Week 2: Cleanup and Deduplication (Days 8-14)

**Objectives**: Remove duplicates and clean data

#### Day 8-9: Remove Duplicate Emails

```sql
-- Create temporary table with deduplicated emails
CREATE TABLE emails_enhanced_clean AS
SELECT DISTINCT ON (email_hash) *
FROM emails_enhanced
ORDER BY email_hash, updated_at DESC;

-- Verify counts
SELECT COUNT(*) as original FROM emails_enhanced;
SELECT COUNT(*) as cleaned FROM emails_enhanced_clean;

-- Replace original table
DROP TABLE emails_enhanced;
ALTER TABLE emails_enhanced_clean RENAME TO emails_enhanced;
```

#### Day 10-11: Clean Orphaned Records

```sql
-- Remove orphaned entities
DELETE FROM email_entities
WHERE email_id NOT IN (SELECT id FROM emails_enhanced);

-- Remove orphaned stage results
DELETE FROM stage_results
WHERE email_id NOT IN (SELECT id FROM emails_enhanced);

-- Remove orphaned analysis records
DELETE FROM email_analysis
WHERE email_id NOT IN (SELECT id FROM emails_enhanced);
```

#### Day 12-14: Data Normalization

```sql
-- Normalize entity types
UPDATE email_entities
SET entity_type = LOWER(TRIM(entity_type));

-- Standardize workflow states
UPDATE emails_enhanced
SET workflow_state = UPPER(TRIM(workflow_state))
WHERE workflow_state IS NOT NULL;

-- Clean whitespace from all text fields
UPDATE emails_enhanced
SET
    subject = TRIM(subject),
    sender = TRIM(LOWER(sender)),
    thread_id = TRIM(thread_id);
```

### Week 3: Performance Optimization (Days 15-21)

**Objectives**: Optimize queries and add indexes

#### Day 15-16: Create Missing Indexes

```sql
-- Performance-critical indexes
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails_enhanced(thread_id);
CREATE INDEX IF NOT EXISTS idx_emails_workflow_state ON emails_enhanced(workflow_state);
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails_enhanced(priority);
CREATE INDEX IF NOT EXISTS idx_emails_sent_date ON emails_enhanced(sent_date);
CREATE INDEX IF NOT EXISTS idx_entities_email_type ON email_entities(email_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_stage_results_stage_email ON stage_results(stage, email_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emails_sender_date ON emails_enhanced(sender, sent_date);
CREATE INDEX IF NOT EXISTS idx_emails_state_priority ON emails_enhanced(workflow_state, priority);
```

#### Day 17-18: Optimize Table Structure

```sql
-- Add query optimization hints
ANALYZE emails_enhanced;
ANALYZE email_entities;
ANALYZE stage_results;

-- Vacuum to reclaim space
VACUUM;

-- Rebuild statistics
ANALYZE;
```

#### Day 19-21: Create Materialized Views

```sql
-- High-priority email summary view
CREATE VIEW IF NOT EXISTS v_high_priority_emails AS
SELECT
    e.*,
    COUNT(DISTINCT ee.entity_type) as entity_types,
    COUNT(ee.id) as total_entities
FROM emails_enhanced e
LEFT JOIN email_entities ee ON e.id = ee.email_id
WHERE e.priority IN ('Critical', 'High')
GROUP BY e.id;

-- Workflow performance view
CREATE VIEW IF NOT EXISTS v_workflow_performance AS
SELECT
    workflow_state,
    COUNT(*) as email_count,
    AVG(JULIANDAY(updated_at) - JULIANDAY(sent_date)) as avg_processing_days
FROM emails_enhanced
GROUP BY workflow_state;
```

### Week 4: Monitoring and Validation (Days 22-28)

**Objectives**: Implement monitoring and validate results

#### Day 22-23: Implement Query Performance Monitoring

```python
# src/database/performance-monitor.ts
import { Database } from 'better-sqlite3';

export class PerformanceMonitor {
    private db: Database;

    async trackQueryPerformance(query: string) {
        const start = Date.now();
        const result = await this.db.prepare(query).all();
        const duration = Date.now() - start;

        // Log slow queries
        if (duration > 1000) {
            console.warn(`Slow query detected (${duration}ms): ${query}`);
        }

        return { result, duration };
    }
}
```

#### Day 24-25: Create Health Check Scripts

```bash
#!/bin/bash
# scripts/db-health-check.sh

echo "=== Database Health Check ==="
echo "Database size: $(du -h data/crewai.db | cut -f1)"
echo "Email count: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM emails_enhanced;')"
echo "Entity count: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM email_entities;')"
echo "Duplicate check: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM (SELECT email_hash, COUNT(*) as c FROM emails_enhanced GROUP BY email_hash HAVING c > 1);')"
```

#### Day 26-28: Final Validation and Documentation

```typescript
// src/scripts/validate-optimization.ts
async function validateOptimization() {
  const metrics = {
    sizeBefore: 237, // MB
    sizeAfter: 0,
    querySpeedImprovement: 0,
    duplicatesRemoved: 0,
    orphansRemoved: 0,
  };

  // Run validation queries
  // Generate final report
  console.log("Optimization Complete:", metrics);
}
```

## Configuration Changes

### 1. Database Connection Settings

```typescript
// src/config/database.config.ts
export const databaseConfig = {
  filename: "data/crewai.db",
  options: {
    // Enable Write-Ahead Logging for better concurrency
    pragma: {
      journal_mode: "WAL",
      synchronous: "NORMAL",
      cache_size: -64000, // 64MB cache
      mmap_size: 268435456, // 256MB memory map
      page_size: 4096,
      temp_store: "MEMORY",
    },
  },
};
```

### 2. Query Timeout Settings

```typescript
// src/database/config.ts
export const queryConfig = {
  defaultTimeout: 30000, // 30 seconds
  slowQueryThreshold: 1000, // 1 second
  maxRetries: 3,
  retryDelay: 1000,
};
```

### 3. Backup Configuration

```typescript
// src/config/backup.config.ts
export const backupConfig = {
  schedule: "0 2 * * *", // Daily at 2 AM
  retention: 30, // Keep 30 days of backups
  compression: true,
  location: "data/backups/",
};
```

## Success Metrics and KPIs

### Performance KPIs

1. **Database Size Reduction**: Target 30-40% reduction (237MB → ~150MB)
2. **Query Performance**: 50% improvement in average query time
3. **Duplicate Removal**: 100% elimination of duplicate emails
4. **Index Coverage**: 100% of frequent queries covered by indexes

### Data Quality KPIs

1. **Entity Accuracy**: Maintain 90% accuracy post-cleanup
2. **Referential Integrity**: 0 orphaned records
3. **Data Consistency**: 100% standardized formats

### Operational KPIs

1. **Backup Success Rate**: 100% daily backups
2. **Recovery Time**: < 5 minutes for full restore
3. **Monitoring Coverage**: 100% of critical queries monitored

## Risk Mitigation Strategies

### 1. Data Loss Prevention

- **Multiple Backup Layers**: Local, compressed, and CSV exports
- **Incremental Changes**: Apply changes in stages with validation
- **Rollback Plan**: Scripts ready for immediate restoration

### 2. Performance Degradation

- **Query Analysis**: Test all changes in staging first
- **Gradual Rollout**: Implement indexes one at a time
- **Performance Baselines**: Document current query times

### 3. Application Compatibility

- **Schema Versioning**: Track all schema changes
- **Backward Compatibility**: Maintain views for legacy queries
- **Testing Suite**: Run full test suite after each change

## Immediate Implementation Commands

### Phase 1: Quick Wins (Execute Now)

```bash
# 1. Create backup directory
mkdir -p data/backups

# 2. Initial backup
cp data/crewai.db "data/backups/crewai.db.$(date +%Y%m%d_%H%M%S).pre-optimization"

# 3. Basic cleanup
sqlite3 data/crewai.db "VACUUM;"

# 4. Add critical indexes
sqlite3 data/crewai.db "
CREATE INDEX IF NOT EXISTS idx_emails_hash ON emails_enhanced(email_hash);
CREATE INDEX IF NOT EXISTS idx_entities_email ON email_entities(email_id);
"
```

### Phase 2: Monitoring Setup

```bash
# Create monitoring script
cat > scripts/monitor-db-performance.sh << 'EOF'
#!/bin/bash
while true; do
    echo "$(date): Size=$(du -h data/crewai.db | cut -f1)"
    sqlite3 data/crewai.db "SELECT 'Emails:', COUNT(*) FROM emails_enhanced;"
    sleep 3600
done
EOF

chmod +x scripts/monitor-db-performance.sh
```

## Post-Optimization Pipeline Re-execution

After database cleanup, re-run the three-stage pipeline:

```bash
# 1. Verify Ollama models are loaded
ollama list

# 2. Run optimized pipeline
npm run pipeline:execute -- --optimized

# 3. Monitor progress
npm run pipeline:monitor

# 4. Validate results
npm run pipeline:validate
```

## Expected Outcomes

1. **Storage**: 30-40% reduction in database size
2. **Performance**: 2-3x faster query execution
3. **Reliability**: Zero data loss, improved consistency
4. **Maintainability**: Automated monitoring and backups
5. **Scalability**: Ready for 100k+ emails

## Next Steps

1. Review and approve this plan
2. Execute Week 1 assessment tasks
3. Create staging environment for testing
4. Begin incremental implementation
5. Document all changes in CHANGELOG.md

---

_This optimization plan ensures data safety while significantly improving performance and maintainability of the CrewAI email analysis system._
