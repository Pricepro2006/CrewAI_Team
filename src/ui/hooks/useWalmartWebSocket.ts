/**
 * React hook for Walmart WebSocket connection
 * Provides real-time updates for NLP processing and cart changes
 * Implements exponential backoff with jitter for robust reconnection
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

export interface WSMessage {
  type: "nlp_processing" | "nlp_result" | "cart_update" | "price_update" | "product_match" | "error";
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export interface UseWalmartWebSocketOptions {
  userId?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectDelayMultiplier?: number;
  enableJitter?: boolean;
}

enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FAILED = "failed"
}

export const useWalmartWebSocket = (options: UseWalmartWebSocketOptions = {}) => {
  // Import auth hook (you'll need to add the import at the top)
  // const { user, token } = useAuth();
  
  const {
    userId = options.userId, // Use provided userId or null for unauthenticated
    autoConnect = true,
    maxReconnectAttempts = 10,
    initialReconnectDelay = 1000,
    maxReconnectDelay = 30000,
    reconnectDelayMultiplier = 1.5,
    enableJitter = true
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [nlpProcessing, setNlpProcessing] = useState(false);
  const [nlpResult, setNlpResult] = useState<any>(null);
  const [productMatches, setProductMatches] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(uuidv4());
  const reconnectCountRef = useRef(0);
  const reconnectDelayRef = useRef(initialReconnectDelay);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isIntentionalDisconnectRef = useRef(false);
  const lastPingTimeRef = useRef<number>(Date.now());
  const missedPongsRef = useRef(0);

  /**
   * Calculate next reconnect delay with exponential backoff and optional jitter
   */
  const calculateNextDelay = useCallback(() => {
    let delay = Math.min(
      reconnectDelayRef.current * reconnectDelayMultiplier,
      maxReconnectDelay
    );
    
    if (enableJitter) {
      // Add random jitter between -25% to +25% of the delay
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay = Math.max(initialReconnectDelay, delay + jitter);
    }
    
    reconnectDelayRef.current = delay;
    return Math.floor(delay);
  }, [initialReconnectDelay, maxReconnectDelay, reconnectDelayMultiplier, enableJitter]);

  /**
   * Reset reconnection state
   */
  const resetReconnectionState = useCallback(() => {
    reconnectCountRef.current = 0;
    reconnectDelayRef.current = initialReconnectDelay;
    missedPongsRef.current = 0;
  }, [initialReconnectDelay]);

  /**
   * Clean up timers
   */
  const cleanupTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      connectionState === ConnectionState.CONNECTING
    ) {
      return;
    }

    // Check if we've exceeded max reconnection attempts
    if (reconnectCountRef.current >= maxReconnectAttempts) {
      setConnectionState(ConnectionState.FAILED);
      setError(`Failed to connect after ${maxReconnectAttempts} attempts`);
      return;
    }

    isIntentionalDisconnectRef.current = false;
    setConnectionState(
      reconnectCountRef.current > 0 
        ? ConnectionState.RECONNECTING 
        : ConnectionState.CONNECTING
    );
    setError(null);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === "production" ? "" : ":3001";
    const wsUrl = `${protocol}//${host}${port}/ws/walmart/secure`; // Use secure endpoint

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          handleReconnection();
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        setConnectionState(ConnectionState.CONNECTED);
        resetReconnectionState();
        
        // Send authentication with token (get from localStorage or auth context)
        const token = localStorage.getItem('walmart_auth_token');
        if (token) {
          ws.send(JSON.stringify({
            type: "auth",
            token: token
          }));
        } else {
          setError('Authentication required');
          ws.close();
          return;
        }

        // Subscribe to events
        ws.send(JSON.stringify({
          type: "subscribe",
          events: ["nlp", "cart_sync", "price_updates"]
        }));

        // Start heartbeat
        startHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          // Handle pong messages for heartbeat
          if ((message as any).type === "pong") {
            missedPongsRef.current = 0;
            return;
          }
          
          handleMessage(message);
        } catch (err) {
          setError("Failed to parse message");
        }
      };

      ws.onerror = (event) => {
        clearTimeout(connectionTimeout);
        setError("WebSocket connection error");
      };

      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        wsRef.current = null;
        cleanupTimers();
        
        // Only attempt reconnection if it wasn't an intentional disconnect
        if (!isIntentionalDisconnectRef.current && event.code !== 1000) {
          setConnectionState(ConnectionState.DISCONNECTED);
          handleReconnection();
        } else {
          setConnectionState(ConnectionState.DISCONNECTED);
        }
      };
    } catch (err) {
      setError("Failed to create WebSocket connection");
      setConnectionState(ConnectionState.DISCONNECTED);
      handleReconnection();
    }
  }, [userId, maxReconnectAttempts, connectionState, resetReconnectionState, cleanupTimers]);

  /**
   * Handle reconnection with exponential backoff
   */
  const handleReconnection = useCallback(() => {
    if (isIntentionalDisconnectRef.current) {
      return;
    }

    reconnectCountRef.current++;
    
    if (reconnectCountRef.current >= maxReconnectAttempts) {
      setConnectionState(ConnectionState.FAILED);
      setError(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
      return;
    }

    const delay = calculateNextDelay();
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [maxReconnectAttempts, calculateNextDelay, connect]);

  /**
   * Start heartbeat mechanism
   */
  const startHeartbeat = useCallback((ws: WebSocket) => {
    // Clear any existing heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Check if we've missed too many pongs
        if (missedPongsRef.current >= 3) {
          ws.close();
          return;
        }

        ws.send(JSON.stringify({ type: "ping" }));
        missedPongsRef.current++;
        lastPingTimeRef.current = Date.now();
      }
    }, 30000); // Send ping every 30 seconds
  }, []);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    cleanupTimers();

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "User disconnect");
      }
      wsRef.current = null;
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    resetReconnectionState();
  }, [cleanupTimers, resetReconnectionState]);

  /**
   * Send message to server
   */
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      setError("Cannot send message - not connected");
      return false;
    }
  }, []);

  /**
   * Handle incoming messages
   */
  const handleMessage = useCallback((message: WSMessage) => {
    setLastMessage(message);

    switch (message.type) {
      case "nlp_processing":
        if (message.data.status === "started") {
          setNlpProcessing(true);
          setNlpResult(null);
        }
        break;

      case "nlp_result":
        setNlpProcessing(false);
        setNlpResult(message.data);
        break;

      case "product_match":
        setProductMatches(message.data.products || []);
        break;

      case "cart_update":
        // Cart update handled silently
        break;

      case "price_update":
        // Price update handled silently
        break;

      case "error":
        setError(message.data.error || "Unknown error");
        setNlpProcessing(false);
        break;

      default:
        // Unknown message types ignored
    }
  }, []);

  /**
   * Get current session ID
   */
  const getSessionId = useCallback(() => {
    return sessionIdRef.current;
  }, []);

  /**
   * Reset session
   */
  const resetSession = useCallback(() => {
    sessionIdRef.current = uuidv4();
    setNlpResult(null);
    setProductMatches([]);
    setError(null);
  }, []);

  /**
   * Manually retry connection
   */
  const retry = useCallback(() => {
    resetReconnectionState();
    disconnect();
    setTimeout(() => {
      connect();
    }, 100);
  }, [resetReconnectionState, disconnect, connect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      isIntentionalDisconnectRef.current = true;
      cleanupTimers();
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmount");
      }
    };
  }, []); // Empty deps to only run on mount/unmount

  // Derived state
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING;
  const isFailed = connectionState === ConnectionState.FAILED;

  return {
    // Connection state
    isConnected,
    isConnecting,
    isFailed,
    connectionState,
    error,
    reconnectAttempts: reconnectCountRef.current,
    maxReconnectAttempts,
    
    // Messages
    lastMessage,
    nlpProcessing,
    nlpResult,
    productMatches,
    
    // Actions
    connect,
    disconnect,
    sendMessage,
    retry,
    getSessionId,
    resetSession,
    
    // Session info
    sessionId: sessionIdRef.current,
    userId
  };
};