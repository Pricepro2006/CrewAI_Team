/**
 * Production-Ready Three-Phase Email Analysis Service V2
 *
 * Refactored to use Repository Pattern instead of direct database access
 *
 * Implements a three-phase approach for maximum quality email analysis:
 * - Phase 1: Rule-based triage (< 1 second)
 * - Phase 2: LLM enhancement with Llama 3.2 (10 seconds)
 * - Phase 3: Strategic analysis with Phi-4 (80 seconds)
 */

import { EventEmitter } from "events";
import axios, { AxiosError } from "axios";
import { Logger } from "../../utils/logger.js";
import { RedisService } from "../../core/cache/RedisService.js";
import { EmailAnalysisCache } from "../../core/cache/EmailAnalysisCache.js";
import { QueryPerformanceMonitor } from "../../api/services/QueryPerformanceMonitor.js";
import { GroceryNLPQueue } from "../../api/services/GroceryNLPQueue.js";
import {
  PHASE2_ENHANCED_PROMPT,
  PHASE3_STRATEGIC_PROMPT,
  enhancePromptForEmailType,
} from "../prompts/ThreePhasePrompts.js";
import type { EmailCharacteristics } from "../prompts/ThreePhasePrompts.js";
import { EmailChainAnalyzer } from "./EmailChainAnalyzer.js";
import { withUnitOfWork, type IUnitOfWork } from "../../database/UnitOfWork.js";
import { AnalysisStatus } from "../../types/EmailTypes.js";
import type { EmailRecord } from "../../types/EmailTypes.js";
import { AnalysisPhase } from "../../types/AnalysisTypes.js";
import type {
  EmailAnalysis,
  Phase1Results,
  Phase2Results,
  Phase3Results,
} from "../../types/AnalysisTypes.js";
import type { EmailChain, ChainEntity } from "../../types/ChainTypes.js";

const logger = Logger.getInstance();

// ============================================
// TYPE DEFINITIONS
// ============================================

interface EmailInput {
  id: string;
  message_id?: string;
  subject: string;
  body?: string;
  body_preview?: string;
  sender_email: string;
  sender_name?: string;
  recipient_emails: string;
  received_at: string;
  importance?: string;
  has_attachments?: boolean;
  thread_emails?: EmailRecord[];
}

interface AnalysisOptions {
  skipCache?: boolean;
  priority?: "low" | "medium" | "high" | "critical";
  timeout?: number;
  forceAllPhases?: boolean; // Force Phase 3 even for incomplete chains
  includeWorkflowAnalysis?: boolean;
}

interface AnalysisStats {
  total_analyzed: number;
  avg_processing_time: number;
  avg_confidence: number;
  critical_count: number;
  escalated_count: number;
  models_used: number;
}

// ============================================
// SERVICE CLASS
// ============================================

export class EmailThreePhaseAnalysisServiceV2 extends EventEmitter {
  private redisService: RedisService;
  private performanceMonitor: QueryPerformanceMonitor;
  private phase1Cache: Map<string, Phase1Results> = new Map();
  private analysisCache: EmailAnalysisCache;
  private chainAnalyzer: EmailChainAnalyzer;
  private nlpQueue = GroceryNLPQueue.getInstance();

  constructor(redisUrl?: string) {
    super();
    this.redisService = new RedisService(
      redisUrl
        ? {
            host: redisUrl.split("://")[1]?.split(":")[0] || "localhost",
            port: parseInt(redisUrl.split(":").pop() || "6379"),
          }
        : undefined,
    );
    this.performanceMonitor = new QueryPerformanceMonitor();
    this.analysisCache = new EmailAnalysisCache({
      maxSize: 2000,
      ttl: 3600000,
    }); // 1 hour TTL
    this.chainAnalyzer = new EmailChainAnalyzer();
  }

