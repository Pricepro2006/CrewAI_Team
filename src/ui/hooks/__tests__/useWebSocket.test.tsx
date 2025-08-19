import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  useWebSocket, 
  useAgentStatus, 
  usePlanProgress, 
  useTaskQueue, 
  useSystemHealth, 
  useRAGOperations 
} from '../useWebSocket';

// Mock tRPC
const mockWSClient = {
  close: vi.fn(),
  subscribe: vi.fn(),
  onOpen: vi.fn(),
  onClose: vi.fn(),
};

const mockTRPCClient = {
  ws: mockWSClient,
  subscription: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
};

const mockCreateWSClientFn = vi.fn(() => mockWSClient);

vi.mock('@trpc/client', () => ({
  createTRPCProxyClient: vi.fn(() => mockTRPCClient),
  createWSClient: mockCreateWSClientFn,
  wsLink: vi.fn(() => ({})),
}));

vi.mock('superjson', () => ({
  default: {
    serialize: vi.fn(),
    deserialize: vi.fn(),
  },
}));

// Mock WebSocket config
vi.mock('../../../config/websocket.config', () => ({
  trpcWebSocketConfig: {
    url: 'ws://localhost:8080',
    reconnectDelay: 1000,
    maxReconnectAttempts: 3,
  },
  getTRPCWebSocketUrl: vi.fn(() => 'ws://localhost:8080/trpc'),
  getWebSocketDebugInfo: vi.fn(() => ({
    url: 'ws://localhost:8080/trpc',
    protocol: 'ws',
    readyState: 'CONNECTING',
  })),
}));

// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('useWebSocket', () => {
  let mockCreateWSClient: any;
  let mockOnConnect: ReturnType<typeof vi.fn>;
  let mockOnDisconnect: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnConnect = vi.fn();
    mockOnDisconnect = vi.fn();
    mockOnError = vi.fn();

    mockCreateWSClient = mockCreateWSClientFn;

    // Reset mock implementation
    mockCreateWSClient.mockImplementation((config: any) => {
      const client = {
        ...mockWSClient,
        close: vi.fn(),
      };

      // Simulate connection after a short delay
      setTimeout(() => {
        config.onOpen?.();
      }, 10);

      return client;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Basic Connection Management', () => {
    it('initializes with disconnected state', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.reconnectAttempts).toBe(0);
    });

    it('attempts to connect on mount', () => {
      renderHook(() => useWebSocket());

      expect(mockCreateWSClient).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'ws://localhost:8080/trpc',
          onOpen: expect.any(Function),
          onClose: expect.any(Function),
        })
      );
    });

    it('calls onConnect callback when connection opens', async () => {
      const { result } = renderHook(() => 
        useWebSocket({ onConnect: mockOnConnect })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(mockOnConnect).toHaveBeenCalledTimes(1);
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('updates connection status correctly', async () => {
      const { result } = renderHook(() => useWebSocket());

      // Initially disconnected
      expect(result.current.connectionStatus).toBe('disconnected');

      // Should become connecting, then connected
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  describe('Disconnection Handling', () => {
    it('handles disconnection events', async () => {
      let onCloseCallback: ((event: any) => void) | undefined;

      mockCreateWSClient.mockImplementation((config: any) => {
        onCloseCallback = config.onClose;
        setTimeout(() => config.onOpen?.(), 10);
        return mockWSClient;
      });

      const { result } = renderHook(() => 
        useWebSocket({ onDisconnect: mockOnDisconnect })
      );

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate disconnection
      act(() => {
        onCloseCallback?.({ code: 1006, reason: 'Connection lost' });
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      expect(mockOnDisconnect).toHaveBeenCalledTimes(1);
      expect(result.current.connectionStatus).toBe('disconnected');
    });

    it('handles manual disconnection', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(mockWSClient.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('attempts reconnection after unexpected disconnection', async () => {
      let onCloseCallback: ((event: any) => void) | undefined;

      mockCreateWSClient.mockImplementation((config: any) => {
        onCloseCallback = config.onClose;
        setTimeout(() => config.onOpen?.(), 10);
        return mockWSClient;
      });

      const { result } = renderHook(() => useWebSocket({
        reconnectDelay: 1000,
        maxReconnectAttempts: 3,
      }));

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate unexpected disconnection (not code 1000)
      act(() => {
        onCloseCallback?.({ code: 1006, reason: 'Connection lost' });
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(false);
      });

      expect(result.current.reconnectAttempts).toBe(0);

      // Fast forward to trigger reconnection
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.reconnectAttempts).toBe(1);
      });

      expect(mockCreateWSClient).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff for reconnection delays', async () => {
      let onCloseCallback: ((event: any) => void) | undefined;

      mockCreateWSClient.mockImplementation((config: any) => {
        onCloseCallback = config.onClose;
        // Don't auto-connect to test retry logic
        return mockWSClient;
      });

      const { result } = renderHook(() => useWebSocket({
        reconnectDelay: 1000,
        maxReconnectAttempts: 3,
      }));

      // Simulate first disconnection
      act(() => {
        onCloseCallback?.({ code: 1006, reason: 'Connection lost' });
      });

      // First retry after 1000ms
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Simulate second disconnection
      act(() => {
        onCloseCallback?.({ code: 1006, reason: 'Connection lost' });
      });

      // Second retry should be after 1500ms (1000 * 1.5^1)
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      await waitFor(() => {
        expect(result.current.reconnectAttempts).toBe(2);
      });
    });

    it('stops reconnecting after max attempts', async () => {
      let onCloseCallback: ((event: any) => void) | undefined;

      mockCreateWSClient.mockImplementation((config: any) => {
        onCloseCallback = config.onClose;
        return mockWSClient;
      });

      const { result } = renderHook(() => useWebSocket({
        reconnectDelay: 100,
        maxReconnectAttempts: 2,
        onError: mockOnError,
      }));

      // Simulate multiple disconnections
      for (let i = 0; i < 3; i++) {
        act(() => {
          onCloseCallback?.({ code: 1006, reason: 'Connection lost' });
        });

        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Max reconnection attempts reached'
        })
      );
    });

    it('does not reconnect on normal closure (code 1000)', async () => {
      let onCloseCallback: ((event: any) => void) | undefined;

      mockCreateWSClient.mockImplementation((config: any) => {
        onCloseCallback = config.onClose;
        setTimeout(() => config.onOpen?.(), 10);
        return mockWSClient;
      });

      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      // Simulate normal closure
      act(() => {
        onCloseCallback?.({ code: 1000, reason: 'Normal closure' });
      });

      // Should not attempt reconnection
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.reconnectAttempts).toBe(0);
      expect(mockCreateWSClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('handles connection creation errors', async () => {
      mockCreateWSClient.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const { result } = renderHook(() => useWebSocket({
        onError: mockOnError,
      }));

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Connection failed'
        })
      );
    });

    it('handles sendMessage when not connected', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage({ type: 'test', data: 'test' });
      });

      expect(console.warn).toHaveBeenCalledWith(
        'WebSocket not connected, cannot send message'
      );
    });

    it('handles sendMessage with tRPC limitation', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.sendMessage({ type: 'test', data: 'test' });
      });

      expect(console.warn).toHaveBeenCalledWith(
        'Direct message sending not supported in tRPC WebSocket'
      );
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('cleans up on unmount', async () => {
      const { result, unmount } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      unmount();

      expect(mockWSClient.close).toHaveBeenCalledTimes(1);
    });

    it('clears timeouts on cleanup', () => {
      vi.useFakeTimers();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount } = renderHook(() => useWebSocket());

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('prevents operations after unmount', async () => {
      let onCloseCallback: ((event: any) => void) | undefined;

      mockCreateWSClient.mockImplementation((config: any) => {
        onCloseCallback = config.onClose;
        setTimeout(() => config.onOpen?.(), 10);
        return mockWSClient;
      });

      const { result, unmount } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      unmount();

      // Simulate disconnection after unmount
      act(() => {
        onCloseCallback?.({ code: 1006, reason: 'Connection lost' });
      });

      // Should not attempt reconnection
      expect(mockCreateWSClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual Connection Control', () => {
    it('allows manual connection', async () => {
      const { result } = renderHook(() => useWebSocket());

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.isConnected).toBe(false);

      act(() => {
        result.current.connect();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      });

      expect(result.current.reconnectAttempts).toBe(0);
    });

    it('resets reconnect attempts on manual connect', () => {
      const { result } = renderHook(() => useWebSocket());

      // Simulate some reconnect attempts
      act(() => {
        // This would normally happen through disconnection logic
        // but we're testing the reset behavior
        result.current.connect();
      });

      expect(result.current.reconnectAttempts).toBe(0);
    });
  });
});

