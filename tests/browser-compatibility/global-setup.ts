import { FullConfig } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';

/**
 * Global setup for browser compatibility tests
 * Initializes browser instances and performs pre-test setup
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Browser Compatibility Test Suite');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
  console.log(`📍 Testing against: ${baseURL}`);

  // Warm up browsers by launching them once
  console.log('🔥 Warming up browsers...');
  
  try {
    // Warm up Chromium
    const chromiumBrowser = await chromium.launch({ headless: true });
    await chromiumBrowser.close();
    console.log('✅ Chromium warmed up');

    // Warm up Firefox  
    const firefoxBrowser = await firefox.launch({ headless: true });
    await firefoxBrowser.close();
    console.log('✅ Firefox warmed up');

    // Warm up WebKit (Safari)
    const webkitBrowser = await webkit.launch({ headless: true });
    await webkitBrowser.close();
    console.log('✅ WebKit warmed up');

  } catch (error) {
    console.warn('⚠️ Warning: Some browsers may not be available:', error.message);
  }

  // Test server availability
  console.log('🌐 Checking server availability...');
  try {
    const response = await fetch(baseURL);
    if (response.ok) {
      console.log('✅ Server is ready');
    } else {
      console.warn(`⚠️ Server responded with status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Server is not accessible:', error.message);
    throw new Error('Server must be running for browser compatibility tests');
  }

  // Create test results directory
  const fs = require('fs');
  const path = require('path');
  
  const resultsDir = path.join(process.cwd(), 'browser-compatibility-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
    console.log('📁 Created results directory');
  }

  // Create browser-specific result directories
  const browsers = ['chrome', 'firefox', 'safari', 'edge'];
  browsers.forEach(browser => {
    const browserDir = path.join(resultsDir, browser);
    if (!fs.existsSync(browserDir)) {
      fs.mkdirSync(browserDir, { recursive: true });
    }
  });

  console.log('🎯 Global setup complete - Ready to run compatibility tests');
}

export default globalSetup;