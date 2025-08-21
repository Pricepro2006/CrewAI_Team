import { Page } from '@playwright/test';

/**
 * Performance Monitoring Utilities for Tests
 * Helps identify and fix timeout issues
 */

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  resourceCount: number;
  apiCalls: number;
  memoryUsage?: number;
  networkRequests: RequestMetric[];
}

export interface RequestMetric {
  url: string;
  method: string;
  status: number;
  duration: number;
  size: number;
  type: string;
}

/**
 * Collect comprehensive performance metrics from a page
 */
export async function collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  // Collect basic performance timing
  const performanceTiming = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
    const lcp = performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0;
    
    // Calculate Time to Interactive (approximation)
    const tti = Math.max(
      perf.domContentLoadedEventEnd,
      perf.loadEventEnd
    );
    
    return {
      loadTime: perf.loadEventEnd - perf.navigationStart,
      domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
      firstContentfulPaint: fcp,
      largestContentfulPaint: lcp,
      timeToInteractive: tti - perf.navigationStart,
      resourceCount: performance.getEntriesByType('resource').length
    };
  });
  
  // Collect network requests
  const requests: RequestMetric[] = [];
  const apiCallCount = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let apiCount = 0;
    
    resources.forEach(resource => {
      if (resource.name.includes('/api/') || 
          resource.name.includes('/trpc/') || 
          resource.name.includes('graphql')) {
        apiCount++;
      }
    });
    
    return apiCount;
  });
  
  // Try to get memory usage if available
  let memoryUsage: number | undefined;
  try {
    memoryUsage = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize;
    });
  } catch {
    // Memory API not available in all browsers
  }
  
  return {
    ...performanceTiming,
    apiCalls: apiCallCount,
    memoryUsage,
    networkRequests: requests
  };
}

/**
 * Monitor network requests during test execution
 */
export class NetworkMonitor {
  private requests: RequestMetric[] = [];
  private slowRequests: RequestMetric[] = [];
  private failedRequests: RequestMetric[] = [];
  
  constructor(private page: Page, private slowThreshold: number = 5000) {
    this.setupMonitoring();
  }
  
  private setupMonitoring() {
    this.page.on('request', (request) => {
      const startTime = Date.now();
      (request as any)._startTime = startTime;
    });
    
    this.page.on('response', (response) => {
      const request = response.request();
      const endTime = Date.now();
      const startTime = (request as any)._startTime || endTime;
      const duration = endTime - startTime;
      
      const metric: RequestMetric = {
        url: request.url(),
        method: request.method(),
        status: response.status(),
        duration,
        size: 0, // Would need to get from response headers
        type: this.getRequestType(request.url())
      };
      
      this.requests.push(metric);
      
      // Track slow requests
      if (duration > this.slowThreshold) {
        this.slowRequests.push(metric);
      }
      
      // Track failed requests
      if (response.status() >= 400) {
        this.failedRequests.push(metric);
      }
    });
    
    this.page.on('requestfailed', (request) => {
      const metric: RequestMetric = {
        url: request.url(),
        method: request.method(),
        status: 0,
        duration: 0,
        size: 0,
        type: this.getRequestType(request.url())
      };
      
      this.failedRequests.push(metric);
    });
  }
  
  private getRequestType(url: string): string {
    if (url.includes('/api/') || url.includes('/trpc/')) return 'API';
    if (url.includes('.js')) return 'JavaScript';
    if (url.includes('.css')) return 'CSS';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'Image';
    if (url.includes('.woff') || url.includes('.ttf')) return 'Font';
    return 'Other';
  }
  
  getMetrics() {
    return {
      totalRequests: this.requests.length,
      slowRequests: this.slowRequests,
      failedRequests: this.failedRequests,
      averageDuration: this.requests.reduce((sum, req) => sum + req.duration, 0) / this.requests.length || 0,
      requestsByType: this.groupRequestsByType()
    };
  }
  
  private groupRequestsByType() {
    const grouped: { [key: string]: number } = {};
    this.requests.forEach(req => {
      grouped[req.type] = (grouped[req.type] || 0) + 1;
    });
    return grouped;
  }
  
