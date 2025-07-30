import { EmailBatchProcessor } from "../src/core/processors/EmailBatchProcessor.js";
import { EmailAnalysisPipeline } from "../src/core/processors/EmailAnalysisPipeline.js";
import { EmailAnalysisAgent } from "../src/core/agents/specialized/EmailAnalysisAgent.js";
import { EmailAnalysisCache } from "../src/core/cache/EmailAnalysisCache.js";
import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { logger } from "../src/utils/logger.js";

// Write PID file
import { writeFileSync } from "fs";
import { resolve } from "path";

const pidFile = resolve(process.cwd(), "pids/email-pipeline.pid");
writeFileSync(pidFile, process.pid.toString());

// Helper function to parse recipients
function parseRecipients(
  recipientsStr: string | null,
): Array<{ emailAddress: { address: string; name: string } }> {
  if (!recipientsStr) return [];

  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(recipientsStr);
    if (Array.isArray(parsed)) {
      return parsed.map((r) => ({
        emailAddress: {
          address: typeof r === "string" ? r : r.address || r,
          name:
            typeof r === "string"
              ? r.split("@")[0]
              : r.name || r.address?.split("@")[0] || "Unknown",
        },
      }));
    }
  } catch {
    // If not JSON, treat as comma-separated string
    return recipientsStr.split(",").map((email) => ({
      emailAddress: {
        address: email.trim(),
        name: email.trim().split("@")[0],
      },
    }));
  }

  return [];
}

async function startEmailPipeline() {
  logger.info(
    "Starting Email Processing Pipeline (Simple Mode - No Redis)",
    "PIPELINE",
  );

  try {
    // Initialize components
    const analysisAgent = new EmailAnalysisAgent();
    const cache = new EmailAnalysisCache();
    const pipeline = new EmailAnalysisPipeline();
    const dbManager = getDatabaseManager();

    // Initialize only SQLite, skip ChromaDB for now
    try {
      await dbManager.initialize();
    } catch (error) {
      logger.warn(
        "Database initialization had warnings, continuing...",
        "PIPELINE",
      );
    }

    // Use the email repository from DatabaseManager
    const emailRepo = dbManager.emails;

    // Initialize batch processor
    const batchProcessor = new EmailBatchProcessor(analysisAgent, cache, {
      concurrency: 3,
      timeout: 30000,
      useCaching: true,
    });

    logger.info("Email Pipeline Started Successfully", "PIPELINE", {
      mode: "simple",
      batchConcurrency: 3,
      cacheEnabled: true,
    });

    // Process emails every 30 seconds
    const processEmails = async () => {
      try {
        // Get recent emails from database
        const result = await emailRepo.queryEmails({
          limit: 10,
          sortBy: "received_at",
          sortOrder: "desc",
        });

        // Transform database emails to the format expected by EmailAnalysisAgent
        const recentEmails = result.emails.map((dbEmail) => ({
          id: dbEmail.id,
          messageId: dbEmail.message_id || dbEmail.id,
          subject: dbEmail.subject,
          body: dbEmail.body_text || dbEmail.body_preview || "",
          bodyPreview:
            dbEmail.body_preview || dbEmail.body_text?.substring(0, 200) || "",
          from: {
            emailAddress: {
              name:
                dbEmail.sender_name ||
                dbEmail.sender_email?.split("@")[0] ||
                "Unknown",
              address: dbEmail.sender_email || "unknown@email.com",
            },
          },
          to: dbEmail.recipients ? parseRecipients(dbEmail.recipients) : [],
          receivedDateTime: dbEmail.received_at,
          hasAttachments: dbEmail.has_attachments || false,
          isRead: dbEmail.is_read || false,
          categories: dbEmail.categories ? JSON.parse(dbEmail.categories) : [],
          importance: dbEmail.importance || "normal",
          metadata: {
            folder: dbEmail.folder || "inbox",
            threadId: dbEmail.thread_id,
            conversationId: dbEmail.conversation_id,
          },
        }));

        // For now, process all recent emails (since we don't have analysis fields in the DB schema)
        // In a production system, you'd track processed emails separately
        const unprocessedEmails = recentEmails;

        if (unprocessedEmails.length > 0) {
          logger.info(
            `Processing ${unprocessedEmails.length} emails`,
            "PIPELINE",
          );

          // Process batch
          const results = await batchProcessor.processBatch(unprocessedEmails);

          // Log results
          const successful = results.filter((r) => r.success).length;
          logger.info(
            `Batch complete: ${successful}/${results.length} successful`,
            "PIPELINE",
          );
        }
      } catch (error) {
        logger.error("Error processing emails", "PIPELINE", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    // Initial processing
    await processEmails();

    // Schedule regular processing
    const interval = setInterval(processEmails, 30000);

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
      clearInterval(interval);
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
