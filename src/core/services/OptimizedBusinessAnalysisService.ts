/**
 * OptimizedBusinessAnalysisService - Claude Opus-level Business Intelligence
 * 
 * Integrates BusinessContextManager, ThreadContextManager, and BusinessIntelligencePrompts
 * for optimal email analysis performance at 143k+ email scale
 */

import { Logger } from "../../utils/logger.js";
import { businessContextManager, type BusinessContext, type ContextOptimizationOptions } from "../context/BusinessContextManager.js";
import { threadContextManager, type ThreadContext } from "../context/ThreadContextManager.js";
import { biPromptBuilder, biResponseParser } from "../prompts/BusinessIntelligencePrompts.js";
import { promptOptimizer } from "../prompts/PromptOptimizer.js";
import { EmailAnalysisCache } from "../cache/EmailAnalysisCache.js";
import { EventEmitter } from "events";
import axios from "axios";
import { GroceryNLPQueue } from "../../api/services/GroceryNLPQueue.js";

import type { EmailRecord, AnalysisStatus } from "../../types/EmailTypes.js";
import type { EmailChain } from "../../types/ChainTypes.js";
import type { Phase1Results, Phase2Results, Phase3Results } from "../../types/AnalysisTypes.js";
import { withUnitOfWork, type IUnitOfWork } from "../../database/UnitOfWork.js";

const logger = new Logger("OptimizedBusinessAnalysisService");

// Performance monitoring interfaces
export interface PerformanceMetrics {
  totalProcessed: number;
  averageProcessingTime: number;
  contextOptimizationRate: number;
  tokenEfficiency: number;
  businessInsightQuality: number;
  cacheHitRate: number;
  errorRate: number;
  throughputEmailsPerMinute: number;
}

export interface BatchProcessingOptions {
  batchSize: number;
  maxConcurrency: number;
  prioritizeHighValue: boolean;
  useContextOptimization: boolean;
  enableSmartCaching: boolean;
  performanceTarget: "speed" | "quality" | "balanced";
  modelPreferences: {
    phase2Model: "llama3.2";
    phase3Model: "phi-4";
  };
}

export interface BusinessAnalysisResult {
  emailId: string;
  businessContext: BusinessContext;
  threadContext?: ThreadContext;
  phase2Results?: Phase2Results & { businessIntelligence: any };
  phase3Results?: Phase3Results & { executiveAnalysis: any };
  processingMetrics: {
    totalTime: number;
    contextBuildTime: number;
    analysisTime: number;
    tokenUsage: number;
    qualityScore: number;
  };
}

// Main Service Class
export class OptimizedBusinessAnalysisService extends EventEmitter {
  private analysisCache: EmailAnalysisCache;
  private performanceMetrics: PerformanceMetrics;
  private nlpQueue = GroceryNLPQueue.getInstance();
  private isProcessing: boolean = false;