  /**
   * Analyze email using adaptive phase approach with repository pattern
   */
  async analyzeEmail(
    email: EmailInput,
    options: AnalysisOptions = {},
  ): Promise<Phase3Results | Phase2Results> {
    const startTime = Date.now();
    logger.info(
      `Starting analysis for email: ${email.subject?.substring(0, 50)}...`,
    );

    return withUnitOfWork(async (uow: IUnitOfWork) => {
      try {
        // Check if already analyzed
        const existingAnalysis = await uow?.analyses?.findByEmailId(email.id);
        if (existingAnalysis && !options.skipCache) {
          logger.info(`Found existing analysis for email ${email.id}`);
          return this.reconstructResults(existingAnalysis);
        }

        // Update email status to analyzing
        await uow?.emails?.updateAnalysisStatus(
          email.id,
          AnalysisStatus.ANALYZING,
        );

        // Phase 1: Rule-based triage with chain analysis
        this.emit("phase:start", { phase: 1, email: email.id });
        const phase1Results = await this.runPhase1(email, options);
        this.emit("phase:complete", { phase: 1, results: phase1Results });
        logger.info(
          `Phase 1 complete in ${phase1Results.processing_time_ms}ms`,
        );

        // Check chain completeness
        const isCompleteChain =
          phase1Results?.basic_classification?.requires_response || false;
        const chainAnalysis = await this.performChainAnalysis(email, uow);

        logger.info(
          `Chain analysis: Complete=${chainAnalysis?.is_complete}, Score=${chainAnalysis?.completeness_score}`,
        );

        // Phase 2: LLM enhancement
        this.emit("phase:start", { phase: 2, email: email.id });
        const phase2Results = await this.runPhase2(
          email,
          phase1Results,
          options,
        );
        this.emit("phase:complete", { phase: 2, results: phase2Results });
        logger.info(
          `Phase 2 complete in ${phase2Results.processing_time_ms}ms`,
        );

        // Phase 3: Strategic analysis (only for complete chains)
        let finalResults: Phase3Results | Phase2Results;

        if (
          (chainAnalysis?.is_complete &&
            chainAnalysis.completeness_score > 70) ||
          options.forceAllPhases
        ) {
          logger.info("Running Phase 3 for complete chain analysis");
          this.emit("phase:start", { phase: 3, email: email.id });
          const phase3Results = await this.runPhase3(
            email,
            phase1Results,
            phase2Results,
            options,
          );
          this.emit("phase:complete", { phase: 3, results: phase3Results });
          logger.info(
            `Phase 3 complete in ${phase3Results.processing_time_ms}ms`,
          );
          finalResults = phase3Results;
        } else {
          logger.info(
            `Skipping Phase 3 - incomplete chain (score: ${chainAnalysis?.completeness_score || 0})`,
          );
          finalResults = phase2Results;
        }

        // Save analysis using repository
        await this.saveAnalysisWithRepository(
          email,
          finalResults,
          chainAnalysis,
          uow,
        );

        // Update email status
        await uow?.emails?.markAsAnalyzed(email.id, new Date());

        // Track performance
        const totalTime = Date.now() - startTime;
        this?.performanceMonitor?.trackOperation(
          "three_phase_analysis",
          totalTime,
          true,
        );

        const phasesCompleted = Object?.prototype?.hasOwnProperty.call(
          finalResults,
          "strategic_analysis",
        )
          ? 3
          : 2;
        logger.info(
          `${phasesCompleted}-phase analysis complete in ${totalTime}ms`,
        );
        this.emit("analysis:complete", {
          email: email.id,
          results: finalResults,
          totalTime,
          phases: phasesCompleted,
        });

        return finalResults;
      } catch (error) {
        // Update email status to failed
        await uow?.emails?.updateAnalysisStatus(
          email.id,
          AnalysisStatus.FAILED,
          error instanceof Error ? error.message : "Unknown error",
        );

        logger.error("Email analysis failed", error instanceof Error ? error.message : String(error));
        this.emit("analysis:error", { email: email.id, error });
        throw error;
      }
    });
  }

