import { chromium } from 'playwright';

async function testTrpcClient() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing tRPC client integration...');
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Monitor network requests
  const networkRequests = [];
  page.on('request', request => {
    if (request.url().includes('trpc')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('trpc')) {
      console.log(`Response: ${response.url()} - Status: ${response.status()}`);
    }
  });
  
  // Try to find the input field and send a message
  try {
    // Wait for the input field to be available
    await page.waitForSelector('input[type="text"], textarea', { timeout: 5000 });
    
    // Type a test message
    await page.fill('input[type="text"], textarea', 'Hello, can you help me with AI agent research?');
    
    // Find and click the send button
    const sendButton = await page.locator('button').filter({ hasText: /send|submit/i }).first();
    if (await sendButton.count() > 0) {
      await sendButton.click();
    } else {
      // Try pressing Enter
      await page.keyboard.press('Enter');
    }
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Check for messages in the chat interface
    const messages = await page.locator('[class*="message"], [class*="chat"]').all();
    console.log(`Found ${messages.length} message elements`);
    
    // Check if there's any response text
    const responseText = await page.textContent('body');
    if (responseText.includes('Research Summary') || responseText.includes('Multi-Agent Orchestration')) {
      console.log('✅ tRPC client successfully received and displayed the response!');
    } else {
      console.log('❌ Response not found in the page');
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  }
  
  console.log('Network requests made:', networkRequests);
  
  // Keep browser open for inspection
  console.log('Browser opened. Check manually if needed. Press Ctrl+C to close.');
  await page.waitForTimeout(10000);
  
  await browser.close();
}

testTrpcClient().catch(console.error);