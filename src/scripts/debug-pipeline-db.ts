#!/usr/bin/env tsx

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";

async function debugDatabase() {
  try {
    const db = getDatabaseConnection();

    // Check if tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as any[];
    console.log(
      "Tables in database:",
      tables.map((t) => t.name),
    );

    // Check emails_enhanced table
    const emailCount = db
      .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
      .get() as { count: number };
    console.log("Total emails:", emailCount.count);

    // Check pipeline tables
    const pipelineExists = tables.some((t) => t.name === "pipeline_executions");
    const stageExists = tables.some((t) => t.name === "stage_results");
    const analysisExists = tables.some((t) => t.name === "email_analysis");

    console.log("Pipeline tables exist:");
    console.log("- pipeline_executions:", pipelineExists);
    console.log("- stage_results:", stageExists);
    console.log("- email_analysis:", analysisExists);

    // Try to get a sample email
    const sampleEmail = db
      .prepare(
        `
      SELECT 
        id,
        message_id,
        subject,
        sender_email,
        received_at
      FROM emails_enhanced
      LIMIT 1
    `,
      )
      .get();

    console.log("\nSample email:", sampleEmail);
  } catch (error) {
    console.error("Database error:", error);
  }
}

debugDatabase().catch(console.error);