  logSlowRequests() {
    if (this.slowRequests.length > 0) {
      console.log('⚠️ Slow requests detected:');
      this.slowRequests.forEach(req => {
        console.log(`  ${req.method} ${req.url} - ${req.duration}ms`);
      });
    }
  }
  
  logFailedRequests() {
    if (this.failedRequests.length > 0) {
      console.log('❌ Failed requests detected:');
      this.failedRequests.forEach(req => {
        console.log(`  ${req.method} ${req.url} - Status: ${req.status}`);
      });
    }
  }
}

/**
 * Wait for page to be fully loaded and interactive
 */
export async function waitForPageReady(page: Page, options?: {
  timeout?: number;
  waitForSelectors?: string[];
  waitForNetworkIdle?: boolean;
}) {
  const timeout = options?.timeout || 30000;
  const waitForSelectors = options?.waitForSelectors || [];
  const waitForNetworkIdle = options?.waitForNetworkIdle !== false;
  
  // Wait for basic page load
  await page.waitForLoadState('domcontentloaded', { timeout });
  
  // Wait for network to be idle if requested
  if (waitForNetworkIdle) {
    try {
      await page.waitForLoadState('networkidle', { timeout: timeout / 2 });
    } catch {
      // Continue if network idle timeout - page might still be functional
      console.log('⚠️ Network idle timeout - continuing with page ready check');
    }
  }
  
  // Wait for specific selectors if provided
  for (const selector of waitForSelectors) {
    try {
      await page.waitForSelector(selector, { 
        timeout: 5000,
        state: 'visible'
      });
    } catch {
      console.log(`⚠️ Selector ${selector} not found within timeout`);
    }
  }
  
  // Wait for any pending JavaScript
  await page.evaluate(() => {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve(true);
      } else {
        window.addEventListener('load', () => resolve(true));
      }
    });
  });
  
  // Small additional wait for any final rendering
  await page.waitForTimeout(500);
}

/**
 * Performance test wrapper that collects metrics
 */
export async function withPerformanceMonitoring<T>(
  page: Page,
  testFunction: () => Promise<T>,
  testName: string
): Promise<{ result: T; metrics: PerformanceMetrics }> {
  const monitor = new NetworkMonitor(page);
  
  const startTime = Date.now();
  
  try {
    const result = await testFunction();
    const endTime = Date.now();
    
    const metrics = await collectPerformanceMetrics(page);
    
    // Add test execution time
    (metrics as any).testExecutionTime = endTime - startTime;
    
    // Log performance insights
    console.log(`📊 Performance metrics for ${testName}:`);
    console.log(`  Load time: ${metrics.loadTime}ms`);
    console.log(`  DOM ready: ${metrics.domContentLoaded}ms`);
    console.log(`  API calls: ${metrics.apiCalls}`);
    console.log(`  Resources: ${metrics.resourceCount}`);
    
    if (metrics.memoryUsage) {
      console.log(`  Memory: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
    
    monitor.logSlowRequests();
    monitor.logFailedRequests();
    
    return { result, metrics };
  } catch (error) {
    // Still collect metrics on failure
    const metrics = await collectPerformanceMetrics(page);
    monitor.logSlowRequests();
    monitor.logFailedRequests();
    
    throw error;
  }
}

/**
 * Detect if page has performance issues
 */
export function detectPerformanceIssues(metrics: PerformanceMetrics): string[] {
  const issues: string[] = [];
  
  if (metrics.loadTime > 10000) {
    issues.push(`Slow page load: ${metrics.loadTime}ms`);
  }
  
  if (metrics.domContentLoaded > 5000) {
    issues.push(`Slow DOM ready: ${metrics.domContentLoaded}ms`);
  }
  
  if (metrics.largestContentfulPaint > 2500) {
    issues.push(`Poor LCP: ${metrics.largestContentfulPaint}ms`);
  }
  
  if (metrics.resourceCount > 100) {
    issues.push(`Many resources: ${metrics.resourceCount}`);
  }
  
  if (metrics.apiCalls > 20) {
    issues.push(`Many API calls: ${metrics.apiCalls}`);
  }
  
  if (metrics.memoryUsage && metrics.memoryUsage > 100 * 1024 * 1024) {
    issues.push(`High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
  }
  
  return issues;
}