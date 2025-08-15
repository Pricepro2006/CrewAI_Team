/**
 * Test Setup for NLP Microservice
 * Configures test environment and mocks
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MONITORING_ENABLED = 'false';
process.env.SERVICE_DISCOVERY_ENABLED = 'false';
process.env.OLLAMA_NUM_PARALLEL = '2';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Mock fetch for integration tests
global.fetch = vi.fn();

// Set up global test timeout
vi.setConfig({ testTimeout: 10000 });