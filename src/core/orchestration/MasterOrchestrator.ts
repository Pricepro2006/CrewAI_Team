/**
 * Master Orchestrator - Central coordination for AI agents and processing
 * Manages query processing, agent coordination, and response generation
 */

import { logger } from "../../utils/logger.js";

export type AgentRole = 'analyst' | 'coordinator' | 'executor' | 'researcher' | 'validator';

export interface Query {
  text: string;
  metadata?: Record<string, any>;
  agentRole?: AgentRole;
  priority?: "low" | "medium" | "high";
}

export interface QueryResult {
  response: string;
  summary?: string;
  confidence: number;
  processingTime: number;
  agentUsed?: string;
  metadata?: Record<string, any>;
}

export interface OrchestratorConfig {
  maxConcurrentQueries?: number;
  defaultTimeout?: number;
  enableCaching?: boolean;
}

export class MasterOrchestrator {
  private static instance: MasterOrchestrator;
  private config: OrchestratorConfig;
  private queryQueue: Query[] = [];
  private processing: boolean = false;
  private cache: Map<string, QueryResult> = new Map();

  private constructor(config?: OrchestratorConfig) {
    this.config = {
      maxConcurrentQueries: config?.maxConcurrentQueries || 5,
      defaultTimeout: config?.defaultTimeout || 30000,
      enableCaching: config?.enableCaching !== false
    };
  }

  static getInstance(config?: OrchestratorConfig): MasterOrchestrator {
    if (!MasterOrchestrator.instance) {
      MasterOrchestrator.instance = new MasterOrchestrator(config);
    }
    return MasterOrchestrator.instance;
  }

  /**
   * Process a query through the orchestration system
   */
  async processQuery(query: Query): Promise<QueryResult> {
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.info("Returning cached result", "ORCHESTRATOR", { 
          query: query.text.substring(0, 50) 
        });
        return cached;
      }
    }

    logger.info("Processing query", "ORCHESTRATOR", {
      text: query.text.substring(0, 100),
      metadata: query.metadata,
      priority: query.priority
    });

    try {
      // Add to queue if high priority
      if (query.priority === "high") {
        this.queryQueue.unshift(query);
      } else {
        this.queryQueue.push(query);
      }

      // Process the query
      const result = await this.executeQuery(query);
      
      // Cache the result
      if (this.config.enableCaching) {
        const cacheKey = this.getCacheKey(query);
        this.cache.set(cacheKey, result);
        
        // Limit cache size
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          if (firstKey) {
            this.cache.delete(firstKey);
          }
        }
      }

      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;

      logger.info("Query processed successfully", "ORCHESTRATOR", {
        processingTime,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      logger.error("Query processing failed", "ORCHESTRATOR", { error });
      throw error;
    }
  }

  /**
   * Execute a query
   */
  private async executeQuery(query: Query): Promise<QueryResult> {
    // Simulate processing based on query type
    const taskType = query.metadata?.task || "general";
    
    switch (taskType) {
      case "embedding":
        return this.generateEmbedding(query);
      case "recommendation":
        return this.generateRecommendation(query);
      case "analysis":
        return this.performAnalysis(query);
      default:
        return this.generalProcessing(query);
    }
  }

  /**
   * Generate embedding
   */
  private async generateEmbedding(query: Query): Promise<QueryResult> {
    // Simulate embedding generation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dimension = query.metadata?.dimension || 384;
    const embedding = Array.from({ length: dimension }, () => Math.random() * 2 - 1);
    
    return {
      response: JSON.stringify(embedding),
      confidence: 0.95,
      processingTime: 0,
      metadata: { dimension, type: "embedding" }
    };
  }

  /**
   * Generate recommendation
   */
  private async generateRecommendation(query: Query): Promise<QueryResult> {
    // Simulate recommendation generation
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const context = query.metadata?.context || {};
    const recommendations = [
      "product_id: MOCK-001",
      "product_id: MOCK-002",
      "product_id: MOCK-003"
    ];
    
    return {
      response: recommendations.join("\n"),
      summary: "Generated 3 product recommendations based on user context",
      confidence: 0.85,
      processingTime: 0,
      metadata: { 
        recommendationCount: recommendations.length,
        context 
      }
    };
  }

  /**
   * Perform analysis
   */
  private async performAnalysis(query: Query): Promise<QueryResult> {
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const searchResults = query.metadata?.searchResults || [];
    const analysis = {
      totalProducts: searchResults.length,
      priceRange: this.analyzePriceRange(searchResults),
      topBrands: this.analyzeTopBrands(searchResults),
      recommendations: "Consider filtering by price range for better results"
    };
    
    return {
      response: JSON.stringify(analysis),
      summary: `Analyzed ${searchResults.length} products with price range ${analysis.priceRange}`,
      confidence: 0.9,
      processingTime: 0,
      metadata: analysis
    };
  }

  /**
   * General processing
   */
  private async generalProcessing(query: Query): Promise<QueryResult> {
    // Simulate general processing
    await new Promise(resolve => setTimeout(resolve, 150));
    
    return {
      response: `Processed query: ${query.text}`,
      summary: "General query processed successfully",
      confidence: 0.8,
      processingTime: 0,
      metadata: query.metadata
    };
  }

  /**
   * Helper: Analyze price range
   */
  private analyzePriceRange(products: any[]): string {
    if (!products.length) return "N/A";
    
    const prices = products
      .map(p => p.price || p.current_price || 0)
      .filter(price => price > 0);
    
    if (!prices.length) return "N/A";
    
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  }

  /**
   * Helper: Analyze top brands
   */
  private analyzeTopBrands(products: any[]): string[] {
    const brandCounts = new Map<string, number>();
    
    products.forEach(product => {
      const brand = product.brand || "Unknown";
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    });
    
    return Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([brand]) => brand);
  }

  /**
   * Get cache key for query
   */
  private getCacheKey(query: Query): string {
    return `${query.text}:${JSON.stringify(query.metadata || {})}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info("Cache cleared", "ORCHESTRATOR");
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { size: number; processing: boolean } {
    return {
      size: this.queryQueue.length,
      processing: this.processing
    };
  }
}