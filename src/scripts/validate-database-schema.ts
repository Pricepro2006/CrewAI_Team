/**
 * Database Schema Validation Script
 * Tests the database schema adapter and error handling functionality
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import { DatabaseSchemaAdapter, createSchemaAdapter } from '../api/trpc/database-schema-adapter.js';
import { DatabaseErrorHandler, createDatabaseErrorHandler } from '../api/trpc/database-error-middleware.js';
import { SafeDatabaseOperations } from '../api/trpc/database-middleware.js';

async function validateDatabaseSchema() {
  logger.info("Starting database schema validation", "SCHEMA_VALIDATION");

  // Create in-memory test database
  const db = new Database(':memory:');

  try {
    // Create test tables
    db.exec(`
      CREATE TABLE test_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE test_posts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        published BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES test_users(id)
      );
    `);

    logger.info("Test tables created successfully", "SCHEMA_VALIDATION");

    // Initialize components
    const adapter = createSchemaAdapter(db);
    const errorHandler = createDatabaseErrorHandler(db, adapter);
    const safeDb = new SafeDatabaseOperations(db, adapter, errorHandler);

    // Test 1: Column existence detection
    logger.info("Testing column existence detection", "SCHEMA_VALIDATION");
    
    const userTableColumns = adapter.getTableColumns('test_users');
    logger.info(`test_users columns: ${userTableColumns.join(', ')}`, "SCHEMA_VALIDATION");
    
    if (adapter.columnExists('test_users', 'name')) {
      logger.info("✓ Column existence detection works", "SCHEMA_VALIDATION");
    } else {
      logger.error("✗ Column existence detection failed", "SCHEMA_VALIDATION");
    }

    // Test 2: Safe SELECT with mixed columns
    logger.info("Testing safe SELECT with mixed columns", "SCHEMA_VALIDATION");
    
    const selectResult = adapter.createSafeSelectQuery(
      'test_users',
      ['id', 'name', 'nonexistent_column']
    );
    
    logger.info("Safe SELECT query result:", "SCHEMA_VALIDATION", {
      availableColumns: selectResult.availableColumns,
      missingColumns: selectResult.missingColumns,
      query: selectResult.query
    });

    // Test 3: Safe INSERT with mixed columns
    logger.info("Testing safe INSERT with mixed columns", "SCHEMA_VALIDATION");
    
    const insertResult = adapter.createSafeInsertQuery('test_users', {
      id: 'test-1',
      name: 'Test User',
      email: 'test@example.com',
      nonexistent_column: 'should be skipped'
    });

    logger.info("Safe INSERT query result:", "SCHEMA_VALIDATION", {
      query: insertResult.query,
      values: insertResult.values,
      skippedColumns: insertResult.skippedColumns
    });

    // Test 4: Actual database operations
    logger.info("Testing actual database operations", "SCHEMA_VALIDATION");

    // Insert test data
    const insertOperationResult = await safeDb.insert('test_users', {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      invalid_column: 'should be ignored'
    });

    logger.info("Insert operation result:", "SCHEMA_VALIDATION", insertOperationResult);

    // Select test data
    const selectOperationResult = await safeDb.select(
      'test_users',
      ['id', 'name', 'email', 'invalid_column'],
      'id = ?',
      ['user-1']
    );

    logger.info("Select operation result:", "SCHEMA_VALIDATION", {
      dataCount: selectOperationResult.data.length,
      missingColumns: selectOperationResult.missingColumns,
      warnings: selectOperationResult.warnings
    });

    // Test 5: Error handling
    logger.info("Testing error handling", "SCHEMA_VALIDATION");

    try {
      await safeDb.select('nonexistent_table', ['id']);
      logger.error("✗ Should have thrown an error for non-existent table", "SCHEMA_VALIDATION");
    } catch (error) {
      logger.info("✓ Error handling works for non-existent table", "SCHEMA_VALIDATION", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 6: Schema validation
    logger.info("Testing schema validation", "SCHEMA_VALIDATION");
    
    const schemaValidation = adapter.validateTableSchema('test_users', [
      { name: 'id', type: 'TEXT', required: true },
      { name: 'name', type: 'TEXT', required: true },
      { name: 'missing_column', type: 'TEXT', required: false }
    ]);

    logger.info("Schema validation result:", "SCHEMA_VALIDATION", schemaValidation);

    // Test 7: Database health check
    logger.info("Testing database health check", "SCHEMA_VALIDATION");
    
    const healthInfo = errorHandler.getDatabaseHealth();
    logger.info("Database health:", "SCHEMA_VALIDATION", healthInfo);

    // Test 8: Table and column information
    logger.info("Testing database information retrieval", "SCHEMA_VALIDATION");
    
    const dbInfo = adapter.getDatabaseInfo();
    logger.info("Database information:", "SCHEMA_VALIDATION", dbInfo);

    logger.info("All database schema validation tests completed successfully", "SCHEMA_VALIDATION");

  } catch (error) {
    logger.error("Database schema validation failed", "SCHEMA_VALIDATION", { error });
    throw error;
  } finally {
    db.close();
    logger.info("Database connection closed", "SCHEMA_VALIDATION");
  }
}

// Run validation if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDatabaseSchema()
    .then(() => {
      console.log("✅ Database schema validation completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Database schema validation failed:", error);
      process.exit(1);
    });
}

export { validateDatabaseSchema };