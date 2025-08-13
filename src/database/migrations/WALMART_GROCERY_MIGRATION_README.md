# Walmart Grocery Database Migration: Add due_date Column

This comprehensive migration package adds a `due_date` column to the `grocery_lists` table in the `walmart_grocery.db` database. The migration is production-safe with complete backup, rollback, and testing capabilities.

## 📋 Overview

- **Migration Version**: 016
- **Target Table**: `grocery_lists`
- **Changes**: Adds `due_date DATETIME` column with proper indexing
- **Data Loss Risk**: ❌ None (column is nullable)
- **Rollback Support**: ✅ Full rollback capability
- **Backup Required**: ✅ Automatic backup creation

## 🚀 Quick Start

### Option 1: Shell Script (Recommended for Production)
```bash
# Test the migration first (safe)
./src/database/migrations/run_due_date_migration.sh --dry-run

# Apply the migration
./src/database/migrations/run_due_date_migration.sh

# Rollback if needed
./src/database/migrations/run_due_date_migration.sh --rollback
```

### Option 2: Direct SQL Execution
```bash
# Create backup first
cp data/walmart_grocery.db data/walmart_grocery_backup.db

# Apply migration
sqlite3 data/walmart_grocery.db < src/database/migrations/016_add_due_date_column.sql
```

### Option 3: TypeScript Migration System
```bash
# Run comprehensive tests
npx ts-node src/database/migrations/test_due_date_migration.ts

# Apply with TypeScript migration runner
npx ts-node src/database/migrations/walmart_grocery_due_date_migration.ts
```

## 📁 Migration Files

| File | Purpose | Usage |
|------|---------|--------|
| `016_add_due_date_to_grocery_lists.ts` | TypeScript migration for framework | Used by DatabaseMigrator |
| `016_add_due_date_column.sql` | Raw SQL migration | Direct sqlite3 execution |
| `walmart_grocery_due_date_migration.ts` | Standalone migration tool | Full-featured migration runner |
| `test_due_date_migration.ts` | Comprehensive test suite | Pre-migration validation |
| `run_due_date_migration.sh` | Shell script wrapper | Production deployment |

## 🔧 What This Migration Does

### Schema Changes
1. **Adds Column**: `due_date DATETIME DEFAULT NULL` to `grocery_lists` table
2. **Creates Indexes**:
   - `idx_grocery_lists_due_date`: For due date filtering
   - `idx_grocery_lists_user_due_date`: For user + due date queries  
   - `idx_grocery_lists_active_due_date`: For active lists with due dates

### Performance Optimizations
- Partial indexes (WHERE conditions) for optimal storage and performance
- Compound indexes for common query patterns
- No impact on existing queries or data

## 📊 Before vs After Schema

### Before Migration
```sql
CREATE TABLE grocery_lists (
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
```

### After Migration
```sql
CREATE TABLE grocery_lists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    total_items INTEGER DEFAULT 0,
    estimated_total REAL,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME DEFAULT NULL  -- ✨ NEW COLUMN
);

-- ✨ NEW INDEXES
CREATE INDEX idx_grocery_lists_due_date ON grocery_lists(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_grocery_lists_user_due_date ON grocery_lists(user_id, due_date) WHERE due_date IS NOT NULL;  
CREATE INDEX idx_grocery_lists_active_due_date ON grocery_lists(is_active, due_date) WHERE is_active = 1 AND due_date IS NOT NULL;
```

## 🧪 Testing & Validation

### Automated Test Suite
Run the comprehensive test suite before applying to production:

```bash
npx ts-node src/database/migrations/test_due_date_migration.ts
```

**Test Coverage:**
- ✅ Pre-migration state validation
- ✅ Migration application
- ✅ Column creation verification
- ✅ Index creation verification  
- ✅ Insert functionality (with/without due_date)
- ✅ Update functionality
- ✅ Query performance testing
- ✅ Database integrity validation

### Manual Verification Commands

```sql
-- Check if column exists (should return 1 after migration)
SELECT COUNT(*) FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';

-- Check column properties
SELECT name, type, "notnull", dflt_value FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';

-- Verify indexes were created (should return 3 due_date indexes)
SELECT name FROM pragma_index_list('grocery_lists') WHERE name LIKE '%due_date%';

-- Test functionality
INSERT INTO grocery_lists (id, user_id, name, due_date) VALUES ('test-001', 'user-001', 'Test List', datetime('now', '+7 days'));
SELECT id, name, due_date FROM grocery_lists WHERE id = 'test-001';
DELETE FROM grocery_lists WHERE id = 'test-001';
```

## 📖 Usage Examples

### Setting Due Dates

```sql
-- Set due date for existing list
UPDATE grocery_lists 
SET due_date = datetime('now', '+7 days') 
WHERE id = 'list-123';

-- Create new list with due date
INSERT INTO grocery_lists (id, user_id, name, due_date) 
VALUES ('new-list', 'user-456', 'Weekly Shopping', datetime('now', '+3 days'));
```

### Querying with Due Dates

```sql
-- Find lists due in next 7 days
SELECT id, name, due_date 
FROM grocery_lists 
WHERE due_date BETWEEN datetime('now') AND datetime('now', '+7 days')
ORDER BY due_date ASC;

-- Find overdue lists
SELECT id, name, due_date 
FROM grocery_lists 
WHERE due_date < datetime('now') AND is_active = 1
ORDER BY due_date ASC;

-- Find user's upcoming lists
SELECT id, name, due_date 
FROM grocery_lists 
WHERE user_id = 'user-123' AND due_date > datetime('now')
ORDER BY due_date ASC;

-- Lists with no due date
SELECT id, name 
FROM grocery_lists 
WHERE due_date IS NULL AND is_active = 1;
```

