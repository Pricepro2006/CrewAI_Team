#!/usr/bin/env tsx

/**
 * Cache Monitoring Script
 * 
 * This script monitors the BusinessSearchCache performance in real-time.
 * It displays cache hits, misses, hot queries, and memory usage.
 * 
 * Usage: tsx scripts/monitor-cache.ts [--interval=5000]
 */

import { BusinessSearchCache } from '../src/core/cache/BusinessSearchCache';
import { BusinessSearchMiddleware } from '../src/core/middleware/BusinessSearchMiddleware';
import chalk from 'chalk';
import Table from 'cli-table3';

// Parse command line arguments
const args = process.argv.slice(2);
const interval = parseInt(
  args.find(arg => arg.startsWith('--interval='))?.split('=')[1] || '5000'
);

// Initialize middleware with cache
const middleware = new BusinessSearchMiddleware({
  cacheEnabled: true,
  cacheMaxAge: 60 * 60 * 1000, // 1 hour
  useRedis: process.env.USE_REDIS === 'true'
});

// ANSI escape codes for clearing screen
const clearScreen = () => {
  process.stdout.write('\x1Bc');
};

// Format bytes to human readable
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format percentage with color
const formatPercentage = (value: number): string => {
  if (value >= 80) return chalk.green(`${value.toFixed(1)}%`);
  if (value >= 50) return chalk.yellow(`${value.toFixed(1)}%`);
  return chalk.red(`${value.toFixed(1)}%`);
};

// Display cache statistics
const displayStats = () => {
  clearScreen();
  
  const stats = middleware.getCacheStats();
  const analysis = middleware.analyzeCachePerformance();
  const metrics = middleware.getMetrics();
  
  // Header
  console.log(chalk.bold.cyan('\n🔍 Business Search Cache Monitor\n'));
  console.log(chalk.gray(`Refresh interval: ${interval}ms | Press Ctrl+C to exit\n`));
  
  // Overview table
  const overviewTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 20]
  });
  
  overviewTable.push(
    ['Total Requests', metrics.totalRequests.toString()],
    ['Cache Hits', chalk.green(stats.hits.toString())],
    ['Cache Misses', chalk.red(stats.misses.toString())],
    ['Hit Rate', formatPercentage(stats.hitRate)],
    ['Entries', `${stats.size} / ${1000}`],
    ['Memory Usage', formatBytes(stats.memoryUsage)],
    ['Memory Pressure', formatPercentage(analysis.memoryPressure)],
    ['Avg Response Time', `${stats.avgResponseTime.toFixed(2)}ms`],
    ['Stale Entries', analysis.staleEntries.toString()],
    ['Rate Limited', chalk.yellow(metrics.rateLimitedRequests.toString())]
  );
  
  console.log(chalk.bold('📊 Cache Overview'));
  console.log(overviewTable.toString());
  
  // Hot queries table
  if (analysis.hotQueries.length > 0) {
    console.log(chalk.bold('\n🔥 Hot Queries (Top 5)'));
    
    const hotQueriesTable = new Table({
      head: ['Query', 'Location', 'Hits'],
      colWidths: [50, 20, 10]
    });
    
    analysis.hotQueries.slice(0, 5).forEach(query => {
      hotQueriesTable.push([
        query.query.slice(0, 45) + (query.query.length > 45 ? '...' : ''),
        query.location || 'N/A',
        query.hitCount.toString()
      ]);
    });
    
    console.log(hotQueriesTable.toString());
  }
  
  // Performance indicators
  console.log(chalk.bold('\n⚡ Performance Indicators'));
  
  const perfTable = new Table({
    head: ['Indicator', 'Status', 'Details'],
    colWidths: [25, 15, 40]
  });
  
  // Hit rate indicator
  const hitRateStatus = stats.hitRate >= 70 ? '✅ Good' : 
                       stats.hitRate >= 40 ? '⚠️  Fair' : '❌ Poor';
  perfTable.push(['Hit Rate', hitRateStatus, `${stats.hitRate.toFixed(1)}% (target: >70%)`]);
  
  // Memory pressure indicator
  const memStatus = analysis.memoryPressure < 80 ? '✅ Good' : 
                   analysis.memoryPressure < 90 ? '⚠️  Warning' : '❌ Critical';
  perfTable.push(['Memory', memStatus, `${analysis.memoryPressure.toFixed(1)}% used`]);
  
  // Latency indicator
  const latencyStatus = metrics.averageLatency < 100 ? '✅ Fast' :
                       metrics.averageLatency < 500 ? '⚠️  Moderate' : '❌ Slow';
  perfTable.push(['Latency', latencyStatus, `${metrics.averageLatency.toFixed(0)}ms average`]);
  
  // Circuit breaker status
  const cbStatus = metrics.circuitBreakerStatus === 'closed' ? '✅ Closed' :
                  metrics.circuitBreakerStatus === 'open' ? '❌ Open' : '⚠️  Half-Open';
  perfTable.push(['Circuit Breaker', cbStatus, metrics.circuitBreakerStatus]);
  
  console.log(perfTable.toString());
  
  // Recommendations
  console.log(chalk.bold('\n💡 Recommendations'));
  
  const recommendations: string[] = [];
  
  if (stats.hitRate < 50) {
    recommendations.push('• Low hit rate - consider preloading common queries');
  }
  
  if (analysis.memoryPressure > 80) {
    recommendations.push('• High memory pressure - consider increasing cache size');
  }
  
  if (analysis.staleEntries > stats.size * 0.3) {
    recommendations.push('• Many stale entries - consider adjusting TTL or clearing cache');
  }
  
  if (metrics.rateLimitedRequests > metrics.totalRequests * 0.1) {
    recommendations.push('• High rate limiting - consider adjusting rate limits');
  }
  
  if (recommendations.length === 0) {
    console.log(chalk.green('✨ Cache is performing optimally!'));
  } else {
    recommendations.forEach(rec => console.log(chalk.yellow(rec)));
  }
  
  // Footer
  console.log(chalk.gray('\n─'.repeat(80)));
  console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}`));
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n👋 Shutting down cache monitor...'));
  
  // Display final stats
  const finalStats = middleware.getCacheStats();
  console.log(chalk.cyan(`\nFinal Statistics:`));
  console.log(`  Total Hits: ${finalStats.hits}`);
  console.log(`  Total Misses: ${finalStats.misses}`);
  console.log(`  Final Hit Rate: ${finalStats.hitRate.toFixed(1)}%`);
  
  await middleware.cleanup();
  process.exit(0);
});

// Start monitoring
console.log(chalk.cyan('Starting cache monitor...'));

// Initial display
displayStats();

// Update at interval
setInterval(displayStats, interval);

// Keep process alive
process.stdin.resume();