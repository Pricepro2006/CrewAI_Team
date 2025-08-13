/**
 * Connection State Manager
 * Manages the state and transitions between WebSocket and HTTP polling modes
 * Provides intelligent fallback and recovery mechanisms
 */

import { EventEmitter } from 'events';
import { PollingFallbackService, PollingConfig } from './PollingFallbackService.js';
import { logger } from '../../utils/logger.js';

export type ConnectionMode = 'websocket' | 'polling' | 'hybrid' | 'offline';
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'offline';

export interface ConnectionState {
  mode: ConnectionMode;
  quality: ConnectionQuality;
  isConnected: boolean;
  lastConnectionTime: number | null;
  lastDisconnectionTime: number | null;
  reconnectAttempts: number;
  consecutiveFailures: number;
  preferredMode: ConnectionMode;
  fallbackReason: string | null;
}

export interface ConnectionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  websocketFailures: number;
  pollingFailures: number;
  modeTransitions: number;
  averageLatency: number;
  uptime: number;
  downtime: number;
}

export interface ConnectionConfig {
  preferWebSocket: boolean;
  autoFallback: boolean;
  fallbackThreshold: number;  // Number of WS failures before fallback
  recoveryInterval: number;   // Time to wait before trying to recover WS
  hybridModeEnabled: boolean; // Use both WS and polling simultaneously
  qualityCheckInterval: number;
  maxReconnectAttempts: number;
}

export class ConnectionStateManager extends EventEmitter {
  private state: ConnectionState;
  private metrics: ConnectionMetrics;
  private config: ConnectionConfig;
  private pollingService: PollingFallbackService;
  private qualityCheckTimer: NodeJS.Timeout | null = null;
  private recoveryTimer: NodeJS.Timeout | null = null;
  private latencyMeasurements: number[] = [];
  private websocketHealthy: boolean = false;
  private pollingHealthy: boolean = false;
  private sessionStartTime: number;

  constructor(config: Partial<ConnectionConfig> = {}) {
    super();

    this.config = {
      preferWebSocket: config.preferWebSocket !== false,
      autoFallback: config.autoFallback !== false,
      fallbackThreshold: config.fallbackThreshold || 3,
      recoveryInterval: config.recoveryInterval || 30000, // 30 seconds
      hybridModeEnabled: config.hybridModeEnabled || false,
      qualityCheckInterval: config.qualityCheckInterval || 10000, // 10 seconds
      maxReconnectAttempts: config.maxReconnectAttempts || 10
    };

    this.state = {
      mode: 'offline',
      quality: 'offline',
      isConnected: false,
      lastConnectionTime: null,
      lastDisconnectionTime: null,
      reconnectAttempts: 0,
      consecutiveFailures: 0,
      preferredMode: this.config.preferWebSocket ? 'websocket' : 'polling',
      fallbackReason: null
    };

    this.metrics = {
      totalConnections: 0,
      totalDisconnections: 0,
      websocketFailures: 0,
      pollingFailures: 0,
      modeTransitions: 0,
      averageLatency: 0,
      uptime: 0,
      downtime: 0
    };

    this.pollingService = new PollingFallbackService({
      minInterval: 2000,
      maxInterval: 30000,
      adaptivePolling: true
    });

    this.sessionStartTime = Date.now();
    this.setupEventListeners();
    this.startQualityMonitoring();
  }

  /**
   * Setup internal event listeners
   */
  private setupEventListeners(): void {
    // Polling service events
    this.pollingService.on('poll:success', () => {
      this.pollingHealthy = true;
      this.updateConnectionQuality();
    });

    this.pollingService.on('poll:error', () => {
      this.metrics.pollingFailures++;
      this.pollingHealthy = false;
      this.updateConnectionQuality();
    });

    this.pollingService.on('polling:failed', () => {
      this.handlePollingFailure();
    });
  }

