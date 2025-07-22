import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import { ClientSecretCredential } from '@azure/identity';
import { logger } from '@/utils/logger';
import { metrics } from '../monitoring/metrics';
import { CronJob } from 'cron';

interface Subscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState: string;
}

interface SubscriptionConfig {
  resource: string;
  changeTypes: string[];
  includeResourceData?: boolean;
}

export class GraphSubscriptionManager {
  private graphClient: Client;
  private subscriptions: Map<string, Subscription> = new Map();
  private renewalJob: CronJob;
  private readonly MAX_SUBSCRIPTION_DURATION = 4230 * 60 * 1000; // 70.5 minutes in ms
  private readonly RENEWAL_BUFFER = 5 * 60 * 1000; // 5 minutes before expiry

  constructor() {
    this.initializeGraphClient();
    this.startRenewalJob();
  }

  private initializeGraphClient() {
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    this.graphClient = Client.initWithMiddleware({
      authProvider,
      defaultVersion: 'v1.0',
    });
  }

  /**
   * Create email subscription for a mailbox
   */
  async createEmailSubscription(mailbox: string, config?: Partial<SubscriptionConfig>): Promise<Subscription> {
    const defaultConfig: SubscriptionConfig = {
      resource: `users/${mailbox}/messages`,
      changeTypes: ['created', 'updated'],
      includeResourceData: false, // Requires additional permissions
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      const subscription = {
        changeType: finalConfig.changeTypes.join(','),
        notificationUrl: `${process.env.API_URL}/api/webhooks/microsoft-graph`,
        resource: finalConfig.resource,
        expirationDateTime: new Date(Date.now() + this.MAX_SUBSCRIPTION_DURATION).toISOString(),
        clientState: process.env.WEBHOOK_CLIENT_STATE || 'SecretClientState',
        includeResourceData: finalConfig.includeResourceData,
      };

      logger.info('Creating Graph subscription', 'GRAPH_SUBSCRIPTION', {
        resource: subscription.resource,
        changeTypes: subscription.changeType,
      });

      const result = await this.graphClient
        .api('/subscriptions')
        .post(subscription);

      this.subscriptions.set(result.id, result);
      
      logger.info('Graph subscription created', 'GRAPH_SUBSCRIPTION', {
        subscriptionId: result.id,
        expirationDateTime: result.expirationDateTime,
      });

      metrics.increment('graph.subscription.created');

      // Store subscription in database for persistence
      await this.storeSubscription(result);

      return result;

    } catch (error) {
      logger.error('Failed to create Graph subscription', 'GRAPH_SUBSCRIPTION', {
        mailbox,
        error: error instanceof Error ? error.message : String(error),
      });
      
      metrics.increment('graph.subscription.create_error');
      throw error;
    }
  }

