# Schema Usage Tracking

This document tracks which scripts and components use which database schemas and tables.

## Quick Reference Matrix - V2.0 (Enhanced Schema)

| Script/Component                    | Database           | Tables Used                                          | Schema Version | Status          |
| ----------------------------------- | ------------------ | ---------------------------------------------------- | -------------- | --------------- |
| **New Enhanced Pipeline**           |
| create-enhanced-email-schema        | crewai_enhanced.db | emails_enhanced, email_recipients, email_attachments | v3.0           | ✅ Current      |
| import-emails-with-full-data        | crewai_enhanced.db | emails_enhanced, email_recipients, email_attachments | v3.0           | ✅ Current      |
| process-emails-by-conversation      | crewai_enhanced.db | emails_enhanced                                      | v3.0           | ✅ Current      |
| **Legacy Pipeline**                 |
| EmailChainAnalyzer                  | crewai.db          | emails                                               | v2             | ⚠️ Deprecated   |
| EmailRepositoryImpl                 | crewai.db          | emails                                               | v2             | ⚠️ Deprecated   |
| EmailThreePhaseAnalysisService      | crewai.db          | emails                                               | v2             | ⚠️ Needs Update |
| analyze-and-process-full-dataset-v2 | crewai.db          | emails                                               | v2             | ⚠️ Deprecated   |

## Detailed Script Mapping

### Enhanced Pipeline Scripts (Current)

#### `/scripts/create-enhanced-email-schema.ts`

- **Database**: crewai_enhanced.db (creates new)
- **Tables Created**:
  - emails_enhanced (full Microsoft Graph fields)
  - email_recipients (normalized to/cc/bcc)
  - email_attachments (attachment metadata)
- **Key Features**:
  - Preserves all Microsoft Graph API fields
  - Uses native conversationId
  - Maintains complete timestamps
- **Status**: ✅ Production Ready

#### `/scripts/import-emails-with-full-data.ts`

- **Database**: crewai_enhanced.db
- **Tables Used**: emails_enhanced, email_recipients, email_attachments
- **Handles**:
  - Simplified email format (May-July batches)
  - Microsoft Graph format (missing-emails batches)
  - Parses JSON arrays in to_addresses
  - Generates conversation IDs for simplified emails
- **Status**: ✅ Production Ready

#### `/scripts/process-emails-by-conversation.ts`

- **Database**: crewai_enhanced.db
- **Tables Used**: emails_enhanced
- **Features**:
  - Groups by Microsoft's conversationId
  - Analyzes conversation completeness
  - Applies adaptive three-phase analysis
  - Updates chain analysis results
- **Status**: ✅ Production Ready

### Legacy Services (Deprecated)

#### `/src/core/services/EmailChainAnalyzer.ts`

- **Database**: crewai.db
- **Tables**: emails
- **Schema Issues**:
  - Uses manual conversation detection
  - Relies on subject-based grouping
  - Missing Microsoft metadata
- **Status**: ⚠️ DEPRECATED - Use process-emails-by-conversation.ts

#### `/src/core/services/EmailThreePhaseAnalysisService.ts`

- **Database**: crewai.db
- **Tables**: emails, email_analysis
- **Schema Expectations**:
  - Expects `from_address`, `message_id` (new schema)
  - Writes to `email_analysis` table
- **Status**: Compatible with new schema

#### `/src/core/services/ActionItemExtractor.ts`

- **Database**: crewai.db
- **Tables**: action_items
- **Schema Expectations**:
  - Creates action items linked to email_id
- **Status**: Schema stable

### Repository Layer

#### `/src/database/repositories/EmailRepositoryImpl.ts`

- **Database**: crewai.db
- **Tables**: emails
- **Schema Mapping**:
  ```typescript
  mapRowToEntity(row: any): EmailRecord {
    return {
      message_id: row.message_id,      // New column name
      from_address: row.from_address,  // New column name
      // ... other mappings
    };
  }
  ```
- **Status**: Fully compatible with new schema

#### `/src/core/database/repositories/EmailRepository.ts`

- **Database**: crewai.db
- **Tables**: emails
- **Schema Mapping**:
  ```typescript
  interface EmailEntity {
    graph_id?: string; // Old column name
    sender_email: string; // Old column name
    // ...
  }
  ```
- **Status**: NEEDS MIGRATION - Uses old column names

### Processing Scripts

#### `/scripts/analyze-and-process-full-dataset-v2.ts`

- **Database**: crewai.db
- **Tables**: All (emails, email_analysis, action_items, workflow_templates)
- **Schema Expectations**:
  - Uses EmailRepositoryImpl (new schema)
  - Creates all analysis tables
- **Status**: Ready after schema migration

#### `/scripts/analyze-email-chains.ts`

- **Database**: crewai.db
- **Tables**: emails
- **Schema Expectations**:
  - Uses EmailChainAnalyzer
  - Indirect schema usage