  /**
   * Handle WebSocket connection established
   */
  onWebSocketConnected(): void {
    logger.info('WebSocket connected', 'CONNECTION_STATE');
    
    this.websocketHealthy = true;
    this.state.consecutiveFailures = 0;
    this.state.reconnectAttempts = 0;
    this.state.lastConnectionTime = Date.now();
    this.metrics.totalConnections++;

    if (this.config.hybridModeEnabled && this.pollingService.getState().isPolling) {
      this.transitionToMode('hybrid');
    } else {
      this.transitionToMode('websocket');
      // Stop polling if we were in fallback mode
      if (this.pollingService.getState().isPolling) {
        this.pollingService.stopPolling();
      }
    }

    this.updateConnectionQuality();
    this.emit('connected', { mode: this.state.mode });
  }

  /**
   * Handle WebSocket disconnection
   */
  onWebSocketDisconnected(reason?: string): void {
    logger.warn('WebSocket disconnected', 'CONNECTION_STATE', { reason });
    
    this.websocketHealthy = false;
    this.state.lastDisconnectionTime = Date.now();
    this.state.consecutiveFailures++;
    this.metrics.totalDisconnections++;
    this.metrics.websocketFailures++;

    // Check if we should fallback to polling
    if (this.config.autoFallback && 
        this.state.consecutiveFailures >= this.config.fallbackThreshold) {
      this.initiateFallback(reason || 'WebSocket connection unstable');
    } else {
      this.state.isConnected = false;
      this.updateConnectionQuality();
      this.emit('disconnected', { 
        mode: this.state.mode, 
        willFallback: this.state.consecutiveFailures >= this.config.fallbackThreshold - 1 
      });
    }
  }

  /**
   * Handle WebSocket reconnection attempt
   */
  onWebSocketReconnecting(attempt: number): void {
    this.state.reconnectAttempts = attempt;
    
    if (attempt >= this.config.maxReconnectAttempts) {
      logger.error('Max WebSocket reconnection attempts exceeded', 'CONNECTION_STATE');
      this.initiateFallback('Max reconnection attempts exceeded');
    }

    this.emit('reconnecting', { 
      attempt, 
      maxAttempts: this.config.maxReconnectAttempts 
    });
  }

  /**
   * Initiate fallback to polling
   */
  private async initiateFallback(reason: string): Promise<void> {
    logger.info('Initiating fallback to polling', 'CONNECTION_STATE', { reason });
    
    this.state.fallbackReason = reason;
    this.metrics.modeTransitions++;

    // Start polling
    if (!this.pollingService.getState().isPolling) {
      // This endpoint should be provided by the consumer
      this.emit('fallback:needed', { reason });
    }

    this.transitionToMode('polling');
    
    // Schedule WebSocket recovery attempt
    if (this.config.preferWebSocket) {
      this.scheduleRecoveryAttempt();
    }
  }

  /**
   * Handle polling failure
   */
  private handlePollingFailure(): void {
    logger.error('Polling failed', 'CONNECTION_STATE');
    
    this.pollingHealthy = false;
    
    if (!this.websocketHealthy) {
      // Both connections failed - we're offline
      this.transitionToMode('offline');
      this.emit('offline', { 
        reason: 'Both WebSocket and polling connections failed' 
      });
    }
  }

  /**
   * Transition to a new connection mode
   */
  private transitionToMode(mode: ConnectionMode): void {
    if (this.state.mode === mode) {
      return;
    }

    const previousMode = this.state.mode;
    this.state.mode = mode;
    this.state.isConnected = mode !== 'offline';

    logger.info('Connection mode transition', 'CONNECTION_STATE', {
      from: previousMode,
      to: mode
    });

    this.emit('mode:changed', {
      previousMode,
      currentMode: mode,
      reason: this.state.fallbackReason
    });
  }

  /**
   * Schedule recovery attempt to preferred mode
   */
  private scheduleRecoveryAttempt(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }

