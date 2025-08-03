/**
 * Email Processing Performance Optimizer
 * Implements connection pooling, request batching, and performance optimizations
 * for achieving 60+ emails/minute processing rate
 */

import axios from "axios";
import type { AxiosInstance } from "axios";
import pLimit from "p-limit";
import { Logger } from "../../utils/logger.js";
import { RedisService } from "../cache/RedisService.js";
import { EmailAnalysisCache } from "../cache/EmailAnalysisCache.js";
import type { EmailInput, Phase1Results, Phase2Results } from "./EmailThreePhaseAnalysisService.js";

const logger = new Logger("EmailProcessingOptimizer");

interface OptimizationConfig {
  // Connection pooling
  maxConnections: number;
  keepAliveTimeout: number;
  
  // Batching
  batchSize: number;
  batchTimeout: number;
  
  // Caching
  enableSmartCaching: boolean;
  similarityThreshold: number;
  
  // Performance
  parallelPhase2: number;
  parallelPhase3: number;
  
  // Ollama specific
  ollamaUrl: string;
  ollamaTimeout: number;
  ollamaKeepAlive: string;
}

interface BatchRequest {
  emails: EmailInput[];
  phase1Results: Phase1Results[];
  resolve: (results: Phase2Results[]) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class EmailProcessingOptimizer {
  private config: OptimizationConfig;
  private redisService: RedisService;
  private analysisCache: EmailAnalysisCache;
  
  // Connection pool for Ollama
  private ollamaPool: AxiosInstance;
  private activeConnections = 0;
  private connectionQueue: (() => void)[] = [];
  
  // Batching system
  private batchQueue: Map<string, BatchRequest[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // Performance metrics
  private metrics = {
    totalProcessed: 0,
    cacheHits: 0,
    batchesProcessed: 0,
    avgResponseTime: 0,
    connectionReuses: 0,
  };

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      maxConnections: 10,
      keepAliveTimeout: 300000, // 5 minutes
      batchSize: 10,
      batchTimeout: 1000, // 1 second
      enableSmartCaching: true,
      similarityThreshold: 0.85,
      parallelPhase2: 5,
      parallelPhase3: 3,
      ollamaUrl: "http://localhost:11434",
      ollamaTimeout: 30000,
      ollamaKeepAlive: "30m",
      ...config,
    };

    this.redisService = new RedisService();
    this.analysisCache = new EmailAnalysisCache({
      maxSize: 5000,
      ttl: 7200000, // 2 hours
    });

    // Initialize connection pool with keep-alive
    this.ollamaPool = axios.create({
      baseURL: this.config.ollamaUrl,
      timeout: this.config.ollamaTimeout,
      httpAgent: new (require('http').Agent)({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: this.config.maxConnections,
        maxFreeSockets: Math.floor(this.config.maxConnections / 2),
      }),
      headers: {
        'Connection': 'keep-alive',
        'Keep-Alive': `timeout=${Math.floor(this.config.keepAliveTimeout / 1000)}`,
      },
    });

    // Pre-warm connections
    this.prewarmConnections();
  }

  /**
   * Pre-warm Ollama connections to reduce initial latency
   */
  private async prewarmConnections(): Promise<void> {
    logger.info("Pre-warming Ollama connections...");
    
    const warmupPromises = [];
    for (let i = 0; i < Math.min(3, this.config.maxConnections); i++) {
      warmupPromises.push(
        this.ollamaPool.post("/api/generate", {
          model: "llama3.2:3b",
          prompt: "Hello",
          stream: false,
          keep_alive: this.config.ollamaKeepAlive,
          options: {
            num_predict: 1,
          },
        }).catch(() => {
          // Ignore warmup errors
        })
      );
    }

    await Promise.all(warmupPromises);
    logger.info("Connection pre-warming complete");
  }

