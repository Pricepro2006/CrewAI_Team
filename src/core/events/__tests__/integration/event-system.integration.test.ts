import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import Redis from 'ioredis';
import { EventBus } from '../EventBus.js';
import { EventStore } from '../EventStore.js';
import { EventRouter } from '../EventRouter.js';
import { ServiceRegistry } from '../ServiceRegistry.js';
import { EventVersionManager } from '../EventVersioning.js';
import { EventReplayManager } from '../EventReplay.js';
import { EventMonitor } from '../EventMonitor.js';
import { CircuitBreaker, CircuitBreakerManager } from '../CircuitBreaker.js';

describe('Event System Integration Tests', () => {
  let redis: Redis;
  let eventBus: EventBus;
  let eventStore: EventStore;
  let eventRouter: EventRouter;
  let serviceRegistry: ServiceRegistry;
  let versionManager: EventVersionManager;
  let replayManager: EventReplayManager;
  let monitor: EventMonitor;
  let circuitBreakerManager: CircuitBreakerManager;

  beforeAll(async () => {
    // Setup Redis connection for testing
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      db: 15, // Use separate DB for testing
      lazyConnect: true
    });

    // Initialize all components
    eventStore = new EventStore({
      redis: { db: 15, keyPrefix: 'test_eventstore:' }
    });
    
    serviceRegistry = new ServiceRegistry({
      redis: { db: 15, keyPrefix: 'test_services:' }
    });
    
    eventBus = new EventBus({
      redis: { db: 15, keyPrefix: 'test_eventbus:' },
      services: { serviceRegistry }
    });
    
    eventRouter = new EventRouter();
    versionManager = new EventVersionManager();
    replayManager = new EventReplayManager(eventStore, serviceRegistry);
    monitor = new EventMonitor();
    circuitBreakerManager = new CircuitBreakerManager();

    // Connect all services
    await eventStore.connect();
    await serviceRegistry.connect();
    await eventBus.connect();
  });

  afterAll(async () => {
    // Cleanup
    await eventBus.shutdown();
    await serviceRegistry.shutdown();
    await eventStore.shutdown();
    await monitor.shutdown();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await redis.flushdb();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Event Flow', () => {
    it('should process events through the complete pipeline', async () => {
      // Setup monitoring
      const eventProcessed = vi.fn();
      monitor.on('events_retrieved', eventProcessed);

      // Register a service
      const serviceId = await serviceRegistry.registerService({
        name: 'test-service',
        version: '1.0.0',
        address: { host: 'localhost', port: 3000 },
        eventTypes: {
          publishes: ['test.created'],
          subscribes: ['test.updated']
        }
      });

      expect(serviceId).toBeDefined();

      // Add routing rule
      eventRouter.addRoutingTable({
        id: 'test-routing',
        name: 'Test Routing Table',
        rules: [
          {
            id: 'route-test-events',
            name: 'Route Test Events',
            priority: 100,
            enabled: true,
            conditions: {
              eventType: 'test.created'
            },
            actions: {
              route: [serviceId],
              enrich: { processedBy: 'test-router' }
            }
          }
        ],
        defaultRoute: []
      });

      // Register event handler
      const handlerCalled = vi.fn();
      await eventBus.subscribe('test.created', async (event: any) => {
        handlerCalled(event);
        monitor.recordEvent(event, { 
          processingStartTime: Date.now() - 10,
          processingEndTime: Date.now()
        });
      });

      // Publish event
      const testEvent = {
        type: 'test.created',
        payload: { id: '123', name: 'Test Item' },
        source: 'test-publisher',
        metadata: { version: '1.0' }
      };

      const eventId = await eventBus.publish(testEvent.type, testEvent.payload, {
        source: testEvent.source,
        metadata: testEvent.metadata
      });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event was handled
      expect(handlerCalled).toHaveBeenCalledTimes(1);
      expect(handlerCalled).toHaveBeenCalledWith(
        expect.objectContaining({
          id: eventId,
          type: 'test.created',
          payload: testEvent.payload,
          source: testEvent.source
        })
      );

      // Verify event was routed
      const routingResult = await eventRouter.routeEvent({
        id: eventId,
        type: 'test.created',
        source: 'test-publisher',
        timestamp: Date.now(),
        payload: testEvent.payload,
        metadata: testEvent.metadata
      });

      expect(routingResult.matched).toBe(true);
      expect(routingResult.routes).toContain(serviceId);
      expect(routingResult.transformedEvent?.metadata.processedBy).toBe('test-router');

      // Verify monitoring
      const metrics = monitor.getMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
      expect(metrics.eventsByType['test.created']).toBeGreaterThan(0);
    });

    it('should handle event versioning and transformation', async () => {
      // Register schemas
      versionManager.registerSchema({
        eventType: 'user.created',
        version: 1,
        schema: {
          payload: {
            id: 'string',
            name: 'string',
            email: 'string'
          },
          required: ['id', 'name', 'email']
        },
        compatibility: 'backward',
        createdBy: 'test'
      });

      versionManager.registerSchema({
        eventType: 'user.created',
        version: 2,
        schema: {
          payload: {
            id: 'string',
            fullName: 'string', // name -> fullName
            email: 'string',
            createdAt: 'number' // new field
          },
          required: ['id', 'fullName', 'email', 'createdAt']
        },
        compatibility: 'backward',
        createdBy: 'test'
      });

      // Register evolution rule
      versionManager.registerEvolutionRule({
        id: 'user-v1-to-v2',
        name: 'User V1 to V2',
        eventType: 'user.created',
        fromVersion: 1,
        toVersion: 2,
        transformType: 'upgrade',
        enabled: true,
        transformation: {
          fieldMappings: { name: 'fullName' },
          defaultValues: { createdAt: Date.now() },
          removedFields: [],
          addedFields: ['createdAt']
        }
      });

      // Create v1 event
      const v1Event = {
        id: 'evt-123',
        type: 'user.created',
        source: 'user-service',
        timestamp: Date.now(),
        payload: {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com'
        },
        metadata: {},
        schemaVersion: 1
      };

      // Transform to v2
      const transformResult = await versionManager.transformEvent(v1Event, 2, 'upgrade');

      expect(transformResult.success).toBe(true);
      expect(transformResult.transformedEvent).toBeDefined();
      expect(transformResult.transformedEvent!.schemaVersion).toBe(2);
      expect(transformResult.transformedEvent!.payload.fullName).toBe('John Doe');
      expect(transformResult.transformedEvent!.payload.createdAt).toBeDefined();
      expect(transformResult.transformedEvent!.payload.name).toBeUndefined();

      // Validate transformed event
      const validationResult = versionManager.validateEvent(transformResult.transformedEvent!, 2);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toEqual([]);
    });

    it('should store and replay events correctly', async () => {
      const streamId = 'test-stream:user-123';
      const events = [
        {
          id: 'evt-1',
          type: 'user.created',
          source: 'user-service',
          timestamp: Date.now(),
          payload: { id: 'user-123', name: 'John' },
          metadata: {}
        },
        {
          id: 'evt-2',
          type: 'user.updated',
          source: 'user-service',
          timestamp: Date.now() + 1000,
          payload: { id: 'user-123', name: 'John Doe' },
          metadata: {}
        },
        {
          id: 'evt-3',
          type: 'user.deleted',
          source: 'user-service',
          timestamp: Date.now() + 2000,
          payload: { id: 'user-123' },
          metadata: {}
        }
      ];

      // Store events
      const version = await eventStore.appendEvents(streamId, events);
      expect(version).toBe(3);

      // Retrieve events
      const retrievedEvents = await eventStore.getEvents({
        streamId,
        fromVersion: 0
      });

      expect(retrievedEvents).toHaveLength(3);
      expect(retrievedEvents[0].type).toBe('user.created');
      expect(retrievedEvents[2].type).toBe('user.deleted');

      // Create snapshot
      const snapshotData = {
        id: 'user-123',
        name: 'John Doe',
        deleted: true
      };

      const snapshotId = await eventStore.createSnapshot(
        streamId,
        snapshotData,
        version
      );
      expect(snapshotId).toBeDefined();

      // Retrieve snapshot
      const snapshot = await eventStore.getSnapshot(streamId);
      expect(snapshot).toBeDefined();
      expect(snapshot!.data).toEqual(snapshotData);
      expect(snapshot!.version).toBe(version);

      // Test replay
      const replayedEvents: any[] = [];
      const eventsProcessed = await eventStore.replayEvents(
        streamId,
        0,
        -1,
        async (event: any) => {
          replayedEvents.push(event);
        }
      );

      expect(eventsProcessed).toBe(3);
      expect(replayedEvents).toHaveLength(3);
      expect(replayedEvents?.map(e => e.type)).toEqual([
        'user.created',
        'user.updated',
        'user.deleted'
      ]);
    });

    it('should handle circuit breaker protection', async () => {
      const breakerName = 'test-service-calls';
      
      // Create a failing function
      let callCount = 0;
      const failingFunction = async () => {
        callCount++;
        if (callCount <= 5) {
          throw new Error('Service unavailable');
        }
        return 'success';
      };

      // Test circuit breaker with fallback
      const fallbackValue = 'fallback-result';
      let circuitOpened = false;
      let fallbackUsed = false;

      const breaker = circuitBreakerManager.getCircuitBreaker(breakerName, {
        failureThreshold: 3,
        timeout: 1000
      });

      breaker.on('state_changed', (data: any) => {
        if (data.to === 'open') {
          circuitOpened = true;
        }
      });

      // Execute multiple times to trigger circuit opening
      const results: (string | Error)[] = [];
      
      for (let i = 0; i < 8; i++) {
        try {
          const result = await circuitBreakerManager.execute(
            breakerName,
            failingFunction,
            { fallbackValue }
          );
          results.push(result);
          if (result === fallbackValue) {
            fallbackUsed = true;
          }
        } catch (error) {
          results.push(error as Error);
        }
        
        // Small delay between calls
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify circuit breaker behavior
      expect(circuitOpened).toBe(true);
      expect(fallbackUsed).toBe(true);
      
      const stats = breaker.getStats();
      expect(stats.failedRequests).toBeGreaterThan(0);
      expect(stats.rejectedRequests).toBeGreaterThan(0);

      // Wait for circuit to half-open and test recovery
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const recoveryResult = await circuitBreakerManager.execute(
        breakerName,
        async () => 'recovered'
      );
      
      expect(recoveryResult).toBe('recovered');
    });

    it('should handle complex event routing and filtering', async () => {
      // Add multiple routing tables with different priorities
      eventRouter.addRoutingTable({
        id: 'high-priority-routing',
        name: 'High Priority Routing',
        rules: [
          {
            id: 'critical-events',
            name: 'Critical Events',
            priority: 10, // High priority
            enabled: true,
            conditions: {
              metadata: { priority: 'critical' }
            },
            actions: {
              route: ['critical-service'],
              enrich: { urgent: true }
            }
          }
        ],
        defaultRoute: []
      });

      eventRouter.addRoutingTable({
        id: 'normal-routing',
        name: 'Normal Routing',
        rules: [
          {
            id: 'all-events',
            name: 'All Events',
            priority: 100, // Lower priority
            enabled: true,
            conditions: {},
            actions: {
              route: ['normal-service']
            }
          }
        ],
        defaultRoute: ['default-service']
      });

      // Add filters
      eventRouter.addFilter({
        id: 'sensitive-data-filter',
        name: 'Remove Sensitive Data',
        type: 'transform',
        enabled: true,
        conditions: {
          expression: 'event?.payload?.password || event?.payload?.secret'
        },
        action: {
          removeFields: ['payload.password', 'payload.secret'],
          addMetadata: { filtered: true }
        }
      });

      // Test critical event routing
      const criticalEvent = {
        id: 'crit-1',
        type: 'system.error',
        source: 'app',
        timestamp: Date.now(),
        payload: { error: 'Database connection failed' },
        metadata: { priority: 'critical' }
      };

      const criticalResult = await eventRouter.routeEvent(criticalEvent);
      expect(criticalResult.matched).toBe(true);
      expect(criticalResult.routes).toContain('critical-service');
      expect(criticalResult.transformedEvent?.metadata.urgent).toBe(true);

      // Test sensitive data filtering
      const sensitiveEvent = {
        id: 'sens-1',
        type: 'user.login',
        source: 'auth',
        timestamp: Date.now(),
        payload: { 
          username: 'john', 
          password: 'secret123',
          ip: '192.168.1.1'
        },
        metadata: {}
      };

      const filterResult = await eventRouter.filterEvent(sensitiveEvent);
      expect(filterResult.passed).toBe(true);
      expect(filterResult?.event?.payload.password).toBeUndefined();
      expect(filterResult?.event?.payload.username).toBe('john');
      expect(filterResult?.event?.metadata.filtered).toBe(true);

      // Test normal event routing
      const normalEvent = {
        id: 'norm-1',
        type: 'user.created',
        source: 'user-service',
        timestamp: Date.now(),
        payload: { id: 'user-456' },
        metadata: {}
      };

      const normalResult = await eventRouter.routeEvent(normalEvent);
      expect(normalResult.matched).toBe(true);
      expect(normalResult.routes).toContain('normal-service');
    });

    it('should coordinate service discovery with event routing', async () => {
      // Register multiple services
      const serviceIds = await Promise.all([
        serviceRegistry.registerService({
          name: 'user-service',
          version: '1.0.0',
          address: { host: 'localhost', port: 3001 },
          eventTypes: {
            publishes: ['user.created', 'user.updated'],
            subscribes: ['user.deleted']
          },
          capabilities: ['crud', 'validation']
        }),
        serviceRegistry.registerService({
          name: 'notification-service',
          version: '1.0.0',
          address: { host: 'localhost', port: 3002 },
          eventTypes: {
            subscribes: ['user.created', 'user.updated', 'user.deleted']
          },
          capabilities: ['email', 'sms']
        }),
        serviceRegistry.registerService({
          name: 'analytics-service',
          version: '1.0.0',
          address: { host: 'localhost', port: 3003 },
          eventTypes: {
            subscribes: ['user.created', 'user.updated']
          },
          capabilities: ['tracking', 'reporting']
        })
      ]);

      // Discover services by capability
      const crudServices = await serviceRegistry.discoverServices({
        capability: 'crud'
      });
      expect(crudServices).toHaveLength(1);
      expect(crudServices[0].name).toBe('user-service');

      const notificationServices = await serviceRegistry.discoverServices({
        capability: 'email'
      });
      expect(notificationServices).toHaveLength(1);
      expect(notificationServices[0].name).toBe('notification-service');

      // Discover services by event type
      const userCreatedSubscribers = await serviceRegistry.discoverServices({
        eventType: 'user.created'
      });
      expect(userCreatedSubscribers?.length || 0).toBeGreaterThanOrEqual(2);
      
      const subscriberNames = userCreatedSubscribers?.map(s => s.name);
      expect(subscriberNames).toContain('notification-service');
      expect(subscriberNames).toContain('analytics-service');

      // Test load balancing
      const healthyService = await serviceRegistry.getHealthyService('user-service');
      expect(healthyService).toBeDefined();
      expect(healthyService!.name).toBe('user-service');
      expect(healthyService!.status).toBe('healthy');

      // Test service registry stats
      const stats = serviceRegistry.getStats();
      expect(stats.totalServices).toBe(3);
      expect(stats.healthyServices).toBe(3);
      expect(stats).toBeDefined();
    });

    it('should handle replay manager with recovery scenarios', async () => {
      const streamId = 'recovery-test:order-789';
      
      // Store some events
      const events = Array.from({ length: 50 }, (_, i) => ({
        id: `evt-${i + 1}`,
        type: 'order.updated',
        source: 'order-service',
        timestamp: Date.now() + i * 1000,
        payload: { orderId: 'order-789', status: `status-${i + 1}` },
        metadata: { step: i + 1 }
      }));

      await eventStore.appendEvents(streamId, events);

      // Register replay configuration
      const configId = replayManager.registerReplayConfig({
        name: 'Order Recovery Replay',
        mode: 'incremental',
        target: {
          eventTypes: ['order.updated'],
          streamIds: [streamId]
        },
        options: {
          batchSize: 10,
          delayBetweenBatches: 50,
          createCheckpoints: true
        }
      });

      expect(configId).toBeDefined();

      // Start replay
      const sessionId = await replayManager.startReplay(configId);
      expect(sessionId).toBeDefined();

      // Monitor replay progress
      const progressUpdates: any[] = [];
      replayManager.on('replay_progress', (data: any) => {
        progressUpdates.push(data);
      });

      // Wait for replay to complete
      await new Promise((resolve: any) => {
        replayManager.on('replay_completed', resolve);
      });

      // Verify replay results
      const session = replayManager.getReplaySession(sessionId);
      expect(session).toBeDefined();
      expect(session!.status).toBe('completed');
      expect(session!.progress.totalEvents).toBe(50);
      expect(session!.progress.processedEvents).toBe(50);
      expect(progressUpdates?.length || 0).toBeGreaterThan(0);

      // Test pause and resume
      const pauseConfigId = replayManager.registerReplayConfig({
        name: 'Pausable Replay',
        mode: 'full',
        target: { streamIds: [streamId] },
        options: { batchSize: 5, delayBetweenBatches: 100 }
      });

      const pauseSessionId = await replayManager.startReplay(pauseConfigId);
      
      // Pause after a short time
      setTimeout(() => {
        replayManager.pauseReplay(pauseSessionId);
      }, 150);

      // Wait a bit then resume
      setTimeout(() => {
        replayManager.resumeReplay(pauseSessionId);
      }, 300);

      // Wait for completion
      await new Promise((resolve: any) => {
        replayManager.on('replay_completed', (data: any) => {
          if (data.sessionId === pauseSessionId) resolve(data);
        });
      });

      const pauseSession = replayManager.getReplaySession(pauseSessionId);
      expect(pauseSession!.status).toBe('completed');
    });

    it('should provide comprehensive monitoring and alerting', async () => {
      // Setup alert rules
      const highErrorRateAlertId = monitor.addAlertRule({
        name: 'High Error Rate Test',
        severity: 'critical',
        condition: {
          metric: 'health.errorRate',
          operator: '>',
          threshold: 0.3, // 30%
          duration: 100
        },
        actions: [
          { type: 'log', config: { level: 'error' } }
        ]
      });

      const lowThroughputAlertId = monitor.addAlertRule({
        name: 'Low Throughput Test',
        severity: 'warning',
        condition: {
          metric: 'throughput.current',
          operator: '<',
          threshold: 0.5,
          duration: 100
        },
        actions: [
          { type: 'log', config: { level: 'warn' } }
        ]
      });

      // Generate events with errors to trigger alerts
      for (let i = 0; i < 10; i++) {
        const event = {
          id: `test-${i}`,
          type: 'test.event',
          source: 'test',
          timestamp: Date.now(),
          payload: { index: i },
          metadata: {}
        };

        const hasError = i % 3 === 0; // 33% error rate
        monitor.recordEvent(event, {
          processingStartTime: Date.now() - 10,
          processingEndTime: Date.now(),
          error: hasError ? new Error(`Test error ${i}`) : undefined
        });
      }

      // Wait for metrics aggregation
      await new Promise(resolve => setTimeout(resolve, 150));

      // Check metrics
      const metrics = monitor.getMetrics();
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(10);
      expect(metrics?.health?.length).toBeGreaterThan(0.25);

      // Check if alerts were triggered
      const activeAlerts = monitor.getActiveAlerts();
      expect(activeAlerts?.length || 0).toBeGreaterThan(0);
      
      const criticalAlerts = activeAlerts?.filter(a => a.severity === 'critical');
      expect(criticalAlerts?.length || 0).toBeGreaterThan(0);

      // Test health status
      const health = monitor.getHealthStatus();
      expect(health.status).toBe('unhealthy'); // Due to high error rate
      expect(health.activeAlertsCount).toBeGreaterThan(0);

      // Test tracing
      const traceId = monitor.startTrace(
        {
          id: 'trace-test',
          type: 'test.traced',
          source: 'test',
          timestamp: Date.now(),
          payload: {},
          metadata: {}
        }
      );

      monitor.addSpan(traceId, 'database_query', Date.now(), Date.now() + 50, {
        query: 'SELECT * FROM users'
      });

      monitor.endTrace(traceId, true);

      const trace = monitor.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace!.status).toBe('success');
      expect(trace!.spans).toHaveLength(1);
      expect(trace!.spans[0].operationName).toBe('database_query');

      // Test dashboard data
      const dashboard = monitor.createDashboard();
      expect(dashboard?.overview?.length).toBeGreaterThan(0);
      expect(dashboard?.overview?.length).toBeGreaterThan(0);
      expect(dashboard?.errors?.length).toBeGreaterThan(0);
      expect(dashboard?.alerts?.active?.length || 0).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Create components with invalid Redis config
      const failingEventStore = new EventStore({
        redis: { host: 'nonexistent-host', port: 9999 }
      });

      // Test connection failure
      await expect(failingEventStore.connect()).rejects.toThrow();
      expect(failingEventStore.isHealthy()).toBe(false);

      // Verify it doesn't crash other components
      const metrics = monitor.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle event processing failures', async () => {
      const errorHandler = vi.fn();
      monitor.on('error_recorded', errorHandler);

      // Subscribe with failing handler
      await eventBus.subscribe('test.failing', async (event: any) => {
        throw new Error('Handler failure');
      });

      // Publish event
      await eventBus.publish('test.failing', { test: true });

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was recorded
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle concurrent operations safely', async () => {
      const streamId = 'concurrent-test:stream';
      
      // Create multiple concurrent append operations
      const promises = Array.from({ length: 10 }, async (_, i) => {
        const events = [{
          id: `concurrent-${i}`,
          type: 'concurrent.test',
          source: 'test',
          timestamp: Date.now(),
          payload: { index: i },
          metadata: {}
        }];

        return eventStore.appendEvents(streamId, events);
      });

      // Wait for all operations to complete
      const results = await Promise.allSettled(promises);
      
      // Some operations should succeed
      const successful = results?.filter(r => r.status === 'fulfilled');
      expect(successful?.length || 0).toBeGreaterThan(0);

      // Verify final state is consistent
      const finalEvents = await eventStore.getEvents({ streamId });
      expect(finalEvents?.length || 0).toBe(successful?.length || 0);
    });
  });
});

