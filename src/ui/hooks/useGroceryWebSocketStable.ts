import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useWebSocketSingleton } from "./useWebSocketSingleton.js";
import { logger } from "../../utils/logger.js";

// Re-export types from the original hook for compatibility
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

export interface UseGroceryWebSocketStableOptions {
  conversationId?: string;
  userId?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onEvent?: (event: GroceryWebSocketEvent) => void;
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

export interface UseGroceryWebSocketStableReturn extends GroceryWebSocketState {
  // Stable functions that won't cause re-renders when used as dependencies
  connect: () => void;
  disconnect: () => void;
  send: (message: unknown) => void;
  
  // Event subscription functions with stable references
  subscribeToEvents: (events: GroceryWebSocketEventType[]) => void;
  unsubscribeFromEvents: (events: GroceryWebSocketEventType[]) => void;
  clearEventHistory: () => void;
  
  // Stable subscription function for price updates
  subscribeToPrice: (productIds: string[]) => void;
}

const MAX_EVENT_HISTORY = 50;

export function useGroceryWebSocketStable(
  options: UseGroceryWebSocketStableOptions = {}
): UseGroceryWebSocketStableReturn {
  const {
    conversationId,
    userId,
    onConnect,
    onDisconnect,
    onError,
    onEvent,
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

  // Refs for stable callback storage
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  const onEventRef = useRef(onEvent);
  const subscribedEventsRef = useRef<Set<GroceryWebSocketEventType>>(new Set());
  const subscribedProductsRef = useRef<Set<string>>(new Set());

  // Update callback refs without triggering re-renders
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
    onEventRef.current = onEvent;
  });

  // Log helper with stable reference
  const log = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info', data?: unknown) => {
    if (enableLogging) {
      logger[level](message, "GROCERY_WS_STABLE", data);
    }
  }, [enableLogging]);

  // Handle incoming messages with stable reference
  const handleMessage = useCallback((event: any) => {
    if (!event.type) return;

    // Filter events based on subscriptions
    if (subscribedEventsRef.current.size > 0 && !subscribedEventsRef.current.has(event.type)) {
      return; // Skip unsubscribed events
    }

    const groceryEvent: GroceryWebSocketEvent = {
      type: event.type,
      data: event.data,
      timestamp: event.timestamp ? new Date(event.timestamp).getTime() : Date.now(),
      conversationId: event.conversationId,
      userId: event.userId,
    };

    log(`Received event: ${event.type}`, 'info', groceryEvent);

    setState(prev => ({
      ...prev,
      lastEvent: groceryEvent,
      eventHistory: [...prev.eventHistory, groceryEvent].slice(-MAX_EVENT_HISTORY)
    }));

    // Call the user's event handler
    onEventRef.current?.(groceryEvent);
  }, [log]);

  // WebSocket singleton connection
  const {
    isConnected,
    connectionState,
    reconnectAttempts,
    lastError,
    send: wsSend,
    connect: wsConnect,
    disconnect: wsDisconnect
  } = useWebSocketSingleton({
    autoConnect: true,
    subscriberId: `grocery-${conversationId || 'default'}-${userId || 'anonymous'}`,
    onConnect: () => {
      log("Connected to WebSocket", 'info');
      onConnectRef.current?.();
      
      // Auto-subscribe to channels on connect
      if (conversationId) {
        wsSend({
          type: "subscribe",
          channels: [
            `grocery.conversation.${conversationId}`,
            `grocery.user.${userId || 'anonymous'}`,
            "grocery.global.deals",
            "grocery.global.prices"
          ]
        });
      }
    },
    onDisconnect: () => {
      log("Disconnected from WebSocket", 'warn');
      onDisconnectRef.current?.();
    },
    onError: (error) => {
      log("WebSocket error", 'error', error);
      onErrorRef.current?.(error);
    },
    onMessage: handleMessage
  });

  // Update state when connection changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      isConnected,
      connectionStatus: connectionState,
      reconnectAttempts,
      error: lastError
    }));
  }, [isConnected, connectionState, reconnectAttempts, lastError]);

  // Create stable functions that won't change reference unless needed
  const stableFunctions = useMemo(() => ({
    // Send message through WebSocket
    send: (message: unknown) => {
      wsSend(message);
      log("Sent message", 'info', message);
    },

    // Connection control
    connect: () => {
      log("Manually connecting WebSocket", 'info');
      wsConnect();
    },

    disconnect: () => {
      log("Manually disconnecting WebSocket", 'info');
      wsDisconnect();
    },

    // Event subscription management  
    subscribeToEvents: (events: GroceryWebSocketEventType[]) => {
      events.forEach(event => subscribedEventsRef.current.add(event));
      log("Subscribed to events", 'info', events);
    },

    unsubscribeFromEvents: (events: GroceryWebSocketEventType[]) => {
      events.forEach(event => subscribedEventsRef.current.delete(event));
      log("Unsubscribed from events", 'info', events);
    },

    clearEventHistory: () => {
      setState(prev => ({ ...prev, eventHistory: [], lastEvent: null }));
      log("Cleared event history", 'info');
    },

    // Stable function for price subscription - THIS IS KEY TO PREVENT LOOPS
    subscribeToPrice: (productIds: string[]) => {
      // Only process new subscriptions to avoid unnecessary calls
      const newProductIds = productIds.filter(id => !subscribedProductsRef.current.has(id));
      
      if (newProductIds.length > 0) {
        newProductIds.forEach(id => subscribedProductsRef.current.add(id));
        
        // Subscribe to price-related events if connected
        if (isConnected) {
          subscribedEventsRef.current.add('price_updated');
          subscribedEventsRef.current.add('deal_detected');
          subscribedEventsRef.current.add('totals_calculated');
          
          // Send subscription message to server
          wsSend({
            type: "subscribe_prices",
            productIds: Array.from(subscribedProductsRef.current),
            conversationId,
            userId
          });
        }
        
        log(`Subscribed to price updates for ${newProductIds.length} new products`, 'info', newProductIds);
      }
    }
  }), [wsSend, wsConnect, wsDisconnect, isConnected, conversationId, userId, log]);

  return {
    ...state,
    ...stableFunctions
  };
}