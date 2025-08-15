/**
 * Enhanced WebSocket Hook
 * Provides typed WebSocket connections with automatic reconnection,
 * event handling, and state management
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import type { WebSocket as WSType } from 'ws';
import type {
  WebSocketEvent,
  WebSocketEventHandlers,
  ConnectionEvent,
  WebSocketError,
} from '../../shared/types/websocket-events.js';

// Mock websocket config until proper config is created
const webSocketConfig = {
  heartbeat: {
    enabled: true,
    interval: 30000,
  },
  reconnection: {
    maxAttempts: 10,
  },
};

const getWebSocketUrl = (endpoint: string): string => {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const port = endpoint === 'email' ? '8080' : '3001';
  return `${protocol}//${host}:${port}/ws`;
};

const getReconnectionDelay = (attempt: number): number => {
  // Exponential backoff with jitter
  const baseDelay = 1000;
  const maxDelay = 30000;
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
  return Math.floor(delay + jitter);
};

export interface UseWebSocketOptions {
  endpoint?: 'trpc' | 'socketio' | 'email';
  autoConnect?: boolean;
  reconnection?: boolean;
  handlers?: WebSocketEventHandlers;
  onStateChange?: (state: WebSocketState) => void;
}

export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
  lastError?: WebSocketError;
  latency?: number;
}

export interface UseWebSocketResult {
  state: WebSocketState;
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (event: WebSocketEvent) => Promise<void>;
  subscribe: (channel: string) => Promise<void>;
  unsubscribe: (channel: string) => Promise<void>;
  on: <T extends WebSocketEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ) => () => void;
  off: (eventType: string, handler?: (event: WebSocketEvent) => void) => void;
}

const initialState: WebSocketState = {
  isConnected: false,
  isConnecting: false,
  isReconnecting: false,
  connectionStatus: 'disconnected',
  reconnectAttempts: 0,
  lastError: undefined,
  latency: undefined,
};

export function useEnhancedWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketResult {
  const {
    endpoint = 'socketio',
    autoConnect = true,
    reconnection = true,
    handlers = {},
    onStateChange,
  } = options;

  // State management
  const [state, setState] = useState<WebSocketState>(initialState);
  const stateRef = useRef(state);

  // WebSocket instance and related refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<(event: WebSocketEvent) => void>>>(new Map());
  const isUnmountedRef = useRef(false);

  // Message queue for offline messages
  const messageQueueRef = useRef<WebSocketEvent[]>([]);
  const maxQueueSize = 100;

  // Update state and notify
  const updateState = useCallback((updates: Partial<WebSocketState>) => {
    if (isUnmountedRef.current) return;

    setState(prev => {
      const newState = { ...prev, ...updates };
      stateRef.current = newState;
      onStateChange?.(newState);
      return newState;
    });
  }, [onStateChange]);

  // Handle WebSocket events
  const handleEvent = useCallback((event: WebSocketEvent) => {
    // Call registered handlers
    const handlers = eventHandlersRef.current.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event.type}:`, error);
        }
      });
    }

    // Call handlers from options
    const handlerKey = `on${event.type.split(':').map(s => 
      s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')}` as keyof WebSocketEventHandlers;
    
    const handler = options.handlers?.[handlerKey];
    if (handler) {
      try {
        handler(event as any);
      } catch (error) {
        console.error(`Error in WebSocket handler ${handlerKey}:`, error);
      }
    }

    // Generic handler
    if (options.handlers?.onEvent) {
      try {
        options.handlers.onEvent(event);
      } catch (error) {
        console.error('Error in generic WebSocket handler:', error);
      }
    }
  }, [options.handlers]);

  // Setup heartbeat
  const setupHeartbeat = useCallback(() => {
    if (!websocketConfig.heartbeat.enabled) return;

    const sendPing = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingStart = Date.now();
        wsRef.current.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString(),
        }));

        // Update latency when pong received
        const pongHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') {
              const latency = Date.now() - pingStart;
              updateState({ latency });
            }
          } catch {
            // Ignore parsing errors for non-JSON messages
          }
        };

        wsRef.current.addEventListener('message', pongHandler, { once: true });
      }
    };

    heartbeatIntervalRef.current = setInterval(
      sendPing,
      websocketConfig.heartbeat.interval
    );
  }, [updateState]);

  // Clear heartbeat
  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Process message queue
  const processMessageQueue = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];

    for (const message of queue) {
      try {
        await send(message);
      } catch (error) {
        console.error('Failed to send queued message:', error);
      }
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async (): Promise<void> => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (stateRef.current.isConnecting) {
      return;
    }

    updateState({
      isConnecting: true,
      connectionStatus: 'connecting',
    });

    try {
      const url = getWebSocketUrl(endpoint);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Set up event handlers
      ws.addEventListener('open', async () => {
        updateState({
          isConnected: true,
          isConnecting: false,
          isReconnecting: false,
          connectionStatus: 'connected',
          reconnectAttempts: 0,
          lastError: undefined,
        });

        // Send connection event
        const connectEvent: ConnectionEvent = {
          id: crypto.randomUUID(),
          type: 'connect',
          timestamp: new Date(),
          data: {
            connectionId: crypto.randomUUID(),
          },
        };
        handleEvent(connectEvent);

        // Set up heartbeat
        setupHeartbeat();

        // Process queued messages
        await processMessageQueue();
      });

      ws.addEventListener('close', (event) => {
        clearHeartbeat();

        updateState({
          isConnected: false,
          isConnecting: false,
          connectionStatus: 'disconnected',
        });

        // Send disconnect event
        const disconnectEvent: ConnectionEvent = {
          id: crypto.randomUUID(),
          type: 'disconnect',
          timestamp: new Date(),
          data: {
            connectionId: crypto.randomUUID(),
            reason: event.reason || 'Connection closed',
          },
        };
        handleEvent(disconnectEvent);

        // Attempt reconnection if enabled
        if (reconnection && !isUnmountedRef.current) {
          const attempts = stateRef.current.reconnectAttempts;
          if (attempts < websocketConfig.reconnection.maxAttempts) {
            updateState({
              isReconnecting: true,
              reconnectAttempts: attempts + 1,
            });

            const delay = getReconnectionDelay(attempts + 1);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isUnmountedRef.current) {
                connect();
              }
            }, delay);
          }
        }
      });

      ws.addEventListener('error', (error) => {
        const wsError: WebSocketError = {
          code: 'CONNECTION_FAILED',
          message: 'WebSocket connection error',
          recoverable: true,
        };

        updateState({
          connectionStatus: 'error',
          lastError: wsError,
        });

        console.error('WebSocket error:', error);
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

    } catch (error) {
      const wsError: WebSocketError = {
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to connect',
        recoverable: true,
      };

      updateState({
        isConnecting: false,
        connectionStatus: 'error',
        lastError: wsError,
      });

      throw error;
    }
  }, [endpoint, reconnection, updateState, handleEvent, setupHeartbeat, processMessageQueue]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearHeartbeat();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    updateState({
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
    });
  }, [clearHeartbeat, updateState]);

  // Send message
  const send = useCallback(async (event: WebSocketEvent): Promise<void> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      if (messageQueueRef.current.length < maxQueueSize) {
        messageQueueRef.current.push(event);
      }
      throw new Error('WebSocket is not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        wsRef.current!.send(JSON.stringify(event));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  // Subscribe to channel
  const subscribe = useCallback(async (channel: string): Promise<void> => {
    await send({
      id: crypto.randomUUID(),
      type: 'subscribe',
      timestamp: new Date(),
      data: { channel },
    } as any);
  }, [send]);

  // Unsubscribe from channel
  const unsubscribe = useCallback(async (channel: string): Promise<void> => {
    await send({
      id: crypto.randomUUID(),
      type: 'unsubscribe',
      timestamp: new Date(),
      data: { channel },
    } as any);
  }, [send]);

  // Register event handler
  const on = useCallback(<T extends WebSocketEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ): (() => void) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, new Set());
    }
    eventHandlersRef.current.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = eventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  // Unregister event handler
  const off = useCallback((eventType: string, handler?: (event: WebSocketEvent) => void) => {
    if (!handler) {
      eventHandlersRef.current.delete(eventType);
    } else {
      const handlers = eventHandlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          eventHandlersRef.current.delete(eventType);
        }
      }
    }
  }, []);

  // Auto connect on mount
  useEffect(() => {
    isUnmountedRef.current = false;

    if (autoConnect) {
      connect();
    }

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Return hook interface
  return useMemo(() => ({
    state,
    connect,
    disconnect,
    send,
    subscribe,
    unsubscribe,
    on,
    off,
  }), [state, connect, disconnect, send, subscribe, unsubscribe, on, off]);
}

// =====================================================
// Specialized Hooks for Different Use Cases
// =====================================================

/**
 * Hook for email real-time updates
 */
export function useEmailWebSocket(handlers?: WebSocketEventHandlers) {
  return useEnhancedWebSocket({
    endpoint: 'email',
    handlers,
  });
}

/**
 * Hook for workflow real-time updates
 */
export function useWorkflowWebSocket(handlers?: WebSocketEventHandlers) {
  return useEnhancedWebSocket({
    endpoint: 'socketio',
    handlers,
  });
}

/**
 * Hook for system monitoring
 */
export function useSystemWebSocket(handlers?: WebSocketEventHandlers) {
  return useEnhancedWebSocket({
    endpoint: 'socketio',
    handlers,
  });
}