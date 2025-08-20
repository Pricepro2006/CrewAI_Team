/**
 * ChromaDB Connection Manager with exponential backoff and circuit breaker
 * Provides resilient connection management with automatic fallback
 */

import { ChromaClient, Collection } from "chromadb";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

export interface ConnectionConfig {
  host?: string;
  port?: number;
  ssl?: boolean;
  headers?: Record<string, string>;
  tenant?: string;
  database?: string;
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  retryBackoffFactor?: number;
  healthCheckInterval?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerResetTimeout?: number;
}

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  FAILED = "failed",
  CIRCUIT_OPEN = "circuit_open",
}

export interface ConnectionMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  currentState: ConnectionState;
  lastConnectionTime?: Date;
  lastFailureTime?: Date;
  lastError?: string;
  averageResponseTime: number;
  uptimePercentage: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime?: Date;
  state: "closed" | "open" | "half-open";
  nextRetryTime?: Date;
}

export class ChromaDBConnectionManager extends EventEmitter {
  private client?: ChromaClient;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private config: Required<ConnectionConfig>;
  private retryCount: number = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private connectionTimer?: NodeJS.Timeout;
  private circuitBreaker: CircuitBreakerState;
  private metrics: ConnectionMetrics;
  private connectionStartTime?: Date;
  private totalUptime: number = 0;
  private lastHealthCheckTime?: Date;

