import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketService } from '../WebSocketService';
import { EventEmitter } from "events";
import type { AuthenticatedWebSocket } from '../../middleware/websocketAuth';
import type { Event, CloseEvent, ErrorEvent, MessageEvent } from "ws";
import { MockWebSocket, TestCallback } from '../../../shared/types/test.types';
import { JSONObject } from '../../../shared/types/utility.types';

// Mock logger
vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Memory leak tests for WebSocketService
 * These tests verify that resources are properly cleaned up
 */
describe("WebSocketService - Memory Leak Prevention", () => {
  let wsService: WebSocketService;

  beforeEach(() => {
    wsService = new WebSocketService();
  });

  afterEach(() => {
    wsService.shutdown();
  });

  // Mock WebSocket implementation
  class MockWebSocketImpl extends EventEmitter implements AuthenticatedWebSocket {
    readyState: 0 | 1 | 2 | 3 = 1; // OPEN
    readonly OPEN = 1 as const;
    readonly CONNECTING = 0 as const;
    readonly CLOSING = 2 as const;
    readonly CLOSED = 3 as const;
    isAuthenticated = false;
    clientId?: string;
    userId?: string;
    userRole?: string;
    permissions?: string[];
    lastActivity?: Date;

    // Required WebSocket properties
    binaryType: "nodebuffer" | "arraybuffer" | "fragments" = "nodebuffer";
    bufferedAmount = 0;
    extensions = "";
    protocol = "";
    url = "";
    isPaused = false;

    // Event handler properties - using ws types
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;

    constructor() {
      super();
      this.setMaxListeners(0);
    }

    close(code?: number, reason?: string | Buffer): void {
      this.readyState = this.CLOSED;
      this.emit("close", code, reason);
    }

    ping(data?: Buffer, mask?: boolean, cb?: (err: Error | null) => void): void {
      this.emit("pong");
      if (cb) cb(null);
    }

    pong(data?: Buffer, mask?: boolean, cb?: (err: Error | null) => void): void {
      if (cb) cb(null);
    }

    send(data: string | Buffer, cb?: (err?: Error) => void): void;
    send(
      data: string | Buffer,
      options: {
        mask?: boolean;
        binary?: boolean;
        compress?: boolean;
        fin?: boolean;
      },
      cb?: (err?: Error) => void,
    ): void;
    send(data: string | Buffer, optionsOrCb?: unknown, cb?: (err?: Error) => void): void {
      // Mock send
      if (typeof optionsOrCb === "function") {
        optionsOrCb();
      } else if (cb) {
        cb();
      }
    }

    terminate() {
      this.readyState = this.CLOSED;
      this.emit("close");
    }

    pause() {
      this.isPaused = true;
    }

    resume() {
      this.isPaused = false;
    }

    addEventListener(
      method: string,
      listener: (...args: unknown[]) => void,
      options?: Record<string, unknown>,
    ): void {
      this.addListener(method, listener);
    }

    removeEventListener(
      method: string,
      listener: (...args: unknown[]) => void,
    ): void {
      this.removeListener(method, listener);
    }
  }

  describe("Connection Management", () => {
    it("should clean up all resources when a client disconnects", () => {
      const clientId = "test-client-1";
      const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
      ws.clientId = clientId;
      ws.isAuthenticated = true;
      ws.permissions = ["read", "write"];

      // Register client
      wsService.registerClient(clientId, ws);
      wsService.subscribe(clientId, ["agent.status", "task.update"]);

      // Verify client is registered
      expect(wsService.getClientCount()).toBe(1);
      expect(wsService.getClientSubscriptions(clientId)).toContain(
        "agent.status",
      );

      // Disconnect client
      ws.close();

      // Verify all resources are cleaned up
      expect(wsService.getClientCount()).toBe(0);
      expect(wsService.getClientSubscriptions(clientId)).toEqual([]);
      expect(wsService.isClientAuthenticated(clientId)).toBe(false);
    });

    it("should prevent unbounded growth of clients", () => {
      const MAX_CLIENTS = 10000;
      const extraClients = 10;

      // Register maximum number of clients
      for (let i = 0; i < MAX_CLIENTS; i++) {
        const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
        ws.clientId = `client-${i}`;
        wsService.registerClient(`client-${i}`, ws);
      }

      expect(wsService.getClientCount()).toBe(MAX_CLIENTS);

      // Try to register more clients - should be rejected
      for (let i = 0; i < extraClients; i++) {
        const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
        ws.clientId = `extra-client-${i}`;
        const closeSpy = vi.spyOn(ws, "close");

        wsService.registerClient(`extra-client-${i}`, ws);

        // Should close connection with "Server at capacity" message
        expect(closeSpy).toHaveBeenCalledWith(1008, "Server at capacity");
      }

      // Count should not exceed maximum
      expect(wsService.getClientCount()).toBe(MAX_CLIENTS);
    });

    it("should limit subscriptions per client", () => {
      const clientId = "test-client";
      const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
      ws.clientId = clientId;

      wsService.registerClient(clientId, ws);

      // Try to subscribe to more than the limit (100)
      const subscriptions: string[] = [];
      for (let i = 0; i < 110; i++) {
        subscriptions.push(`channel-${i}`);
      }

      wsService.subscribe(clientId, subscriptions);

      // Should only have 100 subscriptions
      expect(wsService.getClientSubscriptions(clientId).length).toBe(100);
    });
  });

  describe("Event Listener Cleanup", () => {
    it("should remove all event listeners on disconnect", () => {
      const clientId = "test-client";
      const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
      ws.clientId = clientId;

      // Count initial listeners
      const initialListenerCount =
        ws.listenerCount("close") + ws.listenerCount("error");

      wsService.registerClient(clientId, ws);

      // Should have added listeners
      const afterRegisterCount =
        ws.listenerCount("close") + ws.listenerCount("error");
      expect(afterRegisterCount).toBeGreaterThan(initialListenerCount);

      // Disconnect
      ws.close();

      // Should have removed all listeners
      const afterCloseCount =
        ws.listenerCount("close") + ws.listenerCount("error");
      expect(afterCloseCount).toBe(0);
    });

    it("should clean up health check timers", (done: TestCallback) => {
      const clientId = "test-client";
      const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
      ws.clientId = clientId;

      // Register with health monitoring
      wsService.registerClientEnhanced(clientId, ws);

      // Let health check run once
      setTimeout(() => {
        // Disconnect
        ws.close();

        // Verify no more pings after disconnect
        const pingSpy = vi.spyOn(ws, "ping");

        setTimeout(() => {
          expect(pingSpy).not.toHaveBeenCalled();
          done();
        }, 35000); // Wait longer than health check interval
      }, 1000);
    }, 40000); // Increase test timeout
  });

  describe("Memory Cleanup Routines", () => {
    it("should clean up orphaned data structures", () => {
      // Create clients with various states
      const activeClient = new MockWebSocketImpl() as AuthenticatedWebSocket;
      activeClient.clientId = "active";
      activeClient.isAuthenticated = true;
      activeClient.permissions = ["read"];

      const disconnectedClient = new MockWebSocketImpl() as AuthenticatedWebSocket;
      disconnectedClient.clientId = "disconnected";
      disconnectedClient.isAuthenticated = true;
      disconnectedClient.permissions = ["read"];

      // Register both clients
      wsService.registerClient("active", activeClient);
      wsService.registerClient("disconnected", disconnectedClient);
      wsService.subscribe("active", ["test"]);
      wsService.subscribe("disconnected", ["test"]);

      // Verify both clients are registered initially
      expect((wsService as unknown as { authenticatedClients: Map<string, boolean> }).authenticatedClients.has("disconnected")).toBe(
        true,
      );
      expect((wsService as unknown as { subscriptions: Map<string, string[]> }).subscriptions.has("disconnected")).toBe(true);

      // Manually remove disconnected client from clients map to simulate orphaned data
      (wsService as unknown as { clients: Map<string, AuthenticatedWebSocket> }).clients.delete("disconnected");

      // Run cleanup
      (wsService as unknown as { cleanupOrphanedData(): void }).cleanupOrphanedData();

      // Verify orphaned data is cleaned up
      expect((wsService as unknown as { authenticatedClients: Map<string, boolean> }).authenticatedClients.has("disconnected")).toBe(
        false,
      );
      expect((wsService as unknown as { subscriptions: Map<string, string[]> }).subscriptions.has("disconnected")).toBe(false);
      expect((wsService as unknown as { clientPermissions: Map<string, string[]> }).clientPermissions.has("disconnected")).toBe(
        false,
      );

      // Active client data should remain
      expect((wsService as unknown as { authenticatedClients: Map<string, boolean> }).authenticatedClients.has("active")).toBe(true);
      expect((wsService as unknown as { subscriptions: Map<string, string[]> }).subscriptions.has("active")).toBe(true);
    });

    it("should limit message queue size", () => {
      const clientId = "test-client";
      const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
      ws.clientId = clientId;

      wsService.registerClient(clientId, ws);

      // Add more messages than the limit
      const messageQueue = (wsService as unknown as { messageQueue: Map<string, JSONObject[]> }).messageQueue;
      const messages: JSONObject[] = [];
      for (let i = 0; i < 60; i++) {
        messages.push({
          type: "test.message",
          data: `Message ${i}`,
          timestamp: new Date().toISOString(),
        });
      }
      messageQueue.set(clientId, messages);

      // Run memory cleanup
      (wsService as unknown as { startMemoryCleanup(): void }).startMemoryCleanup();

      // Wait for cleanup to run
      setTimeout(() => {
        const queue = messageQueue.get(clientId);
        expect(queue?.length ?? 0).toBeLessThanOrEqual(50); // MAX_MESSAGE_HISTORY
      }, 31000); // Just after cleanup interval
    });
  });

  describe("Shutdown Process", () => {
    it("should clean up all resources on shutdown", () => {
      // Create multiple clients
      for (let i = 0; i < 5; i++) {
        const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
        ws.clientId = `client-${i}`;
        wsService.registerClient(`client-${i}`, ws);
        wsService.subscribe(`client-${i}`, ["test"]);
      }

      // Verify clients exist
      expect(wsService.getClientCount()).toBe(5);

      // Shutdown service
      wsService.shutdown();

      // Verify all resources are cleaned up
      expect(wsService.getClientCount()).toBe(0);
      expect((wsService as unknown as { clients: Map<string, AuthenticatedWebSocket> }).clients.size).toBe(0);
      expect((wsService as unknown as { subscriptions: Map<string, string[]> }).subscriptions.size).toBe(0);
      expect((wsService as unknown as { messageQueue: Map<string, JSONObject[]> }).messageQueue.size).toBe(0);
      expect((wsService as unknown as { throttleTimers: Map<string, NodeJS.Timeout> }).throttleTimers.size).toBe(0);
      expect((wsService as unknown as { connectionHealthChecks: Map<string, NodeJS.Timeout> }).connectionHealthChecks.size).toBe(0);
    });

    it("should stop all intervals on shutdown", () => {
      // Start health monitoring
      wsService.startHealthMonitoring(1000);

      // Get interval references
      const wsServiceWithIntervals = wsService as unknown as {
        healthInterval: NodeJS.Timeout | null;
        memoryCleanupInterval: NodeJS.Timeout | null;
        performanceMonitorInterval: NodeJS.Timeout | null;
      };
      const healthInterval = wsServiceWithIntervals.healthInterval;
      const memoryCleanupInterval = wsServiceWithIntervals.memoryCleanupInterval;
      const performanceMonitorInterval = wsServiceWithIntervals.performanceMonitorInterval;

      // Shutdown
      wsService.shutdown();

      // Verify intervals are cleared
      expect(wsServiceWithIntervals.healthInterval).toBeNull();
      expect(wsServiceWithIntervals.memoryCleanupInterval).toBeNull();
      expect(wsServiceWithIntervals.performanceMonitorInterval).toBeNull();
    });
  });

  describe("Performance Metrics", () => {
    it("should track connection errors without memory leaks", () => {
      const clientId = "error-client";
      const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
      ws.clientId = clientId;

      wsService.registerClient(clientId, ws);

      // Simulate multiple errors
      for (let i = 0; i < 20; i++) {
        ws.emit("error", new Error("Test error"));
      }

      const metrics = wsService.getPerformanceMetrics();
      expect(metrics.connectionErrors).toBeGreaterThan(0);

      // Disconnect client
      ws.close();

      // Verify client is cleaned up despite errors
      expect(wsService.getClientCount()).toBe(0);
    });

    it("should handle reconnection attempts without leaks", () => {
      const clientId = "reconnect-client";

      // Simulate multiple connection attempts
      for (let i = 0; i < 5; i++) {
        const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
        ws.clientId = clientId;

        wsService.registerClient(clientId, ws);

        // Disconnect
        ws.close();
      }

      // Should only track the final state
      expect(wsService.getClientCount()).toBe(0);
      expect((wsService as unknown as { retryAttempts: Map<string, number> }).retryAttempts.size).toBe(0);
    });
  });
});

