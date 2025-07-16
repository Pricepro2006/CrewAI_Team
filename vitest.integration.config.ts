import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup-integration.ts"],
    include: ["src/**/*.integration.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "build"],
    testTimeout: 60000, // 60 seconds for integration tests
    hookTimeout: 30000, // 30 seconds for hooks
    teardownTimeout: 10000, // 10 seconds for teardown
    pool: "forks", // Use separate processes for isolation
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid Ollama conflicts
      },
    },
    reporters: ["verbose"], // Detailed output for integration tests
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
