/**
 * Monitoring and Observability System
 * Comprehensive monitoring solution with metrics, tracing, and alerting
 */

import type { 
  Timestamp,
  HealthStatus,
  ServiceHealth,
  MemoryInfo
} from '../types';

// =====================================================
// Core Monitoring Types
// =====================================================

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  unit?: string;
  labels?: string[];
  buckets?: number[]; // For histograms
  quantiles?: number[]; // For summaries
}

export interface MetricValue {
  name: string;
  value: number;
  timestamp: Timestamp;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface MetricSnapshot {
  timestamp: Timestamp;
  metrics: MetricValue[];
  metadata?: Record<string, unknown>;
}

export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  query: string;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AlertCondition {
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number;
  duration: number; // Duration in seconds
  evaluationInterval: number; // How often to evaluate in seconds
}

export interface AlertInstance {
  id: string;
  alertId: string;
  state: 'pending' | 'firing' | 'resolved';
  activeAt?: Timestamp;
  resolvedAt?: Timestamp;
  value: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// =====================================================
// Metrics Collection System
// =====================================================

export class MetricsCollector {
  private metrics: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();
  private collectors: MetricCollectorFunction[] = [];

  registerMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    if (!this.values.has(definition.name)) {
      this.values.set(definition.name, []);
    }
  }

  recordValue(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      throw new Error(`Metric ${name} is not registered`);
    }

    const metricValue: MetricValue = {
      name,
      value,
      timestamp: new Date().toISOString(),
      labels,
      type: metric.type
    };

    const values = this.values.get(name) || [];
    values.push(metricValue);
    
    // Keep only last 1000 values per metric to prevent memory leaks
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
    
    this.values.set(name, values);
  }

  increment(name: string, labels?: Record<string, string>, value: number = 1): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      throw new Error(`Metric ${name} is not a registered counter`);
    }

    // For counters, we need to get the current value and add to it
    const values = this.values.get(name) || [];
    const currentValue = this.getCurrentValue(name, labels);
    this.recordValue(name, currentValue + value, labels);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      throw new Error(`Metric ${name} is not a registered gauge`);
    }
    
    this.recordValue(name, value, labels);
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      throw new Error(`Metric ${name} is not a registered histogram`);
    }
    
    this.recordValue(name, value, labels);
  }

  summary(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'summary') {
      throw new Error(`Metric ${name} is not a registered summary`);
    }
    
    this.recordValue(name, value, labels);
  }

  private getCurrentValue(name: string, labels?: Record<string, string>): number {
    const values = this.values.get(name) || [];
    if (values.length === 0) return 0;
    
    // Find the most recent value with matching labels
    for (let i = values.length - 1; i >= 0; i--) {
      const value = values[i];
      if (this.labelsMatch(value.labels, labels)) {
        return value.value;
      }
    }
    
    return 0;
  }

  private labelsMatch(a?: Record<string, string>, b?: Record<string, string>): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => a[key] === b[key]);
  }

  registerCollector(collector: MetricCollectorFunction): void {
    this.collectors.push(collector);
  }

  async collectAll(): Promise<MetricSnapshot> {
    // Run all registered collectors
    for (const collector of this.collectors) {
      try {
        await collector(this);
      } catch (error) {
        console.error('Metric collector error:', error);
      }
    }

    // Return current snapshot
    const allValues: MetricValue[] = [];
    for (const values of this.values.values()) {
      allValues.push(...values.slice(-1)); // Get only the latest value for each metric
    }

    return {
      timestamp: new Date().toISOString(),
      metrics: allValues
    };
  }

  getValues(name: string): MetricValue[] {
    return this.values.get(name) || [];
  }

  getMetrics(): MetricDefinition[] {
    return Array.from(this.metrics.values());
  }
}

export interface MetricCollectorFunction {
  (collector: MetricsCollector): Promise<void>;
}

// =====================================================
// Health Check System
// =====================================================

export interface HealthCheck {
  name: string;
  description: string;
  check: () => Promise<HealthCheckResult>;
  timeout: number;
  interval?: number;
  critical: boolean;
  tags?: string[];
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime: number;
  metadata?: Record<string, unknown>;
}