  /**
   * Perform chain analysis using repository
   */
  private async performChainAnalysis(
    email: EmailInput,
    uow: IUnitOfWork,
  ): Promise<EmailChain | null> {
    try {
      // Get conversation emails if available
      let conversationEmails: EmailRecord[] = [];

      if (email.thread_emails) {
        conversationEmails = email.thread_emails;
      } else if (email.message_id) {
        const emailRecord = await uow?.emails?.findByMessageId(email.message_id);
        if (emailRecord?.conversation_id) {
          conversationEmails = await uow?.emails?.findByConversationId(
            emailRecord.conversation_id,
          );
        }
      }

      if (conversationEmails?.length || 0 === 0) {
        return null;
      }

      // Analyze chain
      const chainAnalysis = await this?.chainAnalyzer?.analyzeChain(email.id);

      // Create or update chain in repository
      const chain: Omit<EmailChain, "id"> = {
        chain_id: chainAnalysis.chain_id,
        conversation_id: email.id,
        email_ids: conversationEmails?.map((e: any) => e.id),
        email_count: conversationEmails?.length || 0,
        chain_type: chainAnalysis.chain_type as any,
        completeness_score: chainAnalysis.completeness_score,
        is_complete: chainAnalysis.is_complete,
        missing_stages: [],
        start_time: conversationEmails && conversationEmails.length > 0 && conversationEmails[0]
          ? new Date(conversationEmails[0].received_time)
          : new Date(),
        end_time: conversationEmails && conversationEmails.length > 0
          ? new Date(conversationEmails[conversationEmails.length - 1]?.received_time || new Date())
          : new Date(),
        duration_hours: 0, // Calculate from times
        participants: Array.from(
          new Set(conversationEmails?.map((e: any) => e.from_address)),
        ),
        key_entities: this.extractChainEntities(chainAnalysis),
        workflow_state: chainAnalysis.workflow_states?.[0] || "unknown",
        created_at: new Date(),
      };

      // Calculate duration
      chain.duration_hours = chain?.end_time && chain?.start_time
        ? (chain.end_time.getTime() - chain.start_time.getTime()) / (1000 * 60 * 60)
        : 0;

      return await uow?.chains?.upsert(chain as EmailChain);
    } catch (error) {
      logger.error("Chain analysis failed", error as string);
      return null;
    }
  }

  /**
   * Save analysis results using repository pattern
   */
  private async saveAnalysisWithRepository(
    email: EmailInput,
    results: Phase2Results | Phase3Results,
    chain: EmailChain | null,
    uow: IUnitOfWork,
  ): Promise<void> {
    const phases_completed: AnalysisPhase[] = [
      AnalysisPhase.PHASE_1,
      AnalysisPhase.PHASE_2,
    ];
    if ("strategic_analysis" in results) {
      phases_completed.push(AnalysisPhase.PHASE_3);
    }

    const totalProcessingTime =
      (results as any).processing_time_ms ||
      0 + (results as any).phase2_processing_time ||
      0 + ((results as any).phase3_processing_time || 0);

    const analysis: Omit<EmailAnalysis, "id"> = {
      email_id: email.id,
      analysis_version: "2.1.0",
      phase1_results: this.extractPhase1Results(results),
      phase2_results: this.extractPhase2Results(results),
      phase3_results:
        "strategic_analysis" in results
          ? this.extractPhase3Results(results as Phase3Results)
          : undefined,
      final_summary: {
        email_id: email.id,
        overall_priority: (results as Phase2Results).enhanced_classification?.primary_intent || '',
        recommended_actions: (results as Phase2Results).action_items?.map((a: any) => a.task) || [],
        key_insights: (results as Phase2Results).contextual_insights?.recommended_actions || [],
        workflow_recommendations:
          "strategic_analysis" in results
            ? [(results as Phase3Results).predictive_insights?.next_likely_action].filter(Boolean)
            : [],
        confidence_score: (results as Phase2Results).enhanced_classification?.confidence || 0,
      },
      confidence_score: (results as Phase2Results).enhanced_classification?.confidence || 0,
      workflow_type: chain?.chain_type || "unknown",
      chain_id: chain?.id,
      is_complete_chain: chain?.is_complete || false,
      total_processing_time_ms: totalProcessingTime,
      phases_completed,
      created_at: new Date(),
    };

    await uow?.analyses?.create(analysis);

    // Update email with analysis results
    if ("enhanced_classification" in results) {
      const phase2Results = results as Phase2Results;
      await uow?.emails?.updateWorkflowState(
        email.id,
        phase2Results.enhanced_classification?.primary_intent || 'unknown',
        phase2Results.enhanced_classification?.confidence || 0,
      );
    }

    // Store entities
    const entities = this.extractEntities(results);
    for (const entity of entities) {
      await uow?.emails?.create({
        message_id: `entity_${email.id}_${entity.type}_${entity.value}`,
        subject: `Entity: ${entity.type}`,
        body_text: entity.value,
        from_address: "system",
        to_addresses: "system",
        received_time: new Date(),
        has_attachments: false,
        importance: "normal",
        folder: "system" as any,
        status: AnalysisStatus.ANALYZED,
        created_at: new Date(),
      });
    }
  }

