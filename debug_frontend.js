import { chromium } from 'playwright';

async function debugFrontend() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Debugging frontend...');
  
  // Capture console logs
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });
  
  // Capture errors
  page.on('pageerror', error => {
    console.error(`[Browser Error] ${error.message}`);
  });
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForTimeout(5000);
  
  // Check if React has loaded
  const reactVersion = await page.evaluate(() => {
    return window.React ? window.React.version : 'Not loaded';
  });
  console.log('React version:', reactVersion);
  
  // Check if the app root has content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.length : 0;
  });
  console.log('Root content length:', rootContent);
  
  // Check for any visible elements
  const visibleElements = await page.evaluate(() => {
    const elements = document.querySelectorAll('*');
    let visibleCount = 0;
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        visibleCount++;
      }
    });
    return visibleCount;
  });
  console.log('Visible elements:', visibleElements);
  
  // Check for specific components
  const components = await page.evaluate(() => {
    return {
      chatInterface: !!document.querySelector('[class*="chat"]'),
      inputBox: !!document.querySelector('[class*="input"]'),
      textarea: !!document.querySelector('textarea'),
      buttons: document.querySelectorAll('button').length
    };
  });
  console.log('Components found:', components);
  
  // Check network requests
  let networkRequests = [];
  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType()
    });
  });
  
  await page.waitForTimeout(5000);
  
  // Filter interesting requests
  const interestingRequests = networkRequests.filter(req => 
    req.url.includes('trpc') || req.url.includes('localhost:3000') || req.resourceType === 'xhr'
  );
  
  console.log('Interesting network requests:', interestingRequests);
  
  // Take a screenshot
  await page.screenshot({ path: 'debug_screenshot.png' });
  console.log('Screenshot saved as debug_screenshot.png');
  
  // Keep browser open for manual inspection
  console.log('Browser opened for manual inspection. Press Ctrl+C to close.');
  await new Promise(() => {}); // Keep alive
}

debugFrontend().catch(console.error);