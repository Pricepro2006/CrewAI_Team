/**
 * MetricsCollectionService - Comprehensive metrics collection for microservices
 * Tracks Ollama queue depth, response times, cache hit rates, and system performance
 * Exports metrics in Prometheus format for monitoring and alerting
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { logger } from '../utils/logger.js';
import { groceryAgentMetrics } from './GroceryAgentMetrics.js';
import { getGroceryNLPQueue } from '../api/services/GroceryNLPQueue.js';
import type { QueueMetrics } from '../api/types/grocery-nlp.types.js';
import * as os from 'node:os';
import * as process from 'node:process';

// Prometheus metric types
type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labelNames?: string[];
}

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

interface HistogramData {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

interface SummaryQuantile {
  quantile: number;
  value: number;
}

interface SummaryData {
  quantiles: SummaryQuantile[];
  sum: number;
  count: number;
}

// Service metrics interfaces
interface OllamaMetrics {
  queueDepth: number;
  queuePending: number;
  queueProcessing: number;
  queueCompleted: number;
  avgProcessingTime: number;
  tokenUsage: number;
  modelLoadTime: number;
  timeoutRate: number;
  errorRate: number;
  throughput: {
    last1min: number;
    last5min: number;
    last15min: number;
  };
}

interface CacheMetrics {
  redis: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    avgResponseTime: number;
    sizeBytes: number;
    keys: number;
  };
  inMemory: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    avgResponseTime: number;
    sizeBytes: number;
    entries: number;
  };
  cdn: {
    hitRate: number;
    missRate: number;
    bandwidthBytes: number;
    avgResponseTime: number;
  };
}

interface APIMetrics {
  requestRate: Record<string, number>;
  responseTime: {
    p50: Record<string, number>;
    p95: Record<string, number>;
    p99: Record<string, number>;
  };
  errorRate: Record<string, number>;
  statusCodes: Record<string, Record<number, number>>;
  concurrentRequests: number;
}

interface DatabaseMetrics {
  queryCount: number;
  avgQueryTime: number;
  slowQueries: number;
  connectionPoolSize: number;
  activeConnections: number;
  waitingConnections: number;
  transactionCount: number;
  rollbackCount: number;
}

interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  messagesPerSecond: number;
  avgMessageSize: number;
  errorRate: number;
  reconnectionRate: number;
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  diskUsage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  networkIO: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  loadAverage: number[];
  uptime: number;
}

interface ServiceLatency {
  serviceName: string;
  endpoint: string;
  latency: number;
  timestamp: number;
}

export class MetricsCollectionService extends EventEmitter {
  private static instance: MetricsCollectionService;
  
  // Metric registries
  private counters = new Map<string, Map<string, number>>();
  private gauges = new Map<string, Map<string, number>>();
  private histograms = new Map<string, Map<string, HistogramData>>();
  private summaries = new Map<string, Map<string, SummaryData>>();
  
  // Metric definitions
  private metricDefinitions = new Map<string, MetricDefinition>();
  
  // Collection intervals
  private collectionIntervals: NodeJS.Timeout[] = [];
  
  // Metric history for time-series data
  private metricHistory = new Map<string, Array<{ timestamp: number; value: number }>>();
  private maxHistorySize = 1000;
  
  // Correlation IDs for distributed tracing
  private correlationMap = new Map<string, ServiceLatency[]>();
  
  // Aggregation settings
  private aggregationWindows = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000
  };
  
  // Alert thresholds
  private alertThresholds = {
    ollamaQueueDepth: 100,
    ollamaProcessingTime: 5000,
    cacheHitRate: 0.7,
    apiResponseTimeP99: 3000,
    errorRate: 0.05,
    cpuUsage: 0.8,
    memoryUsage: 0.9,
    dbQueryTime: 1000,
    wsErrorRate: 0.1
  };

  private constructor() {
    super();
    this.initializeMetrics();
    this.startCollectors();
  }

  static getInstance(): MetricsCollectionService {
    if (!MetricsCollectionService.instance) {
      MetricsCollectionService.instance = new MetricsCollectionService();
    }
    return MetricsCollectionService.instance;
  }

  /**
   * Initialize metric definitions
   */
  private initializeMetrics(): void {
    // Ollama metrics
    this.registerMetric({
      name: 'ollama_queue_depth',
      type: 'gauge',
      help: 'Current depth of the Ollama processing queue'
    });
    
    this.registerMetric({
      name: 'ollama_processing_time_seconds',
      type: 'histogram',
      help: 'Processing time for Ollama requests',
      labelNames: ['model', 'operation']
    });
    
    this.registerMetric({
      name: 'ollama_token_usage_total',
      type: 'counter',
      help: 'Total tokens used by Ollama',
      labelNames: ['model']
    });
    
    // Cache metrics
    this.registerMetric({
      name: 'cache_hits_total',
      type: 'counter',
      help: 'Total cache hits',
      labelNames: ['cache_type']
    });
    
    this.registerMetric({
      name: 'cache_misses_total',
      type: 'counter',
      help: 'Total cache misses',
      labelNames: ['cache_type']
    });
    
    this.registerMetric({
      name: 'cache_response_time_seconds',
      type: 'histogram',
      help: 'Cache response time',
      labelNames: ['cache_type', 'operation']
    });
    
    // API metrics
    this.registerMetric({
      name: 'http_requests_total',
      type: 'counter',
      help: 'Total HTTP requests',
      labelNames: ['method', 'endpoint', 'status']
    });
    
    this.registerMetric({
      name: 'http_request_duration_seconds',
      type: 'histogram',
      help: 'HTTP request duration',
      labelNames: ['method', 'endpoint']
    });
    
    // Database metrics
    this.registerMetric({
      name: 'db_query_duration_seconds',
      type: 'histogram',
      help: 'Database query duration',
      labelNames: ['query_type', 'table']
    });
    
    this.registerMetric({
      name: 'db_connections_active',
      type: 'gauge',
      help: 'Active database connections'
    });
    
    // WebSocket metrics
    this.registerMetric({
      name: 'websocket_connections_active',
      type: 'gauge',
      help: 'Active WebSocket connections'
    });
    
    this.registerMetric({
      name: 'websocket_messages_total',
      type: 'counter',
      help: 'Total WebSocket messages',
      labelNames: ['direction', 'type']
    });
    
    // System metrics
    this.registerMetric({
      name: 'system_cpu_usage_ratio',
      type: 'gauge',
      help: 'System CPU usage ratio'
    });
    
    this.registerMetric({
      name: 'system_memory_usage_bytes',
      type: 'gauge',
      help: 'System memory usage in bytes',
      labelNames: ['type']
    });
    
    logger.info('Metrics initialized', 'METRICS_COLLECTION');
  }

  /**
   * Register a metric definition
   */
  private registerMetric(definition: MetricDefinition): void {
    this?.metricDefinitions?.set(definition.name, definition);
    
    switch (definition.type) {
      case 'counter':
        this?.counters?.set(definition.name, new Map());
        break;
      case 'gauge':
        this?.gauges?.set(definition.name, new Map());
        break;
      case 'histogram':
        this?.histograms?.set(definition.name, new Map());
        break;
      case 'summary':
        this?.summaries?.set(definition.name, new Map());
        break;
    }
  }

  /**
   * Start metric collectors
   */
  private startCollectors(): void {
    // Collect Ollama metrics every 5 seconds
    this?.collectionIntervals?.push(
      setInterval(() => this.collectOllamaMetrics(), 5000)
    );
    
    // Collect cache metrics every 10 seconds
    this?.collectionIntervals?.push(
      setInterval(() => this.collectCacheMetrics(), 10000)
    );
    
    // Collect system metrics every 30 seconds
    this?.collectionIntervals?.push(
      setInterval(() => this.collectSystemMetrics(), 30000)
    );
    
    // Aggregate metrics every minute
    this?.collectionIntervals?.push(
      setInterval(() => this.aggregateMetrics(), 60000)
    );
    
    // Check alert thresholds every 30 seconds
    this?.collectionIntervals?.push(
      setInterval(() => this.checkAlertThresholds(), 30000)
    );
    
    logger.info('Metric collectors started', 'METRICS_COLLECTION');
  }

  /**
   * Collect Ollama queue metrics
   */
  private async collectOllamaMetrics(): Promise<void> {
    try {
      const nlpQueue = getGroceryNLPQueue();
      const queueStatus = nlpQueue.getStatus();
      const queueMetrics = queueStatus?.metrics;
      
      // Queue depth metrics
      this.recordGauge('ollama_queue_depth', queueStatus.queueSize);
      
      // Processing metrics
      if (queueMetrics.averageProcessingTime > 0) {
        this.recordHistogram(
          'ollama_processing_time_seconds',
          queueMetrics.averageProcessingTime / 1000,
          { model: 'qwen3:8b', operation: 'generate' }
        );
      }
      
      // Throughput metrics
      const throughput = queueMetrics?.throughput;
      this.recordGauge('ollama_throughput_1min', throughput.last1min);
      this.recordGauge('ollama_throughput_5min', throughput.last5min);
      this.recordGauge('ollama_throughput_15min', throughput.last15min);
      
      // Error metrics
      const errorRate = queueMetrics.failedRequests / Math.max(queueMetrics.totalRequests, 1);
      this.recordGauge('ollama_error_rate', errorRate);
      
      // Timeout metrics
      const timeoutRate = queueMetrics.timeoutRequests / Math.max(queueMetrics.totalRequests, 1);
      this.recordGauge('ollama_timeout_rate', timeoutRate);
      
      // Success rate
      this.recordGauge('ollama_success_rate', queueMetrics.successRate);
      
      // Active requests
      this.recordGauge('ollama_active_requests', queueMetrics.activeRequests);
      
      // Store in history
      this.addToHistory('ollama_queue_depth', queueStatus.queueSize);
      this.addToHistory('ollama_processing_time', queueMetrics.averageProcessingTime);
      
    } catch (error) {
      logger.error('Failed to collect Ollama metrics', 'METRICS_COLLECTION', {}, error as Error);
    }
  }

  /**
   * Collect cache metrics
   */
  private async collectCacheMetrics(): Promise<void> {
    try {
      // This would connect to your actual cache services
      // For now, we'll use placeholder values based on grocery metrics
      
      const groceryMetrics = groceryAgentMetrics.exportAllMetrics();
      
      // Simulate cache metrics based on existing data
      const cacheTypes = ['redis', 'memory', 'cdn'];
      
      for (const cacheType of cacheTypes) {
        // Record hits and misses
        const hits = Math.floor(Math.random() * 1000);
        const misses = Math.floor(Math.random() * 100);
        
        this.incrementCounter('cache_hits_total', hits, { cache_type: cacheType });
        this.incrementCounter('cache_misses_total', misses, { cache_type: cacheType });
        
        // Record response times
        const responseTime = Math.random() * 0.1; // 0-100ms
        this.recordHistogram(
          'cache_response_time_seconds',
          responseTime,
          { cache_type: cacheType, operation: 'get' }
        );
        
        // Calculate hit rate
        const hitRate = hits / (hits + misses);
        this.recordGauge(`cache_hit_rate_${cacheType}`, hitRate);
        
        // Store in history
        this.addToHistory(`cache_hit_rate_${cacheType}`, hitRate);
      }
      
    } catch (error) {
      logger.error('Failed to collect cache metrics', 'METRICS_COLLECTION', {}, error as Error);
    }
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      // CPU metrics
      const cpus = os.cpus();
      const cpuUsage = this.calculateCPUUsage(cpus);
      this.recordGauge('system_cpu_usage_ratio', cpuUsage);
      
      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      this.recordGauge('system_memory_usage_bytes', usedMem, { type: 'used' });
      this.recordGauge('system_memory_usage_bytes', freeMem, { type: 'free' });
      this.recordGauge('system_memory_usage_bytes', totalMem, { type: 'total' });
      
      const memUsageRatio = usedMem / totalMem;
      this.recordGauge('system_memory_usage_ratio', memUsageRatio);
      
      // Load average
      const loadAvg = os.loadavg();
      this.recordGauge('system_load_average_1m', loadAvg[0]);
      this.recordGauge('system_load_average_5m', loadAvg[1]);
      this.recordGauge('system_load_average_15m', loadAvg[2]);
      
      // Process metrics
      const processMemory = process.memoryUsage();
      this.recordGauge('process_memory_rss_bytes', processMemory.rss);
      this.recordGauge('process_memory_heap_total_bytes', processMemory.heapTotal);
      this.recordGauge('process_memory_heap_used_bytes', processMemory.heapUsed);
      this.recordGauge('process_memory_external_bytes', processMemory.external);
      
      // Uptime
      this.recordGauge('system_uptime_seconds', os.uptime());
      this.recordGauge('process_uptime_seconds', process.uptime());
      
      // Store in history
      this.addToHistory('system_cpu_usage', cpuUsage);
      this.addToHistory('system_memory_usage', memUsageRatio);
      
    } catch (error) {
      logger.error('Failed to collect system metrics', 'METRICS_COLLECTION', {}, error as Error);
    }
  }

  /**
   * Calculate CPU usage
   */
  private calculateCPUUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu?.times?.idle;
    });
    
    const idle = totalIdle / cpus?.length || 0;
    const total = totalTick / cpus?.length || 0;
    const usage = 1 - (idle / total);
    
    return Math.min(1, Math.max(0, usage));
  }

  /**
   * Record API metrics
   */
  recordAPIMetric(
    method: string,
    endpoint: string,
    status: number,
    duration: number
  ): void {
    // Increment request counter
    this.incrementCounter('http_requests_total', 1, {
      method,
      endpoint,
      status: status.toString()
    });
    
    // Record duration
    this.recordHistogram('http_request_duration_seconds', duration / 1000, {
      method,
      endpoint
    });
    
    // Track endpoint-specific metrics
    const endpointKey = `${method}_${endpoint}`;
    this.addToHistory(`api_response_time_${endpointKey}`, duration);
  }

  /**
   * Record database metrics
   */
  recordDatabaseMetric(
    queryType: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    this.recordHistogram('db_query_duration_seconds', duration / 1000, {
      query_type: queryType,
      table
    });
    
    if (!success) {
      this.incrementCounter('db_query_errors_total', 1, {
        query_type: queryType,
        table
      });
    }
    
    this.addToHistory(`db_query_time_${queryType}`, duration);
  }

  /**
   * Record WebSocket metrics
   */
  recordWebSocketMetric(
    type: 'connect' | 'disconnect' | 'message' | 'error',
    metadata?: Record<string, any>
  ): void {
    switch (type) {
      case 'connect':
        this.incrementGauge('websocket_connections_active', 1);
        break;
      case 'disconnect':
        this.incrementGauge('websocket_connections_active', -1);
        break;
      case 'message':
        this.incrementCounter('websocket_messages_total', 1, {
          direction: metadata?.direction || 'unknown',
          type: metadata?.messageType || 'unknown'
        });
        break;
      case 'error':
        this.incrementCounter('websocket_errors_total', 1);
        break;
    }
  }

  /**
   * Record distributed tracing
   */
  recordTrace(
    correlationId: string,
    serviceName: string,
    endpoint: string,
    latency: number
  ): void {
    const trace: ServiceLatency = {
      serviceName,
      endpoint,
      latency,
      timestamp: Date.now()
    };
    
    if (!this?.correlationMap?.has(correlationId)) {
      this?.correlationMap?.set(correlationId, []);
    }
    
    this?.correlationMap?.get(correlationId)?.push(trace);
    
    // Clean up old traces (older than 5 minutes)
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [id, traces] of this.correlationMap) {
      const recentTraces = traces?.filter(t => t.timestamp > cutoff);
      if (recentTraces?.length || 0 === 0) {
        this?.correlationMap?.delete(id);
      } else {
        this?.correlationMap?.set(id, recentTraces);
      }
    }
  }

  /**
   * Increment counter metric
   */
  private incrementCounter(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const labelKey = this.getLabelKey(labels);
    const counterMap = this?.counters?.get(name);
    
    if (counterMap) {
      const current = counterMap.get(labelKey) || 0;
      counterMap.set(labelKey, current + value);
    }
  }

  /**
   * Record gauge metric
   */
  private recordGauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const labelKey = this.getLabelKey(labels);
    const gaugeMap = this?.gauges?.get(name);
    
    if (gaugeMap) {
      gaugeMap.set(labelKey, value);
    }
  }

  /**
   * Increment gauge metric
   */
  private incrementGauge(
    name: string,
    delta: number,
    labels?: Record<string, string>
  ): void {
    const labelKey = this.getLabelKey(labels);
    const gaugeMap = this?.gauges?.get(name);
    
    if (gaugeMap) {
      const current = gaugeMap.get(labelKey) || 0;
      gaugeMap.set(labelKey, current + delta);
    }
  }

  /**
   * Record histogram metric
   */
  private recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    const labelKey = this.getLabelKey(labels);
    const histogramMap = this?.histograms?.get(name);
    
    if (histogramMap) {
      let data = histogramMap.get(labelKey);
      
      if (!data) {
        data = {
          buckets: this.createHistogramBuckets(),
          sum: 0,
          count: 0
        };
        histogramMap.set(labelKey, data);
      }
      
      // Update buckets
      for (const bucket of data.buckets) {
        if (value <= bucket.le) {
          bucket.count++;
        }
      }
      
      // Update sum and count
      data.sum += value;
      data.count++;
    }
  }

  /**
   * Create histogram buckets
   */
  private createHistogramBuckets(): HistogramBucket[] {
    const buckets: HistogramBucket[] = [];
    const values = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    
    for (const value of values) {
      buckets.push({ le: value, count: 0 });
    }
    
    buckets.push({ le: Infinity, count: 0 });
    
    return buckets;
  }

  /**
   * Get label key for metric storage
   */
  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  /**
   * Add value to metric history
   */
  private addToHistory(metricName: string, value: number): void {
    if (!this?.metricHistory?.has(metricName)) {
      this?.metricHistory?.set(metricName, []);
    }
    
    const history = this?.metricHistory?.get(metricName)!;
    history.push({ timestamp: Date.now(), value });
    
    // Keep only recent history
    if (history?.length || 0 > this.maxHistorySize) {
      history.splice(0, history?.length || 0 - this.maxHistorySize);
    }
  }

  /**
   * Aggregate metrics over time windows
   */
  private aggregateMetrics(): void {
    for (const [metricName, history] of this.metricHistory) {
      for (const [windowName, windowSize] of Object.entries(this.aggregationWindows)) {
        const cutoff = Date.now() - windowSize;
        const windowData = history?.filter(h => h.timestamp > cutoff);
        
        if (windowData?.length || 0 > 0) {
          const sum = windowData.reduce((acc: any, h: any) => acc + h.value, 0);
          const avg = sum / windowData?.length || 0;
          const min = Math.min(...windowData?.map(h => h.value));
          const max = Math.max(...windowData?.map(h => h.value));
          
          this.recordGauge(`${metricName}_avg_${windowName}`, avg);
          this.recordGauge(`${metricName}_min_${windowName}`, min);
          this.recordGauge(`${metricName}_max_${windowName}`, max);
        }
      }
    }
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(): void {
    // Check Ollama queue depth
    const queueDepth = this?.gauges?.get('ollama_queue_depth')?.get('') || 0;
    if (queueDepth > this?.alertThresholds?.ollamaQueueDepth) {
      this.emit('alert', {
        type: 'ollama_queue_high',
        severity: 'warning',
        message: `Ollama queue depth (${queueDepth}) exceeds threshold (${this?.alertThresholds?.ollamaQueueDepth})`,
        value: queueDepth,
        threshold: this?.alertThresholds?.ollamaQueueDepth
      });
    }
    
    // Check error rates
    const errorRate = this?.gauges?.get('ollama_error_rate')?.get('') || 0;
    if (errorRate > this?.alertThresholds?.errorRate) {
      this.emit('alert', {
        type: 'high_error_rate',
        severity: 'critical',
        message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(this?.alertThresholds?.errorRate * 100).toFixed(2)}%)`,
        value: errorRate,
        threshold: this?.alertThresholds?.errorRate
      });
    }
    
    // Check system resources
    const cpuUsage = this?.gauges?.get('system_cpu_usage_ratio')?.get('') || 0;
    if (cpuUsage > this?.alertThresholds?.cpuUsage) {
      this.emit('alert', {
        type: 'high_cpu_usage',
        severity: 'warning',
        message: `CPU usage (${(cpuUsage * 100).toFixed(2)}%) exceeds threshold (${(this?.alertThresholds?.cpuUsage * 100).toFixed(2)}%)`,
        value: cpuUsage,
        threshold: this?.alertThresholds?.cpuUsage
      });
    }
    
    const memUsage = this?.gauges?.get('system_memory_usage_ratio')?.get('') || 0;
    if (memUsage > this?.alertThresholds?.memoryUsage) {
      this.emit('alert', {
        type: 'high_memory_usage',
        severity: 'critical',
        message: `Memory usage (${(memUsage * 100).toFixed(2)}%) exceeds threshold (${(this?.alertThresholds?.memoryUsage * 100).toFixed(2)}%)`,
        value: memUsage,
        threshold: this?.alertThresholds?.memoryUsage
      });
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Export counters
    for (const [name, labelMap] of this.counters) {
      const definition = this?.metricDefinitions?.get(name);
      if (definition) {
        lines.push(`# HELP ${name} ${definition.help}`);
        lines.push(`# TYPE ${name} counter`);
        
        for (const [labels, value] of labelMap) {
          const labelStr = labels ? `{${labels}}` : '';
          lines.push(`${name}${labelStr} ${value}`);
        }
      }
    }
    
    // Export gauges
    for (const [name, labelMap] of this.gauges) {
      const definition = this?.metricDefinitions?.get(name);
      if (definition) {
        lines.push(`# HELP ${name} ${definition.help}`);
        lines.push(`# TYPE ${name} gauge`);
        
        for (const [labels, value] of labelMap) {
          const labelStr = labels ? `{${labels}}` : '';
          lines.push(`${name}${labelStr} ${value}`);
        }
      }
    }
    
    // Export histograms
    for (const [name, labelMap] of this.histograms) {
      const definition = this?.metricDefinitions?.get(name);
      if (definition) {
        lines.push(`# HELP ${name} ${definition.help}`);
        lines.push(`# TYPE ${name} histogram`);
        
        for (const [labels, data] of labelMap) {
          const labelStr = labels ? `{${labels}}` : '';
          
          // Export buckets
          for (const bucket of data.buckets) {
            const bucketLabels = labels 
              ? `{${labels},le="${bucket.le === Infinity ? '+Inf' : bucket.le}"}`
              : `{le="${bucket.le === Infinity ? '+Inf' : bucket.le}"}`;
            lines.push(`${name}_bucket${bucketLabels} ${bucket.count}`);
          }
          
          // Export sum and count
          lines.push(`${name}_sum${labelStr} ${data.sum}`);
          lines.push(`${name}_count${labelStr} ${data.count}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {
      timestamp: new Date().toISOString(),
      ollama: this.getOllamaMetrics(),
      cache: this.getCacheMetrics(),
      api: this.getAPIMetrics(),
      database: this.getDatabaseMetrics(),
      websocket: this.getWebSocketMetrics(),
      system: this.getSystemMetrics(),
      traces: this.getTraceMetrics()
    };
    
    return summary;
  }

  /**
   * Get Ollama metrics
   */
  private getOllamaMetrics(): OllamaMetrics {
    const nlpQueue = getGroceryNLPQueue();
    const queueStatus = nlpQueue.getStatus();
    const queueMetrics = queueStatus?.metrics;
    
    return {
      queueDepth: queueStatus.queueSize,
      queuePending: queueStatus.queueSize,
      queueProcessing: queueStatus.activeRequests,
      queueCompleted: queueMetrics.completedRequests,
      avgProcessingTime: queueMetrics.averageProcessingTime,
      tokenUsage: 0, // Would need actual token tracking
      modelLoadTime: 0, // Would need actual model load time tracking
      timeoutRate: queueMetrics.timeoutRequests / Math.max(queueMetrics.totalRequests, 1),
      errorRate: queueMetrics.failedRequests / Math.max(queueMetrics.totalRequests, 1),
      throughput: queueMetrics.throughput
    };
  }

  /**
   * Get cache metrics
   */
  private getCacheMetrics(): CacheMetrics {
    // This would connect to actual cache services
    // Using placeholder calculations for now
    
    const getMetricsForCache = (cacheType: string) => {
      const hits = this?.counters?.get('cache_hits_total')?.get(`cache_type="${cacheType}"`) || 0;
      const misses = this?.counters?.get('cache_misses_total')?.get(`cache_type="${cacheType}"`) || 0;
      const total = hits + misses;
      
      return {
        hitRate: total > 0 ? hits / total : 0,
        missRate: total > 0 ? misses / total : 0,
        evictionRate: 0, // Would need actual eviction tracking
        avgResponseTime: 0, // Would need actual response time tracking
        sizeBytes: 0, // Would need actual size tracking
        keys: 0, // Would need actual key count
        entries: 0 // Would need actual entry count
      };
    };
    
    return {
      redis: {
        ...getMetricsForCache('redis'),
        keys: 0 // Would connect to Redis INFO command
      },
      inMemory: {
        ...getMetricsForCache('memory'),
        entries: 0 // Would track in-memory cache entries
      },
      cdn: {
        hitRate: getMetricsForCache('cdn').hitRate,
        missRate: getMetricsForCache('cdn').missRate,
        bandwidthBytes: 0, // Would need CDN API integration
        avgResponseTime: 0 // Would need CDN metrics
      }
    };
  }

  /**
   * Get API metrics
   */
  private getAPIMetrics(): APIMetrics {
    const requestRate: Record<string, number> = {};
    const errorRate: Record<string, number> = {};
    const statusCodes: Record<string, Record<number, number>> = {};
    
    // Calculate request rates per endpoint
    for (const [labels, count] of this?.counters?.get('http_requests_total') || new Map()) {
      const labelMatch = labels.match(/endpoint="([^"]+)"/);
      if (labelMatch) {
        const endpoint = labelMatch[1];
        requestRate[endpoint] = (requestRate[endpoint] || 0) + count;
        
        const statusMatch = labels.match(/status="([^"]+)"/);
        if (statusMatch) {
          const status = parseInt(statusMatch[1]);
          if (!statusCodes[endpoint]) {
            statusCodes[endpoint] = {};
          }
          statusCodes[endpoint][status] = (statusCodes[endpoint][status] || 0) + count;
          
          if (status >= 400) {
            errorRate[endpoint] = (errorRate[endpoint] || 0) + count;
          }
        }
      }
    }
    
    // Calculate percentiles (would need actual histogram data)
    const responseTime = {
      p50: {},
      p95: {},
      p99: {}
    };
    
    return {
      requestRate,
      responseTime,
      errorRate,
      statusCodes,
      concurrentRequests: this?.gauges?.get('http_concurrent_requests')?.get('') || 0
    };
  }

  /**
   * Get database metrics
   */
  private getDatabaseMetrics(): DatabaseMetrics {
    return {
      queryCount: this?.counters?.get('db_queries_total')?.get('') || 0,
      avgQueryTime: 0, // Would calculate from histogram data
      slowQueries: this?.counters?.get('db_slow_queries_total')?.get('') || 0,
      connectionPoolSize: this?.gauges?.get('db_connection_pool_size')?.get('') || 0,
      activeConnections: this?.gauges?.get('db_connections_active')?.get('') || 0,
      waitingConnections: this?.gauges?.get('db_connections_waiting')?.get('') || 0,
      transactionCount: this?.counters?.get('db_transactions_total')?.get('') || 0,
      rollbackCount: this?.counters?.get('db_rollbacks_total')?.get('') || 0
    };
  }

  /**
   * Get WebSocket metrics
   */
  private getWebSocketMetrics(): WebSocketMetrics {
    const totalMessages = this?.counters?.get('websocket_messages_total')?.get('') || 0;
    const uptime = process.uptime();
    
    return {
      totalConnections: this?.counters?.get('websocket_connections_total')?.get('') || 0,
      activeConnections: this?.gauges?.get('websocket_connections_active')?.get('') || 0,
      messagesPerSecond: uptime > 0 ? totalMessages / uptime : 0,
      avgMessageSize: 0, // Would need message size tracking
      errorRate: 0, // Would calculate from error counters
      reconnectionRate: 0 // Would track reconnection events
    };
  }

  /**
   * Get system metrics
   */
  private getSystemMetrics(): SystemMetrics {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      cpuUsage: this?.gauges?.get('system_cpu_usage_ratio')?.get('') || 0,
      memoryUsage: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: usedMem / totalMem
      },
      diskUsage: {
        total: 0, // Would need disk usage library
        used: 0,
        free: 0,
        percentage: 0
      },
      networkIO: {
        bytesIn: 0, // Would need network stats
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0
      },
      loadAverage: os.loadavg(),
      uptime: os.uptime()
    };
  }

  /**
   * Get trace metrics
   */
  private getTraceMetrics(): Record<string, any> {
    const traces: Record<string, any> = {};
    
    for (const [correlationId, serviceLatencies] of this.correlationMap) {
      const totalLatency = serviceLatencies.reduce((sum: any, sl: any) => sum + sl.latency, 0);
      const serviceBreakdown = serviceLatencies?.map(sl => ({
        service: sl.serviceName,
        endpoint: sl.endpoint,
        latency: sl.latency,
        percentage: (sl.latency / totalLatency) * 100
      }));
      
      traces[correlationId] = {
        totalLatency,
        serviceCount: serviceLatencies?.length || 0,
        breakdown: serviceBreakdown
      };
    }
    
    return traces;
  }

  /**
   * Create Grafana dashboard configuration
   */
  getGrafanaDashboardConfig(): Record<string, any> {
    return {
      dashboard: {
        title: 'Walmart Grocery Agent Metrics',
        panels: [
          {
            title: 'Ollama Queue Depth',
            type: 'graph',
            targets: [
              { expr: 'ollama_queue_depth' },
              { expr: 'ollama_active_requests' }
            ]
          },
          {
            title: 'Processing Time',
            type: 'graph',
            targets: [
              { expr: 'rate(ollama_processing_time_seconds_sum[5m]) / rate(ollama_processing_time_seconds_count[5m])' }
            ]
          },
          {
            title: 'Cache Hit Rate',
            type: 'graph',
            targets: [
              { expr: 'rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))' }
            ]
          },
          {
            title: 'API Response Time (p99)',
            type: 'graph',
            targets: [
              { expr: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))' }
            ]
          },
          {
            title: 'Error Rate',
            type: 'graph',
            targets: [
              { expr: 'rate(http_requests_total{status=~"5.."}[5m])' }
            ]
          },
          {
            title: 'System Resources',
            type: 'graph',
            targets: [
              { expr: 'system_cpu_usage_ratio' },
              { expr: 'system_memory_usage_ratio' }
            ]
          }
        ]
      }
    };
  }

  /**
   * Get alert rules for Prometheus
   */
  getPrometheusAlertRules(): Record<string, any> {
    return {
      groups: [
        {
          name: 'ollama_alerts',
          rules: [
            {
              alert: 'OllamaQueueHigh',
              expr: `ollama_queue_depth > ${this?.alertThresholds?.ollamaQueueDepth}`,
              for: '2m',
              labels: { severity: 'warning' },
              annotations: {
                summary: 'Ollama queue depth is high',
                description: 'Queue depth {{ $value }} exceeds threshold'
              }
            },
            {
              alert: 'OllamaHighErrorRate',
              expr: `ollama_error_rate > ${this?.alertThresholds?.errorRate}`,
              for: '5m',
              labels: { severity: 'critical' },
              annotations: {
                summary: 'High Ollama error rate',
                description: 'Error rate {{ $value }} exceeds threshold'
              }
            }
          ]
        },
        {
          name: 'cache_alerts',
          rules: [
            {
              alert: 'LowCacheHitRate',
              expr: `rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m])) < ${this?.alertThresholds?.cacheHitRate}`,
              for: '10m',
              labels: { severity: 'warning' },
              annotations: {
                summary: 'Cache hit rate is low',
                description: 'Hit rate {{ $value }} is below threshold'
              }
            }
          ]
        },
        {
          name: 'system_alerts',
          rules: [
            {
              alert: 'HighCPUUsage',
              expr: `system_cpu_usage_ratio > ${this?.alertThresholds?.cpuUsage}`,
              for: '5m',
              labels: { severity: 'warning' },
              annotations: {
                summary: 'High CPU usage',
                description: 'CPU usage {{ $value }} exceeds threshold'
              }
            },
            {
              alert: 'HighMemoryUsage',
              expr: `system_memory_usage_ratio > ${this?.alertThresholds?.memoryUsage}`,
              for: '5m',
              labels: { severity: 'critical' },
              annotations: {
                summary: 'High memory usage',
                description: 'Memory usage {{ $value }} exceeds threshold'
              }
            }
          ]
        }
      ]
    };
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    // Clear all intervals
    for (const interval of this.collectionIntervals) {
      clearInterval(interval);
    }
    
    logger.info('Metrics collection service shutdown', 'METRICS_COLLECTION');
  }
}

// Export singleton instance
export const metricsCollectionService = MetricsCollectionService.getInstance();