#!/usr/bin/env node

/**
 * Test script for ChromaDB resilience and fallback mechanisms
 * Tests connection retry, circuit breaker, and in-memory fallback
 */

import { ChromaDBConnectionManager, ConnectionState } from "../database/vector/ChromaDBConnectionManager.js";
import { ResilientChromaDBManager, StorageMode } from "../database/vector/ResilientChromaDBManager.js";
import { ResilientVectorStore } from "../core/rag/ResilientVectorStore.js";
import { ChromaDBMonitor } from "../monitoring/ChromaDBMonitor.js";
import { logger } from "../utils/logger.js";
import chalk from "chalk";

class ChromaDBResilienceTest {
  private connectionManager?: ChromaDBConnectionManager;
  private resilientManager?: ResilientChromaDBManager;
  private vectorStore?: ResilientVectorStore;
  private monitor = ChromaDBMonitor.getInstance();

  async runTests(): Promise<void> {
    console.log(chalk.bold.blue("\n🧪 ChromaDB Resilience Test Suite\n"));
    
    await this.testConnectionRetry();
    await this.testCircuitBreaker();
    await this.testInMemoryFallback();
    await this.testDataPersistence();
    await this.testHealthCheck();
    await this.testMetrics();
    
    console.log(chalk.bold.green("\n✅ All tests completed!\n"));
  }

  /**
   * Test 1: Connection retry with exponential backoff
   */
  async testConnectionRetry(): Promise<void> {
    console.log(chalk.yellow("\n📡 Test 1: Connection Retry with Exponential Backoff"));
    
    this.connectionManager = new ChromaDBConnectionManager({
      host: "localhost",
      port: 8000, // Assuming ChromaDB might not be running
      maxRetries: 3,
      initialRetryDelay: 500,
      maxRetryDelay: 5000,
    });

    console.log("Attempting to connect to ChromaDB...");
    const startTime = Date.now();
    const connected = await this.connectionManager.connect();
    const duration = Date.now() - startTime;

    if (connected) {
      console.log(chalk.green(`✓ Connected successfully in ${duration}ms`));
      const metrics = this.connectionManager.getMetrics();
      console.log(`  Connection attempts: ${metrics.connectionAttempts}`);
      console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    } else {
      console.log(chalk.red(`✗ Connection failed after ${duration}ms`));
      const metrics = this.connectionManager.getMetrics();
      console.log(`  Connection attempts: ${metrics.connectionAttempts}`);
      console.log(`  Failed connections: ${metrics.failedConnections}`);
      
      const circuitState = this.connectionManager.getCircuitBreakerState();
      if (circuitState.state === "open") {
        console.log(chalk.yellow(`  Circuit breaker opened after ${circuitState.failures} failures`));
      }
    }

    await this.connectionManager.disconnect();
  }

  /**
   * Test 2: Circuit breaker pattern
   */
  async testCircuitBreaker(): Promise<void> {
    console.log(chalk.yellow("\n⚡ Test 2: Circuit Breaker Pattern"));
    
    this.connectionManager = new ChromaDBConnectionManager({
      host: "nonexistent-host", // Deliberately wrong host
      port: 8000,
      maxRetries: 2,
      initialRetryDelay: 100,
      circuitBreakerThreshold: 3,
      circuitBreakerResetTimeout: 5000,
    });

    console.log("Testing circuit breaker with failing connections...");
    
    // Attempt multiple connections to trip the circuit breaker
    for (let i = 1; i <= 4; i++) {
      console.log(`\nAttempt ${i}:`);
      const connected = await this.connectionManager.connect();
      
      const state = this.connectionManager.getState();
      const circuitState = this.connectionManager.getCircuitBreakerState();
      
      console.log(`  Connection state: ${state}`);
      console.log(`  Circuit breaker: ${circuitState.state}`);
      
      if (circuitState.state === "open") {
        console.log(chalk.yellow(`  ⚡ Circuit breaker tripped! Will retry at ${circuitState.nextRetryTime?.toISOString()}`));
        break;
      }
    }

    await this.connectionManager.disconnect();
  }

