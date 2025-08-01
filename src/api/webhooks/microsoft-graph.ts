import type { Request, Response } from "express";
import { logger } from "../../utils/logger.js";

// Dynamic import for BullMQ
let emailQueue: any;

async function initializeBullMQ() {
  try {
    const bullmq = (await import("bullmq")) as any;

    // Create a queue for processing email notifications
    emailQueue = new bullmq.Queue("email-notifications", {
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
    });
  } catch (error) {
    logger.warn(
      "BullMQ not available, webhook functionality limited",
      "WEBHOOK",
    );
  }
}

// Initialize on module load
initializeBullMQ();

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

// Webhook handler for Microsoft Graph notifications
export const graphWebhookHandler = async (req: Request, res: Response) => {
  try {
    // Handle validation token for new subscriptions
    const validationToken = req.query.validationToken as string;
    if (validationToken) {
      logger.info(
        "Validating Microsoft Graph webhook subscription",
        "WEBHOOK",
        {
          token: validationToken.substring(0, 10) + "...",
        },
      );
      return res.send(validationToken);
    }

    // Verify client state for security
    const expectedClientState =
      process.env.WEBHOOK_CLIENT_STATE || "SecretClientState";

    // Process change notifications
    const notifications: ChangeNotificationCollection = req.body;

    if (!notifications || !notifications.value) {
      logger.warn("Invalid notification format received");
      return res.status(400).send("Invalid notification format");
    }

    logger.info(`Received ${notifications.value.length} notifications`);

    // Queue each notification for processing
    for (const notification of notifications.value) {
      // Verify client state
      if (notification.clientState !== expectedClientState) {
        logger.error("Invalid client state in notification", "WEBHOOK", {
          expected: expectedClientState,
          received: notification.clientState,
        });
        continue;
      }

      // Add to queue for processing if available
      if (emailQueue) {
        await emailQueue.add(
          "process-email-notification",
          {
            type: "email-notification",
            notification,
            timestamp: new Date().toISOString(),
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 2000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          },
        );

        logger.info("Queued email notification", "WEBHOOK", {
          subscriptionId: notification.subscriptionId,
          changeType: notification.changeType,
          resource: notification.resource,
        });
      } else {
        logger.warn("BullMQ not available, notification skipped", "WEBHOOK", {
          subscriptionId: notification.subscriptionId,
          changeType: notification.changeType,
        });
      }
    }

    // Respond quickly (must be within 3 seconds for Microsoft Graph)
    return res.status(202).send();
  } catch (error) {
    logger.error(
      "Error processing Microsoft Graph webhook",
      "WEBHOOK",
      {},
      error instanceof Error ? error : new Error(String(error)),
    );
    // Still respond with 202 to prevent retry storms
    return res.status(202).send();
  }
};

// Webhook route configuration
export const graphWebhookRoutes = {
  path: "/api/webhooks/microsoft-graph",
  handler: graphWebhookHandler,
  method: "POST",
};
