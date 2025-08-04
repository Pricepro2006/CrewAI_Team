import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use jsdom environment for React component tests
    environment: "jsdom",

    // Include only UI tests
    include: [
      "src/ui/components/**/*.test.{ts,tsx}",
      "src/client/components/**/*.test.{ts,tsx}",
      "src/client/pages/**/*.test.{ts,tsx}",
    ],

    // Exclude all other tests
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.integration.test.{ts,tsx}",
      "tests/production/**",
      "src/core/**/*.test.ts",
      "src/api/**/*.test.ts",
      "src/database/**/*.test.ts",
    ],

    // Setup files for UI tests
    setupFiles: ["./src/test/setup-unit.ts"],

    // Conservative timeouts for UI tests
    testTimeout: 20000, // 20 seconds for UI tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 8000,

    // Disable retries in CI to save memory
    retry: 0,

    // Global test configuration
    globals: true,

    // Coverage configuration (disabled for UI tests to save memory)
    coverage: {
      enabled: false,
    },

    // Ultra-conservative parallel execution for UI tests
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        // Single thread for UI tests in CI to prevent memory issues
        maxThreads: process.env.CI ? 1 : 2,
        singleThread: process.env.CI === "true",
        isolate: true,
        // Force memory cleanup between tests
        execArgv: ["--max-old-space-size=2048"],
      },
    },

    // Strict memory limits
    maxConcurrency: 1, // Only 1 test at a time
    sequence: {
      concurrent: false,
      shuffle: false,
    },

    // Memory-optimized environment variables
    env: {
      NODE_ENV: "test",
      DATABASE_URL: ":memory:",
      DISABLE_EXTERNAL_APIS: "true",
      LOG_LEVEL: "error",
      // Aggressive memory optimization
      NODE_OPTIONS: "--max-old-space-size=2048 --gc-interval=100",
    },

    // Dependencies configuration for vitest v3
    deps: {
      optimizer: {
        ssr: {
          include: ["@testing-library/jest-dom"],
        },
      },
      // Inline dependencies to reduce memory fragmentation
      inline: ["@testing-library/react", "@testing-library/user-event"],
    },

    // Disable reporters that consume memory
    reporter: process.env.CI ? ["basic"] : ["default"],
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
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    },
  },

  esbuild: {
    target: "node18",
    sourcemap: false, // Disable sourcemaps to save memory
    format: "esm",
    // Optimize for memory usage
    minify: false,
    keepNames: true,
  },

  // Define globals for jsdom environment
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"test"',
    "process.env.VITEST": "true",
  },
});