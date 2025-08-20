// Monitoring and metrics type definitions
// Replaces 'any' usage in monitoring systems

// Base monitoring types
export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricSeries {
  name: string;
  values: MetricValue[];
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

// Performance monitoring
export interface PerformanceMetrics {
  duration: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
}

export interface DatabaseMetrics {
  connectionCount: number;
  activeQueries: number;
  queryDuration: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
  }>;
}

// Error tracking
export interface ErrorMetadata {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  context: Record<string, string | number | boolean>;
  stack?: string;
  userId?: string;
  sessionId?: string;
}

export interface ErrorEvent extends ErrorMetadata {
  message: string;
  code?: string;
  category: 'system' | 'business' | 'security' | 'performance';
}

// Health monitoring
export interface HealthStatus {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  duration: number;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    data?: Record<string, string | number>;
  }>;
}

// Alert system
export interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  acknowledgedBy?: string;
  metadata: Record<string, string | number | boolean>;
}

// Logger types
export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  message: string;
  timestamp: Date;
  service: string;
  correlationId?: string;
  userId?: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface LogConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  format: 'json' | 'text';
  outputs: Array<'console' | 'file' | 'remote'>;
  correlationId: boolean;
  sanitizeFields: string[];
}

// Memory monitoring
export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryAlert {
  threshold: number;
  current: number;
  service: string;
  timestamp: Date;
  severity: 'warning' | 'critical';
}

// TRPC monitoring
export interface TRPCMetrics {
  procedure: string;
  duration: number;
  status: 'success' | 'error';
  inputSize: number;
  outputSize: number;
  timestamp: Date;
  userId?: string;
  clientInfo: {
    userAgent?: string;
    ip?: string;
  };
}

// WebSocket monitoring
export interface WebSocketMetrics {
  connectionCount: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  averageLatency: number;
  timestamp: Date;
}

// Generic monitoring interfaces
export interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  alerts: {
    enabled: boolean;
    thresholds: Record<string, number>;
  };
}

export interface MetricsCollector {
  collect(): Promise<MetricSeries[]>;
  reset(): void;
  configure(config: MonitoringConfig): void;
}