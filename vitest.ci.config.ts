import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      "build",
      "src/ui/**", // UI tests run separately
      "src/**/*.integration.test.ts", // Integration tests run separately in CI
      "src/**/*.e2e.test.ts" // E2E tests run separately in CI
    ],
    testTimeout: 30000, // 30 seconds - optimized for CI
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 10000, // 10 seconds for cleanup
    
    // CI-specific retry configuration
    retry: {
      // Retry failed tests up to 2 times in CI
      failureCount: 2,
    },
    
    // Performance optimizations for CI
    maxConcurrency: 4, // Limit concurrent tests
    pool: 'threads', // Use threads for better performance
    
    // Coverage configuration for CI
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/**/*.d.ts",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/*.integration.test.ts",
        "src/**/*.e2e.test.ts",
        "src/ui/**",
        "src/scripts/**",
        "src/config/**",
      ],
      
      // Relaxed thresholds for CI
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
      
      // Skip coverage for files that fail
      skipFull: false,
      
      // Generate coverage even if tests fail
      reportOnFailure: true,
    },
    
    // Reporter configuration for CI
    reporter: [
      'default',
      'junit',
      'json'
    ],
    
    outputFile: {
      junit: './reports/junit.xml',
      json: './reports/test-results.json',
    },
    
    // Logging configuration
    logHeapUsage: true,
    
    // Environment variables specific to CI
    env: {
      NODE_ENV: 'test',
      CI: 'true',
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5:0.5b',
      OLLAMA_EMBED_MODEL: 'nomic-embed-text',
      TEST_TIMEOUT: '30000',
      SKIP_HEAVY_TESTS: 'true',
      DATABASE_PATH: ':memory:',
      LOG_LEVEL: 'error',
    },
  },
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
  // Esbuild configuration for faster builds
  esbuild: {
    target: 'node18',
    format: 'esm',
  },
});