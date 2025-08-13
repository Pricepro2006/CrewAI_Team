/**
 * Optimized Email Processor
 * Implements high-throughput email processing with Ollama optimization
 * Target: 60+ emails/minute
 */

import { EventEmitter } from "events";
import PQueue from "p-queue";
import { logger } from "../../utils/logger.js";
import { OllamaOptimizer } from "./OllamaOptimizer.js";
import { EmailAnalysisCache } from "../cache/EmailAnalysisCache.js";
import { performance } from "perf_hooks";

interface EmailInput {
  id: string;
  subject: string;
  body?: string;
  body_preview?: string;
  sender_email: string;
  received_at: string;
  priority?: string;
}

interface ProcessingOptions {
  // Processing modes
  mode: "speed" | "balanced" | "quality";
  
  // Concurrency settings
  concurrency: number;
  batchSize: number;
  
  // Model selection
  useSmallModels: boolean;
  skipPhase3: boolean;
  
  // Caching
  enableCache: boolean;
  cacheOnly: boolean;
  
  // Timeout management
  phase1Timeout: number;
  phase2Timeout: number;
  phase3Timeout: number;
  
  // Quality thresholds
  minConfidence: number;
  maxRetries: number;
}

interface ProcessingMetrics {
  totalEmails: number;
  processedEmails: number;
  successfulEmails: number;
  failedEmails: number;
  cacheHits: number;
  averageLatency: number;
  throughput: number; // emails per second
  phase1AvgTime: number;
  phase2AvgTime: number;
  phase3AvgTime: number;
}

export class OptimizedEmailProcessor extends EventEmitter {
  private optimizer: OllamaOptimizer;
  private cache: EmailAnalysisCache;
  private processingQueue: PQueue;
  private options: ProcessingOptions;
  private metrics: ProcessingMetrics;
  private latencyHistory: number[] = [];

  constructor(optimizer?: OllamaOptimizer, options?: Partial<ProcessingOptions>) {
    super();
    
    this.optimizer = optimizer || new OllamaOptimizer();
    this.cache = new EmailAnalysisCache({ maxSize: 5000, ttl: 7200000 }); // 2 hour TTL
    
    // Default options optimized for throughput
    this.options = {
      mode: "balanced",
      concurrency: 20,
      batchSize: 10,
      useSmallModels: false,
      skipPhase3: false,
      enableCache: true,
      cacheOnly: false,
      phase1Timeout: 500, // 0.5 seconds
      phase2Timeout: 5000, // 5 seconds
      phase3Timeout: 10000, // 10 seconds
      minConfidence: 0.6,
      maxRetries: 1,
      ...options
    };

    // Initialize metrics
    this.metrics = {
      totalEmails: 0,
      processedEmails: 0,
      successfulEmails: 0,
      failedEmails: 0,
      cacheHits: 0,
      averageLatency: 0,
      throughput: 0,
      phase1AvgTime: 0,
      phase2AvgTime: 0,
      phase3AvgTime: 0
    };

    // Configure processing queue based on mode
    this.processingQueue = this.createProcessingQueue();

    // Apply mode-specific optimizations
    this.applyModeOptimizations();
  }

  /**
   * Create processing queue with mode-specific settings
   */
  private createProcessingQueue(): PQueue {
    const queueConfig = {
      concurrency: this.options.concurrency,
      interval: 50, // Process every 50ms
      intervalCap: Math.floor(this.options.concurrency * 0.8), // 80% of concurrency
      timeout: 30000, // 30 second timeout per email
      throwOnTimeout: false
    };

    return new PQueue(queueConfig);
  }

  /**
   * Apply mode-specific optimizations
   */
  private applyModeOptimizations(): void {
    switch (this.options.mode) {
      case "speed":
        // Maximum speed - sacrifice some quality
        this.options.useSmallModels = true;
        this.options.skipPhase3 = true;
        this.options.phase2Timeout = 3000;
        this.options.minConfidence = 0.5;
        this.options.maxRetries = 0;
        
        // Configure optimizer for speed
        this.optimizer.optimizeForWorkload("batch");
        logger.info("Configured for SPEED mode", "OPTIMIZED_PROCESSOR");
        break;
        
      case "quality":
        // Maximum quality - slower processing
        this.options.useSmallModels = false;
        this.options.skipPhase3 = false;
        this.options.phase2Timeout = 10000;
        this.options.phase3Timeout = 20000;
        this.options.minConfidence = 0.8;
        this.options.maxRetries = 2;
        
        // Configure optimizer for quality
        this.optimizer.optimizeForWorkload("realtime");
        logger.info("Configured for QUALITY mode", "OPTIMIZED_PROCESSOR");
        break;
        
      case "balanced":
      default:
        // Balanced approach
        this.optimizer.optimizeForWorkload("mixed");
        logger.info("Configured for BALANCED mode", "OPTIMIZED_PROCESSOR");
        break;
    }
  }