describe('Performance and Load Testing', () => {
  it('should handle high event throughput', async () => {
    const eventCount = 1000;
    const batchSize = 50;
    const startTime = Date.now();

    // Create test events in batches
    const batches = [];
    for (let i = 0; i < eventCount; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, eventCount - i) }, (_, j) => ({
        id: `perf-${i + j}`,
        type: 'performance.test',
        source: 'load-test',
        timestamp: Date.now(),
        payload: { index: i + j },
        metadata: {}
      }));
      batches.push(batch);
    }

    // Process batches concurrently
    const promises = batches?.map(async (batch, batchIndex) => {
      const streamId = `load-test:batch-${batchIndex}`;
      return eventStore.appendEvents(streamId, batch);
    });

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;
    const throughput = eventCount / (duration / 1000);

    console.log(`Processed ${eventCount} events in ${duration}ms (${throughput.toFixed(2)} events/sec)`);

    // Verify events were stored
    const totalStored = await Promise.all(
      batches?.map(async (_, batchIndex) => {
        const streamId = `load-test:batch-${batchIndex}`;
        const events = await eventStore.getEvents({ streamId });
        return events?.length || 0;
      })
    );

    const totalEvents = totalStored.reduce((sum: any, count: any) => sum + count, 0);
    expect(totalEvents).toBe(eventCount);
    
    // Should achieve reasonable throughput (adjust based on environment)
    expect(throughput).toBeGreaterThan(100); // At least 100 events/sec
  }, 30000); // 30 second timeout

  it('should handle memory efficiently with large payloads', async () => {
    const largePayload = {
      data: 'x'.repeat(10000), // 10KB payload
      array: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
    };

    const events = Array.from({ length: 100 }, (_, i) => ({
      id: `large-${i}`,
      type: 'large.payload',
      source: 'memory-test',
      timestamp: Date.now(),
      payload: { ...largePayload, index: i },
      metadata: {}
    }));

    const streamId = 'memory-test:large-payloads';
    
    // Monitor memory before
    const memBefore = process.memoryUsage();

    // Store events
    await eventStore.appendEvents(streamId, events);

    // Retrieve events
    const retrieved = await eventStore.getEvents({ streamId });

    // Monitor memory after
    const memAfter = process.memoryUsage();

    expect(retrieved).toHaveLength(100);
    expect(retrieved[0].payload).toBeDefined();

    // Memory increase should be reasonable (less than 100MB)
    const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});