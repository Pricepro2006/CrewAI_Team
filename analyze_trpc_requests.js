import { chromium } from 'playwright';

(async () => {
  // Launch browser with devtools
  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Enable request interception to log network details
  const requests = [];
  
  page.on('request', request => {
    if (request.url().includes('localhost') && request.method() === 'POST') {
      console.log('\n=== OUTGOING REQUEST ===');
      console.log('URL:', request.url());
      console.log('Method:', request.method());
      console.log('Headers:', request.headers());
      console.log('Post Data:', request.postData());
      
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData()
      });
    }
  });

  page.on('response', response => {
    if (response.url().includes('localhost') && response.request().method() === 'POST') {
      console.log('\n=== RESPONSE ===');
      console.log('Status:', response.status());
      console.log('Headers:', response.headers());
      response.text().then(body => {
        console.log('Body:', body);
      }).catch(err => {
        console.log('Could not read response body:', err.message);
      });
    }
  });

  page.on('requestfailed', request => {
    if (request.url().includes('localhost')) {
      console.log('\n=== FAILED REQUEST ===');
      console.log('URL:', request.url());
      console.log('Failure:', request.failure());
    }
  });

  try {
    // Navigate to the application
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    
    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Look for the chat input - trying multiple possible selectors
    console.log('\nLooking for chat input...');
    
    const inputSelectors = [
      'input[type="text"]',
      'textarea',
      'input[placeholder*="message"]',
      'input[placeholder*="chat"]',
      'input[placeholder*="type"]',
      '[data-testid="chat-input"]',
      '.chat-input',
      '#chat-input'
    ];

    let chatInput = null;
    for (const selector of inputSelectors) {
      try {
        chatInput = await page.locator(selector).first();
        if (await chatInput.isVisible({ timeout: 1000 })) {
          console.log(`Found input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!chatInput || !(await chatInput.isVisible({ timeout: 1000 }))) {
      console.log('Could not find chat input. Taking screenshot...');
      await page.screenshot({ path: 'page-screenshot.png' });
      console.log('Screenshot saved as page-screenshot.png');
      console.log('\nPage content preview:');
      const bodyText = await page.locator('body').textContent();
      console.log(bodyText.substring(0, 500) + '...');
      return;
    }

    // Type the test message
    console.log('\nTyping test message...');
    await chatInput.fill('Test message');
    
    // Look for send button
    const buttonSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("send")',
      '[data-testid="send-button"]',
      '.send-button',
      'button[aria-label*="send"]'
    ];

    let sendButton = null;
    for (const selector of buttonSelectors) {
      try {
        sendButton = await page.locator(selector).first();
        if (await sendButton.isVisible({ timeout: 1000 })) {
          console.log(`Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!sendButton || !(await sendButton.isVisible({ timeout: 1000 }))) {
      console.log('Could not find send button. Trying Enter key...');
      await chatInput.press('Enter');
    } else {
      console.log('Clicking send button...');
      await sendButton.click();
    }

    // Wait for network activity
    await page.waitForTimeout(3000);

    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total requests captured: ${requests.length}`);
    
    if (requests.length > 0) {
      console.log('\nDetailed request information:');
      requests.forEach((req, index) => {
        console.log(`\nRequest ${index + 1}:`);
        console.log('URL:', req.url);
        console.log('Content-Type:', req.headers['content-type']);
        if (req.postData) {
          console.log('Request Body:');
          try {
            const parsed = JSON.parse(req.postData);
            console.log(JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.log(req.postData);
          }
        }
      });
    }

    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for manual inspection. Press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Error screenshot saved as error-screenshot.png');
  }
})();