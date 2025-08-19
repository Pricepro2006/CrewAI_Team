import { useEffect, useState, useCallback } from 'react';

export interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay  
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  loadTime: number;
  renderTime: number;
  bundleSize: number;
  cacheHitRate: number;
  networkRequests: number;
  jsHeapSize?: number;
  
  // Route-specific metrics
  routeLoadTime: Record<string, number>;
  componentRenderTimes: Record<string, number>;
}

export interface PerformanceConfig {
  enableWebVitals: boolean;
  enableResourceTiming: boolean;
  enableUserTiming: boolean;
  sampleRate: number; // 0-1, for production sampling
}

const defaultConfig: PerformanceConfig = {
  enableWebVitals: true,
  enableResourceTiming: true,
  enableUserTiming: true,
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1
};

export const usePerformanceMonitor = (config: Partial<PerformanceConfig> = {}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    bundleSize: 0,
    cacheHitRate: 0,
    networkRequests: 0,
    routeLoadTime: {},
    componentRenderTimes: {}
  });
  
  const [isSupported, setIsSupported] = useState(false);
  const finalConfig = { ...defaultConfig, ...config };
  
  // Check browser support
  useEffect(() => {
    const supported = 
      'performance' in window && 
      'getEntriesByType' in performance &&
      Math.random() < finalConfig.sampleRate;
    
    setIsSupported(supported);
  }, [finalConfig.sampleRate]);

  // Measure Core Web Vitals
  const measureWebVitals = useCallback(() => {
    if (!isSupported || !finalConfig.enableWebVitals) return;

    // LCP - Largest Contentful Paint
    new PerformanceObserver((list: any) => {
      const entries = list.getEntries() as PerformanceEventTiming[];
      const lastEntry = entries[Math.max(0, (entries?.length || 0) - 1)];
      const lcp = lastEntry?.startTime;
      
      if (lcp !== undefined) {
        setMetrics(prev => ({ ...prev, lcp }));
        
        // Report if LCP is poor (>2.5s)
        if (lcp > 2500) {
          console.warn(`[Performance] Poor LCP: ${lcp}ms (target: <2500ms)`);
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // FID - First Input Delay  
    new PerformanceObserver((list: any) => {
      const entries = list.getEntries() as PerformanceEventTiming[];
      const firstEntry = entries[0];
      const fid = firstEntry?.processingStart && firstEntry?.startTime 
        ? firstEntry.processingStart - firstEntry.startTime 
        : undefined;
      
      if (fid !== undefined) {
        setMetrics(prev => ({ ...prev, fid }));
        
        // Report if FID is poor (>100ms)
        if (fid > 100) {
          console.warn(`[Performance] Poor FID: ${fid}ms (target: <100ms)`);
        }
      }
    }).observe({ type: 'first-input', buffered: true });

    // CLS - Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list: any) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      
      setMetrics(prev => ({ ...prev, cls: clsValue }));
      
      // Report if CLS is poor (>0.1)
      if (clsValue > 0.1) {
        console.warn(`[Performance] Poor CLS: ${clsValue} (target: <0.1)`);
      }
    }).observe({ type: 'layout-shift', buffered: true });

    // FCP - First Contentful Paint
    new PerformanceObserver((list: any) => {
      const entries = list.getEntries() as PerformanceEventTiming[];
      const fcp = entries[0]?.startTime;
      
      setMetrics(prev => ({ ...prev, fcp }));
    }).observe({ type: 'paint', buffered: true });

  }, [isSupported, finalConfig.enableWebVitals]);

  // Measure resource loading performance
  const measureResourceTiming = useCallback(() => {
    if (!isSupported || !finalConfig.enableResourceTiming) return;

    const observer = new PerformanceObserver((list: any) => {
      const entries = list.getEntries() as PerformanceResourceTiming[];
      let totalSize = 0;
      let networkRequests = 0;
      let cacheHits = 0;

      entries.forEach(entry => {
        networkRequests++;
        totalSize += entry.transferSize || 0;
        
        // Detect cache hits (0 transfer size but non-zero encoded size)
        if (entry.transferSize === 0 && entry.encodedBodySize > 0) {
          cacheHits++;
        }
        
        // Log slow resources
        const loadTime = entry.responseEnd - entry.startTime;
        if (loadTime > 1000) {
          console.warn(`[Performance] Slow resource: ${entry.name} took ${loadTime}ms`);
        }
      });

      const cacheHitRate = networkRequests > 0 ? (cacheHits / networkRequests) * 100 : 0;

      setMetrics(prev => ({
        ...prev,
        bundleSize: totalSize,
        networkRequests,
        cacheHitRate
      }));
    });

    observer.observe({ entryTypes: ['resource'] });
    
    return () => observer.disconnect();
  }, [isSupported, finalConfig.enableResourceTiming]);

  // Measure page load time
  const measurePageLoad = useCallback(() => {
    if (!isSupported) return;

    const timing = (performance as any)?.timing;
    if (!timing) return;
    
    const loadTime = timing.loadEventEnd && timing.navigationStart 
      ? timing.loadEventEnd - timing.navigationStart : 0;
    const renderTime = timing.domContentLoadedEventEnd && timing.domLoading 
      ? timing.domContentLoadedEventEnd - timing.domLoading : 0;
    const ttfb = timing.responseStart && timing.navigationStart 
      ? timing.responseStart - timing.navigationStart : 0;

    setMetrics(prev => ({
      ...prev,
      loadTime,
      renderTime,
      ttfb
    }));

  }, [isSupported]);

  // Measure memory usage
  const measureMemoryUsage = useCallback(() => {
    if (!isSupported) return;

    // Modern browsers support performance.memory
    const memory = (performance as any).memory;
    if (memory) {
      setMetrics(prev => ({
        ...prev,
        jsHeapSize: memory.usedJSHeapSize
      }));
    }
  }, [isSupported]);

  // Track route changes
  const trackRouteChange = useCallback((routeName: string) => {
    if (!isSupported) return;

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      setMetrics(prev => ({
        ...prev,
        routeLoadTime: {
          ...prev.routeLoadTime,
          [routeName]: loadTime
        }
      }));
      
      // Log slow route changes
      if (loadTime > 500) {
        console.warn(`[Performance] Slow route change: ${routeName} took ${loadTime}ms`);
      }
    };
  }, [isSupported]);

  // Track component render times
  const trackComponentRender = useCallback((componentName: string) => {
    if (!isSupported) return;

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setMetrics(prev => ({
        ...prev,
        componentRenderTimes: {
          ...prev.componentRenderTimes,
          [componentName]: renderTime
        }
      }));
      
      // Log slow components
      if (renderTime > 100) {
        console.warn(`[Performance] Slow component: ${componentName} took ${renderTime}ms`);
      }
    };
  }, [isSupported]);

  // Send metrics to analytics (optional)
  const reportMetrics = useCallback(() => {
    if (!isSupported || process.env.NODE_ENV !== 'production') return;

    // Example: Send to analytics service
    const reportData = {
      ...metrics,
      url: window?.location?.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };

    // Replace with your analytics endpoint
    fetch('/api/analytics/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    }).catch(err => console.warn('Failed to report metrics:', err));
  }, [metrics, isSupported]);

  // Initialize monitoring
  useEffect(() => {
    if (!isSupported) return;

    measureWebVitals();
    measurePageLoad();
    measureMemoryUsage();
    
    const cleanup = measureResourceTiming();
    
    // Report metrics after page is fully loaded
    const timer = setTimeout(reportMetrics, 5000);
    
    return () => {
      cleanup?.();
      clearTimeout(timer);
    };
  }, [isSupported, measureWebVitals, measurePageLoad, measureMemoryUsage, measureResourceTiming, reportMetrics]);

  // Get performance grade based on Web Vitals
  const getPerformanceGrade = useCallback((): 'A' | 'B' | 'C' | 'D' | 'F' => {
    const { lcp, fid, cls } = metrics;
    
    const scores = [];
    
    if (lcp !== undefined) {
      scores.push(lcp < 2500 ? 1 : lcp < 4000 ? 0.5 : 0);
    }
    
    if (fid !== undefined) {
      scores.push(fid < 100 ? 1 : fid < 300 ? 0.5 : 0);
    }
    
    if (cls !== undefined) {
      scores.push(cls < 0.1 ? 1 : cls < 0.25 ? 0.5 : 0);
    }
    
    if ((scores?.length || 0) === 0) return 'F';
    
    const average = scores.reduce((a: number, b: number) => a + b, 0) / (scores?.length || 1);
    
    if (average >= 0.9) return 'A';
    if (average >= 0.75) return 'B';
    if (average >= 0.5) return 'C';
    if (average >= 0.25) return 'D';
    return 'F';
  }, [metrics]);

  return {
    metrics,
    isSupported,
    trackRouteChange,
    trackComponentRender,
    reportMetrics,
    performanceGrade: getPerformanceGrade()
  };
};