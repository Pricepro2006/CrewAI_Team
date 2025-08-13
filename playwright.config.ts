import { defineConfig, devices } from '@playwright/test';

/**
 * Browser Compatibility Test Configuration
 * Comprehensive multi-browser testing for Walmart Grocery Agent
 */
export default defineConfig({
  // Test directory
  testDir: './tests/browser-compatibility',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Global setup and teardown
  globalSetup: './tests/browser-compatibility/global-setup.ts',
  globalTeardown: './tests/browser-compatibility/global-teardown.ts',
  
  // Reporter configuration
  reporter: [
    ['html', { 
      outputFolder: 'browser-compatibility-report',
      open: 'never' 
    }],
    ['json', { 
      outputFile: 'browser-compatibility-results.json' 
    }],
    ['junit', { 
      outputFile: 'browser-compatibility-junit.xml' 
    }],
    process.env.CI ? ['github'] : ['list']
  ],
  
  // Shared settings for all tests
  use: {
    // Base URL for tests - use dedicated test port
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5178',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Global test timeout - increased for complex interactions
    actionTimeout: 45000,
    
    // Navigation timeout - optimized for slow connections
    navigationTimeout: 60000,
    
    // Page load timeout
    pageLoadTimeout: 90000,
    
    // Service worker timeout
    serviceWorkerTimeout: 30000,
  },

  // Test timeout - increased for comprehensive tests
  timeout: 120000,
  
  // Expect timeout for assertions - improved for dynamic content
  expect: {
    timeout: 15000,
    toHaveScreenshot: {
      timeout: 30000,
      animations: 'disabled',
      mode: 'actual'
    }
  },
  
  // Global test configuration
  globalTimeout: 600000, // 10 minutes for entire test suite

  // Browser projects for comprehensive compatibility testing
  projects: [
    // Desktop Chrome
    {
      name: 'chrome-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--enable-features=NetworkService',
            '--force-device-scale-factor=1',
            '--high-dpi-support=1',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ],
          timeout: 30000
        }
      },
      testMatch: [
        '**/chrome/**/*.spec.ts',
        '**/common/**/*.spec.ts'
      ]
    },

    // Desktop Firefox
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.permission.disabled': true,
            'permissions.default.microphone': 1,
            'permissions.default.camera': 1
          }
        }
      },
      testMatch: [
        '**/firefox/**/*.spec.ts',
        '**/common/**/*.spec.ts'
      ]
    },

    // Desktop Safari (WebKit)
    {
      name: 'safari-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: [
        '**/safari/**/*.spec.ts',
        '**/common/**/*.spec.ts'
      ]
    },

    // Desktop Edge
    {
      name: 'edge-desktop',
      use: { 
        ...devices['Desktop Edge'],
        channel: 'msedge',
        viewport: { width: 1920, height: 1080 }
      },
      testMatch: [
        '**/edge/**/*.spec.ts',
        '**/common/**/*.spec.ts'
      ]
    },

    // Mobile Chrome
    {
      name: 'chrome-mobile',
      use: { 
        ...devices['Pixel 7'],
      },
      testMatch: [
        '**/mobile/**/*.spec.ts'
      ]
    },

    // Mobile Safari
    {
      name: 'safari-mobile',
      use: { 
        ...devices['iPhone 14'],
      },
      testMatch: [
        '**/mobile/**/*.spec.ts'
      ]
    },

    // Tablet tests
    {
      name: 'tablet-chrome',
      use: { 
        ...devices['iPad Pro'],
      },
      testMatch: [
        '**/tablet/**/*.spec.ts'
      ]
    }
  ],

  // Web server for tests - optimized configuration
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev-server',
    port: 5178, // Use dedicated test port
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // Increased timeout for server startup
    env: {
      NODE_ENV: 'test',
      VITE_PORT: '5178'
    },
    stderr: 'pipe',
    stdout: 'pipe'
  }
});