  /**
   * Process emails with optimizations
   */
  async processEmails(emails: EmailInput[]): Promise<void> {
    const startTime = performance.now();
    this.metrics.totalEmails = emails.length;
    
    logger.info(`Starting optimized processing of ${emails.length} emails`, "OPTIMIZED_PROCESSOR", {
      mode: this.options.mode,
      concurrency: this.options.concurrency,
      batchSize: this.options.batchSize
    });

    // Emit start event
    this.emit("processing:start", { total: emails.length });

    // Process in batches for better throughput
    const batches = this.createBatches(emails, this.options.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPromises = batch.map(email => 
        this.processingQueue.add(() => this.processEmail(email))
      );

      // Wait for batch to complete
      await Promise.allSettled(batchPromises);

      // Emit progress
      const processed = Math.min((i + 1) * this.options.batchSize, emails.length);
      this.emit("processing:progress", {
        processed,
        total: emails.length,
        percentage: (processed / emails.length) * 100
      });

      // Brief pause between batches to prevent overload
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate final metrics
    const totalTime = performance.now() - startTime;
    this.metrics.throughput = (this.metrics.processedEmails / totalTime) * 1000; // per second

    logger.info("Processing complete", "OPTIMIZED_PROCESSOR", {
      totalEmails: this.metrics.totalEmails,
      successful: this.metrics.successfulEmails,
      failed: this.metrics.failedEmails,
      cacheHits: this.metrics.cacheHits,
      throughput: `${this.metrics.throughput.toFixed(2)} emails/second`,
      totalTime: `${(totalTime / 1000).toFixed(2)} seconds`
    });

    // Emit completion
    this.emit("processing:complete", this.metrics);
  }

  /**
   * Process individual email with optimizations
   */
  private async processEmail(email: EmailInput): Promise<void> {
    const startTime = performance.now();
    const emailStart = Date.now();

    try {
      // Check cache first
      if (this.options.enableCache) {
        const cached = this.cache.get(email.id);
        if (cached) {
          this.metrics.cacheHits++;
          this.metrics.successfulEmails++;
          this.metrics.processedEmails++;
          this.recordLatency(performance.now() - startTime);
          
          this.emit("email:complete", {
            emailId: email.id,
            fromCache: true,
            processingTime: performance.now() - startTime
          });
          return;
        }
      }

      // Skip processing if cache-only mode
      if (this.options.cacheOnly) {
        this.metrics.failedEmails++;
        this.metrics.processedEmails++;
        return;
      }

      // Phase 1: Rule-based analysis (always fast)
      const phase1Start = performance.now();
      const phase1Results = await this.runPhase1(email);
      const phase1Time = performance.now() - phase1Start;
      
      this.updatePhaseMetrics("phase1", phase1Time);

      // Determine if we should continue to Phase 2
      if (this.shouldSkipPhase2(phase1Results, email)) {
        // Use Phase 1 results only
        this.cache.set(email.id, phase1Results);
        this.metrics.successfulEmails++;
        this.metrics.processedEmails++;
        this.recordLatency(performance.now() - startTime);
        
        this.emit("email:complete", {
          emailId: email.id,
          phases: 1,
          processingTime: performance.now() - startTime
        });
        return;
      }

      // Phase 2: LLM Enhancement
      const phase2Start = performance.now();
      const phase2Results = await this.runPhase2Optimized(email, phase1Results);
      const phase2Time = performance.now() - phase2Start;
      
      this.updatePhaseMetrics("phase2", phase2Time);

      // Check if we should skip Phase 3
      if (this.options.skipPhase3 || this.shouldSkipPhase3(phase2Results)) {
        this.cache.set(email.id, phase2Results);
        this.metrics.successfulEmails++;
        this.metrics.processedEmails++;
        this.recordLatency(performance.now() - startTime);
        
        this.emit("email:complete", {
          emailId: email.id,
          phases: 2,
          processingTime: performance.now() - startTime
        });
        return;
      }

      // Phase 3: Strategic Analysis (only for important emails)
      const phase3Start = performance.now();
      const phase3Results = await this.runPhase3Optimized(email, phase1Results, phase2Results);
      const phase3Time = performance.now() - phase3Start;
      
      this.updatePhaseMetrics("phase3", phase3Time);

      // Cache and complete
      this.cache.set(email.id, phase3Results);
      this.metrics.successfulEmails++;
      this.metrics.processedEmails++;
      this.recordLatency(performance.now() - startTime);
      
      this.emit("email:complete", {
        emailId: email.id,
        phases: 3,
        processingTime: performance.now() - startTime
      });

    } catch (error) {
      logger.error(`Failed to process email ${email.id}`, "OPTIMIZED_PROCESSOR", { error });
      this.metrics.failedEmails++;
      this.metrics.processedEmails++;
      
      this.emit("email:error", {
        emailId: email.id,
        error,
        processingTime: performance.now() - startTime
      });
    }
  }

  /**
   * Phase 1: Fast rule-based analysis
   */
  private async runPhase1(email: EmailInput): Promise<any> {
    // Simulate fast rule-based extraction
    const content = (email.subject + " " + (email.body || email.body_preview || "")).toLowerCase();
    
    return {
      workflow_state: this.detectWorkflowState(content),
      priority: email.priority || this.calculatePriority(content),
      urgency_score: this.calculateUrgency(content),
      entities: {
        po_numbers: this.extractPattern(content, /\bPO\s*#?\s*(\d{7,12})\b/gi),
        quote_numbers: this.extractPattern(content, /\bQuote\s*#?\s*(\d{6,10})\b/gi),
        dollar_amounts: this.extractPattern(content, /\$[\d,]+(?:\.\d{2})?/g)
      },
      processing_time: 0 // Will be set by caller
    };
  }

  /**
   * Phase 2: Optimized LLM enhancement
   */
  private async runPhase2Optimized(email: EmailInput, phase1Results: any): Promise<any> {
    const model = this.options.useSmallModels ? "qwen3:0.6b" : "llama3.2:3b";
    
    const prompt = this.buildOptimizedPrompt(email, phase1Results);
    
    try {
      const response = await Promise.race([
        this.optimizer.generate(prompt, model, {
          temperature: 0.1,
          num_predict: 800, // Reduced for speed
          format: "json"
        }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Phase 2 timeout")), this.options.phase2Timeout)
        )
      ]);

      // Parse and merge with Phase 1
      const phase2Data = JSON.parse(response);
      return {
        ...phase1Results,
        ...phase2Data,
        confidence: phase2Data.confidence || 0.7
      };
    } catch (error) {
      logger.warn("Phase 2 failed, using Phase 1 results", "OPTIMIZED_PROCESSOR");
      return {
        ...phase1Results,
        confidence: 0.5,
        workflow_validation: "Fallback to rule-based analysis"
      };
    }
  }

  /**
   * Phase 3: Optimized strategic analysis
   */
  private async runPhase3Optimized(
    email: EmailInput,
    phase1Results: any,
    phase2Results: any
  ): Promise<any> {
    const model = "doomgrave/phi-4:14b-tools-Q3_K_S";
    
    const prompt = this.buildStrategicPrompt(email, phase1Results, phase2Results);
    
    try {
      const response = await Promise.race([
        this.optimizer.generate(prompt, model, {
          temperature: 0.2,
          num_predict: 600, // Reduced for speed
          format: "json"
        }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Phase 3 timeout")), this.options.phase3Timeout)
        )
      ]);

      const phase3Data = JSON.parse(response);
      return {
        ...phase2Results,
        strategic_insights: phase3Data.strategic_insights || {},
        executive_summary: phase3Data.executive_summary || "Standard processing"
      };
    } catch (error) {
      logger.warn("Phase 3 failed, using Phase 2 results", "OPTIMIZED_PROCESSOR");
      return {
        ...phase2Results,
        strategic_insights: { opportunity: "Standard", risk: "Low" },
        executive_summary: "Standard processing recommended"
      };
    }
  }

  /**
   * Helper methods
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private shouldSkipPhase2(phase1Results: any, email: EmailInput): boolean {
    // Skip Phase 2 for very simple emails
    return phase1Results.urgency_score < 2 && 
           phase1Results.priority === "low" &&
           Object.values(phase1Results.entities).every((arr: any) => arr.length === 0);
  }

  private shouldSkipPhase3(phase2Results: any): boolean {
    // Skip Phase 3 for low-confidence or simple emails
    return phase2Results.confidence < this.options.minConfidence ||
           phase2Results.priority !== "critical";
  }

  private detectWorkflowState(content: string): string {
    if (content.includes("quote") || content.includes("pricing")) return "QUOTE_REQUEST";
    if (content.includes("order") || content.includes("purchase")) return "ORDER_PROCESSING";
    if (content.includes("ship") || content.includes("deliver")) return "SHIPPING";
    if (content.includes("issue") || content.includes("problem")) return "SUPPORT";
    return "GENERAL_INQUIRY";
  }

  private calculatePriority(content: string): string {
    const urgencyKeywords = ["urgent", "asap", "critical", "immediate"];
    const hasUrgency = urgencyKeywords.some(keyword => content.includes(keyword));
    return hasUrgency ? "high" : "medium";
  }

  private calculateUrgency(content: string): number {
    let score = 0;
    const urgencyMap = {
      "urgent": 3,
      "asap": 3,
      "critical": 4,
      "immediate": 3,
      "today": 2,
      "deadline": 2
    };
    
    for (const [keyword, weight] of Object.entries(urgencyMap)) {
      if (content.includes(keyword)) score += weight;
    }
    
    return Math.min(score, 10);
  }

  private extractPattern(content: string, pattern: RegExp): string[] {
    const matches = content.match(pattern) || [];
    return [...new Set(matches)].slice(0, 10); // Limit results
  }

  private buildOptimizedPrompt(email: EmailInput, phase1Results: any): string {
    return `Analyze this email and enhance the initial analysis. Be concise.

Initial Analysis:
${JSON.stringify(phase1Results, null, 2)}

Email Subject: ${email.subject}
Email Preview: ${(email.body || email.body_preview || "").substring(0, 500)}

Provide enhanced analysis in JSON format with these fields:
- workflow_validation: Confirm or correct the workflow state
- confidence: Your confidence score (0-1)
- action_items: List any required actions
- risk_assessment: Brief risk assessment

Respond with JSON only, no explanation.`;
  }

  private buildStrategicPrompt(email: EmailInput, phase1: any, phase2: any): string {
    return `Provide strategic insights for this analyzed email. Be very concise.

Current Analysis:
Priority: ${phase2.priority}
Workflow: ${phase2.workflow_validation}
Risk: ${phase2.risk_assessment}

Provide strategic insights in JSON format:
- strategic_insights: { opportunity, risk, relationship }
- executive_summary: One sentence summary

JSON only, maximum 100 words total.`;
  }

  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 1000) {
      this.latencyHistory = this.latencyHistory.slice(-1000);
    }
    this.metrics.averageLatency = 
      this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
  }

  private updatePhaseMetrics(phase: string, time: number): void {
    switch (phase) {
      case "phase1":
        this.metrics.phase1AvgTime = 
          (this.metrics.phase1AvgTime * (this.metrics.processedEmails - 1) + time) / 
          this.metrics.processedEmails;
        break;
      case "phase2":
        this.metrics.phase2AvgTime = 
          (this.metrics.phase2AvgTime * (this.metrics.processedEmails - 1) + time) / 
          this.metrics.processedEmails;
        break;
      case "phase3":
        this.metrics.phase3AvgTime = 
          (this.metrics.phase3AvgTime * (this.metrics.processedEmails - 1) + time) / 
          this.metrics.processedEmails;
        break;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProcessingMetrics & { ollamaMetrics: any } {
    return {
      ...this.metrics,
      ollamaMetrics: this.optimizer.getMetrics()
    };
  }

  /**
   * Update processing mode dynamically
   */
  updateMode(mode: "speed" | "balanced" | "quality"): void {
    this.options.mode = mode;
    this.applyModeOptimizations();
    logger.info(`Processing mode changed to ${mode}`, "OPTIMIZED_PROCESSOR");
  }

  /**
   * Shutdown processor
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down optimized processor", "OPTIMIZED_PROCESSOR");
    await this.processingQueue.onEmpty();
    await this.optimizer.shutdown();
    this.removeAllListeners();
  }
}

// Export singleton
export const optimizedProcessor = new OptimizedEmailProcessor();