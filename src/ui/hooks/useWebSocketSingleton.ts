import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { getReconnectionDelay } from "../../config/websocket.config.js";
import { logger } from "../../utils/logger.js";

// WebSocket event type definition
interface WebSocketEvent {
  type: string;
  data?: unknown;
  timestamp?: number;
  [key: string]: unknown;
}

// Singleton WebSocket manager to prevent multiple connections
class WebSocketSingleton {
  private static instance: WebSocketSingleton;
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimeouts = new Set<NodeJS.Timeout>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isReconnecting = false;
  private subscribers = new Map<string, Set<(event: WebSocketEvent) => void>>();
  private connectionState: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';
  private lastError: Error | null = null;
  
  // Connection listeners
  private onOpenCallbacks = new Set<() => void>();
  private onCloseCallbacks = new Set<() => void>();
  private onErrorCallbacks = new Set<(error: Error) => void>();

  private constructor(url: string) {
    this.url = url;
  }

  public static getInstance(url?: string): WebSocketSingleton {
    const wsUrl = url || (process.env.NODE_ENV === 'production' 
      ? `wss://${window?.location?.hostname}:8080/ws/walmart`
      : `ws://localhost:8080/ws/walmart`);
      
    if (!WebSocketSingleton.instance || WebSocketSingleton.instance.url !== wsUrl) {
      if (WebSocketSingleton.instance) {
        WebSocketSingleton.instance.disconnect();
      }
      WebSocketSingleton.instance = new WebSocketSingleton(wsUrl);
    }
    return WebSocketSingleton.instance;
  }

