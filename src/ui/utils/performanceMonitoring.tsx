import React from 'react';
import { onCLS, onINP, onFCP, onLCP, onTTFB } from 'web-vitals';

// Interface for Core Web Vitals metrics
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType?: string;
}

// Performance thresholds based on Google's Core Web Vitals
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 }, // Replaced FID with INP
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 }
};

// Get rating based on thresholds
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// Store metrics for reporting
let metricsData: WebVitalsMetric[] = [];

// Metric handler function
function handleMetric(metric: any) {
  const webVitalMetric: WebVitalsMetric = {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType
  };

  metricsData.push(webVitalMetric);

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${metric.name}:`, {
      value: metric.value,
      rating: webVitalMetric.rating,
      threshold: THRESHOLDS[metric.name as keyof typeof THRESHOLDS]
    });
  }

  // Send to analytics if configured
  sendToAnalytics(webVitalMetric);
}

// Initialize performance monitoring
export function initPerformanceMonitoring() {
  try {
    // Core Web Vitals
    onCLS(handleMetric);
    onINP(handleMetric); // Replaced FID with INP (Interaction to Next Paint)
    onLCP(handleMetric);
    
    // Additional useful metrics
    onFCP(handleMetric);
    onTTFB(handleMetric);

  } catch (error) {
    console.warn('Performance monitoring initialization failed:', error);
  }
}

// Send metrics to analytics service
async function sendToAnalytics(metric: WebVitalsMetric) {
  try {
    // Only send in production
    if (process.env.NODE_ENV !== 'production') return;

    // Send to your analytics service
    await fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric),
      keepalive: true
    });
  } catch (error) {
    // Silently fail to not impact user experience
  }
}

// Get current metrics summary
export function getMetricsSummary() {
  const summary: Record<string, WebVitalsMetric | undefined> = {};
  
  // Get the latest metric for each type
  metricsData.forEach(metric => {
    if (!summary[metric.name] || metric.value > summary[metric.name]!.value) {
      summary[metric.name] = metric;
    }
  });

  return summary;
}

// Performance observer for additional metrics
export function observePerformance() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    // Observe long tasks (> 50ms)
    const longTaskObserver = new PerformanceObserver((list: any) => {
      list.getEntries().forEach((entry: any) => {
        if (entry.duration > 50) {
          console.warn(`[Performance] Long task detected: ${entry.duration}ms`);
        }
      });
    });
    longTaskObserver.observe({ entryTypes: ['longtask'] });

    // Observe layout shifts
    const layoutShiftObserver = new PerformanceObserver((list: any) => {
      list.getEntries().forEach((entry: any) => {
        if (entry.hadRecentInput) return; // Ignore shifts due to user input
        
        console.log(`[Performance] Layout shift: ${entry.value}`);
      });
    });
    layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });

  } catch (error) {
    console.warn('Performance observer setup failed:', error);
  }
}

// Memory usage monitoring
export function getMemoryUsage() {
  if (typeof window === 'undefined' || !('performance' in window)) {
    return null;
  }

  const memory = (performance as any).memory;
  if (!memory) return null;

  return {
    usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1048576), // MB
    totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1048576), // MB
    jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
  };
}

// Performance monitoring hook for React components
export function usePerformanceMonitoring() {
  React.useEffect(() => {
    initPerformanceMonitoring();
    observePerformance();
  }, []);

  return {
    getMetricsSummary,
    getMemoryUsage
  };
}

// Performance budget checker
export function checkPerformanceBudget() {
  const metrics = getMetricsSummary();
  const budget = {
    LCP: 2500, // ms
    FID: 100,  // ms
    CLS: 0.1,  // unitless
    bundle: 1500, // KB (target < 1.5MB)
  };

  const results = {
    passed: true,
    violations: [] as string[]
  };

  Object.entries(budget).forEach(([key, threshold]) => {
    const metric = metrics[key];
    if (metric && metric.value > threshold) {
      results.passed = false;
      results?.violations?.push(`${key}: ${metric.value} > ${threshold}`);
    }
  });

  return results;
}

// React component for performance monitoring
export const PerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = React.useState<Record<string, WebVitalsMetric | undefined>>({});
  const [memory, setMemory] = React.useState<any>(null);

  React.useEffect(() => {
    initPerformanceMonitoring();
    observePerformance();

    const interval = setInterval(() => {
      setMetrics(getMetricsSummary());
      setMemory(getMemoryUsage());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null; // Only show in development
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs max-w-xs">
      <div className="font-bold mb-2">Performance Monitor</div>
      
      {Object.entries(metrics).map(([name, metric]) => (
        <div key={name} className="flex justify-between">
          <span>{name}:</span>
          <span className={`
            ${metric?.rating === 'good' ? 'text-green-400' : 
              metric?.rating === 'needs-improvement' ? 'text-yellow-400' : 'text-red-400'}
          `}>
            {metric?.value ? `${Math.round(metric.value)}${name === 'CLS' ? '' : 'ms'}` : 'N/A'}
          </span>
        </div>
      ))}
      
      {memory && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="flex justify-between">
            <span>Memory:</span>
            <span>{memory.usedJSHeapSize}MB</span>
          </div>
        </div>
      )}
    </div>
  );
};