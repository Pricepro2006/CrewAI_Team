import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use jsdom environment for React component tests, node for others
    environment: "jsdom",

    // Include unit tests
    include: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],

    // Exclude integration tests and UI tests (handled by separate configs)
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.integration.test.{ts,tsx}",
      "tests/production/**",
      // Exclude UI component tests (use test:ui instead)
      "src/ui/components/**/*.test.{ts,tsx}",
      "src/client/components/**/*.test.{ts,tsx}",
      "src/client/pages/**/*.test.{ts,tsx}",
    ],

    // Setup files for unit tests
    setupFiles: ["./src/test/setup-unit.ts"],

    // Reasonable timeout for unit tests
    testTimeout: 15000, // 15 seconds for unit tests (increased for complex mocking)
    hookTimeout: 8000, // 8 seconds for setup/teardown
    
    // Force garbage collection between tests
    teardownTimeout: 5000,
    // Reduce memory pressure by limiting retries
    retry: process.env.CI ? 0 : 1,

    // Global test configuration
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.integration.test.{ts,tsx}",
        "src/test/**/*",
        "src/**/*.d.ts",
        "src/**/*.config.{ts,js}",
        "src/**/types.ts",
        "src/**/types/**/*",
      ],
    },

    // Memory-optimized parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        // Reduced max threads for memory optimization in CI
        maxThreads: process.env.CI ? 2 : 3,
        // Enable proper cleanup between tests
        singleThread: false,
        // Isolate tests to prevent memory leaks
        isolate: true,
      },
    },

    // Memory optimization settings
    maxConcurrency: process.env.CI ? 3 : 5,
    // Run tests serially within files to reduce memory pressure
    sequence: {
      concurrent: false,
      shuffle: false,
    },

    // Environment variables for unit tests
    env: {
      NODE_ENV: "test",
      // Use in-memory database for faster tests
      DATABASE_URL: ":memory:",
      // Disable external services for unit tests
      DISABLE_EXTERNAL_APIS: "true",
      LOG_LEVEL: "error", // Reduce log noise in tests
      // Memory optimization flags
      NODE_OPTIONS: "--max-old-space-size=4096",
    },

    // Dependencies configuration for vitest v3
    deps: {
      optimizer: {
        ssr: {
          include: ["@testing-library/jest-dom"],
        },
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "./src/core"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@client": path.resolve(__dirname, "./src/client"),
      "@lib": path.resolve(__dirname, "./src/lib"),
    },
    // Handle TypeScript files with .js extensions in imports
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    // Map .js imports to .ts files for TypeScript compatibility
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    },
  },

  esbuild: {
    target: "node18",
    // Handle TypeScript compilation for .js imports
    sourcemap: true,
    format: "esm",
  },

  // Define globals for jsdom environment
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"test"',
    "process.env.VITEST": "true",
  },
});
