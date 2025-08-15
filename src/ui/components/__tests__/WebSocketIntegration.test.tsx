/**
 * WebSocket Integration Tests
 * Verify WebSocket connections and real-time data flow
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import WS from 'jest-websocket-mock';

type WsMock = any; // Type alias for the mock server
import { useEnhancedWebSocket, useEmailWebSocket } from '../../hooks/useEnhancedWebSocket.js';
import { useWebSocketStateManager } from '../../stores/webSocketStateManager.js';
import type { EmailStatsUpdatedEvent } from '../../../shared/types/websocket-events.js';

describe('WebSocket Integration Tests', () => {
  let server: WsMock;
  const wsUrl = 'ws://localhost:3001/ws';

  beforeEach(async () => {
    // Create mock WebSocket server
    server = new (WS as any)(wsUrl);
    
    // Reset state
    useWebSocketStateManager.getState().reset();
  });

  afterEach(() => {
    if (server && server.close) {
      server.close();
    }
  });

  describe('WebSocket Connection', () => {
    it('should establish connection successfully', async () => {
      const { result } = renderHook(() => useEnhancedWebSocket({
        endpoint: 'socketio',
        autoConnect: true,
      }));

      // Wait for connection
      await waitFor(() => {
        expect(result.current.state.isConnecting).toBe(true);
      });

      // Accept connection on server
      await server.connected;

      // Verify connected state
      await waitFor(() => {
        expect(result.current.state.isConnected).toBe(true);
        expect(result.current.state.connectionStatus).toBe('connected');
      });
    });

    it('should handle connection errors gracefully', async () => {
      const { result } = renderHook(() => useEnhancedWebSocket({
        endpoint: 'socketio',
        autoConnect: true,
      }));

      // Simulate connection error
      server.error();

      await waitFor(() => {
        expect(result.current.state.connectionStatus).toBe('error');
        expect(result.current.state.lastError).toBeDefined();
      });
    });

    it('should reconnect after disconnection', async () => {
      const { result } = renderHook(() => useEnhancedWebSocket({
        endpoint: 'socketio',
        autoConnect: true,
        reconnection: true,
      }));

      // Connect initially
      await server.connected;

      await waitFor(() => {
        expect(result.current.state.isConnected).toBe(true);
      });

      // Disconnect
      server.close();

      await waitFor(() => {
        expect(result.current.state.isConnected).toBe(false);
        expect(result.current.state.isReconnecting).toBe(true);
      });

      // Should attempt to reconnect
      await waitFor(() => {
        expect(result.current.state.reconnectAttempts).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });
  });

  describe('Event Handling', () => {
    it('should handle email stats updated event', async () => {
      const onStatsUpdated = vi.fn();
      
      const { result } = renderHook(() => useEmailWebSocket({
        onEmailStatsUpdated: onStatsUpdated,
      }));

      // Wait for connection
      await server.connected;

      // Send stats update event
      const statsEvent: EmailStatsUpdatedEvent = {
        id: '123',
        type: 'email:stats_updated',
        timestamp: new Date(),
        data: {
          stats: {
            total: 100,
            critical: 10,
            inProgress: 20,
            completed: 70,
            pendingAssignment: 5,
            todaysCount: 30,
          },
        },
      };

      server.send(JSON.stringify(statsEvent));

      // Verify handler was called
      await waitFor(() => {
        expect(onStatsUpdated).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'email:stats_updated',
            data: expect.objectContaining({
              stats: expect.objectContaining({
                total: 100,
                critical: 10,
                inProgress: 20,
                completed: 70,
              }),
            }),
          })
        );
      });
    });

    it('should queue events when disconnected', async () => {
      const { result } = renderHook(() => useEnhancedWebSocket({
        endpoint: 'socketio',
        autoConnect: false,
      }));

      // Try to send event while disconnected
      const event = {
        id: '123',
        type: 'test',
        timestamp: new Date(),
        data: { test: true },
      };

      await expect(
        result.current.send(event as any)
      ).rejects.toThrow('WebSocket is not connected');

      // Connect
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Queued messages should be sent after connection
      await waitFor(() => {
        expect(server).toHaveReceivedMessages([JSON.stringify(event)]);
      });
    });
  });

  describe('State Management', () => {
    it('should prevent race conditions in event processing', async () => {
      const stateManager = useWebSocketStateManager.getState();
      
      // Queue multiple events for the same email
      const emailId = 'email-123';
      const events = Array.from({ length: 5 }, (_, i) => ({
        id: `event-${i}`,
        type: 'email:updated',
        timestamp: new Date(),
        data: {
          emailId,
          updates: { status: `status-${i}` },
        },
      }));

      events.forEach(event => {
        stateManager.queueEvent(event as any);
      });

      // Process events
      await Promise.all(
        events.map(event => stateManager.processEvent(event.id))
      );

      // Check that only the latest update is in cache
      const cache = stateManager.emailCache.get(emailId);
      expect(cache?.data.updates.status).toBe('status-4');
    });

    it('should handle optimistic updates correctly', async () => {
      const stateManager = useWebSocketStateManager.getState();
      
      // Apply optimistic update
      const updateId = 'optimistic-123';
      let testValue = 0;
      
      stateManager.applyOptimisticUpdate({
        id: updateId,
        type: 'test',
        apply: () => { testValue = 100; },
        rollback: () => { testValue = 0; },
        timestamp: new Date(),
        confirmed: false,
      });

      expect(testValue).toBe(100);

      // Rollback update
      stateManager.rollbackOptimisticUpdate(updateId);
      expect(testValue).toBe(0);
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to channels', async () => {
      const { result } = renderHook(() => useEmailWebSocket());

      await server.connected;

      // Subscribe to channel
      await act(async () => {
        await result.current.subscribe('email:stats');
      });

      // Verify subscription message sent
      await waitFor(() => {
        const messages = server.messages;
        const subscribeMsg = messages.find((msg: any) => {
          const parsed = JSON.parse(msg as string);
          return parsed.type === 'subscribe' && parsed.data.channel === 'email:stats';
        });
        expect(subscribeMsg).toBeDefined();
      });
    });

    it('should unsubscribe from channels', async () => {
      const { result } = renderHook(() => useEmailWebSocket());

      await server.connected;

      // Subscribe first
      await result.current.subscribe('email:stats');
      
      // Then unsubscribe
      await act(async () => {
        await result.current.unsubscribe('email:stats');
      });

      // Verify unsubscribe message sent
      await waitFor(() => {
        const messages = server.messages;
        const unsubscribeMsg = messages.find((msg: any) => {
          const parsed = JSON.parse(msg as string);
          return parsed.type === 'unsubscribe' && parsed.data.channel === 'email:stats';
        });
        expect(unsubscribeMsg).toBeDefined();
      });
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const stateManager = useWebSocketStateManager.getState();
      const startTime = Date.now();
      
      // Queue 1000 events
      const events = Array.from({ length: 1000 }, (_, i) => ({
        id: `perf-${i}`,
        type: 'email:table_data_updated',
        timestamp: new Date(),
        data: {
          rowCount: i,
        },
      }));

      events.forEach(event => {
        stateManager.queueEvent(event as any);
      });

      // Process all events
      await Promise.all(
        events.map(event => stateManager.processEvent(event.id))
      );

      const duration = Date.now() - startTime;
      
      // Should process 1000 events in under 1 second
      expect(duration).toBeLessThan(1000);
      
      // Queue should be empty after processing
      expect(stateManager.getEventQueue()).toHaveLength(0);
    });

    it('should deduplicate events in queue', async () => {
      const stateManager = useWebSocketStateManager.getState();
      
      // Queue duplicate events
      const event = {
        id: 'dup-1',
        type: 'email:updated',
        timestamp: new Date(),
        data: {
          emailId: 'email-123',
          updates: { status: 'new' },
        },
      };

      // Queue same event multiple times (with different IDs but same content)
      for (let i = 0; i < 5; i++) {
        stateManager.queueEvent({
          ...event,
          id: `dup-${i}`,
        } as any);
      }

      // Should only have one event for this email in queue
      const queue = stateManager.getEventQueue();
      const emailEvents = queue.filter(e => 
        e.type === 'email:updated' && 
        (e as any).data.emailId === 'email-123'
      );
      
      expect(emailEvents).toHaveLength(1);
    });
  });
});

describe('Email Dashboard WebSocket Integration', () => {
  it('should update dashboard metrics in real-time', async () => {
    // This would be an integration test with the actual dashboard
    // For now, we just verify the hook behavior
    
    const { result: wsResult } = renderHook(() => useEmailWebSocket());
    const { result: stateResult } = renderHook(() => 
      useWebSocketStateManager(state => state.statsCache)
    );

    // Simulate stats update
    const statsEvent: EmailStatsUpdatedEvent = {
      id: 'stats-123',
      type: 'email:stats_updated',
      timestamp: new Date(),
      data: {
        stats: {
          total: 150,
          critical: 15,
          inProgress: 30,
          completed: 105,
          pendingAssignment: 8,
          todaysCount: 45,
        },
      },
    };

    act(() => {
      useWebSocketStateManager.getState().queueEvent(statsEvent);
      useWebSocketStateManager.getState().processEvent(statsEvent.id);
    });

    await waitFor(() => {
      expect(stateResult.current).toEqual(
        expect.objectContaining({
          total: 150,
          critical: 15,
          inProgress: 30,
          completed: 105,
        })
      );
    });
  });
});