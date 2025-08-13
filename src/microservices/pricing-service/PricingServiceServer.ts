/**
 * Pricing Service Server
 * Runs on port 3007 by default
 */

import express from "express";
import cors from "cors";
import { logger } from "../../utils/logger.js";
import { PricingEngine } from "./PricingEngine.js";

const app = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(cors());
app.use(express.json());

// Pricing engine instance
const pricingEngine = new PricingEngine();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "pricing-service",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Calculate price for a product
app.post("/calculate", async (req, res) => {
  try {
    const { productId, quantity = 1, customerId } = req.body;
    
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: "Product ID is required"
      });
    }
    
    logger.info(`Calculating price for product ${productId}, qty: ${quantity}`, "PRICING_SERVICE");
    
    const result = await pricingEngine.calculatePrice({
      productId,
      quantity,
      customerId
    });
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Pricing calculation error: ${error}`, "PRICING_SERVICE");
    res.status(500).json({
      success: false,
      error: "Failed to calculate price"
    });
  }
});

// Get bulk pricing
app.post("/bulk", async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: "Items must be an array"
      });
    }
    
    const results = await pricingEngine.calculateBulkPricing(items);
    
    res.json({
      success: true,
      items: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Bulk pricing error: ${error}`, "PRICING_SERVICE");
    res.status(500).json({
      success: false,
      error: "Failed to calculate bulk pricing"
    });
  }
});

// Get promotional prices
app.get("/promotions", async (req, res) => {
  try {
    const promotions = await pricingEngine.getActivePromotions();
    
    res.json({
      success: true,
      promotions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Promotions fetch error: ${error}`, "PRICING_SERVICE");
    res.status(500).json({
      success: false,
      error: "Failed to fetch promotions"
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Pricing Service running on port ${PORT}`, "PRICING_SERVICE");
  console.log(`💰 Pricing Service: http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Calculate: POST http://localhost:${PORT}/calculate`);
  console.log(`   Bulk: POST http://localhost:${PORT}/bulk`);
  console.log(`   Promotions: GET http://localhost:${PORT}/promotions`);
});