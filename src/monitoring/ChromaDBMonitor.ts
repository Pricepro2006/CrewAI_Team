/**
 * ChromaDB Monitoring Service
 * Tracks connection health, performance metrics, and fallback usage
 */

import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import { ConnectionState } from "../database/vector/ChromaDBConnectionManager.js";

export interface ChromaDBMetrics {
  // Connection metrics
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  currentState: ConnectionState;
  lastConnectionTime?: Date;
  lastFailureTime?: Date;
  uptimePercentage: number;
  
  // Performance metrics
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  failedRequests: number;
  
  // Fallback metrics
  fallbackActivations: number;
  currentMode: "chromadb" | "in-memory" | "hybrid";
  documentsInMemory: number;
  documentsSynced: number;
  pendingSyncCount: number;
  
  // Circuit breaker metrics
  circuitBreakerState: "closed" | "open" | "half-open";
  circuitBreakerTrips: number;
  lastCircuitBreakerTrip?: Date;
  
  // Resource metrics
  memoryUsage: number;
  connectionPoolSize: number;
  activeConnections: number;
}

export interface MetricEvent {
  type: "connection" | "request" | "fallback" | "sync" | "circuit_breaker";
  timestamp: Date;
  success: boolean;
  duration?: number;
  error?: string;
  details?: Record<string, any>;
}

export class ChromaDBMonitor extends EventEmitter {
  private static instance: ChromaDBMonitor;
  private metrics: ChromaDBMetrics;
  private responseTimes: number[] = [];
  private metricsHistory: MetricEvent[] = [];
  private maxHistorySize: number = 1000;
  private metricsInterval?: NodeJS.Timer;

  private constructor() {
    super();
    
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      currentState: ConnectionState.DISCONNECTED,
      uptimePercentage: 100,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      totalRequests: 0,
      failedRequests: 0,
      fallbackActivations: 0,
      currentMode: "chromadb",
      documentsInMemory: 0,
      documentsSynced: 0,
      pendingSyncCount: 0,
      circuitBreakerState: "closed",
      circuitBreakerTrips: 0,
      memoryUsage: 0,
      connectionPoolSize: 1,
      activeConnections: 0,
    };
    
