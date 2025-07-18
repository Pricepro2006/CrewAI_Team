import { Request, Response } from 'express';
import { Queue } from 'bullmq';
import { logger } from '../../utils/logger';

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
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
    id: string;
  };
  clientState: string;
  tenantId: string;
}

// Create a queue for processing email notifications
const emailQueue = new Queue('email-notifications', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

// Webhook handler for Microsoft Graph notifications
export const graphWebhookHandler = async (req: Request, res: Response) => {
  try {
    // Handle validation token for new subscriptions
    const validationToken = req.query.validationToken as string;
    if (validationToken) {
      logger.info('Validating Microsoft Graph webhook subscription', {
        token: validationToken.substring(0, 10) + '...',
      });
      return res.send(validationToken);
    }

    // Verify client state for security
    const expectedClientState = process.env.WEBHOOK_CLIENT_STATE || 'SecretClientState';
    
    // Process change notifications
    const notifications: ChangeNotificationCollection = req.body;
    
    if (!notifications || !notifications.value) {
      logger.warn('Invalid notification format received');
      return res.status(400).send('Invalid notification format');
    }

    logger.info(`Received ${notifications.value.length} notifications`);

    // Queue each notification for processing
    for (const notification of notifications.value) {
      // Verify client state
      if (notification.clientState !== expectedClientState) {
        logger.error('Invalid client state in notification', {
          expected: expectedClientState,
          received: notification.clientState,
        });
        continue;
      }

      // Add to queue for processing
      await emailQueue.add(
        'process-email-notification',
        {
          type: 'email-notification',
          notification,
          timestamp: new Date().toISOString(),
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Queued email notification', {
        subscriptionId: notification.subscriptionId,
        changeType: notification.changeType,
        resource: notification.resource,
      });
    }

    // Respond quickly (must be within 3 seconds for Microsoft Graph)
    res.status(202).send();
    
  } catch (error) {
    logger.error('Error processing Microsoft Graph webhook', error);
    // Still respond with 202 to prevent retry storms
    res.status(202).send();
  }
};

// Webhook route configuration
export const graphWebhookRoutes = {
  path: '/api/webhooks/microsoft-graph',
  handler: graphWebhookHandler,
  method: 'POST',
};