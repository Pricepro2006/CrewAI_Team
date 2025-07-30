import { EmailQueueProcessor } from "../src/core/processors/EmailQueueProcessor.js";
import { EmailBatchProcessor } from "../src/core/processors/EmailBatchProcessor.js";
import { EmailAnalysisPipeline } from "../src/core/processors/EmailAnalysisPipeline.js";
import { EmailAnalysisAgent } from "../src/core/agents/specialized/EmailAnalysisAgent.js";
import { EmailAnalysisCache } from "../src/core/cache/EmailAnalysisCache.js";
import { logger } from "../src/utils/logger.js";

// Write PID file
import { writeFileSync } from "fs";
import { resolve } from "path";

const pidFile = resolve(process.cwd(), "pids/email-pipeline.pid");
writeFileSync(pidFile, process.pid.toString());

async function startEmailPipeline() {
  logger.info(
    "Starting Email Processing Pipeline (Development Mode)",
    "PIPELINE",
  );

  try {
    // Initialize components
    const analysisAgent = new EmailAnalysisAgent();
    const cache = new EmailAnalysisCache();
    const pipeline = new EmailAnalysisPipeline();

    // Initialize batch processor
    const batchProcessor = new EmailBatchProcessor(analysisAgent, cache, {
      concurrency: 3, // Lower for dev mode
      timeout: 30000,
      useCaching: true,
    });

    // Initialize queue processor
    const queueProcessor = new EmailQueueProcessor({
      concurrency: 3,
      maxRetries: 2,
    });

    // Start processing
    await queueProcessor.start();

    logger.info("Email Pipeline Started Successfully", "PIPELINE", {
      mode: "development",
      batchConcurrency: 3,
      queueConcurrency: 3,
      cacheEnabled: true,
    });

    // Log stats every minute
    setInterval(() => {
      const stats = batchProcessor.getStats();
      logger.info("Pipeline Statistics", "PIPELINE", {
        queue: stats.queue,
        cache: stats.cache,
      });
    }, 60000);

    // Set up graceful shutdown
    const shutdown = async () => {
      logger.info("Shutting down email pipeline...", "PIPELINE");
      await queueProcessor.stop();
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    logger.error("Failed to start email pipeline", "PIPELINE", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Start the pipeline
startEmailPipeline().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
