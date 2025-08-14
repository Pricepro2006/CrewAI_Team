#!/usr/bin/env ts-node

/**
 * Comprehensive Performance Profiling Script for Walmart Grocery Agent
 * Analyzes CPU, Memory, I/O bottlenecks across all components
 */

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { performance, PerformanceObserver } from 'perf_hooks';
import * as v8 from 'v8';
import * as cluster from 'cluster';
import Database from 'better-sqlite3';
import WebSocket from 'ws';
import axios from 'axios';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface PerformanceMetrics {
  timestamp: number;
  component: string;
  metric: string;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

interface ComponentProfile {
  name: string;
  cpu: {
    usage: number;
    userTime: number;
    systemTime: number;
  };
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  io?: {
    reads: number;
    writes: number;
    readBytes: number;
    writeBytes: number;
  };
  latency?: {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
  };
}

class PerformanceProfiler {
  private metrics: PerformanceMetrics[] = [];
  private startTime: number;
  private profileDir: string;
  private heapSnapshotInterval?: NodeJS.Timeout;
  private cpuProfiler?: any;

  constructor() {
    this.startTime = Date.now();
    this.profileDir = path.join(process.cwd(), 'performance-profiles', new Date().toISOString().replace(/:/g, '-'));
    fs.mkdirSync(this.profileDir, { recursive: true });
    
    console.log(`📊 Performance Profiler Started`);
    console.log(`📁 Output Directory: ${this.profileDir}`);
  }

  // 1. System Resource Monitoring
  async profileSystemResources(): Promise<void> {
    console.log('\n🖥️  Profiling System Resources...');
    
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const loadAvg = os.loadavg();
    
    const systemProfile = {
      timestamp: Date.now(),
      cpu: {
        cores: cpus.length,
        model: cpus[0].model,
        speed: cpus[0].speed,
        loadAverage: {
          '1min': loadAvg[0],
          '5min': loadAvg[1],
          '15min': loadAvg[2]
        }
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
        usagePercent: ((totalMemory - freeMemory) / totalMemory) * 100
      },
      platform: os.platform(),
      uptime: os.uptime()
    };

    fs.writeFileSync(
      path.join(this.profileDir, 'system-profile.json'),
      JSON.stringify(systemProfile, null, 2)
    );

    console.log(`  ✅ CPU Cores: ${systemProfile.cpu.cores}`);
    console.log(`  ✅ Memory Usage: ${systemProfile.memory.usagePercent.toFixed(2)}%`);
    console.log(`  ✅ Load Average: ${loadAvg.map(l => l.toFixed(2)).join(', ')}`);
  }

  // 2. Database Performance Analysis
  async profileDatabase(): Promise<void> {
    console.log('\n🗄️  Profiling Database Performance...');
    
    const dbPath = path.join(process.cwd(), 'walmart_grocery.db');
    const mainDbPath = path.join(process.cwd(), 'app.db');
    
    const profiles = [];

    for (const [name, dbFile] of [['walmart_grocery', dbPath], ['main_app', mainDbPath]]) {
      if (!fs.existsSync(dbFile)) {
        console.log(`  ⚠️  Database ${name} not found`);
        continue;
      }

      const db = new Database(dbFile, { readonly: true });
      
      try {
        // Analyze database statistics
        const stats = db.prepare('SELECT * FROM sqlite_stat1').all();
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        
        const dbProfile: any = {
          name,
          file: dbFile,
          size: fs.statSync(dbFile).size,
          tables: [],
          indexes: []
        };

        // Profile each table
        for (const table of tables) {
          const tableName = table.name;
          const count = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
          
          // Sample query performance
          const queryStart = performance.now();
          db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all();
          const queryTime = performance.now() - queryStart;

          dbProfile.tables.push({
            name: tableName,
            rowCount: count.count,
            sampleQueryTime: queryTime
          });
        }

        // Check indexes
        const indexes = db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type='index'").all();
        dbProfile.indexes = indexes;

        // Analyze query plan for common operations
        if (name === 'walmart_grocery') {
          const explainQueries = [
            "EXPLAIN QUERY PLAN SELECT * FROM products WHERE name LIKE '%milk%'",
            "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 1 ORDER BY created_at DESC",
            "EXPLAIN QUERY PLAN SELECT p.*, o.* FROM products p JOIN order_items oi ON p.id = oi.product_id JOIN orders o ON oi.order_id = o.id"
          ];

          dbProfile.queryPlans = [];
          for (const query of explainQueries) {
            try {
              const plan = db.prepare(query).all();
              dbProfile.queryPlans.push({ query, plan });
            } catch (e) {
              // Query might fail if tables don't exist
            }
          }
        }

        profiles.push(dbProfile);
        console.log(`  ✅ ${name}: ${dbProfile.tables.length} tables, ${dbProfile.indexes.length} indexes`);
        
      } finally {
        db.close();
      }
    }

    fs.writeFileSync(
      path.join(this.profileDir, 'database-profile.json'),
      JSON.stringify(profiles, null, 2)
    );
  }

  // 3. WebSocket Server Performance
  async profileWebSocket(): Promise<void> {
    console.log('\n🔌 Profiling WebSocket Server...');
    
    const wsUrl = 'ws://localhost:8080';
    const connectionMetrics: any[] = [];
    const messageLatencies: number[] = [];
    
    try {
      // Test connection establishment time
      const connStart = performance.now();
      const ws = new WebSocket(wsUrl);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          const connTime = performance.now() - connStart;
          connectionMetrics.push({ type: 'connection', time: connTime });
          resolve(null);
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Test message round-trip latency
      console.log('  📨 Testing message latency...');
      for (let i = 0; i < 100; i++) {
        const msgStart = performance.now();
        const testMessage = JSON.stringify({
          type: 'ping',
          timestamp: Date.now(),
          payload: 'x'.repeat(1024) // 1KB payload
        });
        
        ws.send(testMessage);
        
        await new Promise(resolve => {
          ws.once('message', () => {
            const latency = performance.now() - msgStart;
            messageLatencies.push(latency);
            resolve(null);
          });
        });
        
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay between messages
      }

      ws.close();

      const wsProfile = {
        connectionTime: connectionMetrics[0]?.time,
        messageLatency: {
          min: Math.min(...messageLatencies),
          max: Math.max(...messageLatencies),
          mean: messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length,
          p50: this.percentile(messageLatencies, 50),
          p95: this.percentile(messageLatencies, 95),
          p99: this.percentile(messageLatencies, 99)
        },
        samplesCollected: messageLatencies.length
      };

      fs.writeFileSync(
        path.join(this.profileDir, 'websocket-profile.json'),
        JSON.stringify(wsProfile, null, 2)
      );

      console.log(`  ✅ Connection Time: ${wsProfile.connectionTime?.toFixed(2)}ms`);
      console.log(`  ✅ Message Latency (p50/p95/p99): ${wsProfile.messageLatency.p50.toFixed(2)}/${wsProfile.messageLatency.p95.toFixed(2)}/${wsProfile.messageLatency.p99.toFixed(2)}ms`);
      
    } catch (error) {
      console.log(`  ⚠️  WebSocket server not available: ${error.message}`);
    }
  }

  // 4. tRPC API Performance
  async profileTRPCEndpoints(): Promise<void> {
    console.log('\n🚀 Profiling tRPC API Endpoints...');
    
    const apiUrl = 'http://localhost:3001/api/trpc';
    const endpoints = [
      'walmart.search',
      'walmart.getProduct', 
      'walmart.getOrders',
      'walmart.getLists',
      'walmart.getDeals',
      'grocery.search',
      'grocery.autocomplete',
      'nlp.processQuery',
      'cart.getItems',
      'budget.getTracking'
    ];

    const endpointProfiles = [];

    for (const endpoint of endpoints) {
      try {
        const latencies = [];
        
        // Warm up
        await this.callTRPCEndpoint(apiUrl, endpoint, {});
        
        // Measure latency
        for (let i = 0; i < 20; i++) {
          const start = performance.now();
          await this.callTRPCEndpoint(apiUrl, endpoint, { 
            query: 'test',
            limit: 10 
          });
          const latency = performance.now() - start;
          latencies.push(latency);
        }

        const profile = {
          endpoint,
          latency: {
            min: Math.min(...latencies),
            max: Math.max(...latencies),
            mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            p50: this.percentile(latencies, 50),
            p95: this.percentile(latencies, 95),
            p99: this.percentile(latencies, 99)
          },
          samples: latencies.length
        };

        endpointProfiles.push(profile);
        console.log(`  ✅ ${endpoint}: ${profile.latency.mean.toFixed(2)}ms (mean)`);
        
      } catch (error) {
        console.log(`  ⚠️  ${endpoint}: Failed - ${error.message}`);
      }
    }

    fs.writeFileSync(
      path.join(this.profileDir, 'trpc-profile.json'),
      JSON.stringify(endpointProfiles, null, 2)
    );
  }

  // 5. Memory Leak Detection
  async profileMemoryLeaks(): Promise<void> {
    console.log('\n💾 Checking for Memory Leaks...');
    
    const memorySnapshots = [];
    const duration = 30000; // 30 seconds
    const interval = 1000; // 1 second
    
    console.log(`  ⏱️  Monitoring memory for ${duration/1000} seconds...`);
    
    const startMemory = process.memoryUsage();
    memorySnapshots.push({ time: 0, ...startMemory });
    
    const monitorInterval = setInterval(() => {
      const memory = process.memoryUsage();
      const elapsed = Date.now() - this.startTime;
      memorySnapshots.push({ time: elapsed, ...memory });
    }, interval);

    // Simulate some work
    await this.simulateWorkload();

    setTimeout(() => {
      clearInterval(monitorInterval);
      
      // Analyze for leaks
      const heapGrowth = memorySnapshots[memorySnapshots.length - 1].heapUsed - memorySnapshots[0].heapUsed;
      const rssGrowth = memorySnapshots[memorySnapshots.length - 1].rss - memorySnapshots[0].rss;
      
      const leakAnalysis = {
        duration,
        samples: memorySnapshots.length,
        heapGrowth: heapGrowth / 1024 / 1024, // MB
        rssGrowth: rssGrowth / 1024 / 1024, // MB
        growthRate: heapGrowth / (duration / 1000), // bytes/sec
        possibleLeak: heapGrowth > 10 * 1024 * 1024, // > 10MB growth
        snapshots: memorySnapshots
      };

      fs.writeFileSync(
        path.join(this.profileDir, 'memory-leak-analysis.json'),
        JSON.stringify(leakAnalysis, null, 2)
      );

      console.log(`  ✅ Heap Growth: ${leakAnalysis.heapGrowth.toFixed(2)}MB`);
      console.log(`  ✅ RSS Growth: ${leakAnalysis.rssGrowth.toFixed(2)}MB`);
      console.log(`  ✅ Possible Leak: ${leakAnalysis.possibleLeak ? '⚠️ YES' : '✅ NO'}`);
      
    }, duration);

    await new Promise(resolve => setTimeout(resolve, duration + 1000));
  }

  // 6. NLP Processing Performance
  async profileNLPProcessing(): Promise<void> {
    console.log('\n🧠 Profiling NLP Processing (Qwen3:0.6b)...');
    
    try {
      const testQueries = [
        "Find milk under $5",
        "Show me organic vegetables on sale",
        "What deals are available for snacks?",
        "I need gluten-free bread",
        "Compare prices for eggs"
      ];

      const nlpMetrics = [];

      for (const query of testQueries) {
        const start = performance.now();
        
        // Call NLP service
        const response = await axios.post('http://localhost:3008/api/nlp/process', {
          query,
          model: 'qwen3:0.6b'
        }).catch(() => null);

        const latency = performance.now() - start;
        
        nlpMetrics.push({
          query,
          latency,
          success: !!response,
          modelSize: '522MB'
        });

        console.log(`  ✅ "${query}": ${latency.toFixed(2)}ms`);
      }

      const nlpProfile = {
        model: 'qwen3:0.6b',
        metrics: nlpMetrics,
        averageLatency: nlpMetrics.reduce((a, b) => a + b.latency, 0) / nlpMetrics.length,
        successRate: (nlpMetrics.filter(m => m.success).length / nlpMetrics.length) * 100
      };

      fs.writeFileSync(
        path.join(this.profileDir, 'nlp-profile.json'),
        JSON.stringify(nlpProfile, null, 2)
      );

    } catch (error) {
      console.log(`  ⚠️  NLP service not available: ${error.message}`);
    }
  }

  // 7. Bundle Size Analysis
  async profileBundleSize(): Promise<void> {
    console.log('\n📦 Analyzing Bundle Sizes...');
    
    const distPath = path.join(process.cwd(), 'dist');
    const publicPath = path.join(process.cwd(), 'public');
    
    const bundleAnalysis: any = {
      frontend: {},
      backend: {},
      total: 0
    };

    // Analyze frontend bundles
    if (fs.existsSync(publicPath)) {
      const files = this.getAllFiles(publicPath).filter(f => f.endsWith('.js') || f.endsWith('.css'));
      
      for (const file of files) {
        const stats = fs.statSync(file);
        const relativePath = path.relative(publicPath, file);
        bundleAnalysis.frontend[relativePath] = {
          size: stats.size,
          sizeKB: stats.size / 1024,
          sizeMB: stats.size / 1024 / 1024
        };
        bundleAnalysis.total += stats.size;
      }
    }

    // Analyze backend bundles
    if (fs.existsSync(distPath)) {
      const files = this.getAllFiles(distPath).filter(f => f.endsWith('.js'));
      
      for (const file of files) {
        const stats = fs.statSync(file);
        const relativePath = path.relative(distPath, file);
        bundleAnalysis.backend[relativePath] = {
          size: stats.size,
          sizeKB: stats.size / 1024,
          sizeMB: stats.size / 1024 / 1024
        };
        bundleAnalysis.total += stats.size;
      }
    }

    bundleAnalysis.totalMB = bundleAnalysis.total / 1024 / 1024;

    // Find largest files
    const allFiles = [
      ...Object.entries(bundleAnalysis.frontend).map(([k, v]: any) => ({ name: k, ...v, type: 'frontend' })),
      ...Object.entries(bundleAnalysis.backend).map(([k, v]: any) => ({ name: k, ...v, type: 'backend' }))
    ];
    
    bundleAnalysis.largestFiles = allFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    fs.writeFileSync(
      path.join(this.profileDir, 'bundle-analysis.json'),
      JSON.stringify(bundleAnalysis, null, 2)
    );

    console.log(`  ✅ Total Bundle Size: ${bundleAnalysis.totalMB.toFixed(2)}MB`);
    console.log(`  ✅ Largest File: ${bundleAnalysis.largestFiles[0]?.name} (${bundleAnalysis.largestFiles[0]?.sizeMB.toFixed(2)}MB)`);
  }

  // 8. Generate Flame Graph
  async generateFlameGraph(): Promise<void> {
    console.log('\n🔥 Generating CPU Flame Graph...');
    
    try {
      // Check if perf is available
      await execAsync('which perf');
      
      const pid = process.pid;
      const perfDataFile = path.join(this.profileDir, 'perf.data');
      const flameGraphFile = path.join(this.profileDir, 'flamegraph.svg');
      
      // Record CPU profile for 10 seconds
      console.log('  ⏱️  Recording CPU profile for 10 seconds...');
      const perfProcess = spawn('perf', ['record', '-F', '99', '-p', pid.toString(), '-g', '--', 'sleep', '10']);
      
      await new Promise(resolve => {
        perfProcess.on('exit', resolve);
      });

      // Generate flame graph
      await execAsync(`perf script > ${this.profileDir}/perf.script`);
      
      // Check if flamegraph.pl is available
      const flameGraphScript = '/usr/local/bin/flamegraph.pl';
      if (fs.existsSync(flameGraphScript)) {
        await execAsync(`${flameGraphScript} ${this.profileDir}/perf.script > ${flameGraphFile}`);
        console.log(`  ✅ Flame graph saved to: ${flameGraphFile}`);
      } else {
        console.log('  ⚠️  flamegraph.pl not found. Install from: https://github.com/brendangregg/FlameGraph');
      }
      
    } catch (error) {
      console.log(`  ⚠️  Could not generate flame graph: ${error.message}`);
      console.log('  ℹ️  Try: sudo apt-get install linux-tools-common linux-tools-generic');
    }
  }

  // 9. Generate V8 Heap Snapshot
  async generateHeapSnapshot(): Promise<void> {
    console.log('\n📸 Generating V8 Heap Snapshot...');
    
    const snapshotFile = path.join(this.profileDir, `heap-${Date.now()}.heapsnapshot`);
    
    const stream = v8.writeHeapSnapshot();
    const fileStream = fs.createWriteStream(snapshotFile);
    
    stream.pipe(fileStream);
    
    await new Promise(resolve => {
      fileStream.on('finish', () => {
        const stats = fs.statSync(snapshotFile);
        console.log(`  ✅ Heap snapshot saved: ${snapshotFile} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve(null);
      });
    });
  }

  // 10. Generate Comprehensive Report
  async generateReport(): Promise<void> {
    console.log('\n📊 Generating Performance Report...');
    
    const reportPath = path.join(this.profileDir, 'PERFORMANCE_REPORT.md');
    
    const report = `# Performance Analysis Report
Generated: ${new Date().toISOString()}

## Executive Summary

This report provides a comprehensive performance analysis of the Walmart Grocery Agent system, including CPU, memory, I/O bottlenecks, and optimization recommendations.

## 1. System Resources
- Review \`system-profile.json\` for CPU and memory baseline metrics

## 2. Database Performance
- Review \`database-profile.json\` for query performance and index analysis
- Key finding: Check for missing indexes on frequently queried columns

## 3. WebSocket Performance
- Review \`websocket-profile.json\` for connection and message latency metrics
- Target: < 50ms p95 latency for real-time updates

## 4. tRPC API Performance
- Review \`trpc-profile.json\` for endpoint latency analysis
- Critical endpoints should have < 100ms p95 latency

## 5. Memory Analysis
- Review \`memory-leak-analysis.json\` for potential memory leaks
- Monitor heap growth over time

## 6. NLP Processing
- Review \`nlp-profile.json\` for model inference latency
- Qwen3:0.6b model should process queries in < 500ms

## 7. Bundle Size
- Review \`bundle-analysis.json\` for optimization opportunities
- Consider code splitting for large bundles

## Optimization Recommendations

### High Priority
1. **Database Indexes**: Add indexes for frequently queried columns
2. **Connection Pooling**: Implement connection pooling for database and WebSocket
3. **Caching Layer**: Add Redis caching for frequent queries
4. **Bundle Optimization**: Implement code splitting and lazy loading

### Medium Priority
1. **WebSocket Batching**: Batch multiple updates to reduce overhead
2. **Query Optimization**: Review and optimize slow database queries
3. **Memory Management**: Implement periodic garbage collection
4. **NLP Caching**: Cache NLP results for common queries

### Low Priority
1. **Compression**: Enable gzip/brotli for API responses
2. **CDN**: Use CDN for static assets
3. **Service Workers**: Implement for offline capability
4. **HTTP/2**: Enable for multiplexing benefits

## Next Steps
1. Implement high-priority optimizations
2. Set up continuous performance monitoring
3. Establish performance budgets
4. Regular performance regression testing
`;

    fs.writeFileSync(reportPath, report);
    console.log(`  ✅ Report saved to: ${reportPath}`);
  }

  // Helper methods
  private percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private async callTRPCEndpoint(baseUrl: string, procedure: string, input: any): Promise<any> {
    const response = await axios.post(`${baseUrl}/${procedure}`, { input });
    return response.data;
  }

  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    });

    return arrayOfFiles;
  }

  private async simulateWorkload(): Promise<void> {
    // Simulate some work to test memory growth
    const arrays = [];
    for (let i = 0; i < 100; i++) {
      arrays.push(new Array(10000).fill(Math.random()));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Main execution
  async run(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 WALMART GROCERY AGENT PERFORMANCE PROFILING');
    console.log('='.repeat(60));

    await this.profileSystemResources();
    await this.profileDatabase();
    await this.profileWebSocket();
    await this.profileTRPCEndpoints();
    await this.profileNLPProcessing();
    await this.profileBundleSize();
    await this.generateHeapSnapshot();
    await this.profileMemoryLeaks();
    await this.generateFlameGraph();
    await this.generateReport();

    console.log('\n' + '='.repeat(60));
    console.log('✅ PROFILING COMPLETE');
    console.log(`📁 Results saved to: ${this.profileDir}`);
    console.log('='.repeat(60));
  }
}

// Run the profiler
if (require.main === module) {
  const profiler = new PerformanceProfiler();
  profiler.run().catch(console.error);
}

export default PerformanceProfiler;