  /**
   * Create subscriptions for multiple mailboxes
   */
  async createBulkEmailSubscriptions(mailboxes: string[]): Promise<Subscription[]> {
    const results: Subscription[] = [];
    const errors: Array<{ mailbox: string; error: string }> = [];

    for (const mailbox of mailboxes) {
      try {
        const subscription = await this.createEmailSubscription(mailbox);
        results.push(subscription);
      } catch (error) {
        errors.push({
          mailbox,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('Some subscriptions failed to create', 'GRAPH_SUBSCRIPTION', {
        successful: results.length,
        failed: errors.length,
        errors,
      });
    }

    return results;
  }

  /**
   * Renew a subscription before it expires
   */
  async renewSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        logger.warn('Subscription not found for renewal', 'GRAPH_SUBSCRIPTION', {
          subscriptionId,
        });
        return;
      }

      const newExpiration = new Date(Date.now() + this.MAX_SUBSCRIPTION_DURATION).toISOString();

      const updated = await this.graphClient
        .api(`/subscriptions/${subscriptionId}`)
        .patch({
          expirationDateTime: newExpiration,
        });

      this.subscriptions.set(subscriptionId, updated);

      logger.info('Subscription renewed', 'GRAPH_SUBSCRIPTION', {
        subscriptionId,
        newExpiration,
      });

      metrics.increment('graph.subscription.renewed');

      // Update stored subscription
      await this.updateStoredSubscription(updated);

    } catch (error) {
      logger.error('Failed to renew subscription', 'GRAPH_SUBSCRIPTION', {
        subscriptionId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      metrics.increment('graph.subscription.renew_error');
      
      // Remove failed subscription from tracking
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.graphClient
        .api(`/subscriptions/${subscriptionId}`)
        .delete();

      this.subscriptions.delete(subscriptionId);

      logger.info('Subscription deleted', 'GRAPH_SUBSCRIPTION', {
        subscriptionId,
      });

      metrics.increment('graph.subscription.deleted');

      // Remove from storage
      await this.removeStoredSubscription(subscriptionId);

    } catch (error) {
      logger.error('Failed to delete subscription', 'GRAPH_SUBSCRIPTION', {
        subscriptionId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      metrics.increment('graph.subscription.delete_error');
    }
  }

  /**
   * Get all active subscriptions
   */
  async getActiveSubscriptions(): Promise<Subscription[]> {
    try {
      const response = await this.graphClient
        .api('/subscriptions')
        .get();

      const activeSubscriptions = response.value.filter(
        (sub: Subscription) => new Date(sub.expirationDateTime) > new Date()
      );

      // Update local cache
      this.subscriptions.clear();
      activeSubscriptions.forEach((sub: Subscription) => {
        this.subscriptions.set(sub.id, sub);
      });

      return activeSubscriptions;

    } catch (error) {
      logger.error('Failed to get active subscriptions', 'GRAPH_SUBSCRIPTION', {
        error: error instanceof Error ? error.message : String(error),
      });
      
      return [];
    }
  }

  /**
   * Start automatic renewal job
   */
  private startRenewalJob() {
    // Run every 5 minutes
    this.renewalJob = new CronJob('*/5 * * * *', async () => {
      await this.renewExpiringSubscriptions();
    });

    this.renewalJob.start();
    logger.info('Subscription renewal job started', 'GRAPH_SUBSCRIPTION');
  }

  /**
   * Renew subscriptions that are about to expire
   */
  private async renewExpiringSubscriptions() {
    const now = Date.now();
    const renewalThreshold = now + this.RENEWAL_BUFFER;

    for (const [id, subscription] of this.subscriptions) {
      const expirationTime = new Date(subscription.expirationDateTime).getTime();
      
      if (expirationTime <= renewalThreshold) {
        logger.info('Subscription expiring soon, renewing', 'GRAPH_SUBSCRIPTION', {
          subscriptionId: id,
          expiresIn: Math.round((expirationTime - now) / 1000 / 60) + ' minutes',
        });

        await this.renewSubscription(id);
      }
    }
  }

  /**
   * Load subscriptions from storage on startup
   */
  async loadStoredSubscriptions(): Promise<void> {
    // Implementation depends on your storage solution
    // This is a placeholder for the actual implementation
    try {
      const stored = await this.getStoredSubscriptions();
      stored.forEach(sub => {
        this.subscriptions.set(sub.id, sub);
      });
      
      logger.info('Loaded stored subscriptions', 'GRAPH_SUBSCRIPTION', {
        count: stored.length,
      });
    } catch (error) {
      logger.error('Failed to load stored subscriptions', 'GRAPH_SUBSCRIPTION', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.renewalJob) {
      this.renewalJob.stop();
    }
    
    logger.info('Graph subscription manager shutdown', 'GRAPH_SUBSCRIPTION');
  }

  // Storage methods (implement based on your database)
  private async storeSubscription(subscription: Subscription): Promise<void> {
    // TODO: Implement database storage
  }

  private async updateStoredSubscription(subscription: Subscription): Promise<void> {
    // TODO: Implement database update
  }

  private async removeStoredSubscription(subscriptionId: string): Promise<void> {
    // TODO: Implement database removal
  }

  private async getStoredSubscriptions(): Promise<Subscription[]> {
    // TODO: Implement database retrieval
    return [];
  }
}

// Singleton instance
let instance: GraphSubscriptionManager | null = null;

export function getGraphSubscriptionManager(): GraphSubscriptionManager {
  if (!instance) {
    instance = new GraphSubscriptionManager();
  }
  return instance;
}