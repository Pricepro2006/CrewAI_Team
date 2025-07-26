# SQLite Migration Best Practices 2025

## Overview
This document contains researched best practices for SQLite migration and optimization for large datasets (30,000+ records) based on 2025 standards and better-sqlite3 implementation patterns.

## Key Performance Optimizations

### 1. Write-Ahead Logging (WAL) Mode
```javascript
db.pragma('journal_mode = WAL');
```
- Significantly enhances concurrent read and write performance
- Critical for web applications and multi-threaded access
- Reduces database locking issues

### 2. Database Pragmas for Performance
```javascript
// Performance optimizations
db.pragma('synchronous = NORMAL');      // Faster commits while maintaining safety
db.pragma('cache_size = 10000');        // 10MB cache
db.pragma('temp_store = MEMORY');       // Use memory for temporary tables
db.pragma('mmap_size = 268435456');     // 256MB memory map
db.pragma('foreign_keys = ON');         // Maintain referential integrity
db.pragma('busy_timeout = 30000');      // 30 seconds timeout for locked database
```

### 3. Transaction Management for Bulk Operations
```javascript
const insertMany = db.transaction((emails) => {
  for (const email of emails) {
    insertEmail.run(email);
  }
});

// Process in batches of 1000 for optimal performance
const BATCH_SIZE = 1000;
for (let i = 0; i < allEmails.length; i += BATCH_SIZE) {
  const batch = allEmails.slice(i, i + BATCH_SIZE);
  insertMany(batch);
}
```

