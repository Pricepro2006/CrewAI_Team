/**
 * Email Processing Performance Monitor
 *
 * Real-time monitoring and analytics for the optimized email processing pipeline.
 * Tracks performance metrics, identifies bottlenecks, and provides insights.
 */

import { EventEmitter } from "events";
import chalk from "chalk";
import { Logger } from "../../utils/logger.js";
import type {
  PoolMetrics,
  WorkerMetrics,
} from "../workers/EmailProcessingWorkerPool.js";
import type { QueueMetrics } from "../services/EmailProcessingQueueService.js";

const logger = Logger.getInstance("EmailProcessingMonitor");

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PerformanceMetrics {
  timestamp: Date;
  throughput: {
    current: number; // emails/minute
    average: number;
    peak: number;
  };
  latency: {
    p50: number; // milliseconds
    p95: number;
    p99: number;
    average: number;
  };
  queues: {
    phase1: QueueMetrics;
    phase2: QueueMetrics;
    phase3: QueueMetrics;
  };
  workers: {
    pool: PoolMetrics;
    instances: WorkerMetrics[];
  };
  system: {
    cpuUsage: number; // percentage
    memoryUsage: number; // MB
    diskIO: number; // MB/s
  };
  errors: {
    rate: number; // percentage
    types: Map<string, number>;
    recent: ErrorInfo[];
  };
}

export interface ErrorInfo {
  timestamp: Date;
  phase: string;
  type: string;
  message: string;
  emailId?: string;
  jobId?: string;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: "info" | "warning" | "critical";
  type: string;
  message: string;
  metrics?: any;
}

export interface MonitorConfig {
  sampleInterval: number; // milliseconds
  historySize: number; // number of samples to keep
  alertThresholds: {
    throughputMin: number; // emails/minute
    latencyMax: number; // milliseconds
    errorRateMax: number; // percentage
    queueDepthMax: number;
    memoryUsageMax: number; // MB
    cpuUsageMax: number; // percentage
  };
  dashboardUpdateInterval: number; // milliseconds
  enableDashboard: boolean;
  enableAlerts: boolean;
  enableLogging: boolean;
}

// ============================================
// MONITOR IMPLEMENTATION
// ============================================

export class EmailProcessingMonitor extends EventEmitter {
  private config: MonitorConfig;
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private sampleInterval?: NodeJS.Timeout;
  private dashboardInterval?: NodeJS.Timeout;
  private startTime = Date.now();
  private totalProcessed = 0;
  private totalErrors = 0;
  private latencySamples: number[] = [];
  private throughputSamples: number[] = [];
  private errorTypes = new Map<string, number>();

  constructor(config: Partial<MonitorConfig> = {}) {
    super();
    this.config = {
      sampleInterval: 5000, // 5 seconds
      historySize: 120, // 10 minutes of 5-second samples
      alertThresholds: {
        throughputMin: 10, // emails/minute
        latencyMax: 10000, // 10 seconds
        errorRateMax: 5, // 5%
        queueDepthMax: 1000,
        memoryUsageMax: 1024, // 1GB
        cpuUsageMax: 80, // 80%
      },
      dashboardUpdateInterval: 2000, // 2 seconds
      enableDashboard: true,
      enableAlerts: true,
      enableLogging: true,
      ...config,
    };
  }

  /**
   * Start monitoring
   */
  start(): void {
    logger.info("Starting performance monitoring...");

    // Start metrics collection
    this.sampleInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.sampleInterval);

    // Start dashboard updates
    if (this.config.enableDashboard) {
      this.dashboardInterval = setInterval(() => {
        this.updateDashboard();
      }, this.config.dashboardUpdateInterval);
    }

