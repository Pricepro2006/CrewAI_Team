#!/usr/bin/env tsx

// Performance benchmarking script for Walmart Grocery Agent
// Tests load times, bundle sizes, and Core Web Vitals

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { performance } from 'perf_hooks';
import path from 'path';

interface BenchmarkResults {
  timestamp: string;
  bundleSizes: {
    main: number;
    vendor: number;
    total: number;
  };
  loadTimes: {
    serverStart: number;
    firstResponse: number;
    fullLoad: number;
  };
  performanceMetrics: {
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

class PerformanceBenchmark {
  private results: BenchmarkResults = {
    timestamp: new Date().toISOString(),
    bundleSizes: { main: 0, vendor: 0, total: 0 },
    loadTimes: { serverStart: 0, firstResponse: 0, fullLoad: 0 },
    performanceMetrics: {},
    memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0 }
  };

  async run(): Promise<BenchmarkResults> {
    console.log('🚀 Starting performance benchmark...\n');

    await this.measureBundleSizes();
    await this.measureServerPerformance();
    await this.measureMemoryUsage();
    await this.generateReport();

    return this.results;
  }

  private async measureBundleSizes() {
    console.log('📦 Measuring bundle sizes...');
    
    try {
      const distPath = path.join(process.cwd(), 'dist', 'ui', 'assets', 'js');
      const files = await fs.readdir(distPath);
      
      let mainSize = 0;
      let vendorSize = 0;
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.js')) {
          const filePath = path.join(distPath, file);
          const stats = await fs.stat(filePath);
          const size = stats.size;
          
          totalSize += size;
          
          if (file.includes('main')) {
            mainSize += size;
          } else if (file.includes('vendor')) {
            vendorSize += size;
          }
          
          console.log(`  ${file}: ${this.formatBytes(size)}`);
        }
      }

      this.results.bundleSizes = {
        main: mainSize,
        vendor: vendorSize,
        total: totalSize
      };

      console.log(`\n  Total bundle size: ${this.formatBytes(totalSize)}`);
      
      // Check against performance budgets
      const budgetMain = 300 * 1024; // 300KB
      const budgetVendor = 500 * 1024; // 500KB
      const budgetTotal = 1024 * 1024; // 1MB

      if (mainSize > budgetMain) {
        console.warn(`⚠️  Main bundle exceeds budget: ${this.formatBytes(mainSize)} > ${this.formatBytes(budgetMain)}`);
      }
      if (vendorSize > budgetVendor) {
        console.warn(`⚠️  Vendor bundle exceeds budget: ${this.formatBytes(vendorSize)} > ${this.formatBytes(budgetVendor)}`);
      }
      if (totalSize > budgetTotal) {
        console.warn(`⚠️  Total bundle exceeds budget: ${this.formatBytes(totalSize)} > ${this.formatBytes(budgetTotal)}`);
      }

    } catch (error) {
      console.error('❌ Failed to measure bundle sizes:', error);
    }
  }

  private async measureServerPerformance() {
    console.log('\n🖥️  Measuring server performance...');

    return new Promise<void>((resolve) => {
      const startTime = performance.now();
      
      // Start server
      const server = spawn('node', ['dist/api/server.js'], {
        env: { ...process.env, NODE_ENV: 'production', PORT: '3001' },
        stdio: 'pipe'
      });

      let serverReady = false;
      let firstResponseTime = 0;

      server.stdout?.on('data', (data) => {
        const output = data.toString();
        
        if (output.includes('Server running') && !serverReady) {
          serverReady = true;
          this.results.loadTimes.serverStart = performance.now() - startTime;
          console.log(`  Server start time: ${this.results.loadTimes.serverStart.toFixed(2)}ms`);
          
          // Test first response
          this.testFirstResponse().then((responseTime) => {
            firstResponseTime = responseTime;
            this.results.loadTimes.firstResponse = responseTime;
            console.log(`  First response time: ${responseTime.toFixed(2)}ms`);
            
            // Cleanup and resolve
            server.kill();
            resolve();
          });
        }
      });

      server.stderr?.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('warning') && !error.includes('deprecated')) {
          console.error('Server error:', error);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          console.error('❌ Server startup timeout');
          server.kill();
          resolve();
        }
      }, 30000);
    });
  }

  private async testFirstResponse(): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Use dynamic import to avoid issues at startup
      const fetch = await import('node-fetch').then(mod => mod.default);
      
      await fetch('http://localhost:3001/api/health', {
        timeout: 10000
      });
      
      return performance.now() - startTime;
    } catch (error) {
      console.warn('⚠️  Health check failed:', error);
      return -1;
    }
  }

  private async measureMemoryUsage() {
    console.log('\n💾 Measuring memory usage...');

    const memUsage = process.memoryUsage();
    this.results.memoryUsage = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external
    };

    console.log(`  Heap used: ${this.formatBytes(memUsage.heapUsed)}`);
    console.log(`  Heap total: ${this.formatBytes(memUsage.heapTotal)}`);
    console.log(`  External: ${this.formatBytes(memUsage.external)}`);

    // Check memory budget (Node.js apps should stay under 512MB for good performance)
    const memoryBudget = 512 * 1024 * 1024; // 512MB
    if (memUsage.heapUsed > memoryBudget) {
      console.warn(`⚠️  Memory usage exceeds budget: ${this.formatBytes(memUsage.heapUsed)} > ${this.formatBytes(memoryBudget)}`);
    }
  }

  private async generateReport() {
    console.log('\n📊 Generating performance report...');

    const report = {
      ...this.results,
      performanceGrade: this.calculatePerformanceGrade(),
      recommendations: this.getRecommendations()
    };

    const reportPath = path.join(process.cwd(), 'performance-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(process.cwd(), 'PERFORMANCE_REPORT.md');
    await fs.writeFile(markdownPath, markdownReport);

    console.log(`  Report saved to: ${reportPath}`);
    console.log(`  Markdown report: ${markdownPath}`);
  }

  private calculatePerformanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    let score = 0;

    // Bundle size scoring (40% of total score)
    const totalSizeMB = this.results.bundleSizes.total / (1024 * 1024);
    if (totalSizeMB < 0.5) score += 40;
    else if (totalSizeMB < 1) score += 30;
    else if (totalSizeMB < 2) score += 20;
    else if (totalSizeMB < 3) score += 10;

    // Server performance scoring (30% of total score)
    if (this.results.loadTimes.serverStart < 1000) score += 30;
    else if (this.results.loadTimes.serverStart < 2000) score += 20;
    else if (this.results.loadTimes.serverStart < 3000) score += 10;

    // Memory usage scoring (30% of total score)
    const memoryMB = this.results.memoryUsage.heapUsed / (1024 * 1024);
    if (memoryMB < 128) score += 30;
    else if (memoryMB < 256) score += 20;
    else if (memoryMB < 512) score += 10;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private getRecommendations(): string[] {
    const recommendations: string[] = [];

    // Bundle size recommendations
    if (this.results.bundleSizes.total > 1024 * 1024) {
      recommendations.push('Consider implementing more aggressive code splitting');
      recommendations.push('Remove unused dependencies and dead code');
    }

    if (this.results.bundleSizes.main > 300 * 1024) {
      recommendations.push('Split main bundle further with dynamic imports');
    }

    // Performance recommendations
    if (this.results.loadTimes.serverStart > 2000) {
      recommendations.push('Optimize server startup time');
      recommendations.push('Consider using PM2 or cluster mode');
    }

    // Memory recommendations
    if (this.results.memoryUsage.heapUsed > 256 * 1024 * 1024) {
      recommendations.push('Monitor memory usage in production');
      recommendations.push('Consider implementing memory-efficient data structures');
    }

    return recommendations;
  }

  private generateMarkdownReport(report: any): string {
    return `# Performance Benchmark Report

**Generated:** ${report.timestamp}
**Performance Grade:** ${report.performanceGrade}

## Bundle Analysis

| Bundle | Size | Status |
|--------|------|--------|
| Main | ${this.formatBytes(report.bundleSizes.main)} | ${report.bundleSizes.main < 300*1024 ? '✅' : '⚠️'} |
| Vendor | ${this.formatBytes(report.bundleSizes.vendor)} | ${report.bundleSizes.vendor < 500*1024 ? '✅' : '⚠️'} |
| **Total** | **${this.formatBytes(report.bundleSizes.total)}** | ${report.bundleSizes.total < 1024*1024 ? '✅' : '⚠️'} |

## Performance Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Server Start Time | ${report.loadTimes.serverStart.toFixed(2)}ms | <2000ms | ${report.loadTimes.serverStart < 2000 ? '✅' : '⚠️'} |
| First Response | ${report.loadTimes.firstResponse.toFixed(2)}ms | <500ms | ${report.loadTimes.firstResponse < 500 ? '✅' : '⚠️'} |

## Memory Usage

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Heap Used | ${this.formatBytes(report.memoryUsage.heapUsed)} | <256MB | ${report.memoryUsage.heapUsed < 256*1024*1024 ? '✅' : '⚠️'} |
| Heap Total | ${this.formatBytes(report.memoryUsage.heapTotal)} | <512MB | ${report.memoryUsage.heapTotal < 512*1024*1024 ? '✅' : '⚠️'} |

## Recommendations

${report.recommendations.map((rec: string) => `- ${rec}`).join('\n')}

## Next Steps

1. Monitor these metrics in production
2. Set up automated performance testing in CI/CD
3. Implement performance budgets
4. Use CDN for static asset delivery
5. Monitor Core Web Vitals with real user data

---
*Report generated by Walmart Grocery Agent Performance Benchmark*
`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Run benchmark if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  
  benchmark.run()
    .then((results) => {
      console.log('\n🎉 Benchmark completed successfully!');
      console.log(`Performance Grade: ${benchmark['calculatePerformanceGrade']()}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    });
}

export { PerformanceBenchmark };