### 4. Prepared Statements with Permanent Binding
```javascript
// Prepare statements once and reuse
const insertEmail = db.prepare(`
  INSERT INTO emails (
    id, graph_id, subject, sender_email, sender_name,
    received_at, body_preview, body, has_attachments
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAnalysis = db.prepare(`
  INSERT INTO email_analysis (
    id, email_id, quick_workflow, quick_priority,
    entities_po_numbers, entities_quote_numbers,
    workflow_state, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
```

### 5. Prevent WAL Checkpoint Starvation
```javascript
// Monitor WAL file size and force checkpoints if needed
setInterval(() => {
  fs.stat('data/app.db-wal', (err, stat) => {
    if (err) {
      if (err.code !== 'ENOENT') throw err;
    } else if (stat.size > 50 * 1024 * 1024) { // 50MB threshold
      db.pragma('wal_checkpoint(RESTART)');
    }
  });
}, 30000).unref(); // Check every 30 seconds
```

## Migration Strategy for Large Datasets

### 1. Incremental Loading Pattern
```javascript
class IncrementalMigration {
  constructor(sourceDb, targetDb, batchSize = 1000) {
    this.sourceDb = sourceDb;
    this.targetDb = targetDb;
    this.batchSize = batchSize;
  }

  async migrate() {
    const totalCount = this.sourceDb
      .prepare('SELECT COUNT(*) as count FROM emails_enhanced')
      .get().count;

    const insertBatch = this.targetDb.transaction((emails) => {
      for (const email of emails) {
        // Insert into target database
        this.insertEmail(email);
        this.insertAnalysis(email);
      }
    });

    // Process in chunks
    for (let offset = 0; offset < totalCount; offset += this.batchSize) {
      const emails = this.sourceDb
        .prepare(`
          SELECT * FROM emails_enhanced 
          ORDER BY id 
          LIMIT ? OFFSET ?
        `)
        .all(this.batchSize, offset);

      insertBatch(emails);
      
      // Log progress
      const progress = ((offset + emails.length) / totalCount * 100).toFixed(1);
      console.log(`Migration progress: ${progress}%`);
    }
  }
}
```

### 2. Parallel Processing with Worker Threads
```javascript
const { Worker } = require('worker_threads');
const os = require('os');

// Master thread manages work distribution
const queue = [];
const workers = new Array(os.availableParallelism()).fill(null).map(() => {
  return new Worker('./migration-worker.js');
});

// Worker processes batches independently
function distributeBatches(totalEmails, batchSize) {
  const batches = Math.ceil(totalEmails / batchSize);
  const batchesPerWorker = Math.ceil(batches / workers.length);
  
  workers.forEach((worker, index) => {
    const start = index * batchesPerWorker * batchSize;
    const end = Math.min(start + (batchesPerWorker * batchSize), totalEmails);
    
    worker.postMessage({
      command: 'migrate',
      offset: start,
      limit: end - start
    });
  });
}
```

### 3. Schema Migration Pattern
```javascript
// For schema changes not supported by ALTER TABLE
const migrateSchema = db.transaction(() => {
  // Create new table with updated schema
  db.exec(`
    CREATE TABLE emails_new (
      id INTEGER PRIMARY KEY,
      graph_id TEXT UNIQUE,
      -- new columns
      workflow_state TEXT DEFAULT 'imported',
      analysis_version INTEGER DEFAULT 1,
      -- existing columns
      subject TEXT,
      sender_email TEXT,
      -- ... rest of schema
    )
  `);

  // Copy data with transformations
  db.exec(`
    INSERT INTO emails_new (id, graph_id, subject, sender_email)
    SELECT id, graph_id, subject, sender_email
    FROM emails
  `);

  // Swap tables
  db.exec('DROP TABLE emails');
  db.exec('ALTER TABLE emails_new RENAME TO emails');
});

migrateSchema();
```

## Performance Benchmarks

Based on better-sqlite3 benchmarks:
- **Individual inserts**: 62,554 ops/sec
- **Batch inserts (100 rows)**: 4,141 ops/sec
- **Reading rows individually**: 313,899 ops/sec
- **Reading 100 rows**: 8,508 ops/sec
- **Iterating 100 rows**: 6,532 ops/sec

## Query Optimization Techniques

### 1. Use Indexes Strategically
```sql
-- Create indexes on frequently queried columns
CREATE INDEX idx_emails_received_at ON emails(received_at);
CREATE INDEX idx_emails_sender ON emails(sender_email);
CREATE INDEX idx_analysis_workflow ON email_analysis(quick_workflow);
CREATE INDEX idx_analysis_priority ON email_analysis(quick_priority);

-- Composite index for complex queries
CREATE INDEX idx_emails_sender_date ON emails(sender_email, received_at);
```

### 2. Query Specific Columns
```javascript
// ❌ Bad - fetches all columns
const emails = db.prepare('SELECT * FROM emails').all();

// ✅ Good - fetches only needed columns
const emails = db.prepare(`
  SELECT id, subject, sender_email, received_at 
  FROM emails
`).all();
```

### 3. Use Raw Mode for Performance
```javascript
// For high-volume data processing, use raw mode
const stmt = db.prepare('SELECT id, subject FROM emails').raw();
const emails = stmt.all(); // Returns arrays instead of objects
// Result: [['id1', 'Subject 1'], ['id2', 'Subject 2'], ...]
```

### 4. Iterator Pattern for Large Result Sets
```javascript
// Process large datasets without loading all into memory
const stmt = db.prepare('SELECT * FROM emails WHERE workflow_state = ?');

for (const email of stmt.iterate('pending')) {
  await processEmail(email);
  
  // Early exit if needed
  if (shouldStop()) break;
}
```

## Error Handling and Recovery

### 1. Transaction Rollback Handling
```javascript
const migrate = db.transaction((emails) => {
  try {
    for (const email of emails) {
      insertEmail.run(email);
    }
  } catch (err) {
    if (!db.inTransaction) {
      // Transaction was forcefully rolled back
      throw new Error('Migration failed - transaction rolled back');
    }
    throw err;
  }
});
```

### 2. Duplicate Key Handling
```javascript
const insertWithDuplicateCheck = db.prepare(`
  INSERT OR IGNORE INTO emails (id, graph_id, subject)
  VALUES (?, ?, ?)
`);

// Returns info.changes = 0 if duplicate was ignored
const info = insertWithDuplicateCheck.run(id, graphId, subject);
if (info.changes === 0) {
  duplicateCount++;
}
```

## Database Maintenance

### 1. Regular VACUUM Operations
```javascript
// Reclaim disk space and optimize tables
// Run during off-peak hours
db.exec('VACUUM');

// Analyze tables for query optimization
db.exec('ANALYZE');
```

### 2. Database Backup Strategy
```javascript
// Backup with progress monitoring
async function backupDatabase() {
  const backupPath = `backups/app-${Date.now()}.db`;
  
  await db.backup(backupPath, {
    progress({ totalPages, remainingPages }) {
      const percent = ((totalPages - remainingPages) / totalPages * 100).toFixed(1);
      console.log(`Backup progress: ${percent}%`);
      return 200; // Pages to transfer per cycle
    }
  });
  
  console.log(`Backup completed: ${backupPath}`);
}
```

## Migration Implementation Checklist

1. **Pre-Migration**
   - [ ] Backup source and target databases
   - [ ] Verify schema compatibility
   - [ ] Test migration script on sample data
   - [ ] Calculate expected migration time

2. **During Migration**
   - [ ] Enable WAL mode on both databases
   - [ ] Set appropriate pragmas for performance
   - [ ] Use transactions for batch operations
   - [ ] Monitor progress and log errors
   - [ ] Verify data integrity periodically

3. **Post-Migration**
   - [ ] Run ANALYZE on new tables
   - [ ] Verify row counts match
   - [ ] Test critical queries
   - [ ] Update indexes if needed
   - [ ] Document any schema changes

## Estimated Performance for 33,797 Emails

Based on the benchmarks and optimization techniques:
- **Migration Time**: ~30-60 seconds (using batch transactions)
- **Memory Usage**: ~100-200MB peak
- **Disk Space**: Original size + ~20% for indexes and analysis data
- **Query Performance**: Sub-millisecond for indexed queries

## References
- [Better-SQLite3 Documentation](https://github.com/wiselibs/better-sqlite3)
- [SQLite Performance Tuning](https://www.sqlite.org/whentouse.html)
- [2025 Database Migration Patterns](https://moldstud.com/articles/p-implementing-data-partitioning-for-performance-optimization-in-sqlite)