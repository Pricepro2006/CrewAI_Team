import { PlaywrightTestConfig } from '@playwright/test';

/**
 * Optimized Test Environment Configuration
 * Addresses timeout issues and improves test reliability
 */

export const TEST_ENVIRONMENT_CONFIG = {
  // Base configuration
  baseURL: process.env.TEST_BASE_URL || 'http://localhost:5178',
  
  // Timeout configurations (in milliseconds)
  timeouts: {
    // Page navigation and loading
    navigation: 60000,        // 60 seconds for navigation
    pageLoad: 90000,         // 90 seconds for full page load
    networkIdle: 30000,      // 30 seconds for network idle
    
    // Element interactions
    action: 45000,           // 45 seconds for actions
    elementVisible: 15000,   // 15 seconds for element visibility
    elementLoad: 30000,      // 30 seconds for element loading
    
    // API and network
    apiResponse: 30000,      // 30 seconds for API responses
    websocket: 10000,        // 10 seconds for WebSocket connections
    
    // Test execution
    testExecution: 120000,   // 2 minutes per test
    testSuite: 600000,       // 10 minutes per test suite
    
    // Browser operations
    browserLaunch: 30000,    // 30 seconds for browser launch
    screenshot: 15000,       // 15 seconds for screenshots
  },
  
  // Retry configuration
  retries: {
    ci: 3,                   // 3 retries in CI
    local: 1,                // 1 retry locally
    flaky: 5,                // 5 retries for known flaky tests
  },
  
  // Performance optimization
  performance: {
    parallelWorkers: process.env.CI ? 2 : 4,
    fullyParallel: true,
    maxFailures: process.env.CI ? 10 : 5,
  },
  
  // Browser launch options
  browserOptions: {
    // Chrome optimizations
    chrome: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--enable-features=NetworkService',
        '--force-device-scale-factor=1',
        '--no-first-run',
        '--no-zygote',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ],
      timeout: 30000
    },
    
    // Firefox optimizations
    firefox: {
      firefoxUserPrefs: {
        'media.navigator.permission.disabled': true,
        'permissions.default.microphone': 1,
        'permissions.default.camera': 1,
        'dom.webnotifications.enabled': false,
        'dom.push.enabled': false
      }
    },
    
    // Safari/WebKit optimizations
    webkit: {
      // WebKit specific settings
    }
  },
  
  // Wait strategies
  waitStrategies: {
    // For page navigation
    pageNavigation: 'networkidle' as const,
    
    // For dynamic content
    dynamicContent: {
      strategy: 'elementVisible' as const,
      timeout: 15000
    },
    
    // For API responses
    apiResponse: {
      strategy: 'networkResponse' as const,
      timeout: 30000
    }
  },
  
  // Error handling
  errorHandling: {
    screenshotOnFailure: true,
    videoOnFailure: true,
    traceOnFailure: true,
    continueOnError: false
  }
};

/**
 * Helper function to get optimized wait options
 */
export function getWaitOptions(type: 'navigation' | 'element' | 'api' | 'websocket') {
  const config = TEST_ENVIRONMENT_CONFIG.timeouts;
  
  switch (type) {
    case 'navigation':
      return {
        waitUntil: 'networkidle' as const,
        timeout: config.navigation
      };
      
    case 'element':
      return {
        timeout: config.elementVisible
      };
      
    case 'api':
      return {
        timeout: config.apiResponse
      };
      
    case 'websocket':
      return {
        timeout: config.websocket
      };
      
    default:
      return {
        timeout: config.action
      };
  }
}

/**
 * Helper function to get browser-specific launch options
 */
export function getBrowserLaunchOptions(browserName: 'chromium' | 'firefox' | 'webkit') {
  const baseOptions = {
    timeout: TEST_ENVIRONMENT_CONFIG.timeouts.browserLaunch,
    slowMo: process.env.CI ? 0 : 50  // Slow down in local development
  };
  
  switch (browserName) {
    case 'chromium':
      return {
        ...baseOptions,
        args: TEST_ENVIRONMENT_CONFIG.browserOptions.chrome.args
      };
      
    case 'firefox':
      return {
        ...baseOptions,
        firefoxUserPrefs: TEST_ENVIRONMENT_CONFIG.browserOptions.firefox.firefoxUserPrefs
      };
      
    case 'webkit':
      return baseOptions;
      
    default:
      return baseOptions;
  }
}

/**
 * Helper function for robust element waiting
 */
export async function waitForElementWithRetry(
  page: any, 
  selector: string, 
  options?: { 
    timeout?: number; 
    retries?: number; 
    visible?: boolean 
  }
) {
  const maxRetries = options?.retries || 3;
  const timeout = options?.timeout || TEST_ENVIRONMENT_CONFIG.timeouts.elementVisible;
  const visible = options?.visible !== false;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const element = page.locator(selector);
      
      if (visible) {
        await element.waitFor({ 
          state: 'visible', 
          timeout: timeout / maxRetries 
        });
      } else {
        await element.waitFor({ 
          state: 'attached', 
          timeout: timeout / maxRetries 
        });
      }
      
      return element;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Element '${selector}' not found after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

/**
 * Helper function for robust navigation
 */
export async function navigateWithRetry(
  page: any,
  url: string,
  options?: { 
    timeout?: number; 
    retries?: number; 
    waitUntil?: 'load' | 'networkidle' | 'domcontentloaded' 
  }
) {
  const maxRetries = options?.retries || 3;
  const timeout = options?.timeout || TEST_ENVIRONMENT_CONFIG.timeouts.navigation;
  const waitUntil = options?.waitUntil || 'networkidle';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil,
        timeout: timeout / maxRetries
      });
      
      // Verify page loaded successfully
      await page.waitForLoadState('domcontentloaded', { 
        timeout: 10000 
      });
      
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Navigation to '${url}' failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      console.log(`Navigation attempt ${attempt} failed, retrying...`);
      await page.waitForTimeout(2000 * attempt);
    }
  }
}

export default TEST_ENVIRONMENT_CONFIG;