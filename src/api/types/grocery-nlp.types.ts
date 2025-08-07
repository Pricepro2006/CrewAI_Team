/**
 * TypeScript interfaces for Grocery NLP Queue API
 * Comprehensive type definitions for all request/response types
 */

// Base types
export type QueuePriority = "high" | "normal" | "low";
export type QueueItemStatus = "pending" | "processing" | "completed" | "failed" | "timeout";

// Request/Response interfaces
export interface ProcessNLPRequest {
  query: string;
  priority?: QueuePriority;
  timeout?: number;
  metadata?: Record<string, any>;
  requestId?: string;
}

export interface ProcessNLPResponse {
  success: boolean;
  result?: any;
  error?: string;
  requestId: string;
  processingTime: number;
  queueTime: number;
}

export interface BatchProcessRequest {
  queries: Array<{
    query: string;
    metadata?: Record<string, any>;
  }>;
  priority?: QueuePriority;
  timeout?: number;
  batchId?: string;
}

export interface BatchProcessResponse {
  success: boolean;
  batchId: string;
  results: ProcessNLPResponse[];
  totalProcessingTime: number;
  failedCount: number;
  completedCount: number;
}

// Queue management types
export interface QueueStatus {
  healthy: boolean;
  queueSize: number;
  activeRequests: number;
  maxConcurrent: number;
  estimatedWaitTime: number;
  lastProcessedAt?: number;
}

export interface QueueMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  currentQueueSize: number;
  activeRequests: number;
  successRate: number;
  requestsPerMinute: number;
  peakQueueSize: number;
  throughput: {
    last1min: number;
    last5min: number;
    last15min: number;
  };
}

export interface QueueItem {
  id: string;
  priority: number;
  status: QueueItemStatus;
  query: string;
  metadata?: Record<string, any>;
  timestamp: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  timeout?: number;
  error?: string;
  processingTime?: number;
  queueTime?: number;
}

// WebSocket event types
export interface QueueUpdateEvent {
  type: "queue_update";
  data: {
    queueSize: number;
    activeRequests: number;
    estimatedWaitTime: number;
  };
}

export interface RequestStatusEvent {
  type: "request_status";
  data: {
    requestId: string;
    status: QueueItemStatus;
    progress?: number;
    result?: any;
    error?: string;
  };
}

export interface MetricsUpdateEvent {
  type: "metrics_update";
  data: QueueMetrics;
}

export type WebSocketEvent = QueueUpdateEvent | RequestStatusEvent | MetricsUpdateEvent;

// Persistence types
export interface QueueSnapshot {
  timestamp: number;
  version: string;
  items: QueueItem[];
  metrics: QueueMetrics;
  configuration: {
    maxConcurrent: number;
    defaultTimeout: number;
    maxRetries: number;
  };
}

// Deduplication types
export interface RequestFingerprint {
  hash: string;
  query: string;
  metadata?: Record<string, any>;
  firstSeen: number;
  lastSeen: number;
  count: number;
}

// Error types
export interface QueueError extends Error {
  code: string;
  requestId?: string;
  retryable: boolean;
  details?: Record<string, any>;
}

// Configuration types
export interface QueueConfiguration {
  maxConcurrent: number;
  defaultTimeout: number;
  maxRetries: number;
  persistenceEnabled: boolean;
  deduplicationEnabled: boolean;
  deduplicationTTL: number;
  healthCheck: {
    maxQueueSize: number;
    maxErrorRate: number;
    maxProcessingTime: number;
  };
}

// API Response wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: number;
  requestId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Monitoring and analytics types
export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
  };
  queue: {
    size: number;
    activeRequests: number;
    averageWaitTime: number;
    averageProcessingTime: number;
  };
}

export interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}

// Batch operations
export interface BatchOperationStatus {
  batchId: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt: number;
  completedAt?: number;
  estimatedCompletion?: number;
}

// Health check types
export interface HealthCheckResult {
  service: "grocery-nlp-queue";
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: number;
  checks: {
    queueSize: {
      status: "pass" | "warn" | "fail";
      value: number;
      threshold: number;
    };
    errorRate: {
      status: "pass" | "warn" | "fail";
      value: number;
      threshold: number;
    };
    processingTime: {
      status: "pass" | "warn" | "fail";
      value: number;
      threshold: number;
    };
    memoryUsage: {
      status: "pass" | "warn" | "fail";
      value: number;
      threshold: number;
    };
  };
  details?: Record<string, any>;
}