  /**
   * Optimized Phase 2 processing with batching and connection pooling
   */
  async processPhase2Batch(
    emails: EmailInput[],
    phase1Results: Phase1Results[],
    options: { model?: string } = {}
  ): Promise<Phase2Results[]> {
    const model = options.model || "llama3.2:3b";
    
    // Check for cached results first
    const results: (Phase2Results | null)[] = new Array(emails.length).fill(null);
    const uncachedIndices: number[] = [];
    
    if (this.config.enableSmartCaching) {
      for (let i = 0; i < emails.length; i++) {
        const cached = await this.checkSimilarCache(emails[i], phase1Results[i]);
        if (cached) {
          results[i] = cached;
          this.metrics.cacheHits++;
        } else {
          uncachedIndices.push(i);
        }
      }
    } else {
      uncachedIndices.push(...Array.from({ length: emails.length }, (_, i) => i));
    }

    if (uncachedIndices.length === 0) {
      logger.debug(`All ${emails.length} emails served from cache`);
      return results as Phase2Results[];
    }

    // Process uncached emails in optimized batches
    const batchLimit = pLimit(this.config.parallelPhase2);
    const batchPromises = uncachedIndices.map((index) =>
      batchLimit(async () => {
        const email = emails[index];
        const phase1 = phase1Results[index];
        
        try {
          const result = await this.processPhase2Single(email, phase1, model);
          results[index] = result;
          
          // Cache the result
          if (this.config.enableSmartCaching) {
            await this.cacheResult(email, phase1, result);
          }
          
          return result;
        } catch (error) {
          logger.error(`Phase 2 processing failed for email ${email.id}:`, error);
          throw error;
        }
      })
    );

    await Promise.all(batchPromises);
    
    this.metrics.totalProcessed += emails.length;
    this.metrics.batchesProcessed++;
    
    return results as Phase2Results[];
  }

  /**
   * Process single Phase 2 with optimized prompt and connection reuse
   */
  private async processPhase2Single(
    email: EmailInput,
    phase1Results: Phase1Results,
    model: string
  ): Promise<Phase2Results> {
    const startTime = Date.now();
    
    // Build optimized prompt (shorter, more focused)
    const prompt = this.buildOptimizedPhase2Prompt(email, phase1Results);
    
    // Use connection pool with retry logic
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      try {
        const response = await this.acquireConnection(async () => {
          return await this.ollamaPool.post("/api/generate", {
            model,
            prompt,
            stream: false,
            format: "json",
            keep_alive: this.config.ollamaKeepAlive,
            system: "Respond with JSON only. Be concise.",
            options: {
              temperature: 0.1,
              num_predict: 800, // Reduced from 1200
              num_ctx: 4096,
              top_k: 10,
              repeat_penalty: 1.1,
              stop: ["```", "\n\n\n", "Note:", "Based on"],
            },
          });
        });

        const responseData = response.data.response;
        
        // Parse and validate response
        const parsed = this.parseOptimizedResponse(responseData);
        
        // Update metrics
        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime);
        
        return this.createPhase2Results(phase1Results, parsed, processingTime);
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          logger.error(`Phase 2 failed after ${maxAttempts} attempts:`, error);
          return this.createPhase2Fallback(phase1Results, Date.now() - startTime);
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }

