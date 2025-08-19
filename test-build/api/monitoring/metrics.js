/**
 * Simple metrics collection module
 */
class MetricsCollector {
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    /**
     * Increment a counter metric
     */
    increment(name, value = 1, labels) {
        const key = this.getKey(name, labels);
        const current = this?.counters?.get(key) || 0;
        this?.counters?.set(key, current + value);
    }
    /**
     * Set a gauge metric
     */
    gauge(name, value, labels) {
        const key = this.getKey(name, labels);
        this?.gauges?.set(key, value);
    }
    /**
     * Record a histogram value
     */
    histogram(name, value, labels) {
        const key = this.getKey(name, labels);
        const values = this?.histograms?.get(key) || [];
        values.push(value);
        this?.histograms?.set(key, values);
    }
    /**
     * Start a timer and return a function to end it
     */
    startTimer(name, labels) {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.histogram(name, duration, labels);
        };
    }
    /**
     * Get all metrics
     */
    getMetrics() {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: Object.fromEntries(Array.from(this?.histograms?.entries()).map(([key, values]) => [
                key,
                {
                    count: values?.length || 0,
                    min: values.length > 0 ? Math.min(...values) : 0,
                    max: values.length > 0 ? Math.max(...values) : 0,
                    avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
                    p50: this.percentile(values, 0.5),
                    p95: this.percentile(values, 0.95),
                    p99: this.percentile(values, 0.99),
                },
            ])),
        };
    }
    /**
     * Reset all metrics
     */
    reset() {
        this?.counters?.clear();
        this?.gauges?.clear();
        this?.histograms?.clear();
    }
    getKey(name, labels) {
        if (!labels || Object.keys(labels).length === 0) {
            return name;
        }
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(",");
        return `${name}{${labelStr}}`;
    }
    percentile(values, p) {
        if (!values || values.length === 0)
            return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, Math.min(index, sorted.length - 1))] || 0;
    }
}
// Singleton instance
export const metrics = new MetricsCollector();