    this.emit("started");
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    logger.info("Stopping performance monitoring...");

    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
    }

    if (this.dashboardInterval) {
      clearInterval(this.dashboardInterval);
    }

    this.emit("stopped");
  }

  /**
   * Record job completion
   */
  recordJobCompletion(emailCount: number, processingTime: number): void {
    this.totalProcessed += emailCount;
    this.latencySamples.push(processingTime / emailCount); // Average per email

    // Keep only recent samples
    if (this.latencySamples.length > 1000) {
      this.latencySamples = this.latencySamples.slice(-1000);
    }
  }

  /**
   * Record job error
   */
  recordJobError(
    phase: string,
    errorType: string,
    message: string,
    jobId?: string,
  ): void {
    this.totalErrors++;

    // Track error types
    const currentCount = this.errorTypes.get(errorType) || 0;
    this.errorTypes.set(errorType, currentCount + 1);

    // Add to recent errors
    const errorInfo: ErrorInfo = {
      timestamp: new Date(),
      phase,
      type: errorType,
      message,
      jobId,
    };

    const currentMetrics = this.getCurrentMetrics();
    if (currentMetrics) {
      currentMetrics.errors.recent.push(errorInfo);

      // Keep only last 100 errors
      if (currentMetrics.errors.recent.length > 100) {
        currentMetrics.errors.recent = currentMetrics.errors.recent.slice(-100);
      }
    }

    // Check if we need to raise an alert
    this.checkErrorRate();
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics(
    phase: "phase1" | "phase2" | "phase3",
    metrics: QueueMetrics,
  ): void {
    const currentMetrics = this.getCurrentMetrics();
    if (currentMetrics) {
      currentMetrics.queues[phase] = metrics;
    }
  }

  /**
   * Update worker metrics
   */
  updateWorkerMetrics(
    poolMetrics: PoolMetrics,
    workerMetrics: WorkerMetrics[],
  ): void {
    const currentMetrics = this.getCurrentMetrics();
    if (currentMetrics) {
      currentMetrics.workers.pool = poolMetrics;
      currentMetrics.workers.instances = workerMetrics;
    }

    // Update throughput samples
    this.throughputSamples.push(poolMetrics.throughput);
    if (this.throughputSamples.length > 100) {
      this.throughputSamples = this.throughputSamples.slice(-100);
    }
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(cpu: number, memory: number, diskIO: number): void {
    const currentMetrics = this.getCurrentMetrics();
    if (currentMetrics) {
      currentMetrics.system = {
        cpuUsage: cpu,
        memoryUsage: memory,
        diskIO,
      };
    }

    // Check system resource alerts
    this.checkSystemResources(cpu, memory);
  }

  /**
   * Get current performance summary
   */
  getPerformanceSummary(): {
    uptime: string;
    totalProcessed: number;
    currentThroughput: number;
    averageThroughput: number;
    peakThroughput: number;
    averageLatency: number;
    errorRate: number;
    activeAlerts: number;
  } {
    const uptimeMs = Date.now() - this.startTime;
    const uptimeMinutes = uptimeMs / 60000;

    const currentMetrics = this.getCurrentMetrics();
    const currentThroughput = currentMetrics?.throughput.current || 0;
    const averageThroughput = this.totalProcessed / uptimeMinutes;
    const peakThroughput = Math.max(...this.throughputSamples, 0);
    const averageLatency = this.calculateAverage(this.latencySamples);
    const errorRate =
      this.totalProcessed > 0
        ? (this.totalErrors / this.totalProcessed) * 100
        : 0;

    return {
      uptime: this.formatUptime(uptimeMs),
      totalProcessed: this.totalProcessed,
      currentThroughput,
      averageThroughput,
      peakThroughput,
      averageLatency,
      errorRate,
      activeAlerts: this.alerts.filter((a) => a.severity !== "info").length,
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): string {
    const summary = this.getPerformanceSummary();
    const currentMetrics = this.getCurrentMetrics();

    let report = chalk.cyan("\n📊 Email Processing Performance Report\n\n");

    // Summary
    report += chalk.bold("Summary:\n");
    report += `  Uptime: ${summary.uptime}\n`;
    report += `  Total Processed: ${summary.totalProcessed.toLocaleString()} emails\n`;
    report += `  Error Rate: ${summary.errorRate.toFixed(2)}%\n\n`;

    // Throughput
    report += chalk.bold("Throughput:\n");
    report += `  Current: ${summary.currentThroughput.toFixed(1)} emails/min\n`;
    report += `  Average: ${summary.averageThroughput.toFixed(1)} emails/min\n`;
    report += `  Peak: ${summary.peakThroughput.toFixed(1)} emails/min\n\n`;

    // Latency
    report += chalk.bold("Latency:\n");
    report += `  Average: ${summary.averageLatency.toFixed(0)}ms per email\n`;
    if (currentMetrics) {
      report += `  P50: ${currentMetrics.latency.p50.toFixed(0)}ms\n`;
      report += `  P95: ${currentMetrics.latency.p95.toFixed(0)}ms\n`;
      report += `  P99: ${currentMetrics.latency.p99.toFixed(0)}ms\n`;
    }
    report += "\n";

    // Queue Status
    if (currentMetrics) {
      report += chalk.bold("Queue Status:\n");
      for (const [phase, metrics] of Object.entries(currentMetrics.queues)) {
        report += `  ${phase}: ${metrics.active} active, ${metrics.waiting} waiting`;
        if (metrics.failed > 0) {
          report += chalk.red(` (${metrics.failed} failed)`);
        }
        report += "\n";
      }
      report += "\n";

      // Worker Status
      report += chalk.bold("Worker Status:\n");
      report += `  Active: ${currentMetrics.workers.pool.activeWorkers}\n`;
      report += `  Idle: ${currentMetrics.workers.pool.idleWorkers}\n`;
      report += `  Total: ${currentMetrics.workers.pool.activeWorkers + currentMetrics.workers.pool.idleWorkers}\n\n`;

      // System Resources
      report += chalk.bold("System Resources:\n");
      report += `  CPU: ${currentMetrics.system.cpuUsage.toFixed(1)}%\n`;
      report += `  Memory: ${currentMetrics.system.memoryUsage.toFixed(0)}MB\n`;
      report += `  Disk I/O: ${currentMetrics.system.diskIO.toFixed(1)}MB/s\n\n`;
    }

    // Active Alerts
    const activeAlerts = this.alerts.filter((a) => a.severity !== "info");
    if (activeAlerts.length > 0) {
      report += chalk.bold("Active Alerts:\n");
      activeAlerts.forEach((alert) => {
        const color = alert.severity === "critical" ? chalk.red : chalk.yellow;
        report += color(
          `  [${alert.severity.toUpperCase()}] ${alert.message}\n`,
        );
      });
      report += "\n";
    }

    // Top Errors
    if (this.errorTypes.size > 0) {
      report += chalk.bold("Top Error Types:\n");
      const sortedErrors = Array.from(this.errorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      sortedErrors.forEach(([type, count]) => {
        report += `  ${type}: ${count} occurrences\n`;
      });
    }

    return report;
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    const timestamp = new Date();

    // Calculate current metrics
    const throughput = this.calculateThroughput();
    const latency = this.calculateLatency();
    const errorRate = this.calculateErrorRate();

    const metrics: PerformanceMetrics = {
      timestamp,
      throughput: {
        current: throughput.current,
        average: throughput.average,
        peak: throughput.peak,
      },
      latency: {
        p50: latency.p50,
        p95: latency.p95,
        p99: latency.p99,
        average: latency.average,
      },
      queues: {
        phase1: this.createEmptyQueueMetrics("phase1"),
        phase2: this.createEmptyQueueMetrics("phase2"),
        phase3: this.createEmptyQueueMetrics("phase3"),
      },
      workers: {
        pool: this.createEmptyPoolMetrics(),
        instances: [],
      },
      system: {
        cpuUsage: 0,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        diskIO: 0,
      },
      errors: {
        rate: errorRate,
        types: new Map(this.errorTypes),
        recent: [],
      },
    };

    // Add to history
    this.metrics.push(metrics);

    // Trim history
    if (this.metrics.length > this.config.historySize) {
      this.metrics = this.metrics.slice(-this.config.historySize);
    }

    // Check for alerts
    if (this.config.enableAlerts) {
      this.checkAlerts(metrics);
    }

    // Emit metrics event
    this.emit("metrics", metrics);
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughput(): {
    current: number;
    average: number;
    peak: number;
  } {
    if (this.throughputSamples.length === 0) {
      return { current: 0, average: 0, peak: 0 };
    }

    const current =
      this.throughputSamples[this.throughputSamples.length - 1] || 0;
    const average = this.calculateAverage(this.throughputSamples);
    const peak = Math.max(...this.throughputSamples);

    return { current, average, peak };
  }

  /**
   * Calculate latency metrics
   */
  private calculateLatency(): {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  } {
    if (this.latencySamples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, average: 0 };
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const p50 = this.calculatePercentile(sorted, 50);
    const p95 = this.calculatePercentile(sorted, 95);
    const p99 = this.calculatePercentile(sorted, 99);
    const average = this.calculateAverage(this.latencySamples);

    return { p50, p95, p99, average };
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    if (this.totalProcessed === 0) return 0;
    return (this.totalErrors / this.totalProcessed) * 100;
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const { alertThresholds } = this.config;

    // Throughput alert
    if (metrics.throughput.current < alertThresholds.throughputMin) {
      this.addAlert(
        "warning",
        "low-throughput",
        `Throughput below threshold: ${metrics.throughput.current.toFixed(1)} emails/min`,
      );
    }

    // Latency alert
    if (metrics.latency.p95 > alertThresholds.latencyMax) {
      this.addAlert(
        "warning",
        "high-latency",
        `P95 latency above threshold: ${metrics.latency.p95.toFixed(0)}ms`,
      );
    }

    // Error rate alert
    if (metrics.errors.rate > alertThresholds.errorRateMax) {
      this.addAlert(
        "critical",
        "high-error-rate",
        `Error rate above threshold: ${metrics.errors.rate.toFixed(2)}%`,
      );
    }

    // Queue depth alerts
    for (const [phase, queueMetrics] of Object.entries(metrics.queues)) {
      if (queueMetrics.waiting > alertThresholds.queueDepthMax) {
        this.addAlert(
          "warning",
          "high-queue-depth",
          `${phase} queue depth above threshold: ${queueMetrics.waiting} jobs`,
        );
      }
    }
  }

  /**
   * Check error rate for alerts
   */
  private checkErrorRate(): void {
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.config.alertThresholds.errorRateMax) {
      this.addAlert(
        "critical",
        "high-error-rate",
        `Error rate exceeds threshold: ${errorRate.toFixed(2)}%`,
      );
    }
  }

  /**
   * Check system resources for alerts
   */
  private checkSystemResources(cpu: number, memory: number): void {
    if (cpu > this.config.alertThresholds.cpuUsageMax) {
      this.addAlert(
        "warning",
        "high-cpu",
        `CPU usage above threshold: ${cpu.toFixed(1)}%`,
      );
    }

    if (memory > this.config.alertThresholds.memoryUsageMax) {
      this.addAlert(
        "warning",
        "high-memory",
        `Memory usage above threshold: ${memory.toFixed(0)}MB`,
      );
    }
  }

  /**
   * Add alert
   */
  private addAlert(
    severity: PerformanceAlert["severity"],
    type: string,
    message: string,
  ): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      type,
      message,
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log alert
    if (this.config.enableLogging) {
      const logFn =
        severity === "critical"
          ? logger.error
          : severity === "warning"
            ? logger.warn
            : logger.info;
      logFn(`[ALERT] ${message}`);
    }

    // Emit alert event
    this.emit("alert", alert);
  }

  /**
   * Update dashboard display
   */
  private updateDashboard(): void {
    if (!process.stdout.isTTY) return;

    const summary = this.getPerformanceSummary();
    const currentMetrics = this.getCurrentMetrics();

    // Clear screen and move cursor to top
    console.clear();

    // Header
    console.log(chalk.cyan.bold("\n📊 Email Processing Monitor\n"));

    // Status bar
    const statusColor = summary.activeAlerts > 0 ? chalk.red : chalk.green;
    console.log(
      statusColor(
        `Status: ${summary.activeAlerts > 0 ? "ALERTS ACTIVE" : "HEALTHY"}`,
      ),
    );
    console.log(chalk.gray(`Uptime: ${summary.uptime}\n`));

    // Throughput gauge
    const throughputPercent = Math.min(
      100,
      (summary.currentThroughput / 100) * 100,
    );
    this.drawGauge(
      "Throughput",
      throughputPercent,
      `${summary.currentThroughput.toFixed(1)} emails/min`,
    );

    // Processing stats
    console.log(chalk.bold("\nProcessing:"));
    console.log(`  Total: ${summary.totalProcessed.toLocaleString()} emails`);
    console.log(
      `  Average: ${summary.averageThroughput.toFixed(1)} emails/min`,
    );
    console.log(`  Peak: ${summary.peakThroughput.toFixed(1)} emails/min`);

    // Latency stats
    console.log(chalk.bold("\nLatency:"));
    console.log(`  Average: ${summary.averageLatency.toFixed(0)}ms`);
    if (currentMetrics) {
      console.log(`  P95: ${currentMetrics.latency.p95.toFixed(0)}ms`);
    }

    // Queue status
    if (currentMetrics) {
      console.log(chalk.bold("\nQueues:"));
      for (const [phase, metrics] of Object.entries(currentMetrics.queues)) {
        const queueLoad = metrics.waiting + metrics.active;
        const status =
          queueLoad > 100
            ? chalk.red("HIGH")
            : queueLoad > 50
              ? chalk.yellow("MEDIUM")
              : chalk.green("LOW");
        console.log(
          `  ${phase}: ${metrics.active}/${metrics.waiting} ${status}`,
        );
      }

      // Worker status
      console.log(chalk.bold("\nWorkers:"));
      console.log(`  Active: ${currentMetrics.workers.pool.activeWorkers}`);
      console.log(`  Idle: ${currentMetrics.workers.pool.idleWorkers}`);

      // System resources
      console.log(chalk.bold("\nSystem:"));
      const cpuColor =
        currentMetrics.system.cpuUsage > 80
          ? chalk.red
          : currentMetrics.system.cpuUsage > 60
            ? chalk.yellow
            : chalk.green;
      console.log(
        `  CPU: ${cpuColor(currentMetrics.system.cpuUsage.toFixed(1) + "%")}`,
      );
      console.log(
        `  Memory: ${currentMetrics.system.memoryUsage.toFixed(0)}MB`,
      );
    }

    // Error rate
    const errorColor =
      summary.errorRate > 5
        ? chalk.red
        : summary.errorRate > 2
          ? chalk.yellow
          : chalk.green;
    console.log(chalk.bold("\nErrors:"));
    console.log(`  Rate: ${errorColor(summary.errorRate.toFixed(2) + "%")}`);

    // Active alerts
    const activeAlerts = this.alerts
      .filter((a) => a.severity !== "info")
      .slice(-3);
    if (activeAlerts.length > 0) {
      console.log(chalk.bold("\nRecent Alerts:"));
      activeAlerts.forEach((alert) => {
        const icon = alert.severity === "critical" ? "🔴" : "🟡";
        console.log(`  ${icon} ${alert.message}`);
      });
    }

    // Footer
    console.log(chalk.gray("\n[Press Ctrl+C to exit]"));
  }

  /**
   * Draw a text-based gauge
   */
  private drawGauge(label: string, percent: number, value: string): void {
    const width = 30;
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;

    const color =
      percent > 80 ? chalk.red : percent > 60 ? chalk.yellow : chalk.green;

    const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    console.log(`${label}: [${bar}] ${value}`);
  }

  /**
   * Helper methods
   */
  private getCurrentMetrics(): PerformanceMetrics | undefined {
    return this.metrics[this.metrics.length - 1];
  }

  private calculateAverage(samples: number[]): number {
    if (samples.length === 0) return 0;
    return samples.reduce((sum, val) => sum + val, 0) / samples.length;
  }

  private calculatePercentile(
    sortedSamples: number[],
    percentile: number,
  ): number {
    if (sortedSamples.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedSamples.length) - 1;
    return sortedSamples[Math.max(0, index)] || 0;
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private createEmptyQueueMetrics(queueName: string): QueueMetrics {
    return {
      queueName,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: false,
      processingRate: 0,
      averageProcessingTime: 0,
      errorRate: 0,
    };
  }

  private createEmptyPoolMetrics(): PoolMetrics {
    return {
      activeWorkers: 0,
      idleWorkers: 0,
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      queueDepth: 0,
      throughput: 0,
    };
  }
}

// ============================================
// FACTORY FUNCTION
// ============================================

export function createEmailProcessingMonitor(
  config?: Partial<MonitorConfig>,
): EmailProcessingMonitor {
  return new EmailProcessingMonitor(config);
}