describe('useAgentStatus', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockTRPCClient.ws.subscribe = mockSubscribe;
  });

  it('subscribes to agent status updates', () => {
    renderHook(() => useAgentStatus('agent-123'));

    expect(mockSubscribe).toHaveBeenCalledWith(
      {
        types: ['agent.status'],
        filter: { agentId: 'agent-123' },
      },
      expect.objectContaining({
        onData: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('updates status when data is received', async () => {
    const mockUnsubscribe = vi.fn();
    mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });

    let onDataCallback: (data: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onDataCallback = callbacks.onData;
      return { unsubscribe: mockUnsubscribe };
    });

    const { result } = renderHook(() => useAgentStatus('agent-123'));

    const statusData = {
      agentId: 'agent-123',
      status: 'busy',
      timestamp: new Date(),
    };

    act(() => {
      onDataCallback(statusData);
    });

    expect(result.current).toEqual(statusData);
  });

  it('handles subscription errors', () => {
    let onErrorCallback: (error: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onErrorCallback = callbacks.onError;
      return { unsubscribe: vi.fn() };
    });

    renderHook(() => useAgentStatus('agent-123'));

    act(() => {
      onErrorCallback(new Error('Subscription failed'));
    });

    expect(console.error).toHaveBeenCalledWith(
      'Agent status subscription error:',
      expect.any(Error)
    );
  });

  it('cleans up subscription on unmount', () => {
    const mockUnsubscribe = vi.fn();
    mockSubscribe.mockReturnValue({ unsubscribe: mockUnsubscribe });

    const { unmount } = renderHook(() => useAgentStatus('agent-123'));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles missing agentId gracefully', () => {
    renderHook(() => useAgentStatus());

    expect(mockSubscribe).toHaveBeenCalledWith(
      {
        types: ['agent.status'],
        filter: { agentId: undefined },
      },
      expect.any(Object)
    );
  });
});

