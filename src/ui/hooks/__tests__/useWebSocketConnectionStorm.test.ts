import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRealtimePricesStable } from '../useRealtimePricesStable';
import { useGroceryWebSocketStable } from '../useGroceryWebSocketStable';

// Track WebSocket creation and closes
let wsCreationCount = 0;
let wsCloseCount = 0;
let lastMockWebSocket: MockWebSocket | null = null;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  closeSpy = vi.fn();
  sendSpy = vi.fn();

  constructor(url: string) {
    wsCreationCount++;
    lastMockWebSocket = this;
    // Simulate connection opening
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  close = () => {
    wsCloseCount++;
    this.closeSpy();
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  };

  send = (data: any) => {
    this.sendSpy(data);
  };
}

// Replace global WebSocket with our mock
global.WebSocket = MockWebSocket as any;

describe('WebSocket Connection Storm Fix Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    wsCreationCount = 0; // Reset WebSocket creation counter
    wsCloseCount = 0; // Reset WebSocket close counter
    lastMockWebSocket = null; // Reset last WebSocket reference
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('useGroceryWebSocketStable', () => {
    it('should create only one WebSocket instance per URL', () => {
      const { rerender } = renderHook(() =>
        useGroceryWebSocketStable({
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      // First render creates WebSocket
      expect(wsCreationCount).toBe(1);

      // Re-render should not create new WebSocket
      rerender();
      expect(wsCreationCount).toBe(1);

      // Multiple re-renders should still use same WebSocket
      rerender();
      rerender();
      expect(wsCreationCount).toBe(1);
    });

    it('should provide stable function references', () => {
      let firstRenderFunctions: any;
      let secondRenderFunctions: any;

      const { rerender } = renderHook(() =>
        useGroceryWebSocketStable({
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      act(() => {
        const result = renderHook(() =>
          useGroceryWebSocketStable({
            conversationId: 'test-123',
            userId: 'user-1'
          })
        );
        firstRenderFunctions = {
          send: result.result.current.send,
          connect: result.result.current.connect,
          disconnect: result.result.current.disconnect,
          subscribeToPrice: result.result.current.subscribeToPrice
        };
      });

      // Force re-render
      rerender();

      act(() => {
        const result = renderHook(() =>
          useGroceryWebSocketStable({
            conversationId: 'test-123',
            userId: 'user-1'
          })
        );
        secondRenderFunctions = {
          send: result.result.current.send,
          connect: result.result.current.connect,
          disconnect: result.result.current.disconnect,
          subscribeToPrice: result.result.current.subscribeToPrice
        };
      });

      // Functions should maintain the same reference
      expect(firstRenderFunctions.send).toBe(secondRenderFunctions.send);
      expect(firstRenderFunctions.connect).toBe(secondRenderFunctions.connect);
      expect(firstRenderFunctions.disconnect).toBe(secondRenderFunctions.disconnect);
      expect(firstRenderFunctions.subscribeToPrice).toBe(secondRenderFunctions.subscribeToPrice);
    });
  });

  describe('useRealtimePricesStable', () => {
    it('should not create infinite loops with price subscription updates', () => {
      const mockOnPriceChange = vi.fn();
      let renderCount = 0;

      const { rerender } = renderHook(() => {
        renderCount++;
        return useRealtimePricesStable({
          productIds: ['product-1', 'product-2'],
          conversationId: 'test-123',
          userId: 'user-1',
          onPriceChange: mockOnPriceChange
        });
      });

      const initialRenderCount = renderCount;

      // Simulate multiple re-renders that would previously cause infinite loops
      rerender();
      rerender();
      rerender();

      // Should not cause excessive renders
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(3);
      
      // WebSocket should still only be created once
      expect(wsCreationCount).toBe(1);
    });

    it('should provide stable updatePriceSubscription function', () => {
      const { result, rerender } = renderHook(() =>
        useRealtimePricesStable({
          productIds: ['product-1'],
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      const firstUpdateFunction = result.current.updatePriceSubscription;

      // Force re-render
      rerender();

      const secondUpdateFunction = result.current.updatePriceSubscription;

      // Function reference should be stable
      expect(firstUpdateFunction).toBe(secondUpdateFunction);
    });

    it('should handle product ID changes without creating new connections', () => {
      let productIds = ['product-1', 'product-2'];

      const { rerender } = renderHook(() =>
        useRealtimePricesStable({
          productIds,
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      // Initial render creates one WebSocket
      expect(wsCreationCount).toBe(1);

      // Change product IDs - should not create new WebSocket
      act(() => {
        productIds = ['product-3', 'product-4', 'product-5'];
      });
      rerender();

      // Still only one WebSocket instance
      expect(wsCreationCount).toBe(1);
    });

    it('should handle rapid subscription updates without connection storms', () => {
      const { result } = renderHook(() =>
        useRealtimePricesStable({
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      // Simulate rapid subscription updates that previously caused storms
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.updatePriceSubscription([`product-${i}`]);
        }
      });

      // Should still only have one WebSocket connection
      expect(wsCreationCount).toBe(1);
      
      // Should not have created multiple connection attempts
      expect(wsCloseCount).toBe(0);
    });
  });

  describe('Connection Storm Prevention', () => {
    it('should prevent multiple simultaneous hooks from creating connection storms', () => {
      // Create multiple hook instances simultaneously
      const hooks = Array.from({ length: 10 }, (_, i) =>
        renderHook(() =>
          useRealtimePricesStable({
            productIds: [`product-${i}`],
            conversationId: 'test-123',
            userId: 'user-1'
          })
        )
      );

      // Should still only create one WebSocket connection due to singleton pattern
      expect(wsCreationCount).toBe(1);

      // Update all hooks with new product IDs
      act(() => {
        hooks.forEach((hook, i) => {
          hook.rerender();
        });
      });

      // Should still only have one WebSocket connection
      expect(wsCreationCount).toBe(1);
    });

    it('should handle WebSocket reconnection without creating storms', () => {
      const { result } = renderHook(() =>
        useRealtimePricesStable({
          productIds: ['product-1'],
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      // Simulate initial connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen({} as Event);
        }
      });

      expect(result.current.isConnected).toBe(true);

      // Simulate disconnection
      act(() => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose({ code: 1000, reason: 'Normal closure' } as CloseEvent);
        }
      });

      expect(result.current.isConnected).toBe(false);

      // Fast-forward to trigger reconnection attempt
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Should only have attempted one reconnection
      expect(wsCreationCount).toBe(2); // Original + 1 reconnect
    });
  });

  describe('Performance and Memory', () => {
    it('should clean up resources properly', () => {
      const { unmount } = renderHook(() =>
        useRealtimePricesStable({
          productIds: ['product-1'],
          conversationId: 'test-123',
          userId: 'user-1'
        })
      );

      // Should create WebSocket
      expect(wsCreationCount).toBe(1);

      // Unmount component
      unmount();

      // Should clean up WebSocket connection
      expect(wsCloseCount).toBe(1);
    });

    it('should not leak memory with repeated mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() =>
          useRealtimePricesStable({
            productIds: [`product-${i}`],
            conversationId: 'test-123',
            userId: 'user-1'
          })
        );
        unmount();
      }

      // Each mount/unmount cycle should reuse the singleton
      expect(wsCreationCount).toBe(5); // One per mount due to cleanup/recreate
      expect(wsCloseCount).toBe(5); // One close per unmount
    });
  });
});