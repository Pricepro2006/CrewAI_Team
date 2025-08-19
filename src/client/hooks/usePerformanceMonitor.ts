import { useEffect, useRef, useCallback } from "react";

interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  props?: unknown;
}

class PerformanceTracker {
  private metrics: PerformanceMetrics[] = [];
  private observers: ((metrics: PerformanceMetrics) => void)[] = [];

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Notify observers
    this.observers.forEach(observer => observer(metric));
  }

  subscribe(observer: (metrics: PerformanceMetrics) => void) {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter(obs => obs !== observer);
    };
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageRenderTime(componentName?: string): number {
    const relevantMetrics = componentName 
      ? this.metrics?.filter((m: PerformanceMetrics) => m.componentName === componentName) || []
      : this.metrics || [];
    
    if (relevantMetrics.length === 0) return 0;
    
    const total = relevantMetrics.reduce((sum: number, metric: PerformanceMetrics) => sum + metric.renderTime, 0);
    return total / relevantMetrics.length;
  }

  getSlowComponents(threshold: number = 16): string[] {
    const componentTimes: { [key: string]: number[] } = {};
    
    this.metrics.forEach((metric: PerformanceMetrics) => {
      if (!componentTimes[metric.componentName]) {
        componentTimes[metric.componentName] = [];
      }
      componentTimes[metric.componentName].push(metric.renderTime);
    });

    return Object.entries(componentTimes)
      .filter(([_, times]: [string, number[]]) => {
        if (!times || times.length === 0) return false;
        const avg = times.reduce((sum: number, time: number) => sum + time, 0) / times.length;
        return avg > threshold;
      })
      .map(([name]: [string, number[]]) => name);
  }

  reset(): void {
    this.metrics = [];
  }
}

export const performanceTracker = new PerformanceTracker();

interface UsePerformanceMonitorOptions {
  componentName: string;
  enabled?: boolean;
  threshold?: number; // Warn if render takes longer than this (ms)
  logToConsole?: boolean;
}

export function usePerformanceMonitor({
  componentName,
  enabled = process.env.NODE_ENV === "development",
  threshold = 16, // 16ms = 60fps
  logToConsole = false,
}: UsePerformanceMonitorOptions) {
  const renderStartTime = useRef<number>();
  const renderCount = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  useEffect(() => {
    if (!enabled || !renderStartTime.current) return;

    const renderTime = performance.now() - renderStartTime.current;
    
    const metric: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: Date.now(),
    };

    performanceTracker.addMetric(metric);

    if (logToConsole && renderTime > threshold) {
      console.warn(
        `🐌 Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
      );
    }
  });

  const logCurrentMetrics = useCallback((): void => {
    if (!enabled) return;
    
    const metrics = performanceTracker.getMetrics();
    const avgRenderTime = performanceTracker.getAverageRenderTime(componentName);
    const slowComponents = performanceTracker.getSlowComponents();
    
    console.group(`📊 Performance Metrics for ${componentName}`);
    console.log(`Average render time: ${avgRenderTime.toFixed(2)}ms`);
    console.log(`Total renders: ${renderCount.current}`);
    console.log(`Recent metrics:`, metrics.slice(-10));
    console.log(`Slow components:`, slowComponents);
    console.groupEnd();
  }, [componentName, enabled]);

  return {
    logCurrentMetrics,
    renderCount: renderCount.current,
    performanceTracker,
  };
}

// Hook for monitoring component re-renders
export function useRenderTracker(componentName: string, props?: unknown): number {
  const renderCount = useRef<number>(0);
  const prevProps = useRef<unknown>(props);

  useEffect(() => {
    renderCount.current += 1;
    
    if (process.env.NODE_ENV === "development") {
      // Check which props changed
      if (prevProps.current && props && typeof props === 'object' && props !== null) {
        const changedProps: string[] = [];
        const currentProps = props as Record<string, unknown>;
        const previousProps = prevProps.current as Record<string, unknown>;
        
        Object.keys(currentProps).forEach((key: string) => {
          if (previousProps?.[key] !== currentProps[key]) {
            changedProps.push(key);
          }
        });

        if (changedProps.length > 0) {
          console.log(
            `🔄 ${componentName} re-rendered due to props:`,
            changedProps
          );
        }
      }
      
      prevProps.current = props;
    }
  });

  return renderCount.current;
}

// Hook for detecting unnecessary re-renders
export function useWhyDidYouUpdate(name: string, props: Record<string, unknown>): void {
  const previousProps = useRef<Record<string, unknown>>();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: unknown; to: unknown }> = {};

      allKeys.forEach((key: string) => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length) {
        console.log('[why-did-you-update]', name, changedProps);
      }
    }

    previousProps.current = props;
  });
}