/**
 * Integration test to verify memory usage over time
 * This test should be run separately with memory profiling enabled
 */
describe.skip("WebSocketService - Memory Usage Over Time", () => {
  it("should maintain stable memory usage with connection churn", async () => {
    const wsService = new WebSocketService();
    const initialMemory = process.memoryUsage().heapUsed;
    const connectionCount = 100;
    const iterations = 10;

    for (let iteration = 0; iteration < iterations; iteration++) {
      // Create connections
      const clients: MockWebSocketImpl[] = [];
      for (let i = 0; i < connectionCount; i++) {
        const ws = new MockWebSocketImpl() as AuthenticatedWebSocket;
        ws.clientId = `client-${iteration}-${i}`;
        ws.isAuthenticated = true;

        wsService.registerClient(ws.clientId, ws);
        wsService.subscribe(ws.clientId, ["test1", "test2", "test3"]);
        clients.push(ws);
      }

      // Send some messages
      for (let i = 0; i < 10; i++) {
        wsService.broadcast({
          type: "test.message",
          data: `Iteration ${iteration} Message ${i}`,
          timestamp: new Date().toISOString(),
        } as JSONObject);
      }

      // Disconnect all clients
      clients.forEach((ws) => ws.close());

      // Wait for cleanup
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      // Force garbage collection if available
      if ('gc' in global && typeof (global as unknown as { gc?: () => void }).gc === 'function') {
        (global as unknown as { gc: () => void }).gc();
      }
    }

    // Check final memory usage
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / 1024 / 1024;

    console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)} MB`);

    // Memory growth should be minimal (less than 50MB for this test)
    expect(memoryGrowthMB).toBeLessThan(50);

    wsService.shutdown();
  });
});
