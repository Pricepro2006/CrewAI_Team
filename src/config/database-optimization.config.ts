/**
 * Database Optimization Configuration
 * Settings for optimal SQLite performance with the CrewAI database
 */

export const databaseOptimizationConfig = {
  // Connection settings for better-sqlite3
  connection: {
    filename: "data/crewai.db",
    options: {
      // Enable verbose mode for debugging (disable in production)
      verbose: process.env.NODE_ENV === "development" ? console.log : undefined,

      // Connection timeout (ms)
      timeout: 30000,

      // Enable foreign keys
      fileMustExist: true,
    },
  },

  // SQLite PRAGMA settings for optimization
  pragmas: {
    // Write-Ahead Logging for better concurrency
    journal_mode: "WAL",

    // Synchronous mode (NORMAL is safe and faster than FULL)
    synchronous: "NORMAL",

    // Cache size in pages (negative = KB, -64000 = 64MB)
    cache_size: -64000,

    // Memory-mapped I/O size (256MB)
    mmap_size: 268435456,

    // Page size (4KB is optimal for most use cases)
    page_size: 4096,

    // Store temporary tables in memory
    temp_store: "MEMORY",

    // Enable query optimizer
    optimize: true,

    // Enable automatic indexing
    automatic_index: true,

    // WAL autocheckpoint (default 1000 pages)
    wal_autocheckpoint: 1000,

    // Busy timeout (30 seconds)
    busy_timeout: 30000,
  },

  // Query configuration
  query: {
    // Default query timeout (ms)
    defaultTimeout: 30000,

    // Slow query threshold for logging (ms)
    slowQueryThreshold: 1000,

    // Maximum retries for locked database
    maxRetries: 3,

    // Retry delay (ms)
    retryDelay: 1000,

    // Batch size for bulk operations
    batchSize: 1000,
  },

  // Maintenance configuration
  maintenance: {
    // Auto-vacuum mode (INCREMENTAL is best for large databases)
    autoVacuum: "INCREMENTAL",

    // Run ANALYZE after this many writes
    analyzeThreshold: 10000,

    // Run OPTIMIZE periodically (hours)
    optimizeInterval: 24,
  },

  // Backup configuration
  backup: {
    // Enable automatic backups
    enabled: true,

    // Backup schedule (cron format) - Daily at 2 AM
    schedule: "0 2 * * *",

    // Backup retention (days)
    retention: 30,

    // Backup location
    location: "data/backups/",

    // Compress backups
    compression: true,

    // Include timestamp in filename
    timestampFormat: "YYYYMMDD_HHmmss",
  },

  // Monitoring configuration
  monitoring: {
    // Enable query logging
    logQueries: process.env.NODE_ENV === "development",

    // Log slow queries
    logSlowQueries: true,

    // Track query statistics
    trackStatistics: true,

    // Statistics retention (days)
    statisticsRetention: 7,
  },

  // Index definitions for optimal performance
  requiredIndexes: [
    // Email indexes
    { table: "emails_enhanced", column: "email_hash", name: "idx_emails_hash" },
    {
      table: "emails_enhanced",
      column: "thread_id",
      name: "idx_emails_thread_id",
    },
    {
      table: "emails_enhanced",
      column: "workflow_state",
      name: "idx_emails_workflow_state",
    },
    {
      table: "emails_enhanced",
      column: "priority",
      name: "idx_emails_priority",
    },
    {
      table: "emails_enhanced",
      column: "sent_date",
      name: "idx_emails_sent_date",
    },
    {
      table: "emails_enhanced",
      columns: ["sender", "sent_date"],
      name: "idx_emails_sender_date",
    },
    {
      table: "emails_enhanced",
      columns: ["workflow_state", "priority"],
      name: "idx_emails_state_priority",
    },

    // Entity indexes
    {
      table: "email_entities",
      column: "email_id",
      name: "idx_entities_email_id",
    },
    {
      table: "email_entities",
      columns: ["email_id", "entity_type"],
      name: "idx_entities_email_type",
    },
    {
      table: "email_entities",
      column: "entity_value",
      name: "idx_entities_value",
    },

    // Stage results indexes
    {
      table: "stage_results",
      column: "email_id",
      name: "idx_stage_results_email_id",
    },
    {
      table: "stage_results",
      columns: ["stage", "email_id"],
      name: "idx_stage_results_stage_email",
    },
  ],
};

/**
 * Apply optimization settings to a database connection
 */
export async function applyOptimizations(db: any): Promise<void> {
  const { pragmas } = databaseOptimizationConfig;

  console.log("Applying database optimizations...");

  // Apply each PRAGMA setting
  for (const [pragma, value] of Object.entries(pragmas)) {
    try {
      db.pragma(`${pragma} = ${value}`);
      console.log(`✓ Set ${pragma} = ${value}`);
    } catch (error) {
      console.error(`✗ Failed to set ${pragma}:`, error);
    }
  }

  console.log("Database optimizations applied");
}

/**
 * Create required indexes if they don't exist
 */
export async function createRequiredIndexes(db: any): Promise<void> {
  const { requiredIndexes } = databaseOptimizationConfig;

  console.log("Creating required indexes...");

  for (const index of requiredIndexes) {
    try {
      const columns = Array.isArray(index.columns)
        ? index?.columns?.join(", ")
        : index.column;

      const sql = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}(${columns})`;
      db.prepare(sql).run();
      console.log(`✓ Created index ${index.name}`);
    } catch (error) {
      console.error(`✗ Failed to create index ${index.name}:`, error);
    }
  }

  console.log("Index creation complete");
}
