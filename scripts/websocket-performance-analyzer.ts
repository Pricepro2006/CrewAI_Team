#!/usr/bin/env ts-node

/**
 * WebSocket Performance Analyzer
 * Deep analysis of WebSocket server implementation and connection management
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface WebSocketMetrics {
  connections: {
    establishmentTime: number[];
    failureRate: number;
    maxConcurrent: number;
  };
  messages: {
    throughput: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
    droppedMessages: number;
  };
  memory: {
    perConnection: number;
    total: number;
    leakDetected: boolean;
  };
  scalability: {
    maxConnectionsSupported: number;
    degradationPoint: number;
    cpuAtMax: number;
    memoryAtMax: number;
  };
}

class WebSocketPerformanceAnalyzer {
  private wsUrl = 'ws://localhost:8080';
  private metrics: WebSocketMetrics = {
    connections: {
      establishmentTime: [],
      failureRate: 0,
      maxConcurrent: 0
    },
    messages: {
      throughput: 0,
      latencyP50: 0,
      latencyP95: 0,
      latencyP99: 0,
      droppedMessages: 0
    },
    memory: {
      perConnection: 0,
      total: 0,
      leakDetected: false
    },
    scalability: {
      maxConnectionsSupported: 0,
      degradationPoint: 0,
      cpuAtMax: 0,
      memoryAtMax: 0
    }
  };

  async analyzeConnectionOverhead(): Promise<void> {
    console.log('\n🔌 Analyzing WebSocket Connection Overhead...');
    
    const connectionTimes: number[] = [];
    const connections: WebSocket[] = [];
    
    // Test single connection establishment
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const ws = new WebSocket(this.wsUrl);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          const time = performance.now() - start;
          connectionTimes.push(time);
          connections.push(ws);
          resolve(null);
        });
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 5000);
      }).catch(() => {
        this.metrics.connections.failureRate++;
      });
      
      // Small delay between connections
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Calculate metrics
    this.metrics.connections.establishmentTime = connectionTimes;
    this.metrics.connections.failureRate = (this.metrics.connections.failureRate / 100) * 100;
    
    console.log(`  ✅ Average Connection Time: ${this.average(connectionTimes).toFixed(2)}ms`);
    console.log(`  ✅ Connection Success Rate: ${(100 - this.metrics.connections.failureRate).toFixed(2)}%`);
    
    // Clean up
    connections.forEach(ws => ws.close());
  }

  async analyzeConcurrentConnections(): Promise<void> {
    console.log('\n👥 Testing Concurrent Connection Capacity...');
    
    const connections: WebSocket[] = [];
    let maxConnections = 0;
    let degradationDetected = false;
    const baselineLatency = await this.measureSingleConnectionLatency();
    
    try {
      for (let batch = 0; batch < 10; batch++) {
        const batchSize = 100;
        const batchConnections: Promise<WebSocket>[] = [];
        
        // Create batch of connections
        for (let i = 0; i < batchSize; i++) {
          batchConnections.push(this.createConnection());
        }
        
        const established = await Promise.allSettled(batchConnections);
        const successful = established.filter(r => r.status === 'fulfilled').map(r => (r as any).value);
        connections.push(...successful);
        
        maxConnections = connections.length;
        console.log(`  📊 Active Connections: ${maxConnections}`);
        
        // Measure latency under load
        const currentLatency = await this.measureLatencyUnderLoad(connections.slice(-10));
        
        // Check for degradation (2x baseline)
        if (!degradationDetected && currentLatency > baselineLatency * 2) {
          this.metrics.scalability.degradationPoint = maxConnections;
          degradationDetected = true;
          console.log(`  ⚠️  Performance degradation detected at ${maxConnections} connections`);
        }
        
        // Stop if connections start failing
        if (successful.length < batchSize * 0.8) {
          console.log(`  ⚠️  Connection failures detected. Stopping at ${maxConnections} connections`);
          break;
        }
      }
      
      this.metrics.scalability.maxConnectionsSupported = maxConnections;
      this.metrics.connections.maxConcurrent = maxConnections;
      
    } finally {
      // Clean up all connections
      connections.forEach(ws => ws.close());
    }
    
    console.log(`  ✅ Maximum Concurrent Connections: ${maxConnections}`);
  }

  async analyzeMessageThroughput(): Promise<void> {
    console.log('\n📨 Analyzing Message Throughput...');
    
    const ws = await this.createConnection();
    const messageCount = 10000;
    const payloadSizes = [100, 1024, 10240, 102400]; // 100B, 1KB, 10KB, 100KB
    
    for (const size of payloadSizes) {
      const payload = 'x'.repeat(size);
      const messages: any[] = [];
      
      const start = performance.now();
      
      for (let i = 0; i < messageCount; i++) {
        ws.send(JSON.stringify({
          id: i,
          timestamp: Date.now(),
          payload
        }));
      }
      
      const duration = performance.now() - start;
      const throughput = messageCount / (duration / 1000); // messages per second
      const bandwidth = (throughput * size) / 1024 / 1024; // MB/s
      
      console.log(`  ✅ Payload ${size}B: ${throughput.toFixed(0)} msg/s (${bandwidth.toFixed(2)} MB/s)`);
    }
    
    ws.close();
  }

  async analyzeMemoryUsage(): Promise<void> {
    console.log('\n💾 Analyzing Memory Usage per Connection...');
    
    const connections: WebSocket[] = [];
    const memorySnapshots: number[] = [];
    
    // Baseline memory
    if (global.gc) global.gc();
    const baselineMemory = process.memoryUsage().heapUsed;
    
    // Create connections and measure memory growth
    for (let i = 0; i < 100; i++) {
      const ws = await this.createConnection();
      connections.push(ws);
      
      if (i % 10 === 0) {
        if (global.gc) global.gc();
        const currentMemory = process.memoryUsage().heapUsed;
        memorySnapshots.push(currentMemory);
      }
    }
    
    // Calculate memory per connection
    const finalMemory = process.memoryUsage().heapUsed;
    const totalMemoryUsed = finalMemory - baselineMemory;
    const memoryPerConnection = totalMemoryUsed / connections.length;
    
    this.metrics.memory.perConnection = memoryPerConnection;
    this.metrics.memory.total = totalMemoryUsed;
    
    // Check for potential memory leak
    const growthRate = this.calculateGrowthRate(memorySnapshots);
    this.metrics.memory.leakDetected = growthRate > 1000; // 1KB/connection considered leak
    
    console.log(`  ✅ Memory per Connection: ${(memoryPerConnection / 1024).toFixed(2)} KB`);
    console.log(`  ✅ Total Memory Used: ${(totalMemoryUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  ✅ Memory Leak Detected: ${this.metrics.memory.leakDetected ? '⚠️ YES' : '✅ NO'}`);
    
    // Clean up
    connections.forEach(ws => ws.close());
  }

  async analyzeReconnectionLogic(): Promise<void> {
    console.log('\n🔄 Analyzing Reconnection Performance...');
    
    const reconnectionTimes: number[] = [];
    const maxRetries = 5;
    
    for (let test = 0; test < 10; test++) {
      const ws = await this.createConnection();
      
      // Simulate disconnect
      ws.close();
      
      // Measure reconnection time
      const reconnectStart = performance.now();
      let connected = false;
      let retries = 0;
      
      while (!connected && retries < maxRetries) {
        try {
          await this.createConnection();
          connected = true;
          const reconnectTime = performance.now() - reconnectStart;
          reconnectionTimes.push(reconnectTime);
        } catch (error) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100)); // Exponential backoff
        }
      }
    }
    
    console.log(`  ✅ Average Reconnection Time: ${this.average(reconnectionTimes).toFixed(2)}ms`);
    console.log(`  ✅ Reconnection Success Rate: ${(reconnectionTimes.length / 10 * 100).toFixed(0)}%`);
  }

  async analyzeBroadcastPerformance(): Promise<void> {
    console.log('\n📡 Analyzing Broadcast Performance...');
    
    const clientCount = 100;
    const clients: WebSocket[] = [];
    const receivedMessages: Map<number, number[]> = new Map();
    
    // Create multiple clients
    for (let i = 0; i < clientCount; i++) {
      const ws = await this.createConnection();
      receivedMessages.set(i, []);
      
      ws.on('message', (data) => {
        const timestamp = Date.now();
        receivedMessages.get(i)?.push(timestamp);
      });
      
      clients.push(ws);
    }
    
    // Send broadcast message
    const broadcastStart = Date.now();
    const testMessage = JSON.stringify({
      type: 'broadcast',
      timestamp: broadcastStart,
      payload: 'x'.repeat(1024)
    });
    
    // Simulate broadcast (send to first client, expecting server to broadcast)
    clients[0].send(testMessage);
    
    // Wait for messages to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Calculate broadcast metrics
    const latencies: number[] = [];
    let receivedCount = 0;
    
    receivedMessages.forEach((timestamps) => {
      if (timestamps.length > 0) {
        receivedCount++;
        const latency = timestamps[0] - broadcastStart;
        latencies.push(latency);
      }
    });
    
    const broadcastReliability = (receivedCount / clientCount) * 100;
    
    console.log(`  ✅ Broadcast Reliability: ${broadcastReliability.toFixed(2)}%`);
    console.log(`  ✅ Average Broadcast Latency: ${this.average(latencies).toFixed(2)}ms`);
    console.log(`  ✅ Max Broadcast Latency: ${Math.max(...latencies)}ms`);
    
    // Clean up
    clients.forEach(ws => ws.close());
  }

  async generateReport(): Promise<void> {
    const reportDir = path.join(process.cwd(), 'performance-profiles', 'websocket-analysis');
    fs.mkdirSync(reportDir, { recursive: true });
    
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };
    
    fs.writeFileSync(
      path.join(reportDir, 'websocket-performance.json'),
      JSON.stringify(report, null, 2)
    );
    
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync(
      path.join(reportDir, 'WEBSOCKET_ANALYSIS.md'),
      markdownReport
    );
    
    console.log(`\n📊 Report saved to: ${reportDir}`);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Connection recommendations
    if (this.average(this.metrics.connections.establishmentTime) > 100) {
      recommendations.push('Optimize connection establishment: Consider connection pooling and keep-alive');
    }
    
    if (this.metrics.connections.failureRate > 5) {
      recommendations.push('High connection failure rate: Review server capacity and timeout settings');
    }
    
    // Scalability recommendations
    if (this.metrics.scalability.maxConnectionsSupported < 1000) {
      recommendations.push('Limited connection capacity: Consider horizontal scaling or upgrading server resources');
    }
    
    if (this.metrics.scalability.degradationPoint < 500) {
      recommendations.push('Early performance degradation: Optimize message handling and consider message batching');
    }
    
    // Memory recommendations
    if (this.metrics.memory.leakDetected) {
      recommendations.push('Memory leak detected: Review connection cleanup and event listener management');
    }
    
    if (this.metrics.memory.perConnection > 100 * 1024) { // 100KB per connection
      recommendations.push('High memory per connection: Optimize message buffering and state management');
    }
    
    return recommendations;
  }

  private generateMarkdownReport(): string {
    return `# WebSocket Performance Analysis Report

## Executive Summary
Date: ${new Date().toISOString()}
URL: ${this.wsUrl}

## Connection Performance
- Average Establishment Time: ${this.average(this.metrics.connections.establishmentTime).toFixed(2)}ms
- Connection Success Rate: ${(100 - this.metrics.connections.failureRate).toFixed(2)}%
- Maximum Concurrent Connections: ${this.metrics.connections.maxConcurrent}

## Scalability Metrics
- Max Connections Supported: ${this.metrics.scalability.maxConnectionsSupported}
- Performance Degradation Point: ${this.metrics.scalability.degradationPoint} connections
- CPU at Max Load: ${this.metrics.scalability.cpuAtMax}%
- Memory at Max Load: ${this.metrics.scalability.memoryAtMax}MB

## Memory Analysis
- Memory per Connection: ${(this.metrics.memory.perConnection / 1024).toFixed(2)}KB
- Total Memory Used: ${(this.metrics.memory.total / 1024 / 1024).toFixed(2)}MB
- Memory Leak Detected: ${this.metrics.memory.leakDetected ? '⚠️ YES' : '✅ NO'}

## Recommendations
${this.generateRecommendations().map(r => `- ${r}`).join('\n')}

## Optimization Strategies

### 1. Connection Pooling
Implement connection pooling to reduce establishment overhead:
\`\`\`typescript
class WebSocketPool {
  private pool: WebSocket[] = [];
  private maxSize = 10;
  
  async getConnection(): Promise<WebSocket> {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createNewConnection();
  }
}
\`\`\`

### 2. Message Batching
Batch multiple messages to reduce overhead:
\`\`\`typescript
class MessageBatcher {
  private batch: any[] = [];
  private batchSize = 100;
  private flushInterval = 50; // ms
  
  add(message: any) {
    this.batch.push(message);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }
}
\`\`\`

### 3. Binary Protocol
Use binary protocol for better performance:
\`\`\`typescript
// Instead of JSON
ws.send(JSON.stringify(data));

// Use MessagePack or Protocol Buffers
ws.send(msgpack.encode(data));
\`\`\`
`;
  }

  // Helper methods
  private async createConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  private async measureSingleConnectionLatency(): Promise<number> {
    const ws = await this.createConnection();
    const latencies: number[] = [];
    
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      ws.send(JSON.stringify({ type: 'ping' }));
      await new Promise(resolve => {
        ws.once('message', resolve);
      });
      latencies.push(performance.now() - start);
    }
    
    ws.close();
    return this.average(latencies);
  }

  private async measureLatencyUnderLoad(connections: WebSocket[]): Promise<number> {
    const latencies: number[] = [];
    
    for (const ws of connections) {
      const start = performance.now();
      ws.send(JSON.stringify({ type: 'ping' }));
      await new Promise(resolve => {
        ws.once('message', resolve);
        setTimeout(resolve, 1000); // Timeout after 1s
      });
      latencies.push(performance.now() - start);
    }
    
    return this.average(latencies);
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private calculateGrowthRate(snapshots: number[]): number {
    if (snapshots.length < 2) return 0;
    const growth = snapshots[snapshots.length - 1] - snapshots[0];
    return growth / (snapshots.length - 1);
  }

  async run(): Promise<void> {
    console.log('=' .repeat(60));
    console.log('🔌 WEBSOCKET PERFORMANCE DEEP ANALYSIS');
    console.log('='.repeat(60));

    try {
      await this.analyzeConnectionOverhead();
      await this.analyzeConcurrentConnections();
      await this.analyzeMessageThroughput();
      await this.analyzeMemoryUsage();
      await this.analyzeReconnectionLogic();
      await this.analyzeBroadcastPerformance();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      console.log('Make sure the WebSocket server is running on port 8080');
    }

    console.log('\n✅ Analysis Complete');
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new WebSocketPerformanceAnalyzer();
  analyzer.run().catch(console.error);
}

export default WebSocketPerformanceAnalyzer;