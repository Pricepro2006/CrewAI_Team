import Database from "better-sqlite3";

/**
 * Migration: Add due_date column to grocery_lists table
 * Version: 016
 * Description: Adds due_date column to grocery_lists table with proper indexing and constraints
 */

export function up(db: Database.Database) {
  console.log("Adding due_date column to grocery_lists table...");

  // Check if column already exists (safety check)
  const columns = db.prepare("PRAGMA table_info(grocery_lists)").all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>;

  const dueDateExists = columns.some(col => col.name === 'due_date');
  
  if (dueDateExists) {
    console.log("⚠️  due_date column already exists, skipping...");
    return;
  }

  // Add due_date column with NULL default (optional field)
  db.exec(`
    ALTER TABLE grocery_lists 
    ADD COLUMN due_date DATETIME DEFAULT NULL;
  `);

  // Add index for due_date queries (filtering by due date, sorting)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_due_date 
    ON grocery_lists(due_date) 
    WHERE due_date IS NOT NULL;
  `);

  // Add compound index for user + due_date queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_due_date 
    ON grocery_lists(user_id, due_date) 
    WHERE due_date IS NOT NULL;
  `);

  // Add compound index for active lists with due dates
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_grocery_lists_active_due_date 
    ON grocery_lists(is_active, due_date) 
    WHERE is_active = 1 AND due_date IS NOT NULL;
  `);

  // Verify the column was added successfully
  const updatedColumns = db.prepare("PRAGMA table_info(grocery_lists)").all() as Array<{
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }>;

  const dueDateAdded = updatedColumns.some(col => col.name === 'due_date');
  
  if (!dueDateAdded) {
    throw new Error("Failed to add due_date column to grocery_lists table");
  }

  // Verify indexes were created
  const indexes = db.prepare("PRAGMA index_list(grocery_lists)").all() as Array<{
    seq: number;
    name: string;
    unique: number;
    origin: string;
    partial: number;
  }>;

  const expectedIndexes = [
    'idx_grocery_lists_due_date',
    'idx_grocery_lists_user_due_date', 
    'idx_grocery_lists_active_due_date'
  ];

  const createdIndexes = indexes.map(idx => idx.name);
  const missingIndexes = expectedIndexes.filter(idx => !createdIndexes.includes(idx));

  if (missingIndexes.length > 0) {
    console.warn(`⚠️  Some indexes may not have been created: ${missingIndexes.join(', ')}`);
  }

  console.log("✅ due_date column and indexes added successfully to grocery_lists table");
  
  // Show sample query to verify functionality
  console.log("\n📋 Sample queries you can now run:");
  console.log("   - SELECT * FROM grocery_lists WHERE due_date IS NOT NULL ORDER BY due_date;");
  console.log("   - SELECT * FROM grocery_lists WHERE user_id = 'user123' AND due_date > datetime('now');");
  console.log("   - SELECT * FROM grocery_lists WHERE is_active = 1 AND due_date BETWEEN datetime('now') AND datetime('now', '+7 days');");
}

export function down(db: Database.Database) {
  console.log("Rolling back: Removing due_date column from grocery_lists table...");

  try {
    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    console.log("Creating temporary table without due_date column...");
    
    // Create new table without due_date column
    db.exec(`
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
    `);

    // Copy data from original table (excluding due_date)
    db.exec(`
      INSERT INTO grocery_lists_temp (
        id, user_id, name, description, total_items, 
        estimated_total, is_active, created_at, updated_at
      )
      SELECT 
        id, user_id, name, description, total_items, 
        estimated_total, is_active, created_at, updated_at
      FROM grocery_lists;
    `);

    // Drop the original table
    db.exec("DROP TABLE grocery_lists;");

    // Rename temp table to original name
    db.exec("ALTER TABLE grocery_lists_temp RENAME TO grocery_lists;");

    // Recreate the original indexes (without due_date indexes)
    db.exec("CREATE INDEX IF NOT EXISTS idx_grocery_lists_user ON grocery_lists(user_id);");

    // Drop the due_date specific indexes (in case they weren't dropped with the table)
    db.exec("DROP INDEX IF EXISTS idx_grocery_lists_due_date;");
    db.exec("DROP INDEX IF EXISTS idx_grocery_lists_user_due_date;");
    db.exec("DROP INDEX IF EXISTS idx_grocery_lists_active_due_date;");

    console.log("✅ due_date column and related indexes removed successfully");

  } catch (error) {
    console.error("❌ Error during rollback:", error);
    throw error;
  }
}

/**
 * Verification queries for testing the migration
 */
export const verificationQueries = {
  // Check if column exists
  checkColumnExists: `
    SELECT COUNT(*) as column_exists 
    FROM pragma_table_info('grocery_lists') 
    WHERE name = 'due_date';
  `,
  
  // Check if indexes exist
  checkIndexes: `
    SELECT name 
    FROM pragma_index_list('grocery_lists') 
    WHERE name IN ('idx_grocery_lists_due_date', 'idx_grocery_lists_user_due_date', 'idx_grocery_lists_active_due_date');
  `,
  
  // Test inserting with due_date
  testInsert: `
    INSERT INTO grocery_lists (id, user_id, name, due_date) 
    VALUES ('test-list-1', 'test-user-1', 'Test Migration List', datetime('now', '+3 days'))
    RETURNING id, name, due_date;
  `,
  
  // Test querying with due_date
  testQuery: `
    SELECT id, name, due_date 
    FROM grocery_lists 
    WHERE due_date IS NOT NULL 
    ORDER BY due_date DESC 
    LIMIT 5;
  `,
  
  // Clean up test data
  cleanup: `
    DELETE FROM grocery_lists WHERE id LIKE 'test-list-%';
  `
};

/**
 * Migration metadata for tracking
 */
export const metadata = {
  version: '016',
  name: 'Add due_date to grocery_lists',
  description: 'Adds due_date column to grocery_lists table with proper indexing and constraints',
  affectedTables: ['grocery_lists'],
  indexesCreated: [
    'idx_grocery_lists_due_date',
    'idx_grocery_lists_user_due_date',
    'idx_grocery_lists_active_due_date'
  ],
  backupRecommended: true,
  dataLossRisk: false,
  rollbackSupported: true
};