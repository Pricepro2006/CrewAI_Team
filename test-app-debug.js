import { chromium } from 'playwright';

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    logs.push(`PAGE ERROR: ${error.message}`);
  });
  
  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  
  console.log('2. Waiting for page to load completely...');
  await page.waitForLoadState('networkidle');
  
  console.log('3. Taking screenshot of initial state...');
  await page.screenshot({ path: 'debug-1-initial.png', fullPage: true });
  
  // Wait a bit before interacting
  await page.waitForTimeout(1000);
  
  console.log('4. Finding chat input...');
  const textarea = await page.locator('textarea[placeholder*="Type"]').first();
  
  console.log('5. Clicking and typing message...');
  await textarea.click();
  await textarea.fill('Research the latest trends in AI agent architectures and create a summary report');
  
  console.log('6. Taking screenshot after typing...');
  await page.screenshot({ path: 'debug-2-typed.png', fullPage: true });
  
  console.log('7. Finding send button...');
  const sendButton = await page.locator('button').filter({ has: page.locator('svg') }).last();
  
  console.log('8. Clicking send button...');
  await sendButton.click();
  
  console.log('9. Waiting for response...');
  await page.waitForTimeout(5000);
  
  console.log('10. Taking final screenshot...');
  await page.screenshot({ path: 'debug-3-final.png', fullPage: true });
  
  console.log('\nPage URL after interaction:', page.url());
  
  console.log('\nConsole logs:');
  logs.forEach(log => console.log('  ', log));
  
  // Check for any messages in the chat
  const messages = await page.locator('[class*="message"], [class*="chat"], div:has-text("Research")').all();
  console.log(`\nFound ${messages.length} potential message elements`);
  
  // Get page content for debugging
  const bodyText = await page.locator('body').textContent();
  console.log('\nPage content preview:', bodyText.substring(0, 500));
  
  await browser.close();
})();