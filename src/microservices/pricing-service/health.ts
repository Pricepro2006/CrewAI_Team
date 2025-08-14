/**
 * Health check endpoint for Pricing Service
 */

import type { Request, Response } from "express";
import { logger } from "../../utils/logger.js";

export interface PricingServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    cache: boolean;
    externalAPI: boolean;
  };
  metrics: {
    requestsProcessed: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
}

// Service start time
const serviceStartTime = Date.now();

// Metrics tracking
let metrics = {
  requestsProcessed: 0,
  totalResponseTime: 0,
  cacheHits: 0,
  cacheMisses: 0,
};

export function incrementMetrics(responseTime: number, cacheHit: boolean) {
  metrics.requestsProcessed++;
  metrics.totalResponseTime += responseTime;
  if (cacheHit) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }
}

export async function healthCheckHandler(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Check database connectivity
    const dbHealthy = await checkDatabase();
    
    // Check cache connectivity
    const cacheHealthy = await checkCache();
    
    // Check external API connectivity
    const apiHealthy = await checkExternalAPI();
    
    // Determine overall status
    let status: "healthy" | "degraded" | "unhealthy";
    if (dbHealthy && cacheHealthy && apiHealthy) {
      status = "healthy";
    } else if (dbHealthy) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }
    
    // Calculate metrics
    const totalRequests = metrics.cacheHits + metrics.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? metrics.cacheHits / totalRequests : 0;
    const avgResponseTime = metrics.requestsProcessed > 0 
      ? metrics.totalResponseTime / metrics.requestsProcessed 
      : 0;
    
    const health: PricingServiceHealth = {
      status,
      timestamp: new Date().toISOString(),
      uptime: (Date.now() - serviceStartTime) / 1000,
      checks: {
        database: dbHealthy,
        cache: cacheHealthy,
        externalAPI: apiHealthy,
      },
      metrics: {
        requestsProcessed: metrics.requestsProcessed,
        averageResponseTime: avgResponseTime,
        cacheHitRate: cacheHitRate,
      },
    };
    
    const statusCode = status === "healthy" ? 200 : status === "degraded" ? 206 : 503;
    
    res.status(statusCode).json(health);
    
    logger.info(`Health check completed: ${status}`, "PRICING_HEALTH", {
      responseTime: Date.now() - startTime,
    });
  } catch (error) {
    logger.error(`Health check failed: ${error}`, "PRICING_HEALTH");
    
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    // Check if we can query the database
    const Database = (await import("better-sqlite3")).default;
    const db = new Database("./data/walmart_grocery.db", { readonly: true });
    const result = db.prepare("SELECT 1").get();
    db.close();
    return true;
  } catch (error) {
    logger.error(`Database health check failed: ${error}`, "PRICING_HEALTH");
    return false;
  }
}

async function checkCache(): Promise<boolean> {
  try {
    // Check Redis or in-memory cache
    // For now, we'll assume in-memory cache is always healthy
    return true;
  } catch (error) {
    logger.error(`Cache health check failed: ${error}`, "PRICING_HEALTH");
    return false;
  }
}

async function checkExternalAPI(): Promise<boolean> {
  try {
    // Check if external pricing API is reachable
    // For now, we'll simulate this check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    // In production, this would check actual Walmart API
    // const response = await fetch("https://api.walmart.com/health", {
    //   signal: controller.signal,
    // });
    
    clearTimeout(timeoutId);
    
    // Simulated success for local development
    return true;
  } catch (error) {
    logger.error(`External API health check failed: ${error}`, "PRICING_HEALTH");
    return false;
  }
}