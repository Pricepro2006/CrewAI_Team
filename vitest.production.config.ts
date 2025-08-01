import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Extended timeout for production tests (5 minutes)
    timeout: 300000,

    // Sequential execution for stability and resource management
    maxConcurrency: 1,

    // Test environment configuration
    environment: "node",

    // Global setup and teardown
    setupFiles: ["./tests/production/setup.ts"],

    // Extended teardown timeout for cleanup
    teardownTimeout: 60000,

    // Environment variables for production testing
    env: {
      NODE_ENV: "test",
      DATABASE_PATH: "./data/test-crewai.db",
      REDIS_URL: "redis://localhost:6379",
      OLLAMA_HOST: "http://localhost:11434",
      CHROMADB_URL: "http://localhost:8000",
      LOG_LEVEL: "info",
    },

    // Include only production test files
    include: ["tests/production/**/*.test.ts", "tests/production/**/*.spec.ts"],

    // Exclude development and unit tests
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/unit/**",
      "tests/integration/**",
    ],

    // Coverage configuration for production tests
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage/production",
      include: [
        "src/core/pipeline/**",
        "src/database/repositories/**",
        "src/core/processors/**",
        "src/api/services/**",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/types.ts",
        "src/**/*.d.ts",
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },

    // Reporting configuration
    reporter: ["verbose", "json", "html"],
    outputFile: {
      json: "./tests/production/results/test-results.json",
      html: "./tests/production/results/test-report.html",
    },

    // Retry configuration for flaky tests
    retry: 2,

    // Watch mode disabled for production tests
    watch: false,

    // Globals configuration
    globals: true,

    // TypeScript configuration
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.json",
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
  },

  // Define configuration for Node.js environment
  define: {
    "process.env.NODE_ENV": '"test"',
    "process.env.VITEST": "true",
  },

  // Optimize deps for testing
  optimizeDeps: {
    include: ["vitest", "better-sqlite3"],
  },
});
