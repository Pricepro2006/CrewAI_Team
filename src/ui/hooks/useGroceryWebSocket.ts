import { useEffect, useRef, useCallback, useState } from "react";
import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/trpc/router.js";
import { getReconnectionDelay } from "../../config/websocket.config.js";
import { logger } from "../../utils/logger.js";

// Event types specific to grocery operations
export type GroceryWebSocketEventType = 
  | 'grocery_input_processed'
  | 'totals_calculated' 
  | 'recommendations_generated'
  | 'price_updated'
  | 'cart_updated'
  | 'deal_detected'
  | 'inventory_changed';

export interface GroceryWebSocketEvent {
  type: GroceryWebSocketEventType;
  data: unknown;
  timestamp: number;
  conversationId?: string;
  userId?: string;
}

export interface UseGroceryWebSocketOptions {
  conversationId?: string;
  userId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onEvent?: (event: GroceryWebSocketEvent) => void;
  maxReconnectAttempts?: number;
  enableLogging?: boolean;
}

export interface GroceryWebSocketState {
  isConnected: boolean;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
  reconnectAttempts: number;
  lastEvent: GroceryWebSocketEvent | null;
  eventHistory: GroceryWebSocketEvent[];
  error: Error | null;
}

export interface UseGroceryWebSocketReturn extends GroceryWebSocketState {
  client: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (events: GroceryWebSocketEventType[]) => void;
  unsubscribe: (events: GroceryWebSocketEventType[]) => void;
  clearEventHistory: () => void;
}

const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window?.location?.hostname}:3002/trpc-ws`
  : `ws://localhost:3002/trpc-ws`;
const MAX_EVENT_HISTORY = 50;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

