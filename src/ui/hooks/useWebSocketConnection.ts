/**
 * Enhanced WebSocket Connection Hook
 * Provides reliable WebSocket connectivity with automatic reconnection
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketUrl, getReconnectionDelay, getWebSocketDebugInfo } from '../../config/websocket.config.js';

// WebSocket Event Types for real-time updates
export enum WebSocketEventType {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // Agent events (5 new message types mentioned in requirements)
  AGENT_STATUS = 'agent.status',
  AGENT_TASK = 'agent.task',
  PLAN_UPDATE = 'plan.update',
  RAG_OPERATION = 'rag.operation',
  SYSTEM_HEALTH = 'system.health',
  
  // Additional events
  EMAIL_UPDATE = 'email.update',
  WORKFLOW_UPDATE = 'workflow.update'
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
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
    url = getWebSocketUrl(), // Use dynamic URL from config
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
    
    // Enable heartbeat for connection monitoring
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          const pingMessage = JSON.stringify({
            type: 'ping',
            data: { timestamp: Date.now() },
            timestamp: new Date().toISOString()
          });
          wsRef.current.send(pingMessage);
        } catch (error) {
          console.warn('❌ Failed to send heartbeat ping:', error);
        }
      }
    }, 30000); // 30 second heartbeat
  }, [clearHeartbeat]); // Remove sendMessage dependency to avoid circular reference

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    setState(prev => {
      // Prevent multiple concurrent connection attempts
      if (prev.connecting) {
        console.log('⏳ Connection already in progress, skipping...');
        return prev;
      }
      return { ...prev, connecting: true, error: null };
    });

    try {
      console.log('🔌 Connecting to native WebSocket:', url);
      console.log('📊 WebSocket Debug Info:', getWebSocketDebugInfo());
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CONNECTING) {
          wsRef.current?.close();
          setState(prev => ({
            ...prev,
            error: 'Connection timeout',
            connecting: false
          }));
        }
      }, 10000); // 10 second timeout
      
      wsRef.current = new WebSocket(url, protocols);

      wsRef.current.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ Native WebSocket connected to:', url);
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

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          // Handle both JSON and plain text messages
          let message: WebSocketMessage;
          
          if (typeof event.data === 'string') {
            try {
              message = JSON.parse(event.data);
            } catch {
              // Handle plain text messages
              message = {
                type: 'text',
                data: event.data,
                timestamp: new Date().toISOString()
              };
            }
          } else {
            message = {
              type: 'binary',
              data: event.data,
              timestamp: new Date().toISOString()
            };
          }
          
          console.log('📨 Received WebSocket message:', message.type, message);
          setState(prev => ({ ...prev, lastMessage: message }));
          onMessage?.(message);
        } catch (error) {
          console.warn('⚠️ Error processing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event: CloseEvent) => {
        clearTimeout(connectionTimeout);
        console.log('🔚 Native WebSocket disconnected:', event.code, event.reason);
        setState(prev => ({ ...prev, connected: false, connecting: false }));
        
        clearHeartbeat();
        onDisconnect?.();

        // Auto-reconnect if enabled and not a normal closure
        setState(prev => {
          if (autoReconnect && event.code !== 1000 && prev.reconnectAttempts < maxReconnectAttempts) {
            const delay = getReconnectionDelay(prev.reconnectAttempts + 1);
            console.log(`🔄 Reconnecting in ${delay}ms (attempt ${prev.reconnectAttempts + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
            
            return { ...prev, reconnectAttempts: prev.reconnectAttempts + 1 };
          } else if (prev.reconnectAttempts >= maxReconnectAttempts) {
            console.error('❌ Max reconnection attempts reached');
            return { ...prev, error: 'Max reconnection attempts reached' };
          }
          return prev;
        });
      };

      wsRef.current.onerror = (error: Event) => {
        clearTimeout(connectionTimeout);
        console.error('❌ Native WebSocket error:', error);
        setState(prev => ({ 
          ...prev, 
          error: 'Connection failed',
          connecting: false 
        }));
        onError?.(error);
      };

    } catch (error) {
      console.error('❌ Failed to create native WebSocket:', error);
      setState(prev => ({ 
        ...prev, 
        error: (error as Error).message,
        connecting: false 
      }));
    }
  }, [url, protocols, autoReconnect, maxReconnectAttempts, onMessage, onConnect, onDisconnect, onError, startHeartbeat, clearReconnectTimeout, clearHeartbeat]);

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
      try {
        const fullMessage: WebSocketMessage = {
          type: message.type || 'message',
          data: message.data || {},
          timestamp: message.timestamp || new Date().toISOString(),
          ...message
        };
        
        const messageStr = JSON.stringify(fullMessage);
        wsRef.current.send(messageStr);
        console.log('📤 Sent WebSocket message:', fullMessage.type);
        return true;
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        return false;
      }
    } else {
      const readyState = wsRef.current?.readyState;
      const stateNames = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
      console.warn(`❌ Cannot send message - WebSocket state: ${stateNames[readyState || 3]}`);
      return false;
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    setState(prev => ({ ...prev, reconnectAttempts: 0 }));
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Auto-connect on mount with cleanup
  useEffect(() => {
    let mounted = true;
    
    const connectIfMounted = async () => {
      if (mounted) {
        await connect();
      }
    };
    
    connectIfMounted();
    
    return () => {
      mounted = false;
      disconnect();
    };
  }, [url, protocols]); // Re-connect if URL or protocols change

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