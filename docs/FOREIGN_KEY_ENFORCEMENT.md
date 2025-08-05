# Foreign Key Enforcement and Data Integrity Fixes

## Overview

This document describes the implementation of foreign key constraints and data integrity fixes in the CrewAI Team SQLite database.

## Issues Addressed

1. **Foreign Key Constraints Disabled**: Foreign keys were defined in schemas but not enforced
2. **Data Integrity Issues**: ~30% of email records had negative processing times
3. **Inconsistent Database Initialization**: Some services didn't enable foreign keys

## Implementation Details

### 1. Foreign Key Enforcement

#### Services Updated

- **ConversationService** (`/src/api/services/ConversationService.ts`)
  - Added `PRAGMA foreign_keys = ON` and performance optimizations
  
- **UserService** (`/src/api/services/UserService.ts`)
  - Added `PRAGMA foreign_keys = ON` and performance optimizations

#### Already Had Foreign Keys Enabled

- **DatabaseManager** (`/src/database/DatabaseManager.ts`)
- **EmailStorageService** (`/src/api/services/EmailStorageService.ts`)
- **DealDataService** (`/src/api/services/DealDataService.ts`)
- **Connection module** (`/src/database/connection.ts`)

### 2. CHECK Constraints Added

Added CHECK constraints to prevent negative processing times:

- **EmailStorageService** schema:
  ```sql
  quick_processing_time INTEGER CHECK (quick_processing_time >= 0),
  deep_processing_time INTEGER CHECK (deep_processing_time >= 0),
  total_processing_time INTEGER CHECK (total_processing_time >= 0)
  ```

- **Enhanced Schema** (`/src/database/schema/enhanced_schema.sql`):
  ```sql
  processing_time INTEGER CHECK (processing_time >= 0)
  ```

### 3. Migration Script

Created migration `006_fix_negative_processing_times.ts` that:

1. **Fixes existing negative values** by converting to absolute values
2. **Ensures consistency** where total_time >= quick_time + deep_time
3. **Adds database triggers** to prevent future negative values
4. **Creates performance indexes** on processing_time columns

The migration handles:
- `email_analysis` table: quick/deep/total processing times
- `messages` table: processing_time column
- Zero value correction (minimum 1ms for non-null values)

### 4. Test Coverage

Created comprehensive test suite (`/src/database/__tests__/foreign-key-enforcement.test.ts`) that:

- Verifies foreign key enforcement on INSERT
- Tests CASCADE DELETE behavior
- Validates CHECK constraints for processing times
- Checks database integrity with `PRAGMA foreign_key_check`

### 5. Manual Migration Runner

Created script (`/src/database/scripts/runMigrations.ts`) to:
- Run migrations manually
- Verify database integrity
- Report statistics and violations
- Check foreign key status

## Usage

### Run Migration Manually

```bash
pnpm tsx src/database/scripts/runMigrations.ts
```

### Run Tests

```bash
pnpm test src/database/__tests__/foreign-key-enforcement.test.ts
```

## Database Integrity Queries

### Check for Negative Processing Times

```sql
SELECT 
  COUNT(*) as total_records,
  SUM(CASE WHEN quick_processing_time < 0 THEN 1 ELSE 0 END) as negative_quick,
  SUM(CASE WHEN deep_processing_time < 0 THEN 1 ELSE 0 END) as negative_deep,
  SUM(CASE WHEN total_processing_time < 0 THEN 1 ELSE 0 END) as negative_total
FROM email_analysis;
```

### Check Foreign Key Violations

```sql
PRAGMA foreign_key_check;
```

### Verify Foreign Keys Enabled

```sql
PRAGMA foreign_keys;
```

## Best Practices

1. **Always enable foreign keys** when creating database connections:
   ```typescript
   db.pragma("foreign_keys = ON");
   ```

2. **Use CHECK constraints** for data validation:
   ```sql
   column_name INTEGER CHECK (column_name >= 0)
   ```

3. **Test referential integrity** regularly using `PRAGMA foreign_key_check`

4. **Use transactions** for data migrations to ensure atomicity

5. **Create indexes** on foreign key columns for performance

## Impact

- Prevents orphaned records in the database
- Ensures data consistency across related tables
- Prevents invalid data (negative processing times)
- Improves query performance with proper indexes
- Maintains referential integrity automatically

## Next Steps

1. Monitor for any foreign key violations in production
2. Add more CHECK constraints for other data validation needs
3. Consider adding triggers for complex business rules
4. Implement regular integrity checks in monitoring