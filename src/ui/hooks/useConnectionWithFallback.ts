/**
 * React Hook for Connection with Automatic Polling Fallback
 * Seamlessly switches between WebSocket and HTTP polling based on connection quality
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWalmartWebSocket } from './useWalmartWebSocket.js';
import { trpc } from '../utils/trpc.js';
import { logger } from '../../utils/logger.js';

export type ConnectionMode = 'websocket' | 'polling' | 'hybrid' | 'offline';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface ConnectionOptions {
  userId?: string;
  sessionId?: string;
  preferWebSocket?: boolean;
  autoFallback?: boolean;
  fallbackThreshold?: number;
  pollingInterval?: number;
  hybridMode?: boolean;
  maxReconnectAttempts?: number;
  onModeChange?: (mode: ConnectionMode) => void;
  onQualityChange?: (quality: ConnectionQuality) => void;
  onDataUpdate?: (data: unknown) => void;
}

export interface ConnectionState {
  mode: ConnectionMode;
  quality: ConnectionQuality;
  isConnected: boolean;
  isTransitioning: boolean;
  lastUpdate: number | null;
  dataVersion: number;
  metrics: {
    latency: number;
    uptime: number;
    dataUpdates: number;
    modeChanges: number;
  };
}

export function useConnectionWithFallback(options: ConnectionOptions = {}) {
  const {
    userId = 'user123',
    sessionId,
    preferWebSocket = true,
    autoFallback = true,
    fallbackThreshold = 3,
    pollingInterval = 5000,
    hybridMode = false,
    maxReconnectAttempts = 10,
    onModeChange,
    onQualityChange,
    onDataUpdate
  } = options;

  // Connection state
  const [state, setState] = useState<ConnectionState>({
    mode: 'offline',
    quality: 'offline',
    isConnected: false,
    isTransitioning: false,
    lastUpdate: null,
    dataVersion: 0,
    metrics: {
      latency: 0,
      uptime: 0,
      dataUpdates: 0,
      modeChanges: 0
    }
  });

  // Refs for managing timers and state
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const metricsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const lastDataRef = useRef<unknown>(null);
  const latencyMeasurementsRef = useRef<number[]>([]);
  const websocketFailuresRef = useRef<number>(0);
  const isPollingActiveRef = useRef<boolean>(false);

  // WebSocket hook
  const websocket = useWalmartWebSocket({
    userId,
    autoConnect: preferWebSocket,
    maxReconnectAttempts
  });

  // tRPC polling queries
  const pollWalmart = trpc?.polling?.pollWalmartData.useQuery(
    { 
      userId, 
      sessionId: sessionId || websocket.sessionId,
      lastVersion: state.dataVersion 
    },
    {
      enabled: false, // Manual control
      refetchInterval: false
    }
  );

  const pollEmails = trpc?.polling?.pollEmailData.useQuery(
    { userId, lastVersion: state.dataVersion },
    {
      enabled: false,
      refetchInterval: false
    }
  );

  const batchPoll = trpc?.polling?.batchPoll.useQuery(
    {
      requests: [
        { key: `walmart:${userId}`, lastVersion: state.dataVersion },
        { key: `email:${userId}`, lastVersion: state.dataVersion }
      ]
    },
    {
      enabled: false,
      refetchInterval: false
    }
  );

  /**
   * Update connection metrics
   */
  const updateMetrics = useCallback((latency?: number) => {
    if (latency !== undefined) {
      latencyMeasurementsRef?.current?.push(latency);
      if (latencyMeasurementsRef?.current?.length > 10) {
        latencyMeasurementsRef?.current?.shift();
      }
    }

    const avgLatency = latencyMeasurementsRef?.current?.length > 0
      ? Math.round(latencyMeasurementsRef?.current?.reduce((a: unknown, b: unknown) => a + b, 0) / latencyMeasurementsRef?.current?.length)
      : 0;

    const uptime = Date.now() - sessionStartRef.current;

    setState(prev => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        latency: avgLatency,
        uptime
      }
    }));
  }, []);

  /**
   * Assess connection quality based on metrics
   */
  const assessQuality = useCallback((): ConnectionQuality => {
    // Use current state directly to avoid stale closures
    return ((currentState: ConnectionState): ConnectionQuality => {
      const { latency } = currentState.metrics;
      const { mode, isConnected } = currentState;

      if (!isConnected) return 'offline';

      if (mode === 'websocket' || mode === 'hybrid') {
        if (latency < 100 && websocketFailuresRef.current === 0) return 'excellent';
        if (latency < 300 && websocketFailuresRef.current < 2) return 'good';
        if (latency < 1000 && websocketFailuresRef.current < 3) return 'fair';
        return 'poor';
      } else if (mode === 'polling') {
        if (latency < 500) return 'good';
        if (latency < 2000) return 'fair';
        return 'poor';
      }

      return 'offline';
    })(state);
  }, [state.metrics.latency, state.mode, state.isConnected]);

  /**
   * Handle mode transition
   */
  const transitionToMode = useCallback((newMode: ConnectionMode, reason?: string) => {
    setState(prev => {
      if (prev.mode === newMode) return prev;

      logger.info('Connection mode transition', 'CONNECTION', {
        from: prev.mode,
        to: newMode,
        reason
      });

      onModeChange?.(newMode);

      return {
        ...prev,
        mode: newMode,
        isTransitioning: true,
        metrics: {
          ...prev.metrics,
          modeChanges: prev?.metrics?.modeChanges + 1
        }
      };
    });

    // Complete transition after a short delay
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        isTransitioning: false,
        isConnected: newMode !== 'offline'
      }));
    }, 100);
  }, [onModeChange]); // Removed state.mode to prevent stale closures

  /**
   * Start polling
   */
  const startPolling = useCallback(async () => {
    if (isPollingActiveRef.current) return;

    logger.info('Starting polling fallback', 'CONNECTION');
    isPollingActiveRef.current = true;

    const poll = async () => {
      if (!isPollingActiveRef.current) return;

      const startTime = Date.now();

      try {
        // Use batch polling for efficiency
        const result = await batchPoll.refetch();
        
        if (result.data) {
          const latency = Date.now() - startTime;
          updateMetrics(latency);

          // Check for data updates
          let hasUpdates = false;
          for (const [key, response] of Object.entries(result?.data?.responses)) {
            if (response.hasChanges && response.data) {
              hasUpdates = true;
              lastDataRef.current = response.data;
              
              setState(prev => ({
                ...prev,
                lastUpdate: Date.now(),
                dataVersion: response.version
              }));

              onDataUpdate?.(response.data);
            }
          }

          if (hasUpdates) {
            setState(prev => ({
              ...prev,
              metrics: {
                ...prev.metrics,
                dataUpdates: prev?.metrics?.dataUpdates + 1
              }
            }));
          }

          // Adjust polling interval based on activity
          const nextInterval = hasUpdates ? 2000 : pollingInterval;
          pollingTimerRef.current = setTimeout(poll, nextInterval);
        }
      } catch (error) {
        logger.error('Polling error', 'CONNECTION', error as unknown);
        
        // Retry with backoff
        pollingTimerRef.current = setTimeout(poll, Math.min(pollingInterval * 2, 30000));
      }
    };

    // Start polling
    poll();
  }, [pollingInterval, batchPoll, updateMetrics, onDataUpdate]);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (!isPollingActiveRef.current) return;

    logger.info('Stopping polling', 'CONNECTION');
    isPollingActiveRef.current = false;

    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  /**
   * Handle WebSocket connection events
   */
  useEffect(() => {
    if (websocket.isConnected) {
      websocketFailuresRef.current = 0;
      
      if (hybridMode && !isPollingActiveRef.current) {
        startPolling();
        transitionToMode('hybrid', 'WebSocket connected with hybrid mode');
      } else {
        stopPolling();
        transitionToMode('websocket', 'WebSocket connected');
      }
    } else if (websocket.isFailed) {
      websocketFailuresRef.current++;
      
      if (autoFallback && websocketFailuresRef.current >= fallbackThreshold) {
        if (!isPollingActiveRef.current) {
          startPolling();
        }
        transitionToMode('polling', 'WebSocket failed, falling back to polling');
      }
    } else if (!websocket.isConnected && !websocket.isConnecting) {
      // WebSocket disconnected
      if (autoFallback && !isPollingActiveRef.current) {
        startPolling();
        transitionToMode('polling', 'WebSocket disconnected, using polling');
      } else if (!isPollingActiveRef.current) {
        transitionToMode('offline', 'No active connections');
      }
    }
  }, [
    websocket.isConnected,
    websocket.isFailed,
    websocket.isConnecting,
    hybridMode,
    autoFallback,
    fallbackThreshold,
    startPolling,
    stopPolling,
    transitionToMode
  ]);

  /**
   * Handle WebSocket messages
   */
  useEffect(() => {
    if (websocket.lastMessage) {
      const latency = Date.now() - Number(websocket?.lastMessage?.timestamp || Date.now());
      updateMetrics(latency);

      lastDataRef.current = websocket?.lastMessage?.data;
      
      setState(prev => ({
        ...prev,
        lastUpdate: Date.now(),
        dataVersion: prev.dataVersion + 1,
        metrics: {
          ...prev.metrics,
          dataUpdates: prev?.metrics?.dataUpdates + 1
        }
      }));

      onDataUpdate?.(websocket?.lastMessage?.data);
    }
  }, [websocket.lastMessage, updateMetrics, onDataUpdate]);

  /**
   * Monitor connection quality
   */
  useEffect(() => {
    metricsTimerRef.current = setInterval(() => {
      setState(prev => {
        const quality = assessQuality();
        
        if (quality !== prev.quality) {
          onQualityChange?.(quality);
          return { ...prev, quality };
        }
        return prev;
      });
    }, 5000);

    return () => {
      if (metricsTimerRef.current) {
        clearInterval(metricsTimerRef.current);
        metricsTimerRef.current = null;
      }
    };
  }, [assessQuality, onQualityChange]); // Removed state.quality to prevent stale closures

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
      if (metricsTimerRef.current) {
        clearInterval(metricsTimerRef.current);
      }
    };
  }, [stopPolling]);

  /**
   * Force mode change
   */
  const forceMode = useCallback((mode: ConnectionMode) => {
    logger.info('Forcing connection mode', 'CONNECTION', { mode });

    if (mode === 'websocket') {
      stopPolling();
      if (!websocket.isConnected) {
        websocket.connect();
      }
    } else if (mode === 'polling') {
      websocket.disconnect();
      if (!isPollingActiveRef.current) {
        startPolling();
      }
    } else if (mode === 'hybrid') {
      if (!websocket.isConnected) {
        websocket.connect();
      }
      if (!isPollingActiveRef.current) {
        startPolling();
      }
    } else if (mode === 'offline') {
      websocket.disconnect();
      stopPolling();
    }

    transitionToMode(mode, 'Manual mode change');
  }, [websocket, startPolling, stopPolling, transitionToMode]);

  /**
   * Send message (WebSocket only)
   */
  const sendMessage = useCallback((message: unknown) => {
    if (state.mode === 'websocket' || state.mode === 'hybrid') {
      return websocket.sendMessage(message);
    } else {
      logger.warn('Cannot send message in polling mode', 'CONNECTION');
      return false;
    }
  }, [state.mode, websocket]);

  /**
   * Force data refresh
   */
  const refresh = useCallback(async () => {
    if (state.mode === 'polling' || state.mode === 'hybrid') {
      await batchPoll.refetch();
    }
    
    if (state.mode === 'websocket' || state.mode === 'hybrid') {
      // WebSocket doesn't need explicit refresh
      logger.info('WebSocket data is real-time', 'CONNECTION');
    }
  }, [state.mode, batchPoll]);

  return {
    // Connection state
    mode: state.mode,
    quality: state.quality,
    isConnected: state.isConnected,
    isTransitioning: state.isTransitioning,
    
    // Data state
    lastUpdate: state.lastUpdate,
    dataVersion: state.dataVersion,
    lastData: lastDataRef.current,
    
    // Metrics
    metrics: state.metrics,
    
    // WebSocket specific
    websocket: {
      isConnected: websocket.isConnected,
      isConnecting: websocket.isConnecting,
      sessionId: websocket.sessionId,
      nlpProcessing: websocket.nlpProcessing,
      nlpResult: websocket.nlpResult,
      productMatches: websocket.productMatches
    },
    
    // Actions
    forceMode,
    sendMessage,
    refresh,
    connect: websocket.connect,
    disconnect: () => {
      websocket.disconnect();
      stopPolling();
      transitionToMode('offline', 'Manual disconnect');
    }
  };
}