    this.recoveryTimer = setTimeout(() => {
      if (this.state.mode === 'polling' && this.config.preferWebSocket) {
        logger.info('Attempting WebSocket recovery', 'CONNECTION_STATE');
        this.emit('recovery:attempt');
      }
    }, this.config.recoveryInterval);
  }

  /**
   * Start connection quality monitoring
   */
  private startQualityMonitoring(): void {
    this.qualityCheckTimer = setInterval(() => {
      this.updateConnectionQuality();
      this.updateMetrics();
    }, this.config.qualityCheckInterval);
  }

  /**
   * Update connection quality assessment
   */
  private updateConnectionQuality(): void {
    const avgLatency = this.getAverageLatency();
    let quality: ConnectionQuality = 'offline';

    if (!this.state.isConnected) {
      quality = 'offline';
    } else if (this.state.mode === 'websocket' || this.state.mode === 'hybrid') {
      if (avgLatency < 100 && this.state.consecutiveFailures === 0) {
        quality = 'excellent';
      } else if (avgLatency < 300 && this.state.consecutiveFailures < 2) {
        quality = 'good';
      } else if (avgLatency < 1000 && this.state.consecutiveFailures < 3) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
    } else if (this.state.mode === 'polling') {
      if (avgLatency < 500) {
        quality = 'good';
      } else if (avgLatency < 2000) {
        quality = 'fair';
      } else {
        quality = 'poor';
      }
    }

    if (this.state.quality !== quality) {
      const previousQuality = this.state.quality;
      this.state.quality = quality;
      
      this.emit('quality:changed', {
        previousQuality,
        currentQuality: quality,
        latency: avgLatency
      });
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const sessionDuration = now - this.sessionStartTime;

    if (this.state.isConnected) {
      this.metrics.uptime += this.config.qualityCheckInterval;
    } else {
      this.metrics.downtime += this.config.qualityCheckInterval;
    }

    // Calculate availability percentage
    const availability = sessionDuration > 0 
      ? (this.metrics.uptime / sessionDuration) * 100 
      : 0;

    this.emit('metrics:updated', {
      ...this.metrics,
      availability,
      sessionDuration
    });
  }

  /**
   * Add latency measurement
   */
  addLatencyMeasurement(latency: number): void {
    this.latencyMeasurements.push(latency);
    
    // Keep only last 20 measurements
    if (this.latencyMeasurements.length > 20) {
      this.latencyMeasurements.shift();
    }

    this.metrics.averageLatency = this.getAverageLatency();
  }

  /**
   * Get average latency
   */
  private getAverageLatency(): number {
    if (this.latencyMeasurements.length === 0) {
      return 0;
    }
    
    const sum = this.latencyMeasurements.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyMeasurements.length);
  }

  /**
   * Start polling with endpoint
   */
  async startPolling(endpoint: () => Promise<any>): Promise<void> {
    await this.pollingService.startPolling(endpoint);
    
    if (this.websocketHealthy && this.config.hybridModeEnabled) {
      this.transitionToMode('hybrid');
    } else {
      this.transitionToMode('polling');
    }
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    this.pollingService.stopPolling();
    
    if (this.state.mode === 'hybrid' && this.websocketHealthy) {
      this.transitionToMode('websocket');
    } else if (this.state.mode === 'polling') {
      this.transitionToMode('offline');
    }
  }

  /**
   * Force connection mode
   */
  forceMode(mode: ConnectionMode): void {
    logger.info('Forcing connection mode', 'CONNECTION_STATE', { mode });
    
    if (mode === 'websocket') {
      this.stopPolling();
      this.emit('websocket:required');
    } else if (mode === 'polling') {
      this.emit('polling:required');
    } else if (mode === 'hybrid') {
      this.config.hybridModeEnabled = true;
      this.emit('hybrid:required');
    }
    
    this.transitionToMode(mode);
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Get metrics
   */
  getMetrics(): ConnectionMetrics & { availability: number } {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const availability = sessionDuration > 0 
      ? (this.metrics.uptime / sessionDuration) * 100 
      : 0;

    return {
      ...this.metrics,
      availability
    };
  }

  /**
   * Reset connection state
   */
  reset(): void {
    this.state.consecutiveFailures = 0;
    this.state.reconnectAttempts = 0;
    this.state.fallbackReason = null;
    this.latencyMeasurements = [];
    
    logger.info('Connection state reset', 'CONNECTION_STATE');
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.qualityCheckTimer) {
      clearInterval(this.qualityCheckTimer);
      this.qualityCheckTimer = null;
    }

    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    this.pollingService.stopPolling();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const connectionStateManager = new ConnectionStateManager();