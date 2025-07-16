// Test setup file for vitest
import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs/promises";

// Set up test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = ":memory:";
process.env.LOG_LEVEL = "error";
process.env.OLLAMA_URL = "http://localhost:11434";

// Create test data directory
const testDataDir = path.join(process.cwd(), "test-data");

beforeAll(async () => {
  // Ensure test data directory exists
  await fs.mkdir(testDataDir, { recursive: true });
});

afterAll(async () => {
  // Clean up test data directory
  try {
    await fs.rm(testDataDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors during cleanup
  }
});

beforeEach(() => {
  // Reset any mocks or test state
});

afterEach(() => {
  // Clean up after each test
});
