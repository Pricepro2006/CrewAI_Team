#!/usr/bin/env tsx
/**
 * Load Test Results Analyzer
 * Analyzes load test results and provides detailed performance insights
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { PERFORMANCE_BASELINES } from './load-test-config';

interface TestResult {
  scenario: string;
  timestamp: string;
  duration: number;
  metrics: {
    responseTimes: ResponseTimeMetrics;
    errorRate: number;
    throughput: number;
    concurrency: number;
  };
  resources: {
    cpu: CPUMetrics;
    memory: MemoryMetrics;
    network: NetworkMetrics;
  };
}

interface ResponseTimeMetrics {
  min: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

interface CPUMetrics {
  avg: number;
  max: number;
  sustained: number;
}

interface MemoryMetrics {
  avg: number;
  max: number;
  growth: number;
}

interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  connections: number;
}

interface PerformanceIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  issue: string;
  impact: string;
  recommendation: string;
  metrics?: any;
}

class ResultsAnalyzer {
  private results: TestResult[] = [];
  private issues: PerformanceIssue[] = [];
  private recommendations: string[] = [];

  async analyzeResults(resultsDir: string): Promise<void> {
    console.log(chalk.bold.cyan('\n🔍 Analyzing Load Test Results\n'));

    try {
      // Load all result files
      await this.loadResults(resultsDir);

      // Perform various analyses
      this.analyzeResponseTimes();
      this.analyzeErrorRates();
      this.analyzeThroughput();
      this.analyzeResourceUtilization();
      this.analyzeScalability();
      this.analyzeBottlenecks();
      this.analyzeReliability();

      // Generate insights
      this.generateInsights();

      // Print report
      this.printReport();

      // Save detailed report
      await this.saveDetailedReport(resultsDir);

    } catch (error) {
      console.error(chalk.red('Error analyzing results:'), error);
    }
  }

  private async loadResults(resultsDir: string): Promise<void> {
    const files = await fs.readdir(resultsDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const content = await fs.readFile(path.join(resultsDir, file), 'utf-8');
      try {
        const result = JSON.parse(content);
        this.results.push(result);
      } catch (error) {
        console.warn(chalk.yellow(`Failed to parse ${file}`));
      }
    }

    console.log(chalk.green(`✅ Loaded ${this.results.length} test results`));
  }

  private analyzeResponseTimes(): void {
    console.log(chalk.blue('Analyzing response times...'));

    for (const result of this.results) {
      const metrics = result.metrics.responseTimes;
      const baseline = PERFORMANCE_BASELINES.response_times.nlp;

      // Check against baselines
      if (metrics.p95 > baseline.p95 * 1.5) {
        this.issues.push({
          severity: 'critical',
          category: 'Response Time',
          issue: `P95 response time (${metrics.p95}ms) exceeds baseline by >50%`,
          impact: 'Users experiencing significant delays',
          recommendation: 'Optimize slow queries, add caching, or scale horizontally',
          metrics: { p95: metrics.p95, baseline: baseline.p95 }
        });
      } else if (metrics.p95 > baseline.p95 * 1.2) {
        this.issues.push({
          severity: 'warning',
          category: 'Response Time',
          issue: `P95 response time (${metrics.p95}ms) exceeds baseline by >20%`,
          impact: 'Some users experiencing delays',
          recommendation: 'Review recent changes and optimize hot paths',
          metrics: { p95: metrics.p95, baseline: baseline.p95 }
        });
      }

      // Check for high variance
      const variance = metrics.max - metrics.min;
      if (variance > metrics.avg * 10) {
        this.issues.push({
          severity: 'warning',
          category: 'Response Time',
          issue: 'High response time variance detected',
          impact: 'Inconsistent user experience',
          recommendation: 'Investigate outliers and implement request timeouts',
          metrics: { min: metrics.min, max: metrics.max, avg: metrics.avg }
        });
      }
    }
  }

  private analyzeErrorRates(): void {
    console.log(chalk.blue('Analyzing error rates...'));

    for (const result of this.results) {
      const errorRate = result.metrics.errorRate;
      const baseline = PERFORMANCE_BASELINES.error_rates;

      if (errorRate > baseline.critical) {
        this.issues.push({
          severity: 'critical',
          category: 'Reliability',
          issue: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds critical threshold`,
          impact: 'Service reliability severely compromised',
          recommendation: 'Immediate investigation required - check logs and implement circuit breakers',
          metrics: { errorRate, threshold: baseline.critical }
        });
      } else if (errorRate > baseline.warning) {
        this.issues.push({
          severity: 'warning',
          category: 'Reliability',
          issue: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds warning threshold`,
          impact: 'Degraded service reliability',
          recommendation: 'Implement retry logic and improve error handling',
          metrics: { errorRate, threshold: baseline.warning }
        });
      }
    }
  }

  private analyzeThroughput(): void {
    console.log(chalk.blue('Analyzing throughput...'));

    const throughputs = this.results.map(r => r.metrics.throughput);
    const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const maxThroughput = Math.max(...throughputs);
    const baseline = PERFORMANCE_BASELINES.throughput.overall;

    if (maxThroughput < baseline * 0.5) {
      this.issues.push({
        severity: 'critical',
        category: 'Throughput',
        issue: `Maximum throughput (${maxThroughput} req/s) is <50% of baseline`,
        impact: 'System cannot handle expected load',
        recommendation: 'Scale services, optimize database queries, and review architecture',
        metrics: { maxThroughput, baseline }
      });
    }

    // Check for throughput degradation under load
    const highLoadResults = this.results.filter(r => r.metrics.concurrency > 100);
    if (highLoadResults.length > 0) {
      const highLoadThroughput = highLoadResults.map(r => r.metrics.throughput);
      const avgHighLoad = highLoadThroughput.reduce((a, b) => a + b, 0) / highLoadThroughput.length;
      
      if (avgHighLoad < avgThroughput * 0.7) {
        this.issues.push({
          severity: 'warning',
          category: 'Scalability',
          issue: 'Throughput degrades significantly under high load',
          impact: 'System doesn\'t scale linearly',
          recommendation: 'Review connection pooling, implement caching, and optimize hot paths',
          metrics: { normalThroughput: avgThroughput, highLoadThroughput: avgHighLoad }
        });
      }
    }
  }

  private analyzeResourceUtilization(): void {
    console.log(chalk.blue('Analyzing resource utilization...'));

    for (const result of this.results) {
      const cpu = result.resources.cpu;
      const memory = result.resources.memory;
      const baselines = PERFORMANCE_BASELINES.resource_usage;

      // CPU analysis
      if (cpu.max > baselines.cpu.critical) {
        this.issues.push({
          severity: 'critical',
          category: 'Resources',
          issue: `CPU usage peaked at ${cpu.max}%`,
          impact: 'System at risk of becoming unresponsive',
          recommendation: 'Optimize CPU-intensive operations or scale horizontally',
          metrics: { cpu: cpu.max, threshold: baselines.cpu.critical }
        });
      } else if (cpu.sustained > baselines.cpu.warning) {
        this.issues.push({
          severity: 'warning',
          category: 'Resources',
          issue: `Sustained high CPU usage (${cpu.sustained}%)`,
          impact: 'Limited headroom for traffic spikes',
          recommendation: 'Profile CPU hotspots and optimize algorithms',
          metrics: { cpu: cpu.sustained, threshold: baselines.cpu.warning }
        });
      }

      // Memory analysis
      if (memory.max > baselines.memory.critical) {
        this.issues.push({
          severity: 'critical',
          category: 'Resources',
          issue: `Memory usage peaked at ${memory.max}%`,
          impact: 'Risk of out-of-memory errors',
          recommendation: 'Fix memory leaks and optimize data structures',
          metrics: { memory: memory.max, threshold: baselines.memory.critical }
        });
      }

      // Memory growth analysis
      if (memory.growth > 10) {
        this.issues.push({
          severity: 'warning',
          category: 'Resources',
          issue: `Memory grew by ${memory.growth}% during test`,
          impact: 'Potential memory leak',
          recommendation: 'Profile memory allocation and fix leaks',
          metrics: { growth: memory.growth }
        });
      }
    }
  }

  private analyzeScalability(): void {
    console.log(chalk.blue('Analyzing scalability...'));

    // Group results by concurrency level
    const concurrencyGroups = new Map<number, TestResult[]>();
    
    for (const result of this.results) {
      const concurrency = result.metrics.concurrency;
      if (!concurrencyGroups.has(concurrency)) {
        concurrencyGroups.set(concurrency, []);
      }
      concurrencyGroups.get(concurrency)!.push(result);
    }

    // Analyze scalability curve
    const scalabilityData: Array<{ concurrency: number; throughput: number; responseTime: number }> = [];
    
    for (const [concurrency, results] of concurrencyGroups) {
      const avgThroughput = results.reduce((sum, r) => sum + r.metrics.throughput, 0) / results.length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.metrics.responseTimes.avg, 0) / results.length;
      
      scalabilityData.push({ concurrency, throughput: avgThroughput, responseTime: avgResponseTime });
    }

    // Sort by concurrency
    scalabilityData.sort((a, b) => a.concurrency - b.concurrency);

    // Check for scalability issues
    for (let i = 1; i < scalabilityData.length; i++) {
      const prev = scalabilityData[i - 1];
      const curr = scalabilityData[i];
      
      // Check if throughput plateaus or decreases
      if (curr.throughput <= prev.throughput && curr.concurrency > prev.concurrency) {
        this.issues.push({
          severity: 'warning',
          category: 'Scalability',
          issue: `Throughput plateaus at ${prev.concurrency} concurrent users`,
          impact: 'System has reached maximum capacity',
          recommendation: 'Identify bottlenecks and scale critical components',
          metrics: { 
            optimalConcurrency: prev.concurrency,
            maxThroughput: prev.throughput
          }
        });
        break;
      }

      // Check for response time degradation
      const responseTimeIncrease = (curr.responseTime - prev.responseTime) / prev.responseTime;
      if (responseTimeIncrease > 0.5) {
        this.issues.push({
          severity: 'warning',
          category: 'Scalability',
          issue: `Response time degrades rapidly beyond ${prev.concurrency} users`,
          impact: 'Poor user experience at scale',
          recommendation: 'Implement caching and optimize database queries',
          metrics: {
            concurrency: curr.concurrency,
            responseTimeIncrease: `${(responseTimeIncrease * 100).toFixed(1)}%`
          }
        });
      }
    }
  }

  private analyzeBottlenecks(): void {
    console.log(chalk.blue('Identifying bottlenecks...'));

    // Analyze service-specific metrics if available
    const bottlenecks: string[] = [];

    // Database bottleneck detection
    const dbIntensiveTests = this.results.filter(r => 
      r.metrics.responseTimes.p95 > 500 && r.metrics.throughput < 100
    );
    
    if (dbIntensiveTests.length > 0) {
      bottlenecks.push('Database queries');
      this.recommendations.push('• Optimize database queries with proper indexing');
      this.recommendations.push('• Implement query result caching');
      this.recommendations.push('• Consider read replicas for read-heavy workloads');
    }

    // Ollama/LLM bottleneck detection
    const llmBottlenecks = this.results.filter(r =>
      r.scenario.includes('nlp') && r.metrics.responseTimes.avg > 1000
    );

    if (llmBottlenecks.length > 0) {
      bottlenecks.push('LLM inference');
      this.recommendations.push('• Implement LLM response caching for common queries');
      this.recommendations.push('• Consider smaller, faster models for simple tasks');
      this.recommendations.push('• Batch LLM requests when possible');
      this.recommendations.push('• Add GPU acceleration for Ollama');
    }

    // Network bottleneck detection
    const networkBottlenecks = this.results.filter(r =>
      r.resources.network.connections > 1000
    );

    if (networkBottlenecks.length > 0) {
      bottlenecks.push('Network connections');
      this.recommendations.push('• Implement connection pooling');
      this.recommendations.push('• Use HTTP/2 for multiplexing');
      this.recommendations.push('• Add CDN for static content');
    }

    if (bottlenecks.length > 0) {
      this.issues.push({
        severity: 'warning',
        category: 'Bottlenecks',
        issue: `Identified bottlenecks: ${bottlenecks.join(', ')}`,
        impact: 'Performance limitations',
        recommendation: 'See specific recommendations below'
      });
    }
  }

  private analyzeReliability(): void {
    console.log(chalk.blue('Analyzing reliability...'));

    // Check for circuit breaker effectiveness
    const chaosTests = this.results.filter(r => r.scenario === 'chaos');
    
    if (chaosTests.length > 0) {
      for (const test of chaosTests) {
        if (test.metrics.errorRate < 0.5) {
          this.issues.push({
            severity: 'info',
            category: 'Reliability',
            issue: 'Circuit breakers working effectively',
            impact: 'System shows good resilience',
            recommendation: 'Continue monitoring circuit breaker configurations'
          });
        } else {
          this.issues.push({
            severity: 'critical',
            category: 'Reliability',
            issue: 'Circuit breakers not preventing cascading failures',
            impact: 'System vulnerable to widespread outages',
            recommendation: 'Review circuit breaker thresholds and timeout configurations'
          });
        }
      }
    }

    // Check for recovery time
    const recoveryTests = this.results.filter(r => r.scenario.includes('recovery'));
    
    for (const test of recoveryTests) {
      const recoveryTime = test.duration;
      if (recoveryTime > 60000) { // 1 minute
        this.issues.push({
          severity: 'warning',
          category: 'Reliability',
          issue: `Slow recovery time: ${(recoveryTime / 1000).toFixed(1)}s`,
          impact: 'Extended downtime during failures',
          recommendation: 'Implement health checks and auto-restart mechanisms'
        });
      }
    }
  }

  private generateInsights(): void {
    console.log(chalk.blue('Generating insights...'));

    // Overall system health score
    const criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
    const warningIssues = this.issues.filter(i => i.severity === 'warning').length;
    
    let healthScore = 100;
    healthScore -= criticalIssues * 20;
    healthScore -= warningIssues * 10;
    healthScore = Math.max(0, healthScore);

    // Performance grade
    let grade: string;
    if (healthScore >= 90) grade = 'A';
    else if (healthScore >= 80) grade = 'B';
    else if (healthScore >= 70) grade = 'C';
    else if (healthScore >= 60) grade = 'D';
    else grade = 'F';

    // Add general recommendations based on grade
    if (grade <= 'C') {
      this.recommendations.push('• Consider implementing auto-scaling policies');
      this.recommendations.push('• Add comprehensive monitoring and alerting');
      this.recommendations.push('• Perform regular load testing in staging environment');
      this.recommendations.push('• Create performance regression tests');
    }

    // Store for report
    this.healthScore = healthScore;
    this.performanceGrade = grade;
  }

  private healthScore: number = 0;
  private performanceGrade: string = '';

  private printReport(): void {
    console.log(chalk.bold.cyan('\n📊 Load Test Analysis Report\n'));

    // Health summary
    const gradeColor = this.performanceGrade === 'A' ? chalk.green :
                      this.performanceGrade === 'B' ? chalk.yellow :
                      this.performanceGrade === 'C' ? chalk.yellow :
                      chalk.red;

    console.log(chalk.bold('System Health Summary:'));
    console.log(`  Performance Grade: ${gradeColor.bold(this.performanceGrade)}`);
    console.log(`  Health Score: ${this.healthScore}/100`);
    console.log();

    // Issues by severity
    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    const warningIssues = this.issues.filter(i => i.severity === 'warning');
    const infoIssues = this.issues.filter(i => i.severity === 'info');

    if (criticalIssues.length > 0) {
      console.log(chalk.red.bold('🚨 Critical Issues:'));
      criticalIssues.forEach(issue => {
        console.log(chalk.red(`  • ${issue.issue}`));
        console.log(chalk.gray(`    Impact: ${issue.impact}`));
        console.log(chalk.gray(`    Fix: ${issue.recommendation}`));
      });
      console.log();
    }

    if (warningIssues.length > 0) {
      console.log(chalk.yellow.bold('⚠️  Warnings:'));
      warningIssues.forEach(issue => {
        console.log(chalk.yellow(`  • ${issue.issue}`));
        console.log(chalk.gray(`    Impact: ${issue.impact}`));
        console.log(chalk.gray(`    Fix: ${issue.recommendation}`));
      });
      console.log();
    }

    if (infoIssues.length > 0) {
      console.log(chalk.blue.bold('ℹ️  Information:'));
      infoIssues.forEach(issue => {
        console.log(chalk.blue(`  • ${issue.issue}`));
      });
      console.log();
    }

    // Recommendations
    if (this.recommendations.length > 0) {
      console.log(chalk.magenta.bold('💡 Recommendations:'));
      this.recommendations.forEach(rec => {
        console.log(chalk.magenta(rec));
      });
      console.log();
    }

    // Key metrics summary
    console.log(chalk.cyan.bold('📈 Key Metrics:'));
    
    if (this.results.length > 0) {
      const avgResponseTimes = this.results.map(r => r.metrics.responseTimes.avg);
      const avgThroughputs = this.results.map(r => r.metrics.throughput);
      const avgErrorRates = this.results.map(r => r.metrics.errorRate);

      console.log(`  Average Response Time: ${this.average(avgResponseTimes).toFixed(2)}ms`);
      console.log(`  Average Throughput: ${this.average(avgThroughputs).toFixed(2)} req/s`);
      console.log(`  Average Error Rate: ${(this.average(avgErrorRates) * 100).toFixed(2)}%`);
    }
  }

  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private async saveDetailedReport(resultsDir: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      healthScore: this.healthScore,
      performanceGrade: this.performanceGrade,
      issues: this.issues,
      recommendations: this.recommendations,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        criticalIssues: this.issues.filter(i => i.severity === 'critical').length,
        warnings: this.issues.filter(i => i.severity === 'warning').length
      }
    };

    const reportPath = path.join(resultsDir, 'analysis-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.green(`\n✅ Detailed report saved to: ${reportPath}`));
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const resultsDir = args[0] || './results/latest';
  
  const analyzer = new ResultsAnalyzer();
  analyzer.analyzeResults(resultsDir).catch(console.error);
}

export default ResultsAnalyzer;