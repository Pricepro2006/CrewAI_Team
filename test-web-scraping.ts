#!/usr/bin/env tsx
// Test script for web scraping functionality

import axios from 'axios';

const API_URL = 'http://localhost:3001/trpc';

async function testWebScraping() {
  console.log('🧪 Testing Web Scraping Functionality...\n');
  
  const testQueries = [
    "scrape https://github.com/Shubhamsaboo/awesome-llm-apps",
    "extract content from https://github.com/Shubhamsaboo/awesome-llm-apps",
    "get all relevant local LLM info, code and associated agents from https://github.com/Shubhamsaboo/awesome-llm-apps"
  ];

  for (const query of testQueries) {
    console.log(`\n📝 Testing query: "${query}"`);
    console.log('─'.repeat(60));
    
    try {
      // Send chat message
      const response = await axios.post(
        `${API_URL}/chat.sendMessage`,
        {
          json: {
            message: query,
            conversationId: 'test-scraping-' + Date.now()
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'csrf-token=test'
          }
        }
      );

      if (response.data?.result?.data?.success) {
        console.log('✅ Message sent successfully');
        console.log('📊 Response:', JSON.stringify(response.data.result.data, null, 2));
        
        // Check if ToolExecutorAgent was selected
        const responseText = JSON.stringify(response.data.result.data);
        if (responseText.includes('ToolExecutorAgent')) {
          console.log('✅ ToolExecutorAgent was selected!');
        } else if (responseText.includes('web_scraper')) {
          console.log('✅ Web scraper tool was invoked!');
        } else {
          console.log('⚠️ ToolExecutorAgent may not have been selected');
        }
      } else {
        console.log('❌ Failed to send message');
        console.log('Response:', response.data);
      }
    } catch (error: any) {
      console.log('❌ Error:', error.message);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
    }
  }
  
  console.log('\n✨ Web Scraping Test Complete!\n');
}

// Run the test
testWebScraping().catch(console.error);