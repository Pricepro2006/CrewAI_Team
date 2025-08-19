import { useEffect, useRef, useCallback, useState } from "react";
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
  data: any;
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
  connect: () => void;
  disconnect: () => void;
  subscribe: (events: GroceryWebSocketEventType[]) => void;
  unsubscribe: (events: GroceryWebSocketEventType[]) => void;
  clearEventHistory: () => void;
  send: (message: any) => void;
}

const WS_URL = process.env.NODE_ENV === 'production' 
  ? `wss://${window?.location?.hostname}:8080/ws/walmart`
  : `ws://localhost:8080/ws/walmart`;
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
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Set<GroceryWebSocketEventType>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isReconnectingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Log helper
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info', data?: any) => {
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

  // Send message through WebSocket
  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef?.current?.readyState === WebSocket.OPEN) {
      wsRef?.current?.send(JSON.stringify(message));
      log("Sent message", 'info', message);
    } else {
      log("WebSocket not connected, cannot send message", 'warn');
    }
  }, [log]);

  // Connection establishment
  const connect = useCallback(() => {
    if (isReconnectingRef.current || !isMountedRef.current) {
      return;
    }

    if (wsRef.current && wsRef?.current?.readyState === WebSocket.OPEN) {
      log("WebSocket already connected", 'warn');
      return;
    }

    log("Connecting to WebSocket...", 'info', { url: WS_URL, conversationId, userId });
    updateState({ connectionStatus: "connecting", error: null });

    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
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
          send({
            type: "subscribe",
            channels: [
              `grocery.conversation.${conversationId}`,
              `grocery.user.${userId || 'anonymous'}`,
              "grocery?.global?.deals",
              "grocery?.global?.prices"
            ]
          });
        }
      };

      ws.onclose = (event: any) => {
        if (!isMountedRef.current) return;

        log("WebSocket disconnected", 'warn', { code: event.code, reason: event.reason });
        
        updateState({ 
          isConnected: false, 
          connectionStatus: "disconnected" 
        });
        
        wsRef.current = null;
        onDisconnect?.();

        // Attempt reconnection if within retry limits
        if (state.reconnectAttempts < maxReconnectAttempts && isMountedRef.current) {
          const delay = getReconnectionDelay(state.reconnectAttempts + 1);
          
          log(`Attempting reconnection in ${delay}ms (attempt ${state.reconnectAttempts + 1}/${maxReconnectAttempts})`, 'info');
          
          isReconnectingRef.current = true;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
              connect();
            }
          }, delay);
        } else if (state.reconnectAttempts >= maxReconnectAttempts) {
          const error = new Error("Max reconnection attempts reached");
          log("Max reconnection attempts reached", 'error', error);
          updateState({ connectionStatus: "error", error });
          onError?.(error);
        }
      };

      ws.onerror = (event: any) => {
        log("WebSocket error", 'error', event);
        const error = new Error("WebSocket connection error");
        updateState({ error });
        onError?.(error);
      };

      ws.onmessage = (event: any) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type && (subscriptionsRef?.current?.size === 0 || subscriptionsRef?.current?.has(parsed.type))) {
            handleEvent({
              type: parsed.type,
              data: parsed.data,
              timestamp: parsed.timestamp ? new Date(parsed.timestamp).getTime() : Date.now(),
              conversationId: parsed.conversationId,
              userId: parsed.userId,
            });
          }
        } catch (error) {
          log("Failed to parse WebSocket message", 'error', error);
        }
      };

      wsRef.current = ws;
      
    } catch (error) {
      const err = error as Error;
      log("Failed to create WebSocket connection", 'error', err);
      updateState({ connectionStatus: "error", error: err });
      onError?.(err);
      isReconnectingRef.current = false;
    }
  }, [
    state.reconnectAttempts,
    maxReconnectAttempts,
    conversationId,
    userId,
    onConnect,
    onDisconnect,
    onError,
    handleEvent,
    send,
    log,
    updateState
  ]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    log("Disconnecting WebSocket...", 'info');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (wsRef.current) {
      wsRef?.current?.close();
      wsRef.current = null;
    }
    
    updateState({ 
      isConnected: false, 
      connectionStatus: "disconnected",
      reconnectAttempts: 0 
    });
  }, [log, updateState]);

  // Subscribe to events
  const subscribe = useCallback((events: GroceryWebSocketEventType[]) => {
    events.forEach(event => subscriptionsRef?.current?.add(event));
    log("Subscribed to events", 'info', events);
  }, [log]);

  // Unsubscribe from events
  const unsubscribe = useCallback((events: GroceryWebSocketEventType[]) => {
    events.forEach(event => subscriptionsRef?.current?.delete(event));
    log("Unsubscribed from events", 'info', events);
  }, [log]);

  // Clear event history
  const clearEventHistory = useCallback(() => {
    updateState({ eventHistory: [], lastEvent: null });
    log("Cleared event history", 'info');
  }, [log, updateState]);

  // Auto-connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, []); // Empty deps to only run on mount/unmount

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    clearEventHistory,
    send,
  };
}