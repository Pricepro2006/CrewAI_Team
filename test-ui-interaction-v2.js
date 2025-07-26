import { chromium } from 'playwright';

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to http://localhost:5173');
    await page.goto('http://localhost:5173');
    
    console.log('2. Waiting for page to load...');
    await page.waitForTimeout(2000);
    
    console.log('3. Taking initial screenshot...');
    await page.screenshot({ path: 'test-v2-1-initial.png', fullPage: true });
    
    console.log('4. Finding and typing in chat input...');
    await page.fill('textarea[placeholder*="Type"]', 'Research the latest trends in AI agent architectures and create a summary report');
    
    console.log('5. Clicking send button...');
    await page.click('.send-button');
    
    console.log('6. Waiting for initial response...');
    await page.waitForTimeout(1000);
    
    // Take screenshot after message sent
    await page.screenshot({ path: 'test-v2-2-sent.png', fullPage: true });
    
    console.log('7. Waiting for assistant to process (giving it more time)...');
    // The mock server has a 2 second delay for the full response
    await page.waitForTimeout(5000);
    
    console.log('8. Looking for assistant response...');
    
    // Try to find assistant message
    const assistantMessages = await page.$$eval('[class*="assistant"], [data-role="assistant"], .message-assistant', 
      elements => elements.map(el => el.textContent)
    );
    console.log('Found assistant messages:', assistantMessages);
    
    // Also check for any content updates
    const allText = await page.evaluate(() => document.body.innerText);
    
    console.log('9. Taking final screenshot...');
    await page.screenshot({ path: 'test-v2-3-final.png', fullPage: true });
    
    // Look for the research content
    if (allText.includes('Research Summary') || allText.includes('Multi-Agent Orchestration')) {
      console.log('\nSUCCESS: Found full research summary in the response!');
      console.log('The AI agent successfully researched and provided a detailed summary.');
    } else if (allText.includes('No content')) {
      console.log('\nISSUE: Assistant response shows "No content"');
      console.log('The response was received but content may not be loading properly.');
      
      // Try to trigger a refresh or check for updates
      console.log('\n10. Attempting to refresh conversation...');
      // Some apps might need a refresh action
      await page.keyboard.press('F5');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-v2-4-refreshed.png', fullPage: true });
      
      const refreshedText = await page.evaluate(() => document.body.innerText);
      if (refreshedText.includes('Research Summary')) {
        console.log('SUCCESS after refresh: Found the research content!');
      }
    }
    
    console.log('\nFull page content:');
    console.log('='.repeat(60));
    console.log(allText);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('Error occurred:', error);
    await page.screenshot({ path: 'test-v2-error.png', fullPage: true });
  } finally {
    console.log('\nTest completed. Browser closing...');
    await browser.close();
  }
})();