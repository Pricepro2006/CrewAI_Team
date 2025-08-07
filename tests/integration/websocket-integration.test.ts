import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { WebSocketGateway } from '../../src/api/websocket/WebSocketGateway.js';
import { MessageBatcher } from '../../src/api/websocket/MessageBatcher.js';
import { ConnectionManager } from '../../src/api/websocket/ConnectionManager.js';
import { SubscriptionManager } from '../../src/api/websocket/SubscriptionManager.js';
import { EventBroadcaster } from '../../src/api/websocket/EventBroadcaster.js';
import { WebSocketMonitor } from '../../src/api/websocket/WebSocketMonitor.js';
import { EventBus, BaseEvent } from '../../src/core/events/EventBus.js';
import { EventMonitor } from '../../src/core/events/EventMonitor.js';
import { CircuitBreakerManager } from '../../src/core/events/CircuitBreaker.js';

/**
 * WebSocket Integration Tests
 * 
 * Comprehensive end-to-end tests validating the complete WebSocket API gateway
 * functionality including connection management, authentication, subscription
 * routing, message batching, event broadcasting, and performance monitoring.
 */
describe('WebSocket Integration Tests', () => {
  // Test infrastructure
  let redis: Redis;
  let eventBus: EventBus;
  let eventMonitor: EventMonitor;
  let circuitBreaker: CircuitBreakerManager;
  
  // WebSocket components
  let gateway: WebSocketGateway;
  let batcher: MessageBatcher;
  let connectionManager: ConnectionManager;
  let subscriptionManager: SubscriptionManager;
  let broadcaster: EventBroadcaster;
  let monitor: WebSocketMonitor;
  
  // Test clients
  let testClients: WebSocket[] = [];
  let testPort = 8080;

  beforeAll(async () => {
    // Setup Redis for testing
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Use separate DB for tests
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    await redis.connect();
    await redis.flushdb(); // Clear test database

    // Initialize core components
    eventBus = new EventBus(redis);
    eventMonitor = new EventMonitor();
    circuitBreaker = new CircuitBreakerManager();

    // Initialize WebSocket components
    batcher = new MessageBatcher({
      redis: { db: 15 },
      batching: {
        defaultStrategy: 'hybrid',
        defaultMaxSize: 5,
        defaultMaxWait: 500
      }
    }, redis);

    connectionManager = new ConnectionManager({
      security: {
        jwtSecret: 'test-secret-key',
        enableApiKeys: true,
        requireAuth: false // Disable for easier testing
      },
      rateLimiting: {
        enabled: true,
        windowMs: 60000,
        maxRequests: 100
      }
    }, redis);

    subscriptionManager = new SubscriptionManager(batcher, connectionManager);

    broadcaster = new EventBroadcaster(
      {
        redis: { db: 15 },
        scaling: { enabled: true },
        performance: { maxConcurrentBroadcasts: 50 }
      },
      redis,
      eventBus,
      eventMonitor,
      circuitBreaker,
      gateway as any, // Will be set after gateway creation
      batcher,
      connectionManager,
      subscriptionManager
    );

    gateway = new WebSocketGateway({
      port: testPort,
      redis: { db: 15 },
      authentication: { required: false },
      rateLimiting: { enabled: false }, // Disable for testing
      monitoring: { enabled: true }
    }, connectionManager, subscriptionManager, batcher, broadcaster);

    monitor = new WebSocketMonitor(
      { enabled: true, metricsInterval: 1000 },
      eventMonitor,
      gateway,
      batcher,
      connectionManager,
      subscriptionManager,
      broadcaster
    );

    // Update broadcaster reference to gateway
    (broadcaster as any).gateway = gateway;

    // Start the WebSocket server
    await gateway.start();
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Cleanup all test clients
    for (const client of testClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }

    // Shutdown components
    await gateway.shutdown();
    await broadcaster.shutdown();
    await monitor.shutdown();
    await subscriptionManager.shutdown();
    
    // Cleanup Redis
    await redis.flushdb();
    await redis.disconnect();
  });

  beforeEach(() => {
    testClients = [];
  });

  afterEach(async () => {
    // Clean up clients after each test
    for (const client of testClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    testClients = [];
    
    // Wait for connections to close
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('Connection Management', () => {
    it('should accept WebSocket connections', async () => {
      const client = await createTestClient();
      
      expect(client.readyState).toBe(WebSocket.OPEN);
      
      const stats = connectionManager.getStats();
      expect(stats.active).toBeGreaterThan(0);
    });

    it('should handle connection authentication', async () => {
      // Update config to require auth
      connectionManager.updateConfig({ 
        security: { requireAuth: true, jwtSecret: 'test-secret' }
      });

      const client = new WebSocket(`ws://localhost:${testPort}`);
      
      await new Promise((resolve) => {
        client.on('close', (code) => {
          expect(code).toBe(4001); // Authentication required
          resolve(void 0);
        });
      });

      // Reset auth for other tests
      connectionManager.updateConfig({ 
        security: { requireAuth: false }
      });
    });

    it('should track connection metrics', async () => {
      const initialStats = connectionManager.getStats();
      
      const client1 = await createTestClient();
      const client2 = await createTestClient();
      
      const updatedStats = connectionManager.getStats();
      expect(updatedStats.total).toBe(initialStats.total + 2);
      expect(updatedStats.active).toBe(initialStats.active + 2);
    });
  });

  describe('Subscription Management', () => {
    it('should handle subscription requests', async () => {
      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send subscription request
      const subscription = {
        type: 'subscribe',
        payload: {
          id: 'test-sub-1',
          eventTypes: ['test.event'],
          filters: { source: 'test' }
        }
      };

      client.send(JSON.stringify(subscription));
      
      // Wait for subscription confirmation
      await waitForMessage(messages, m => m.type === 'subscription_confirmed');
      
      const confirmMessage = messages.find(m => m.type === 'subscription_confirmed');
      expect(confirmMessage).toBeDefined();
      expect(confirmMessage.payload.subscriptionId).toBe('test-sub-1');
    });

    it('should route events to subscribers', async () => {
      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Subscribe to events
      await subscribeClient(client, 'route-sub-1', ['user.created']);
      
      // Create and route an event
      const testEvent: BaseEvent = {
        id: 'test-event-1',
        type: 'user.created',
        source: 'test-service',
        timestamp: Date.now(),
        payload: { userId: '123', name: 'Test User' },
        metadata: {}
      };

      await subscriptionManager.routeEvent(testEvent);
      
      // Wait for event delivery
      await waitForMessage(messages, m => m.type === 'event');
      
      const eventMessage = messages.find(m => m.type === 'event');
      expect(eventMessage).toBeDefined();
      expect(eventMessage.payload.event.type).toBe('user.created');
      expect(eventMessage.payload.event.payload.userId).toBe('123');
    });

    it('should apply event filters correctly', async () => {
      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Subscribe with specific source filter
      const subscription = {
        type: 'subscribe',
        payload: {
          id: 'filter-sub-1',
          eventTypes: ['order.*'],
          filters: { source: 'order-service' }
        }
      };

      client.send(JSON.stringify(subscription));
      await waitForMessage(messages, m => m.type === 'subscription_confirmed');

      // Send matching event
      const matchingEvent: BaseEvent = {
        id: 'matching-1',
        type: 'order.created',
        source: 'order-service',
        timestamp: Date.now(),
        payload: { orderId: '456' },
        metadata: {}
      };

      // Send non-matching event
      const nonMatchingEvent: BaseEvent = {
        id: 'non-matching-1',
        type: 'order.created',
        source: 'payment-service',
        timestamp: Date.now(),
        payload: { orderId: '789' },
        metadata: {}
      };

      await subscriptionManager.routeEvent(matchingEvent);
      await subscriptionManager.routeEvent(nonMatchingEvent);

      // Wait for potential messages
      await new Promise(resolve => setTimeout(resolve, 100));

      const eventMessages = messages.filter(m => m.type === 'event');
      expect(eventMessages).toHaveLength(1);
      expect(eventMessages[0].payload.event.payload.orderId).toBe('456');
    });
  });

  describe('Message Batching', () => {
    it('should batch messages when enabled', async () => {
      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Subscribe with batching enabled
      const subscription = {
        type: 'subscribe',
        payload: {
          id: 'batch-sub-1',
          eventTypes: ['batch.test'],
          options: { batching: true, batchSize: 3, batchTimeout: 1000 }
        }
      };

      client.send(JSON.stringify(subscription));
      await waitForMessage(messages, m => m.type === 'subscription_confirmed');

      // Send multiple events quickly
      for (let i = 1; i <= 5; i++) {
        const event: BaseEvent = {
          id: `batch-event-${i}`,
          type: 'batch.test',
          source: 'test',
          timestamp: Date.now(),
          payload: { count: i },
          metadata: {}
        };
        
        await subscriptionManager.routeEvent(event);
      }

      // Wait for batches
      await new Promise(resolve => setTimeout(resolve, 1500));

      const batchMessages = messages.filter(m => m.type === 'batch');
      expect(batchMessages.length).toBeGreaterThan(0);
      
      // Check first batch contains multiple events
      const firstBatch = batchMessages[0];
      expect(firstBatch.payload.events).toHaveLength(3);
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast events to all relevant subscribers', async () => {
      const client1 = await createTestClient();
      const client2 = await createTestClient();
      const messages1: any[] = [];
      const messages2: any[] = [];
      
      client1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      client2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      // Subscribe both clients to the same event type
      await subscribeClient(client1, 'broadcast-sub-1', ['notification.sent']);
      await subscribeClient(client2, 'broadcast-sub-2', ['notification.sent']);

      // Broadcast an event
      const result = await broadcaster.broadcastToSubscribers(
        'notification.sent',
        { message: 'Hello World', recipient: 'all' }
      );

      expect(result.success).toBe(true);
      expect(result.totalRecipients).toBeGreaterThan(0);

      // Wait for event delivery
      await Promise.all([
        waitForMessage(messages1, m => m.type === 'event'),
        waitForMessage(messages2, m => m.type === 'event')
      ]);

      expect(messages1.some(m => m.type === 'event')).toBe(true);
      expect(messages2.some(m => m.type === 'event')).toBe(true);
    });

    it('should handle targeted user broadcasts', async () => {
      const client1 = await createTestClient();
      const client2 = await createTestClient();
      const messages1: any[] = [];
      const messages2: any[] = [];
      
      client1.on('message', (data) => messages1.push(JSON.parse(data.toString())));
      client2.on('message', (data) => messages2.push(JSON.parse(data.toString())));

      // Subscribe both clients
      await subscribeClient(client1, 'user-sub-1', ['user.notification']);
      await subscribeClient(client2, 'user-sub-2', ['user.notification']);

      // Broadcast to specific user (simulate by targeting specific connection)
      const targetEvent: BaseEvent = {
        id: 'targeted-event',
        type: 'user.notification',
        source: 'notification-service',
        timestamp: Date.now(),
        payload: { message: 'Personal message' },
        metadata: { targetUsers: [connectionManager.getConnections()[0].id] }
      };

      await broadcaster.broadcastEvent(targetEvent);

      // Wait for potential delivery
      await new Promise(resolve => setTimeout(resolve, 200));

      const totalEventMessages = messages1.filter(m => m.type === 'event').length +
                                messages2.filter(m => m.type === 'event').length;
      
      // Should deliver to at least one client
      expect(totalEventMessages).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect connection metrics', async () => {
      const initialMetrics = monitor.getCurrentMetrics();
      
      // Create some connections
      const client1 = await createTestClient();
      const client2 = await createTestClient();
      
      // Wait for metrics update
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for metrics interval
      
      const updatedMetrics = monitor.getCurrentMetrics();
      
      expect(updatedMetrics.connections.active).toBeGreaterThan(initialMetrics.connections.active);
    });

    it('should perform health checks', async () => {
      const healthResult = await monitor.performManualHealthCheck();
      
      expect(healthResult.status).toMatch(/healthy|degraded|unhealthy/);
      expect(healthResult.score).toBeGreaterThanOrEqual(0);
      expect(healthResult.score).toBeLessThanOrEqual(100);
      expect(healthResult.checks).toBeInstanceOf(Array);
      expect(healthResult.checks.length).toBeGreaterThan(0);
    });

    it('should export metrics in different formats', () => {
      const jsonMetrics = monitor.exportMetrics('json');
      expect(() => JSON.parse(jsonMetrics)).not.toThrow();
      
      const csvMetrics = monitor.exportMetrics('csv');
      expect(csvMetrics).toContain('timestamp');
      
      const prometheusMetrics = monitor.exportMetrics('prometheus');
      expect(prometheusMetrics).toContain('ws_connections_total');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle connection drops gracefully', async () => {
      const client = await createTestClient();
      
      // Subscribe to events
      await subscribeClient(client, 'drop-sub-1', ['test.event']);
      
      const initialSubscriptions = subscriptionManager.getMetrics().subscriptionCount;
      
      // Force close the connection
      client.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Subscription should be cleaned up
      const finalSubscriptions = subscriptionManager.getMetrics().subscriptionCount;
      expect(finalSubscriptions).toBeLessThan(initialSubscriptions);
    });

    it('should handle malformed messages', async () => {
      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => messages.push(JSON.parse(data.toString())));
      
      // Send malformed JSON
      client.send('invalid json}');
      
      // Send invalid message structure
      client.send(JSON.stringify({ type: 'invalid', missing: 'payload' }));
      
      // Wait for error messages
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still be connected (graceful error handling)
      expect(client.readyState).toBe(WebSocket.OPEN);
    });

    it('should respect rate limits', async () => {
      // Enable rate limiting
      connectionManager.updateConfig({
        rateLimiting: {
          enabled: true,
          windowMs: 1000,
          maxRequests: 3
        }
      });

      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => messages.push(JSON.parse(data.toString())));
      
      // Send multiple messages rapidly
      for (let i = 0; i < 5; i++) {
        client.send(JSON.stringify({
          type: 'subscribe',
          payload: { id: `rate-limit-${i}`, eventTypes: ['test'] }
        }));
      }
      
      // Wait for responses
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should have received rate limit errors
      const errorMessages = messages.filter(m => m.type === 'error');
      expect(errorMessages.length).toBeGreaterThan(0);
      
      // Reset rate limiting
      connectionManager.updateConfig({
        rateLimiting: { enabled: false }
      });
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete event workflow', async () => {
      const client = await createTestClient();
      const messages: any[] = [];
      
      client.on('message', (data) => messages.push(JSON.parse(data.toString())));
      
      // 1. Subscribe to events
      await subscribeClient(client, 'e2e-sub', ['order.created', 'order.updated']);
      
      // 2. Publish events through the event bus
      const orderCreatedEvent: BaseEvent = {
        id: 'order-123',
        type: 'order.created',
        source: 'order-service',
        timestamp: Date.now(),
        payload: { orderId: '123', userId: 'user-456', amount: 99.99 },
        metadata: { version: '1.0' }
      };
      
      await eventBus.publish(orderCreatedEvent);
      
      // 3. Wait for event delivery
      await waitForMessage(messages, m => m.type === 'event' && m.payload.event.type === 'order.created');
      
      // 4. Verify event was received correctly
      const receivedEvent = messages.find(m => 
        m.type === 'event' && m.payload.event.type === 'order.created'
      );
      
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.payload.event.payload.orderId).toBe('123');
      expect(receivedEvent.payload.event.payload.amount).toBe(99.99);
      
      // 5. Update order and verify update is received
      const orderUpdatedEvent: BaseEvent = {
        id: 'order-123-update',
        type: 'order.updated',
        source: 'order-service',
        timestamp: Date.now(),
        payload: { orderId: '123', status: 'shipped' },
        metadata: { version: '1.1' }
      };
      
      await eventBus.publish(orderUpdatedEvent);
      
      await waitForMessage(messages, m => m.type === 'event' && m.payload.event.type === 'order.updated');
      
      const updateEvent = messages.find(m => 
        m.type === 'event' && m.payload.event.type === 'order.updated'
      );
      
      expect(updateEvent).toBeDefined();
      expect(updateEvent.payload.event.payload.status).toBe('shipped');
    });

    it('should handle multiple clients with different subscriptions', async () => {
      // Create multiple clients with different interests
      const orderClient = await createTestClient();
      const userClient = await createTestClient();
      const adminClient = await createTestClient();
      
      const orderMessages: any[] = [];
      const userMessages: any[] = [];
      const adminMessages: any[] = [];
      
      orderClient.on('message', (data) => orderMessages.push(JSON.parse(data.toString())));
      userClient.on('message', (data) => userMessages.push(JSON.parse(data.toString())));
      adminClient.on('message', (data) => adminMessages.push(JSON.parse(data.toString())));
      
      // Subscribe to different event types
      await subscribeClient(orderClient, 'order-client', ['order.*']);
      await subscribeClient(userClient, 'user-client', ['user.*']);
      await subscribeClient(adminClient, 'admin-client', ['order.*', 'user.*', 'system.*']);
      
      // Publish various events
      const events: BaseEvent[] = [
        {
          id: 'event-1',
          type: 'order.created',
          source: 'order-service',
          timestamp: Date.now(),
          payload: { orderId: '001' },
          metadata: {}
        },
        {
          id: 'event-2',
          type: 'user.registered',
          source: 'auth-service',
          timestamp: Date.now(),
          payload: { userId: '001' },
          metadata: {}
        },
        {
          id: 'event-3',
          type: 'system.maintenance',
          source: 'system',
          timestamp: Date.now(),
          payload: { message: 'Scheduled maintenance' },
          metadata: {}
        }
      ];
      
      // Publish all events
      for (const event of events) {
        await broadcaster.broadcastEvent(event);
      }
      
      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify selective delivery
      const orderEventCount = orderMessages.filter(m => m.type === 'event').length;
      const userEventCount = userMessages.filter(m => m.type === 'event').length;
      const adminEventCount = adminMessages.filter(m => m.type === 'event').length;
      
      expect(orderEventCount).toBe(1); // Only order events
      expect(userEventCount).toBe(1); // Only user events
      expect(adminEventCount).toBe(3); // All events
    });
  });

  // Helper functions
  async function createTestClient(): Promise<WebSocket> {
    const client = new WebSocket(`ws://localhost:${testPort}`);
    testClients.push(client);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);
      
      client.on('open', () => {
        clearTimeout(timeout);
        resolve(client);
      });
      
      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  async function subscribeClient(
    client: WebSocket, 
    subscriptionId: string, 
    eventTypes: string[]
  ): Promise<void> {
    const messages: any[] = [];
    
    const messageHandler = (data: any) => {
      messages.push(JSON.parse(data.toString()));
    };
    
    client.on('message', messageHandler);
    
    const subscription = {
      type: 'subscribe',
      payload: {
        id: subscriptionId,
        eventTypes,
        filters: {}
      }
    };
    
    client.send(JSON.stringify(subscription));
    
    // Wait for subscription confirmation
    await waitForMessage(messages, m => m.type === 'subscription_confirmed');
    
    client.removeListener('message', messageHandler);
  }
  
  async function waitForMessage(
    messages: any[], 
    condition: (message: any) => boolean,
    timeoutMs: number = 2000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (messages.some(condition)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error(`Timeout waiting for message matching condition after ${timeoutMs}ms`);
  }
});