  constructor(config: ConnectionConfig = {}) {
    super();
    
    this.config = {
      host: config.host || "localhost",
      port: config.port || 8000,
      ssl: config.ssl || false,
      headers: config.headers || {},
      tenant: config.tenant || "default_tenant",
      database: config.database || "default_database",
      maxRetries: config.maxRetries || 5,
      initialRetryDelay: config.initialRetryDelay || 1000, // 1 second
      maxRetryDelay: config.maxRetryDelay || 30000, // 30 seconds
      retryBackoffFactor: config.retryBackoffFactor || 2,
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerResetTimeout: config.circuitBreakerResetTimeout || 60000, // 1 minute
    };

    this.circuitBreaker = {
      failures: 0,
      state: "closed",
    };

    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      currentState: ConnectionState.DISCONNECTED,
      averageResponseTime: 0,
      uptimePercentage: 100,
    };
  }

  /**
   * Initialize connection with retry logic
   */
  async connect(): Promise<boolean> {
    if (this.state === ConnectionState.CONNECTED) {
      return true;
    }

    if (this.state === ConnectionState.CONNECTING) {
      // Wait for ongoing connection attempt
      return this.waitForConnection();
    }

    // Check circuit breaker
    if (this?.circuitBreaker?.state === "open") {
      const now = new Date();
      if (this?.circuitBreaker?.nextRetryTime && now < this?.circuitBreaker?.nextRetryTime) {
        logger.warn(
          `Circuit breaker is open. Next retry at ${this?.circuitBreaker?.nextRetryTime.toISOString()}`,
          "CHROMADB_CONNECTION"
        );
        this.state = ConnectionState.CIRCUIT_OPEN;
        return false;
      }
      // Move to half-open state
      if (this.circuitBreaker) {

        this.circuitBreaker.state = "half-open";

      }
    }

    this.state = ConnectionState.CONNECTING;
    this.connectionStartTime = new Date();
    this.retryCount = 0;

    try {
      const connected = await this.connectWithRetry();
      
      if (connected) {
        this.onConnectionSuccess();
        return true;
      } else {
        this.onConnectionFailure("Max retries exceeded");
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.onConnectionFailure(errorMessage);
      return false;
    }
  }

  /**
   * Connect with exponential backoff retry
   */
  private async connectWithRetry(): Promise<boolean> {
    while (this.retryCount < this?.config?.maxRetries) {
      try {
        if (this.metrics.connectionAttempts) { this.metrics.connectionAttempts++ };
        
        const client = await this.createClient();
        
        // Test connection
        const startTime = Date.now();
        await client.version();
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        this.updateResponseTime(responseTime);
        
        // Success!
        this.client = client;
        return true;
      } catch (error) {
        this.retryCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.warn(
          `ChromaDB connection attempt ${this.retryCount}/${this?.config?.maxRetries} failed: ${errorMessage}`,
          "CHROMADB_CONNECTION"
        );

        if (this.retryCount >= this?.config?.maxRetries) {
          return false;
        }

        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay();
        
        logger.info(
          `Retrying ChromaDB connection in ${delay}ms (attempt ${this.retryCount + 1}/${this?.config?.maxRetries})`,
          "CHROMADB_CONNECTION"
        );

        await this.sleep(delay);
      }
    }

    return false;
  }

  /**
   * Create ChromaDB client instance
   */
  private async createClient(): Promise<ChromaClient> {
    const path = `${this?.config?.ssl ? "https" : "http"}://${this?.config?.host}:${this?.config?.port}`;
    
    return new ChromaClient({
      path,
      tenant: this?.config?.tenant,
      database: this?.config?.database,
      ...(this?.config?.headers && { headers: this?.config?.headers }),
    });
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(): number {
    const baseDelay = this?.config?.initialRetryDelay;
    const factor = Math.pow(this?.config?.retryBackoffFactor, this.retryCount - 1);
    const delay = Math.min(baseDelay * factor, this?.config?.maxRetryDelay);
    
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5) * 2;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Handle successful connection
   */
  private onConnectionSuccess(): void {
    this.state = ConnectionState.CONNECTED;
    if (this.metrics.successfulConnections) { this.metrics.successfulConnections++ };
    if (this.metrics) {

      this.metrics.currentState = ConnectionState.CONNECTED;

    }
    if (this.metrics) {

      this.metrics.lastConnectionTime = new Date();

    }
    
    // Reset circuit breaker
    if (this.circuitBreaker) {

      this.circuitBreaker.failures = 0;

    }
    if (this.circuitBreaker) {

      this.circuitBreaker.state = "closed";

    }
    if (this.circuitBreaker) {

      this.circuitBreaker.lastFailureTime = undefined;

    }
    if (this.circuitBreaker) {

      this.circuitBreaker.nextRetryTime = undefined;

    }
    
    logger.info("ChromaDB connection established successfully", "CHROMADB_CONNECTION");
    
    this.emit("connected");
    
    // Start health monitoring
    this.startHealthCheck();
  }

  /**
   * Handle connection failure
   */
  private onConnectionFailure(error: string): void {
    this.state = ConnectionState.FAILED;
    if (this.metrics.failedConnections) { this.metrics.failedConnections++ };
    if (this.metrics) {

      this.metrics.currentState = ConnectionState.FAILED;

    }
    if (this.metrics) {

      this.metrics.lastFailureTime = new Date();

    }
    if (this.metrics) {

      this.metrics.lastError = error;

    }
    
    // Update circuit breaker
    if (this.circuitBreaker.failures) { this.circuitBreaker.failures++ };
    if (this.circuitBreaker) {

      this.circuitBreaker.lastFailureTime = new Date();

    }
    
    if (this?.circuitBreaker?.failures >= this?.config?.circuitBreakerThreshold) {
      if (this.circuitBreaker) {

        this.circuitBreaker.state = "open";

      }
      if (this.circuitBreaker) {

        this.circuitBreaker.nextRetryTime = new Date(
        Date.now() + this?.config?.circuitBreakerResetTimeout
      );

      }
      
      logger.error(
        `Circuit breaker opened after ${this?.circuitBreaker?.failures} failures. Will retry at ${this?.circuitBreaker?.nextRetryTime?.toISOString() || 'unknown'}`,
        "CHROMADB_CONNECTION"
      );
    }
    
    logger.error(`ChromaDB connection failed: ${error}`, "CHROMADB_CONNECTION");
    
    this.emit("disconnected", error);
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this?.config?.healthCheckInterval) as NodeJS.Timeout;
    
    // Perform immediate health check
    this.performHealthCheck();
  }

  /**
   * Stop health checks
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<boolean> {
    if (!this.client || this.state !== ConnectionState.CONNECTED) {
      return false;
    }

    try {
      const startTime = Date.now();
      await this?.client?.heartbeat();
      const responseTime = Date.now() - startTime;
      
      this.updateResponseTime(responseTime);
      this.lastHealthCheckTime = new Date();
      
      // Update uptime metrics
      if (this.connectionStartTime) {
        const uptime = Date.now() - this?.connectionStartTime?.getTime();
        this.totalUptime += uptime;
      }
      
      return true;
    } catch (error) {
      logger.warn(
        `ChromaDB health check failed: ${error instanceof Error ? error.message : String(error)}`,
        "CHROMADB_CONNECTION"
      );
      
      // Connection lost, attempt reconnection
      this.state = ConnectionState.DISCONNECTED;
      this.emit("disconnected", "Health check failed");
      
      // Try to reconnect
      this.reconnectInBackground();
      
      return false;
    }
  }

  /**
   * Reconnect in background
   */
  private async reconnectInBackground(): Promise<void> {
    logger.info("Starting background reconnection attempt", "CHROMADB_CONNECTION");
    
    // Clear existing timer
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
    }
    
    // Schedule reconnection
    this.connectionTimer = setTimeout(async () => {
      await this.connect();
    }, this.calculateRetryDelay()) as NodeJS.Timeout;
  }

  /**
   * Wait for ongoing connection attempt
   */
  private async waitForConnection(): Promise<boolean> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 100; // 100ms
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      if (this.state === ConnectionState.CONNECTED) {
        return true;
      }
      
      if (this.state === ConnectionState.FAILED || this.state === ConnectionState.CIRCUIT_OPEN) {
        return false;
      }
      
      await this.sleep(checkInterval);
    }
    
    return false;
  }

  /**
   * Update average response time
   */
  private updateResponseTime(responseTime: number): void {
    const alpha = 0.3; // Exponential moving average factor
    if (this.metrics) {

      this.metrics.averageResponseTime = alpha * responseTime + (1 - alpha) * this?.metrics?.averageResponseTime;

    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current client (may be undefined if not connected)
   */
  getClient(): ChromaClient | undefined {
    return this.client;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    // Calculate uptime percentage
    if (this?.metrics?.connectionAttempts > 0) {
      if (this.metrics) {

        this.metrics.uptimePercentage = (this?.metrics?.successfulConnections / this?.metrics?.connectionAttempts) * 100;

      }
    }
    
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Force close connection
   */
  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = undefined;
    }
    
    this.client = undefined;
    this.state = ConnectionState.DISCONNECTED;
    if (this.metrics) {

      this.metrics.currentState = ConnectionState.DISCONNECTED;

    }
    
    logger.info("ChromaDB connection closed", "CHROMADB_CONNECTION");
    
    this.emit("disconnected", "Manual disconnect");
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      state: "closed",
    };
    
    logger.info("Circuit breaker reset manually", "CHROMADB_CONNECTION");
  }

  /**
   * Get collection with connection check
   */
  async getCollection(name: string): Promise<Collection | null> {
    if (!this.isConnected() || !this.client) {
      // Try to connect
      const connected = await this.connect();
      if (!connected || !this.client) {
        return null;
      }
    }

    try {
      return await this?.client?.getCollection({ name } as any);
    } catch (error) {
      logger.warn(
        `Failed to get collection ${name}: ${error instanceof Error ? error.message : String(error)}`,
        "CHROMADB_CONNECTION"
      );
      return null;
    }
  }

  /**
   * Create collection with connection check
   */
  async createCollection(
    name: string,
    metadata?: Record<string, any>
  ): Promise<Collection | null> {
    if (!this.isConnected() || !this.client) {
      // Try to connect
      const connected = await this.connect();
      if (!connected || !this.client) {
        return null;
      }
    }

    try {
      return await this?.client?.createCollection({ name, metadata });
    } catch (error) {
      logger.warn(
        `Failed to create collection ${name}: ${error instanceof Error ? error.message : String(error)}`,
        "CHROMADB_CONNECTION"
      );
      return null;
    }
  }

  /**
   * Health check for external monitoring
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    state: ConnectionState;
    circuitBreaker: CircuitBreakerState;
    metrics: ConnectionMetrics;
    lastHealthCheck?: Date;
  }> {
    const healthy = await this.performHealthCheck();
    
    return {
      healthy,
      state: this.state,
      circuitBreaker: this.getCircuitBreakerState(),
      metrics: this.getMetrics(),
      lastHealthCheck: this.lastHealthCheckTime,
    };
  }
}