/**
 * Create performance indexes for pipeline JSON data access
 * This improves query performance for the direct pipeline integration
 */

import { getDatabaseConnection } from "../database/connection";
import { logger } from "../utils/logger";

export async function createPipelineIndexes() {
  const db = getDatabaseConnection();

  try {
    logger.info("Creating pipeline performance indexes", "DB_OPTIMIZATION");

    // Index on email_id for fast lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id 
      ON email_analysis(email_id);
    `);
    logger.info("Created index on email_analysis.email_id", "DB_OPTIMIZATION");

    // Index on pipeline_stage for filtering
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_analysis_pipeline_stage 
      ON email_analysis(pipeline_stage);
    `);
    logger.info(
      "Created index on email_analysis.pipeline_stage",
      "DB_OPTIMIZATION",
    );

    // Composite index for email_id and timestamp
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_email_analysis_email_timestamp 
      ON email_analysis(email_id, analysis_timestamp);
    `);
    logger.info(
      "Created composite index on email_id and timestamp",
      "DB_OPTIMIZATION",
    );

    // Functional indexes on JSON fields (SQLite 3.45+ with JSONB support)
    try {
      // Check SQLite version
      const versionResult = db
        .prepare("SELECT sqlite_version() as version")
        .get() as { version: string };
      const version = versionResult.version;
      logger.info(`SQLite version: ${version}`, "DB_OPTIMIZATION");

      // Create functional indexes if supported
      if (version >= "3.45.0") {
        // Index on Llama workflow state
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_llama_workflow_state 
          ON email_analysis(json_extract(llama_analysis, '$.workflow_state'))
          WHERE llama_analysis IS NOT NULL;
        `);
        logger.info(
          "Created functional index on Llama workflow state",
          "DB_OPTIMIZATION",
        );

        // Index on Llama business process
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_llama_business_process 
          ON email_analysis(json_extract(llama_analysis, '$.business_process'))
          WHERE llama_analysis IS NOT NULL;
        `);
        logger.info(
          "Created functional index on Llama business process",
          "DB_OPTIMIZATION",
        );

        // Index on Llama quality score for filtering high-quality results
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_llama_quality_score 
          ON email_analysis(json_extract(llama_analysis, '$.quality_score'))
          WHERE llama_analysis IS NOT NULL;
        `);
        logger.info(
          "Created functional index on Llama quality score",
          "DB_OPTIMIZATION",
        );

        // Index on Phi4 quality score
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_phi4_quality_score 
          ON email_analysis(json_extract(phi4_analysis, '$.quality_score'))
          WHERE phi4_analysis IS NOT NULL;
        `);
        logger.info(
          "Created functional index on Phi4 quality score",
          "DB_OPTIMIZATION",
        );
      } else {
        logger.warn(
          `SQLite version ${version} does not support JSON functional indexes (requires 3.45.0+)`,
          "DB_OPTIMIZATION",
        );
        logger.info("Basic indexes created successfully", "DB_OPTIMIZATION");
      }
    } catch (error) {
      logger.warn(
        "Could not create JSON functional indexes - SQLite version may not support them",
        "DB_OPTIMIZATION",
        error as Error,
      );
    }

    // Analyze tables to update query planner statistics
    db.exec("ANALYZE email_analysis;");
    logger.info("Updated query planner statistics", "DB_OPTIMIZATION");

    // Verify indexes were created
    const indexes = db
      .prepare(
        `
      SELECT name, sql FROM sqlite_master 
      WHERE type = 'index' 
      AND tbl_name = 'email_analysis'
      ORDER BY name;
    `,
      )
      .all();

    logger.info(
      `Created ${indexes.length} indexes on email_analysis table:`,
      "DB_OPTIMIZATION",
    );
    indexes.forEach((idx: any) => {
      logger.info(`  - ${idx.name}`, "DB_OPTIMIZATION");
    });

    // Check index usage with sample query
    const explainResult = db
      .prepare(
        `
      EXPLAIN QUERY PLAN
      SELECT * FROM email_analysis WHERE email_id = ?
    `,
      )
      .all("test");

    logger.info("Query plan for email_id lookup:", "DB_OPTIMIZATION");
    explainResult.forEach((row: any) => {
      logger.info(`  ${JSON.stringify(row)}`, "DB_OPTIMIZATION");
    });

    logger.info("Pipeline indexes created successfully", "DB_OPTIMIZATION");
  } catch (error) {
    logger.error(
      "Failed to create pipeline indexes",
      "DB_OPTIMIZATION",
      error as Error,
    );
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createPipelineIndexes()
    .then(() => {
      logger.info("Index creation completed", "DB_OPTIMIZATION");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("Index creation failed", "DB_OPTIMIZATION", error);
      process.exit(1);
    });
}
