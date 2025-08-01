import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Use Node.js environment for backend/server-side tests
    environment: "node",

    // Include unit tests
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
    ],

    // Exclude integration tests (handled by separate config)
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.integration.test.{ts,tsx}",
      "tests/production/**",
    ],

    // Setup files for unit tests
    setupFiles: ["./src/test/setup-unit.ts"],

    // Reasonable timeout for unit tests
    testTimeout: 10000, // 10 seconds for unit tests
    hookTimeout: 5000,  // 5 seconds for setup/teardown

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

    // Parallel execution for faster tests
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },

    // Environment variables for unit tests
    env: {
      NODE_ENV: "test",
      // Use in-memory database for faster tests
      DATABASE_URL: ":memory:",
      // Disable external services for unit tests
      DISABLE_EXTERNAL_APIS: "true",
      LOG_LEVEL: "error", // Reduce log noise in tests
    },

    // Mock external dependencies - moved to server.deps.inline
    server: {
      deps: {
        inline: ["@testing-library/jest-dom"],
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
  },

  esbuild: {
    target: "node18",
  },

  // Define globals for Node.js environment
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"test"',
    "process.env.VITEST": "true",
  },
});