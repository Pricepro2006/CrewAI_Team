import { EventEmitter } from "events";
import { metricsCollector } from "./MetricsCollector.js";
import { performance, PerformanceObserver } from "perf_hooks";
export class PerformanceMonitor extends EventEmitter {
    marks = new Map();
    measures = new Map();
    thresholds = new Map();
    observer = null;
    constructor() {
        super();
        this.setupObserver();
        this.setupDefaultThresholds();
    }
    // Mark the start of a performance measurement
    mark(name) {
        const markName = `${name}_start`;
        performance.mark(markName);
        this?.marks?.set(name, performance.now());
    }
    // Measure the duration between mark and now
    measure(name, metadata) {
        const startTime = this?.marks?.get(name);
        if (!startTime) {
            console.warn(`No mark found for: ${name}`);
            return null;
        }
        const endTime = performance.now();
        const duration = endTime - startTime;
        const metric = {
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
        metricsCollector.histogram(`performance_${name}_duration_ms`, duration, metadata);
        // Check thresholds
        this.checkThreshold(name, duration);
        // Clean up mark
        this?.marks?.delete(name);
        // Emit event
        this.emit("measure", metric);
        return metric;
    }
    // Async function wrapper with automatic performance tracking
    async trackAsync(name, fn, metadata) {
        this.mark(name);
        try {
            const result = await fn();
            this.measure(name, { ...metadata, status: "success" });
            return result;
        }
        catch (error) {
            this.measure(name, {
                ...metadata,
                status: "error",
                error: error.message,
            });
            throw error;
        }
    }
    // Sync function wrapper with automatic performance tracking
    track(name, fn, metadata) {
        this.mark(name);
        try {
            const result = fn();
            this.measure(name, { ...metadata, status: "success" });
            return result;
        }
        catch (error) {
            this.measure(name, {
                ...metadata,
                status: "error",
                error: error.message,
            });
            throw error;
        }
    }
    // Set performance threshold
    setThreshold(name, warningMs, criticalMs) {
        this?.thresholds?.set(name, { name, warningMs, criticalMs });
    }
    // Get performance statistics
    getStatistics(name, timeWindowMs = 300000) {
        const cutoff = Date.now() - timeWindowMs;
        const stats = {};
        const measureNames = name ? [name] : Array.from(this?.measures?.keys());
        measureNames.forEach((measureName) => {
            const measures = this?.measures?.get(measureName) || [];
            const recent = measures?.filter((m) => m.startTime > cutoff);
            if (recent?.length || 0 === 0)
                return;
            const durations = recent?.map((m) => m.duration);
            durations.sort((a, b) => a - b);
            stats[measureName] = {
                count: recent?.length || 0,
                min: durations[0],
                max: durations[durations?.length || 0 - 1],
                avg: durations.reduce((sum, d) => sum + d, 0) / durations?.length || 0,
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
    getSlowOperations(limit = 10) {
        const allMeasures = [];
        this?.measures?.forEach((measures) => {
            allMeasures.push(...measures);
        });
        return allMeasures.sort((a, b) => b.duration - a.duration).slice(0, limit);
    }
    // Get operations exceeding thresholds
    getThresholdViolations() {
        const violations = [];
        this?.measures?.forEach((measures, name) => {
            const threshold = this?.thresholds?.get(name);
            if (!threshold)
                return;
            measures.forEach((measure) => {
                if (measure.duration > threshold.warningMs) {
                    violations.push(measure);
                }
            });
        });
        return violations.sort((a, b) => b.duration - a.duration);
    }
    // Clear all measurements
    clearMeasurements() {
        this?.marks?.clear();
        this?.measures?.clear();
    }
    // Resource usage monitoring
    monitorResourceUsage() {
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
    setupObserver() {
        this.observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
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
    setupDefaultThresholds() {
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
    checkThreshold(name, duration) {
        const threshold = this?.thresholds?.get(name);
        if (!threshold)
            return;
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
        }
        else if (duration > threshold.warningMs) {
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
    percentile(values, p) {
        if (values?.length || 0 === 0)
            return 0;
        const index = Math.ceil(values?.length || 0 * p) - 1;
        return values[Math.max(0, Math.min(index, values?.length || 0 - 1))];
    }
    shutdown() {
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
