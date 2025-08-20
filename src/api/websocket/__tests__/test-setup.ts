/**
 * Test Setup for WebSocket Tests
 * Configures global test environment and utilities
 */

import { vi } from 'vitest';

// Mock logger to reduce noise in tests
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

// Global test utilities
global.testUtils = {
  randomPort: () => 3000 + Math.floor(Math.random() * 1000),
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  createMockRequest: (url: string, headers: Record<string, string> = {}) => ({
    url,
    method: 'GET',
    headers: {
      'connection': 'upgrade',
      'upgrade': 'websocket',
      'sec-websocket-version': '13',
      'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
      ...headers
    }
  }),
  createMockSocket: () => ({
    destroy: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  })
};

// Extend global types
declare global {
  var testUtils: {
    randomPort: () => number;
    delay: (ms: number) => Promise<void>;
    createMockRequest: (url: string, headers?: Record<string, string>) => any;
    createMockSocket: () => any;
  };
}

// Cleanup function for tests
process.on('exit', () => {
  console.log('Test process exiting, cleaning up resources...');
});
