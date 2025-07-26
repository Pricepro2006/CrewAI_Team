import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { promises: fsPromises } = fs;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testUserExperience() {
  console.log('🚀 Starting comprehensive user experience test...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false, // Set to true for headless mode
    slowMo: 1000 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Create screenshots directory
  const screenshotDir = path.join(__dirname, 'test-screenshots');
  await fsPromises.mkdir(screenshotDir, { recursive: true });
  
  let stepCount = 0;
  const takeScreenshot = async (description) => {
    stepCount++;
    const filename = `${stepCount.toString().padStart(2, '0')}-${description.replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  };
  
  try {
    // Step 1: Navigate to the application
    console.log('🌐 Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    await takeScreenshot('initial-state');
    
    // Step 2: Check initial page elements
    console.log('🔍 Checking initial page elements...');
    
    // Wait for key elements to be present
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Look for common chat interface elements
    const chatInput = await page.$('input[type="text"], textarea, [contenteditable="true"]');
    const sendButton = await page.$('button[type="submit"], button:has-text("Send"), button:has-text("Submit")');
    
    if (!chatInput) {
      console.log('⚠️  Chat input not found, searching for alternative input methods...');
      // Look for any input elements
      const allInputs = await page.$$('input, textarea, [contenteditable="true"]');
      console.log(`Found ${allInputs.length} input elements`);
      
      for (let i = 0; i < allInputs.length; i++) {
        const input = allInputs[i];
        const tagName = await input.evaluate(el => el.tagName);
        const type = await input.evaluate(el => el.type || 'none');
        const placeholder = await input.evaluate(el => el.placeholder || 'none');
        console.log(`Input ${i}: ${tagName} type=${type} placeholder=${placeholder}`);
      }
    }
    
    // Step 3: Type the test message
    console.log('⌨️  Typing test message...');
    const testMessage = "Please research the latest trends in AI agent architectures and create a detailed summary report with tool usage";
    
    if (chatInput) {
      await chatInput.fill(testMessage);
      await takeScreenshot('message-typed');
    } else {
      console.log('❌ No suitable input found, trying alternative approaches...');
      // Try to find any focusable input
      const focusableInputs = await page.$$('input:not([type="hidden"]), textarea, [contenteditable="true"]');
      if (focusableInputs.length > 0) {
        console.log(`Found ${focusableInputs.length} focusable inputs, using the first one`);
        await focusableInputs[0].fill(testMessage);
        await takeScreenshot('message-typed-alternative');
      } else {
        console.log('❌ No input elements found at all');
        await takeScreenshot('no-inputs-found');
      }
    }
    
    // Step 4: Click send button
    console.log('🔘 Clicking send button...');
    if (sendButton) {
      await sendButton.click();
      await takeScreenshot('message-sent');
    } else {
      console.log('⚠️  Send button not found, trying alternative approaches...');
      // Try pressing Enter
      if (chatInput) {
        await chatInput.press('Enter');
        await takeScreenshot('message-sent-enter');
      } else {
        // Look for any button that might submit
        const buttons = await page.$$('button');
        console.log(`Found ${buttons.length} buttons`);
        
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          const text = await button.textContent();
          console.log(`Button ${i}: "${text}"`);
        }
        
        if (buttons.length > 0) {
          console.log('Clicking the first button as fallback...');
          await buttons[0].click();
          await takeScreenshot('button-clicked-fallback');
        }
      }
    }
    
    // Step 5: Wait and observe changes
    console.log('⏰ Waiting 3 seconds for processing...');
    await page.waitForTimeout(3000);
    await takeScreenshot('after-3-seconds');
    
    // Step 6: Check for response elements
    console.log('🔍 Checking for response elements...');
    
    // Look for common response indicators
    const responseElements = await page.$$('[data-testid*="message"], [class*="message"], [class*="response"], [class*="agent"], [class*="chat"]');
    console.log(`Found ${responseElements.length} potential response elements`);
    
    // Look for loading indicators
    const loadingElements = await page.$$('[class*="loading"], [class*="spinner"], [class*="processing"]');
    console.log(`Found ${loadingElements.length} loading indicator elements`);
    
    // Look for error messages
    const errorElements = await page.$$('[class*="error"], [class*="warning"], [role="alert"]');
    console.log(`Found ${errorElements.length} error/warning elements`);
    
    // Step 7: Get page content analysis
    console.log('📝 Analyzing page content...');
    
    const pageTitle = await page.title();
    console.log(`Page title: "${pageTitle}"`);
    
    const pageText = await page.textContent('body');
    const hasUserMessage = pageText.includes(testMessage) || pageText.includes("research") || pageText.includes("AI agent");
    console.log(`User message found in page: ${hasUserMessage}`);
    
    const hasProcessingIndicator = pageText.includes("processing") || pageText.includes("working") || pageText.includes("loading");
    console.log(`Processing indicator found: ${hasProcessingIndicator}`);
    
    const hasAgentResponse = pageText.includes("agent") || pageText.includes("research") || pageText.includes("summary");
    console.log(`Agent response indicators found: ${hasAgentResponse}`);
    
    const hasErrorMessage = pageText.includes("error") || pageText.includes("failed") || pageText.includes("Error");
    console.log(`Error messages found: ${hasErrorMessage}`);
    
    // Step 8: Wait for potential delayed responses
    console.log('⏳ Waiting for potential delayed responses...');
    await page.waitForTimeout(5000);
    await takeScreenshot('after-8-seconds');
    
    // Step 9: Check for any new content
    console.log('🔄 Checking for new content...');
    const finalPageText = await page.textContent('body');
    const contentChanged = finalPageText !== pageText;
    console.log(`Content changed during wait: ${contentChanged}`);
    
    if (contentChanged) {
      console.log('✅ New content detected!');
      const newContent = finalPageText.length - pageText.length;
      console.log(`Content length difference: ${newContent} characters`);
    }
    
    // Step 10: Final screenshot and analysis
    await takeScreenshot('final-state');
    
    // Final analysis
    console.log('\n📊 FINAL USER EXPERIENCE ANALYSIS:');
    console.log('=====================================');
    console.log(`✅ Application loaded: ${pageTitle !== ''}`);
    console.log(`✅ Input field found: ${chatInput !== null}`);
    console.log(`✅ Send button found: ${sendButton !== null}`);
    console.log(`✅ Message typed: ${hasUserMessage}`);
    console.log(`✅ Processing indicators: ${hasProcessingIndicator}`);
    console.log(`✅ Agent response detected: ${hasAgentResponse}`);
    console.log(`❌ Error messages: ${hasErrorMessage}`);
    console.log(`✅ Content updated: ${contentChanged}`);
    console.log(`📱 Response elements found: ${responseElements.length}`);
    console.log(`⏳ Loading indicators: ${loadingElements.length}`);
    console.log(`⚠️  Error elements: ${errorElements.length}`);
    
    // Get final DOM structure for debugging
    console.log('\n🔍 DOM STRUCTURE ANALYSIS:');
    const bodyHTML = await page.innerHTML('body');
    console.log(`Body HTML length: ${bodyHTML.length} characters`);
    
    // Look for specific frameworks or libraries
    const hasReact = bodyHTML.includes('react') || bodyHTML.includes('React');
    const hasVite = bodyHTML.includes('vite') || bodyHTML.includes('Vite');
    const hasTailwind = bodyHTML.includes('tailwind') || bodyHTML.includes('tw-');
    
    console.log(`React detected: ${hasReact}`);
    console.log(`Vite detected: ${hasVite}`);
    console.log(`Tailwind detected: ${hasTailwind}`);
    
    console.log('\n📁 Screenshots saved to:', screenshotDir);
    console.log('🎯 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    await takeScreenshot('error-state');
  } finally {
    await browser.close();
  }
}

// Run the test
testUserExperience().catch(console.error);