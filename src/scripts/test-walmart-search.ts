#!/usr/bin/env node
/**
 * Test Walmart Database Search Functionality
 * Verifies the dedicated walmart_grocery.db is working correctly
 */

import { getWalmartDatabaseManager } from "../database/WalmartDatabaseManager.js";
import { logger } from "../../utils/logger.js";

async function testSearch() {
  logger.info("Testing Walmart database search functionality...", "TEST_SEARCH");
  
  const db = getWalmartDatabaseManager();
  await db.initialize();
  
  // Test searching for milk
  const results = await db?.walmartProducts?.searchProducts("milk", 10);
  
  logger.info(`Found ${results?.length || 0} products matching 'milk'`, "TEST_SEARCH");
  results.forEach((product, i) => {
    console.log(`${i + 1}. ${product.name}`);
    console.log(`   Brand: ${product.brand}`);
    console.log(`   Price: $${product.current_price}`);
    console.log(`   In Stock: ${product.in_stock ? "Yes" : "No"}`);
    console.log("");
  });
  
  // Test getting a specific product
  try {
    const specificProduct = await db?.walmartProducts?.getProduct("WM_MILK_001");
    console.log("Specific product details:");
    console.log(`Name: ${specificProduct.name}`);
    console.log(`Description: ${specificProduct.description}`);
    console.log(`Category: ${specificProduct.category_path}`);
    
    logger.info("✅ Search functionality test complete!", "TEST_SEARCH");
  } catch (error) {
    logger.error(`Failed to get specific product: ${error}`, "TEST_SEARCH");
  }
}

testSearch().catch(console.error);