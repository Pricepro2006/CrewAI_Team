import { chromium } from 'playwright';

async function testTrpcDetailed() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Testing tRPC client - Detailed version...');
  
  // Capture all console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Browser Error] ${msg.text()}`);
    } else if (msg.type() === 'log') {
      console.log(`[Browser Log] ${msg.text()}`);
    }
  });
  
  // Navigate to the app
  await page.goto('http://localhost:5173');
  
  // Wait for the page to load
  await page.waitForTimeout(3000);
  
  // Monitor all network requests and responses
  const requests = [];
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData()
    });
  });
  
  const responses = [];
  page.on('response', async response => {
    const responseData = {
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    };
    
    try {
      if (response.url().includes('trpc')) {
        responseData.body = await response.text();
      }
    } catch (e) {
      responseData.bodyError = e.message;
    }
    
    responses.push(responseData);
  });
  
  // Type message and send
  await page.fill('textarea', 'Hello, test message for detailed analysis');
  await page.click('button.send-button');
  
  // Wait for the response
  await page.waitForTimeout(5000);
  
  // Check the messages in the UI
  const messages = await page.evaluate(() => {
    const messageElements = document.querySelectorAll('[class*="message"], .message, [role="message"]');
    return Array.from(messageElements).map(el => ({
      text: el.textContent,
      classes: el.className
    }));
  });
  
  console.log('Messages in UI:', messages);
  
  // Check the state of the chat interface
  const chatState = await page.evaluate(() => {
    const chatInterface = document.querySelector('[class*="chat-interface"]');
    const messageList = document.querySelector('[class*="message-list"]');
    const inputBox = document.querySelector('[class*="input-box"]');
    
    return {
      chatInterfaceExists: !!chatInterface,
      messageListExists: !!messageList,
      inputBoxExists: !!inputBox,
      messageListContent: messageList ? messageList.textContent : 'N/A',
      chatInterfaceContent: chatInterface ? chatInterface.textContent.substring(0, 200) : 'N/A'
    };
  });
  
  console.log('Chat state:', chatState);
  
  // Filter and show tRPC requests
  const trpcRequests = requests.filter(r => r.url.includes('trpc'));
  const trpcResponses = responses.filter(r => r.url.includes('trpc'));
  
  console.log('tRPC Requests:', trpcRequests.length);
  trpcRequests.forEach(req => {
    console.log(`  ${req.method} ${req.url}`);
    if (req.postData) {
      console.log(`    Body: ${req.postData}`);
    }
  });
  
  console.log('tRPC Responses:', trpcResponses.length);
  trpcResponses.forEach(resp => {
    console.log(`  ${resp.status} ${resp.url}`);
    if (resp.body) {
      const parsedBody = JSON.parse(resp.body);
      console.log(`    Response: ${JSON.stringify(parsedBody, null, 2)}`);
    }
  });
  
  // Wait and close
  await page.waitForTimeout(10000);
  await browser.close();
}

testTrpcDetailed().catch(console.error);