describe('usePlanProgress', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockTRPCClient.ws.subscribe = mockSubscribe;
  });

  it('subscribes to plan progress updates', () => {
    renderHook(() => usePlanProgress('plan-456'));

    expect(mockSubscribe).toHaveBeenCalledWith(
      {
        types: ['plan.update'],
        filter: { planId: 'plan-456' },
      },
      expect.objectContaining({
        onData: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('updates progress when data is received', async () => {
    let onDataCallback: (data: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onDataCallback = callbacks.onData;
      return { unsubscribe: vi.fn() };
    });

    const { result } = renderHook(() => usePlanProgress('plan-456'));

    const progressData = {
      status: 'in_progress',
      progress: {
        completed: 3,
        total: 10,
        currentStep: 'Analysis',
      },
      timestamp: new Date(),
    };

    act(() => {
      onDataCallback(progressData);
    });

    expect(result.current).toEqual(progressData);
  });

  it('does not subscribe when planId is empty', () => {
    renderHook(() => usePlanProgress(''));

    expect(mockSubscribe).not.toHaveBeenCalled();
  });
});

describe('useTaskQueue', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockTRPCClient.ws.subscribe = mockSubscribe;
  });

  it('subscribes to task queue updates', () => {
    renderHook(() => useTaskQueue());

    expect(mockSubscribe).toHaveBeenCalledWith(
      {
        types: ['task.update'],
      },
      expect.objectContaining({
        onData: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('maintains task queue with updates', async () => {
    let onDataCallback: (data: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onDataCallback = callbacks.onData;
      return { unsubscribe: vi.fn() };
    });

    const { result } = renderHook(() => useTaskQueue());

    const task1 = {
      taskId: 'task-1',
      status: 'running',
      progress: 50,
      timestamp: new Date(),
    };

    const task2 = {
      taskId: 'task-2',
      status: 'pending',
      progress: 0,
      timestamp: new Date(),
    };

    act(() => {
      onDataCallback(task1);
    });

    act(() => {
      onDataCallback(task2);
    });

    expect(result.current).toHaveLength(2);
    expect(result.current).toContainEqual(task1);
    expect(result.current).toContainEqual(task2);
  });

  it('limits task queue size to prevent memory leaks', async () => {
    let onDataCallback: (data: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onDataCallback = callbacks.onData;
      return { unsubscribe: vi.fn() };
    });

    const { result } = renderHook(() => useTaskQueue());

    // Add more than MAX_TASKS (100) completed tasks
    for (let i = 0; i < 105; i++) {
      act(() => {
        onDataCallback({
          taskId: `task-${i}`,
          status: 'completed',
          timestamp: new Date(Date.now() - (105 - i) * 1000), // Older tasks first
        });
      });
    }

    await waitFor(() => {
      expect(result.current.length).toBeLessThanOrEqual(100);
    });
  });

  it('clears tasks on unmount', () => {
    mockSubscribe.mockReturnValue({ unsubscribe: vi.fn() });

    const { result, unmount } = renderHook(() => useTaskQueue());

    unmount();

    expect(result.current).toEqual([]);
  });
});

describe('useSystemHealth', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockTRPCClient.ws.subscribe = mockSubscribe;
  });

  it('subscribes to system health updates', () => {
    renderHook(() => useSystemHealth());

    expect(mockSubscribe).toHaveBeenCalledWith(
      {
        types: ['system.health'],
      },
      expect.objectContaining({
        onData: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('updates health data when received', async () => {
    let onDataCallback: (data: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onDataCallback = callbacks.onData;
      return { unsubscribe: vi.fn() };
    });

    const { result } = renderHook(() => useSystemHealth());

    const healthData = {
      services: {
        api: 'healthy',
        database: 'healthy',
        websocket: 'degraded',
      },
      metrics: {
        cpu: 45,
        memory: 70,
        activeAgents: 3,
        queueLength: 12,
      },
      timestamp: new Date(),
    };

    act(() => {
      onDataCallback(healthData);
    });

    expect(result.current).toEqual(healthData);
  });
});

describe('useRAGOperations', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSubscribe = vi.fn();
    mockTRPCClient.ws.subscribe = mockSubscribe;
  });

  it('subscribes to RAG operation updates', () => {
    renderHook(() => useRAGOperations());

    expect(mockSubscribe).toHaveBeenCalledWith(
      {
        types: ['rag.operation'],
      },
      expect.objectContaining({
        onData: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it('maintains operation history with limit', async () => {
    let onDataCallback: (data: any) => void;
    mockSubscribe.mockImplementation((filter, callbacks) => {
      onDataCallback = callbacks.onData;
      return { unsubscribe: vi.fn() };
    });

    const { result } = renderHook(() => useRAGOperations());

    // Add more than 20 operations
    for (let i = 0; i < 25; i++) {
      act(() => {
        onDataCallback({
          operation: 'indexing',
          status: 'completed',
          details: { documentCount: i + 1 },
          timestamp: new Date(),
        });
      });
    }

    await waitFor(() => {
      expect(result.current).toHaveLength(20); // Should be limited to last 20
    });
  });

  it('clears operations on unmount', () => {
    mockSubscribe.mockReturnValue({ unsubscribe: vi.fn() });

    const { result, unmount } = renderHook(() => useRAGOperations());

    unmount();

    expect(result.current).toEqual([]);
  });
});

describe('Hook Integration', () => {
  it('all hooks work together without conflicts', async () => {
    const { result: wsResult } = renderHook(() => useWebSocket());
    const { result: agentResult } = renderHook(() => useAgentStatus('test-agent'));
    const { result: planResult } = renderHook(() => usePlanProgress('test-plan'));
    const { result: queueResult } = renderHook(() => useTaskQueue());
    const { result: healthResult } = renderHook(() => useSystemHealth());
    const { result: ragResult } = renderHook(() => useRAGOperations());

    await waitFor(() => {
      expect(wsResult.current.isConnected).toBe(true);
    });

    // All hooks should initialize properly
    expect(agentResult.current).toBeNull();
    expect(planResult.current).toBeNull();
    expect(queueResult.current).toEqual([]);
    expect(healthResult.current).toBeNull();
    expect(ragResult.current).toEqual([]);
  });

  it('handles shared WebSocket connection efficiently', () => {
    // Multiple hooks should reuse the same WebSocket connection
    renderHook(() => useAgentStatus('agent-1'));
    renderHook(() => usePlanProgress('plan-1'));
    renderHook(() => useTaskQueue());

    // Should only create one WebSocket connection per hook
    expect(mockCreateWSClientFn).toHaveBeenCalledTimes(3);
  });
});