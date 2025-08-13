/**
 * Cache Warmer Service Server
 * Runs on port 3006 by default
 */

import express from "express";
import cors from "cors";
import { logger } from "../../utils/logger.js";
import { CacheWarmer } from "./CacheWarmer.js";

const app = express();
const PORT = process.env.PORT || 3006;

// Middleware
app.use(cors());
app.use(express.json());

// Cache warmer instance
const cacheWarmer = new CacheWarmer();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "cache-warmer",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Warm cache for specific category
app.post("/warm", async (req, res) => {
  try {
    const { category, force = false } = req.body;
    
    logger.info(`Warming cache for category: ${category || "all"}`, "CACHE_WARMER");
    
    const result = await cacheWarmer.warmCache({
      category,
      force
    });
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Cache warming error: ${error}`, "CACHE_WARMER");
    res.status(500).json({
      success: false,
      error: "Failed to warm cache"
    });
  }
});

// Get cache status
app.get("/status", async (req, res) => {
  try {
    const status = await cacheWarmer.getCacheStatus();
    
    res.json({
      success: true,
      ...status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Status fetch error: ${error}`, "CACHE_WARMER");
    res.status(500).json({
      success: false,
      error: "Failed to get cache status"
    });
  }
});

// Clear cache
app.post("/clear", async (req, res) => {
  try {
    const { category } = req.body;
    
    logger.info(`Clearing cache for category: ${category || "all"}`, "CACHE_WARMER");
    
    const result = await cacheWarmer.clearCache(category);
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Cache clear error: ${error}`, "CACHE_WARMER");
    res.status(500).json({
      success: false,
      error: "Failed to clear cache"
    });
  }
});

// Schedule cache warming
app.post("/schedule", async (req, res) => {
  try {
    const { interval = 3600000 } = req.body; // Default 1 hour
    
    cacheWarmer.startScheduledWarming(interval);
    
    res.json({
      success: true,
      message: `Cache warming scheduled every ${interval}ms`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error(`Schedule error: ${error}`, "CACHE_WARMER");
    res.status(500).json({
      success: false,
      error: "Failed to schedule cache warming"
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`Cache Warmer Service running on port ${PORT}`, "CACHE_WARMER");
  console.log(`🔥 Cache Warmer Service: http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Warm: POST http://localhost:${PORT}/warm`);
  console.log(`   Status: GET http://localhost:${PORT}/status`);
  console.log(`   Clear: POST http://localhost:${PORT}/clear`);
  console.log(`   Schedule: POST http://localhost:${PORT}/schedule`);
  
  // Start scheduled warming on startup
  cacheWarmer.startScheduledWarming(3600000); // Every hour
});