export class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private intervalHandles: Map<string, NodeJS.Timeout> = new Map();

  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    
    // Start periodic checking if interval is specified
    if (check.interval && check.interval > 0) {
      const handle = setInterval(() => {
        this.runCheck(check.name).catch(console.error);
      }, check.interval);
      
      this.intervalHandles.set(check.name, handle);
    }
  }

  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.results.delete(name);
    
    const handle = this.intervalHandles.get(name);
    if (handle) {
      clearInterval(handle);
      this.intervalHandles.delete(name);
    }
  }

  async runCheck(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check ${name} not found`);
    }

    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), check.timeout);
      
      const result = await Promise.race([
        check.check(),
        new Promise<HealthCheckResult>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Health check timeout'));
          });
        })
      ]);
      
      clearTimeout(timeoutId);
      result.responseTime = Date.now() - startTime;
      
      this.results.set(name, result);
      return result;
      
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      };
      
      this.results.set(name, result);
      return result;
    }
  }

  async runAllChecks(): Promise<Map<string, HealthCheckResult>> {
    const promises = Array.from(this.checks.keys()).map(async name => {
      const result = await this.runCheck(name);
      return [name, result] as [string, HealthCheckResult];
    });

    const results = await Promise.allSettled(promises);
    const healthResults = new Map<string, HealthCheckResult>();

    results.forEach((result, index) => {
      const checkName = Array.from(this.checks.keys())[index];
      if (result.status === 'fulfilled') {
        healthResults.set(result.value[0], result.value[1]);
      } else {
        healthResults.set(checkName, {
          status: 'unhealthy',
          message: 'Failed to run health check',
          responseTime: 0
        });
      }
    });

    return healthResults;
  }

  async getOverallHealth(): Promise<HealthStatus> {
    const checkResults = await this.runAllChecks();
    const services: Record<string, ServiceHealth> = {};
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let hasUnhealthy = false;
    let hasDegraded = false;

    for (const [name, result] of checkResults) {
      services[name] = {
        status: result.status,
        responseTime: result.responseTime,
        error: result.status === 'unhealthy' ? result.message : undefined,
        metadata: result.metadata
      };

      if (result.status === 'unhealthy') {
        hasUnhealthy = true;
        const check = this.checks.get(name);
        if (check?.critical) {
          overallStatus = 'unhealthy';
        }
      } else if (result.status === 'degraded') {
        hasDegraded = true;
      }
    }

    // Determine overall status
    if (overallStatus !== 'unhealthy') {
      if (hasUnhealthy || hasDegraded) {
        overallStatus = 'degraded';
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
      metadata: {
        version: process.env.npm_package_version || 'unknown',
        uptime: process.uptime(),
        memory: this.getMemoryInfo(),
        cpu: process.cpuUsage().user / 1000000 // Convert to seconds
      }
    };
  }

  private getMemoryInfo(): MemoryInfo {
    const usage = process.memoryUsage();
    return {
      used: usage.heapUsed,
      total: usage.heapTotal,
      percentage: (usage.heapUsed / usage.heapTotal) * 100
    };
  }

  getResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  getAllResults(): Map<string, HealthCheckResult> {
    return new Map(this.results);
  }

  destroy(): void {
    // Clear all intervals
    for (const handle of this.intervalHandles.values()) {
      clearInterval(handle);
    }
    
    this.intervalHandles.clear();
    this.checks.clear();
    this.results.clear();
  }
}

// =====================================================
// Default Metric Definitions
// =====================================================

export const defaultMetrics: MetricDefinition[] = [
  // HTTP Metrics
  {
    name: 'http_requests_total',
    type: 'counter',
    description: 'Total number of HTTP requests',
    labels: ['method', 'route', 'status']
  },
  {
    name: 'http_request_duration_seconds',
    type: 'histogram',
    description: 'HTTP request duration in seconds',
    labels: ['method', 'route'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  },
  {
    name: 'http_active_requests',
    type: 'gauge',
    description: 'Number of active HTTP requests'
  },
  
  // Database Metrics
  {
    name: 'database_connections_active',
    type: 'gauge',
    description: 'Number of active database connections'
  },
  {
    name: 'database_query_duration_seconds',
    type: 'histogram',
    description: 'Database query duration in seconds',
    labels: ['operation'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2]
  },
  {
    name: 'database_errors_total',
    type: 'counter',
    description: 'Total number of database errors',
    labels: ['type']
  },
  
  // Agent Metrics
  {
    name: 'agent_tasks_total',
    type: 'counter',
    description: 'Total number of agent tasks',
    labels: ['agent_type', 'status']
  },
  {
    name: 'agent_task_duration_seconds',
    type: 'histogram',
    description: 'Agent task duration in seconds',
    labels: ['agent_type'],
    buckets: [1, 5, 10, 30, 60, 300]
  },
  {
    name: 'agent_active_tasks',
    type: 'gauge',
    description: 'Number of active agent tasks',
    labels: ['agent_type']
  },
  
  // LLM Metrics
  {
    name: 'llm_requests_total',
    type: 'counter',
    description: 'Total number of LLM requests',
    labels: ['model', 'provider']
  },
  {
    name: 'llm_tokens_total',
    type: 'counter',
    description: 'Total number of tokens used',
    labels: ['model', 'type'] // type: prompt, completion
  },
  {
    name: 'llm_request_duration_seconds',
    type: 'histogram',
    description: 'LLM request duration in seconds',
    labels: ['model'],
    buckets: [1, 5, 10, 30, 60]
  },
  
  // WebSocket Metrics
  {
    name: 'websocket_connections_active',
    type: 'gauge',
    description: 'Number of active WebSocket connections'
  },
  {
    name: 'websocket_messages_total',
    type: 'counter',
    description: 'Total number of WebSocket messages',
    labels: ['direction', 'type'] // direction: inbound, outbound
  },
  
  // System Metrics
  {
    name: 'system_memory_usage_bytes',
    type: 'gauge',
    description: 'System memory usage in bytes',
    labels: ['type'] // type: heap_used, heap_total, external
  },
  {
    name: 'system_cpu_usage_percent',
    type: 'gauge',
    description: 'System CPU usage percentage'
  },
  {
    name: 'system_uptime_seconds',
    type: 'counter',
    description: 'System uptime in seconds'
  }
];

// =====================================================
// Default Health Checks
// =====================================================

export const createDefaultHealthChecks = (): HealthCheck[] => [
  {
    name: 'api_server',
    description: 'API server health check',
    timeout: 5000,
    interval: 30000,
    critical: true,
    check: async (): Promise<HealthCheckResult> => {
      return {
        status: 'healthy',
        message: 'API server is running',
        responseTime: 0
      };
    }
  },
  
  {
    name: 'database',
    description: 'Database connection health check',
    timeout: 10000,
    interval: 60000,
    critical: true,
    check: async (): Promise<HealthCheckResult> => {
      try {
        // This would be replaced with actual database health check
        return {
          status: 'healthy',
          message: 'Database connection is healthy',
          responseTime: 0
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Database check failed',
          responseTime: 0
        };
      }
    }
  },
  
  {
    name: 'ollama_service',
    description: 'Ollama service health check',
    timeout: 15000,
    interval: 120000,
    critical: false,
    check: async (): Promise<HealthCheckResult> => {
      try {
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          return {
            status: 'healthy',
            message: 'Ollama service is accessible',
            responseTime: 0
          };
        } else {
          return {
            status: 'degraded',
            message: `Ollama service returned ${response.status}`,
            responseTime: 0
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Ollama check failed',
          responseTime: 0
        };
      }
    }
  },
  
  {
    name: 'chromadb_service',
    description: 'ChromaDB service health check',
    timeout: 10000,
    interval: 120000,
    critical: false,
    check: async (): Promise<HealthCheckResult> => {
      try {
        const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';
        const response = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
          method: 'GET',
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          return {
            status: 'healthy',
            message: 'ChromaDB service is accessible',
            responseTime: 0
          };
        } else {
          return {
            status: 'degraded',
            message: `ChromaDB service returned ${response.status}`,
            responseTime: 0
          };
        }
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'ChromaDB check failed',
          responseTime: 0
        };
      }
    }
  }
];

// =====================================================
// Global Monitoring Instances
// =====================================================

export const globalMetricsCollector = new MetricsCollector();
export const globalHealthMonitor = new HealthMonitor();

// Register default metrics
defaultMetrics.forEach(metric => {
  globalMetricsCollector.registerMetric(metric);
});

// Register default health checks
createDefaultHealthChecks().forEach(check => {
  globalHealthMonitor.registerCheck(check);
});

// =====================================================
// Utility Functions
// =====================================================

export function createHttpMetricsCollector(): MetricCollectorFunction {
  return async (collector: MetricsCollector) => {
    // Collect system metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    collector.gauge('system_memory_usage_bytes', memUsage.heapUsed, { type: 'heap_used' });
    collector.gauge('system_memory_usage_bytes', memUsage.heapTotal, { type: 'heap_total' });
    collector.gauge('system_memory_usage_bytes', memUsage.external, { type: 'external' });
    
    collector.gauge('system_cpu_usage_percent', (cpuUsage.user + cpuUsage.system) / 1000000);
    collector.increment('system_uptime_seconds', undefined, process.uptime());
  };
}

export function startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
  const collector = createHttpMetricsCollector();
  globalMetricsCollector.registerCollector(collector);
  
  return setInterval(async () => {
    try {
      await globalMetricsCollector.collectAll();
    } catch (error) {
      console.error('Monitoring collection error:', error);
    }
  }, intervalMs);
}

export function stopMonitoring(handle: NodeJS.Timeout): void {
  clearInterval(handle);
  globalHealthMonitor.destroy();
}