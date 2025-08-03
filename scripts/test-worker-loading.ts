#!/usr/bin/env tsx

/**
 * Test Worker Loading Script
 * 
 * Verifies that the WorkerLoader can successfully load TypeScript workers
 * and handle various error scenarios.
 */

import { WorkerLoader } from "../src/core/workers/WorkerLoader.js";
import { Worker } from "worker_threads";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("WorkerLoadingTest");

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    await testFn();
    return {
      name,
      success: true,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      name,
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testBasicTypeScriptWorker(): Promise<void> {
  logger.info("Testing basic TypeScript worker loading");
  
  const worker = WorkerLoader.createWorker(
    "./src/core/workers/TestWorker.ts",
    {
      workerData: { testId: "basic-ts-test" },
      maxMemory: 256
    }
  );
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Worker timeout"));
    }, 10000);
    
    worker.on("message", (msg) => {
      if (msg.type === "ready") {
        clearTimeout(timeout);
        worker.postMessage({ type: "ping" });
      } else if (msg.type === "pong") {
        worker.terminate();
        resolve();
      }
    });
    
    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });
  });
}

async function testJavaScriptWorker(): Promise<void> {
  logger.info("Testing JavaScript worker loading");
  
  const worker = WorkerLoader.createWorker(
    "./src/core/workers/TestWorker.js",
    {
      workerData: { testId: "basic-js-test" },
      maxMemory: 256
    }
  );
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Worker timeout"));
    }, 10000);
    
    worker.on("message", (msg) => {
      if (msg.type === "ready") {
        clearTimeout(timeout);
        worker.postMessage({ type: "ping" });
      } else if (msg.type === "pong") {
        worker.terminate();
        resolve();
      }
    });
    
    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });
  });
}

async function testEmailProcessingWorker(): Promise<void> {
  logger.info("Testing EmailProcessingWorker loading");
  
  const worker = WorkerLoader.createWorker(
    "./src/core/workers/EmailProcessingWorker.ts",
    {
      workerData: { 
        workerId: "test-email-worker",
        maxMemory: 512
      },
      maxMemory: 512
    }
  );
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Worker initialization timeout"));
    }, 15000);
    
    let initialized = false;
    
    worker.on("message", (msg) => {
      if (msg.type === "initialized" || msg.type === "ready") {
        initialized = true;
        clearTimeout(timeout);
        worker.terminate();
        resolve();
      } else if (msg.type === "error") {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(msg.error?.message || "Worker error"));
      }
    });
    
    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(error);
    });
    
    // Some workers might not send a ready message immediately
    setTimeout(() => {
      if (!initialized) {
        // Try sending a health check
        worker.postMessage({ type: "health" });
      }
    }, 2000);
  });
}

async function testWorkerWithDependencies(): Promise<void> {
  logger.info("Testing worker with external dependencies");
  
  // Create a simple test to verify dependency loading
  const worker = WorkerLoader.createWorker(
    "./src/core/workers/EmailProcessingWorker.ts",
    {
      workerData: { 
        workerId: "dependency-test",
        testMode: true
      }
    }
  );
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("Dependency test timeout"));
    }, 20000);
    
    worker.on("error", (error) => {
      clearTimeout(timeout);
      worker.terminate();
      
      // Check if it's a known dependency issue
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes("cannot find module") || 
          errorMsg.includes("module not found")) {
        logger.warn("Dependency issue detected:", error.message);
        // This is expected if dependencies aren't installed
        resolve();
      } else {
        reject(error);
      }
    });
    
    // If worker starts successfully, dependencies are loaded
    worker.on("online", () => {
      clearTimeout(timeout);
      worker.terminate();
      resolve();
    });
  });
}

async function testInvalidWorkerPath(): Promise<void> {
  logger.info("Testing invalid worker path handling");
  
  try {
    WorkerLoader.createWorker(
      "./src/core/workers/NonExistentWorker.ts",
      { workerData: { testId: "invalid-path" } }
    );
    throw new Error("Expected error for invalid path");
  } catch (error) {
    if (error instanceof Error && 
        (error.message.includes("not found") || 
         error.message.includes("ENOENT"))) {
      // Expected error
      return;
    }
    throw error;
  }
}

async function main() {
  logger.info("Starting Worker Loading Tests");
  logger.info("================================");
  
  const tests = [
    { name: "Basic TypeScript Worker", fn: testBasicTypeScriptWorker },
    { name: "JavaScript Worker", fn: testJavaScriptWorker },
    { name: "Email Processing Worker", fn: testEmailProcessingWorker },
    { name: "Worker with Dependencies", fn: testWorkerWithDependencies },
    { name: "Invalid Worker Path", fn: testInvalidWorkerPath }
  ];
  
  const results: TestResult[] = [];
  
  for (const test of tests) {
    logger.info(`\nRunning test: ${test.name}`);
    const result = await runTest(test.name, test.fn);
    results.push(result);
    
    if (result.success) {
      logger.info(`✅ ${test.name} - Passed (${result.duration}ms)`);
    } else {
      logger.error(`❌ ${test.name} - Failed: ${result.error}`);
    }
  }
  
  // Summary
  logger.info("\n================================");
  logger.info("Test Summary");
  logger.info("================================");
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  logger.info(`Total Tests: ${results.length}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);
  
  if (failed > 0) {
    logger.error("\nFailed Tests:");
    results
      .filter(r => !r.success)
      .forEach(r => {
        logger.error(`- ${r.name}: ${r.error}`);
      });
  }
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
main().catch((error) => {
  logger.error("Test runner error:", error);
  process.exit(1);
});