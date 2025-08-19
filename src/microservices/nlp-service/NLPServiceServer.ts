/**
 * NLP Service Server
 * Runs on port 3008 by default
 */

import express from "express";
import cors from "cors";
import { logger } from "../../utils/logger.js";
import { getSimplifiedQwenProcessor } from "./SimplifiedQwenProcessor.js";

const app = express();
const PORT = process.env.PORT || 3008;

// Middleware
app.use(cors());
app.use(express.json());

// NLP processor instance
const qwenProcessor = getSimplifiedQwenProcessor();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "nlp-service",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Process NLP query
app.post("/process", async (req, res): Promise<void> => {
  try {
    const { text } = req.body;
    
    if (!text) {
      res.status(400).json({
        success: false,
        error: "Text is required"
      });
      return;
    }
    
    logger.info(`Processing NLP query: "${text}"`, "NLP_SERVICE");
    
    const result = await qwenProcessor.processGroceryQuery(text);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`NLP processing error: ${error}`, "NLP_SERVICE");
    res.status(500).json({
      success: false,
      error: "Failed to process query"
    });
  }
});

// Batch processing endpoint
app.post("/batch", async (req, res): Promise<void> => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries)) {
      res.status(400).json({
        success: false,
        error: "Queries must be an array"
      });
      return;
    }
    
    const results = await qwenProcessor.processBatch(queries);
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Batch processing error: ${error}`, "NLP_SERVICE");
    res.status(500).json({
      success: false,
      error: "Failed to process batch"
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`NLP Service running on port ${PORT}`, "NLP_SERVICE");
  console.log(`🧠 NLP Service: http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Process: POST http://localhost:${PORT}/process`);
  console.log(`   Batch: POST http://localhost:${PORT}/batch`);
});