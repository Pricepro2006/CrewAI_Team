/**
 * NLP Router - API endpoints for natural language processing
 * Integrates with Qwen3:0.6b model for grocery intent detection
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../../utils/logger.js";
import { getSimplifiedQwenProcessor } from "../../microservices/nlp-service/SimplifiedQwenProcessor.js";
import { getWalmartDatabaseManager } from "../../database/WalmartDatabaseManager.js";
import { walmartWSServer } from "../websocket/WalmartWebSocketServer.js";

const router = Router();
const qwenProcessor = getSimplifiedQwenProcessor();

/**
 * Process natural language input
 * POST /api/nlp/process
 */
router.post("/process", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, userId, sessionId } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        error: "Text input is required"
      });
      return;
    }

    logger.info(`Processing NLP request: "${text}"`, "NLP_ROUTER");

    // Notify WebSocket clients that processing started
    if (sessionId) {
      walmartWSServer.notifyNLPProcessingStart(sessionId, text);
    }

    // Process with Qwen3:0.6b
    const result = await qwenProcessor.processGroceryQuery(text);

    // Store intent in database for learning
    try {
      const db = getWalmartDatabaseManager();
      db.getDatabase().prepare(`
        INSERT INTO nlp_intents (
          user_query, detected_intent, confidence_score, 
          entities, model_used, user_id, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        text,
        result.intent,
        result.confidence,
        JSON.stringify({ items: result.items, quantities: result.quantities }),
        "qwen3:0.6b",
        userId || null,
        sessionId || null
      );
    } catch (dbError) {
      logger.warn(`Failed to store NLP intent: ${dbError}`, "NLP_ROUTER");
      // Continue even if database storage fails
    }

    // If intent is to add items, search for products
    let products = [];
    if (result.intent === "add_items" && result?.items?.length > 0) {
      try {
        const db = getWalmartDatabaseManager();
        for (const item of result?.items?.slice(0, 5)) { // Limit to 5 items
          const searchResults = await db?.walmartProducts?.searchProducts(item, 3);
          products.push(...searchResults);
        }
        
        // Notify WebSocket about product matches
        if (sessionId && products?.length || 0 > 0) {
          walmartWSServer.notifyProductMatches(sessionId, products);
        }
      } catch (searchError) {
        logger.warn(`Failed to search products: ${searchError}`, "NLP_ROUTER");
        // Continue even if product search fails
      }
    }

    const response = {
      success: true,
      intent: result.intent,
      confidence: result.confidence,
      items: result.items,
      quantities: result.quantities,
      action: result.action,
      products: products?.map(p => ({
        id: p.product_id,
        name: p.name,
        brand: p.brand,
        price: p.current_price,
        inStock: p.in_stock
      })),
      timestamp: new Date().toISOString()
    };

    // Notify WebSocket about NLP result
    if (sessionId) {
      walmartWSServer.notifyNLPResult(sessionId, response);
    }

    res.json(response);

  } catch (error) {
    logger.error(`NLP processing failed: ${error}`, "NLP_ROUTER");
    res.status(500).json({
      success: false,
      error: "Failed to process natural language input"
    });
  }
});

/**
 * Get NLP processing history
 * GET /api/nlp/history
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const { userId, limit = 10 } = req.query;
    
    const db = getWalmartDatabaseManager();
    const query = userId 
      ? "SELECT * FROM nlp_intents WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
      : "SELECT * FROM nlp_intents ORDER BY created_at DESC LIMIT ?";
    
    const params = userId ? [userId, limit] : [limit];
    const history = db.getDatabase().prepare(query).all(...params);

    res.json({
      success: true,
      history: history?.map((h: any) => ({
        query: h.user_query,
        intent: h.detected_intent,
        confidence: h.confidence_score,
        entities: JSON.parse(h.entities || "{}"),
        timestamp: h.created_at
      }))
    });

  } catch (error) {
    logger.error(`Failed to fetch NLP history: ${error}`, "NLP_ROUTER");
    res.status(500).json({
      success: false,
      error: "Failed to fetch history"
    });
  }
});

/**
 * Train model with feedback
 * POST /api/nlp/feedback
 */
router.post("/feedback", async (req: Request, res: Response): Promise<void> => {
  try {
    const { intentId, correctIntent, rating } = req.body;

    if (!intentId || !rating) {
      res.status(400).json({
        success: false,
        error: "Intent ID and rating are required"
      });
      return;
    }

    const db = getWalmartDatabaseManager();
    db.getDatabase().prepare(`
      UPDATE nlp_intents 
      SET feedback_rating = ?, response = ?
      WHERE id = ?
    `).run(rating, correctIntent || null, intentId);

    logger.info(`NLP feedback recorded: ${rating}/5 for intent ${intentId}`, "NLP_ROUTER");

    res.json({
      success: true,
      message: "Feedback recorded successfully"
    });

  } catch (error) {
    logger.error(`Failed to record feedback: ${error}`, "NLP_ROUTER");
    res.status(500).json({
      success: false,
      error: "Failed to record feedback"
    });
  }
});

/**
 * Health check endpoint
 * GET /api/nlp/health
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    // Check if Ollama is accessible
    const axios = (await import("axios")).default;
    const ollamaHealth = await axios.get("http://localhost:8081/api/tags")
      .then(() => true)
      .catch(() => false);

    res.json({
      success: true,
      status: "healthy",
      model: "qwen3:0.6b",
      ollamaConnected: ollamaHealth,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;