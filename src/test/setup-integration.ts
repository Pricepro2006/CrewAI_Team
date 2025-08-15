/**
 * Setup file for integration tests
 * Ensures Ollama is running, test models are available, and error handling is configured
 */

import { beforeAll, afterAll } from "vitest";
import {
  setupOllamaForTesting,
  cleanupOllamaTests,
} from "./utils/ollama-test-helper.js";
import {
  setupTestErrorHandling,
  validateTestEnvironment,
  handleTestError,
  testErrorReporter,
} from "./utils/error-handling.js";
import { logger } from "../utils/logger.js";

// Set up test environment variables
process.env['NODE_ENV'] = "test";
process.env['OLLAMA_BASE_URL'] = process.env['OLLAMA_BASE_URL'] || "http://localhost:11434";
process.env['LOG_LEVEL'] = process.env['LOG_LEVEL'] || "error"; // Reduce noise during tests

// Setup global error handling
setupTestErrorHandling();

// Global setup for all integration tests
beforeAll(async () => {
  console.log("Setting up integration test environment...");
  
  try {
    // Validate test environment first
    const validation = await validateTestEnvironment();
    if (!validation.isValid) {
      logger.warn("Test environment validation issues found:");
      validation.issues.forEach(issue => logger.warn(`  - ${issue}`));
      
      if (validation.recommendations.length > 0) {
        logger.info("Recommendations:");
        validation.recommendations.forEach(rec => logger.info(`  - ${rec}`));
      }
    }
    
    // Setup Ollama for testing
    await setupOllamaForTesting();
    
    // Final health check
    const healthCheck = await import("./utils/error-handling.js").then(
      module => module.checkOllamaHealth(process.env.OLLAMA_BASE_URL!)
    );
    
    if (!healthCheck.isHealthy) {
      throw new Error(`Ollama health check failed: ${healthCheck.error}`);
    }
    
    logger.info("Integration test setup completed successfully");
    logger.info(`Ollama latency: ${healthCheck.latency}ms`);
    logger.info(`Available models: ${healthCheck.models?.join(', ') || 'none'}`);
    
  } catch (error) {
    testErrorReporter.reportError(
      error instanceof Error ? error : new Error(String(error)),
      "Global test setup"
    );
    
    logger.error("Failed to setup integration test environment:", String(error));
    handleTestError(error, "Global test setup");
  }
}, 120000); // 2 minutes timeout for setup

// Global cleanup
afterAll(async () => {
  logger.info("Cleaning up integration test environment...");
  
  try {
    await cleanupOllamaTests();
    
    // Report error summary if any errors occurred
    const errorSummary = testErrorReporter.getErrorSummary();
    if (errorSummary.totalErrors > 0) {
      logger.warn(`Integration tests completed with ${errorSummary.totalErrors} errors:`);
      Object.entries(errorSummary.errorsByType).forEach(([type, count]) => {
        logger.warn(`  ${type}: ${count}`);
      });
    }
    
    logger.info("Integration test cleanup completed");
  } catch (error) {
    logger.error("Error during test cleanup:", String(error));
    // Don't throw here to avoid masking test results
  }
});
