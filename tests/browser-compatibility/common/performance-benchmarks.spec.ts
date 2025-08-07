import { test, expect, Page } from '@playwright/test';
import { detectBrowserCapabilities, BrowserCapabilities } from '../utils/browser-detector';

test.describe('Performance Benchmarks', () => {
  let capabilities: BrowserCapabilities;

  test.beforeEach(async ({ page }) => {
    capabilities = await detectBrowserCapabilities(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should measure page load performance', async ({ page }) => {
    // Navigate to Walmart agent for performance testing
    const startTime = Date.now();
    
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;

    const performanceMetrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');

      return {
        // Navigation timing
        domContentLoaded: nav.domContentLoadedEventEnd - nav.navigationStart,
        loadComplete: nav.loadEventEnd - nav.navigationStart,
        
        // Network timing
        dns: nav.domainLookupEnd - nav.domainLookupStart,
        tcp: nav.connectEnd - nav.connectStart,
        request: nav.responseStart - nav.requestStart,
        response: nav.responseEnd - nav.responseStart,
        
        // Paint timing
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        
        // Resource timing
        resourceCount: resources.length,
        totalResourceSize: resources.reduce((sum, resource: any) => 
          sum + (resource.encodedBodySize || 0), 0
        ),
        
        // Memory usage (if available)
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null,
        
        // Core Web Vitals (approximate)
        largestContentfulPaint: 0, // Would need PerformanceObserver
        cumulativeLayoutShift: 0,  // Would need PerformanceObserver
        firstInputDelay: 0         // Would need PerformanceObserver
      };
    });

    console.log(`Performance Metrics for ${capabilities.name}:`);
    console.log(`  Manual Load Time: ${loadTime}ms`);
    console.log(`  DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(2)}ms`);
    console.log(`  Load Complete: ${performanceMetrics.loadComplete.toFixed(2)}ms`);
    console.log(`  First Paint: ${performanceMetrics.firstPaint.toFixed(2)}ms`);
    console.log(`  First Contentful Paint: ${performanceMetrics.firstContentfulPaint.toFixed(2)}ms`);
    console.log(`  DNS Lookup: ${performanceMetrics.dns.toFixed(2)}ms`);
    console.log(`  TCP Connection: ${performanceMetrics.tcp.toFixed(2)}ms`);
    console.log(`  Request Time: ${performanceMetrics.request.toFixed(2)}ms`);
    console.log(`  Response Time: ${performanceMetrics.response.toFixed(2)}ms`);
    console.log(`  Resources Loaded: ${performanceMetrics.resourceCount}`);
    console.log(`  Total Resource Size: ${(performanceMetrics.totalResourceSize / 1024).toFixed(2)}KB`);

    if (performanceMetrics.memory) {
      console.log(`  Memory Used: ${(performanceMetrics.memory.used / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory Total: ${(performanceMetrics.memory.total / 1024 / 1024).toFixed(2)}MB`);
    }

    // Performance assertions
    expect(performanceMetrics.loadComplete).toBeLessThan(10000); // Under 10 seconds
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(5000); // Under 5 seconds
    expect(performanceMetrics.domContentLoaded).toBeLessThan(8000); // Under 8 seconds

    // Store metrics for comparison
    await page.evaluate((metrics) => {
      (window as any).performanceMetrics = metrics;
    }, { ...performanceMetrics, browser: capabilities.name, loadTime });
  });

  test('should benchmark JavaScript execution performance', async ({ page }) => {
    const jsBenchmark = await page.evaluate(() => {
      const results: any = {
        arrayOperations: 0,
        objectOperations: 0,
        domOperations: 0,
        mathOperations: 0,
        stringOperations: 0,
        asyncOperations: 0
      };

      // Array operations benchmark
      const arrayStart = performance.now();
      const arr = Array.from({ length: 100000 }, (_, i) => i);
      const filtered = arr.filter(x => x % 2 === 0);
      const mapped = filtered.map(x => x * 2);
      const reduced = mapped.reduce((sum, x) => sum + x, 0);
      results.arrayOperations = performance.now() - arrayStart;

      // Object operations benchmark
      const objStart = performance.now();
      const obj: any = {};
      for (let i = 0; i < 10000; i++) {
        obj[`key${i}`] = `value${i}`;
      }
      const keys = Object.keys(obj);
      const values = Object.values(obj);
      results.objectOperations = performance.now() - objStart;

      // DOM operations benchmark
      const domStart = performance.now();
      const container = document.createElement('div');
      for (let i = 0; i < 1000; i++) {
        const element = document.createElement('div');
        element.textContent = `Element ${i}`;
        element.className = `test-element-${i}`;
        container.appendChild(element);
      }
      // Query operations
      container.querySelectorAll('.test-element-1, .test-element-2, .test-element-3');
      results.domOperations = performance.now() - domStart;

      // Math operations benchmark
      const mathStart = performance.now();
      let mathResult = 0;
      for (let i = 0; i < 100000; i++) {
        mathResult += Math.sin(i) * Math.cos(i) + Math.sqrt(i);
      }
      results.mathOperations = performance.now() - mathStart;

      // String operations benchmark
      const stringStart = performance.now();
      let str = '';
      for (let i = 0; i < 10000; i++) {
        str += `test string ${i} `;
      }
      str.split(' ').join('-').toUpperCase().toLowerCase();
      results.stringOperations = performance.now() - stringStart;

      return results;
    });

    console.log(`JavaScript Performance Benchmark for ${capabilities.name}:`);
    console.log(`  Array Operations: ${jsBenchmark.arrayOperations.toFixed(2)}ms`);
    console.log(`  Object Operations: ${jsBenchmark.objectOperations.toFixed(2)}ms`);
    console.log(`  DOM Operations: ${jsBenchmark.domOperations.toFixed(2)}ms`);
    console.log(`  Math Operations: ${jsBenchmark.mathOperations.toFixed(2)}ms`);
    console.log(`  String Operations: ${jsBenchmark.stringOperations.toFixed(2)}ms`);

    // Performance expectations (these may vary significantly between browsers)
    expect(jsBenchmark.arrayOperations).toBeLessThan(1000); // Under 1 second
    expect(jsBenchmark.objectOperations).toBeLessThan(500);  // Under 500ms
    expect(jsBenchmark.domOperations).toBeLessThan(1000);    // Under 1 second
    expect(jsBenchmark.mathOperations).toBeLessThan(2000);   // Under 2 seconds
    expect(jsBenchmark.stringOperations).toBeLessThan(1000); // Under 1 second

    // Store benchmark results
    await page.evaluate((results) => {
      (window as any).jsBenchmarkResults = results;
    }, { ...jsBenchmark, browser: capabilities.name });
  });

  test('should measure rendering performance', async ({ page }) => {
    await page.goto('/walmart');
    await page.waitForLoadState('networkidle');

    const renderingBenchmark = await page.evaluate(async () => {
      const results: any = {
        initialRender: 0,
        reflow: 0,
        animation: 0,
        scrollPerformance: 0
      };

      // Measure initial render
      const renderStart = performance.now();
      const testContainer = document.createElement('div');
      testContainer.style.cssText = `
        position: fixed;
        top: -1000px;
        left: -1000px;
        width: 500px;
        height: 500px;
        background: linear-gradient(45deg, red, blue);
      `;
      
      for (let i = 0; i < 100; i++) {
        const child = document.createElement('div');
        child.style.cssText = `
          width: 50px;
          height: 50px;
          background: hsl(${i * 3.6}, 50%, 50%);
          display: inline-block;
          margin: 2px;
        `;
        testContainer.appendChild(child);
      }
      
      document.body.appendChild(testContainer);
      
      // Force layout
      testContainer.offsetHeight;
      results.initialRender = performance.now() - renderStart;

      // Measure reflow performance
      const reflowStart = performance.now();
      const children = testContainer.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        child.style.width = '60px';
        child.style.height = '60px';
        // Force reflow
        child.offsetHeight;
      }
      results.reflow = performance.now() - reflowStart;

      // Measure animation performance
      const animStart = performance.now();
      return new Promise<typeof results>((resolve) => {
        let frame = 0;
        const animate = () => {
          frame++;
          if (frame < 60) { // 60 frames
            testContainer.style.transform = `rotate(${frame * 6}deg)`;
            requestAnimationFrame(animate);
          } else {
            results.animation = performance.now() - animStart;
            
            // Cleanup
            document.body.removeChild(testContainer);
            resolve(results);
          }
        };
        requestAnimationFrame(animate);
      });
    });

    console.log(`Rendering Performance for ${capabilities.name}:`);
    console.log(`  Initial Render: ${renderingBenchmark.initialRender.toFixed(2)}ms`);
    console.log(`  Reflow Operations: ${renderingBenchmark.reflow.toFixed(2)}ms`);
    console.log(`  Animation (60 frames): ${renderingBenchmark.animation.toFixed(2)}ms`);
    console.log(`  Average Frame Time: ${(renderingBenchmark.animation / 60).toFixed(2)}ms`);

    // Rendering performance expectations
    expect(renderingBenchmark.initialRender).toBeLessThan(500);  // Under 500ms
    expect(renderingBenchmark.reflow).toBeLessThan(200);         // Under 200ms
    expect(renderingBenchmark.animation).toBeLessThan(2000);     // Under 2 seconds for 60 frames
    expect(renderingBenchmark.animation / 60).toBeLessThan(33);  // Under 33ms per frame (30fps)

    // Store rendering results
    await page.evaluate((results) => {
      (window as any).renderingBenchmark = results;
    }, { ...renderingBenchmark, browser: capabilities.name });
  });

  test('should measure network performance', async ({ page }) => {
    const networkBenchmark = await page.evaluate(async () => {
      const results: any = {
        smallRequest: 0,
        largeRequest: 0,
        parallelRequests: 0,
        cachePerformance: 0
      };

      try {
        // Small request benchmark
        const smallStart = performance.now();
        await fetch('data:application/json,{"test":"small"}');
        results.smallRequest = performance.now() - smallStart;

        // Large request benchmark (simulated with larger data URL)
        const largeData = 'x'.repeat(10000); // 10KB
        const largeStart = performance.now();
        await fetch(`data:text/plain,${largeData}`);
        results.largeRequest = performance.now() - largeStart;

        // Parallel requests benchmark
        const parallelStart = performance.now();
        const promises = Array.from({ length: 5 }, (_, i) => 
          fetch(`data:application/json,{"request":${i}}`)
        );
        await Promise.all(promises);
        results.parallelRequests = performance.now() - parallelStart;

        // Cache performance test
        const cacheStart = performance.now();
        const firstRequest = await fetch('data:application/json,{"cached":"data"}');
        const secondRequest = await fetch('data:application/json,{"cached":"data"}');
        results.cachePerformance = performance.now() - cacheStart;

      } catch (error) {
        results.error = (error as Error).message;
      }

      return results;
    });

    console.log(`Network Performance for ${capabilities.name}:`);
    
    if (!networkBenchmark.error) {
      console.log(`  Small Request: ${networkBenchmark.smallRequest.toFixed(2)}ms`);
      console.log(`  Large Request: ${networkBenchmark.largeRequest.toFixed(2)}ms`);
      console.log(`  Parallel Requests (5): ${networkBenchmark.parallelRequests.toFixed(2)}ms`);
      console.log(`  Cache Performance: ${networkBenchmark.cachePerformance.toFixed(2)}ms`);

      // Network performance is highly variable, so we use generous limits
      expect(networkBenchmark.smallRequest).toBeLessThan(1000);  // Under 1 second
      expect(networkBenchmark.parallelRequests).toBeLessThan(5000); // Under 5 seconds
    } else {
      console.log(`Network benchmark error: ${networkBenchmark.error}`);
    }

    // Store network results
    await page.evaluate((results) => {
      (window as any).networkBenchmark = results;
    }, { ...networkBenchmark, browser: capabilities.name });
  });

  test('should measure memory usage patterns', async ({ page }) => {
    const memoryTest = await page.evaluate(() => {
      const results: any = {
        memoryAPIAvailable: false,
        initialMemory: 0,
        afterOperations: 0,
        memoryLeak: 0,
        garbageCollection: false
      };

      // Check if memory API is available (Chrome only)
      if ((performance as any).memory) {
        results.memoryAPIAvailable = true;
        const memory = (performance as any).memory;
        
        results.initialMemory = memory.usedJSHeapSize;
        
        // Perform memory-intensive operations
        const arrays = [];
        for (let i = 0; i < 1000; i++) {
          arrays.push(Array.from({ length: 1000 }, (_, j) => ({ id: j, data: Math.random() })));
        }
        
        results.afterOperations = memory.usedJSHeapSize;
        
        // Clear references to test garbage collection
        arrays.length = 0;
        
        // Force garbage collection if possible
        if ((window as any).gc) {
          (window as any).gc();
          results.garbageCollection = true;
        }
        
        // Measure after cleanup
        setTimeout(() => {
          results.afterCleanup = memory.usedJSHeapSize;
          results.memoryLeak = results.afterCleanup - results.initialMemory;
        }, 100);
        
        results.memoryDelta = results.afterOperations - results.initialMemory;
      }

      return results;
    });

    console.log(`Memory Usage Analysis for ${capabilities.name}:`);
    
    if (memoryTest.memoryAPIAvailable) {
      console.log(`  Memory API: Available`);
      console.log(`  Initial Memory: ${(memoryTest.initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  After Operations: ${(memoryTest.afterOperations / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory Delta: ${(memoryTest.memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      
      if (memoryTest.garbageCollection) {
        console.log(`  Garbage Collection: Forced`);
      }
      
      // Memory usage should be reasonable
      expect(memoryTest.memoryDelta).toBeLessThan(100 * 1024 * 1024); // Under 100MB increase
    } else {
      console.log(`  Memory API: Not Available (Chrome-only feature)`);
    }

    // Store memory results
    await page.evaluate((results) => {
      (window as any).memoryTest = results;
    }, { ...memoryTest, browser: capabilities.name });
  });

  test('should generate performance comparison report', async ({ page }) => {
    // Collect all performance data
    const performanceReport = await page.evaluate(() => {
      return {
        browser: (window as any).performanceMetrics?.browser,
        pageLoad: (window as any).performanceMetrics,
        javascript: (window as any).jsBenchmarkResults,
        rendering: (window as any).renderingBenchmark,
        network: (window as any).networkBenchmark,
        memory: (window as any).memoryTest,
        timestamp: new Date().toISOString()
      };
    });

    console.log(`\n🏁 Performance Summary for ${capabilities.name}:`);
    
    if (performanceReport.pageLoad) {
      console.log(`📊 Page Load Performance:`);
      console.log(`  Load Complete: ${performanceReport.pageLoad.loadComplete?.toFixed(2)}ms`);
      console.log(`  First Contentful Paint: ${performanceReport.pageLoad.firstContentfulPaint?.toFixed(2)}ms`);
    }

    if (performanceReport.javascript) {
      console.log(`⚡ JavaScript Performance:`);
      console.log(`  Array Operations: ${performanceReport.javascript.arrayOperations?.toFixed(2)}ms`);
      console.log(`  DOM Operations: ${performanceReport.javascript.domOperations?.toFixed(2)}ms`);
    }

    if (performanceReport.rendering) {
      console.log(`🎨 Rendering Performance:`);
      console.log(`  Initial Render: ${performanceReport.rendering.initialRender?.toFixed(2)}ms`);
      console.log(`  Average Frame Time: ${(performanceReport.rendering.animation / 60)?.toFixed(2)}ms`);
    }

    // Calculate performance score (0-100)
    let performanceScore = 100;
    
    if (performanceReport.pageLoad?.loadComplete > 5000) performanceScore -= 20;
    if (performanceReport.pageLoad?.firstContentfulPaint > 3000) performanceScore -= 15;
    if (performanceReport.javascript?.arrayOperations > 500) performanceScore -= 10;
    if (performanceReport.rendering?.animation / 60 > 33) performanceScore -= 15;
    
    console.log(`\n🎯 Overall Performance Score: ${performanceScore}/100`);

    // Store complete report
    await page.evaluate((report) => {
      (window as any).completePerformanceReport = report;
    }, { ...performanceReport, score: performanceScore });

    expect(performanceScore).toBeGreaterThanOrEqual(50); // Minimum acceptable score

    await page.screenshot({ 
      path: `browser-compatibility-results/${capabilities.name.toLowerCase()}/performance-summary.png`,
      fullPage: true 
    });
  });
});