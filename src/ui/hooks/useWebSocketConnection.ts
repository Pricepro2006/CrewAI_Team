/**
 * Enhanced WebSocket Connection Hook
 * Provides reliable WebSocket connectivity with automatic reconnection
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { websocketConfig, getReconnectionDelay, WebSocketEventType } from '../../shared/config/websocket.config.js';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  sessionId?: string;
  userId?: string;
}

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  connectionCount: number;
  reconnectAttempts: number;
}

export interface UseWebSocketOptions {
  url?: string;
  protocols?: string[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export const useWebSocketConnection = (options: UseWebSocketOptions = {}) => {
  const {
    url = 'ws://localhost:8080/ws/walmart',
    protocols = [],
    autoReconnect = true,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options;

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
    connectionCount: 0,
    reconnectAttempts: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    
    if (websocketConfig?.heartbeat?.enabled) {
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendMessage({
            type: 'ping',
            data: { timestamp: Date.now() },
            timestamp: new Date().toISOString()
          });
        }
      }, websocketConfig?.heartbeat?.interval);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setState(prev => ({ ...prev, connecting: true, error: null }));

    try {
      wsRef.current = new WebSocket(url, protocols);

      wsRef?.current?.onopen = () => {
        console.log('✅ WebSocket connected to:', url);
        setState(prev => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          connectionCount: prev.connectionCount + 1,
          reconnectAttempts: 0
        }));
        
        clearReconnectTimeout();
        startHeartbeat();
        onConnect?.();
      };

      wsRef?.current?.onmessage = (event: any) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setState(prev => ({ ...prev, lastMessage: message }));
          onMessage?.(message);
        } catch (error) {
          console.warn('Invalid WebSocket message:', event.data);
        }
      };

      wsRef?.current?.onclose = (event: any) => {
        console.log('🔚 WebSocket disconnected:', event.code, event.reason);
        setState(prev => ({ ...prev, connected: false, connecting: false }));
        
        clearHeartbeat();
        onDisconnect?.();

        // Auto-reconnect if enabled and not a normal closure
        if (autoReconnect && event.code !== 1000 && state.reconnectAttempts < maxReconnectAttempts) {
          const delay = getReconnectionDelay(state.reconnectAttempts + 1);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          setState(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef?.current?.onerror = (error: any) => {
        console.error('❌ WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed',
          connecting: false 
        }));
        onError?.(error);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setState(prev => ({ 
        ...prev, 
        error: (error as Error).message,
        connecting: false 
      }));
    }
  }, [url, protocols, autoReconnect, maxReconnectAttempts, onMessage, onConnect, onDisconnect, onError, state.reconnectAttempts, startHeartbeat]);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    clearHeartbeat();
    
    if (wsRef.current) {
      wsRef?.current?.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setState(prev => ({ 
      ...prev, 
      connected: false, 
      connecting: false,
      reconnectAttempts: 0 
    }));
  }, [clearReconnectTimeout, clearHeartbeat]);

  const sendMessage = useCallback((message: Partial<WebSocketMessage>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fullMessage: WebSocketMessage = {
        type: message.type || 'message',
        data: message.data || {},
        timestamp: message.timestamp || new Date().toISOString(),
        ...message
      };
      
      wsRef?.current?.send(JSON.stringify(fullMessage));
      return true;
    } else {
      console.warn('❌ Cannot send message - WebSocket not connected');
      return false;
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      clearHeartbeat();
    };
  }, [clearReconnectTimeout, clearHeartbeat]);

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    isConnected: state.connected,
    isConnecting: state.connecting
  };
};