  /**
   * Test 3: In-memory fallback
   */
  async testInMemoryFallback(): Promise<void> {
    console.log(chalk.yellow("\n💾 Test 3: In-Memory Fallback"));
    
    this.resilientManager = new ResilientChromaDBManager({
      chromadb: {
        host: "nonexistent-host", // Force fallback
        port: 8000,
      },
      connectionManager: {
        maxRetries: 1, // Quick failure for testing
      },
      fallback: {
        enabled: true,
        preserveDataOnSwitch: true,
      },
    });

    console.log("Initializing resilient manager...");
    await this.resilientManager.initialize();
    
    const mode = this.resilientManager.getStorageMode();
    console.log(`  Storage mode: ${chalk.bold(mode)}`);
    
    if (mode === StorageMode.IN_MEMORY) {
      console.log(chalk.green("✓ Successfully fell back to in-memory storage"));
      
      // Test adding documents to in-memory store
      const testDocs = [
        {
          id: "test-1",
          content: "This is a test document in fallback mode",
          metadata: { type: "test", timestamp: new Date().toISOString() },
        },
        {
          id: "test-2",
          content: "Another test document for resilience testing",
          metadata: { type: "test", timestamp: new Date().toISOString() },
        },
      ];
      
      console.log("\nAdding test documents to in-memory store...");
      await this.resilientManager.addDocuments("test-collection", testDocs);
      console.log(chalk.green("✓ Documents added successfully"));
      
      // Test querying in fallback mode
      console.log("\nQuerying documents in fallback mode...");
      const results = await this.resilientManager.queryDocuments(
        "test-collection",
        [], // Empty embedding for text search
        { nResults: 5 }
      );
      
      console.log(`  Found ${results.length} documents`);
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.id}: ${r.content.substring(0, 50)}...`);
      });
    }
  }

  /**
   * Test 4: Data persistence and sync
   */
  async testDataPersistence(): Promise<void> {
    console.log(chalk.yellow("\n🔄 Test 4: Data Persistence and Sync"));
    
    // This test simulates ChromaDB coming back online
    console.log("Simulating ChromaDB recovery scenario...");
    
    const healthStatus = await this.resilientManager!.getHealthStatus();
    console.log(`  Current mode: ${healthStatus.mode}`);
    console.log(`  ChromaDB connected: ${healthStatus.chromadb.connected}`);
    console.log(`  Documents in memory: ${healthStatus.inMemory.documentCount}`);
    console.log(`  Pending sync: ${healthStatus.inMemory.pendingSync}`);
    
    if (healthStatus.inMemory.pendingSync > 0) {
      console.log(chalk.yellow("\n  📤 Documents pending sync to ChromaDB when it becomes available"));
    }
  }

  /**
   * Test 5: Health check functionality
   */
  async testHealthCheck(): Promise<void> {
    console.log(chalk.yellow("\n🏥 Test 5: Health Check"));
    
    this.vectorStore = new ResilientVectorStore({
      collectionName: "health-test",
      path: "http://localhost:8001",
      baseUrl: "http://localhost:11434",
      type: "resilient" as any,
    });

    console.log("Initializing vector store...");
    await this.vectorStore.initialize();
    
    const health = await this.vectorStore.getHealthStatus();
    console.log("\nHealth Status:");
    console.log(`  Status: ${chalk.bold(health.status)}`);
    console.log(`  Mode: ${health.mode}`);
    console.log(`  Message: ${health.message}`);
    
    if (health.details.chromadb) {
      console.log("\nChromaDB Details:");
      console.log(`  Connected: ${health.details.chromadb.connected}`);
      console.log(`  State: ${health.details.chromadb.state}`);
    }
    
    if (health.details.inMemory) {
      console.log("\nIn-Memory Details:");
      console.log(`  Document count: ${health.details.inMemory.documentCount}`);
      console.log(`  Pending sync: ${health.details.inMemory.pendingSync}`);
    }
    
    // Simulate health check endpoint
    const isHealthy = health.status === "healthy" || health.status === "degraded";
    console.log(`\n${isHealthy ? chalk.green("✓") : chalk.red("✗")} System ${isHealthy ? "healthy" : "unhealthy"} (ChromaDB is optional)`);
  }

  /**
   * Test 6: Metrics and monitoring
   */
  async testMetrics(): Promise<void> {
    console.log(chalk.yellow("\n📊 Test 6: Metrics and Monitoring"));
    
    const metrics = this.monitor.getMetrics();
    const healthSummary = this.monitor.getHealthSummary();
    
    console.log("\nConnection Metrics:");
    console.log(`  Total attempts: ${metrics.connectionAttempts}`);
    console.log(`  Successful: ${metrics.successfulConnections}`);
    console.log(`  Failed: ${metrics.failedConnections}`);
    console.log(`  Uptime: ${metrics.uptimePercentage.toFixed(2)}%`);
    
    console.log("\nPerformance Metrics:");
    console.log(`  Total requests: ${metrics.totalRequests}`);
    console.log(`  Failed requests: ${metrics.failedRequests}`);
    console.log(`  Avg response time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`  P95 response time: ${metrics.p95ResponseTime.toFixed(2)}ms`);
    
    console.log("\nFallback Metrics:");
    console.log(`  Fallback activations: ${metrics.fallbackActivations}`);
    console.log(`  Current mode: ${metrics.currentMode}`);
    console.log(`  Documents in memory: ${metrics.documentsInMemory}`);
    console.log(`  Documents synced: ${metrics.documentsSynced}`);
    
    console.log("\nHealth Summary:");
    console.log(`  Status: ${chalk.bold(healthSummary.status)}`);
    console.log(`  Healthy: ${healthSummary.healthy ? chalk.green("Yes") : chalk.red("No")}`);
    
    if (healthSummary.issues.length > 0) {
      console.log("\n  Issues:");
      healthSummary.issues.forEach(issue => {
        console.log(`    - ${chalk.yellow(issue)}`);
      });
    }
    
    if (healthSummary.recommendations.length > 0) {
      console.log("\n  Recommendations:");
      healthSummary.recommendations.forEach(rec => {
        console.log(`    - ${rec}`);
      });
    }
    
    // Export Prometheus metrics
    console.log("\n📈 Prometheus Metrics Sample:");
    const promMetrics = this.monitor.getPrometheusMetrics();
    console.log(promMetrics.split("\n").slice(0, 10).join("\n") + "\n...");
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.connectionManager) {
      await this.connectionManager.disconnect();
    }
    if (this.resilientManager) {
      await this.resilientManager.shutdown();
    }
    if (this.vectorStore) {
      await this.vectorStore.shutdown();
    }
    this.monitor.destroy();
  }
}

// Run the tests
async function main() {
  const tester = new ChromaDBResilienceTest();
  
  try {
    await tester.runTests();
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ChromaDBResilienceTest };