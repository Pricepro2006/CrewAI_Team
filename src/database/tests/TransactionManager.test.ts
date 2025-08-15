/**
 * Transaction Manager Tests
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  TransactionManager,
  transactionManager,
} from "../TransactionManager.js";
import {
  getDatabaseConnection,
  shutdownConnectionPool,
} from "../ConnectionPool.js";
import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";

describe("TransactionManager", () => {
  const testDbPath = "./test_transactions.db";
  let db: Database.Database;

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Get connection and create test table
    const connection = getDatabaseConnection({ databasePath: testDbPath });
    db = connection.getDatabase();

    db.exec(`
      CREATE TABLE IF NOT EXISTS test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT NOT NULL,
        number INTEGER DEFAULT 0
      )
    `);
  });

  afterEach(async () => {
    // Clean up
    await shutdownConnectionPool();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  test("should execute simple transaction successfully", async () => {
    const result = await transactionManager.executeTransaction(async (tx: any) => {
      const stmt = tx?.db?.prepare("INSERT INTO test_table (value) VALUES (?)");
      const info = stmt.run("test-value");
      return info.lastInsertRowid;
    });

    expect(result).toBe(1);

    // Verify data was committed
    const row = db.prepare("SELECT * FROM test_table WHERE id = ?").get(result);
    expect(row).toMatchObject({ id: 1, value: "test-value" });
  });

  test("should rollback transaction on error", async () => {
    try {
      await transactionManager.executeTransaction(async (tx: any) => {
        // Insert first row
        tx?.db?.prepare("INSERT INTO test_table (value) VALUES (?)").run("first");

        // Force an error
        throw new Error("Intentional error");

        // This should not execute
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("second");
      });

      fail("Transaction should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Intentional error");
    }

    // Verify rollback - no data should be inserted
    const count = db
      .prepare("SELECT COUNT(*) as count FROM test_table")
      .get() as { count: number };
    expect(count.count).toBe(0);
  });

  test("should handle nested transactions with savepoints", async () => {
    await transactionManager.executeTransaction(async (tx: any) => {
      // Insert first row
      tx?.db?.prepare("INSERT INTO test_table (value) VALUES (?)").run("outer");

      // Create savepoint
      const savepoint = await transactionManager.createSavepoint(tx);

      try {
        // Insert second row
        tx?.db?.prepare("INSERT INTO test_table (value) VALUES (?)").run("inner");

        // Force error
        throw new Error("Inner error");
      } catch (error) {
        // Rollback to savepoint
        await transactionManager.rollbackToSavepoint(tx, savepoint);
      }

      // Insert third row (should succeed)
      tx.db
        .prepare("INSERT INTO test_table (value) VALUES (?)")
        .run("after-rollback");
    });

    // Verify correct data
    const rows = db
      .prepare("SELECT value FROM test_table ORDER BY id")
      .all() as Array<{ value: string }>;
    expect(rows).toHaveLength(2);
    expect(rows[0].value).toBe("outer");
    expect(rows[1].value).toBe("after-rollback");
  });

  test("should timeout long-running transactions", async () => {
    try {
      await transactionManager.executeTransaction(
        async (tx: any) => {
          // Start a long operation
          await new Promise((resolve: any) => setTimeout(resolve, 200));
          return "should-not-reach";
        },
        { timeout: 100 },
      );

      fail("Transaction should have timed out");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("timed out");
    }
  });

  test("should retry on retryable errors", async () => {
    let attempts = 0;

    const result = await transactionManager.executeTransaction(
      async (tx: any) => {
        attempts++;

        if (attempts < 3) {
          // Simulate busy error
          const error = new Error("SQLITE_BUSY: database is locked");
          throw error;
        }

        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("success");
        return attempts;
      },
      { retries: 3 },
    );

    expect(result).toBe(3);
    expect(attempts).toBe(3);

    // Verify data was inserted
    const count = db
      .prepare("SELECT COUNT(*) as count FROM test_table")
      .get() as { count: number };
    expect(count.count).toBe(1);
  });

  test("should execute batch operations with individual savepoints", async () => {
    const operations = [
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("batch-1");
        return 1;
      },
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("batch-2");
        return 2;
      },
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("batch-3");
        return 3;
      },
    ];

    const results = await transactionManager.executeBatch(operations);

    expect(results).toEqual([1, 2, 3]);

    // Verify all data was inserted
    const count = db
      .prepare("SELECT COUNT(*) as count FROM test_table")
      .get() as { count: number };
    expect(count.count).toBe(3);
  });

  test("should rollback failed batch operation", async () => {
    const operations = [
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("batch-1");
        return 1;
      },
      async (tx: any) => {
        throw new Error("Batch operation failed");
      },
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("batch-3");
        return 3;
      },
    ];

    try {
      await transactionManager.executeBatch(operations);
      fail("Batch should have failed");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("Batch operation 1 failed");
    }

    // Only first operation should be committed
    const count = db
      .prepare("SELECT COUNT(*) as count FROM test_table")
      .get() as { count: number };
    expect(count.count).toBe(1);
  });

  test("should track transaction metrics", async () => {
    // Reset metrics
    transactionManager.resetMetrics();

    // Execute successful transaction
    await transactionManager.executeTransaction(async (tx: any) => {
      tx.db
        .prepare("INSERT INTO test_table (value) VALUES (?)")
        .run("metric-test");
    });

    // Execute failed transaction
    try {
      await transactionManager.executeTransaction(async (tx: any) => {
        throw new Error("Metrics test error");
      });
    } catch {
      // Expected
    }

    const metrics = transactionManager.getMetrics();

    expect(metrics.totalTransactions).toBe(2);
    expect(metrics.successfulTransactions).toBe(1);
    expect(metrics.failedTransactions).toBe(1);
    expect(metrics.activeTransactions).toBe(0);
    expect(metrics.averageDuration).toBeGreaterThan(0);
  });

  test("should handle concurrent transactions", async () => {
    const transactions = Array.from({ length: 5 }, (_, i) =>
      transactionManager.executeTransaction(async (tx: any) => {
        const stmt = tx?.db?.prepare(
          "INSERT INTO test_table (value, number) VALUES (?, ?)",
        );
        stmt.run(`concurrent-${i}`, i);
        return i;
      }),
    );

    const results = await Promise.all(transactions);

    expect(results).toEqual([0, 1, 2, 3, 4]);

    // Verify all data was inserted
    const rows = db.prepare("SELECT * FROM test_table ORDER BY number").all();
    expect(rows).toHaveLength(5);
  });

  test("should use different isolation levels", async () => {
    // Test IMMEDIATE isolation
    await transactionManager.executeTransaction(
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("immediate");
      },
      { isolationLevel: "IMMEDIATE" },
    );

    // Test EXCLUSIVE isolation
    await transactionManager.executeTransaction(
      async (tx: any) => {
        tx.db
          .prepare("INSERT INTO test_table (value) VALUES (?)")
          .run("exclusive");
      },
      { isolationLevel: "EXCLUSIVE" },
    );

    // Test read-only transaction
    const result = await transactionManager.executeTransaction(
      async (tx: any) => {
        const row = tx.db
          .prepare("SELECT COUNT(*) as count FROM test_table")
          .get() as { count: number };
        return row.count;
      },
      { readOnly: true },
    );

    expect(result).toBe(2);
  });

  test("should emit transaction events", async () => {
    const events: string[] = [];

    transactionManager.on("transaction:success", () => events.push("success"));
    transactionManager.on("transaction:failure", () => events.push("failure"));

    // Successful transaction
    await transactionManager.executeTransaction(async (tx: any) => {
      tx.db
        .prepare("INSERT INTO test_table (value) VALUES (?)")
        .run("event-test");
    });

    // Failed transaction
    try {
      await transactionManager.executeTransaction(async () => {
        throw new Error("Event test error");
      });
    } catch {
      // Expected
    }

    expect(events).toEqual(["success", "failure"]);

    // Clean up listeners
    transactionManager.removeAllListeners();
  });
});