  public connect(): void {
    if (this.isReconnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    logger.info(`WebSocket connecting to: ${this.url}`, "WS_SINGLETON");
    this.connectionState = 'connecting';

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        logger.info("WebSocket connected successfully", "WS_SINGLETON");
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.lastError = null;
        
        // Clear any pending reconnection timeouts
        this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
        this.reconnectTimeouts.clear();
        
        this.onOpenCallbacks.forEach(callback => callback());
      };

      this.ws.onclose = (event) => {
        logger.warn(`WebSocket disconnected: ${event.code} - ${event.reason}`, "WS_SINGLETON");
        this.connectionState = 'disconnected';
        this.ws = null;
        
        this.onCloseCallbacks.forEach(callback => callback());

        // Attempt reconnection with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = getReconnectionDelay(this.reconnectAttempts + 1);
          
          logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`, "WS_SINGLETON");
          
          const timeout = setTimeout(() => {
            this.reconnectTimeouts.delete(timeout);
            this.reconnectAttempts++;
            this.isReconnecting = true;
            this.connect();
          }, delay);
          
          this.reconnectTimeouts.add(timeout);
        } else {
          const error = new Error("Maximum reconnection attempts reached");
          logger.error("WebSocket max reconnect attempts reached", "WS_SINGLETON", error);
          this.connectionState = 'error';
          this.lastError = error;
          this.onErrorCallbacks.forEach(callback => callback(error));
        }
      };

      this.ws.onerror = (event) => {
        const error = new Error("WebSocket connection error");
        logger.error("WebSocket error occurred", "WS_SINGLETON", error);
        this.lastError = error;
        this.onErrorCallbacks.forEach(callback => callback(error));
      };

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.notifySubscribers(parsed);
        } catch (error) {
          logger.error("Failed to parse WebSocket message", "WS_SINGLETON", error);
        }
      };
      
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to create WebSocket connection", "WS_SINGLETON", err);
      this.connectionState = 'error';
      this.lastError = err;
      this.isReconnecting = false;
      this.onErrorCallbacks.forEach(callback => callback(err));
    }
  }

  public disconnect(): void {
    logger.info("WebSocket disconnecting", "WS_SINGLETON");
    
    // Clear reconnection timeouts
    this.reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
    this.reconnectTimeouts.clear();
    
    this.isReconnecting = false;
    this.reconnectAttempts = 0;
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connectionState = 'disconnected';
  }

  public send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      logger.debug("Message sent", "WS_SINGLETON", message);
    } else {
      logger.warn("Cannot send message - WebSocket not connected", "WS_SINGLETON");
    }
  }

  public subscribe(subscriberId: string, eventTypes: string[], callback: (event: WebSocketEvent) => void): void {
    if (!this.subscribers.has(subscriberId)) {
      this.subscribers.set(subscriberId, new Set());
    }
    
    const subscriberCallbacks = this.subscribers.get(subscriberId)!;
    subscriberCallbacks.add(callback);
    
    logger.debug(`Subscriber ${subscriberId} subscribed to events:`, "WS_SINGLETON", eventTypes);
  }

  public unsubscribe(subscriberId: string, callback?: (event: any) => void): void {
    const subscriberCallbacks = this.subscribers.get(subscriberId);
    if (!subscriberCallbacks) return;
    
    if (callback) {
      subscriberCallbacks.delete(callback);
    } else {
      subscriberCallbacks.clear();
    }
    
    if (subscriberCallbacks.size === 0) {
      this.subscribers.delete(subscriberId);
    }
    
    logger.debug(`Subscriber ${subscriberId} unsubscribed`, "WS_SINGLETON");
  }

  private notifySubscribers(event: any): void {
    this.subscribers.forEach((callbacks, subscriberId) => {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          logger.error(`Error in subscriber ${subscriberId} callback`, "WS_SINGLETON", error);
        }
      });
    });
  }

  // Connection state getters
  public getConnectionState() {
    return this.connectionState;
  }

  public isConnected(): boolean {
    return this.connectionState === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  public getLastError(): Error | null {
    return this.lastError;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // Event listeners management
  public onConnect(callback: () => void): () => void {
    this.onOpenCallbacks.add(callback);
    return () => this.onOpenCallbacks.delete(callback);
  }

  public onDisconnect(callback: () => void): () => void {
    this.onCloseCallbacks.add(callback);
    return () => this.onCloseCallbacks.delete(callback);
  }

  public onError(callback: (error: Error) => void): () => void {
    this.onErrorCallbacks.add(callback);
    return () => this.onErrorCallbacks.delete(callback);
  }
}

export interface UseWebSocketSingletonOptions {
  url?: string;
  autoConnect?: boolean;
  subscriberId?: string;
  eventTypes?: string[];
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (event: any) => void;
}

export interface UseWebSocketSingletonReturn {
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
  lastError: Error | null;
  send: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocketSingleton(
  options: UseWebSocketSingletonOptions = {}
): UseWebSocketSingletonReturn {
  const {
    url,
    autoConnect = true,
    subscriberId = `subscriber-${Math.random().toString(36).substr(2, 9)}`,
    eventTypes = [],
    onConnect,
    onDisconnect,
    onError,
    onMessage
  } = options;

  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsInstanceRef = useRef<WebSocketSingleton | null>(null);
  const subscriberIdRef = useRef(subscriberId);
  
  // Stable callback refs to prevent infinite loops
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);
  
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    onErrorRef.current = onError;
    onMessageRef.current = onMessage;
  });

  // Initialize singleton instance
  useEffect(() => {
    wsInstanceRef.current = WebSocketSingleton.getInstance(url);
    
    // Set up event listeners
    const unsubscribeConnect = wsInstanceRef.current.onConnect(() => {
      setConnectionState('connected');
      setLastError(null);
      setReconnectAttempts(0);
      onConnectRef.current?.();
    });
    
    const unsubscribeDisconnect = wsInstanceRef.current.onDisconnect(() => {
      setConnectionState('disconnected');
      onDisconnectRef.current?.();
    });
    
    const unsubscribeError = wsInstanceRef.current.onError((error) => {
      setConnectionState('error');
      setLastError(error);
      onErrorRef.current?.(error);
    });

    // Subscribe to messages if callback provided
    if (onMessage) {
      wsInstanceRef.current.subscribe(
        subscriberIdRef.current,
        eventTypes,
        onMessageRef.current
      );
    }

    // Auto-connect if enabled
    if (autoConnect) {
      wsInstanceRef.current.connect();
    }

    return () => {
      // Cleanup subscriptions
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
      
      if (wsInstanceRef.current) {
        wsInstanceRef.current.unsubscribe(subscriberIdRef.current);
      }
    };
  }, [url, autoConnect]); // Only depend on stable values

  // Update connection state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsInstanceRef.current) {
        setConnectionState(wsInstanceRef.current.getConnectionState());
        setLastError(wsInstanceRef.current.getLastError());
        setReconnectAttempts(wsInstanceRef.current.getReconnectAttempts());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Memoize stable functions to prevent hook consumers from re-rendering
  const stableFunctions = useMemo(() => ({
    send: (message: any) => wsInstanceRef.current?.send(message),
    connect: () => wsInstanceRef.current?.connect(),
    disconnect: () => wsInstanceRef.current?.disconnect()
  }), []); // Empty deps - these functions are stable

  return {
    isConnected: connectionState === 'connected',
    connectionState,
    reconnectAttempts,
    lastError,
    ...stableFunctions
  };
}