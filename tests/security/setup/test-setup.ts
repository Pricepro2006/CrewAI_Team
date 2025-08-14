/**
 * Security Test Setup
 * Global setup configuration for security tests
 */

import { beforeAll, afterAll } from 'vitest';
import { getSecurityTestConfig } from '../config/security-test-config.js';

const config = getSecurityTestConfig();

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.SECURITY_TEST_MODE = 'true';
  process.env.JWT_SECRET = config.authentication.jwtSecret;
  
  console.log('🔒 Security test environment initialized');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Base URL: ${config.environment.baseUrl}`);
});

// Global test cleanup
afterAll(() => {
  console.log('🧹 Security test environment cleaned up');
});

// Global error handler for uncaught exceptions in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Export test utilities
export const testUtils = {
  config,
  
  // Helper to wait for a specified time
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate test data
  generateTestData: {
    randomString: (length: number = 10) => {
      return Math.random().toString(36).substring(2, length + 2);
    },
    
    randomEmail: () => {
      return `test${Math.random().toString(36).substring(7)}@example.com`;
    },
    
    randomPort: () => {
      return Math.floor(Math.random() * (65535 - 1024)) + 1024;
    }
  },
  
  // Helper to check if a service is running
  checkServiceHealth: async (url: string, timeout: number = 5000) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
};