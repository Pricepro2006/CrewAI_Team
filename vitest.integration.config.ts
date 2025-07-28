import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use jsdom environment for UI components
    environment: 'node',
    
    // Integration test configuration - include only .integration.test files
    include: [
      'src/**/*.integration.test.{ts,tsx}',
      'src/test/integration/**/*.{test,spec}.{ts,tsx}',
      'src/test/system/**/*.{test,spec}.{ts,tsx}'
    ],
    
    // Exclude everything else
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**'
    ],
    
    // Setup files
    setupFiles: [
      './src/test/setup-integration.ts'
    ],
    
    // Test timeout for integration tests (longer for real services)
    testTimeout: 60000, // 1 minute for integration tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    
    // Global test configuration
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.integration.test.{ts,tsx}',
        'src/test/**/*',
        'src/**/*.d.ts',
        'src/**/*.config.{ts,js}',
        'src/**/types.ts',
        'src/**/types/**/*'
      ]
    },
    
    // Retry failed tests (helpful for flaky integration tests)
    retry: 2,
    
    // Run tests sequentially to avoid resource conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    
    // Environment variables for integration tests
    env: {
      NODE_ENV: 'test',
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      OLLAMA_DEFAULT_MODEL: process.env.OLLAMA_DEFAULT_MODEL || 'doomgrave/phi-4:14b-tools-Q3_K_S',
      OLLAMA_TIMEOUT: '45000',
      OLLAMA_MAX_RETRIES: '3',
      // Use test database
      DATABASE_URL: ':memory:',
      // Disable external services for testing
      DISABLE_EXTERNAL_APIS: 'true',
    }
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@api': path.resolve(__dirname, './src/api'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
  
  esbuild: {
    target: 'esnext',
  },
});