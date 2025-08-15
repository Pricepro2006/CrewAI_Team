/**
 * Polling Fallback Service
 * Provides HTTP polling as a fallback when WebSocket connections fail
 * Implements adaptive polling intervals based on activity and system load
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export interface PollingConfig {
  minInterval: number;      // Minimum polling interval in ms
  maxInterval: number;      // Maximum polling interval in ms
  backoffMultiplier: number; // Multiplier for exponential backoff
  maxRetries: number;       // Max consecutive failures before stopping
  adaptivePolling: boolean; // Enable adaptive interval adjustment
  jitter: boolean;          // Add randomization to prevent thundering herd
}

export interface PollingState {
  isPolling: boolean;
  interval: number;
  consecutiveErrors: number;
  lastPollTime: number | null;
  lastSuccessTime: number | null;
  mode: 'active' | 'idle' | 'error' | 'stopped';
  dataVersion: number;
}

export interface PollingMetrics {
  totalPolls: number;
  successfulPolls: number;
  failedPolls: number;
  averageResponseTime: number;
  dataChanges: number;
  lastError: Error | null;
}

export type PollingEndpoint<T = any> = () => Promise<T>;
export type DataComparator<T = any> = (prev: T | null, current: T) => boolean;

export class PollingFallbackService extends EventEmitter {
  private config: PollingConfig;
  private state: PollingState;
  private metrics: PollingMetrics;
  private pollingTimer: NodeJS.Timeout | null = null;
  private endpoint: PollingEndpoint | null = null;
  private lastData: any = null;
  private dataComparator: DataComparator;
  private abortController: AbortController | null = null;
  private responseTimes: number[] = [];

  constructor(config: Partial<PollingConfig> = {}) {
    super();
    
    this.config = {
      minInterval: config.minInterval || 1000,        // 1 second
      maxInterval: config.maxInterval || 30000,       // 30 seconds
      backoffMultiplier: config.backoffMultiplier || 1.5,
      maxRetries: config.maxRetries || 5,
      adaptivePolling: config.adaptivePolling !== false,
      jitter: config.jitter !== false
    };

    this.state = {
      isPolling: false,
      interval: this?.config?.minInterval,
      consecutiveErrors: 0,
      lastPollTime: null,
      lastSuccessTime: null,
      mode: 'stopped',
      dataVersion: 0
    };

    this.metrics = {
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      averageResponseTime: 0,
      dataChanges: 0,
      lastError: null
    };

    // Default comparator checks for deep equality
    this.dataComparator = (prev, current) => {
      return JSON.stringify(prev) !== JSON.stringify(current);
    };
  }

  /**
   * Start polling with specified endpoint
   */
  async startPolling<T>(
    endpoint: PollingEndpoint<T>,
    comparator?: DataComparator<T>
  ): Promise<void> {
    if (this?.state?.isPolling) {
      logger.warn('Polling already active', 'POLLING');
      return;
    }

    this.endpoint = endpoint;
    if (comparator) {
      this.dataComparator = comparator;
    }

    this.state = {
      ...this.state,
      isPolling: true,
      mode: 'active',
      consecutiveErrors: 0,
      interval: this?.config?.minInterval
    };

    logger.info('Starting polling fallback', 'POLLING', {
      interval: this?.state?.interval,
      config: this.config
    });

    this.emit('polling:started', { interval: this?.state?.interval });
    
    // Initial poll
    await this.poll();
    
    // Schedule next poll
    this.scheduleNextPoll();
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (!this?.state?.isPolling) {
      return;
    }

    logger.info('Stopping polling', 'POLLING');

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (this.abortController) {
      this?.abortController?.abort();
      this.abortController = null;
    }

    this.state = {
      ...this.state,
      isPolling: false,
      mode: 'stopped'
    };

    this.emit('polling:stopped', { metrics: this.getMetrics() });
  }

  /**
   * Perform a single poll
   */
  private async poll(): Promise<void> {
    if (!this.endpoint || !this?.state?.isPolling) {
      return;
    }

    const startTime = Date.now();
    this?.state?.lastPollTime = startTime;
    this?.metrics?.totalPolls++;

    try {
      // Create abort controller for timeout
      this.abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        this.abortController?.abort();
      }, 10000); // 10 second timeout

      // Execute endpoint
      const data = await this.endpoint();
      
      clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);
      
      // Check if data changed
      const hasChanged = this.dataComparator(this.lastData, data);
      
      if (hasChanged) {
        this.lastData = data;
        this?.state?.dataVersion++;
        this?.metrics?.dataChanges++;
        
        this.emit('data:changed', {
          data,
          version: this?.state?.dataVersion,
          responseTime
        });
        
        logger.debug('Polling data changed', 'POLLING', {
          version: this?.state?.dataVersion,
          responseTime
        });
      } else {
        this.emit('data:unchanged', { responseTime });
      }

      // Update success metrics
      this?.state?.consecutiveErrors = 0;
      this?.state?.lastSuccessTime = Date.now();
      this?.state?.mode = 'active';
      this?.metrics?.successfulPolls++;
      this?.metrics?.lastError = null;

      // Adjust interval based on activity
      if (this?.config?.adaptivePolling) {
        this.adjustPollingInterval(hasChanged);
      }

      this.emit('poll:success', {
        data,
        changed: hasChanged,
        responseTime,
        interval: this?.state?.interval
      });

    } catch (error) {
      const err = error as Error;
      this.handlePollError(err);
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Handle polling error
   */
  private handlePollError(error: Error): void {
    this?.state?.consecutiveErrors++;
    this?.metrics?.failedPolls++;
    this?.metrics?.lastError = error;

    logger.error('Polling error', 'POLLING', {
      error: error.message,
      consecutiveErrors: this?.state?.consecutiveErrors
    });

    this.emit('poll:error', {
      error,
      consecutiveErrors: this?.state?.consecutiveErrors,
      willRetry: this?.state?.consecutiveErrors < this?.config?.maxRetries
    });

    // Check if we should stop polling
    if (this?.state?.consecutiveErrors >= this?.config?.maxRetries) {
      logger.error('Max polling retries exceeded, stopping', 'POLLING');
      this?.state?.mode = 'error';
      this.stopPolling();
      this.emit('polling:failed', {
        error,
        retries: this?.state?.consecutiveErrors
      });
    } else {
      // Increase interval on error (backoff)
      this?.state?.interval = Math.min(
        this?.state?.interval * this?.config?.backoffMultiplier,
        this?.config?.maxInterval
      );
      this?.state?.mode = 'error';
    }
  }

  /**
   * Schedule next poll
   */
  private scheduleNextPoll(): void {
    if (!this?.state?.isPolling) {
      return;
    }

    let interval = this?.state?.interval;

    // Add jitter if enabled
    if (this?.config?.jitter) {
      const jitter = interval * 0.1 * (Math.random() * 2 - 1); // ±10%
      interval = Math.max(this?.config?.minInterval, interval + jitter);
    }

    this.pollingTimer = setTimeout(async () => {
      await this.poll();
      this.scheduleNextPoll();
    }, interval);

    logger.debug('Next poll scheduled', 'POLLING', {
      interval,
      mode: this?.state?.mode
    });
  }

  /**
   * Adjust polling interval based on activity
   */
  private adjustPollingInterval(dataChanged: boolean): void {
    const currentInterval = this?.state?.interval;
    let newInterval = currentInterval;

    if (dataChanged) {
      // Data changed, decrease interval (poll more frequently)
      newInterval = Math.max(
        this?.config?.minInterval,
        currentInterval / this?.config?.backoffMultiplier
      );
      this?.state?.mode = 'active';
    } else {
      // No changes, increase interval (poll less frequently)
      const timeSinceLastChange = this?.state?.lastSuccessTime 
        ? Date.now() - this?.state?.lastSuccessTime 
        : 0;

      if (timeSinceLastChange > 60000) { // 1 minute of no changes
        newInterval = Math.min(
          this?.config?.maxInterval,
          currentInterval * this?.config?.backoffMultiplier
        );
        this?.state?.mode = 'idle';
      }
    }

    // Consider response time in interval adjustment
    const avgResponseTime = this.getAverageResponseTime();
    if (avgResponseTime > currentInterval * 0.5) {
      // If response time is more than 50% of interval, increase interval
      newInterval = Math.min(
        this?.config?.maxInterval,
        Math.max(newInterval, avgResponseTime * 3)
      );
    }

    if (newInterval !== currentInterval) {
      this?.state?.interval = Math.round(newInterval);
      logger.debug('Polling interval adjusted', 'POLLING', {
        from: currentInterval,
        to: this?.state?.interval,
        reason: dataChanged ? 'data_changed' : 'idle'
      });

      this.emit('interval:adjusted', {
        oldInterval: currentInterval,
        newInterval: this?.state?.interval
      });
    }
  }

  /**
   * Update response time tracking
   */
  private updateResponseTime(responseTime: number): void {
    this?.responseTimes?.push(responseTime);
    
    // Keep only last 10 response times
    if (this?.responseTimes?.length > 10) {
      this?.responseTimes?.shift();
    }

    // Update average
    this?.metrics?.averageResponseTime = this.getAverageResponseTime();
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    if (this?.responseTimes?.length === 0) {
      return 0;
    }
    
    const sum = this?.responseTimes?.reduce((a: any, b: any) => a + b, 0);
    return Math.round(sum / this?.responseTimes?.length);
  }

  /**
   * Force immediate poll
   */
  async forcePoll(): Promise<void> {
    if (!this?.state?.isPolling) {
      logger.warn('Cannot force poll - polling not active', 'POLLING');
      return;
    }

    logger.info('Forcing immediate poll', 'POLLING');
    
    // Cancel current timer
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Poll immediately
    await this.poll();
    
    // Reschedule
    this.scheduleNextPoll();
  }

  /**
   * Update polling configuration
   */
  updateConfig(config: Partial<PollingConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };

    logger.info('Polling config updated', 'POLLING', this.config);
    this.emit('config:updated', this.config);

    // If actively polling, apply new interval bounds
    if (this?.state?.isPolling) {
      this?.state?.interval = Math.max(
        this?.config?.minInterval,
        Math.min(this?.config?.maxInterval, this?.state?.interval)
      );
    }
  }

  /**
   * Get current state
   */
  getState(): PollingState {
    return { ...this.state };
  }

  /**
   * Get metrics
   */
  getMetrics(): PollingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current configuration
   */
  getConfig(): PollingConfig {
    return { ...this.config };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      averageResponseTime: 0,
      dataChanges: 0,
      lastError: null
    };
    this.responseTimes = [];
  }

  /**
   * Check if polling is healthy
   */
  isHealthy(): boolean {
    return this?.state?.isPolling && 
           this?.state?.mode !== 'error' &&
           this?.state?.consecutiveErrors < this?.config?.maxRetries;
  }
}

// Singleton instance for global polling
export const pollingFallbackService = new PollingFallbackService();