  constructor() {
    super();
    this.analysisCache = new EmailAnalysisCache({
      maxSize: 5000,
      ttl: 3600000 * 2, // 2 hours TTL for business context
    });
    
    this.performanceMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      contextOptimizationRate: 0,
      tokenEfficiency: 0,
      businessInsightQuality: 0,
      cacheHitRate: 0,
      errorRate: 0,
      throughputEmailsPerMinute: 0
    };
  }

  /**
   * Process single email with Claude Opus-level business intelligence
   */
  async processEmailWithBusinessIntelligence(
    email: EmailRecord,
    chainData?: EmailChain,
    historicalData?: any[],
    options: Partial<ContextOptimizationOptions> = {}
  ): Promise<BusinessAnalysisResult> {
    const startTime = Date.now();
    const cacheKey = `business_analysis:${email.id}`;
    
    logger.info(`Starting optimized business analysis for email ${email.id}`);

    // Check cache first
    const cachedResult = this?.analysisCache?.get(cacheKey);
    if (cachedResult) {
      this.updatePerformanceMetrics({ cacheHit: true, processingTime: 0 });
      return cachedResult as BusinessAnalysisResult;
    }

    return withUnitOfWork(async (uow: IUnitOfWork) => {
      try {
        const contextBuildStart = Date.now();
        
        // Build comprehensive business context
        const businessContext = await businessContextManager.buildBusinessContext(
          email,
          chainData,
          historicalData,
          {
            modelType: "llama3.2",
            priorityLevel: this.determinePriority(email),
            focusAreas: this.determineFocusAreas(email),
            includeHistorical: !!historicalData && historicalData?.length || 0 > 0,
            compressionLevel: "moderate",
            preserveEntities: true,
            includeChainContext: !!chainData,
            ...options
          }
        );

        // Build thread context if chain data available
        let threadContext: ThreadContext | undefined;
        if (chainData) {
          const chainEmails = await uow?.emails?.findByConversationId(chainData.conversation_id);
          threadContext = await threadContextManager.buildThreadContext(
            chainData,
            chainEmails,
            businessContext
          );
        }

        const contextBuildTime = Date.now() - contextBuildStart;
        const analysisStart = Date.now();

        // Phase 1: Rule-based analysis (minimal overhead)
        const phase1Results = await this.runOptimizedPhase1(email);

        // Phase 2: Business Intelligence Analysis with Llama 3.2
        const phase2Results = await this.runOptimizedPhase2(
          email,
          phase1Results,
          businessContext,
          threadContext
        );

        // Phase 3: Executive Strategic Analysis with Phi-4 (only for high-value emails)
        let phase3Results: (Phase3Results & { executiveAnalysis: any }) | undefined;
        if (this.shouldRunPhase3(businessContext, phase2Results)) {
          phase3Results = await this.runOptimizedPhase3(
            email,
            phase1Results,
            phase2Results,
            businessContext,
            threadContext,
            historicalData
          );
        }

        const analysisTime = Date.now() - analysisStart;
        const totalTime = Date.now() - startTime;

        // Calculate quality score
        const qualityScore = this.calculateQualityScore(
          businessContext,
          phase2Results,
          phase3Results
        );

        // Create result
        const result: BusinessAnalysisResult = {
          emailId: email.id,
          businessContext,
          threadContext,
          phase2Results,
          phase3Results,
          processingMetrics: {
            totalTime,
            contextBuildTime,
            analysisTime,
            tokenUsage: businessContext?.tokenUsage?.used,
            qualityScore
          }
        };

        // Cache result
        this?.analysisCache?.set(cacheKey, result);

        // Update performance metrics
        this.updatePerformanceMetrics({
          cacheHit: false,
          processingTime: totalTime,
          tokenUsage: businessContext?.tokenUsage?.used,
          qualityScore
        });

        // Save to database
        await this.saveBusinessAnalysisResults(result, uow);

        logger.info(`Business analysis completed for email ${email.id} in ${totalTime}ms (Quality: ${qualityScore})`);
        
        this.emit('analysis:complete', result);
        return result;

      } catch (error) {
        logger.error(`Business analysis failed for email ${email.id}:`, error as string);
        this.updatePerformanceMetrics({ error: true });
        throw error;
      }
    });
  }

  /**
   * Process emails in optimized batches for high throughput
   */
  async processBatch(
    emails: EmailRecord[],
    options: BatchProcessingOptions = this.getDefaultBatchOptions()
  ): Promise<BusinessAnalysisResult[]> {
    if (this.isProcessing) {
      throw new Error("Batch processing already in progress");
    }

    this.isProcessing = true;
    const batchStartTime = Date.now();
    const results: BusinessAnalysisResult[] = [];

    try {
      logger.info(`Starting batch processing of ${emails?.length || 0} emails`);
      this.emit('batch:start', { emailCount: emails?.length || 0, options });

      // Sort emails by priority for optimal processing order
      const sortedEmails = this.prioritizeEmails(emails, options);
      
      // Process in chunks
      const chunks = this.createProcessingChunks(sortedEmails, options.batchSize);
      
      for (let i = 0; i < chunks?.length || 0; i++) {
        const chunk = chunks[i];
        logger.info(`Processing chunk ${i + 1}/${chunks?.length || 0} (${chunk?.length || 0} emails)`);
        
        // Process chunk with controlled concurrency
        const chunkResults = await this.processChunkConcurrently(chunk, options);
        results.push(...chunkResults);
        
        // Emit progress
        this.emit('batch:progress', {
          processedCount: results?.length || 0,
          totalCount: emails?.length || 0,
          currentChunk: i + 1,
          totalChunks: chunks?.length || 0
        });

        // Brief pause between chunks to prevent overwhelming
        if (i < chunks?.length || 0 - 1) {
          await this.sleep(100);
        }
      }

      const batchTime = Date.now() - batchStartTime;
      const throughput = (emails?.length || 0 / batchTime) * 60000; // emails per minute

      logger.info(`Batch processing completed: ${emails?.length || 0} emails in ${batchTime}ms (${throughput.toFixed(1)} emails/min)`);
      
      // Update throughput metrics
      this?.performanceMetrics?.throughputEmailsPerMinute = throughput;
      
      this.emit('batch:complete', {
        processedCount: results?.length || 0,
        totalTime: batchTime,
        throughput,
        metrics: this.performanceMetrics
      });

      return results;

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.performanceMetrics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      contextOptimizationRate: 0,
      tokenEfficiency: 0,
      businessInsightQuality: 0,
      cacheHitRate: 0,
      errorRate: 0,
      throughputEmailsPerMinute: 0
    };
  }

  // Private methods for optimized processing

  private async runOptimizedPhase1(email: EmailRecord): Promise<Phase1Results> {
    // Lightweight rule-based extraction optimized for speed
    const startTime = Date.now();
    
    const emailText = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    
    // Extract entities with high-performance regex patterns
    const entities = {
      po_numbers: this.extractPattern(emailText, /\b(?:po|p\.o\.?|purchase\s+order)[\s#-]?(\d{4,})/gi),
      quote_numbers: this.extractPattern(emailText, /\b(?:quote|qt|quotation)[\s#-]?(\d{4,})/gi),
      dollar_amounts: this.extractDollarAmounts(emailText),
      part_numbers: this.extractPattern(emailText, /\b[A-Z0-9]{6,}(?:#[A-Z]{3})?\b/gi),
      case_numbers: this.extractPattern(emailText, /\b(?:case|ticket|incident)[\s#-]?(\w+\d+|\d+\w*)/gi)
    };

    // Fast classification
    const classification = {
      type: this.fastClassifyEmailType(emailText),
      priority: this.fastAssessPriority(email, entities),
      urgency: this.hasUrgencyIndicators(emailText),
      requires_response: this.requiresResponse(emailText)
    };

    // Calculate financial impact
    const financialImpact = entities?.dollar_amounts?.reduce((sum: any, amount: any) => sum + amount, 0);

    return {
      basic_classification: classification,
      entities,
      key_phrases: this.extractKeyPhrases(emailText, 10),
      sentiment: this.fastSentimentAnalysis(emailText),
      processing_time_ms: Date.now() - startTime,
      workflow_state: this.determineWorkflowState(emailText),
      priority: classification.priority,
      financial_impact: financialImpact,
      detected_patterns: this.detectPatterns(emailText),
      chain_analysis: undefined // Will be set by chain analyzer if needed
    };
  }

  private async runOptimizedPhase2(
    email: EmailRecord,
    phase1Results: Phase1Results,
    businessContext: BusinessContext,
    threadContext?: ThreadContext
  ): Promise<Phase2Results & { businessIntelligence: any }> {
    const startTime = Date.now();

    try {
      // Build optimized context for Phase 2
      const contextString = await businessContextManager.buildPhase2Context(
        email,
        phase1Results,
        threadContext?.chainId ? 
          await threadContextManager.getExistingContext(threadContext.chainId) :
          undefined
      );

      // Build business intelligence prompt
      const prompt = biPromptBuilder.buildPhase2Prompt(
        businessContext,
        phase1Results,
        `${email.subject}\n${email.body_text || ''}`,
        businessContext.financialContext ? ["financial", "workflow"] : ["workflow"]
      );

      // Call Llama 3.2 with optimized parameters
      const llmResponse = await this.callLLMOptimized("llama3.2", prompt, {
        temperature: 0.2,
        max_tokens: 1500,
        top_p: 0.9
      });

      // Parse business intelligence response
      const businessIntelligence = biResponseParser.parsePhase2Response(llmResponse);

      // Create enhanced Phase 2 results
      const enhanced: Phase2Results & { businessIntelligence: any } = {
        ...phase1Results,
        enhanced_classification: {
          primary_intent: businessIntelligence.business_intelligence?.operational_insights?.workflow_bottlenecks?.length > 0 ? 
            "process_optimization" : phase1Results?.basic_classification?.type,
          secondary_intents: [],
          confidence: businessIntelligence.confidence_score || 0.8
        },
        missed_entities: this.extractMissedEntities(businessIntelligence),
        action_items: businessIntelligence.business_intelligence?.strategic_recommendations?.immediate_actions || [],
        contextual_insights: {
          business_impact: businessIntelligence.business_intelligence?.financial_impact?.revenue_opportunity || "standard",
          recommended_actions: businessIntelligence.business_intelligence?.strategic_recommendations?.immediate_actions?.map((a: any) => a.action) || [],
          risk_level: businessIntelligence.risk_assessment?.business_risks?.length > 0 ? "medium" : "low"
        },
        processing_time_ms: Date.now() - startTime,
        businessIntelligence
      };

      return enhanced;

    } catch (error) {
      logger.error("Phase 2 analysis failed, using fallback:", error);
      
      // Return fallback results
      return {
        ...phase1Results,
        enhanced_classification: {
          primary_intent: phase1Results?.basic_classification?.type,
          secondary_intents: [],
          confidence: 0.5
        },
        missed_entities: {},
        action_items: [],
        contextual_insights: {
          business_impact: "unknown",
          recommended_actions: [],
          risk_level: "medium"
        },
        processing_time_ms: Date.now() - startTime,
        businessIntelligence: {
          business_intelligence: {
            financial_impact: { revenue_opportunity: "Analysis failed" },
            operational_insights: { workflow_bottlenecks: [] },
            customer_intelligence: { satisfaction_level: "unknown" },
            strategic_recommendations: { immediate_actions: [] }
          },
          risk_assessment: { business_risks: ["Analysis incomplete"] },
          confidence_score: 0.3,
          data_quality: "low"
        }
      };
    }
  }

  private async runOptimizedPhase3(
    email: EmailRecord,
    phase1Results: Phase1Results,
    phase2Results: Phase2Results & { businessIntelligence: any },
    businessContext: BusinessContext,
    threadContext?: ThreadContext,
    historicalData?: any[]
  ): Promise<Phase3Results & { executiveAnalysis: any }> {
    const startTime = Date.now();

    try {
      // Build comprehensive context for Phase 3
      const contextString = await businessContextManager.buildPhase3Context(
        email,
        phase1Results,
        phase2Results,
        threadContext?.chainId ?
          await threadContextManager.getExistingContext(threadContext.chainId) :
          undefined,
        historicalData
      );

      // Build executive analysis prompt
      const prompt = biPromptBuilder.buildPhase3Prompt(
        businessContext,
        phase1Results,
        phase2Results,
        threadContext ? await threadContextManager.generateLLMContext(threadContext.chainId, "phase3", 4000) : undefined,
        historicalData
      );

      // Call Phi-4 with strategic analysis parameters
      const llmResponse = await this.callLLMOptimized("phi-4", prompt, {
        temperature: 0.3,
        max_tokens: 3000,
        top_p: 0.85
      });

      // Parse executive analysis response
      const executiveAnalysis = biResponseParser.parsePhase3Response(llmResponse);

      // Create comprehensive Phase 3 results
      const strategic: Phase3Results & { executiveAnalysis: any } = {
        ...phase2Results,
        strategic_analysis: {
          workflow_position: executiveAnalysis.strategic_intelligence?.operational_excellence?.process_optimization_value || "unknown",
          chain_completeness: threadContext?.contextSummary.confidenceLevel || 0.5,
          bottlenecks: executiveAnalysis.strategic_intelligence?.operational_excellence?.efficiency_gains || [],
          optimization_opportunities: executiveAnalysis.strategic_intelligence?.operational_excellence?.cost_reduction_opportunities || []
        },
        pattern_recognition: {
          similar_chains: executiveAnalysis.predictive_analytics?.trend_analysis?.similar_patterns || [],
          typical_resolution_time: 48,
          success_probability: executiveAnalysis.predictive_analytics?.outcome_probability?.successful_closure || 0.7
        },
        predictive_insights: {
          next_likely_action: executiveAnalysis.executive_recommendations?.strategic_decisions?.[0]?.decision || "continue monitoring",
          estimated_completion: executiveAnalysis.predictive_analytics?.forecasting?.timeline_estimate || "unknown",
          potential_escalations: executiveAnalysis.governance?.escalation_path || []
        },
        roi_analysis: {
          time_saved: this.extractTimeValue(executiveAnalysis.strategic_intelligence?.operational_excellence?.process_optimization_value),
          efficiency_gain: this.extractEfficiencyGain(executiveAnalysis.strategic_intelligence?.operational_excellence?.efficiency_gains),
          automation_potential: this.extractAutomationPotential(executiveAnalysis.strategic_intelligence?.operational_excellence?.cost_reduction_opportunities)
        },
        processing_time_ms: Date.now() - startTime,
        executiveAnalysis
      };

      return strategic;

    } catch (error) {
      logger.error("Phase 3 analysis failed, using fallback:", error);
      
      // Return fallback strategic results
      return {
        ...phase2Results,
        strategic_analysis: {
          workflow_position: "unknown",
          chain_completeness: 0,
          bottlenecks: [],
          optimization_opportunities: []
        },
        pattern_recognition: {
          similar_chains: [],
          typical_resolution_time: 48,
          success_probability: 0.5
        },
        predictive_insights: {
          next_likely_action: "manual review required",
          estimated_completion: "unknown",
          potential_escalations: []
        },
        roi_analysis: {
          time_saved: 0,
          efficiency_gain: 0,
          automation_potential: 0
        },
        processing_time_ms: Date.now() - startTime,
        executiveAnalysis: {
          executive_summary: {
            strategic_overview: "Analysis incomplete - manual review required",
            key_business_driver: "Unknown",
            decision_urgency: "long_term",
            executive_attention_required: false
          }
        }
      };
    }
  }

  // Utility methods for optimization

  private async callLLMOptimized(model: string, prompt: string, options: any): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Use NLP queue to prevent bottlenecks from concurrent Ollama requests
      const responseData = await this?.nlpQueue?.enqueue(
        async () => {
          const response = await axios.post("http://localhost:11434/api/generate", {
            model,
            prompt,
            stream: false,
            options: {
              ...options,
              num_predict: options.max_tokens,
              repeat_penalty: 1.1,
              top_k: 40
            }
          }, {
            timeout: 60000, // 60 second timeout
            headers: {
              'Content-Type': 'application/json'
            }
          });

          return response?.data?.response;
        },
        "normal", // priority
        60000, // timeout
        `business-analysis-${model}-${prompt.substring(0, 50)}`, // query for deduplication
        { model, service: "OptimizedBusinessAnalysisService" } // metadata
      );

      const processingTime = Date.now() - startTime;
      
      // Log performance
      logger.debug(`LLM call to ${model} completed in ${processingTime}ms`);
      
      return responseData;
    } catch (error) {
      logger.error(`LLM call to ${model} failed:`, error as string);
      throw error;
    }
  }

  private shouldRunPhase3(
    businessContext: BusinessContext,
    phase2Results: Phase2Results & { businessIntelligence: any }
  ): boolean {
    // Run Phase 3 for high-value or complex scenarios
    const highValue = businessContext?.financialContext?.totalValue > 25000;
    const highConfidence = phase2Results?.enhanced_classification?.confidence > 0.8;
    const complexWorkflow = phase2Results.businessIntelligence?.business_intelligence?.operational_insights?.workflow_bottlenecks?.length > 0;
    const executiveEscalation = phase2Results.businessIntelligence?.business_intelligence?.strategic_recommendations?.immediate_actions?.some((action: any) => 
      action.priority === "high" || action.priority === "critical"
    );

    return highValue || (highConfidence && (complexWorkflow || executiveEscalation));
  }

  private calculateQualityScore(
    businessContext: BusinessContext,
    phase2Results: Phase2Results & { businessIntelligence: any },
    phase3Results?: Phase3Results & { executiveAnalysis: any }
  ): number {
    let qualityScore = 0;
    
    // Business context quality (0-0.3)
    qualityScore += businessContext.confidence * 0.3;
    
    // Phase 2 results quality (0-0.4)
    const phase2Quality = phase2Results.businessIntelligence?.confidence_score || 0.5;
    qualityScore += phase2Quality * 0.4;
    
    // Phase 3 results quality (0-0.3)
    if (phase3Results) {
      const phase3Quality = phase3Results.executiveAnalysis?.executive_summary?.executive_attention_required ? 0.9 : 0.7;
      qualityScore += phase3Quality * 0.3;
    } else {
      qualityScore += 0.6 * 0.3; // Default quality for skipped Phase 3
    }
    
    return Math.min(1, qualityScore);
  }

  private async processChunkConcurrently(
    emails: EmailRecord[],
    options: BatchProcessingOptions
  ): Promise<BusinessAnalysisResult[]> {
    const semaphore = new Array(options.maxConcurrency).fill(null);
    const results: BusinessAnalysisResult[] = [];
    
    const processEmail = async (email: EmailRecord, index: number): Promise<void> => {
      try {
        const result = await this.processEmailWithBusinessIntelligence(email);
        results[index] = result;
      } catch (error) {
        logger.error(`Failed to process email ${email.id}:`, error as string);
        // Continue processing other emails
      }
    };

    // Process with controlled concurrency
    const promises = emails?.map(async (email, index) => {
      // Wait for available slot
      await new Promise<void>((resolve: any) => {
        const checkSlot = () => {
          const availableIndex = semaphore.findIndex(slot => slot === null);
          if (availableIndex !== -1) {
            semaphore[availableIndex] = true;
            processEmail(email, index).finally(() => {
              semaphore[availableIndex] = null;
              resolve();
            });
          } else {
            setTimeout(checkSlot, 10);
          }
        };
        checkSlot();
      });
    });

    await Promise.all(promises);
    return results?.filter(Boolean); // Remove any null results from errors
  }

  // Additional utility methods...

  private determinePriority(email: EmailRecord): "low" | "medium" | "high" | "critical" | "executive" {
    if (email.importance === "high") return "high";
    
    const text = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    if (/\b(?:urgent|critical|asap|emergency)\b/.test(text)) return "critical";
    if (/\b(?:executive|ceo|president|vp)\b/.test(text)) return "executive";
    if (/\$[\d,]+/.test(text)) return "medium";
    
    return "low";
  }

  private determineFocusAreas(email: EmailRecord): Array<"financial" | "technical" | "relationship" | "temporal" | "workflow"> {
    const text = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    const areas: Array<"financial" | "technical" | "relationship" | "temporal" | "workflow"> = ["workflow"];
    
    if (/\$|cost|price|budget/.test(text)) areas.push("financial");
    if (/technical|api|specs|system/.test(text)) areas.push("technical");
    if (/customer|client|relationship/.test(text)) areas.push("relationship");
    if (/deadline|urgent|timeline/.test(text)) areas.push("temporal");
    
    return areas;
  }

  private prioritizeEmails(emails: EmailRecord[], options: BatchProcessingOptions): EmailRecord[] {
    if (!options.prioritizeHighValue) return emails;
    
    return emails.sort((a, b) => {
      const aPriority = this.getEmailPriorityScore(a);
      const bPriority = this.getEmailPriorityScore(b);
      return bPriority - aPriority;
    });
  }

  private getEmailPriorityScore(email: EmailRecord): number {
    let score = 0;
    
    if (email.importance === "high") score += 10;
    
    const text = `${email.subject} ${email.body_text || ''}`.toLowerCase();
    if (/\b(?:urgent|critical|asap)\b/.test(text)) score += 8;
    if (/\$[\d,]+/.test(text)) score += 5;
    if (/\b(?:po|purchase|order)\b/.test(text)) score += 4;
    if (/\b(?:quote|pricing)\b/.test(text)) score += 3;
    
    return score;
  }

  private createProcessingChunks(emails: EmailRecord[], chunkSize: number): EmailRecord[][] {
    const chunks: EmailRecord[][] = [];
    for (let i = 0; i < emails?.length || 0; i += chunkSize) {
      chunks.push(emails.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private getDefaultBatchOptions(): BatchProcessingOptions {
    return {
      batchSize: 50,
      maxConcurrency: 10,
      prioritizeHighValue: true,
      useContextOptimization: true,
      enableSmartCaching: true,
      performanceTarget: "balanced",
      modelPreferences: {
        phase2Model: "llama3.2",
        phase3Model: "phi-4"
      }
    };
  }

  private updatePerformanceMetrics(update: {
    cacheHit?: boolean;
    processingTime?: number;
    tokenUsage?: number;
    qualityScore?: number;
    error?: boolean;
  }): void {
    if (update.cacheHit !== undefined) {
      this?.performanceMetrics?.cacheHitRate = 
        (this?.performanceMetrics?.cacheHitRate * this?.performanceMetrics?.totalProcessed + (update.cacheHit ? 1 : 0)) /
        (this?.performanceMetrics?.totalProcessed + 1);
    }

    if (update.processingTime !== undefined) {
      this?.performanceMetrics?.averageProcessingTime = 
        (this?.performanceMetrics?.averageProcessingTime * this?.performanceMetrics?.totalProcessed + update.processingTime) /
        (this?.performanceMetrics?.totalProcessed + 1);
    }

    if (update.qualityScore !== undefined) {
      this?.performanceMetrics?.businessInsightQuality = 
        (this?.performanceMetrics?.businessInsightQuality * this?.performanceMetrics?.totalProcessed + update.qualityScore) /
        (this?.performanceMetrics?.totalProcessed + 1);
    }

    if (update.error) {
      this?.performanceMetrics?.errorRate = 
        (this?.performanceMetrics?.errorRate * this?.performanceMetrics?.totalProcessed + 1) /
        (this?.performanceMetrics?.totalProcessed + 1);
    }

    this?.performanceMetrics?.totalProcessed++;
  }

  private async saveBusinessAnalysisResults(result: BusinessAnalysisResult, uow: IUnitOfWork): Promise<void> {
    // This would save the enhanced business analysis results to the database
    // Implementation depends on your specific database schema
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Pattern extraction utilities
  private extractPattern(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern) || [];
    return [...new Set(matches)].slice(0, 10);
  }

  private extractDollarAmounts(text: string): number[] {
    const matches = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
    return matches?.map(match => {
      const num = parseFloat(match.replace(/[$,]/g, ''));
      return isNaN(num) ? 0 : num;
    });
  }

  private fastClassifyEmailType(text: string): string {
    if (/\b(?:quote|pricing|cost)\b/.test(text)) return "quote_request";
    if (/\b(?:order|purchase|po)\b/.test(text)) return "order_processing";
    if (/\b(?:support|issue|problem|help)\b/.test(text)) return "support_ticket";
    if (/\b(?:project|timeline|milestone)\b/.test(text)) return "project_update";
    return "general_inquiry";
  }

  private fastAssessPriority(email: EmailRecord, entities: any): string {
    if (email.importance === "high") return "high";
    if (entities?.po_numbers?.length > 0 || entities?.dollar_amounts?.some((amt: number) => amt > 10000)) return "high";
    if (entities?.quote_numbers?.length > 0 || entities?.case_numbers?.length > 0) return "medium";
    return "low";
  }

  private hasUrgencyIndicators(text: string): boolean {
    return /\b(?:urgent|asap|rush|critical|emergency|immediate)\b/.test(text);
  }

  private requiresResponse(text: string): boolean {
    return /\b(?:please|need|request|help|question|\?)\b/.test(text);
  }

  private extractKeyPhrases(text: string, limit: number): string[] {
    const phrases = text.match(/\b\w+(?:\s+\w+){1,2}\b/g) || [];
    return phrases.slice(0, limit);
  }

  private fastSentimentAnalysis(text: string): "positive" | "negative" | "neutral" {
    const positive = /\b(?:thank|great|excellent|happy|pleased|satisfied|good)\b/.test(text);
    const negative = /\b(?:issue|problem|urgent|complaint|disappointed|frustrated|bad|terrible)\b/.test(text);
    
    if (positive && !negative) return "positive";
    if (negative && !positive) return "negative";
    return "neutral";
  }

  private determineWorkflowState(text: string): string {
    if (/\b(?:quote|pricing)\b/.test(text)) return "quoting";
    if (/\b(?:order|purchase)\b/.test(text)) return "ordering";
    if (/\b(?:delivery|shipping|fulfillment)\b/.test(text)) return "fulfillment";
    if (/\b(?:support|issue)\b/.test(text)) return "support";
    return "inquiry";
  }

  private detectPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    if (/\b(?:urgent|asap|critical)\b/.test(text)) patterns.push("high_urgency");
    if (/\b(?:disappointed|frustrated|complaint)\b/.test(text)) patterns.push("customer_dissatisfaction");
    if (/\$[\d,]+/.test(text)) patterns.push("financial_discussion");
    if (/\b(?:deadline|timeline|schedule)\b/.test(text)) patterns.push("time_sensitive");
    
    return patterns;
  }

  private extractMissedEntities(businessIntelligence: any): any {
    // Extract entities that were missed in Phase 1 but caught by LLM
    return businessIntelligence.business_intelligence?.operational_insights?.resource_constraints || {};
  }

  private extractTimeValue(value: any): number {
    if (!value || typeof value !== 'string') return 0;
    const match = value.match(/(\d+).*(?:hour|hr|day|week|month)/i);
    return match ? parseInt(match[1]) : 0;
  }

  private extractEfficiencyGain(gains: string[] | undefined): number {
    if (!gains || !Array.isArray(gains)) return 0;
    const percentageGains = gains?.map(gain => {
      const match = gain.match(/(\d+)%/);
      return match ? parseInt(match[1]) : 0;
    });
    return Math.max(...percentageGains, 0);
  }

  private extractAutomationPotential(opportunities: string[] | undefined): number {
    if (!opportunities || !Array.isArray(opportunities)) return 0;
    // Simple scoring based on number of automation opportunities
    return Math.min(opportunities?.length || 0 * 0.2, 1);
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    this.removeAllListeners();
    logger.info("OptimizedBusinessAnalysisService shutdown complete");
  }
}

// Export singleton instance
export const optimizedBusinessAnalysisService = new OptimizedBusinessAnalysisService();