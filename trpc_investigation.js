import { chromium } from 'playwright';

async function investigateTrpcClient() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  console.log('Page loaded, checking for tRPC client...');
  
  // Check if window.trpc exists
  const trpcExists = await page.evaluate(() => {
    return typeof window.trpc !== 'undefined';
  });
  
  console.log(`window.trpc exists: ${trpcExists}`);
  
  if (trpcExists) {
    // Get tRPC client details
    const trpcDetails = await page.evaluate(() => {
      const trpc = window.trpc;
      return {
        type: typeof trpc,
        keys: Object.keys(trpc),
        hasConversation: typeof trpc.conversation !== 'undefined',
        hasCreateConversation: typeof trpc.createConversation !== 'undefined'
      };
    });
    
    console.log('tRPC client details:', trpcDetails);
  }
  
  // Check for createConversation function
  const createConversationExists = await page.evaluate(() => {
    return typeof window.createConversation !== 'undefined';
  });
  
  console.log(`window.createConversation exists: ${createConversationExists}`);
  
  // Check for any React DevTools or other global variables
  const globalVars = await page.evaluate(() => {
    const vars = [];
    for (let prop in window) {
      if (prop.includes('trpc') || prop.includes('conversation') || prop.includes('react')) {
        vars.push(prop);
      }
    }
    return vars;
  });
  
  console.log('Relevant global variables:', globalVars);
  
  // Open DevTools Console
  await page.evaluate(() => {
    console.log('=== tRPC Investigation ===');
    console.log('window.trpc:', window.trpc);
    console.log('window.createConversation:', window.createConversation);
    
    // Try to find the tRPC client in common locations
    const possibleLocations = [
      'window.__TRPC_CLIENT__',
      'window.trpcClient',
      'window.client',
      'window.api'
    ];
    
    possibleLocations.forEach(location => {
      try {
        const value = eval(location);
        if (value) {
          console.log(`Found at ${location}:`, value);
        }
      } catch (e) {
        // Ignore errors
      }
    });
  });
  
  // Try to trigger a conversation request and observe the network
  console.log('Trying to trigger a conversation request...');
  
  // Listen for network requests
  page.on('request', request => {
    if (request.url().includes('conversation') || request.url().includes('trpc')) {
      console.log('Network request:', request.url(), request.method());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('conversation') || response.url().includes('trpc')) {
      console.log('Network response:', response.url(), response.status());
    }
  });
  
  // Try to find and click a button that might trigger a conversation
  try {
    await page.click('button:has-text("Send")');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('No Send button found, trying other buttons...');
    
    // Try to find any button
    const buttons = await page.locator('button').all();
    if (buttons.length > 0) {
      console.log(`Found ${buttons.length} buttons`);
      // Click the first button
      await buttons[0].click();
      await page.waitForTimeout(2000);
    }
  }
  
  // Check the Network tab in DevTools
  await page.keyboard.press('F12');
  await page.waitForTimeout(1000);
  
  // Keep the browser open for manual inspection
  console.log('Browser opened. Check the DevTools Console and Network tabs manually.');
  console.log('Press Ctrl+C to close when done investigating.');
  
  // Keep the process running
  await new Promise(() => {});
}

investigateTrpcClient().catch(console.error);