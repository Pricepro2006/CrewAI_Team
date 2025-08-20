/**
 * Optimized Email Processor
 * Implements high-throughput email processing with Ollama optimization
 * Target: 60+ emails/minute
 */

import { EventEmitter } from "events";
import PQueue from "p-queue";
import { logger } from "../../utils/logger.js";
import { EmailAnalysisCache } from "../cache/EmailAnalysisCache.js";
import { performance } from "perf_hooks";
import { LlamaCppHttpProvider, type LlamaCppRequestContext } from "../llm/LlamaCppHttpProvider.js";

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
  private llamaProvider: LlamaCppHttpProvider;
  private cache: EmailAnalysisCache;
  private processingQueue: PQueue;
  private options: ProcessingOptions;
  private metrics: ProcessingMetrics;
  private latencyHistory: number[] = [];
  private isProviderInitialized = false;
  private requestContext?: LlamaCppRequestContext;

  constructor(options?: Partial<ProcessingOptions> & { context?: LlamaCppRequestContext }) {
    super();
    
    this.llamaProvider = new LlamaCppHttpProvider('http://localhost:8081');
    this.cache = new EmailAnalysisCache({ maxSize: 5000, ttl: 7200000 }); // 2 hour TTL
    
    // Extract context for request identification
    this.requestContext = options?.context;
    const cleanOptions = { ...options };
    delete cleanOptions.context;
    
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
      ...cleanOptions
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
    const concurrency = this.options?.concurrency ?? 20;
    const queueConfig = {
      concurrency,
      interval: 50, // Process every 50ms
      intervalCap: Math.floor(concurrency * 0.8), // 80% of concurrency
      timeout: 30000, // 30 second timeout per email
      throwOnTimeout: false
    };

    return new PQueue(queueConfig);
  }

  /**
   * Apply mode-specific optimizations
   */
  private applyModeOptimizations(): void {
    const mode = this.options?.mode ?? "balanced";
    switch (mode) {
      case "speed":
        // Maximum speed - sacrifice some quality
        this.options.useSmallModels = true;
        this.options.skipPhase3 = true;
        this.options.phase2Timeout = 3000;
        this.options.minConfidence = 0.5;
        this.options.maxRetries = 0;
        
        // Speed mode configuration applied
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
        
        // Quality mode configuration applied
        logger.info("Configured for QUALITY mode", "OPTIMIZED_PROCESSOR");
        break;
        
      case "balanced":
      default:
        // Balanced mode configuration applied
        logger.info("Configured for BALANCED mode", "OPTIMIZED_PROCESSOR");
        break;
    }
  }

  /**
   * Process emails with optimizations
   */
  async processEmails(emails: EmailInput[]): Promise<void> {
    const startTime = performance.now();
    const emailCount = emails?.length ?? 0;
    
    this.metrics.totalEmails = emailCount;
    
    logger.info(`Starting optimized processing of ${emailCount} emails`, "OPTIMIZED_PROCESSOR", {
      mode: this.options?.mode,
      concurrency: this.options?.concurrency,
      batchSize: this.options?.batchSize
    });

    // Emit start event
    this.emit("processing:start", { total: emailCount });

    // Process in batches for better throughput
    const batchSize = this.options?.batchSize ?? 10;
    const batches = this.createBatches(emails, batchSize);
    const batchCount = batches?.length ?? 0;
    
    for (let i = 0; i < batchCount; i++) {
      const batch = batches?.[i];
      if (!batch) continue;
      
      const batchPromises = batch.map(email => 
        this.processingQueue?.add(() => this.processEmail(email))
      ).filter(Boolean);

      // Wait for batch to complete
      await Promise.allSettled(batchPromises);

      // Emit progress
      const processed = Math.min((i + 1) * batchSize, emailCount);
      this.emit("processing:progress", {
        processed,
        total: emailCount,
        percentage: emailCount > 0 ? (processed / emailCount) * 100 : 0
      });

      // Brief pause between batches to prevent overload
      if (i < batchCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate final metrics
    const totalTime = performance.now() - startTime;
    const processedEmails = this.metrics?.processedEmails ?? 0;
    
    this.metrics.throughput = totalTime > 0 ? (processedEmails / totalTime) * 1000 : 0;

    logger.info("Processing complete", "OPTIMIZED_PROCESSOR", {
      totalEmails: this.metrics?.totalEmails,
      successful: this.metrics?.successfulEmails,
      failed: this.metrics?.failedEmails,
      cacheHits: this.metrics?.cacheHits,
      throughput: `${this.metrics?.throughput?.toFixed(2) ?? '0.00'} emails/second`,
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
      if (this?.options?.enableCache) {
        const cached = this?.cache?.get(email.id);
        if (cached) {
          if (this.metrics.cacheHits) { this.metrics.cacheHits++ };
          if (this.metrics.successfulEmails) { this.metrics.successfulEmails++ };
          if (this.metrics.processedEmails) { this.metrics.processedEmails++ };
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
      if (this?.options?.cacheOnly) {
        if (this.metrics.failedEmails) { this.metrics.failedEmails++ };
        if (this.metrics.processedEmails) { this.metrics.processedEmails++ };
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
        this.cache?.set(email.id, phase1Results);
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
      const skipPhase3 = this.options?.skipPhase3 ?? false;
      if (skipPhase3 || this.shouldSkipPhase3(phase2Results)) {
        this.cache?.set(email.id, phase2Results);
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
      this.cache?.set(email.id, phase3Results);
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
    const useSmallModels = this.options?.useSmallModels ?? false;
    const model = useSmallModels ? "qwen3:0.6b" : "llama3.2:3b";
    
    const prompt = this.buildOptimizedPrompt(email, phase1Results);
    
    try {
      const phase2Timeout = this.options?.phase2Timeout ?? 5000;
      const response = await Promise.race([
        this.llamaProvider.generate(prompt, {
          temperature: 0.1,
          maxTokens: 800, // Reduced for speed
          format: "json",
          context: this.requestContext // Pass request context for proper client identification
        }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Phase 2 timeout")), phase2Timeout)
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
      const phase3Timeout = this.options?.phase3Timeout ?? 10000;
      const response = await Promise.race([
        this.llamaProvider.generate(prompt, {
          temperature: 0.2,
          maxTokens: 600, // Reduced for speed
          format: "json",
          context: this.requestContext // Pass request context for proper client identification
        }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error("Phase 3 timeout")), phase3Timeout)
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
    const itemLength = items?.length ?? 0;
    for (let i = 0; i < itemLength; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private shouldSkipPhase2(phase1Results: any, email: EmailInput): boolean {
    // Skip Phase 2 for very simple emails
    return phase1Results.urgency_score < 2 && 
           phase1Results.priority === "low" &&
           Object.values(phase1Results.entities).every((arr: any) => (arr?.length ?? 0) === 0);
  }

  private shouldSkipPhase3(phase2Results: any): boolean {
    // Skip Phase 3 for low-confidence or simple emails
    const minConfidence = this.options?.minConfidence ?? 0.6;
    return phase2Results.confidence < minConfidence ||
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
    this.latencyHistory?.push(latency);
    const historyLength = this.latencyHistory?.length ?? 0;
    if (historyLength > 1000) {
      this.latencyHistory = this.latencyHistory?.slice(-1000) ?? [];
    }
    
    if (historyLength > 0) {
      const sum = this.latencyHistory?.reduce((a: number, b: number) => a + b, 0) ?? 0;
      this.metrics.averageLatency = sum / historyLength;
    }
  }

  private updatePhaseMetrics(phase: string, time: number): void {
    const processedEmails = this.metrics?.processedEmails ?? 0;
    if (processedEmails === 0) return;
    
    switch (phase) {
      case "phase1":
        const phase1Avg = this.metrics?.phase1AvgTime ?? 0;
        this.metrics.phase1AvgTime = (phase1Avg * (processedEmails - 1) + time) / processedEmails;
        break;
      case "phase2":
        const phase2Avg = this.metrics?.phase2AvgTime ?? 0;
        this.metrics.phase2AvgTime = (phase2Avg * (processedEmails - 1) + time) / processedEmails;
        break;
      case "phase3":
        const phase3Avg = this.metrics?.phase3AvgTime ?? 0;
        this.metrics.phase3AvgTime = (phase3Avg * (processedEmails - 1) + time) / processedEmails;
        break;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ProcessingMetrics & { ollamaMetrics: any } {
    return {
      ...this.metrics,
      providerInfo: this.llamaProvider?.getModelInfo ? this.llamaProvider.getModelInfo() : null
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
    await this.processingQueue?.onEmpty();
    if (this.llamaProvider?.cleanup) {
      await this.llamaProvider.cleanup();
    }
    this.removeAllListeners();
  }
}

// Export singleton - no longer takes optimizer parameter
export const optimizedProcessor = new OptimizedEmailProcessor();