    this.startMetricsCollection();
  }

  static getInstance(): ChromaDBMonitor {
    if (!ChromaDBMonitor.instance) {
      ChromaDBMonitor.instance = new ChromaDBMonitor();
    }
    return ChromaDBMonitor.instance;
  }

  /**
   * Record a connection attempt
   */
  recordConnectionAttempt(success: boolean, duration: number, error?: string): void {
    if (this.metrics) {
      this.metrics.connectionAttempts++;
    }
    
    if (success) {
      if (this.metrics) {
        this.metrics.successfulConnections++;
        this.metrics.lastConnectionTime = new Date();
        this.metrics.currentState = ConnectionState.CONNECTED;
      }
    } else {
      if (this.metrics) {
        this.metrics.failedConnections++;
        this.metrics.lastFailureTime = new Date();
        this.metrics.currentState = ConnectionState.FAILED;
      }
    }
    
    this.updateUptimePercentage();
    
    const event: MetricEvent = {
      type: "connection",
      timestamp: new Date(),
      success,
      duration,
      error,
    };
    
    this.addMetricEvent(event);
    this.emit("connection", event);
  }

  /**
   * Record a request to ChromaDB
   */
  recordRequest(success: boolean, duration: number, operation?: string): void {
    if (this.metrics) {
      this.metrics.totalRequests++;
    }
    
    if (!success && this.metrics) {
      this.metrics.failedRequests++;
    }
    
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    
    this.updateResponseTimeMetrics();
    
    const event: MetricEvent = {
      type: "request",
      timestamp: new Date(),
      success,
      duration,
      details: { operation },
    };
    
    this.addMetricEvent(event);
    this.emit("request", event);
  }

  /**
   * Record fallback activation
   */
  recordFallbackActivation(reason: string): void {
    if (this.metrics) {
      this.metrics.fallbackActivations++;
      this.metrics.currentMode = "in-memory";
    }
    
    const event: MetricEvent = {
      type: "fallback",
      timestamp: new Date(),
      success: true,
      details: { reason },
    };
    
    this.addMetricEvent(event);
    this.emit("fallback", event);
    
    logger.warn(`ChromaDB fallback activated: ${reason}`, "CHROMADB_MONITOR");
  }

  /**
   * Record mode change
   */
  recordModeChange(mode: "chromadb" | "in-memory" | "hybrid"): void {
    if (this.metrics) {
      this.metrics.currentMode = mode;
    }
    
    logger.info(`ChromaDB mode changed to: ${mode}`, "CHROMADB_MONITOR");
  }

  /**
   * Record document sync
   */
  recordDocumentSync(count: number, success: boolean, duration: number): void {
    if (success && this.metrics) {
      this.metrics.documentsSynced += count;
      this.metrics.pendingSyncCount = Math.max(0, this.metrics.pendingSyncCount - count);
    }
    
    const event: MetricEvent = {
      type: "sync",
      timestamp: new Date(),
      success,
      duration,
      details: { documentCount: count },
    };
    
    this.addMetricEvent(event);
    this.emit("sync", event);
  }

  /**
   * Record circuit breaker event
   */
  recordCircuitBreakerEvent(state: "closed" | "open" | "half-open"): void {
    if (this.metrics) {
      this.metrics.circuitBreakerState = state;
      
      if (state === "open") {
        this.metrics.circuitBreakerTrips++;
        this.metrics.lastCircuitBreakerTrip = new Date();
      }
    }
    
    const event: MetricEvent = {
      type: "circuit_breaker",
      timestamp: new Date(),
      success: state === "closed",
      details: { state },
    };
    
    this.addMetricEvent(event);
    this.emit("circuit_breaker", event);
    
    logger.info(`Circuit breaker state: ${state}`, "CHROMADB_MONITOR");
  }

  /**
   * Update in-memory document count
   */
  updateInMemoryCount(count: number): void {
    if (this.metrics) {
      this.metrics.documentsInMemory = count;
    }
  }

  /**
   * Update pending sync count
   */
  updatePendingSyncCount(count: number): void {
    if (this.metrics) {
      this.metrics.pendingSyncCount = count;
    }
  }

  /**
   * Update connection state
   */
  updateConnectionState(state: ConnectionState): void {
    if (this.metrics) {
      this.metrics.currentState = state;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ChromaDBMetrics {
    return { ...this.metrics };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(type?: MetricEvent["type"], limit: number = 100): MetricEvent[] {
    let history = this.metricsHistory;
    
    if (type) {
      history = history.filter(e => e.type === type);
    }
    
    return history.slice(-limit);
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    healthy: boolean;
    status: string;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check connection health
    if (this.metrics.currentState !== ConnectionState.CONNECTED) {
      issues.push("ChromaDB not connected");
      recommendations.push("Check ChromaDB service is running");
    }
    
    // Check failure rate
    const failureRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;
    
    if (failureRate > 10) {
      issues.push(`High failure rate: ${failureRate.toFixed(2)}%`);
      recommendations.push("Review ChromaDB logs for errors");
    }
    
    // Check response times
    if (this.metrics.averageResponseTime > 1000) {
      issues.push(`Slow response time: ${this.metrics.averageResponseTime.toFixed(0)}ms`);
      recommendations.push("Consider optimizing queries or scaling ChromaDB");
    }
    
    // Check circuit breaker
    if (this.metrics.circuitBreakerState === "open") {
      issues.push("Circuit breaker is open");
      recommendations.push("ChromaDB experiencing repeated failures");
    }
    
    // Check fallback usage
    if (this.metrics.currentMode === "in-memory") {
      issues.push("Using in-memory fallback");
      recommendations.push("Data persistence not available");
    }
    
    // Check pending syncs
    if (this.metrics.pendingSyncCount > 100) {
      issues.push(`${this.metrics.pendingSyncCount} documents pending sync`);
      recommendations.push("Monitor sync progress");
    }
    
    const healthy = issues.length === 0;
    const status = healthy 
      ? "Healthy" 
      : this.metrics.currentMode === "in-memory" 
        ? "Degraded (fallback active)" 
        : "Unhealthy";
    
    return {
      healthy,
      status,
      issues,
      recommendations,
    };
  }

  /**
   * Get Prometheus-compatible metrics
   */
  getPrometheusMetrics(): string {
    const metrics: string[] = [
      `# HELP chromadb_connection_attempts_total Total connection attempts`,
      `# TYPE chromadb_connection_attempts_total counter`,
      `chromadb_connection_attempts_total ${this.metrics.connectionAttempts}`,
      
      `# HELP chromadb_successful_connections_total Successful connections`,
      `# TYPE chromadb_successful_connections_total counter`,
      `chromadb_successful_connections_total ${this.metrics.successfulConnections}`,
      
      `# HELP chromadb_failed_connections_total Failed connections`,
      `# TYPE chromadb_failed_connections_total counter`,
      `chromadb_failed_connections_total ${this.metrics.failedConnections}`,
      
      `# HELP chromadb_uptime_percentage Uptime percentage`,
      `# TYPE chromadb_uptime_percentage gauge`,
      `chromadb_uptime_percentage ${this.metrics.uptimePercentage}`,
      
      `# HELP chromadb_average_response_time_ms Average response time in milliseconds`,
      `# TYPE chromadb_average_response_time_ms gauge`,
      `chromadb_average_response_time_ms ${this.metrics.averageResponseTime}`,
      
      `# HELP chromadb_p95_response_time_ms 95th percentile response time`,
      `# TYPE chromadb_p95_response_time_ms gauge`,
      `chromadb_p95_response_time_ms ${this.metrics.p95ResponseTime}`,
      
      `# HELP chromadb_total_requests_total Total requests`,
      `# TYPE chromadb_total_requests_total counter`,
      `chromadb_total_requests_total ${this.metrics.totalRequests}`,
      
      `# HELP chromadb_failed_requests_total Failed requests`,
      `# TYPE chromadb_failed_requests_total counter`,
      `chromadb_failed_requests_total ${this.metrics.failedRequests}`,
      
      `# HELP chromadb_fallback_activations_total Fallback activations`,
      `# TYPE chromadb_fallback_activations_total counter`,
      `chromadb_fallback_activations_total ${this.metrics.fallbackActivations}`,
      
      `# HELP chromadb_documents_in_memory Documents in memory`,
      `# TYPE chromadb_documents_in_memory gauge`,
      `chromadb_documents_in_memory ${this.metrics.documentsInMemory}`,
      
      `# HELP chromadb_documents_synced_total Documents synced`,
      `# TYPE chromadb_documents_synced_total counter`,
      `chromadb_documents_synced_total ${this.metrics.documentsSynced}`,
      
      `# HELP chromadb_pending_sync_count Documents pending sync`,
      `# TYPE chromadb_pending_sync_count gauge`,
      `chromadb_pending_sync_count ${this.metrics.pendingSyncCount}`,
      
      `# HELP chromadb_circuit_breaker_trips_total Circuit breaker trips`,
      `# TYPE chromadb_circuit_breaker_trips_total counter`,
      `chromadb_circuit_breaker_trips_total ${this.metrics.circuitBreakerTrips}`,
    ];
    
    return metrics.join("\n");
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    if (this.metrics) {
      this.metrics.connectionAttempts = 0;
      this.metrics.successfulConnections = 0;
      this.metrics.failedConnections = 0;
      this.metrics.totalRequests = 0;
      this.metrics.failedRequests = 0;
      this.metrics.fallbackActivations = 0;
      this.metrics.documentsSynced = 0;
      this.metrics.circuitBreakerTrips = 0;
    }
    this.responseTimes = [];
    this.metricsHistory = [];
    
    logger.info("ChromaDB metrics reset", "CHROMADB_MONITOR");
  }

  /**
   * Private helper methods
   */
  private startMetricsCollection(): void {
    // Collect memory metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      if (this.metrics) {
        this.metrics.memoryUsage = memUsage.heapUsed;
      }
    }, 30000);
  }

  private updateUptimePercentage(): void {
    if (this.metrics && this.metrics.connectionAttempts > 0) {
      this.metrics.uptimePercentage = 
        (this.metrics.successfulConnections / this.metrics.connectionAttempts) * 100;
    }
  }

  private updateResponseTimeMetrics(): void {
    if (this.responseTimes.length === 0) return;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const sum = sorted.reduce((a: any, b: any) => a + b, 0);
    
    if (this.metrics) {
      this.metrics.averageResponseTime = sum / sorted.length;
      this.metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
      this.metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
    }
  }

  private addMetricEvent(event: MetricEvent): void {
    this.metricsHistory.push(event);
    
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.removeAllListeners();
  }
}