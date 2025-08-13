import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/walmart-ui-comprehensive',
  timeout: 60000, // Increased timeout for LLM operations
  fullyParallel: false, // Sequential execution for better stability
  retries: 1,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    baseURL: 'http://localhost:5178',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Add extra headers for test requests
    extraHTTPHeaders: {
      'X-Test-Environment': 'true',
      'X-Disable-CSRF': 'true',
      'User-Agent': 'Walmart-Test-Suite/1.0'
    },
    // Increase timeouts for slow operations
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  expect: {
    // Global expect timeout
    timeout: 10000,
  },
  // Comment out webServer since services are already running
  // webServer: [
  //   {
  //     command: 'npm run dev-server',
  //     port: 5178,
  //     reuseExistingServer: true,
  //     timeout: 120000,
  //     env: {
  //       NODE_ENV: 'test',
  //       DISABLE_CSRF_FOR_TESTS: 'true',
  //     }
  //   },
  //   {
  //     command: 'npm run dev:server',
  //     port: 3001,
  //     reuseExistingServer: true,
  //     timeout: 120000,
  //     env: {
  //       NODE_ENV: 'test',
  //       DISABLE_CSRF_FOR_TESTS: 'true',
  //     }
  //   }
  // ],
  // Global test setup
  globalSetup: './tests/walmart-ui-comprehensive/global-setup.ts',
});