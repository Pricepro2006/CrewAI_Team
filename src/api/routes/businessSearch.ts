import { Router } from "express";
import type { Request, Response, Router as ExpressRouter } from "express";
import {
  webSearchRateLimit,
  businessSearchRateLimit,
  premiumRateLimit,
} from "../../core/middleware/RateLimiter.js";
import { BusinessSearchMiddleware } from "../../core/middleware/BusinessSearchMiddleware.js";
import { OllamaProvider } from "../../core/llm/OllamaProvider.js";
import { logger } from "../../utils/logger.js";

const router: ExpressRouter = Router();

// Initialize middleware
const businessSearchMiddleware = new BusinessSearchMiddleware({
  enabled: true,
  enhancementLevel: "standard",
  validateResponses: true,
  collectMetrics: true,
});

// Initialize Ollama provider
const ollamaProvider = new OllamaProvider({
  model: "llama2",
  temperature: 0.7,
});

// Wrap provider with middleware
const wrappedProvider = businessSearchMiddleware.wrapProvider(ollamaProvider);

/**
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  const metrics = businessSearchMiddleware.getMetrics();

  res.json({
    status: "healthy",
    metrics: {
      totalRequests: metrics.totalRequests,
      rateLimitedRequests: metrics.rateLimitedRequests,
      circuitBreakerStatus: metrics.circuitBreakerStatus,
      averageLatency: metrics.averageLatency,
    },
  });
});

/**
 * Business search endpoint with rate limiting
 * Applies strict rate limiting for business searches
 */
router.post(
  "/search/business",
  businessSearchRateLimit, // Apply business search rate limit
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { query, location } = req.body;

      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query",
        });
      }

      // Construct the search prompt
      const prompt = location
        ? `Find ${query} in ${location}`
        : `Find ${query} near me`;

      // Generate response using wrapped provider
      const response = await wrappedProvider.generate(prompt);

      // Get current metrics
      const metrics = businessSearchMiddleware.getMetrics();

      res.json({
        success: true,
        response,
        metadata: {
          rateLimitRemaining: res.getHeader("X-RateLimit-Remaining"),
          rateLimitReset: res.getHeader("X-RateLimit-Reset"),
          enhanced: metrics.enhancedRequests > 0,
          validated: metrics.validatedResponses > 0,
        },
      });
    } catch (error) {
      logger.error(
        "Business search error:",
        error instanceof Error ? error.message : String(error),
      );
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to process business search",
      });
    }
  },
);

/**
 * General WebSearch endpoint with standard rate limiting
 */
router.post(
  "/search/web",
  webSearchRateLimit, // Apply web search rate limit
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query",
        });
      }

      // Generate response using wrapped provider
      const response = await wrappedProvider.generate(query);

      res.json({
        success: true,
        response,
        metadata: {
          rateLimitRemaining: res.getHeader("X-RateLimit-Remaining"),
          rateLimitReset: res.getHeader("X-RateLimit-Reset"),
        },
      });
    } catch (error) {
      logger.error(
        "Web search error:",
        error instanceof Error ? error.message : String(error),
      );
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to process web search",
      });
    }
  },
);

/**
 * Premium search endpoint with higher rate limits
 */
router.post(
  "/search/premium",
  premiumRateLimit, // Apply premium rate limit
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { query, options } = req.body;

      // Verify premium status (req.user would be set by auth middleware)
      const user = (req as any).user;
      if (!user?.premium) {
        return res.status(403).json({
          error: "Premium access required",
        });
      }

      if (!query) {
        return res.status(400).json({
          error: "Missing required field: query",
        });
      }

      // Generate response with premium options
      const response = await wrappedProvider.generate(query, {
        maxTokens: options?.maxTokens || 2000,
        temperature: options?.temperature || 0.7,
      });

      res.json({
        success: true,
        response,
        metadata: {
          rateLimitRemaining: res.getHeader("X-RateLimit-Remaining"),
          rateLimitReset: res.getHeader("X-RateLimit-Reset"),
          premium: true,
        },
      });
    } catch (error) {
      logger.error(
        "Premium search error:",
        error instanceof Error ? error.message : String(error),
      );
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to process premium search",
      });
    }
  },
);

/**
 * Metrics endpoint to monitor rate limiting
 */
router.get("/metrics", async (req: Request, res: Response) => {
  const metrics = businessSearchMiddleware.getMetrics();

  res.json({
    middleware: metrics,
    rateLimiting: {
      totalRateLimited: metrics.rateLimitedRequests,
      percentageRateLimited:
        metrics.totalRequests > 0
          ? (
              (metrics.rateLimitedRequests / metrics.totalRequests) *
              100
            ).toFixed(2) + "%"
          : "0%",
    },
  });
});

/**
 * Reset metrics endpoint (admin only)
 */
router.post("/metrics/reset", async (req: Request, res: Response) => {
  // TODO: Add admin authentication check

  businessSearchMiddleware.resetMetrics();

  res.json({
    success: true,
    message: "Metrics reset successfully",
  });
});

// Event listeners for monitoring
businessSearchMiddleware.on("rate_limited", (event) => {
  logger.warn("Rate limit triggered", event);
});

businessSearchMiddleware.on("high_latency", (event) => {
  logger.warn("High latency detected", event);
});

businessSearchMiddleware.on("validation_failed", (event) => {
  logger.warn(
    "Response validation failed",
    JSON.stringify({
      prompt:
        typeof event.prompt === "string"
          ? event.prompt.slice(0, 100)
          : String(event.prompt),
      confidence: event.validation?.confidence || "unknown",
    }),
  );
});

export default router;
