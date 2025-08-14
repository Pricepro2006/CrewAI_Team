/**
 * Vitest Configuration for Security Tests
 * Optimized configuration for security test suite
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test files pattern
    include: ['tests/security/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.d.ts'
    ],

    // Timeout configuration
    testTimeout: 30000,
    hookTimeout: 10000,

    // Global setup and teardown
    globalSetup: [],
    setupFiles: ['tests/security/setup/test-setup.ts'],

    // Reporters
    reporters: ['verbose', 'json', 'junit'],
    outputFile: {
      json: './tests/security/reports/security-test-results.json',
      junit: './tests/security/reports/security-test-results.xml'
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './tests/security/reports/coverage',
      include: [
        'src/api/**/*.ts',
        'src/services/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'node_modules/**',
        'dist/**'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },

    // Parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },

    // Retry configuration for flaky tests
    retry: 2,

    // Test isolation
    isolate: true,

    // Watch mode
    watch: false,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      SECURITY_TEST_MODE: 'true',
      JWT_SECRET: 'test-jwt-secret-for-security-tests',
      SECURITY_TEST_BASE_URL: 'http://localhost:3000'
    }
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
      '@tests': resolve(__dirname, '.'),
      '@config': resolve(__dirname, './config')
    }
  },

  esbuild: {
    target: 'node18'
  }
});