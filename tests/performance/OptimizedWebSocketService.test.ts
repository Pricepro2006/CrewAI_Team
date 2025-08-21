/**
 * Performance and Integration Tests for OptimizedWebSocketService
 * Validates memory optimizations, connection management, and throughput
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WebSocket, WebSocketServer } from 'ws';
import { OptimizedWebSocketService } from '../../src/api/services/OptimizedWebSocketService';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

describe('OptimizedWebSocketService - Performance Tests', () => {
  let service: OptimizedWebSocketService;
  let mockServer: any;
  let clients: WebSocket[] = [];

  beforeEach(() => {
    service = new OptimizedWebSocketService();
    mockServer = new EventEmitter();
    mockServer.address = () => ({ port: 8080 });
  });

  afterEach(async () => {
    // Cleanup all clients
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    clients = [];
    
    // Shutdown service
    await service.shutdown();
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    test('should handle 1000+ concurrent connections without memory leak', async () => {
      await service.initialize(mockServer);
      
      const initialMemory = process.memoryUsage().heapUsed;
      const connectionCount = 1000;
      const connections: WebSocket[] = [];

      // Create connections
      for (let i = 0; i < connectionCount; i++) {
        const ws = new WebSocket(`ws://localhost:8080/ws`);
        connections.push(ws);
        clients.push(ws);
      }

      // Wait for all connections
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check connection count
      const stats = service.getStats();
      expect(stats.connections).toBeGreaterThanOrEqual(connectionCount * 0.95); // Allow 5% failure

      // Close half the connections
      for (let i = 0; i < connectionCount / 2; i++) {
        connections[i].close();
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Check memory didn't grow excessively (allow 50MB growth)
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(50);

      // Verify proper cleanup
      const finalStats = service.getStats();
      expect(finalStats.connections).toBeLessThanOrEqual(connectionCount / 2 + 10);
    });

    test('should enforce max connections per user limit', async () => {
      await service.initialize(mockServer);
      
      const userId = 'test-user-123';
      const maxConnections = 5; // Default from config
      const connections: any[] = [];

      // Create max connections for user
      for (let i = 0; i < maxConnections + 2; i++) {
        const mockWs = {
          readyState: WebSocket.OPEN,
          send: jest.fn(),
          close: jest.fn(),
          on: jest.fn(),
          removeAllListeners: jest.fn(),
          ping: jest.fn(),
        };

        const mockReq = {
          socket: { remoteAddress: '127.0.0.1' },
          headers: { 'user-agent': 'test' },
        };

        // Simulate connection
        (service as any).handleConnection(mockWs, mockReq);
        
        // Authenticate connection
        const connectionId = (service as any).connections.keys().next().value;
        await (service as any).handleAuthenticate(connectionId, { userId, token: 'valid' });
        
        connections.push({ ws: mockWs, connectionId });
      }

      // Verify oldest connections were closed
      expect(connections[0].ws.close).toHaveBeenCalled();
      expect(connections[1].ws.close).toHaveBeenCalled();
      
      // Verify max limit enforced
      const userConns = (service as any).userConnections.get(userId);
      expect(userConns?.size).toBeLessThanOrEqual(maxConnections);
    });

    test('should cleanup idle connections after timeout', async () => {
      jest.useFakeTimers();
      await service.initialize(mockServer);

      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        ping: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'user-agent': 'test' },
      };

      // Create connection
      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      // Set last activity to past
      const metadata = (service as any).connectionMetadata.get(connectionId);
      metadata.lastActivity = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago

      // Trigger cleanup
      jest.advanceTimersByTime(60000); // Advance by cleanup interval

      // Verify connection was closed
      expect(mockWs.close).toHaveBeenCalledWith(1000, 'inactive');

      jest.useRealTimers();
    });
  });

  describe('Message Batching', () => {
    test('should batch messages efficiently', async () => {
      await service.initialize(mockServer);
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      // Send multiple messages within batch delay
      for (let i = 0; i < 5; i++) {
        service.send(connectionId, { type: 'test', data: i });
      }

      // Wait for batch delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Verify batched send
      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('batch');
      expect(sentData.payload.messages.length).toBe(5);
    });

    test('should flush immediately when batch size reached', async () => {
      await service.initialize(mockServer);
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      // Send messages up to batch size (10 by default)
      for (let i = 0; i < 10; i++) {
        service.send(connectionId, { type: 'test', data: i });
      }

      // Should flush immediately without waiting
      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.payload.messages.length).toBe(10);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should maintain <10ms average message latency', async () => {
      await service.initialize(mockServer);
      
      const latencies: number[] = [];
      const messageCount = 100;

      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn((data) => {
          const endTime = performance.now();
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            const latency = endTime - parsed.timestamp;
            latencies.push(latency);
          }
        }),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      // Send messages and measure latency
      for (let i = 0; i < messageCount; i++) {
        const startTime = performance.now();
        service.sendDirect(connectionId, { 
          type: 'test', 
          data: i,
          timestamp: startTime 
        });
      }

      // Calculate average latency
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(10);
    });

    test('should handle 10,000 msg/sec throughput', async () => {
      await service.initialize(mockServer);
      
      const targetThroughput = 10000;
      const testDuration = 1000; // 1 second
      let messagesSent = 0;

      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(() => { messagesSent++; }),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      const startTime = Date.now();
      
      // Send messages for 1 second
      while (Date.now() - startTime < testDuration) {
        service.sendDirect(connectionId, { type: 'test', data: messagesSent });
      }

      // Verify throughput (allow 10% variance)
      expect(messagesSent).toBeGreaterThan(targetThroughput * 0.9);
    });

    test('should maintain stable memory under load', async () => {
      await service.initialize(mockServer);
      
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;
      const connectionsPerIteration = 10;

      for (let i = 0; i < iterations; i++) {
        const connections: any[] = [];
        
        // Create connections
        for (let j = 0; j < connectionsPerIteration; j++) {
          const mockWs = {
            readyState: WebSocket.OPEN,
            send: jest.fn(),
            close: jest.fn(),
            on: jest.fn(),
            removeAllListeners: jest.fn(),
          };

          const mockReq = {
            socket: { remoteAddress: `127.0.0.${j}` },
            headers: {},
          };

          (service as any).handleConnection(mockWs, mockReq);
          connections.push(mockWs);
        }

        // Send some messages
        const connectionIds = Array.from((service as any).connections.keys());
        for (const connId of connectionIds) {
          service.send(connId, { type: 'test', iteration: i });
        }

        // Close connections
        for (const ws of connections) {
          ws.close();
        }

        // Clean up
        for (const connId of connectionIds) {
          (service as any).cleanupConnection(connId);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Check memory growth (should be minimal)
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowthMB = (finalMemory - initialMemory) / 1024 / 1024;
      
      // Memory growth should be less than 100MB for this load
      expect(memoryGrowthMB).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    test('should handle malformed messages gracefully', async () => {
      await service.initialize(mockServer);
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      // Send malformed message
      await (service as any).handleMessage(connectionId, 'not valid json{');

      // Should send error response
      expect(mockWs.send).toHaveBeenCalled();
      const response = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(response.type).toBe('error');
    });

    test('should handle rapid subscribe/unsubscribe cycles', async () => {
      await service.initialize(mockServer);
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      const topics = ['topic1', 'topic2', 'topic3'];
      
      // Rapid subscribe/unsubscribe
      for (let i = 0; i < 100; i++) {
        await (service as any).handleSubscribe(connectionId, { topics });
        await (service as any).handleUnsubscribe(connectionId, { topics });
      }

      // Verify no subscriptions remain
      const metadata = (service as any).connectionMetadata.get(connectionId);
      expect(metadata.subscriptions.size).toBe(0);
      
      // Verify topic subscriptions cleaned up
      for (const topic of topics) {
        const subscribers = (service as any).topicSubscriptions.get(topic);
        expect(subscribers).toBeUndefined();
      }
    });

    test('should recover from circuit breaker trips', async () => {
      const circuitBreakerManager = require('../../src/api/services/CircuitBreakerService').circuitBreakerManager;
      
      await service.initialize(mockServer);
      
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[0];

      // Force circuit breaker to open
      const breaker = circuitBreakerManager.create(`ws-message-${connectionId}`, {
        threshold: 1,
        timeout: 100,
      });

      // Cause failures to trip breaker
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test failure');
          });
        } catch {}
      }

      // Verify breaker is open
      expect(breaker.getState()).toBe('open');

      // Wait for half-open state
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should recover on success
      await breaker.execute(async () => true);
      expect(breaker.getState()).toBe('closed');
    });
  });
});

describe('OptimizedWebSocketService - Stress Tests', () => {
  let service: OptimizedWebSocketService;

  beforeEach(() => {
    service = new OptimizedWebSocketService();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  test('should handle connection flooding', async () => {
    const mockServer = new EventEmitter();
    await service.initialize(mockServer);

    const floodCount = 5000;
    const connections: any[] = [];

    const startTime = Date.now();

    // Flood with connections
    for (let i = 0; i < floodCount; i++) {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        close: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: `192.168.1.${i % 255}` },
        headers: {},
      };

      try {
        (service as any).handleConnection(mockWs, mockReq);
        connections.push(mockWs);
      } catch {
        // Connection rejected
      }
    }

    const duration = Date.now() - startTime;

    // Should handle flood in reasonable time (< 5 seconds)
    expect(duration).toBeLessThan(5000);

    // Should maintain reasonable connection count
    const stats = service.getStats();
    expect(stats.connections).toBeLessThanOrEqual(1000); // Service limit
  });

  test('should maintain performance during broadcast storms', async () => {
    const mockServer = new EventEmitter();
    await service.initialize(mockServer);

    // Create subscribers
    const subscriberCount = 100;
    const topic = 'broadcast-test';

    for (let i = 0; i < subscriberCount; i++) {
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockReq = {
        socket: { remoteAddress: `127.0.0.${i}` },
        headers: {},
      };

      (service as any).handleConnection(mockWs, mockReq);
      const connectionId = Array.from((service as any).connections.keys())[i];
      await (service as any).handleSubscribe(connectionId, { topics: [topic] });
    }

    // Broadcast storm
    const broadcastCount = 1000;
    const startTime = Date.now();

    for (let i = 0; i < broadcastCount; i++) {
      await service.broadcast(topic, { 
        type: 'broadcast', 
        data: `Message ${i}`,
        timestamp: Date.now() 
      });
    }

    const duration = Date.now() - startTime;
    const broadcastsPerSecond = (broadcastCount / duration) * 1000;

    // Should maintain > 100 broadcasts/second
    expect(broadcastsPerSecond).toBeGreaterThan(100);
  });
});