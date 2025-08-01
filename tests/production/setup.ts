/**
 * Production Test Suite Setup
 *
 * Global setup and teardown for production testing environment
 */

import { beforeAll, afterAll, vi } from "vitest";
import { getDatabaseConnection } from "../../src/database/connection.js";
import { logger } from "../../src/utils/logger.js";
import fs from "fs";
import path from "path";

// Setup test environment
beforeAll(async () => {
  logger.info("Setting up production test environment", "PROD_TEST_SETUP");

  // Create test directories
  const testDirs = ["./tests/production/results", "./logs", "./data"];

  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created test directory: ${dir}`, "PROD_TEST_SETUP");
    }
  }

  // Setup test database
  await setupTestDatabase();

  // Verify service dependencies
  await verifyServiceDependencies();

  // Setup performance monitoring
  setupPerformanceMonitoring();

  logger.info("Production test environment setup completed", "PROD_TEST_SETUP");
});

// Cleanup after all tests
afterAll(async () => {
  logger.info("Cleaning up production test environment", "PROD_TEST_SETUP");

  try {
    // Cleanup test database
    await cleanupTestDatabase();

    // Generate test summary report
    await generateTestSummaryReport();

    logger.info(
      "Production test environment cleanup completed",
      "PROD_TEST_SETUP",
    );
  } catch (error) {
    logger.error("Error during test cleanup", "PROD_TEST_SETUP", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function setupTestDatabase(): Promise<void> {
  try {
    const db = getDatabaseConnection();

    // Verify database tables exist
    const tables = [
      "emails_enhanced",
      "pipeline_executions",
      "stage_results",
      "email_analysis",
    ];

    for (const table of tables) {
      const result = db
        .prepare(
          `
        SELECT name FROM sqlite_master WHERE type='table' AND name=?
      `,
        )
        .get(table);

      if (!result) {
        logger.warn(`Database table missing: ${table}`, "PROD_TEST_SETUP");
        throw new Error(`Required database table missing: ${table}`);
      }
    }

    // Clean up any existing test data
    db.prepare(
      `DELETE FROM emails_enhanced WHERE message_id LIKE 'test-%' OR message_id LIKE 'load-test-%'`,
    ).run();
    db.prepare(
      `DELETE FROM pipeline_executions WHERE id IN (
      SELECT DISTINCT execution_id FROM stage_results 
      WHERE email_id NOT IN (SELECT id FROM emails_enhanced)
    )`,
    ).run();

    logger.info("Test database setup completed", "PROD_TEST_SETUP");
  } catch (error) {
    logger.error("Test database setup failed", "PROD_TEST_SETUP", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function verifyServiceDependencies(): Promise<void> {
  const services = [
    {
      name: "Redis",
      check: async () => {
        try {
          // Basic Redis connectivity check
          const { createClient } = await import("redis");
          const client = createClient({ url: process.env.REDIS_URL });
          await client.connect();
          await client.ping();
          await client.disconnect();
          return true;
        } catch {
          return false;
        }
      },
    },
    {
      name: "Ollama",
      check: async () => {
        try {
          const response = await fetch(
            `${process.env.OLLAMA_HOST}/api/version`,
          );
          return response.ok;
        } catch {
          return false;
        }
      },
    },
    {
      name: "ChromaDB",
      check: async () => {
        try {
          const response = await fetch(
            `${process.env.CHROMADB_URL}/api/v1/version`,
          );
          return response.ok;
        } catch {
          return false;
        }
      },
    },
  ];

  const serviceStatus = await Promise.all(
    services.map(async (service) => ({
      name: service.name,
      available: await service.check(),
    })),
  );

  serviceStatus.forEach(({ name, available }) => {
    if (available) {
      logger.info(`Service dependency available: ${name}`, "PROD_TEST_SETUP");
    } else {
      logger.warn(`Service dependency unavailable: ${name}`, "PROD_TEST_SETUP");
    }
  });

  // Don't fail setup if services are unavailable - tests will skip or adapt
  logger.info("Service dependency verification completed", "PROD_TEST_SETUP");
}

function setupPerformanceMonitoring(): void {
  // Setup global performance monitoring
  const startTime = process.hrtime.bigint();
  const initialMemory = process.memoryUsage();

  // Store in global for access in tests
  (global as any).__PROD_TEST_START_TIME__ = startTime;
  (global as any).__PROD_TEST_INITIAL_MEMORY__ = initialMemory;

  // Setup memory monitoring
  const memorySnapshots: Array<{
    timestamp: number;
    usage: NodeJS.MemoryUsage;
  }> = [];

  const memoryMonitor = setInterval(() => {
    memorySnapshots.push({
      timestamp: Date.now(),
      usage: process.memoryUsage(),
    });
  }, 1000); // Every second

  (global as any).__PROD_TEST_MEMORY_MONITOR__ = memoryMonitor;
  (global as any).__PROD_TEST_MEMORY_SNAPSHOTS__ = memorySnapshots;

  logger.info("Performance monitoring setup completed", "PROD_TEST_SETUP");
}

async function cleanupTestDatabase(): Promise<void> {
  try {
    const db = getDatabaseConnection();

    // Clean up all test data
    const cleanupQueries = [
      `DELETE FROM stage_results WHERE email_id IN (
        SELECT id FROM emails_enhanced WHERE message_id LIKE 'test-%' OR message_id LIKE 'load-test-%'
      )`,
      `DELETE FROM email_analysis WHERE email_id IN (
        SELECT id FROM emails_enhanced WHERE message_id LIKE 'test-%' OR message_id LIKE 'load-test-%'
      )`,
      `DELETE FROM emails_enhanced WHERE message_id LIKE 'test-%' OR message_id LIKE 'load-test-%'`,
      `DELETE FROM pipeline_executions WHERE id NOT IN (
        SELECT DISTINCT execution_id FROM stage_results WHERE execution_id IS NOT NULL
      )`,
    ];

    for (const query of cleanupQueries) {
      const result = db.prepare(query).run();
      logger.debug(
        `Cleanup query executed: ${result.changes} rows affected`,
        "PROD_TEST_SETUP",
      );
    }

    logger.info("Test database cleanup completed", "PROD_TEST_SETUP");
  } catch (error) {
    logger.error("Test database cleanup failed", "PROD_TEST_SETUP", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function generateTestSummaryReport(): Promise<void> {
  try {
    // Stop memory monitoring
    const memoryMonitor = (global as any).__PROD_TEST_MEMORY_MONITOR__;
    if (memoryMonitor) {
      clearInterval(memoryMonitor);
    }

    // Generate performance summary
    const startTime = (global as any).__PROD_TEST_START_TIME__;
    const initialMemory = (global as any).__PROD_TEST_INITIAL_MEMORY__;
    const memorySnapshots =
      (global as any).__PROD_TEST_MEMORY_SNAPSHOTS__ || [];

    if (startTime && initialMemory) {
      const endTime = process.hrtime.bigint();
      const finalMemory = process.memoryUsage();
      const duration = Number(endTime - startTime) / 1e6; // Convert to milliseconds

      const report = {
        summary: {
          totalDuration: `${duration.toFixed(2)}ms`,
          initialMemory: {
            heapUsed: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
            rss: `${Math.round(initialMemory.rss / 1024 / 1024)}MB`,
          },
          finalMemory: {
            heapUsed: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
            rss: `${Math.round(finalMemory.rss / 1024 / 1024)}MB`,
          },
          memoryGrowth: `${Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024)}MB`,
          memorySnapshots: memorySnapshots.length,
        },
        timestamp: new Date().toISOString(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: require("os").cpus().length,
        },
      };

      // Write report to file
      const reportPath = "./tests/production/results/test-summary.json";
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      logger.info("Test summary report generated", "PROD_TEST_SETUP", {
        reportPath,
        duration: report.summary.totalDuration,
        memoryGrowth: report.summary.memoryGrowth,
      });
    }
  } catch (error) {
    logger.error("Failed to generate test summary report", "PROD_TEST_SETUP", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
