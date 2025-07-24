#!/usr/bin/env tsx
/**
 * Test script to verify execution record update works
 */

import Database from "better-sqlite3";
import { logger } from "../utils/logger";
import path from "path";

async function testExecutionUpdate() {
  logger.info("Testing execution record update...", "TEST");

  const dbPath = path.join(process.cwd(), "data", "crewai.db");
  const db = new Database(dbPath);

  try {
    // Create a test execution record
    const result = db
      .prepare(
        `
      INSERT INTO pipeline_executions 
      (started_at, status, stage1_count, stage2_count, stage3_count)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(new Date().toISOString(), "running", 0, 0, 0);

    const executionId = result.lastInsertRowid;
    logger.info(`Created test execution with ID: ${executionId}`, "TEST");

    // Try to update stage1_count
    try {
      const columnName = "stage1_count";
      db.prepare(
        `
        UPDATE pipeline_executions 
        SET ${columnName} = ?
        WHERE id = ?
      `,
      ).run(100, executionId);

      logger.info("Update successful!", "TEST");

      // Verify the update
      const record = db
        .prepare("SELECT * FROM pipeline_executions WHERE id = ?")
        .get(executionId) as any;
      logger.info("Updated record:", "TEST", record);
    } catch (error) {
      logger.error("Update failed", "TEST", {}, error as Error);

      // Try with explicit column name
      try {
        db.prepare(
          `
          UPDATE pipeline_executions 
          SET stage1_count = ?
          WHERE id = ?
        `,
        ).run(100, executionId);
        logger.info("Direct column update successful!", "TEST");
      } catch (error2) {
        logger.error(
          "Direct column update also failed",
          "TEST",
          {},
          error2 as Error,
        );
      }
    }

    // Clean up
    db.prepare("DELETE FROM pipeline_executions WHERE id = ?").run(executionId);
  } catch (error) {
    logger.error("Test failed", "TEST", {}, error as Error);
  } finally {
    db.close();
  }
}

// Run test
testExecutionUpdate();
