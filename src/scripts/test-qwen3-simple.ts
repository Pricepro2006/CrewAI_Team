#!/usr/bin/env node
/**
 * Simple Qwen3:0.6b Test for Grocery Operations
 * Quick validation of model functionality
 */

import axios from "axios";

async function testSimpleQuery() {
  console.log("Testing Qwen3:0.6b with simple grocery query...\n");
  
  const queries = [
    "Extract items: I need milk and bread",
    "What products: Buy 2 apples and 3 oranges",
    "Shopping: eggs butter cheese"
  ];
  
  for (const query of queries) {
    console.log(`Query: "${query}"`);
    
    try {
      const response = await axios.post("http://localhost:11434/api/generate", {
        model: "qwen3:0.6b",
        prompt: `List grocery items from: "${query}"\nItems:`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 50
        }
      });
      
      console.log(`Response: ${response?.data?.response}\n`);
    } catch (error: any) {
      console.error(`Error: ${error.message}\n`);
    }
  }
  
  console.log("Test complete!");
}

testSimpleQuery().catch(console.error);