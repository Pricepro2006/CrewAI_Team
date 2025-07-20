/**
 * Setup file for integration tests
 * Ensures Ollama is running and test models are available
 */

import { beforeAll, afterAll } from "vitest";
import {
  setupOllamaForTesting,
  cleanupOllamaTests,
} from "./utils/ollama-test-helper";

// Set up test environment variables
process.env['NODE_ENV'] = "test";
process.env['OLLAMA_URL'] = process.env['OLLAMA_URL'] || "http://localhost:11434";
process.env['LOG_LEVEL'] = "error"; // Reduce noise during tests

// Global setup for all integration tests
beforeAll(async () => {
  console.log("Setting up Ollama for integration tests...");

  try {
    await setupOllamaForTesting();
    console.log("Ollama setup complete");
  } catch (error) {
    console.error("Failed to setup Ollama:", error);
    throw error;
  }
}, 120000); // 2 minutes timeout for setup

// Global cleanup
afterAll(async () => {
  await cleanupOllamaTests();
});