### Application Integration

```javascript
// TypeScript/JavaScript examples
const upcomingLists = await db.prepare(`
  SELECT id, name, due_date 
  FROM grocery_lists 
  WHERE user_id = ? AND due_date BETWEEN datetime('now') AND datetime('now', '+7 days')
  ORDER BY due_date ASC
`).all(userId);

const overdueLists = await db.prepare(`
  SELECT id, name, due_date,
    CAST((julianday('now') - julianday(due_date)) AS INTEGER) as days_overdue
  FROM grocery_lists 
  WHERE user_id = ? AND due_date < datetime('now') AND is_active = 1
  ORDER BY due_date ASC
`).all(userId);
```

## 🔒 Safety Features

### Backup Strategy
- **Automatic Backup**: Created before migration with timestamp
- **Integrity Check**: Backup verified before proceeding
- **Rollback Ready**: Backup can be restored if issues occur

### Error Handling
- **Transaction Wrapped**: All changes in single transaction
- **Verification**: Post-migration verification of all changes
- **Graceful Failures**: Clear error messages and cleanup

### Production Safety
- **Non-Breaking**: Existing code continues to work unchanged
- **No Data Loss**: All existing data preserved
- **Reversible**: Complete rollback capability

## 🔄 Rollback Process

If you need to rollback the migration:

### Option 1: Automatic Rollback
```bash
./src/database/migrations/run_due_date_migration.sh --rollback
```

### Option 2: Manual Backup Restore
```bash
# If you have a backup file
cp data/walmart_grocery_backup.db data/walmart_grocery.db
```

### Option 3: Manual Rollback SQL
```sql
BEGIN TRANSACTION;

-- Create temp table without due_date
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

-- Copy data (excluding due_date)
INSERT INTO grocery_lists_temp SELECT 
  id, user_id, name, description, total_items, 
  estimated_total, is_active, created_at, updated_at
FROM grocery_lists;

-- Replace original table
DROP TABLE grocery_lists;
ALTER TABLE grocery_lists_temp RENAME TO grocery_lists;

-- Recreate original indexes
CREATE INDEX idx_grocery_lists_user ON grocery_lists(user_id);

COMMIT;
```

## 🚨 Important Notes

### Before Migration
1. **Backup Required**: Always backup before production migration
2. **Test First**: Run dry-run or test suite to validate
3. **Maintenance Window**: Consider scheduling during low traffic
4. **Dependencies**: Ensure no active connections during migration

### After Migration
1. **Verify Success**: Run verification queries
2. **Update Application**: Deploy application changes that use due_date
3. **Monitor Performance**: Check query performance with new indexes
4. **User Training**: Update documentation and train users

### Considerations
- **Storage Impact**: Minimal - one DATETIME column per row
- **Performance Impact**: Positive - new indexes improve query performance  
- **Backward Compatibility**: 100% - existing queries unchanged
- **Forward Compatibility**: Ready for future due date features

## 🛠️ Troubleshooting

### Common Issues

#### "Column already exists"
```bash
# Check current state
sqlite3 data/walmart_grocery.db "SELECT COUNT(*) FROM pragma_table_info('grocery_lists') WHERE name = 'due_date';"

# If returns 1, migration already applied
```

#### "Database is locked"
```bash
# Stop applications using the database
# Wait for connections to close
# Retry migration
```

#### "Backup creation failed"
```bash
# Check disk space
df -h

# Check permissions
ls -la data/

# Verify database integrity
sqlite3 data/walmart_grocery.db "PRAGMA integrity_check;"
```

### Recovery Steps

#### Migration Failed Halfway
```bash
# Restore from backup
cp data/walmart_grocery_backup_*.db data/walmart_grocery.db

# Check integrity
sqlite3 data/walmart_grocery.db "PRAGMA integrity_check;"

# Retry migration after fixing issue
```

#### Performance Issues After Migration
```sql
-- Check if indexes were created
SELECT name FROM pragma_index_list('grocery_lists') WHERE name LIKE '%due_date%';

-- Analyze query performance
EXPLAIN QUERY PLAN SELECT * FROM grocery_lists WHERE due_date > datetime('now');

-- Update table statistics
ANALYZE grocery_lists;
```

## 📞 Support

If you encounter issues during migration:

1. **Check Logs**: Review migration output for specific error messages
2. **Verify Environment**: Ensure sqlite3 is installed and accessible
3. **Check Permissions**: Verify read/write access to database file
4. **Backup Status**: Confirm backup was created successfully
5. **Database State**: Run verification queries to understand current state

## 📋 Migration Checklist

### Pre-Migration
- [ ] Database backup created
- [ ] Backup integrity verified
- [ ] Dry run completed successfully
- [ ] Test suite passed
- [ ] Maintenance window scheduled
- [ ] Team notified

### During Migration
- [ ] Migration script executed
- [ ] No errors reported
- [ ] Verification queries passed
- [ ] Database integrity confirmed
- [ ] Performance checks completed

### Post-Migration
- [ ] Application deployed with due_date support
- [ ] End-to-end testing completed
- [ ] User documentation updated
- [ ] Monitoring alerts configured
- [ ] Team training completed

---

**Migration Package Created**: 2025-08-07  
**Version**: 016  
**Author**: Claude Code  
**Tested**: ✅ Comprehensive test suite included  
**Production Ready**: ✅ Full backup and rollback support