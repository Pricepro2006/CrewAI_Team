import { chromium } from 'playwright';

async function testTrpcSimple() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing tRPC client - Simple version...');
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForTimeout(5000);
  
  // Check page content
  const pageContent = await page.content();
  console.log('Page title:', await page.title());
  console.log('Page has React root:', pageContent.includes('id="root"'));
  
  // Monitor network requests
  let networkRequests = [];
  page.on('request', request => {
    if (request.url().includes('trpc')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
      console.log(`Request: ${request.method()} ${request.url()}`);
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('trpc')) {
      console.log(`Response: ${response.url()} - Status: ${response.status()}`);
    }
  });
  
  // Try to find the textarea
  try {
    await page.waitForSelector('textarea', { timeout: 10000 });
    console.log('✅ Textarea found!');
    
    // Type a test message
    await page.fill('textarea', 'Hello, test message');
    console.log('✅ Message typed');
    
    // Find and click the send button
    const sendButton = await page.locator('button.send-button').first();
    if (await sendButton.count() > 0) {
      await sendButton.click();
      console.log('✅ Send button clicked');
    } else {
      console.log('❌ Send button not found');
    }
    
    // Wait for network requests
    await page.waitForTimeout(3000);
    
    console.log(`Network requests made: ${networkRequests.length}`);
    networkRequests.forEach(req => console.log(`  - ${req.method} ${req.url}`));
    
    // Check if there's any response in the page
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Research Summary') || bodyText.includes('Multi-Agent')) {
      console.log('✅ Response content found in page!');
    } else {
      console.log('❌ Response content not found');
    }
    
  } catch (error) {
    console.error('Error during testing:', error.message);
  }
  
  // Keep browser open for manual inspection
  console.log('Keeping browser open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
}

testTrpcSimple().catch(console.error);