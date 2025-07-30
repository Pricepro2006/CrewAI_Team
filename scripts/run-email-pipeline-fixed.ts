import { EmailBatchProcessor } from "../src/core/processors/EmailBatchProcessor.js";
import { EmailAnalysisPipeline } from "../src/core/processors/EmailAnalysisPipeline.js";
import { EmailAnalysisAgent } from "../src/core/agents/specialized/EmailAnalysisAgent.js";
import { EmailAnalysisCache } from "../src/core/cache/EmailAnalysisCache.js";
import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { logger } from "../src/utils/logger.js";

// Write PID file
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const pidFile = resolve(process.cwd(), "pids/email-pipeline.pid");
mkdirSync(dirname(pidFile), { recursive: true });
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
  logger.info("Starting Email Processing Pipeline (Fixed Version)", "PIPELINE");

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
      mode: "fixed",
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

        // Transform database emails to the EXACT format expected by EmailAnalysisAgent
        const recentEmails = result.emails.map((dbEmail) => {
          // Ensure all required fields are present
          const transformedEmail = {
            id: dbEmail.id,
            messageId: dbEmail.message_id || dbEmail.id,
            subject: dbEmail.subject || "No Subject",
            body: dbEmail.body_text || dbEmail.body_preview || "",
            bodyPreview:
              dbEmail.body_preview ||
              dbEmail.body_text?.substring(0, 200) ||
              "",
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
            receivedDateTime: dbEmail.received_at || new Date().toISOString(),
            hasAttachments: dbEmail.has_attachments || false,
            isRead: dbEmail.is_read || false,
            categories: (() => {
              try {
                return dbEmail.categories ? JSON.parse(dbEmail.categories) : [];
              } catch {
                return [];
              }
            })(),
            importance: dbEmail.importance || "normal",
            metadata: {
              folder: dbEmail.folder || "inbox",
              threadId: dbEmail.thread_id,
              conversationId: dbEmail.conversation_id,
            },
          };

          // Log the transformed email structure for debugging
          logger.debug("Transformed email", "PIPELINE", {
            id: transformedEmail.id,
            hasFrom: !!transformedEmail.from,
            hasEmailAddress: !!transformedEmail.from?.emailAddress,
            fromAddress: transformedEmail.from?.emailAddress?.address,
          });

          return transformedEmail;
        });

        if (recentEmails.length > 0) {
          logger.info(`Processing ${recentEmails.length} emails`, "PIPELINE");

          // Process batch
          const results = await batchProcessor.processBatch(recentEmails);

          // Log results
          const successful = results.filter((r) => r.success).length;
          logger.info(
            `Batch complete: ${successful}/${results.length} successful`,
            "PIPELINE",
          );

          // If we have successful results, show one as an example
          const successfulResult = results.find((r) => r.success);
          if (successfulResult) {
            logger.info("Example successful analysis", "PIPELINE", {
              emailId: successfulResult.emailId,
              category: successfulResult.analysis?.category,
              priority: successfulResult.analysis?.priority,
              intent: successfulResult.analysis?.intent,
            });
          }
        }
      } catch (error) {
        logger.error("Error processing emails", "PIPELINE", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    };

    // Run immediately
    await processEmails();

    // Then run every 30 seconds
    setInterval(processEmails, 30000);

    // Keep the process running
    process.on("SIGTERM", () => {
      logger.info("Received SIGTERM, shutting down gracefully", "PIPELINE");
      process.exit(0);
    });

    process.on("SIGINT", () => {
      logger.info("Received SIGINT, shutting down gracefully", "PIPELINE");
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to start email pipeline", "PIPELINE", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Start the pipeline
startEmailPipeline().catch((error) => {
  logger.error("Unhandled error in email pipeline", "PIPELINE", { error });
  process.exit(1);
});
