/**
 * Very simple UI test for Walmart Grocery Agent
 */

import { chromium } from 'playwright';

async function simpleTest() {
  console.log('🛒 SIMPLE WALMART TEST');
  console.log('='.repeat(30));
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  try {
    const page = await browser.newPage();
    
    console.log('📍 Loading page...');
    await page.goto('http://localhost:5178', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    console.log('📍 Taking screenshot...');
    await page.screenshot({ path: 'ui-test-1.png' });
    
    console.log('📍 Looking for main content...');
    const body = await page.textContent('body');
    const hasContent = body && body.length > 100;
    console.log(`Content loaded: ${hasContent ? 'Yes' : 'No'}`);
    
    console.log('📍 Looking for navigation elements...');
    
    // Check for common navigation patterns
    const navElements = await page.locator('nav, [role="navigation"], header').count();
    console.log(`Navigation elements: ${navElements}`);
    
    // Look for any links or buttons
    const links = await page.locator('a').count();
    const buttons = await page.locator('button').count();
    console.log(`Links: ${links}, Buttons: ${buttons}`);
    
    // Look for walmart-related content
    const walmartContent = await page.locator('text=/walmart/i').count();
    console.log(`Walmart references: ${walmartContent}`);
    
    // Try to find and click on any walmart-related element
    if (walmartContent > 0) {
      console.log('📍 Found Walmart content, trying to interact...');
      try {
        const walmartEl = page.locator('text=/walmart/i').first();
        await walmartEl.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'ui-test-2-walmart.png' });
        console.log('✅ Clicked Walmart element');
      } catch (e) {
        console.log('❌ Could not click Walmart element');
      }
    }
    
    console.log('📍 Final screenshot...');
    await page.screenshot({ path: 'ui-test-3-final.png', fullPage: true });
    
    console.log('\n📊 RESULTS:');
    console.log(`✅ Page loaded: Yes`);
    console.log(`✅ Content found: ${hasContent ? 'Yes' : 'No'}`);
    console.log(`📊 Navigation elements: ${navElements}`);
    console.log(`📊 Interactive elements: ${links + buttons}`);
    console.log(`📊 Walmart references: ${walmartContent}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page?.screenshot({ path: 'ui-test-error.png' });
  } finally {
    console.log('\n🔄 Closing browser in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }
}

simpleTest().catch(console.error);