export function useGroceryWebSocket(
  options: UseGroceryWebSocketOptions = {}
): UseGroceryWebSocketReturn {
  const {
    conversationId,
    userId,
    onConnect,
    onDisconnect,
    onError,
    onEvent,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    enableLogging = true,
  } = options;

  // State management
  const [state, setState] = useState<GroceryWebSocketState>({
    isConnected: false,
    connectionStatus: "disconnected",
    reconnectAttempts: 0,
    lastEvent: null,
    eventHistory: [],
    error: null,
  });

  // Refs for managing connections and cleanup
  const clientRef = useRef<ReturnType<typeof createTRPCProxyClient<AppRouter>> | null>(null);
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const subscriptionsRef = useRef<Set<GroceryWebSocketEventType>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isReconnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Log helper
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info', data?: unknown) => {
    if (enableLogging) {
      logger[level](message, "GROCERY_WS", data);
    }
  }, [enableLogging]);

  // Update state helper
  const updateState = useCallback((updates: Partial<GroceryWebSocketState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle incoming events
  const handleEvent = useCallback((event: GroceryWebSocketEvent) => {
    if (!isMountedRef.current) return;

    log(`Received event: ${event.type}`, 'info', event);

    setState(prev => ({
      ...prev,
      lastEvent: event,
      eventHistory: [...prev.eventHistory, event].slice(-MAX_EVENT_HISTORY)
    }));

    onEvent?.(event);
  }, [onEvent, log]);

  // Connection establishment
  const connect = useCallback(() => {
    if (isReconnectingRef.current || !isMountedRef.current) {
      return;
    }

    if (wsClientRef.current) {
      log("WebSocket already connected", 'warn');
      return;
    }

    log("Connecting to WebSocket...", 'info', { url: WS_URL, conversationId, userId });
    updateState({ connectionStatus: "connecting", error: null });

    try {
      const wsClient = createWSClient({
        url: WS_URL,
        onOpen: () => {
          if (!isMountedRef.current) return;

          log("WebSocket connected successfully", 'info');
          
          updateState({ 
            isConnected: true, 
            connectionStatus: "connected", 
            reconnectAttempts: 0,
            error: null 
          });
          
          isReconnectingRef.current = false;
          onConnect?.();

          // Subscribe to grocery-specific channels
          if (conversationId) {
            try {
              const ws = wsClient.getConnection();
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: "subscribe",
                  channels: [
                    `grocery.conversation.${conversationId}`,
                    `grocery.user.${userId || 'anonymous'}`,
                    "grocery.global.deals",
                    "grocery.global.prices"
                  ]
                }));
              }
            } catch (error) {
              log("Failed to send subscription message", 'warn', error);
            }
          }
        },
        onClose: (event: unknown) => {
          if (!isMountedRef.current) return;

          log("WebSocket disconnected", 'warn', { code: event?.code, reason: event?.reason });
          
          updateState({ 
            isConnected: false, 
            connectionStatus: "disconnected" 
          });
          
          wsClientRef.current = null;
          clientRef.current = null;
          onDisconnect?.();

          // Attempt reconnection if within retry limits
          setState(prev => {
            if (prev.reconnectAttempts < maxReconnectAttempts && isMountedRef.current) {
              const delay = getReconnectionDelay(prev.reconnectAttempts + 1);
              
              log(`Attempting reconnection in ${delay}ms (attempt ${prev.reconnectAttempts + 1}/${maxReconnectAttempts})`, 'info');
              
              isReconnectingRef.current = true;
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  connect();
                }
              }, delay);
              
              return { ...prev, reconnectAttempts: prev.reconnectAttempts + 1 };
            } else if (prev.reconnectAttempts >= maxReconnectAttempts) {
              const error = new Error("Max reconnection attempts reached");
              log("Max reconnection attempts reached", 'error', error);
              updateState({ connectionStatus: "error", error });
              onError?.(error);
              return prev;
            }
            return prev;
          });
        },

      });

      wsClientRef.current = wsClient;

      // Create tRPC client
      const client = createTRPCProxyClient<AppRouter>({
        transformer: superjson,
        links: [
          wsLink({
            client: wsClient,
          }),
        ],
      });

      clientRef.current = client;
      
    } catch (error) {
      const err = error as Error;
      log("Failed to create WebSocket connection", 'error', err);
      updateState({ connectionStatus: "error", error: err });
      onError?.(err);
      isReconnectingRef.current = false;
    }
  }, [
    maxReconnectAttempts,
    conversationId,
    userId,
    onConnect,
    onDisconnect,
    onError,
    log,
    updateState
  ]);

  // Disconnect function
  const disconnect = useCallback(() => {
    log("Disconnecting WebSocket...", 'info');
    
    isMountedRef.current = false;
    isReconnectingRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    if (wsClientRef.current) {
      wsClientRef?.current?.close();
      wsClientRef.current = null;
    }

    clientRef.current = null;
    subscriptionsRef?.current?.clear();

    updateState({
      isConnected: false,
      connectionStatus: "disconnected",
      reconnectAttempts: 0,
      error: null
    });
  }, [log, updateState]);

  // Subscribe to specific events
  const subscribe = useCallback((events: GroceryWebSocketEventType[]) => {
    events.forEach(event => subscriptionsRef?.current?.add(event));
    
    if (wsClientRef.current && state.isConnected) {
      try {
        const ws = wsClientRef.current.getConnection();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "subscribe",
            events: events
          }));
        }
      } catch (error) {
        log("Failed to send subscription message", 'warn', error);
      }
    }
    
    log(`Subscribed to events: ${events.join(", ")}`, 'info');
  }, [state.isConnected, log]);

  // Unsubscribe from specific events
  const unsubscribe = useCallback((events: GroceryWebSocketEventType[]) => {
    events.forEach(event => subscriptionsRef?.current?.delete(event));
    
    if (wsClientRef.current && state.isConnected) {
      try {
        const ws = wsClientRef.current.getConnection();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "unsubscribe",
            events: events
          }));
        }
      } catch (error) {
        log("Failed to send unsubscription message", 'warn', error);
      }
    }
    
    log(`Unsubscribed from events: ${events.join(", ")}`, 'info');
  }, [state.isConnected, log]);

  // Clear event history
  const clearEventHistory = useCallback(() => {
    updateState({ eventHistory: [], lastEvent: null });
  }, [updateState]);

  // Auto-connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Subscribe to all grocery events by default
    subscriptionsRef.current = new Set<GroceryWebSocketEventType>([
      'grocery_input_processed',
      'totals_calculated', 
      'recommendations_generated',
      'price_updated',
      'cart_updated',
      'deal_detected',
      'inventory_changed'
    ]);
    
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Update connection when conversation/user changes
  useEffect(() => {
    if (state.isConnected && wsClientRef.current) {
      // Re-subscribe with new context
      try {
        const ws = wsClientRef.current.getConnection();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "subscribe",
            channels: [
              `grocery.conversation.${conversationId || 'default'}`,
              `grocery.user.${userId || 'anonymous'}`,
              "grocery.global.deals",
              "grocery.global.prices"
            ]
          }));
        }
      } catch (error) {
        log("Failed to re-subscribe with new context", 'warn', error);
      }
    }
  }, [conversationId, userId, state.isConnected]);

  return {
    ...state,
    client: clientRef.current,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    clearEventHistory,
  };
}

export default useGroceryWebSocket;