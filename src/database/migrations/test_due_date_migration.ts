#!/usr/bin/env node

/**
 * Test Suite for due_date Migration
 * 
 * This script comprehensively tests the due_date column migration
 * on a copy of the database to ensure safety before production use.
 * 
 * Usage: npx ts-node test_due_date_migration.ts
 */

import Database from "better-sqlite3";
import { existsSync, copyFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config = {
  originalDbPath: join(__dirname, "../../../data/walmart_grocery.db"),
  testDbPath: join(__dirname, "../../../data/walmart_grocery_test_migration.db"),
};

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
  error?: string;
}

class MigrationTester {
  private db: Database.Database | null = null;
  private results: TestResult[] = [];

  constructor(private dbPath: string) {}

  /**
   * Initialize test database
   */
  private initDb(): Database.Database {
    this.db = new Database(this.dbPath);
    this.db.pragma('foreign_keys = ON');
    return this.db;
  }

  /**
   * Add test result
   */
  private addResult(name: string, passed: boolean, message: string, details?: any, error?: string) {
    this.results.push({ name, passed, message, details, error });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    if (details && passed) {
      console.log(`   Details: ${JSON.stringify(details)}`);
    }
    if (error && !passed) {
      console.log(`   Error: ${error}`);
    }
  }

  /**
   * Test 1: Pre-migration state
   */
  async testPreMigrationState(): Promise<void> {
    try {
      const db = this.initDb();
      
      // Check table exists
      const tableExists = db.prepare(`
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type='table' AND name='grocery_lists'
      `).get() as { count: number };

      if (tableExists.count === 0) {
        this.addResult(
          "Pre-migration: Table exists",
          false,
          "grocery_lists table does not exist"
        );
        return;
      }

      // Check due_date column doesn't exist yet
      const columns = db.prepare("PRAGMA table_info(grocery_lists)").all() as Array<{
        name: string;
        type: string;
      }>;

      const hasDueDate = columns.some(col => col.name === 'due_date');
      
      this.addResult(
        "Pre-migration: Table structure",
        !hasDueDate,
        hasDueDate ? "due_date column already exists" : "Table ready for migration",
        {
          tableExists: true,
          columnCount: columns.length,
          existingColumns: columns.map(c => `${c.name} (${c.type})`),
          hasDueDate
        }
      );

    } catch (error) {
      this.addResult(
        "Pre-migration: Table structure",
        false,
        "Failed to check pre-migration state",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 2: Apply migration
   */
  async testApplyMigration(): Promise<void> {
    try {
      const db = this.db || this.initDb();

      // Apply migration
      db.exec(`ALTER TABLE grocery_lists ADD COLUMN due_date DATETIME DEFAULT NULL;`);

      // Create indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_grocery_lists_due_date 
        ON grocery_lists(due_date) 
        WHERE due_date IS NOT NULL;
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_due_date 
        ON grocery_lists(user_id, due_date) 
        WHERE due_date IS NOT NULL;
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_grocery_lists_active_due_date 
        ON grocery_lists(is_active, due_date) 
        WHERE is_active = 1 AND due_date IS NOT NULL;
      `);

      this.addResult(
        "Migration: Apply changes",
        true,
        "Migration applied successfully"
      );

    } catch (error) {
      this.addResult(
        "Migration: Apply changes",
        false,
        "Failed to apply migration",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 3: Verify column was added
   */
  async testColumnAdded(): Promise<void> {
    try {
      const db = this.db || this.initDb();
      
      const columns = db.prepare("PRAGMA table_info(grocery_lists)").all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;

      const dueDateColumn = columns.find(col => col.name === 'due_date');

      if (!dueDateColumn) {
        this.addResult(
          "Verification: Column exists",
          false,
          "due_date column was not created"
        );
        return;
      }

      const isCorrectType = dueDateColumn.type === 'DATETIME';
      const isNullable = dueDateColumn.notnull === 0;
      const hasDefaultNull = dueDateColumn.dflt_value === null;

      this.addResult(
        "Verification: Column properties",
        isCorrectType && isNullable && hasDefaultNull,
        `Column created with correct properties`,
        {
          type: dueDateColumn.type,
          nullable: isNullable,
          defaultValue: dueDateColumn.dflt_value,
          typeCorrect: isCorrectType,
          nullableCorrect: isNullable,
          defaultCorrect: hasDefaultNull
        }
      );

    } catch (error) {
      this.addResult(
        "Verification: Column properties",
        false,
        "Failed to verify column properties",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 4: Verify indexes were created
   */
  async testIndexesCreated(): Promise<void> {
    try {
      const db = this.db || this.initDb();
      
      const indexes = db.prepare("PRAGMA index_list(grocery_lists)").all() as Array<{
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

      const existingIndexNames = indexes.map(idx => idx.name);
      const createdIndexes = expectedIndexes.filter(idx => existingIndexNames.includes(idx));
      const missingIndexes = expectedIndexes.filter(idx => !existingIndexNames.includes(idx));

      this.addResult(
        "Verification: Indexes created",
        missingIndexes.length === 0,
        `${createdIndexes.length}/${expectedIndexes.length} indexes created`,
        {
          expectedIndexes,
          createdIndexes,
          missingIndexes,
          allIndexes: existingIndexNames
        }
      );

    } catch (error) {
      this.addResult(
        "Verification: Indexes created",
        false,
        "Failed to verify indexes",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 5: Test insert with due_date
   */
  async testInsertFunctionality(): Promise<void> {
    try {
      const db = this.db || this.initDb();
      const testId = `test-insert-${Date.now()}`;
      const testDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Insert with due_date
      const insertResult = db.prepare(`
        INSERT INTO grocery_lists (id, user_id, name, due_date) 
        VALUES (?, ?, ?, ?)
      `).run(testId, 'test-user', 'Test Insert List', testDate);

      const wasInserted = insertResult.changes === 1;

      // Query the inserted record
      const queryResult = db.prepare(`
        SELECT id, name, due_date 
        FROM grocery_lists 
        WHERE id = ?
      `).get(testId) as { id: string; name: string; due_date: string } | undefined;

      const wasQueried = queryResult !== undefined;
      const dateMatches = queryResult?.due_date === testDate;

      // Clean up
      db.prepare("DELETE FROM grocery_lists WHERE id = ?").run(testId);

      this.addResult(
        "Functionality: Insert with due_date",
        wasInserted && wasQueried && dateMatches,
        "Insert and query operations successful",
        {
          insertSuccessful: wasInserted,
          querySuccessful: wasQueried,
          dateMatches,
          testDate,
          retrievedDate: queryResult?.due_date
        }
      );

    } catch (error) {
      this.addResult(
        "Functionality: Insert with due_date",
        false,
        "Failed to test insert functionality",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 6: Test insert without due_date (NULL handling)
   */
  async testInsertWithoutDueDate(): Promise<void> {
    try {
      const db = this.db || this.initDb();
      const testId = `test-null-${Date.now()}`;

      // Insert without due_date
      const insertResult = db.prepare(`
        INSERT INTO grocery_lists (id, user_id, name) 
        VALUES (?, ?, ?)
      `).run(testId, 'test-user', 'Test Null List');

      const wasInserted = insertResult.changes === 1;

      // Query the inserted record
      const queryResult = db.prepare(`
        SELECT id, name, due_date 
        FROM grocery_lists 
        WHERE id = ?
      `).get(testId) as { id: string; name: string; due_date: null } | undefined;

      const wasQueried = queryResult !== undefined;
      const dueDateIsNull = queryResult?.due_date === null;

      // Clean up
      db.prepare("DELETE FROM grocery_lists WHERE id = ?").run(testId);

      this.addResult(
        "Functionality: Insert without due_date",
        wasInserted && wasQueried && dueDateIsNull,
        "NULL handling works correctly",
        {
          insertSuccessful: wasInserted,
          querySuccessful: wasQueried,
          dueDateIsNull,
          retrievedDueDate: queryResult?.due_date
        }
      );

    } catch (error) {
      this.addResult(
        "Functionality: Insert without due_date",
        false,
        "Failed to test NULL handling",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 7: Test update existing records
   */
  async testUpdateFunctionality(): Promise<void> {
    try {
      const db = this.db || this.initDb();
      const testId = `test-update-${Date.now()}`;
      const testDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      // Insert record without due_date
      db.prepare(`
        INSERT INTO grocery_lists (id, user_id, name) 
        VALUES (?, ?, ?)
      `).run(testId, 'test-user', 'Test Update List');

      // Update with due_date
      const updateResult = db.prepare(`
        UPDATE grocery_lists 
        SET due_date = ? 
        WHERE id = ?
      `).run(testDate, testId);

      const wasUpdated = updateResult.changes === 1;

      // Query the updated record
      const queryResult = db.prepare(`
        SELECT id, name, due_date 
        FROM grocery_lists 
        WHERE id = ?
      `).get(testId) as { id: string; name: string; due_date: string } | undefined;

      const dateMatches = queryResult?.due_date === testDate;

      // Clean up
      db.prepare("DELETE FROM grocery_lists WHERE id = ?").run(testId);

      this.addResult(
        "Functionality: Update due_date",
        wasUpdated && dateMatches,
        "Update operations work correctly",
        {
          updateSuccessful: wasUpdated,
          dateMatches,
          testDate,
          retrievedDate: queryResult?.due_date
        }
      );

    } catch (error) {
      this.addResult(
        "Functionality: Update due_date",
        false,
        "Failed to test update functionality",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 8: Test query performance with indexes
   */
  async testQueryPerformance(): Promise<void> {
    try {
      const db = this.db || this.initDb();

      // Test different query patterns that should use the indexes
      const testQueries = [
        {
          name: "due_date filter",
          sql: "SELECT id FROM grocery_lists WHERE due_date IS NOT NULL LIMIT 10",
        },
        {
          name: "user + due_date filter",
          sql: "SELECT id FROM grocery_lists WHERE user_id = 'test' AND due_date > datetime('now') LIMIT 10",
        },
        {
          name: "active + due_date filter", 
          sql: "SELECT id FROM grocery_lists WHERE is_active = 1 AND due_date BETWEEN datetime('now') AND datetime('now', '+7 days') LIMIT 10",
        }
      ];

      const performanceResults = [];

      for (const query of testQueries) {
        const startTime = Date.now();
        
        try {
          db.prepare(query.sql).all();
          const executionTime = Date.now() - startTime;
          performanceResults.push({
            name: query.name,
            executionTime,
            success: true
          });
        } catch (error) {
          performanceResults.push({
            name: query.name,
            executionTime: Date.now() - startTime,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const allSuccessful = performanceResults.every(r => r.success);
      const avgExecutionTime = performanceResults.reduce((sum, r) => sum + r.executionTime, 0) / performanceResults.length;

      this.addResult(
        "Performance: Query execution",
        allSuccessful,
        `All queries executed successfully (avg: ${avgExecutionTime.toFixed(2)}ms)`,
        {
          avgExecutionTime,
          queryResults: performanceResults
        }
      );

    } catch (error) {
      this.addResult(
        "Performance: Query execution",
        false,
        "Failed to test query performance",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Test 9: Test database integrity
   */
  async testDatabaseIntegrity(): Promise<void> {
    try {
      const db = this.db || this.initDb();

      // Run integrity check
      const integrityResult = db.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
      const integrityPassed = integrityResult.integrity_check === 'ok';

      // Check foreign key constraints
      const foreignKeyResult = db.prepare("PRAGMA foreign_key_check").all();
      const foreignKeysPassed = foreignKeyResult.length === 0;

      this.addResult(
        "Integrity: Database validation",
        integrityPassed && foreignKeysPassed,
        `Database integrity maintained`,
        {
          integrityCheck: integrityResult.integrity_check,
          foreignKeyViolations: foreignKeyResult.length,
          integrityPassed,
          foreignKeysPassed
        }
      );

    } catch (error) {
      this.addResult(
        "Integrity: Database validation",
        false,
        "Failed to check database integrity",
        null,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log("🧪 Starting migration test suite...\n");

    await this.testPreMigrationState();
    await this.testApplyMigration();
    await this.testColumnAdded();
    await this.testIndexesCreated();
    await this.testInsertFunctionality();
    await this.testInsertWithoutDueDate();
    await this.testUpdateFunctionality();
    await this.testQueryPerformance();
    await this.testDatabaseIntegrity();

    this.generateReport();
  }

  /**
   * Generate test report
   */
  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;

    console.log("\n" + "=".repeat(60));
    console.log("📊 MIGRATION TEST REPORT");
    console.log("=".repeat(60));
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log("\n❌ FAILED TESTS:");
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   - ${r.name}: ${r.message}`);
          if (r.error) {
            console.log(`     Error: ${r.error}`);
          }
        });
    }

    const overallSuccess = failedTests === 0;
    
    console.log(`\n${overallSuccess ? '🎉' : '⚠️'} OVERALL RESULT: ${overallSuccess ? 'MIGRATION SAFE TO APPLY' : 'MIGRATION HAS ISSUES'}`);
    
    if (overallSuccess) {
      console.log("\n✅ The migration is safe to apply to the production database.");
      console.log("💡 Don't forget to backup your database before applying!");
    } else {
      console.log("\n❌ The migration has issues and should not be applied until resolved.");
    }

    console.log("=".repeat(60));
  }

  /**
   * Cleanup
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Main test execution
 */
async function main() {
  console.log("🛠️  Walmart Grocery Database Migration Test Suite");
  console.log("Testing due_date column addition\n");

  // Check if original database exists
  if (!existsSync(config.originalDbPath)) {
    console.error(`❌ Original database not found: ${config.originalDbPath}`);
    console.log("Please ensure the walmart_grocery.db file exists before running tests.");
    process.exit(1);
  }

  let tester: MigrationTester | null = null;

  try {
    // Create test database copy
    console.log(`📋 Creating test database copy...`);
    copyFileSync(config.originalDbPath, config.testDbPath);
    console.log(`✅ Test database created: ${config.testDbPath}\n`);

    // Initialize tester
    tester = new MigrationTester(config.testDbPath);

    // Run all tests
    await tester.runAllTests();

  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (tester) {
      tester.close();
    }
    
    if (existsSync(config.testDbPath)) {
      unlinkSync(config.testDbPath);
      console.log(`\n🧹 Cleaned up test database: ${config.testDbPath}`);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { MigrationTester };