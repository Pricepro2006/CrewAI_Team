/**
 * Integration Test Runner for Microservices Architecture
 * 
 * Comprehensive test orchestration with environment setup, service health validation,
 * parallel test execution, and detailed reporting for real-world scenarios.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import axios from 'axios';
import Redis from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../src/utils/logger.js';

interface TestSuite {
  name: string;
  file: string;
  category: 'integration' | 'edge_cases' | 'performance' | 'security';
  dependencies: string[];
  timeout: number;
  parallel: boolean;
  criticalPath: boolean;
}

interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastCheck: Date;
}

interface TestResults {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: number;
  errors: string[];
  performance: {
    avgResponseTime: number;
    maxResponseTime: number;
    throughput: number;
  };
}

interface TestReport {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  environment: string;
  serviceHealth: ServiceHealth[];
  suiteResults: TestResults[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
  };
  recommendations: string[];
}

class IntegrationTestRunner extends EventEmitter {
  private testSuites: TestSuite[] = [];
  private serviceHealth: ServiceHealth[] = [];
  private redis?: Redis;
  private testProcesses: Map<string, ChildProcess> = new Map();
  private results: TestResults[] = [];
  private startTime: Date = new Date();

  constructor() {
    super();
    this.setupTestSuites();
  }

  private setupTestSuites(): void {
    this.testSuites = [
      {
        name: 'Core Microservices Integration',
        file: 'microservices-integration.test.ts',
        category: 'integration',
        dependencies: ['walmart-api-server', 'walmart-nlp-queue', 'walmart-pricing'],
        timeout: 300000, // 5 minutes
        parallel: true,
        criticalPath: true
      },
      {
        name: 'Edge Cases and Error Scenarios',
        file: 'edge-cases-error-scenarios.test.ts',
        category: 'edge_cases',
        dependencies: ['walmart-api-server', 'walmart-nlp-queue'],
        timeout: 600000, // 10 minutes
        parallel: false,
        criticalPath: true
      },
      {
        name: 'WebSocket Real-time Integration',
        file: 'websocket-integration.test.ts',
        category: 'integration',
        dependencies: ['walmart-websocket', 'walmart-api-server'],
        timeout: 180000, // 3 minutes
        parallel: true,
        criticalPath: false
      }
    ];
  }

  /**
   * Run all integration tests with comprehensive reporting
   */
  async runAllTests(options: {
    parallel?: boolean;
    criticalOnly?: boolean;
    generateReport?: boolean;
    coverageThreshold?: number;
  } = {}): Promise<TestReport> {
    const {
      parallel = true,
      criticalOnly = false,
      generateReport = true,
      coverageThreshold = 80
    } = options;

    this.startTime = new Date();
    logger.info('Starting comprehensive integration test suite', 'INTEGRATION_RUNNER');

    try {
      // Step 1: Environment validation
      await this.validateEnvironment();

      // Step 2: Service health checks
      await this.checkServiceHealth();

      // Step 3: Pre-test setup
      await this.setupTestEnvironment();

      // Step 4: Filter test suites
      const suitesToRun = criticalOnly 
        ? this.testSuites.filter(suite => suite.criticalPath)
        : this.testSuites;

      // Step 5: Run tests
      if (parallel) {
        await this.runTestsParallel(suitesToRun);
      } else {
        await this.runTestsSequential(suitesToRun);
      }

      // Step 6: Generate report
      const report = await this.generateTestReport();

      // Step 7: Cleanup
      await this.cleanup();

      // Step 8: Validate results
      this.validateTestResults(report, coverageThreshold);

      if (generateReport) {
        await this.saveTestReport(report);
      }

      return report;

    } catch (error) {
      logger.error('Integration test suite failed', 'INTEGRATION_RUNNER', { error });
      throw error;
    }
  }

  /**
   * Validate that the test environment is properly configured
   */
  private async validateEnvironment(): Promise<void> {
    logger.info('Validating test environment', 'INTEGRATION_RUNNER');

    const requiredEnvVars = [
      'REDIS_HOST',
      'REDIS_PORT',
      'NODE_ENV'
    ];

    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      throw new Error(`Node.js version 18+ required, found ${nodeVersion}`);
    }

    // Validate test database access
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: 15, // Test database
        lazyConnect: true
      });
      
      await this.redis.connect();
      await this.redis.ping();
      
      logger.info('Redis connection validated', 'INTEGRATION_RUNNER');
    } catch (error) {
      throw new Error(`Redis connection failed: ${error}`);
    }

    // Check available disk space for logs and reports
    const stats = await fs.stat(process.cwd());
    if (stats.size < 1024 * 1024 * 100) { // 100MB minimum
      logger.warn('Low disk space detected', 'INTEGRATION_RUNNER');
    }

    logger.info('Environment validation complete', 'INTEGRATION_RUNNER');
  }

  /**
   * Check health of all required services
   */
  private async checkServiceHealth(): Promise<void> {
    logger.info('Checking service health', 'INTEGRATION_RUNNER');

    const services = [
      { name: 'walmart-api-server', url: 'http://localhost:3000/health' },
      { name: 'walmart-websocket', url: 'http://localhost:8080/ws-health' },
      { name: 'walmart-nlp-queue', url: 'http://localhost:3008/nlp/health' },
      { name: 'walmart-pricing', url: 'http://localhost:3007/pricing/health' },
      { name: 'walmart-cache-warmer', url: 'http://localhost:3006/cache/health' },
      { name: 'walmart-memory-monitor', url: 'http://localhost:3009/monitor/health' }
    ];

    this.serviceHealth = await Promise.all(
      services.map(async (service) => {
        const startTime = Date.now();
        try {
          const response = await axios.get(service.url, { timeout: 5000 });
          const responseTime = Date.now() - startTime;
          
          return {
            name: service.name,
            url: service.url,
            status: response.status === 200 ? 'healthy' : 'unhealthy',
            responseTime,
            lastCheck: new Date()
          };
        } catch (error) {
          return {
            name: service.name,
            url: service.url,
            status: 'unhealthy' as const,
            responseTime: Date.now() - startTime,
            lastCheck: new Date()
          };
        }
      })
    );

    const unhealthyServices = this.serviceHealth.filter(s => s.status === 'unhealthy');
    if (unhealthyServices.length > 0) {
      logger.warn('Some services are unhealthy', 'INTEGRATION_RUNNER', {
        unhealthy: unhealthyServices.map(s => s.name)
      });
      
      // Check if critical services are down
      const criticalServices = ['walmart-api-server'];
      const criticalDown = unhealthyServices.filter(s => 
        criticalServices.includes(s.name)
      );
      
      if (criticalDown.length > 0) {
        throw new Error(`Critical services are down: ${criticalDown.map(s => s.name).join(', ')}`);
      }
    }

    logger.info('Service health check complete', 'INTEGRATION_RUNNER', {
      healthy: this.serviceHealth.filter(s => s.status === 'healthy').length,
      unhealthy: unhealthyServices.length
    });
  }

  /**
   * Setup test environment (clear caches, reset state, etc.)
   */
  private async setupTestEnvironment(): Promise<void> {
    logger.info('Setting up test environment', 'INTEGRATION_RUNNER');

    if (this.redis) {
      // Clear test databases
      await this.redis.select(13); // Edge cases DB
      await this.redis.flushdb();
      await this.redis.select(14); // Integration tests DB
      await this.redis.flushdb();
      await this.redis.select(15); // WebSocket tests DB
      await this.redis.flushdb();
    }

    // Create test directories
    const testDirs = [
      'tests/reports',
      'tests/logs',
      'tests/coverage'
    ];

    for (const dir of testDirs) {
      try {
        await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
    }

    logger.info('Test environment setup complete', 'INTEGRATION_RUNNER');
  }

  /**
   * Run tests in parallel for faster execution
   */
  private async runTestsParallel(suites: TestSuite[]): Promise<void> {
    logger.info('Running tests in parallel', 'INTEGRATION_RUNNER', {
      suiteCount: suites.length
    });

    const parallelSuites = suites.filter(suite => suite.parallel);
    const sequentialSuites = suites.filter(suite => !suite.parallel);

    // Run parallel tests
    if (parallelSuites.length > 0) {
      const parallelPromises = parallelSuites.map(suite => 
        this.runSingleTestSuite(suite)
      );
      
      await Promise.allSettled(parallelPromises);
    }

    // Run sequential tests
    for (const suite of sequentialSuites) {
      await this.runSingleTestSuite(suite);
    }
  }

  /**
   * Run tests sequentially for better isolation
   */
  private async runTestsSequential(suites: TestSuite[]): Promise<void> {
    logger.info('Running tests sequentially', 'INTEGRATION_RUNNER', {
      suiteCount: suites.length
    });

    for (const suite of suites) {
      await this.runSingleTestSuite(suite);
    }
  }

  /**
   * Run a single test suite with monitoring
   */
  private async runSingleTestSuite(suite: TestSuite): Promise<TestResults> {
    logger.info(`Starting test suite: ${suite.name}`, 'INTEGRATION_RUNNER');

    const startTime = Date.now();
    let testProcess: ChildProcess;

    try {
      // Check dependencies
      const unavailableDeps = suite.dependencies.filter(dep => 
        !this.serviceHealth.find(service => 
          service.name === dep && service.status === 'healthy'
        )
      );

      if (unavailableDeps.length > 0) {
        logger.warn(`Skipping ${suite.name} due to unavailable dependencies`, 'INTEGRATION_RUNNER', {
          unavailable: unavailableDeps
        });
        
        return {
          suite: suite.name,
          passed: 0,
          failed: 0,
          skipped: 1,
          duration: Date.now() - startTime,
          errors: [`Dependencies unavailable: ${unavailableDeps.join(', ')}`],
          performance: { avgResponseTime: 0, maxResponseTime: 0, throughput: 0 }
        };
      }

      // Run the test
      testProcess = spawn('npx', ['vitest', 'run', suite.file], {
        cwd: path.join(process.cwd(), 'tests', 'integration'),
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: suite.timeout
      });

      this.testProcesses.set(suite.name, testProcess);

      let stdout = '';
      let stderr = '';

      testProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      testProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const result = await new Promise<TestResults>((resolve, reject) => {
        const timeoutHandler = setTimeout(() => {
          testProcess.kill('SIGKILL');
          reject(new Error(`Test suite ${suite.name} timed out after ${suite.timeout}ms`));
        }, suite.timeout);

        testProcess.on('close', (code) => {
          clearTimeout(timeoutHandler);
          
          const duration = Date.now() - startTime;
          const results = this.parseTestResults(suite.name, stdout, stderr, code || 0, duration);
          
          if (code === 0) {
            resolve(results);
          } else {
            resolve({
              ...results,
              errors: [...results.errors, `Process exited with code ${code}`, stderr]
            });
          }
        });

        testProcess.on('error', (error) => {
          clearTimeout(timeoutHandler);
          reject(error);
        });
      });

      this.results.push(result);
      this.testProcesses.delete(suite.name);

      logger.info(`Completed test suite: ${suite.name}`, 'INTEGRATION_RUNNER', {
        passed: result.passed,
        failed: result.failed,
        duration: result.duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorResult: TestResults = {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error instanceof Error ? error.message : String(error)],
        performance: { avgResponseTime: 0, maxResponseTime: 0, throughput: 0 }
      };

      this.results.push(errorResult);
      this.testProcesses.delete(suite.name);

      logger.error(`Test suite failed: ${suite.name}`, 'INTEGRATION_RUNNER', { error });

      return errorResult;
    }
  }

  /**
   * Parse test results from vitest output
   */
  private parseTestResults(suiteName: string, stdout: string, stderr: string, exitCode: number, duration: number): TestResults {
    // Parse vitest output for test counts
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Look for vitest summary patterns
    const passedMatch = stdout.match(/(\d+)\s+passed/);
    const failedMatch = stdout.match(/(\d+)\s+failed/);
    const skippedMatch = stdout.match(/(\d+)\s+skipped/);

    if (passedMatch) passed = parseInt(passedMatch[1]);
    if (failedMatch) failed = parseInt(failedMatch[1]);
    if (skippedMatch) skipped = parseInt(skippedMatch[1]);

    // Extract performance metrics (custom implementation would be needed)
    const avgResponseTime = this.extractMetric(stdout, /avg response time:\s*(\d+)ms/) || 0;
    const maxResponseTime = this.extractMetric(stdout, /max response time:\s*(\d+)ms/) || 0;
    const throughput = this.extractMetric(stdout, /throughput:\s*([\d.]+)\s*req\/s/) || 0;

    // Extract errors
    const errors: string[] = [];
    if (stderr) errors.push(stderr);
    if (exitCode !== 0) errors.push(`Exit code: ${exitCode}`);

    return {
      suite: suiteName,
      passed,
      failed,
      skipped,
      duration,
      errors,
      performance: {
        avgResponseTime,
        maxResponseTime,
        throughput
      }
    };
  }

  /**
   * Extract numeric metrics from test output
   */
  private extractMetric(output: string, regex: RegExp): number | null {
    const match = output.match(regex);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(): Promise<TestReport> {
    const endTime = new Date();
    const totalDuration = endTime.getTime() - this.startTime.getTime();

    const totalTests = this.results.reduce((sum, result) => 
      sum + result.passed + result.failed + result.skipped, 0);
    const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0);
    const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0);

    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

    // Generate recommendations based on results
    const recommendations: string[] = [];
    
    if (successRate < 90) {
      recommendations.push('Test success rate is below 90%. Review failing tests and improve service reliability.');
    }

    const slowSuites = this.results.filter(r => r.duration > 60000);
    if (slowSuites.length > 0) {
      recommendations.push(`Slow test suites detected: ${slowSuites.map(s => s.suite).join(', ')}. Consider optimization.`);
    }

    const highErrorSuites = this.results.filter(r => r.errors.length > 0);
    if (highErrorSuites.length > 0) {
      recommendations.push('Error-prone test suites identified. Review error logs and improve test stability.');
    }

    return {
      startTime: this.startTime,
      endTime,
      totalDuration,
      environment: process.env.NODE_ENV || 'test',
      serviceHealth: this.serviceHealth,
      suiteResults: this.results,
      summary: {
        totalTests,
        passed: totalPassed,
        failed: totalFailed,
        successRate
      },
      recommendations
    };
  }

  /**
   * Validate test results against thresholds
   */
  private validateTestResults(report: TestReport, coverageThreshold: number): void {
    if (report.summary.successRate < 95) {
      logger.warn('Test success rate below threshold', 'INTEGRATION_RUNNER', {
        successRate: report.summary.successRate,
        threshold: 95
      });
    }

    if (report.summary.failed > 0) {
      logger.warn('Some tests failed', 'INTEGRATION_RUNNER', {
        failed: report.summary.failed,
        total: report.summary.totalTests
      });
    }

    // Check for critical service health issues
    const criticalUnhealthy = report.serviceHealth.filter(
      service => service.status === 'unhealthy' && 
      ['walmart-api-server', 'walmart-nlp-queue'].includes(service.name)
    );

    if (criticalUnhealthy.length > 0) {
      throw new Error(`Critical services are unhealthy: ${criticalUnhealthy.map(s => s.name).join(', ')}`);
    }
  }

  /**
   * Save test report to file
   */
  private async saveTestReport(report: TestReport): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(process.cwd(), 'tests', 'reports', `integration-report-${timestamp}.json`);
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logger.info('Test report saved', 'INTEGRATION_RUNNER', { path: reportPath });

    // Also generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(process.cwd(), 'tests', 'reports', `integration-report-${timestamp}.html`);
    
    await fs.writeFile(htmlPath, htmlReport);
    
    logger.info('HTML report generated', 'INTEGRATION_RUNNER', { path: htmlPath });
  }

  /**
   * Generate HTML report for better visualization
   */
  private generateHtmlReport(report: TestReport): string {
    const successRate = report.summary.successRate.toFixed(1);
    const duration = (report.totalDuration / 1000).toFixed(1);

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f8ff; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; flex: 1; }
        .success { color: #28a745; }
        .warning { color: #ffc107; }
        .danger { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Integration Test Report</h1>
        <p><strong>Environment:</strong> ${report.environment}</p>
        <p><strong>Start Time:</strong> ${report.startTime.toISOString()}</p>
        <p><strong>Duration:</strong> ${duration} seconds</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Success Rate</h3>
            <div class="${report.summary.successRate >= 95 ? 'success' : report.summary.successRate >= 80 ? 'warning' : 'danger'}">
                ${successRate}%
            </div>
        </div>
        <div class="metric">
            <h3>Total Tests</h3>
            <div>${report.summary.totalTests}</div>
        </div>
        <div class="metric">
            <h3>Passed</h3>
            <div class="success">${report.summary.passed}</div>
        </div>
        <div class="metric">
            <h3>Failed</h3>
            <div class="${report.summary.failed > 0 ? 'danger' : ''}">${report.summary.failed}</div>
        </div>
    </div>

    <h2>Test Suites</h2>
    <table>
        <thead>
            <tr>
                <th>Suite</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Duration (s)</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${report.suiteResults.map(suite => `
                <tr>
                    <td>${suite.suite}</td>
                    <td class="success">${suite.passed}</td>
                    <td class="${suite.failed > 0 ? 'danger' : ''}">${suite.failed}</td>
                    <td>${suite.skipped}</td>
                    <td>${(suite.duration / 1000).toFixed(1)}</td>
                    <td class="${suite.failed === 0 ? 'success' : 'danger'}">${suite.failed === 0 ? 'PASS' : 'FAIL'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <h2>Service Health</h2>
    <table>
        <thead>
            <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Response Time (ms)</th>
                <th>Last Check</th>
            </tr>
        </thead>
        <tbody>
            ${report.serviceHealth.map(service => `
                <tr>
                    <td>${service.name}</td>
                    <td class="${service.status === 'healthy' ? 'success' : 'danger'}">${service.status.toUpperCase()}</td>
                    <td>${service.responseTime}</td>
                    <td>${service.lastCheck.toISOString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    ${report.recommendations.length > 0 ? `
    <div class="recommendations">
        <h2>Recommendations</h2>
        <ul>
            ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>
    </div>
    ` : ''}
</body>
</html>
    `;
  }

  /**
   * Cleanup test resources
   */
  private async cleanup(): Promise<void> {
    logger.info('Cleaning up test resources', 'INTEGRATION_RUNNER');

    // Kill any remaining test processes
    for (const [suiteName, process] of this.testProcesses) {
      logger.warn(`Killing remaining test process: ${suiteName}`, 'INTEGRATION_RUNNER');
      process.kill('SIGTERM');
    }

    // Close Redis connection
    if (this.redis) {
      await this.redis.disconnect();
    }

    // Clear process map
    this.testProcesses.clear();

    logger.info('Cleanup complete', 'INTEGRATION_RUNNER');
  }
}

// CLI execution
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  
  const options = {
    parallel: process.argv.includes('--parallel'),
    criticalOnly: process.argv.includes('--critical-only'),
    generateReport: !process.argv.includes('--no-report'),
    coverageThreshold: 80
  };

  runner.runAllTests(options)
    .then((report) => {
      console.log('\n=== Integration Test Summary ===');
      console.log(`Success Rate: ${report.summary.successRate.toFixed(1)}%`);
      console.log(`Total Tests: ${report.summary.totalTests}`);
      console.log(`Passed: ${report.summary.passed}`);
      console.log(`Failed: ${report.summary.failed}`);
      console.log(`Duration: ${(report.totalDuration / 1000).toFixed(1)}s`);
      
      if (report.summary.failed > 0) {
        console.log('\n❌ Some tests failed');
        process.exit(1);
      } else {
        console.log('\n✅ All tests passed');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('Integration test runner failed:', error);
      process.exit(1);
    });
}

export { IntegrationTestRunner, TestReport, TestResults, ServiceHealth };