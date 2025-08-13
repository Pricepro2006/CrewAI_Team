#!/usr/bin/env tsx
/**
 * Email Processing Performance Monitor
 * Real-time monitoring of email processing pipeline performance
 */

import { executeQuery } from "../src/database/ConnectionPool.js";
import { RedisService } from "../src/core/cache/RedisService.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";
import chalk from "chalk";
import cliProgress from "cli-progress";

const logger = new Logger("PerformanceMonitor");

interface PerformanceMetrics {
  // Throughput metrics
  emailsProcessedLastMinute: number;
  emailsProcessedLastHour: number;
  currentThroughput: number; // emails/minute
  peakThroughput: number;
  
  // Timing metrics
  avgPhase1Time: number;
  avgPhase2Time: number;
  avgPhase3Time: number;
  avgTotalTime: number;
  
  // Success metrics
  successRate: number;
  failureRate: number;
  timeoutRate: number;
  
  // Resource metrics
  cacheHitRate: number;
  connectionPoolUtilization: number;
  queueDepth: number;
  
  // LLM metrics
  llmRequestsPerMinute: number;
  avgLLMResponseTime: number;
  llmErrorRate: number;
}

class EmailPerformanceMonitor {
  private redisService: RedisService;
  private progressBar: cliProgress.SingleBar;
  private metrics: PerformanceMetrics;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.redisService = new RedisService();
    this.progressBar = new cliProgress.SingleBar({
      format: 'Throughput |{bar}| {percentage}% | {value}/{total} emails/min | Target: 60',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    this.metrics = {
      emailsProcessedLastMinute: 0,
      emailsProcessedLastHour: 0,
      currentThroughput: 0,
      peakThroughput: 0,
      avgPhase1Time: 0,
      avgPhase2Time: 0,
      avgPhase3Time: 0,
      avgTotalTime: 0,
      successRate: 0,
      failureRate: 0,
      timeoutRate: 0,
      cacheHitRate: 0,
      connectionPoolUtilization: 0,
      queueDepth: 0,
      llmRequestsPerMinute: 0,
      avgLLMResponseTime: 0,
      llmErrorRate: 0,
    };
  }

  async startMonitoring(refreshInterval: number = 5000): Promise<void> {
    console.clear();
    console.log(chalk.cyan.bold("=== Email Processing Performance Monitor ===\n"));

    // Initial metrics fetch
    await this.updateMetrics();
    this.displayMetrics();

    // Start progress bar
    this.progressBar.start(100, 0);

    // Set up periodic updates
    this.monitoringInterval = setInterval(async () => {
      await this.updateMetrics();
      this.displayMetrics();
    }, refreshInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stopMonitoring());
    process.on('SIGTERM', () => this.stopMonitoring());
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Get processing stats from database
      const processingStats = await this.getProcessingStats();
      
      // Get cache stats from Redis
      const cacheStats = await this.getCacheStats();
      
      // Get LLM stats
      const llmStats = await this.getLLMStats();
      
      // Update metrics
      this.metrics = {
        ...this.metrics,
        ...processingStats,
        ...cacheStats,
        ...llmStats,
      };

      // Update peak throughput
      if (this.metrics.currentThroughput > this.metrics.peakThroughput) {
        this.metrics.peakThroughput = this.metrics.currentThroughput;
      }

    } catch (error) {
      logger.error("Failed to update metrics:", error);
    }
  }

  private async getProcessingStats(): Promise<Partial<PerformanceMetrics>> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const stats = await executeQuery((db) => {
      // Last minute stats
      const minuteStats = db.prepare(`
        SELECT 
          COUNT(*) as count,
          AVG(total_processing_time) as avg_time,
          SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failure_count,
          SUM(CASE WHEN processing_status = 'timeout' THEN 1 ELSE 0 END) as timeout_count
        FROM emails
        WHERE processed_at >= ?
      `).get(oneMinuteAgo.toISOString()) as any;

      // Last hour stats
      const hourStats = db.prepare(`
        SELECT COUNT(*) as count
        FROM emails
        WHERE processed_at >= ?
      `).get(oneHourAgo.toISOString()) as any;

      // Phase timing
      const phaseStats = db.prepare(`
        SELECT 
          AVG(quick_processing_time) as avg_phase1,
          AVG(deep_processing_time) as avg_phase2,
          AVG(total_processing_time - quick_processing_time - deep_processing_time) as avg_phase3
        FROM email_analysis
        WHERE created_at >= ?
      `).get(oneMinuteAgo.toISOString()) as any;

      return {
        minuteStats,
        hourStats,
        phaseStats,
      };
    });

