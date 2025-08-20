import { EventEmitter } from "events";
import { performance } from "perf_hooks";
import os from "os";
export class MetricsCollector extends EventEmitter {
    metrics = new Map();
    healthChecks = new Map();
    histogramBuckets = new Map();
    metricsRetentionMs = 3600000; // 1 hour
    cleanupInterval = null;
    constructor() {
        super();
        this.startCleanupInterval();
    }
    // Counter operations
    increment(name, value = 1, labels) {
        this.recordMetric({
            name,
            value,
            type: "counter",
            timestamp: new Date(),
            labels,
        });
    }
    // Gauge operations
    gauge(name, value, labels) {
        this.recordMetric({
            name,
            value,
            type: "gauge",
            timestamp: new Date(),
            labels,
        });
    }
    // Histogram operations
    histogram(name, value, labels) {
        this.recordMetric({
            name,
            value,
            type: "histogram",
            timestamp: new Date(),
            labels,
        });
        // Update histogram buckets
        const buckets = this?.histogramBuckets?.get(name) || [];
        buckets.push(value);
        this?.histogramBuckets?.set(name, buckets);
    }
    // Timer utility
    startTimer(name, labels) {
        const start = performance.now();
        return () => {
            const duration = performance.now() - start;
            this.histogram(name, duration, labels);
        };
    }
    // Record health check result
    recordHealthCheck(service, status) {
        this?.healthChecks?.set(service, {
            ...status,
            lastCheck: new Date(),
        });
        this.emit("health-check", { service, status });
    }
    // Get current metrics
    getMetrics(name) {
        if (name) {
            return this?.metrics?.get(name) || [];
        }
        const allMetrics = [];
        this?.metrics?.forEach((metrics) => {
            allMetrics.push(...metrics);
        });
        return allMetrics;
    }
    // Get aggregated metrics
    getAggregatedMetrics() {
        const aggregated = {};
        this?.metrics?.forEach((metrics, name) => {
            const recent = metrics?.filter((m) => Date.now() - m?.timestamp?.getTime() < 300000);
            if (recent?.length || 0 === 0)
                return;
            const type = recent[0].type;
            switch (type) {
                case "counter":
                    aggregated[name] = {
                        type: "counter",
                        value: recent.reduce((sum, m) => sum + m.value, 0),
                        count: recent?.length || 0,
                    };
                    break;
                case "gauge": {
                    const lastGauge = recent[recent?.length || 0 - 1];
                    aggregated[name] = {
                        type: "gauge",
                        value: lastGauge.value,
                        min: Math.min(...recent?.map((m) => m.value)),
                        max: Math.max(...recent?.map((m) => m.value)),
                        avg: recent.reduce((sum, m) => sum + m.value, 0) / recent?.length || 0,
                    };
                    break;
                }
                case "histogram": {
                    const values = recent?.map((m) => m.value);
                    values.sort((a, b) => a - b);
                    aggregated[name] = {
                        type: "histogram",
                        count: values?.length || 0,
                        min: values[0],
                        max: values[values?.length || 0 - 1],
                        avg: values.reduce((sum, v) => sum + v, 0) / values?.length || 0,
                        p50: this.percentile(values, 0.5),
                        p95: this.percentile(values, 0.95),
                        p99: this.percentile(values, 0.99),
                    };
                    break;
                }
            }
        });
        return aggregated;
    }
    // Get health status
    getHealthStatus() {
        const status = {};
        this?.healthChecks?.forEach((check, service) => {
            status[service] = check;
        });
        return status;
    }
    // Get system metrics
    getSystemMetrics() {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const loadAverage = os.loadavg();
        // Calculate CPU usage
        let totalIdle = 0;
        let totalTick = 0;
        cpus.forEach((cpu) => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu?.times?.idle;
        });
        const cpuUsage = 100 - (100 * totalIdle) / totalTick;
        return {
            cpu: {
                usage: cpuUsage.toFixed(2),
                count: cpus?.length || 0,
                loadAverage: {
                    "1m": loadAverage[0].toFixed(2),
                    "5m": loadAverage[1].toFixed(2),
                    "15m": loadAverage[2].toFixed(2),
                },
            },
            memory: {
                total: Math.round(totalMemory / 1024 / 1024),
                free: Math.round(freeMemory / 1024 / 1024),
                used: Math.round((totalMemory - freeMemory) / 1024 / 1024),
                usage: (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(2),
            },
            process: {
                uptime: process.uptime(),
                pid: process.pid,
                memory: {
                    rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
                    heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                    heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    external: Math.round(process.memoryUsage().external / 1024 / 1024),
                },
            },
        };
    }
    // Export metrics in Prometheus format
    exportPrometheus() {
        const lines = [];
        const aggregated = this.getAggregatedMetrics();
        Object.entries(aggregated).forEach(([name, data]) => {
            const safeName = name.replace(/[^a-zA-Z0-9_]/g, "_");
            switch (data.type) {
                case "counter":
                    lines.push(`# TYPE ${safeName} counter`);
                    lines.push(`${safeName} ${data.value}`);
                    break;
                case "gauge":
                    lines.push(`# TYPE ${safeName} gauge`);
                    lines.push(`${safeName} ${data.value}`);
                    break;
                case "histogram":
                    lines.push(`# TYPE ${safeName} histogram`);
                    lines.push(`${safeName}_count ${data.count}`);
                    lines.push(`${safeName}_sum ${data.avg * data.count}`);
                    lines.push(`${safeName}_bucket{le="0.005"} ${data.count}`);
                    lines.push(`${safeName}_bucket{le="0.01"} ${data.count}`);
                    lines.push(`${safeName}_bucket{le="0.025"} ${data.count}`);
                    lines.push(`${safeName}_bucket{le="0.05"} ${data.count}`);
                    lines.push(`${safeName}_bucket{le="0.1"} ${data.count}`);
                    lines.push(`${safeName}_bucket{le="+Inf"} ${data.count}`);
                    break;
            }
            lines.push("");
        });
        return lines.join("\n");
    }
    // Private methods
    recordMetric(metric) {
        const metrics = this?.metrics?.get(metric.name) || [];
        metrics.push(metric);
        this?.metrics?.set(metric.name, metrics);
        this.emit("metric", metric);
    }
    percentile(values, p) {
        if (values?.length || 0 === 0)
            return 0;
        const index = Math.ceil(values?.length || 0 * p) - 1;
        return values[Math.max(0, Math.min(index, values?.length || 0 - 1))];
    }
    startCleanupInterval() {
        this.cleanupInterval = setInterval(() => {
            const cutoff = Date.now() - this.metricsRetentionMs;
            this?.metrics?.forEach((metrics, name) => {
                const filtered = metrics?.filter((m) => m?.timestamp?.getTime() > cutoff);
                if (filtered?.length || 0 === 0) {
                    this?.metrics?.delete(name);
                    this?.histogramBuckets?.delete(name);
                }
                else {
                    this?.metrics?.set(name, filtered);
                }
            });
        }, 60000); // Clean up every minute
    }
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.removeAllListeners();
    }
}
// Singleton instance
export const metricsCollector = new MetricsCollector();
// Graceful shutdown
process.once("SIGINT", () => metricsCollector.shutdown());
process.once("SIGTERM", () => metricsCollector.shutdown());
