import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  
  console.log('2. Waiting for page to load completely...');
  await page.waitForLoadState('networkidle');
  
  console.log('3. Taking screenshot of initial state...');
  await page.screenshot({ path: 'screenshot-1-initial.png', fullPage: true });
  
  console.log('4. Finding and clicking the chat input textarea...');
  // Try different selectors for the chat input
  const inputSelectors = [
    'textarea[placeholder*="Type"]',
    'textarea[placeholder*="message"]',
    'textarea[placeholder*="chat"]',
    'textarea',
    'input[type="text"]'
  ];
  
  let inputFound = false;
  for (const selector of inputSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        await element.click();
        inputFound = true;
        console.log(`   Found input with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!inputFound) {
    console.log('   Warning: Could not find chat input textarea');
  }
  
  console.log('5. Typing the message...');
  await page.keyboard.type('Research the latest trends in AI agent architectures and create a summary report');
  
  console.log('6. Finding and clicking the send button...');
  // Try different selectors for the send button
  const buttonSelectors = [
    'button[type="submit"]',
    'button:has-text("Send")',
    'button[aria-label*="send"]',
    'button[aria-label*="Send"]',
    'button svg',
    'button'
  ];
  
  let buttonFound = false;
  for (const selector of buttonSelectors) {
    try {
      const element = await page.locator(selector).last();
      if (await element.isVisible()) {
        await element.click();
        buttonFound = true;
        console.log(`   Found button with selector: ${selector}`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!buttonFound) {
    console.log('   Warning: Could not find send button');
  }
  
  console.log('7. Waiting for 4 seconds for mock agent response...');
  await page.waitForTimeout(4000);
  
  console.log('8. Taking screenshot showing the conversation...');
  await page.screenshot({ path: 'screenshot-2-conversation.png', fullPage: true });
  
  console.log('9. Checking for agent response...');
  // Look for agent response indicators
  const responseSelectors = [
    'div:has-text("AI agent")',
    'div:has-text("research")',
    'div:has-text("summary")',
    'div[class*="message"]',
    'div[class*="response"]'
  ];
  
  let responseFound = false;
  for (const selector of responseSelectors) {
    try {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        responseFound = true;
        console.log(`   Found response with selector: ${selector} (${elements.length} elements)`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!responseFound) {
    console.log('   Warning: Could not find agent response');
  }
  
  console.log('10. Looking for agent status indicators...');
  // Look for status indicators
  const statusSelectors = [
    '[class*="status"]',
    '[class*="indicator"]',
    'span:has-text("online")',
    'span:has-text("active")',
    'div[role="status"]'
  ];
  
  let statusFound = false;
  for (const selector of statusSelectors) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        statusFound = true;
        const text = await element.textContent();
        console.log(`   Found status indicator: ${selector} - "${text}"`);
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  if (!statusFound) {
    console.log('   No status indicators found');
  }
  
  console.log('11. Taking final screenshot of complete interaction...');
  await page.screenshot({ path: 'screenshot-3-final.png', fullPage: true });
  
  // Log page content for debugging
  console.log('\nPage title:', await page.title());
  console.log('Page URL:', page.url());
  
  // Get all visible text on page
  const visibleText = await page.evaluate(() => {
    const elements = document.querySelectorAll('*:not(script):not(style)');
    const texts = [];
    elements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 200) {
        texts.push(text);
      }
    });
    return [...new Set(texts)].slice(0, 20); // Get first 20 unique text snippets
  });
  
  console.log('\nVisible text snippets on page:');
  visibleText.forEach((text, i) => {
    console.log(`  ${i + 1}. "${text}"`);
  });
  
  console.log('\nTest completed! Check the screenshots:');
  console.log('  - screenshot-1-initial.png');
  console.log('  - screenshot-2-conversation.png');
  console.log('  - screenshot-3-final.png');
  
  await browser.close();
})();