  /**
   * Extract Phase 1 results for storage
   */
  private extractPhase1Results(results: any): Phase1Results {
    return {
      basic_classification: results.basic_classification || {
        type: results.enhanced_classification?.primary_intent || "unknown",
        priority:
          results.enhanced_classification?.confidence > 0.8 ? "high" : "medium",
        urgency: results.enhanced_classification?.confidence > 0.9,
        requires_response: true,
      },
      entities: results.entities || {},
      key_phrases: results.key_phrases || [],
      sentiment: "neutral",
      processing_time_ms: results.processing_time_ms || 0,
    };
  }

  /**
   * Extract Phase 2 results for storage
   */
  private extractPhase2Results(results: any): Phase2Results {
    const phase1Results = this.extractPhase1Results(results);
    return {
      ...phase1Results,
      enhanced_classification: results.enhanced_classification,
      missed_entities: results.missed_entities || {
        company_names: [],
        people: [],
        technical_terms: [],
        deadlines: [],
      },
      action_items: results.action_items || [],
      contextual_insights: results.contextual_insights || {
        business_impact: "standard",
        recommended_actions: [],
        risk_level: "low",
      },
      processing_time_ms: results.phase2_processing_time || 0,
    };
  }

  /**
   * Extract Phase 3 results for storage
   */
  private extractPhase3Results(results: Phase3Results): Phase3Results {
    const phase2Results = this.extractPhase2Results(results);
    return {
      ...phase2Results,
      strategic_analysis: results.strategic_analysis,
      pattern_recognition: results.pattern_recognition || {
        similar_chains: [],
        typical_resolution_time: 0,
        success_probability: 0.5,
      },
      predictive_insights: results.predictive_insights || {
        next_likely_action: "continue monitoring",
        estimated_completion: "unknown",
        potential_escalations: [],
      },
      roi_analysis: results.roi_analysis || {
        time_saved: 0,
        efficiency_gain: 0,
        automation_potential: 0,
      },
      processing_time_ms: results.processing_time_ms || 0,
    };
  }

  /**
   * Extract chain entities from chain analysis
   */
  private extractChainEntities(chainAnalysis: any): ChainEntity[] {
    const entities: ChainEntity[] = [];
    const now = new Date();
    
    if (chainAnalysis.key_entities) {
      Object.entries(chainAnalysis.key_entities).forEach(([type, values]) => {
        if (Array.isArray(values)) {
          values.forEach((value: any) => {
            entities.push({
              type,
              value: String(value),
              count: 1,
              first_seen: now,
              last_seen: now,
            });
          });
        }
      });
    }
    
    return entities;
  }

  /**
   * Extract entities from results
   */
  private extractEntities(
    results: any,
  ): Array<{ type: string; value: string }> {
    const entities: Array<{ type: string; value: string }> = [];

    // Extract from phase 1 entities
    if (results.entities) {
      Object.entries(results.entities).forEach(([type, values]) => {
        if (Array.isArray(values)) {
          values.forEach((value: any) => entities.push({ type, value }));
        }
      });
    }

    // Extract from phase 2 missed entities
    if (results.missed_entities) {
      Object.entries(results.missed_entities).forEach(([type, values]) => {
        if (Array.isArray(values)) {
          values.forEach((value: any) =>
            entities.push({ type: `missed_${type}`, value }),
          );
        }
      });
    }

    return entities;
  }

  /**
   * Reconstruct results from stored analysis
   */
  private reconstructResults(
    analysis: EmailAnalysis,
  ): Phase2Results | Phase3Results {
    if (analysis.phase3_results) {
      return {
        ...analysis.phase1_results,
        ...analysis.phase2_results,
        ...analysis.phase3_results,
        enhanced_classification: analysis.phase2_results
          ?.enhanced_classification || {
          primary_intent: analysis.workflow_type,
          secondary_intents: [],
          confidence: analysis.confidence_score,
        },
      } as Phase3Results;
    }

    return {
      ...analysis.phase1_results,
      ...analysis.phase2_results,
      enhanced_classification: analysis.phase2_results
        ?.enhanced_classification || {
        primary_intent: analysis.workflow_type,
        secondary_intents: [],
        confidence: analysis.confidence_score,
      },
    } as Phase2Results;
  }

