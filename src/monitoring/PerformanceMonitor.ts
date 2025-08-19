import { EventEmitter } from "events";
import { metricsCollector } from "./MetricsCollector.js";
import { performance, PerformanceObserver } from "perf_hooks";

export interface PerformanceMetric {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  name: string;
  warningMs: number;
  criticalMs: number;
}

export class PerformanceMonitor extends EventEmitter {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private observer: PerformanceObserver | null = null;

  constructor() {
    super();
    this.setupObserver();
    this.setupDefaultThresholds();
  }

  // Mark the start of a performance measurement
  mark(name: string): void {
    const markName = `${name}_start`;
    performance.mark(markName);
    this?.marks?.set(name, performance.now());
  }

  // Measure the duration between mark and now
  measure(
    name: string,
    metadata?: Record<string, any>,
  ): PerformanceMetric | null {
    const startTime = this?.marks?.get(name);
    if (!startTime) {
      console.warn(`No mark found for: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetric = {
      name,
      duration,
      startTime,
      endTime,
      metadata,
    };

    // Store measure
    const measures = this?.measures?.get(name) || [];
    measures.push(metric);
    this?.measures?.set(name, measures);

    // Record in metrics collector
    metricsCollector.histogram(
      `performance_${name}_duration_ms`,
      duration,
      metadata,
    );

    // Check thresholds
    this.checkThreshold(name, duration);

    // Clean up mark
    this?.marks?.delete(name);

    // Emit event
    this.emit("measure", metric);

    return metric;
  }

  // Async function wrapper with automatic performance tracking
  async trackAsync<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    this.mark(name);
    try {
      const result = await fn();
      this.measure(name, { ...metadata, status: "success" });
      return result;
    } catch (error) {
      this.measure(name, {
        ...metadata,
        status: "error",
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Sync function wrapper with automatic performance tracking
  track<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    this.mark(name);
    try {
      const result = fn();
      this.measure(name, { ...metadata, status: "success" });
      return result;
    } catch (error) {
      this.measure(name, {
        ...metadata,
        status: "error",
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Set performance threshold
  setThreshold(name: string, warningMs: number, criticalMs: number): void {
    this?.thresholds?.set(name, { name, warningMs, criticalMs });
  }

  // Get performance statistics
  getStatistics(
    name?: string,
    timeWindowMs: number = 300000,
  ): Record<string, any> {
    const cutoff = Date.now() - timeWindowMs;
    const stats: Record<string, any> = {};

    const measureNames = name ? [name] : Array.from(this?.measures?.keys());

    measureNames.forEach((measureName: any) => {
      const measures = this?.measures?.get(measureName) || [];
      const recent = measures?.filter((m: any) => m.startTime > cutoff);

      if (recent?.length || 0 === 0) return;

      const durations = recent?.map((m: any) => m.duration);
      durations.sort((a, b) => a - b);

      stats[measureName] = {
        count: recent?.length || 0,
        min: durations[0],
        max: durations[durations?.length || 0 - 1],
        avg: durations.reduce((sum: any, d: any) => sum + d, 0) / durations?.length || 0,
        p50: this.percentile(durations, 0.5),
        p75: this.percentile(durations, 0.75),
        p95: this.percentile(durations, 0.95),
        p99: this.percentile(durations, 0.99),
        threshold: this?.thresholds?.get(measureName),
      };
    });

    return stats;
  }

  // Get slow operations
  getSlowOperations(limit: number = 10): PerformanceMetric[] {
    const allMeasures: PerformanceMetric[] = [];

    this?.measures?.forEach((measures: any) => {
      allMeasures.push(...measures);
    });

    return allMeasures.sort((a, b) => b.duration - a.duration).slice(0, limit);
  }

  // Get operations exceeding thresholds
  getThresholdViolations(): PerformanceMetric[] {
    const violations: PerformanceMetric[] = [];

    this?.measures?.forEach((measures, name) => {
      const threshold = this?.thresholds?.get(name);
      if (!threshold) return;

      measures.forEach((measure: any) => {
        if (measure.duration > threshold.warningMs) {
          violations.push(measure);
        }
      });
    });

    return violations.sort((a, b) => b.duration - a.duration);
  }

  // Clear all measurements
  clearMeasurements(): void {
    this?.marks?.clear();
    this?.measures?.clear();
  }

  // Resource usage monitoring
  monitorResourceUsage(): Record<string, any> {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics = {
      memory: {
        rss: Math.round(usage.rss / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
      },
      cpu: {
        user: cpuUsage.user / 1000,
        system: cpuUsage.system / 1000,
      },
    };

    // Record in metrics collector
    metricsCollector.gauge("memory_heap_used_mb", metrics?.memory?.heapUsed);
    metricsCollector.gauge("memory_rss_mb", metrics?.memory?.rss);
    metricsCollector.gauge("cpu_user_ms", metrics?.cpu?.user);
    metricsCollector.gauge("cpu_system_ms", metrics?.cpu?.system);

    return metrics;
  }

  // Private methods
  private setupObserver(): void {
    this.observer = new PerformanceObserver((list: any) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (entry.entryType === "measure") {
          this.emit("performance-entry", {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
          });
        }
      });
    });

    this?.observer?.observe({ entryTypes: ["measure"] });
  }

  private setupDefaultThresholds(): void {
    // API endpoints
    this.setThreshold("api_request", 100, 500);
    this.setThreshold("database_query", 50, 200);
    this.setThreshold("ollama_inference", 1000, 5000);

    // WebSocket operations
    this.setThreshold("websocket_broadcast", 10, 50);
    this.setThreshold("websocket_message", 5, 20);

    // File operations
    this.setThreshold("file_read", 20, 100);
    this.setThreshold("file_write", 50, 200);

    // Authentication
    this.setThreshold("password_hash", 100, 500);
    this.setThreshold("jwt_sign", 5, 20);
    this.setThreshold("jwt_verify", 5, 20);
  }

  private checkThreshold(name: string, duration: number): void {
    const threshold = this?.thresholds?.get(name);
    if (!threshold) return;

    if (duration > threshold.criticalMs) {
      this.emit("threshold-exceeded", {
        name,
        duration,
        threshold: threshold.criticalMs,
        severity: "critical",
      });
      metricsCollector.increment("performance_threshold_critical", 1, {
        operation: name,
      });
    } else if (duration > threshold.warningMs) {
      this.emit("threshold-exceeded", {
        name,
        duration,
        threshold: threshold.warningMs,
        severity: "warning",
      });
      metricsCollector.increment("performance_threshold_warning", 1, {
        operation: name,
      });
    }
  }

  private percentile(values: number[], p: number): number {
    if (!values?.length) return 0;
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))] || 0;
  }

  shutdown(): void {
    if (this.observer) {
      this?.observer?.disconnect();
      this.observer = null;
    }
    this.removeAllListeners();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Monitor resource usage periodically
setInterval(() => {
  performanceMonitor.monitorResourceUsage();
}, 30000); // Every 30 seconds

// Graceful shutdown
process.once("SIGINT", () => performanceMonitor.shutdown());
process.once("SIGTERM", () => performanceMonitor.shutdown());