    const totalLastMinute = stats.minuteStats.count || 0;
    const successCount = stats.minuteStats.success_count || 0;
    const failureCount = stats.minuteStats.failure_count || 0;
    const timeoutCount = stats.minuteStats.timeout_count || 0;

    return {
      emailsProcessedLastMinute: totalLastMinute,
      emailsProcessedLastHour: stats.hourStats.count || 0,
      currentThroughput: totalLastMinute, // emails/minute
      avgTotalTime: stats.minuteStats.avg_time || 0,
      avgPhase1Time: stats.phaseStats.avg_phase1 || 0,
      avgPhase2Time: stats.phaseStats.avg_phase2 || 0,
      avgPhase3Time: stats.phaseStats.avg_phase3 || 0,
      successRate: totalLastMinute > 0 ? (successCount / totalLastMinute) * 100 : 0,
      failureRate: totalLastMinute > 0 ? (failureCount / totalLastMinute) * 100 : 0,
      timeoutRate: totalLastMinute > 0 ? (timeoutCount / totalLastMinute) * 100 : 0,
    };
  }

  private async getCacheStats(): Promise<Partial<PerformanceMetrics>> {
    try {
      // Get cache hit/miss counts
      const cacheHits = await this.redisService.get<number>("stats:cache_hits") || 0;
      const cacheMisses = await this.redisService.get<number>("stats:cache_misses") || 0;
      const totalCacheRequests = cacheHits + cacheMisses;

      // Get queue depth
      const queueDepth = await this.redisService.get<number>("stats:queue_depth") || 0;

      return {
        cacheHitRate: totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0,
        queueDepth,
      };
    } catch (error) {
      return {
        cacheHitRate: 0,
        queueDepth: 0,
      };
    }
  }

  private async getLLMStats(): Promise<Partial<PerformanceMetrics>> {
    try {
      // Get LLM request stats
      const llmRequests = await this.redisService.get<number>("stats:llm_requests_minute") || 0;
      const llmTotalTime = await this.redisService.get<number>("stats:llm_total_time") || 0;
      const llmErrors = await this.redisService.get<number>("stats:llm_errors") || 0;
      
      const avgResponseTime = llmRequests > 0 ? llmTotalTime / llmRequests : 0;
      const errorRate = llmRequests > 0 ? (llmErrors / llmRequests) * 100 : 0;

      return {
        llmRequestsPerMinute: llmRequests,
        avgLLMResponseTime: avgResponseTime,
        llmErrorRate: errorRate,
      };
    } catch (error) {
      return {
        llmRequestsPerMinute: 0,
        avgLLMResponseTime: 0,
        llmErrorRate: 0,
      };
    }
  }

  private displayMetrics(): void {
    // Update progress bar
    const throughputPercentage = Math.min(100, (this.metrics.currentThroughput / 60) * 100);
    this.progressBar.update(throughputPercentage);

    // Clear previous output (keeping progress bar)
    process.stdout.write('\x1B[2J\x1B[H');
    console.log(chalk.cyan.bold("=== Email Processing Performance Monitor ===\n"));

    // Throughput section
    console.log(chalk.yellow.bold("📊 Throughput Metrics:"));
    console.log(`  Current: ${this.formatThroughput(this.metrics.currentThroughput)}`);
    console.log(`  Peak: ${this.formatThroughput(this.metrics.peakThroughput)}`);
    console.log(`  Last Hour: ${chalk.white(this.metrics.emailsProcessedLastHour)} emails`);
    console.log();

    // Timing section
    console.log(chalk.blue.bold("⏱️  Processing Times:"));
    console.log(`  Phase 1: ${this.formatTime(this.metrics.avgPhase1Time)}`);
    console.log(`  Phase 2: ${this.formatTime(this.metrics.avgPhase2Time)}`);
    console.log(`  Phase 3: ${this.formatTime(this.metrics.avgPhase3Time)}`);
    console.log(`  Total: ${this.formatTime(this.metrics.avgTotalTime)}`);
    console.log();

    // Success metrics
    console.log(chalk.green.bold("✅ Success Metrics:"));
    console.log(`  Success Rate: ${this.formatPercentage(this.metrics.successRate, 'success')}`);
    console.log(`  Failure Rate: ${this.formatPercentage(this.metrics.failureRate, 'error')}`);
    console.log(`  Timeout Rate: ${this.formatPercentage(this.metrics.timeoutRate, 'warning')}`);
    console.log();

    // Performance section
    console.log(chalk.magenta.bold("🚀 Performance Optimization:"));
    console.log(`  Cache Hit Rate: ${this.formatPercentage(this.metrics.cacheHitRate, 'cache')}`);
    console.log(`  Queue Depth: ${chalk.white(this.metrics.queueDepth)} emails`);
    console.log(`  LLM Requests/min: ${chalk.white(this.metrics.llmRequestsPerMinute)}`);
    console.log(`  Avg LLM Response: ${this.formatTime(this.metrics.avgLLMResponseTime)}`);
    console.log();

    // Status indicator
    this.displayStatusIndicator();
    
    // Progress bar is displayed at the bottom
    console.log("\n");
    this.progressBar.render();
  }

  private formatThroughput(value: number): string {
    if (value >= 60) {
      return chalk.green.bold(`${value} emails/min ✨`);
    } else if (value >= 40) {
      return chalk.yellow(`${value} emails/min`);
    } else {
      return chalk.red(`${value} emails/min ⚠️`);
    }
  }

  private formatTime(ms: number): string {
    if (ms < 1000) {
      return chalk.green(`${Math.round(ms)}ms`);
    } else if (ms < 10000) {
      return chalk.yellow(`${(ms / 1000).toFixed(1)}s`);
    } else {
      return chalk.red(`${(ms / 1000).toFixed(1)}s ⚠️`);
    }
  }

  private formatPercentage(value: number, type: string): string {
    const formatted = `${value.toFixed(1)}%`;
    
    switch (type) {
      case 'success':
        return value >= 95 ? chalk.green(formatted) : 
               value >= 80 ? chalk.yellow(formatted) : 
               chalk.red(formatted);
      case 'error':
        return value <= 5 ? chalk.green(formatted) : 
               value <= 20 ? chalk.yellow(formatted) : 
               chalk.red(formatted);
      case 'warning':
        return value <= 2 ? chalk.green(formatted) : 
               value <= 10 ? chalk.yellow(formatted) : 
               chalk.red(formatted);
      case 'cache':
        return value >= 70 ? chalk.green(formatted) : 
               value >= 50 ? chalk.yellow(formatted) : 
               chalk.red(formatted);
      default:
        return chalk.white(formatted);
    }
  }

  private displayStatusIndicator(): void {
    const throughput = this.metrics.currentThroughput;
    const successRate = this.metrics.successRate;
    
    let status: string;
    let indicator: string;
    
    if (throughput >= 60 && successRate >= 95) {
      status = chalk.green.bold("OPTIMAL");
      indicator = "🟢";
    } else if (throughput >= 40 && successRate >= 80) {
      status = chalk.yellow.bold("GOOD");
      indicator = "🟡";
    } else if (throughput >= 20 && successRate >= 60) {
      status = chalk.yellow("DEGRADED");
      indicator = "🟠";
    } else {
      status = chalk.red.bold("CRITICAL");
      indicator = "🔴";
    }

    console.log(chalk.bold(`\n${indicator} System Status: ${status}`));
    
    // Recommendations
    if (throughput < 60) {
      console.log(chalk.dim("\n💡 Recommendations:"));
      
      if (this.metrics.cacheHitRate < 50) {
        console.log(chalk.dim("  - Increase cache TTL or implement similarity matching"));
      }
      
      if (this.metrics.avgPhase2Time > 10000) {
        console.log(chalk.dim("  - Optimize Phase 2 prompts or increase parallelism"));
      }
      
      if (this.metrics.llmErrorRate > 10) {
        console.log(chalk.dim("  - Check Ollama server health and model availability"));
      }
      
      if (this.metrics.queueDepth > 50) {
        console.log(chalk.dim("  - Scale up processing workers or increase batch size"));
      }
    }
  }

  private async stopMonitoring(): Promise<void> {
    console.log(chalk.yellow("\n\nStopping monitoring..."));
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.progressBar.stop();
    
    // Display final summary
    console.log(chalk.cyan.bold("\n=== Final Summary ==="));
    console.log(`Peak Throughput: ${this.formatThroughput(this.metrics.peakThroughput)}`);
    console.log(`Total Processed (Last Hour): ${this.metrics.emailsProcessedLastHour} emails`);
    console.log(`Average Success Rate: ${this.formatPercentage(this.metrics.successRate, 'success')}`);
    
    await this.redisService.close();
    process.exit(0);
  }
}

// Main execution
async function main() {
  const monitor = new EmailPerformanceMonitor();
  
  const args = process.argv.slice(2);
  const refreshInterval = parseInt(args[0]) || 5000; // Default 5 seconds
  
  console.log(chalk.dim(`Refresh interval: ${refreshInterval}ms`));
  console.log(chalk.dim("Press Ctrl+C to stop monitoring\n"));
  
  await monitor.startMonitoring(refreshInterval);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { EmailPerformanceMonitor };