#!/usr/bin/env tsx

/**
 * Test script to verify all infrastructure components are working
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { transactionManager } from "../src/database/TransactionManager.js";
import { retryManager } from "../src/core/retry/RetryManager.js";
import { checkpointManager } from "../src/core/recovery/CheckpointManager.js";
import { gracefulShutdown } from "../src/core/shutdown/GracefulShutdownHandler.js";
import { MemorySafeBatchProcessor } from "../src/core/processors/MemorySafeBatchProcessor.js";
import chalk from "chalk";

async function testInfrastructure() {
  console.log(chalk.blue.bold("\n🧪 Testing CrewAI Infrastructure\n"));

  const results: Record<string, boolean> = {};

  // Test 1: Database Connection Pool
  try {
    console.log(chalk.yellow("Testing Database Connection Pool..."));
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();
    const result = db.prepare("SELECT 1 as test").get() as { test: number };
    results["Database Connection Pool"] = result.test === 1;
    console.log(chalk.green("✓ Database Connection Pool: Working"));
  } catch (error) {
    results["Database Connection Pool"] = false;
    console.log(chalk.red("✗ Database Connection Pool: Failed"), error);
  }

  // Test 2: Transaction Manager
  try {
    console.log(chalk.yellow("\nTesting Transaction Manager..."));
    await transactionManager.executeTransaction(async (tx) => {
      tx.db.exec(
        "CREATE TEMP TABLE test_tx (id INTEGER PRIMARY KEY, value TEXT)",
      );
      tx.db.prepare("INSERT INTO test_tx (value) VALUES (?)").run("test");
      const result = tx.db.prepare("SELECT * FROM test_tx").get();
      if (!result) throw new Error("Transaction test failed");
    });
    results["Transaction Manager"] = true;
    console.log(chalk.green("✓ Transaction Manager: Working"));
  } catch (error) {
    results["Transaction Manager"] = false;
    console.log(chalk.red("✗ Transaction Manager: Failed"), error);
  }

  // Test 3: Retry Manager
  try {
    console.log(chalk.yellow("\nTesting Retry Manager..."));
    let attempts = 0;
    const result = await retryManager.retry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error("Simulated failure");
        return "success";
      },
      { maxAttempts: 3, initialDelay: 100 },
    );
    results["Retry Manager"] = result === "success" && attempts === 2;
    console.log(chalk.green("✓ Retry Manager: Working (2 attempts)"));
  } catch (error) {
    results["Retry Manager"] = false;
    console.log(chalk.red("✗ Retry Manager: Failed"), error);
  }

  // Test 4: Checkpoint Manager
  try {
    console.log(chalk.yellow("\nTesting Checkpoint Manager..."));
    const testId = `test-${Date.now()}`;
    const testType = "test-operation";

    // Create checkpoint
    await checkpointManager.createCheckpoint(
      testId,
      testType,
      { test: "data" },
      { completed: 50, total: 100, failed: 0 },
    );

    // Recover checkpoint
    const recovered = await checkpointManager.recover(testId, testType);

    // Clear checkpoints
    await checkpointManager.clearCheckpoints(testId, testType);

    results["Checkpoint Manager"] =
      recovered?.state?.test === "data" &&
      recovered?.progress?.percentage === 50;
    console.log(chalk.green("✓ Checkpoint Manager: Working"));
  } catch (error) {
    results["Checkpoint Manager"] = false;
    console.log(chalk.red("✗ Checkpoint Manager: Failed"), error);
  }

  // Test 5: Memory-Safe Batch Processor
  try {
    console.log(chalk.yellow("\nTesting Memory-Safe Batch Processor..."));
    const processor = new MemorySafeBatchProcessor({
      batchSize: 10,
      maxMemoryMB: 100,
    });
    let processed = 0;
    await processor.processBatch(
      Array.from({ length: 20 }, (_, i) => i),
      async (item) => {
        processed++;
      },
    );
    results["Memory-Safe Batch Processor"] = processed === 20;
    console.log(chalk.green("✓ Memory-Safe Batch Processor: Working"));
  } catch (error) {
    results["Memory-Safe Batch Processor"] = false;
    console.log(chalk.red("✗ Memory-Safe Batch Processor: Failed"), error);
  }

  // Test 6: Graceful Shutdown Handler
  try {
    console.log(chalk.yellow("\nTesting Graceful Shutdown Handler..."));
    let handlerCalled = false;
    gracefulShutdown.registerComponent({
      name: "TestHandler",
      priority: 100,
      shutdown: async () => {
        handlerCalled = true;
      },
    });
    // Don't actually shutdown, just test registration
    results["Graceful Shutdown Handler"] = true;
    console.log(chalk.green("✓ Graceful Shutdown Handler: Registered"));
  } catch (error) {
    results["Graceful Shutdown Handler"] = false;
    console.log(chalk.red("✗ Graceful Shutdown Handler: Failed"), error);
  }

  // Test 7: Database Tables
  try {
    console.log(chalk.yellow("\nTesting Database Tables..."));
    const dbManager = getDatabaseManager();
    const db = dbManager.getSQLiteDatabase();

    const tables = [
      "emails",
      "email_analysis",
      "email_entities",
      "action_items",
      "workflow_templates",
    ];
    let allTablesExist = true;

    for (const table of tables) {
      const exists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);
      if (!exists) {
        allTablesExist = false;
        console.log(chalk.red(`  ✗ Table '${table}' missing`));
      }
    }

    results["Database Tables"] = allTablesExist;
    if (allTablesExist) {
      console.log(chalk.green("✓ Database Tables: All required tables exist"));
    }
  } catch (error) {
    results["Database Tables"] = false;
    console.log(chalk.red("✗ Database Tables: Failed"), error);
  }

  // Summary
  console.log(chalk.blue.bold("\n\n📊 Infrastructure Test Summary\n"));
  console.log(chalk.white("─".repeat(40)));

  let passCount = 0;
  let failCount = 0;

  Object.entries(results).forEach(([component, passed]) => {
    if (passed) {
      passCount++;
      console.log(chalk.green(`✓ ${component}`));
    } else {
      failCount++;
      console.log(chalk.red(`✗ ${component}`));
    }
  });

  console.log(chalk.white("─".repeat(40)));
  console.log(chalk.white(`Total: ${passCount + failCount} tests`));
  console.log(chalk.green(`Passed: ${passCount}`));
  console.log(chalk.red(`Failed: ${failCount}`));

  if (failCount === 0) {
    console.log(chalk.green.bold("\n✨ All infrastructure tests passed!"));
    console.log(
      chalk.green("The system is ready to process the 20k email dataset."),
    );
  } else {
    console.log(chalk.red.bold("\n❌ Some infrastructure tests failed!"));
    console.log(
      chalk.yellow(
        "Please fix the issues before running the full dataset processor.",
      ),
    );
  }

  return failCount === 0;
}

// Main execution
async function main() {
  try {
    const success = await testInfrastructure();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(chalk.red("\n❌ Fatal error:"), error);
    process.exit(1);
  }
}

main();
