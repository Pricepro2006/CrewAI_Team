/**
 * Quick test to verify the application is running
 */

import { chromium } from 'playwright';

async function quickTest() {
  console.log('🔍 Quick connectivity test...');
  
  const browser = await chromium.launch({
    headless: true,
    timeout: 10000
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });

    const page = await context.newPage();
    
    console.log('📍 Navigating to application...');
    await page.goto('http://localhost:5178', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    console.log('📍 Taking screenshot...');
    await page.screenshot({ 
      path: 'app-screenshot.png',
      fullPage: false
    });
    
    const title = await page.title();
    console.log(`📊 Page title: ${title}`);
    
    // Check if main elements exist
    const mainContent = await page.locator('body').count();
    console.log(`📊 Main content found: ${mainContent > 0 ? 'Yes' : 'No'}`);
    
    console.log('✅ Application is accessible');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);