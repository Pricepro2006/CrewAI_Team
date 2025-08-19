/**
 * Smart WebSocket Hook with Polling Fallback
 * Prevents infinite reconnection loops and manages connection state intelligently
 */

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createTRPCProxyClient, createWSClient, wsLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../api/trpc/router.js";
import { trpc } from "../utils/trpc.js";
import { logger } from "../../utils/logger.js";

export type ConnectionMode = 'websocket' | 'polling' | 'hybrid' | 'offline';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface SmartWebSocketOptions {
  wsUrl?: string;
  userId?: string;
  sessionId?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  fallbackEnabled?: boolean;
  fallbackThreshold?: number;
  pollingInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onMessage?: (message: Record<string, unknown>) => void;
  onModeChange?: (mode: ConnectionMode) => void;
}

interface SmartWebSocketState {
  mode: ConnectionMode;
  quality: ConnectionQuality;
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastError: Error | null;
  lastMessage: Record<string, unknown> | null;
  dataVersion: number;
}

export function useSmartWebSocket(options: SmartWebSocketOptions = {}) {
  const {
    wsUrl,
    userId = 'default',
    sessionId,
    autoConnect = true,
    maxReconnectAttempts = 5,
    reconnectInterval = 2000,
    fallbackEnabled = true,
    fallbackThreshold = 3,
    pollingInterval = 5000,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    onModeChange
  } = options;

  // State
  const [state, setState] = useState<SmartWebSocketState>({
    mode: 'offline',
    quality: 'offline',
    isConnected: false,
    isConnecting: false,
    reconnectAttempts: 0,
    lastError: null,
    lastMessage: null,
    dataVersion: 0
  });

  // Refs that don't cause re-renders
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const trpcClientRef = useRef<ReturnType<typeof createTRPCProxyClient<AppRouter>> | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const connectionAttemptsRef = useRef(0);
  const lastConnectTimeRef = useRef(0);

  // Determine WebSocket URL
  const websocketUrl = useMemo(() => {
    if (wsUrl) return wsUrl;
    
    const protocol = window?.location?.protocol === "https:" ? "wss:" : "ws:";
    const host = window?.location?.hostname;
    const port = process.env.NODE_ENV === "production" ? "" : ":3001";
    return `${protocol}//${host}${port}/trpc-ws`;
  }, [wsUrl]);

  // Polling queries (lazy initialization) - using conditional hook pattern
  // Note: This would need to be implemented in the actual tRPC router
  const pollingQuery = {
    refetch: async () => {
      // Mock implementation - replace with actual tRPC call
      return { 
        data: {
          hasChanges: Math.random() > 0.7,
          data: { message: 'Mock data update' },
          version: state.dataVersion + 1
        }
      };
    }
  };

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  /**
   * Start polling fallback
   */
  const startPolling = useCallback(async () => {
    if (pollingTimerRef.current) return;

    logger.info('Starting polling fallback', 'SMART_WS');
    
    const poll = async () => {
      if (isUnmountedRef.current) return;

      try {
        const result = await pollingQuery.refetch();
        
        if (result.data) {
          let hasChanges = false;
          
          if (result.data) {
            const response = result.data;
            if (response && typeof response === 'object' && 'hasChanges' in response) {
              if (response.hasChanges) {
                hasChanges = true;
                setState(prev => ({
                  ...prev,
                  lastMessage: response.data,
                  dataVersion: response.version || prev.dataVersion + 1
                }));
                onMessage?.(response.data);
              }
            }
          }

          if (hasChanges) {
            setState(prev => ({
              ...prev,
              quality: 'fair',
              lastError: null
            }));
          }
        }
      } catch (error) {
        logger.error('Polling error', 'SMART_WS', error as Record<string, any>);
      }
    };

    // Initial poll
    await poll();
    
    // Set up interval
    pollingTimerRef.current = setInterval(poll, pollingInterval);
    
    setState(prev => ({
      ...prev,
      mode: 'polling',
      isConnected: true,
      isConnecting: false
    }));
    
    onModeChange?.('polling');
  }, [pollingQuery, pollingInterval, onMessage, onModeChange]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket with safeguards
   */
  const connectWebSocket = useCallback(() => {
    // Prevent rapid reconnection attempts
    const now = Date.now();
    if (now - lastConnectTimeRef.current < 1000) {
      logger.warn('Preventing rapid reconnection attempt', 'SMART_WS');
      return;
    }
    lastConnectTimeRef.current = now;

    // Check if already connected or connecting
    if (wsClientRef.current || state.isConnecting) {
      logger.warn('Already connected or connecting', 'SMART_WS');
      return;
    }

    // Check max attempts
    if (connectionAttemptsRef.current >= maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', 'SMART_WS');
      
      if (fallbackEnabled) {
        startPolling();
      } else {
        setState(prev => ({
          ...prev,
          mode: 'offline',
          isConnected: false,
          isConnecting: false,
          lastError: new Error('Max reconnection attempts reached')
        }));
      }
      return;
    }

    connectionAttemptsRef.current++;
    
    setState(prev => ({
      ...prev,
      isConnecting: true,
      reconnectAttempts: connectionAttemptsRef.current
    }));

    logger.info(`Connecting to WebSocket (attempt ${connectionAttemptsRef.current}/${maxReconnectAttempts})`, 'SMART_WS');

    try {
      const wsClient = createWSClient({
        url: websocketUrl,
        onOpen: () => {
          if (isUnmountedRef.current) return;

          logger.info('WebSocket connected', 'SMART_WS');
          
          connectionAttemptsRef.current = 0;
          stopPolling();
          
          setState(prev => ({
            ...prev,
            mode: 'websocket',
            quality: 'excellent',
            isConnected: true,
            isConnecting: false,
            reconnectAttempts: 0,
            lastError: null
          }));
          
          onConnect?.();
          onModeChange?.('websocket');
        },
        onClose: (event: any) => {
          if (isUnmountedRef.current) return;

          logger.warn('WebSocket closed', 'SMART_WS', { code: event?.code });
          
          wsClientRef.current = null;
          trpcClientRef.current = null;
          
          setState(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false
          }));
          
          onDisconnect?.();

          // Determine if we should reconnect
          if (!isUnmountedRef.current && connectionAttemptsRef.current < maxReconnectAttempts) {
            // Schedule reconnection with exponential backoff
            const delay = Math.min(reconnectInterval * Math.pow(1.5, connectionAttemptsRef.current), 30000);
            
            logger.info(`Scheduling reconnection in ${delay}ms`, 'SMART_WS');
            
            reconnectTimerRef.current = setTimeout(() => {
              if (!isUnmountedRef.current) {
                connectWebSocket();
              }
            }, delay);
          } else if (fallbackEnabled && connectionAttemptsRef.current >= fallbackThreshold) {
            // Fallback to polling
            startPolling();
          }
        }
        // Note: onMessage is not supported by tRPC WebSocket client
        // Messages are handled through subscriptions
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

      trpcClientRef.current = client;
      
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to create WebSocket', 'SMART_WS', err);
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        lastError: err
      }));
      
      onError?.(err);

      // Try fallback if enabled
      if (fallbackEnabled && connectionAttemptsRef.current >= fallbackThreshold) {
        startPolling();
      }
    }
  }, [
    websocketUrl,
    maxReconnectAttempts,
    reconnectInterval,
    fallbackEnabled,
    fallbackThreshold,
    state.isConnecting,
    onConnect,
    onDisconnect,
    onError,
    onMessage,
    onModeChange,
    startPolling,
    stopPolling
  ]);

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    logger.info('Disconnecting', 'SMART_WS');
    
    cleanup();
    stopPolling();
    
    if (wsClientRef.current) {
      wsClientRef?.current?.close();
      wsClientRef.current = null;
    }
    
    trpcClientRef.current = null;
    connectionAttemptsRef.current = 0;
    
    setState(prev => ({
      ...prev,
      mode: 'offline',
      quality: 'offline',
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0
    }));
  }, [cleanup, stopPolling]);

  /**
   * Send message
   */
  const sendMessage = useCallback((message: any) => {
    if (wsClientRef.current && state.mode === 'websocket') {
      try {
        const ws = wsClientRef.current.getConnection();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(message));
          return true;
        }
      } catch (error) {
        logger.error('Error sending WebSocket message', 'SMART_WS', error as any);
      }
    }
    
    logger.warn('Cannot send message - WebSocket not connected', 'SMART_WS');
    return false;
  }, [state.mode]);

  /**
   * Force reconnect
   */
  const reconnect = useCallback(() => {
    logger.info('Force reconnecting', 'SMART_WS');
    
    disconnect();
    connectionAttemptsRef.current = 0;
    
    setTimeout(() => {
      if (!isUnmountedRef.current) {
        connectWebSocket();
      }
    }, 100);
  }, [disconnect, connectWebSocket]);

  /**
   * Switch mode manually
   */
  const switchMode = useCallback((mode: ConnectionMode) => {
    logger.info(`Switching to ${mode} mode`, 'SMART_WS');
    
    if (mode === 'websocket') {
      stopPolling();
      connectionAttemptsRef.current = 0;
      connectWebSocket();
    } else if (mode === 'polling') {
      disconnect();
      startPolling();
    } else if (mode === 'offline') {
      disconnect();
    }
  }, [connectWebSocket, disconnect, startPolling, stopPolling]);

  /**
   * Initialize connection on mount (with proper cleanup)
   */
  useEffect(() => {
    isUnmountedRef.current = false;

    if (autoConnect) {
      // Delay initial connection to prevent race conditions
      const timer = setTimeout(() => {
        if (!isUnmountedRef.current) {
          connectWebSocket();
        }
      }, 100);

      return () => {
        clearTimeout(timer);
      };
    }

    return () => {
      // No cleanup needed for non-autoconnect case
    };

    // Empty dependency array - only run on mount
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      cleanup();
      
      if (wsClientRef.current) {
        wsClientRef?.current?.close();
        wsClientRef.current = null;
      }
      
      stopPolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    ...state,
    
    // Actions
    connect: connectWebSocket,
    disconnect,
    reconnect,
    sendMessage,
    switchMode,
    
    // Clients
    trpcClient: trpcClientRef.current,
    
    // Status
    canSend: state.mode === 'websocket' && state.isConnected
  };
}