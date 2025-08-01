/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Worker } = require("bullmq") as any;
import { logger } from "../../utils/logger.js";
import { EmailAnalysisAgent } from "../agents/specialized/EmailAnalysisAgent.js";

// Worker configuration
const WORKER_CONCURRENCY = 5;

// Email notification data interface
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface EmailNotificationData {
  type: "email-notification";
  notification: {
    id: string;
    subscriptionId: string;
    changeType: string;
    resource: string;
    resourceData?: {
      id: string;
    };
    clientState: string;
    tenantId: string;
  };
  timestamp: string;
}

// Create email analysis agent instance
let emailAgent: EmailAnalysisAgent;

// Initialize the email agent
async function initializeEmailAgent() {
  if (!emailAgent) {
    emailAgent = new EmailAnalysisAgent();
    await emailAgent.initialize();
  }
  return emailAgent;
}

// Process email notification
async function processEmailNotification(job: any) {
  const { notification } = job.data;

  logger.info("Processing email notification", "EMAIL_WORKER", {
    notificationId: notification.id,
    changeType: notification.changeType,
    resource: notification.resource,
  });

  try {
    // Extract email ID from resource path
    const emailIdMatch = notification.resource.match(/messages\/(.+)$/);
    if (!emailIdMatch) {
      throw new Error("Invalid resource format - cannot extract email ID");
    }

    const emailId = emailIdMatch[1];
    const userIdMatch = notification.resource.match(
      /users\/(.+?)\/mailFolders/,
    );
    if (!userIdMatch) {
      throw new Error("Invalid resource format - cannot extract user ID");
    }

    const userId = userIdMatch[1];

    // Initialize email agent if needed
    const agent = await initializeEmailAgent();

    // Fetch the email from Microsoft Graph
    // Note: This would typically use the MCP server to fetch the email
    const emailData = {
      id: emailId,
      userId: userId,
      changeType: notification.changeType,
    };

    // Analyze the email
    const analysis = await agent.analyzeEmail(emailData as any);

    logger.info("Email analysis completed", "EMAIL_WORKER", {
      emailId,
      priority: analysis.priority,
      workflowState: analysis.workflowState,
      confidence: analysis.confidence,
    });

    // Emit real-time update via WebSocket
    // This would be integrated with the existing WebSocket service

    return {
      success: true,
      emailId,
      analysis,
    };
  } catch (error) {
    logger.error("Error processing email notification", "EMAIL_WORKER", {
      error: error instanceof Error ? error.message : String(error),
      notificationId: notification.id,
    });
    throw error;
  }
}

// Create the worker only if Redis is available
let emailNotificationWorker: any;

try {
  emailNotificationWorker = new Worker(
    "email-notifications",
    async (job: any) => {
      return await processEmailNotification(job);
    },
    {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      concurrency: WORKER_CONCURRENCY,
    },
  );

  // Worker event handlers
  emailNotificationWorker.on("completed", (job: any) => {
    logger.info("Email notification job completed", "EMAIL_WORKER", {
      jobId: job.id,
      emailId: (job as any).returnValue?.emailId,
    });
  });

  emailNotificationWorker.on("failed", (job: any | undefined, error: Error) => {
    logger.error("Email notification job failed", "EMAIL_WORKER", {
      jobId: job?.id,
      error: error.message,
    });
  });

  logger.info("Email notification worker started successfully", "EMAIL_WORKER");
} catch (error) {
  logger.warn("Email notification worker not started - Redis unavailable", "EMAIL_WORKER", {
    error: error instanceof Error ? error.message : String(error),
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  if (emailNotificationWorker) {
    logger.info(
      "SIGTERM received, closing email notification worker",
      "EMAIL_WORKER",
    );
    await emailNotificationWorker.close();
  }
});

export default emailNotificationWorker;
