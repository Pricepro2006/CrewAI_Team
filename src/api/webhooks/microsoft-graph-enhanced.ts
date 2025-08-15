import type { Request, Response } from "express";
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const { Queue } = require("bullmq") as any;
import { logger } from "../../utils/logger.js";
import * as crypto from "crypto";
import { metrics } from "../monitoring/metrics.js";

// Types for Microsoft Graph notifications
interface ChangeNotificationCollection {
  value: ChangeNotification[];
}

interface ChangeNotification {
  id: string;
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: string;
  resource: string;
  resourceData?: {
    "@odata.type": string;
    "@odata.id": string;
    "@odata.etag": string;
    id: string;
  };
  clientState: string;
  tenantId: string;
}

// Create a queue for processing email notifications
const emailQueue = new Queue("email-notifications", {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
});

// Validate webhook signature for security
function validateWebhookSignature(req: Request): boolean {
  const signature = req.headers["x-microsoft-signature"] as string;
  if (!signature) {
    logger.warn("Missing webhook signature");
    return false;
  }

  const secret = process.env.WEBHOOK_SIGNATURE_SECRET;
  if (!secret) {
    logger.error("WEBHOOK_SIGNATURE_SECRET not configured");
    return false;
  }

  // Microsoft uses HMAC-SHA1 for webhook signatures
  const expectedSignature = crypto
    .createHmac("sha1", secret)
    .update(JSON.stringify(req.body))
    .digest("base64");

  return signature === expectedSignature;
}

// Enhanced webhook handler for Microsoft Graph notifications
export const enhancedGraphWebhookHandler = async (
  req: Request,
  res: Response,
) => {
  const startTime = Date.now();

  try {
    // Handle validation token for new subscriptions
    const validationToken = req?.query?.validationToken as string;
    if (validationToken) {
      logger.info(
        "Validating Microsoft Graph webhook subscription",
        "WEBHOOK",
        {
          token: validationToken.substring(0, 10) + "...",
        },
      );
      metrics.increment("graph?.webhook?.validation");
      return res.send(validationToken);
    }

    // Validate webhook signature for security
    if (
      process.env.NODE_ENV === "production" &&
      !validateWebhookSignature(req)
    ) {
      logger.error("Invalid webhook signature", "WEBHOOK");
      metrics.increment("graph?.webhook?.invalid_signature");
      return res.status(401).send("Invalid signature");
    }

    // Verify client state for security
    const expectedClientState =
      process.env.WEBHOOK_CLIENT_STATE || "SecretClientState";

    // Process change notifications
    const notifications: ChangeNotificationCollection = req.body;

    if (!notifications || !notifications.value) {
      logger.warn("Invalid notification format received");
      metrics.increment("graph?.webhook?.invalid_format");
      return res.status(400).send("Invalid notification format");
    }

    logger.info(
      `Received ${notifications?.value?.length} notifications`,
      "WEBHOOK",
    );
    metrics.increment(
      "graph?.webhook?.notifications.batch",
      notifications?.value?.length,
    );

    // Queue each notification for processing
    const queuePromises = [];

    for (const notification of notifications.value) {
      // Verify client state
      if (notification.clientState !== expectedClientState) {
        logger.error("Invalid client state in notification", "WEBHOOK", {
          expected: expectedClientState,
          received: notification.clientState,
        });
        metrics.increment("graph?.webhook?.invalid_client_state");
        continue;
      }

      // Extract email metadata for better tracking
      const emailMetadata = extractEmailMetadata(notification);

      // Add to queue for processing
      const queuePromise = emailQueue.add(
        "process-email-notification",
        {
          type: "email-notification",
          notification,
          emailMetadata,
          timestamp: new Date().toISOString(),
          retryCount: 0,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: 1000, // Keep last 1000 completed jobs
          removeOnFail: 50, // Keep last 50 failed jobs
        },
      );

      queuePromises.push(queuePromise);

      logger.info("Queued email notification", "WEBHOOK", {
        subscriptionId: notification.subscriptionId,
        changeType: notification.changeType,
        resource: notification.resource,
        emailId: emailMetadata.emailId,
      });

      // Record metrics
      metrics.increment("graph?.webhook?.notifications.queued", 1, {
        changeType: notification.changeType,
        subscriptionId: notification.subscriptionId,
      });
    }

    // Wait for all notifications to be queued
    await Promise.all(queuePromises);

    // Record processing time
    const processingTime = Date.now() - startTime;
    metrics.histogram("graph?.webhook?.processing_time", processingTime);

    // Respond quickly (must be within 3 seconds for Microsoft Graph)
    return res.status(202).send();
  } catch (error) {
    logger.error(
      "Error processing Microsoft Graph webhook",
      "WEBHOOK",
      {},
      error instanceof Error ? error : new Error(String(error)),
    );
    metrics.increment("graph?.webhook?.error");

    // Still respond with 202 to prevent retry storms
    return res.status(202).send();
  }
};

// Extract email metadata from notification
function extractEmailMetadata(notification: ChangeNotification): EmailMetadata {
  const resourceParts = notification?.resource?.split("/");
  const emailId = resourceParts[resourceParts?.length || 0 - 1];
  const userId = resourceParts[1];

  return {
    emailId: emailId || "unknown",
    userId: userId || "unknown",
    mailbox: extractMailbox(notification.resource),
    changeType: notification.changeType,
    subscriptionId: notification.subscriptionId,
  };
}

// Extract mailbox from resource path
function extractMailbox(resource: string): string {
  // Resource format: users/{userId}/messages/{messageId}
  // or: users/{userId}/mailFolders/{folderId}/messages/{messageId}
  const match = resource.match(/users\/([^/]+)/);
  return match?.[1] || "unknown";
}

// Webhook route configuration
export const enhancedGraphWebhookRoutes = {
  path: "/api/webhooks/microsoft-graph",
  handler: enhancedGraphWebhookHandler,
  method: "POST",
};

// Queue monitoring and health check
export async function getWebhookQueueHealth() {
  const queueStats = await emailQueue.getJobCounts();
  const isPaused = await emailQueue.isPaused();

  return {
    queue: "email-notifications",
    stats: queueStats,
    isPaused,
    isHealthy: (queueStats.failed || 0) < 100 && !isPaused,
  };
}

// Types
interface EmailMetadata {
  emailId: string;
  userId: string;
  mailbox: string;
  changeType: string;
  subscriptionId: string;
}
