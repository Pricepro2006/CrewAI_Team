import { chromium } from 'playwright';

(async () => {
  // Launch browser with devtools
  const browser = await chromium.launch({ 
    headless: false,
    devtools: true 
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser console error:', msg.text());
    }
  });

  // Intercept network requests to see what's happening
  page.on('response', async response => {
    if (response.url().includes('/trpc/')) {
      console.log(`\nNetwork Response: ${response.url()}`);
      console.log(`Status: ${response.status()}`);
      try {
        const body = await response.json();
        console.log('Response body:', JSON.stringify(body, null, 2));
      } catch (e) {
        console.log('Could not parse response body');
      }
    }
  });

  try {
    console.log('1. Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173');
    
    console.log('2. Waiting for page to load...');
    await page.waitForTimeout(2000);
    
    console.log('3. Typing in chat input...');
    await page.fill('textarea[placeholder*="Type"]', 'Research the latest trends in AI agent architectures and create a summary report');
    
    console.log('4. Clicking send button...');
    await page.click('.send-button');
    
    console.log('5. Waiting for response...');
    await page.waitForTimeout(3000);
    
    // Check what's in the DOM
    const assistantMessage = await page.evaluate(() => {
      const assistantEl = document.querySelector('.message-assistant .message-content');
      return assistantEl ? assistantEl.textContent : 'No assistant element found';
    });
    
    console.log('\nAssistant message in DOM:', assistantMessage);
    
    // Also check the full page content
    const fullContent = await page.evaluate(() => document.body.innerText);
    console.log('\nChecking for research content...');
    if (fullContent.includes('Research Summary') || fullContent.includes('Multi-Agent Orchestration')) {
      console.log('SUCCESS: Found research content!');
    } else {
      console.log('ISSUE: Research content not found');
    }
    
    await page.screenshot({ path: 'test-v3-final.png', fullPage: true });
    
  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    console.log('\nKeeping browser open for inspection. Press Ctrl+C to close.');
    // Keep browser open
    await new Promise(() => {}); 
  }
})();