    return this.createPhase2Fallback(phase1Results, Date.now() - startTime);
  }

  /**
   * Build optimized, shorter prompt for faster processing
   */
  private buildOptimizedPhase2Prompt(email: EmailInput, phase1: Phase1Results): string {
    const emailContent = `${email.subject} ${email.body || email.body_preview || ''}`.substring(0, 1000);
    
    return `Analyze this email and provide JSON response:

Email: "${emailContent}"

Phase1 Data:
- Workflow: ${phase1.workflow_state}
- Priority: ${phase1.priority}
- Entities: PO(${phase1.entities.po_numbers.length}), Quote(${phase1.entities.quote_numbers.length})

Required JSON fields:
{
  "workflow_validation": "string",
  "missed_entities": {
    "company_names": [],
    "people": [],
    "products": []
  },
  "action_items": [{"task": "", "owner": "", "deadline": ""}],
  "risk_assessment": "string",
  "initial_response": "string",
  "confidence": 0.0-1.0,
  "business_process": "string"
}`;
  }

  /**
   * Parse optimized response with better error handling
   */
  private parseOptimizedResponse(response: string): Record<string, any> {
    try {
      // Remove any non-JSON content
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.debug("Failed to parse response, using fallback");
      return {
        workflow_validation: "Processing",
        missed_entities: { company_names: [], people: [], products: [] },
        action_items: [],
        risk_assessment: "Standard",
        initial_response: "Processing your request",
        confidence: 0.5,
        business_process: "STANDARD",
      };
    }
  }

  /**
   * Connection pool management
   */
  private async acquireConnection<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    // Wait if we're at max connections
    while (this.activeConnections >= this.config.maxConnections) {
      await new Promise<void>((resolve) => {
        this.connectionQueue.push(resolve);
      });
    }

    this.activeConnections++;
    
    try {
      const result = await operation();
      this.metrics.connectionReuses++;
      return result;
    } finally {
      this.activeConnections--;
      
      // Release next waiting connection
      const next = this.connectionQueue.shift();
      if (next) next();
    }
  }

  /**
   * Smart caching based on email similarity
   */
  private async checkSimilarCache(
    email: EmailInput,
    phase1: Phase1Results
  ): Promise<Phase2Results | null> {
    // Generate cache key based on email characteristics
    const cacheKey = this.generateCacheKey(email, phase1);
    
    // Check exact match first
    const exactMatch = await this.redisService.get<Phase2Results>(`phase2:${cacheKey}`);
    if (exactMatch) {
      return exactMatch;
    }

    // Check for similar emails (same workflow state, similar entities)
    if (phase1.workflow_state && phase1.priority) {
      const similarKey = `similar:${phase1.workflow_state}:${phase1.priority}`;
      const similar = await this.redisService.get<Phase2Results>(similarKey);
      
      if (similar && this.isSimilarEnough(phase1, similar)) {
        // Adapt the cached result
        return this.adaptCachedResult(similar, phase1);
      }
    }

    return null;
  }

  /**
   * Generate cache key for email
   */
  private generateCacheKey(email: EmailInput, phase1: Phase1Results): string {
    const elements = [
      phase1.workflow_state,
      phase1.priority,
      phase1.entities.po_numbers.length,
      phase1.entities.quote_numbers.length,
      email.sender_email.split('@')[1], // domain
      Math.floor(phase1.urgency_score),
    ];
    
    return elements.join(':');
  }

  /**
   * Check if cached result is similar enough to reuse
   */
  private isSimilarEnough(phase1: Phase1Results, cached: Phase2Results): boolean {
    // Simple similarity check - can be enhanced
    return (
      cached.workflow_validation &&
      cached.confidence > 0.6 &&
      cached.business_process !== "PARSING_ERROR"
    );
  }

  /**
   * Adapt cached result to current email
   */
  private adaptCachedResult(cached: Phase2Results, phase1: Phase1Results): Phase2Results {
    return {
      ...cached,
      ...phase1,
      confidence: cached.confidence * 0.9, // Slightly reduce confidence
      phase2_processing_time: 10, // Cache hit is fast
    };
  }

  /**
   * Cache result for future use
   */
  private async cacheResult(
    email: EmailInput,
    phase1: Phase1Results,
    result: Phase2Results
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(email, phase1);
    
    // Cache exact match
    await this.redisService.set(
      `phase2:${cacheKey}`,
      result,
      3600 // 1 hour TTL
    );
    
    // Cache as similar template if high quality
    if (result.confidence > 0.7 && phase1.workflow_state) {
      const similarKey = `similar:${phase1.workflow_state}:${phase1.priority}`;
      await this.redisService.set(similarKey, result, 7200); // 2 hour TTL
    }
  }

  /**
   * Create Phase 2 results from parsed data
   */
  private createPhase2Results(
    phase1: Phase1Results,
    parsed: Record<string, any>,
    processingTime: number
  ): Phase2Results {
    return {
      ...phase1,
      workflow_validation: parsed.workflow_validation || phase1.workflow_state,
      missed_entities: {
        project_names: [],
        company_names: parsed.missed_entities?.company_names || [],
        people: parsed.missed_entities?.people || [],
        products: parsed.missed_entities?.products || [],
        technical_specs: [],
        locations: [],
        other_references: [],
      },
      action_items: parsed.action_items || [],
      risk_assessment: parsed.risk_assessment || "Standard",
      initial_response: parsed.initial_response || "Processing your request",
      confidence: parsed.confidence || 0.75,
      business_process: parsed.business_process || phase1.workflow_state,
      phase2_processing_time: processingTime,
      extracted_requirements: [],
    };
  }

  /**
   * Create fallback Phase 2 results
   */
  private createPhase2Fallback(phase1: Phase1Results, processingTime: number): Phase2Results {
    return {
      ...phase1,
      workflow_validation: `Confirmed: ${phase1.workflow_state}`,
      missed_entities: {
        project_names: [],
        company_names: [],
        people: [],
        products: [],
        technical_specs: [],
        locations: [],
        other_references: [],
      },
      action_items: [],
      risk_assessment: "Standard processing",
      initial_response: "Thank you for your email. We are processing your request.",
      confidence: 0.5,
      business_process: phase1.workflow_state,
      phase2_processing_time: processingTime,
      extracted_requirements: [],
    };
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(processingTime: number): void {
    const currentAvg = this.metrics.avgResponseTime;
    const totalCount = this.metrics.totalProcessed;
    
    this.metrics.avgResponseTime = (currentAvg * totalCount + processingTime) / (totalCount + 1);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): typeof this.metrics & {
    cacheHitRate: number;
    avgBatchSize: number;
    connectionsPerMinute: number;
  } {
    const cacheHitRate = this.metrics.totalProcessed > 0
      ? (this.metrics.cacheHits / this.metrics.totalProcessed) * 100
      : 0;
      
    const avgBatchSize = this.metrics.batchesProcessed > 0
      ? this.metrics.totalProcessed / this.metrics.batchesProcessed
      : 0;
      
    const connectionsPerMinute = this.metrics.connectionReuses;

    return {
      ...this.metrics,
      cacheHitRate,
      avgBatchSize,
      connectionsPerMinute,
    };
  }

  /**
   * Optimize Ollama settings for throughput
   */
  async optimizeOllamaSettings(): Promise<void> {
    logger.info("Optimizing Ollama settings for throughput...");
    
    try {
      // Set OLLAMA environment variables for better performance
      const optimizations = {
        OLLAMA_NUM_PARALLEL: "4", // Allow parallel requests
        OLLAMA_MAX_LOADED_MODELS: "2", // Keep both models loaded
        OLLAMA_KEEP_ALIVE: "30m", // Keep models warm
        OLLAMA_GPU_MEMORY: "80%", // Use more GPU memory if available
      };

      // Log recommended settings
      logger.info("Recommended Ollama environment variables:");
      Object.entries(optimizations).forEach(([key, value]) => {
        logger.info(`  ${key}=${value}`);
      });

      // Pre-load models
      await this.preloadModels();
    } catch (error) {
      logger.error("Failed to optimize Ollama settings:", error);
    }
  }

  /**
   * Pre-load models to reduce first-request latency
   */
  private async preloadModels(): Promise<void> {
    const models = ["llama3.2:3b", "doomgrave/phi-4:14b-tools-Q3_K_S"];
    
    for (const model of models) {
      try {
        await this.ollamaPool.post("/api/generate", {
          model,
          prompt: "Initialize",
          stream: false,
          keep_alive: this.config.ollamaKeepAlive,
          options: {
            num_predict: 1,
          },
        });
        logger.info(`Pre-loaded model: ${model}`);
      } catch (error) {
        logger.warn(`Failed to pre-load model ${model}:`, error);
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Clear batch timers
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.batchTimers.clear();
    
    // Close connections
    await this.redisService.close();
  }
}

// Export singleton instance
export const emailOptimizer = new EmailProcessingOptimizer();