- **Status**: Will work after EmailChainAnalyzer update

### Migration Scripts

#### `/scripts/fix-email-schema-now.ts`

- **Purpose**: Migrate schema from v1 to v2
- **Changes**:
  - `sender_email` → `from_address`
  - `graph_id` → `message_id`
- **Status**: Ready to execute

#### `/scripts/validate-email-migration.ts`

- **Purpose**: Validate schema after migration
- **Checks**: Column names, data integrity, record counts
- **Status**: Ready to use

### UI Components

#### `/src/ui/components/Email/*`

- **API Layer**: Uses tRPC endpoints
- **Schema Dependency**: Indirect through API
- **Expected Fields**:
  - `from_address` (displayed as "From")
  - `message_id` (used as unique key)
- **Status**: Compatible with new schema

## Schema Version Detection

To detect which schema version is in use:

```typescript
// Check for old schema
const hasOldSchema = columns.some((c) => c.name === "sender_email");

// Check for new schema
const hasNewSchema = columns.some((c) => c.name === "from_address");
```

## Migration Path to Enhanced Schema

### Step 1: Backup Existing Data

```bash
cp data/crewai.db data/crewai.db.backup-$(date +%Y%m%d)
```

### Step 2: Create Enhanced Database

```bash
npx tsx scripts/create-enhanced-email-schema.ts
```

### Step 3: Import All Emails with Full Data

```bash
npx tsx scripts/import-emails-with-full-data.ts
```

### Step 4: Process Emails by Conversation

```bash
npx tsx scripts/process-emails-by-conversation.ts
```

### Step 5: Update Services to Use Enhanced Schema

1. **EmailThreePhaseAnalysisService** - Point to crewai_enhanced.db:

   ```typescript
   // Old
   const db = new Database("./data/crewai.db");

   // New
   const db = new Database("./data/crewai_enhanced.db");
   ```

2. **UI Components** - Update API endpoints to use enhanced database

### Scripts to Deprecate

- `/scripts/analyze-and-process-full-dataset-v2.ts` ❌
- `/scripts/fix-email-schema-now.ts` ❌
- `/scripts/direct-email-processing.ts` ❌
- `/scripts/process-emails-without-conversation-ids.ts` ❌

## Testing Schema Compatibility

### Pre-Migration Testing

```bash
# Test current schema
npm run db:status

# Run diagnostic
npx tsx scripts/diagnose-schema-issue.ts
```

### Post-Migration Testing

```bash
# Validate migration
npx tsx scripts/validate-email-migration.ts

# Test key components
npm run test:email-repository
npm run test:email-analyzer
```

## Rollback Procedures

If migration fails:

1. **Immediate Rollback**:

   ```bash
   sqlite3 data/crewai.db < scripts/rollback-email-schema.sql
   ```

2. **Restore from Backup**:
   ```bash
   cp data/crewai.db.backup data/crewai.db
   ```

## Version Control

### Schema Version Markers

Each analysis result includes schema version:

```json
{
  "analysis_version": "v2.1.0",
  "schema_version": "v2",
  "processed_at": "2024-01-31T10:00:00Z"
}
```

### Git Tags for Schema Changes

- `schema-v1` - Original schema
- `schema-v2` - After column rename migration
- `schema-v3` - Future enhanced schema

## Monitoring Schema Usage

### Query to Find Schema Dependencies

```sql
-- Find scripts using specific columns
SELECT DISTINCT sql
FROM sqlite_master
WHERE sql LIKE '%sender_email%'
   OR sql LIKE '%graph_id%';
```

### Logging Schema Access

All repositories log schema access:

```typescript
logger.info("Schema access", {
  table: "emails",
  columns: ["message_id", "from_address"],
  version: "v2",
});
```

## Key Benefits of Enhanced Schema

### Data Integrity

- **No Data Loss**: All JSON fields preserved
- **Native Threading**: Microsoft's conversationId maintained
- **Complete Metadata**: All timestamps, flags, and properties

### Better Analysis

- **Accurate Chains**: Real conversation grouping
- **Rich Context**: Full recipient names and roles
- **Attachment Tracking**: Complete file metadata

### Performance

- **Optimized Indexes**: Better query performance
- **Normalized Data**: Efficient storage
- **Batch Processing**: Conversation-based grouping

## Future Considerations

### Potential Enhancements

1. **Email Content Search**
   - Full-text search indexes
   - Vector embeddings for semantic search

2. **Advanced Analytics**
   - Time-series analysis tables
   - Aggregated metrics views

3. **Integration Tables**
   - CRM sync tracking
   - External system mappings

### Maintenance Schedule

- Weekly: Verify import integrity
- Monthly: Analyze query performance
- Quarterly: Review schema usage

---

Last Updated: January 31, 2025
Schema Version: 3.0 (Enhanced)
Maintained By: Data Engineering Team
