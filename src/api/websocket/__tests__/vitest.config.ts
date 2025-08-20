/**
 * Vitest Configuration for WebSocket Tests
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    testTimeout: 10000, // 10 seconds timeout for WebSocket tests
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: false, // Allow sharing of server instances
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../')
    }
  }
});
