import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration for Walmart Grocery Agent
 * Comprehensive testing with optimized timeouts and retry logic
 */
export default defineConfig({
  // Test directory - FIXED: Point to correct e2e tests
  testDir: './tests/e2e',
  
  // Output directories
  outputDir: './test-results/e2e-output',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 1,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : 2,
  
  // Timeout configurations - OPTIMIZED
  timeout: 120 * 1000, // 2 minutes per test
  expect: { timeout: 30 * 1000 }, // 30s for assertions
  
  // Global setup and teardown - DISABLED for ES modules compatibility
  // globalSetup: './tests/e2e/global-setup.ts',
  // globalTeardown: './tests/e2e/global-teardown.ts',
  
  // Reporter configuration
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report-e2e',
      open: 'never' 
    }],
    ['json', { 
      outputFile: 'e2e-results.json' 
    }],
    ['junit', { 
      outputFile: 'e2e-junit.xml' 
    }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL for tests - FIXED: Correct Walmart URL
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5178',
    
    // Navigation timeout - INCREASED
    navigationTimeout: 60 * 1000, // 1 minute
    
    // Action timeout - INCREASED  
    actionTimeout: 45 * 1000, // 45 seconds
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // User agent
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ]
        }
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  
  // Local dev server configuration
  webServer: {
    command: 'npm run dev-server',
    port: 5178,
    timeout: 120 * 1000, // 2 minutes to start
    reuseExistingServer: !process.env.CI,
  },
});