  /**
   * Run Phase 1 analysis (rule-based)
   */
  private async runPhase1(
    email: EmailInput,
    options: AnalysisOptions,
  ): Promise<Phase1Results> {
    const startTime = Date.now();

    // Extract entities using regex patterns
    const entities = {
      po_numbers: this.extractPattern(email, /\b(PO|P\.O\.|po)[\s#-]?\d{4,}/gi),
      quotes: this.extractPattern(email, /\b(quote|QT|qt)[\s#-]?\d{4,}/gi),
      cases: this.extractPattern(email, /\b(case|CS|cs)[\s#-]?\d{4,}/gi),
      parts: this.extractPattern(email, /\b[A-Z0-9]{6,}(?:#[A-Z]{3})?\b/g),
      people: [],
      companies: [],
    };

    // Basic classification
    const emailText =
      `${email.subject} ${email.body || email.body_preview || ""}`.toLowerCase();
    const type = this.classifyEmailType(emailText);
    const priority = this.calculatePriority(email, entities);

    return {
      basic_classification: {
        type,
        priority,
        urgency: priority === "high" || priority === "critical",
        requires_response: this.requiresResponse(emailText),
      },
      entities,
      key_phrases: this.extractKeyPhrases(emailText),
      sentiment: this.analyzeSentiment(emailText),
      processing_time_ms: Date.now() - startTime,
    };
  }

  /**
   * Run Phase 2 analysis (LLM enhancement)
   */
  private async runPhase2(
    email: EmailInput,
    phase1Results: Phase1Results,
    options: AnalysisOptions,
  ): Promise<Phase2Results> {
    const startTime = Date.now();

    try {
      // Call LLM for enhancement
      const emailCharacteristics: EmailCharacteristics = {
        hasAttachments: false,
        hasLinks: false,
        sentiment: phase1Results?.sentiment || 'neutral',
        urgency: phase1Results?.basic_classification?.urgency ? 'high' : 'normal',
        category: phase1Results?.basic_classification?.type || 'general',
        length: email.body?.length || 0
      };
      const prompt = enhancePromptForEmailType(
        PHASE2_ENHANCED_PROMPT,
        emailCharacteristics,
      );

      const promptString = `${prompt.system}\n\n${prompt.user}`;
      const llmResponse = await this.callLLM("llama3.2", promptString, {
        temperature: 0.3,
      });
      const enhanced = this.parseLLMResponse(llmResponse);

      return {
        ...phase1Results,
        enhanced_classification: {
          primary_intent:
            enhanced.workflow_type || phase1Results?.basic_classification?.type,
          secondary_intents: enhanced.secondary_intents || [],
          confidence: enhanced.confidence || 0.7,
        },
        missed_entities: enhanced.missed_entities || {},
        action_items: enhanced.action_items || [],
        contextual_insights: {
          business_impact: enhanced.business_impact || "standard",
          recommended_actions: enhanced.recommended_actions || [],
          risk_level: enhanced.risk_level || "medium",
        },
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Phase 2 LLM call failed", error as string);

      // Fallback to phase 1 results
      return {
        ...phase1Results,
        enhanced_classification: {
          primary_intent: phase1Results?.basic_classification?.type,
          secondary_intents: [],
          confidence: 0.5,
        },
        missed_entities: {
          company_names: [],
          people: [],
          technical_terms: [],
          deadlines: []
        },
        action_items: [],
        contextual_insights: {
          business_impact: "unknown",
          recommended_actions: [],
          risk_level: "medium",
        },
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Run Phase 3 analysis (strategic insights)
   */
  private async runPhase3(
    email: EmailInput,
    phase1Results: Phase1Results,
    phase2Results: Phase2Results,
    options: AnalysisOptions,
  ): Promise<Phase3Results> {
    const startTime = Date.now();

    try {
      // Call advanced LLM for strategic analysis
      const emailCharacteristics: EmailCharacteristics = {
        hasAttachments: false,
        hasLinks: false,
        sentiment: phase1Results?.sentiment || 'neutral',
        urgency: phase1Results?.basic_classification?.urgency ? 'high' : 'normal',
        category: phase1Results?.basic_classification?.type || 'general',
        length: email.body?.length || 0
      };
      const prompt = enhancePromptForEmailType(
        PHASE3_STRATEGIC_PROMPT,
        emailCharacteristics,
      );

      const promptString = `${prompt.system}\n\n${prompt.user}`;
      const llmResponse = await this.callLLM("phi-4", promptString, {
        temperature: 0.2,
      });
      const strategic = this.parseLLMResponse(llmResponse);

      return {
        ...phase2Results,
        strategic_analysis: {
          workflow_position: strategic.workflow_position || "in-progress",
          chain_completeness: strategic.chain_completeness || 0.5,
          bottlenecks: strategic.bottlenecks || [],
          optimization_opportunities:
            strategic.optimization_opportunities || [],
        },
        pattern_recognition: {
          similar_chains: strategic.similar_patterns || [],
          typical_resolution_time: strategic.typical_resolution_hours || 24,
          success_probability: strategic.success_probability || 0.7,
        },
        predictive_insights: {
          next_likely_action: strategic.next_action || "await response",
          estimated_completion:
            strategic.estimated_completion || "within 48 hours",
          potential_escalations: strategic.escalation_risks || [],
        },
        roi_analysis: {
          time_saved: strategic.time_savings_hours || 0,
          efficiency_gain: strategic.efficiency_percentage || 0,
          automation_potential: strategic.automation_score || 0,
        },
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Phase 3 LLM call failed", error as string);

      // Return phase 2 results with defaults
      return {
        ...phase2Results,
        strategic_analysis: {
          workflow_position: "unknown",
          chain_completeness: 0,
          bottlenecks: [],
          optimization_opportunities: [],
        },
        pattern_recognition: {
          similar_chains: [],
          typical_resolution_time: 48,
          success_probability: 0.5,
        },
        predictive_insights: {
          next_likely_action: "manual review required",
          estimated_completion: "unknown",
          potential_escalations: [],
        },
        roi_analysis: {
          time_saved: 0,
          efficiency_gain: 0,
          automation_potential: 0,
        },
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  // Helper methods...

  private extractPattern(email: EmailInput, pattern: RegExp): string[] {
    const text = `${email.subject} ${email.body || email.body_preview || ""}`;
    const matches = text.match(pattern) || [];
    return Array.from(new Set(matches));
  }

  private classifyEmailType(text: string): string {
    if (text.includes("quote") || text.includes("pricing"))
      return "quote_request";
    if (text.includes("order") || text.includes("purchase"))
      return "order_processing";
    if (text.includes("support") || text.includes("issue"))
      return "support_ticket";
    if (text.includes("project") || text.includes("timeline"))
      return "project_update";
    return "general_inquiry";
  }

  private calculatePriority(email: EmailInput, entities: any): string {
    if (email.importance === "high" || entities?.po_numbers?.length > 0)
      return "high";
    if (entities?.cases?.length > 0) return "medium";
    return "low";
  }

  private requiresResponse(text: string): boolean {
    const responseIndicators = [
      "please",
      "need",
      "urgent",
      "asap",
      "help",
      "request",
      "?",
    ];
    return responseIndicators.some((indicator: any) => text.includes(indicator));
  }

  private extractKeyPhrases(text: string): string[] {
    // Simple key phrase extraction
    const phrases = text.match(/\b\w+\s+\w+\b/g) || [];
    return phrases.slice(0, 10);
  }

  private analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
    const positive = ["thank", "great", "excellent", "happy", "pleased"];
    const negative = [
      "issue",
      "problem",
      "urgent",
      "complaint",
      "disappointed",
    ];

    const posCount = positive?.filter((word: any) => text.includes(word)).length;
    const negCount = negative?.filter((word: any) => text.includes(word)).length;

    if (posCount > negCount) return "positive";
    if (negCount > posCount) return "negative";
    return "neutral";
  }

  private async callLLM(
    model: string,
    prompt: string,
    options: any,
  ): Promise<string> {
    try {
      // Use NLP queue to prevent bottlenecks from concurrent Ollama requests
      const responseData = await this?.nlpQueue?.enqueue(
        async () => {
          const response = await axios.post("http://localhost:11434/api/generate", {
            model,
            prompt,
            stream: false,
            options,
          });
          return response?.data?.response;
        },
        "normal", // default priority
        30000, // default timeout
        `llm-call-${model}-${prompt.substring(0, 50)}`, // query for deduplication
        { model, promptLength: prompt?.length || 0 } // metadata
      );

      return responseData;
    } catch (error) {
      logger.error(`LLM call failed for model ${model}`, error as string);
      throw error;
    }
  }

  private parseLLMResponse(response: string): any {
    try {
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback to text parsing
      return {
        workflow_type: "unknown",
        confidence: 0.5,
        risk_level: "medium",
      };
    } catch (error) {
      logger.error("Failed to parse LLM response", error as string);
      return {};
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // RedisService doesn't have disconnect method, just remove listeners
    this.removeAllListeners();
    logger.info("EmailThreePhaseAnalysisServiceV2 shutdown complete");
  }
}
