import { chromium } from 'playwright';

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Closing any existing browser windows and navigating to http://localhost:5173');
    await page.goto('http://localhost:5173');
    
    console.log('2. Waiting 2 seconds for everything to load...');
    await page.waitForTimeout(2000);
    
    console.log('3. Taking screenshot of initial UI...');
    await page.screenshot({ path: 'screenshot-1-initial.png', fullPage: true });
    
    console.log('4. Finding and clicking the chat input...');
    // Try multiple selectors for the chat input
    const inputSelectors = [
      'textarea[placeholder*="Type"]',
      'input[placeholder*="Type"]',
      'textarea',
      'input[type="text"]',
      '[data-testid="chat-input"]',
      '.chat-input',
      '#chat-input'
    ];
    
    let inputFound = false;
    for (const selector of inputSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        inputFound = true;
        console.log(`   Found input with selector: ${selector}`);
        break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!inputFound) {
      console.log('   Could not find chat input, trying to click on general input area...');
      await page.screenshot({ path: 'screenshot-debug-no-input.png', fullPage: true });
    }
    
    console.log('5. Typing the message...');
    await page.keyboard.type("Research the latest trends in AI agent architectures and create a summary report");
    
    console.log('6. Finding and clicking the send button...');
    // Try multiple selectors for send button
    const buttonSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("send")',
      '[data-testid="send-button"]',
      '.send-button',
      'button[aria-label*="send"]',
      'button[aria-label*="Send"]'
    ];
    
    let buttonFound = false;
    for (const selector of buttonSelectors) {
      try {
        await page.click(selector, { timeout: 2000 });
        buttonFound = true;
        console.log(`   Found button with selector: ${selector}`);
        break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!buttonFound) {
      console.log('   Could not find send button, trying Enter key...');
      await page.keyboard.press('Enter');
    }
    
    console.log('7. Waiting 5 seconds for agent response...');
    await page.waitForTimeout(5000);
    
    console.log('8. Taking screenshot of conversation...');
    await page.screenshot({ path: 'screenshot-2-conversation.png', fullPage: true });
    
    console.log('9. Checking what\'s visible on the page...');
    
    // Get all text content
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log('\nPage text content:');
    console.log('='.repeat(50));
    console.log(textContent);
    console.log('='.repeat(50));
    
    // Wait a bit more for full response
    console.log('\n10. Waiting additional time for full response...');
    await page.waitForTimeout(3000);
    
    console.log('11. Taking final screenshot...');
    await page.screenshot({ path: 'screenshot-3-final.png', fullPage: true });
    
    // Get final text content
    const finalTextContent = await page.evaluate(() => document.body.innerText);
    console.log('\nFinal page text content:');
    console.log('='.repeat(50));
    console.log(finalTextContent);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('Error occurred:', error);
    await page.screenshot({ path: 'screenshot-error.png', fullPage: true });
  } finally {
    // Close browser
    await browser.close();
  }
})();