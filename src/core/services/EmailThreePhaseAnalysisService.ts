/**
 * Production-Ready Three-Phase Email Analysis Service
 *
 * Implements a three-phase approach for maximum quality email analysis:
 * - Phase 1: Rule-based triage (< 1 second)
 * - Phase 2: LLM enhancement with Llama 3.2 (10 seconds)
 * - Phase 3: Strategic analysis with Phi-4 (80 seconds)
 *
 * ALL emails go through all three phases for highest quality analysis
 */

import axios from "axios";
import { EventEmitter } from "events";
import { Logger } from "../../utils/logger.js";
import { RedisService } from "../../core/cache/RedisService.js";
import { EmailAnalysisCache } from "../../core/cache/EmailAnalysisCache.js";
import { QueryPerformanceMonitor } from "../../api/services/QueryPerformanceMonitor.js";
import {
  PHASE2_ENHANCED_PROMPT,
  PHASE2_RETRY_PROMPT,
  PHASE3_STRATEGIC_PROMPT,
  enhancePromptForEmailType,
} from "../prompts/ThreePhasePrompts.js";
import { EmailChainAnalyzer } from "./EmailChainAnalyzer.js";
import { executeQuery } from "../../database/ConnectionPool.js";

const logger = new Logger("EmailThreePhaseAnalysisService");

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
}

interface Phase1Results {
  workflow_state: string;
  priority: string;
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    part_numbers: string[];
    dollar_amounts: string[];
    dates: string[];
    contacts: string[];
  };
  key_phrases: string[];
  sender_category: string;
  urgency_score: number;
  financial_impact: number;
  processing_time: number;
  detected_patterns: string[];
  chain_analysis?: {
    chain_id: string;
    is_complete_chain: boolean;
    chain_length: number;
    completeness_score: number;
    chain_type: string;
    missing_elements: string[];
  };
}

interface Phase2Results extends Phase1Results {
  workflow_validation: string;
  missed_entities: {
    project_names: string[];
    company_names: string[];
    people: string[];
    products: string[];
    technical_specs: string[];
    locations: string[];
    other_references: string[];
  };
  action_items: Array<{
    task: string;
    owner: string;
    deadline: string;
    revenue_impact?: string;
  }>;
  risk_assessment: string;
  initial_response: string;
  confidence: number;
  business_process: string;
  phase2_processing_time: number;
  extracted_requirements: string[];
}

interface Phase3Results extends Phase2Results {
  strategic_insights: {
    opportunity: string;
    risk: string;
    relationship: string;
  };
  executive_summary: string;
  escalation_needed: boolean;
  revenue_impact: string;
  cross_email_patterns?: string[];
  phase3_processing_time: number;
  workflow_intelligence: {
    predicted_next_steps: string[];
    bottleneck_risks: string[];
    optimization_opportunities: string[];
  };
}

interface AnalysisOptions {
  skipCache?: boolean;
  priority?: "low" | "medium" | "high" | "critical";
  timeout?: number;
  forceAllPhases?: boolean; // Force Phase 3 even for incomplete chains
}

interface AnalysisStats {
  total_analyzed: number;
  avg_processing_time: number;
  avg_confidence: number;
  critical_count: number;
  escalated_count: number;
  models_used: number;
}

interface EmailCharacteristics {
  hasOrderReferences: boolean;
  hasQuoteRequests: boolean;
  isEscalation: boolean;
  isFromKeyCustomer: boolean;
  hasTechnicalIssues: boolean;
  urgencyScore: number;
  financialImpact: number;
}

interface LlamaOptions {
  temperature: number;
  num_predict: number;
  timeout?: number;
  stop?: string[];
}

interface DatabaseAnalysisStats {
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

export class EmailThreePhaseAnalysisService extends EventEmitter {
  private databasePath: string;
  private redisService: RedisService;
  private performanceMonitor: QueryPerformanceMonitor;
  private phase1Cache: Map<string, Phase1Results> = new Map();
  private analysisCache: EmailAnalysisCache;
  private chainAnalyzer: EmailChainAnalyzer;
  private parsingMetrics: {
    totalAttempts: number;
    successfulParses: number;
    retrySuccesses: number;
    fallbackUses: number;
    averageAttempts: number;
  } = {
    totalAttempts: 0,
    successfulParses: 0,
    retrySuccesses: 0,
    fallbackUses: 0,
    averageAttempts: 1,
  };

  constructor(databasePath: string = "./data/crewai.db", redisUrl?: string) {
    super();
    this.databasePath = databasePath;
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
    this.chainAnalyzer = new EmailChainAnalyzer(databasePath);

    // Initialize database tables if needed
    this.initializeTables();
  }

  /**
   * Analyze email using adaptive phase approach
   * Complete chains get all three phases, incomplete chains get Phase 1+2
   */
  async analyzeEmail(
    email: EmailInput,
    options: AnalysisOptions = {},
  ): Promise<Phase3Results | Phase2Results> {
    const startTime = Date.now();
    logger.info(
      `Starting analysis for email: ${email.subject?.substring(0, 50)}...`,
    );

    try {
      // Phase 1: Rule-based triage with chain analysis (always run)
      this.emit("phase:start", { phase: 1, email: email.id });
      const phase1Results = await this.runPhase1(email, options);
      this.emit("phase:complete", { phase: 1, results: phase1Results });
      logger.info(`Phase 1 complete in ${phase1Results.processing_time}ms`);

      // Check chain completeness
      const isCompleteChain =
        phase1Results.chain_analysis?.is_complete_chain || false;
      const chainScore = phase1Results.chain_analysis?.completeness_score || 0;

      logger.info(
        `Chain analysis: Complete=${isCompleteChain}, Score=${chainScore}, Type=${phase1Results.chain_analysis?.chain_type}`,
      );

      // Phase 2: LLM enhancement (always run)
      this.emit("phase:start", { phase: 2, email: email.id });
      const phase2Results = await this.runPhase2(email, phase1Results, options);
      this.emit("phase:complete", { phase: 2, results: phase2Results });
      logger.info(
        `Phase 2 complete in ${phase2Results.phase2_processing_time}ms`,
      );

      // Phase 3: Strategic analysis (only for complete chains)
      if (isCompleteChain || options.forceAllPhases) {
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
          `Phase 3 complete in ${phase3Results.phase3_processing_time}ms`,
        );

        // Save complete analysis
        await this.saveAnalysis(email, phase3Results as Phase3Results);

        // Track performance
        const totalTime = Date.now() - startTime;
        this.performanceMonitor.trackOperation(
          "three_phase_analysis",
          totalTime,
          true,
        );

        logger.info(
          `Three-phase analysis complete in ${totalTime}ms for complete chain`,
        );
        this.emit("analysis:complete", {
          email: email.id,
          results: phase3Results,
          totalTime,
          phases: 3,
        });

        return phase3Results;
      } else {
        logger.info(
          `Skipping Phase 3 - incomplete chain (score: ${chainScore})`,
        );

        // Create Phase 2 results with strategic defaults
        const phase2WithDefaults: Phase3Results = {
          ...phase2Results,
          strategic_insights: {
            opportunity:
              "Incomplete chain - limited strategic analysis available",
            risk: "Cannot assess full risk without complete workflow",
            relationship: "Standard processing",
          },
          executive_summary:
            phase2Results.risk_assessment ||
            "Incomplete email chain - standard processing recommended",
          escalation_needed: phase2Results.priority === "critical",
          revenue_impact: `$${phase1Results.financial_impact}`,
          cross_email_patterns: [],
          phase3_processing_time: 0,
          workflow_intelligence: {
            predicted_next_steps: [
              "Await additional correspondence for complete analysis",
            ],
            bottleneck_risks: ["Incomplete information may delay processing"],
            optimization_opportunities: [
              "Complete email chain needed for workflow optimization",
            ],
          },
        };

        // Save analysis
        await this.saveAnalysis(email, phase2WithDefaults);

        // Track performance
        const totalTime = Date.now() - startTime;
        this.performanceMonitor.trackOperation(
          "two_phase_analysis",
          totalTime,
          true,
        );

        logger.info(
          `Two-phase analysis complete in ${totalTime}ms for incomplete chain`,
        );
        this.emit("analysis:complete", {
          email: email.id,
          results: phase2WithDefaults,
          totalTime,
          phases: 2,
        });

        return phase2WithDefaults;
      }
    } catch (error) {
      logger.error("Email analysis failed:", error);
      this.performanceMonitor.trackOperation(
        "email_analysis",
        Date.now() - startTime,
        false,
      );
      this.emit("analysis:error", { email: email.id, error });
      throw error;
    }
  }

  /**
   * Phase 1: Rule-based triage
   */
  private async runPhase1(
    email: EmailInput,
    options: AnalysisOptions,
  ): Promise<Phase1Results> {
    const startTime = Date.now();

    // Check cache first
    if (!options.skipCache && this.phase1Cache.has(email.id)) {
      logger.debug("Phase 1 cache hit");
      return this.phase1Cache.get(email.id)!;
    }

    const subject = (email.subject || "").toLowerCase();
    const body = (email.body || email.body_preview || "").toLowerCase();
    const content = subject + " " + body;

    // Extract entities
    const entities = {
      po_numbers: this.extractPONumbers(content),
      quote_numbers: this.extractQuoteNumbers(content),
      case_numbers: this.extractCaseNumbers(content),
      part_numbers: this.extractPartNumbers(content),
      dollar_amounts: this.extractDollarAmounts(content),
      dates: this.extractDates(content),
      contacts: this.extractContacts(content),
    };

    // Detect workflow state
    const workflow_state = this.detectWorkflowState(content);

    // Calculate priority and urgency
    const urgency_score = this.calculateUrgencyScore(content, email);
    const priority = this.calculatePriority(urgency_score, email, entities);

    // Extract key phrases
    const key_phrases = this.extractKeyPhrases(content);

    // Categorize sender
    const sender_category = this.categorizeSender(email.sender_email);

    // Calculate financial impact
    const financial_impact = this.calculateFinancialImpact(
      entities.dollar_amounts,
    );

    // Detect patterns
    const detected_patterns = this.detectPatterns(content, entities);

    // Analyze email chain
    let chainAnalysis;
    try {
      const chain = await this.chainAnalyzer.analyzeChain(email.id);
      chainAnalysis = {
        chain_id: chain.chain_id,
        is_complete_chain: chain.is_complete,
        chain_length: chain.chain_length,
        completeness_score: chain.completeness_score,
        chain_type: chain.chain_type,
        missing_elements: chain.missing_elements,
      };
    } catch (error) {
      logger.debug(`Chain analysis failed for ${email.id}:`, error);
      // Continue without chain analysis
    }

    const results: Phase1Results = {
      workflow_state,
      priority,
      entities,
      key_phrases,
      sender_category,
      urgency_score,
      financial_impact,
      processing_time: Date.now() - startTime,
      detected_patterns,
      chain_analysis: chainAnalysis,
    };

    // Cache results
    this.phase1Cache.set(email.id, results);

    return results;
  }

  /**
   * Phase 2: LLM Enhancement with retry logic and improved error handling
   */
  private async runPhase2(
    email: EmailInput,
    phase1Results: Phase1Results,
    options: AnalysisOptions,
  ): Promise<Phase2Results> {
    const startTime = Date.now();
    const maxRetries = 2;
    let lastError: Error | null = null;

    // Determine email characteristics for prompt enhancement
    const emailCharacteristics = {
      hasOrderReferences: phase1Results.entities.po_numbers.length > 0,
      hasQuoteRequests: phase1Results.workflow_state.includes("QUOTE"),
      isEscalation: phase1Results.priority === "critical",
      isFromKeyCustomer: phase1Results.sender_category === "key_customer",
      hasTechnicalIssues: false, // Could be enhanced with keyword detection
      urgencyScore: phase1Results.urgency_score,
      financialImpact: phase1Results.financial_impact,
    };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Phase 2 attempt ${attempt + 1}/${maxRetries + 1}`);

        // Build enhanced context-aware prompt
        const prompt = this.buildPhase2Prompt(
          emailCharacteristics,
          phase1Results,
          email,
          attempt,
        );

        // Call Llama with retry-specific parameters
        const response = await this.callLlama3(
          prompt,
          {
            temperature: attempt === 0 ? 0.1 : 0.05, // Lower temperature on retries
            num_predict: 1200,
            timeout: options.timeout || 60000,
            stop: attempt === 0 ? ["\n\n", "```"] : ["```", "END_JSON"],
          },
          options.timeout || 60000,
        );

        // Parse and validate response
        const phase2Data = this.parseJsonResponse(response);

        // Validate response structure
        if (!this.validatePhase2Response(phase2Data)) {
          throw new Error(
            `Invalid response structure on attempt ${attempt + 1}`,
          );
        }

        // Track successful parsing
        this.trackParsingMetric(true, attempt + 1);
        logger.info(`Phase 2 successful on attempt ${attempt + 1}`);

        // Merge with Phase 1 results
        const results: Phase2Results = this.mergePhase2Results(
          phase1Results,
          phase2Data,
          Date.now() - startTime,
        );

        return results;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Phase 2 attempt ${attempt + 1} failed:`, error);

        // If this was the last attempt, break and fall through to fallback
        if (attempt === maxRetries) {
          break;
        }

        // Brief delay before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.error("Phase 2 failed after all retries:", lastError);

    // Track parsing failure and fallback usage
    this.trackParsingMetric(false, maxRetries + 1, true);

    // Return enhanced Phase 1 results as fallback
    return this.getPhase2Fallback(phase1Results, Date.now() - startTime);
  }

  /**
   * Build Phase 2 prompt with retry-specific enhancements
   */
  private buildPhase2Prompt(
    emailCharacteristics: EmailCharacteristics,
    phase1Results: Phase1Results,
    email: EmailInput,
    attempt: number,
  ): string {
    // Use enhanced prompt for retries
    const basePrompt =
      attempt === 0 ? PHASE2_ENHANCED_PROMPT : PHASE2_RETRY_PROMPT;

    let prompt = enhancePromptForEmailType(basePrompt, emailCharacteristics);

    // Add retry-specific instructions
    if (attempt > 0) {
      prompt += `\n\nIMPORTANT: Previous attempt failed to produce valid JSON. This is retry attempt ${attempt + 1}. You MUST respond with ONLY valid JSON, no explanatory text whatsoever.`;
    }

    return prompt
      .replace("{PHASE1_RESULTS}", JSON.stringify(phase1Results, null, 2))
      .replace("{EMAIL_SUBJECT}", email.subject || "")
      .replace("{EMAIL_BODY}", email.body || email.body_preview || "");
  }

  /**
   * Call Llama 3.2 with enhanced error handling
   */
  private async callLlama3(
    prompt: string,
    llamaOptions: LlamaOptions,
    timeout: number,
  ): Promise<string> {
    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model: "llama3.2:3b",
        prompt,
        stream: false,
        options: llamaOptions,
      },
      {
        timeout,
        validateStatus: (status) => status < 500,
      },
    );

    if (response.status !== 200) {
      throw new Error(
        `LLM request failed with status ${response.status}: ${response.data}`,
      );
    }

    if (!response.data?.response) {
      throw new Error("Empty response from LLM");
    }

    return response.data.response;
  }

  /**
   * Merge Phase 2 results with Phase 1
   */
  private mergePhase2Results(
    phase1Results: Phase1Results,
    phase2Data: Record<string, unknown>,
    processingTime: number,
  ): Phase2Results {
    const missedEntities = phase2Data.missed_entities as
      | Record<string, unknown>
      | undefined;

    return {
      ...phase1Results,
      workflow_validation:
        (phase2Data.workflow_validation as string) ||
        `Confirmed: ${phase1Results.workflow_state}`,
      missed_entities: {
        project_names: Array.isArray(missedEntities?.project_names)
          ? (missedEntities.project_names as string[])
          : [],
        company_names: Array.isArray(missedEntities?.company_names)
          ? (missedEntities.company_names as string[])
          : [],
        people: Array.isArray(missedEntities?.people)
          ? (missedEntities.people as string[])
          : [],
        products: Array.isArray(missedEntities?.products)
          ? (missedEntities.products as string[])
          : [],
        technical_specs: Array.isArray(missedEntities?.technical_specs)
          ? (missedEntities.technical_specs as string[])
          : [],
        locations: Array.isArray(missedEntities?.locations)
          ? (missedEntities.locations as string[])
          : [],
        other_references: Array.isArray(missedEntities?.other_references)
          ? (missedEntities.other_references as string[])
          : [],
      },
      action_items: Array.isArray(phase2Data.action_items)
        ? (phase2Data.action_items as Array<{
            task: string;
            owner: string;
            deadline: string;
            revenue_impact?: string;
          }>)
        : [],
      risk_assessment:
        (phase2Data.risk_assessment as string) || "Standard risk level",
      initial_response:
        (phase2Data.initial_response as string) ||
        "Thank you for your email. We are processing your request.",
      confidence:
        typeof phase2Data.confidence === "number"
          ? Math.max(0, Math.min(1, phase2Data.confidence))
          : 0.75,
      business_process:
        (phase2Data.business_process as string) || phase1Results.workflow_state,
      phase2_processing_time: processingTime,
      extracted_requirements: Array.isArray(phase2Data.extracted_requirements)
        ? (phase2Data.extracted_requirements as string[])
        : [],
    };
  }

  /**
   * Get Phase 2 fallback results
   */
  private getPhase2Fallback(
    phase1Results: Phase1Results,
    processingTime: number,
  ): Phase2Results {
    return {
      ...phase1Results,
      workflow_validation: `Confirmed: ${phase1Results.workflow_state}`,
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
      risk_assessment: "Unable to assess - using rule-based analysis only",
      initial_response:
        "Thank you for your email. We are reviewing your request.",
      confidence: 0.5,
      business_process: phase1Results.workflow_state,
      phase2_processing_time: processingTime,
      extracted_requirements: [],
    };
  }

  /**
   * Phase 3: Strategic Analysis
   */
  private async runPhase3(
    email: EmailInput,
    phase1Results: Phase1Results,
    phase2Results: Phase2Results,
    options: AnalysisOptions,
  ): Promise<Phase3Results> {
    const startTime = Date.now();

    try {
      // Build comprehensive prompt with all context
      const prompt = PHASE3_STRATEGIC_PROMPT.replace(
        "{PHASE1_RESULTS}",
        JSON.stringify(phase1Results, null, 2),
      )
        .replace("{PHASE2_RESULTS}", JSON.stringify(phase2Results, null, 2))
        .replace("{EMAIL_SUBJECT}", email.subject)
        .replace("{EMAIL_BODY}", email.body || email.body_preview);

      // Call Phi-4 for maximum quality
      const response = await axios.post(
        "http://localhost:11434/api/generate",
        {
          model: "doomgrave/phi-4:14b-tools-Q3_K_S",
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 2000,
            timeout: options.timeout || 180000,
          },
        },
        {
          timeout: options.timeout || 180000,
          validateStatus: (status) => status < 500,
        },
      );

      if (response.status !== 200) {
        throw new Error(`LLM request failed with status ${response.status}`);
      }

      // Parse response
      const phase3Data = this.parseJsonResponse(response.data.response);

      // Merge all phases for comprehensive results
      const strategicInsights = phase3Data.strategic_insights as
        | Record<string, unknown>
        | undefined;
      const workflowIntelligence = phase3Data.workflow_intelligence as
        | Record<string, unknown>
        | undefined;

      const results: Phase3Results = {
        ...phase2Results,
        strategic_insights: strategicInsights
          ? {
              opportunity:
                (strategicInsights.opportunity as string) ||
                "Standard processing opportunity",
              risk: (strategicInsights.risk as string) || "Low risk",
              relationship:
                (strategicInsights.relationship as string) ||
                "Stable relationship",
            }
          : {
              opportunity: "Standard processing opportunity",
              risk: "Low risk",
              relationship: "Stable relationship",
            },
        executive_summary:
          (phase3Data.executive_summary as string) ||
          phase2Results.risk_assessment,
        escalation_needed: (phase3Data.escalation_needed as boolean) || false,
        revenue_impact:
          (phase3Data.revenue_impact as string) ||
          `$${phase1Results.financial_impact}`,
        cross_email_patterns: Array.isArray(phase3Data.cross_email_patterns)
          ? (phase3Data.cross_email_patterns as string[])
          : [],
        phase3_processing_time: Date.now() - startTime,
        workflow_intelligence: workflowIntelligence
          ? {
              predicted_next_steps: Array.isArray(
                workflowIntelligence.predicted_next_steps,
              )
                ? (workflowIntelligence.predicted_next_steps as string[])
                : ["Process request as per standard workflow"],
              bottleneck_risks: Array.isArray(
                workflowIntelligence.bottleneck_risks,
              )
                ? (workflowIntelligence.bottleneck_risks as string[])
                : ["None identified"],
              optimization_opportunities: Array.isArray(
                workflowIntelligence.optimization_opportunities,
              )
                ? (workflowIntelligence.optimization_opportunities as string[])
                : ["Continue standard processing"],
            }
          : {
              predicted_next_steps: [
                "Process request as per standard workflow",
              ],
              bottleneck_risks: ["None identified"],
              optimization_opportunities: ["Continue standard processing"],
            },
      };

      return results;
    } catch (error) {
      logger.error("Phase 3 error:", error);

      // Return Phase 2 results with strategic defaults
      return {
        ...phase2Results,
        strategic_insights: {
          opportunity: "Unable to perform strategic analysis",
          risk: phase2Results.risk_assessment,
          relationship: "Standard",
        },
        executive_summary: phase2Results.risk_assessment,
        escalation_needed: phase2Results.priority === "critical",
        revenue_impact: `$${phase1Results.financial_impact}`,
        cross_email_patterns: [],
        phase3_processing_time: Date.now() - startTime,
        workflow_intelligence: {
          predicted_next_steps: ["Continue with standard workflow"],
          bottleneck_risks: ["Analysis unavailable"],
          optimization_opportunities: ["None identified"],
        },
      };
    }
  }

  /**
   * Helper methods
   */

  private extractPONumbers(text: string): string[] {
    const patterns = [
      /\bPO\s*#?\s*(\d{7,12})\b/gi,
      /\bP\.O\.\s*(\d{7,12})\b/gi,
      /\bPurchase\s+Order\s*#?\s*(\d{7,12})\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((m) => results.add(m[1]));
    });

    return Array.from(results);
  }

  private extractQuoteNumbers(text: string): string[] {
    const patterns = [
      /\bQuote\s*#?\s*(\d{6,10})\b/gi,
      /\bQ#?\s*(\d{6,10})\b/gi,
      /\bQuotation\s*#?\s*(\d{6,10})\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((m) => results.add(m[1]));
    });

    return Array.from(results);
  }

  private extractCaseNumbers(text: string): string[] {
    const patterns = [
      /\bCase\s*#?\s*(\d{6,10})\b/gi,
      /\bTicket\s*#?\s*(\d{6,10})\b/gi,
      /\bSR\s*#?\s*(\d{6,10})\b/gi,
      /\bINC\s*(\d{6,10})\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((m) => results.add(m[1]));
    });

    return Array.from(results);
  }

  private extractPartNumbers(text: string): string[] {
    // HP/Enterprise part number patterns
    const patterns = [
      /\b([A-Z0-9]{5,15}(?:[#\-\s]?[A-Z0-9]{1,5})?)\b/g,
      /\b(\d{5,10}[A-Z]{1,3})\b/g,
    ];

    const results = new Set<string>();
    const upperText = text.toUpperCase();

    patterns.forEach((pattern) => {
      const matches = upperText.match(pattern) || [];
      matches.forEach((m) => {
        // Filter out common false positives
        if (
          !m.match(
            /^(THE|AND|FOR|WITH|FROM|THIS|THAT|HAVE|WILL|BEEN|EMAIL|PHONE|TODAY)$/,
          )
        ) {
          results.add(m);
        }
      });
    });

    return Array.from(results).slice(0, 20); // Limit to prevent overextraction
  }

  private extractDollarAmounts(text: string): string[] {
    const pattern = /\$[\d,]+(?:\.\d{2})?/g;
    return text.match(pattern) || [];
  }

  private extractDates(text: string): string[] {
    const patterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{4}-\d{2}-\d{2}\b/g,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern) => {
      const matches = text.match(pattern) || [];
      matches.forEach((m) => results.add(m));
    });

    return Array.from(results);
  }

  private extractContacts(text: string): string[] {
    const patterns = [
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      /\b(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})\b/g,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern) => {
      const matches = text.match(pattern) || [];
      matches.forEach((m) => results.add(m));
    });

    return Array.from(results).slice(0, 10);
  }

  private detectWorkflowState(content: string): string {
    if (
      content.includes("resolved") ||
      content.includes("completed") ||
      content.includes("closed")
    ) {
      return "COMPLETION";
    } else if (
      content.includes("update") ||
      content.includes("status") ||
      content.includes("working on")
    ) {
      return "IN_PROGRESS";
    } else if (
      content.includes("quote") ||
      content.includes("pricing") ||
      content.includes("cost")
    ) {
      return "QUOTE_PROCESSING";
    } else if (content.includes("order") || content.includes("purchase")) {
      return "ORDER_MANAGEMENT";
    } else if (
      content.includes("ship") ||
      content.includes("deliver") ||
      content.includes("tracking")
    ) {
      return "SHIPPING";
    } else if (
      content.includes("return") ||
      content.includes("rma") ||
      content.includes("refund")
    ) {
      return "RETURNS";
    }

    return "START_POINT";
  }

  private calculateUrgencyScore(content: string, email: EmailInput): number {
    let score = 0;

    const urgencyKeywords = [
      { word: "urgent", weight: 2 },
      { word: "critical", weight: 3 },
      { word: "asap", weight: 2 },
      { word: "immediate", weight: 2 },
      { word: "emergency", weight: 3 },
      { word: "escalat", weight: 2 },
      { word: "deadline", weight: 1 },
      { word: "today", weight: 1 },
      { word: "now", weight: 1 },
    ];

    urgencyKeywords.forEach(({ word, weight }) => {
      if (content.includes(word)) score += weight;
    });

    // Check email importance flag
    if (email.importance === "high") score += 2;

    return Math.min(score, 10); // Cap at 10
  }

  private calculatePriority(
    urgencyScore: number,
    email: EmailInput,
    entities: Phase1Results["entities"],
  ): string {
    // Critical priority conditions
    if (urgencyScore >= 5 || email.importance === "high") {
      return "critical";
    }

    // High priority conditions
    if (
      urgencyScore >= 3 ||
      entities.po_numbers.length > 0 ||
      (entities.dollar_amounts &&
        entities.dollar_amounts.some((amt) => {
          if (!amt || typeof amt !== "string") return false;
          const value = parseFloat(amt.replace(/[$,]/g, ""));
          return value > 10000;
        }))
    ) {
      return "high";
    }

    // Low priority conditions
    if (
      urgencyScore === 0 &&
      !entities.po_numbers.length &&
      !entities.quote_numbers.length &&
      !entities.case_numbers.length
    ) {
      return "low";
    }

    return "medium";
  }

  private extractKeyPhrases(content: string): string[] {
    const phrases: string[] = [];

    const patterns = [
      /urgent\s+\w+\s+\w+/gi,
      /need\s+\w+\s+by\s+\w+/gi,
      /\$[\d,]+\s+\w+/gi,
      /deadline\s+\w+\s+\w+/gi,
      /critical\s+\w+\s+\w+/gi,
      /escalate\s+to\s+\w+/gi,
      /waiting\s+for\s+\w+/gi,
    ];

    patterns.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      phrases.push(...matches);
    });

    // Deduplicate and limit
    return [...new Set(phrases)].slice(0, 10);
  }

  private categorizeSender(senderEmail: string): string {
    if (!senderEmail || typeof senderEmail !== "string") {
      return "unknown";
    }
    const email = senderEmail.toLowerCase();

    const keyCustomers = [
      "insightordersupport",
      "team4401",
      "insighthpi",
      "vip@",
      "executive@",
    ];

    if (keyCustomers.some((key) => email.includes(key))) {
      return "key_customer";
    }

    const internalDomains = ["@tdsynnex.com", "@synnex.com", "@techdata.com"];
    if (internalDomains.some((domain) => email.includes(domain))) {
      return "internal";
    }

    const partnerDomains = [
      "@hp.com",
      "@dell.com",
      "@microsoft.com",
      "@cisco.com",
    ];
    if (partnerDomains.some((domain) => email.includes(domain))) {
      return "partner";
    }

    return "standard";
  }

  private calculateFinancialImpact(dollarAmounts: string[]): number {
    if (!dollarAmounts || !Array.isArray(dollarAmounts)) {
      return 0;
    }

    return dollarAmounts
      .filter((amt) => amt && typeof amt === "string")
      .map((amt) => parseFloat(amt.replace(/[$,]/g, "")))
      .filter((amt) => !isNaN(amt))
      .reduce((sum, amt) => sum + amt, 0);
  }

  private detectPatterns(
    content: string,
    entities: Phase1Results["entities"],
  ): string[] {
    const patterns: string[] = [];

    // Multi-item patterns
    if (entities.part_numbers.length > 5) {
      patterns.push("bulk_order");
    }

    // Urgency patterns
    if (content.match(/urgent|asap|critical/gi)?.length || 0 > 2) {
      patterns.push("high_urgency");
    }

    // Financial patterns
    if (entities.dollar_amounts.length > 0) {
      const total = this.calculateFinancialImpact(entities.dollar_amounts);
      if (total > 50000) patterns.push("high_value");
      if (total > 100000) patterns.push("enterprise_deal");
    }

    // Process patterns
    if (content.includes("expedite") || content.includes("rush")) {
      patterns.push("expedited_processing");
    }

    if (content.includes("cancel") || content.includes("void")) {
      patterns.push("cancellation_risk");
    }

    // Relationship patterns
    if (
      content.includes("dissatisfied") ||
      content.includes("frustrated") ||
      content.includes("disappointed")
    ) {
      patterns.push("customer_dissatisfaction");
    }

    if (
      content.includes("competitor") ||
      content.includes("alternative") ||
      content.includes("switch")
    ) {
      patterns.push("competitive_threat");
    }

    return patterns;
  }

  /**
   * Enhanced JSON response parsing with robust extraction logic
   * Handles various LLM response formats including markdown, prefixes, and malformed JSON
   */
  private parseJsonResponse(response: string): Record<string, unknown> {
    try {
      // Clean and normalize the response
      const cleaned = this.extractJsonFromResponse(response);

      if (!cleaned) {
        throw new Error("No JSON content found in response");
      }

      // Parse and validate JSON
      const parsed = JSON.parse(cleaned);

      // Ensure required Phase 2 fields exist with proper defaults
      return this.validateAndNormalizeResponse(parsed);
    } catch (error) {
      logger.error("JSON parse error:", error);
      logger.debug("Raw response:", response.substring(0, 500) + "...");

      // Try fallback extraction methods
      const fallbackResult = this.attemptFallbackExtraction(response);
      if (fallbackResult) {
        return fallbackResult;
      }

      // Return structured fallback as last resort
      return this.getStructuredFallback();
    }
  }

  /**
   * Extract JSON from various response formats
   */
  private extractJsonFromResponse(response: string): string | null {
    let cleaned = response.trim();

    // Step 1: Remove common LLM prefixes and suffixes
    const prefixesToRemove = [
      /^Here's the JSON response:/i,
      /^Based on the analysis:/i,
      /^The analysis results:/i,
      /^JSON output:/i,
      /^Response:/i,
      /^Analysis:/i,
      /^.*?(?=\{)/s,
    ];

    prefixesToRemove.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, "");
    });

    // Step 2: Remove markdown code blocks
    cleaned = cleaned
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/^```/gm, "")
      .replace(/```$/gm, "");

    // Step 3: Extract JSON object using multiple strategies

    // Strategy 1: Find complete JSON object
    const jsonMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];

      // Clean up common formatting issues
      jsonStr = jsonStr
        .replace(/([a-zA-Z_]+):/g, '"$1":') // Add quotes to keys
        .replace(/:\s*([a-zA-Z_][^,}\]]*?)(?=[,}\]])/g, ': "$1"') // Quote unquoted string values
        .replace(/"(true|false|null|\d+(?:\.\d+)?)"(?=[,}\]])/g, "$1"); // Unquote boolean/number values

      return jsonStr;
    }

    // Strategy 2: Find JSON in curly braces (greedy)
    const greedyMatch = cleaned.match(/\{[\s\S]*\}/);
    if (greedyMatch) {
      return greedyMatch[0].replace(/\}[^}]*$/s, "}"); // Remove text after last }
    }

    // Strategy 3: Build JSON from key-value pairs if structured text found
    const kvPairs = this.extractKeyValuePairs(cleaned);
    if (kvPairs && Object.keys(kvPairs).length > 0) {
      return JSON.stringify(kvPairs);
    }

    return null;
  }

  /**
   * Extract key-value pairs from structured text
   */
  private extractKeyValuePairs(text: string): Record<string, unknown> | null {
    const result: Record<string, unknown> = {};
    let hasValidPairs = false;

    // Look for patterns like "workflow_validation: some value"
    const kvPattern = /([a-zA-Z_]+):\s*([^\n]+)/g;
    let match;

    while ((match = kvPattern.exec(text)) !== null) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Clean up the value
      value = value.replace(/^["']|["']$/g, ""); // Remove quotes
      value = value.replace(/,$/, ""); // Remove trailing comma

      // Try to parse as appropriate type
      if (value === "true" || value === "false") {
        result[key] = value === "true";
      } else if (!isNaN(Number(value)) && value !== "") {
        result[key] = Number(value);
      } else {
        result[key] = value;
      }

      hasValidPairs = true;
    }

    return hasValidPairs ? result : null;
  }

  /**
   * Validate and normalize parsed response
   */
  private validateAndNormalizeResponse(
    parsed: unknown,
  ): Record<string, unknown> {
    // Ensure it's an object
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("Response is not a valid object");
    }

    // Ensure required Phase 2 fields exist
    const normalized = { ...parsed } as Record<string, unknown>;

    if (!normalized.workflow_validation) {
      normalized.workflow_validation =
        "Unable to validate workflow from response";
    }
    if (
      !normalized.missed_entities ||
      typeof normalized.missed_entities !== "object"
    ) {
      normalized.missed_entities = {
        project_names: [],
        company_names: [],
        people: [],
        products: [],
        technical_specs: [],
        locations: [],
        other_references: [],
      };
    }
    if (!Array.isArray(normalized.action_items)) {
      normalized.action_items = [];
    }
    if (!normalized.risk_assessment) {
      normalized.risk_assessment = "Standard risk level";
    }
    if (!normalized.initial_response) {
      normalized.initial_response =
        "Thank you for your email. We are processing your request.";
    }
    if (typeof normalized.confidence !== "number") {
      normalized.confidence = 0.5;
    }
    if (!normalized.business_process) {
      normalized.business_process = "STANDARD_PROCESSING";
    }
    if (!Array.isArray(normalized.extracted_requirements)) {
      normalized.extracted_requirements = [];
    }

    return normalized;
  }

  /**
   * Attempt fallback extraction from markdown-like structures
   */
  private attemptFallbackExtraction(
    response: string,
  ): Record<string, unknown> | null {
    try {
      // Look for markdown-style structured data
      const sections: Record<string, unknown> = {};

      // Extract workflow validation
      const workflowMatch = response.match(
        /workflow[_\s]*validation[:\s]*([^\n]+)/i,
      );
      if (workflowMatch) {
        sections.workflow_validation = workflowMatch[1].trim();
      }

      // Extract confidence
      const confidenceMatch = response.match(/confidence[:\s]*([0-9.]+)/i);
      if (confidenceMatch) {
        sections.confidence = parseFloat(confidenceMatch[1]);
      }

      // Extract risk assessment
      const riskMatch = response.match(/risk[_\s]*assessment[:\s]*([^\n]+)/i);
      if (riskMatch) {
        sections.risk_assessment = riskMatch[1].trim();
      }

      // Extract business process
      const processMatch = response.match(
        /business[_\s]*process[:\s]*([^\n]+)/i,
      );
      if (processMatch) {
        sections.business_process = processMatch[1].trim();
      }

      // If we found at least 2 sections, use this as fallback
      if (Object.keys(sections).length >= 2) {
        return this.validateAndNormalizeResponse(sections);
      }

      return null;
    } catch (error) {
      logger.debug("Fallback extraction failed:", error);
      return null;
    }
  }

  /**
   * Get structured fallback response
   */
  private getStructuredFallback(): Record<string, unknown> {
    return {
      workflow_validation: "JSON parsing failed - using rule-based analysis",
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
      risk_assessment:
        "Unable to assess due to parsing error - recommend manual review",
      initial_response:
        "Thank you for your email. We are reviewing your request and will respond shortly.",
      confidence: 0.3,
      business_process: "PARSING_ERROR",
      extracted_requirements: [],
    };
  }

  /**
   * Validate Phase 2 response structure
   */
  private validatePhase2Response(response: Record<string, unknown>): boolean {
    const requiredFields = [
      "workflow_validation",
      "missed_entities",
      "action_items",
      "risk_assessment",
      "initial_response",
      "confidence",
      "business_process",
    ];

    return requiredFields.every((field) =>
      Object.prototype.hasOwnProperty.call(response, field),
    );
  }

  private async saveAnalysis(
    email: EmailInput,
    results: Phase3Results,
  ): Promise<void> {
    const id = `3phase_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const totalTime =
      results.processing_time +
      results.phase2_processing_time +
      results.phase3_processing_time;

    await executeQuery((db) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO email_analysis (
          id, email_id,
          quick_workflow, quick_priority, quick_intent, quick_urgency,
          quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
          deep_workflow_primary, deep_confidence,
          entities_po_numbers, entities_quote_numbers, entities_case_numbers,
          entities_part_numbers, entities_order_references, entities_contacts,
          action_summary, action_details, action_sla_status,
          business_impact_revenue, business_impact_satisfaction,
          contextual_summary, suggested_response,
          deep_model, deep_processing_time, total_processing_time,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        id,
        email.id || email.message_id,
        results.workflow_state,
        results.priority.toUpperCase(),
        "REQUEST",
        results.urgency_score > 0 ? "HIGH" : "MEDIUM",
        results.confidence,
        "NEW",
        "three-phase-all",
        results.processing_time,
        results.business_process,
        results.confidence,
        results.entities.po_numbers.join(",") || null,
        results.entities.quote_numbers.join(",") || null,
        results.entities.case_numbers.join(",") || null,
        results.entities.part_numbers.join(",") || null,
        results.entities.dollar_amounts.join(",") || null,
        JSON.stringify(results.entities.contacts),
        results.action_items.map((a) => a.task).join("; ") || null,
        JSON.stringify(results.action_items),
        results.escalation_needed ? "ESCALATED" : "ON_TRACK",
        results.revenue_impact,
        results.strategic_insights.relationship,
        results.executive_summary,
        results.initial_response,
        "three-phase-phi4",
        results.phase3_processing_time,
        totalTime,
        now,
        now,
      );
    });

    // Cache in Redis for quick retrieval
    await this.redisService.set(
      `email_analysis:${email.id}`,
      JSON.stringify(results),
      86400, // 24 hour TTL
    );
  }

  private initializeTables(): void {
    // Ensure email_analysis table exists with all required columns
    executeQuery((db) => {
      db.exec(`
      CREATE TABLE IF NOT EXISTS email_analysis (
        id TEXT PRIMARY KEY,
        email_id TEXT NOT NULL,
        quick_workflow TEXT,
        quick_priority TEXT,
        quick_intent TEXT,
        quick_urgency TEXT,
        quick_confidence REAL,
        quick_suggested_state TEXT,
        quick_model TEXT,
        quick_processing_time INTEGER,
        deep_workflow_primary TEXT,
        deep_confidence REAL,
        entities_po_numbers TEXT,
        entities_quote_numbers TEXT,
        entities_case_numbers TEXT,
        entities_part_numbers TEXT,
        entities_order_references TEXT,
        entities_contacts TEXT,
        action_summary TEXT,
        action_details TEXT,
        action_sla_status TEXT,
        business_impact_revenue TEXT,
        business_impact_satisfaction TEXT,
        contextual_summary TEXT,
        suggested_response TEXT,
        deep_model TEXT,
        deep_processing_time INTEGER,
        total_processing_time INTEGER,
        created_at TEXT,
        updated_at TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_email_analysis_email_id ON email_analysis(email_id);
      CREATE INDEX IF NOT EXISTS idx_email_analysis_created_at ON email_analysis(created_at);
      `);
      return true;
    });
  }

  /**
   * Batch processing for multiple emails
   */
  async analyzeEmailBatch(
    emails: EmailInput[],
    options: AnalysisOptions = {},
  ): Promise<Phase3Results[]> {
    logger.info(`Starting batch analysis for ${emails.length} emails`);

    const results: Phase3Results[] = [];
    const batchSize = 5; // Process 5 emails concurrently

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((email) => this.analyzeEmail(email, options)),
      );
      results.push(...(batchResults as Phase3Results[]));

      // Emit progress
      this.emit("batch:progress", {
        processed: i + batch.length,
        total: emails.length,
        percentage: ((i + batch.length) / emails.length) * 100,
      });
    }

    logger.info(`Batch analysis complete for ${emails.length} emails`);
    return results;
  }

  /**
   * Get analysis statistics with parsing metrics
   */
  async getAnalysisStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalysisStats & { parsingMetrics: typeof this.parsingMetrics }> {
    const dateFilter =
      startDate && endDate
        ? `WHERE created_at BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`
        : "";

    const stats = (await executeQuery((db) => {
      return db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_analyzed,
          AVG(total_processing_time) as avg_processing_time,
          AVG(quick_confidence) as avg_confidence,
          SUM(CASE WHEN quick_priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN action_sla_status = 'ESCALATED' THEN 1 ELSE 0 END) as escalated_count,
          COUNT(DISTINCT deep_model) as models_used
        FROM email_analysis
        ${dateFilter}
      `,
        )
        .get();
    })) as DatabaseAnalysisStats;

    // Add parsing metrics
    const successRate =
      this.parsingMetrics.totalAttempts > 0
        ? this.parsingMetrics.successfulParses /
          this.parsingMetrics.totalAttempts
        : 0;

    return {
      ...stats,
      parsingMetrics: {
        ...this.parsingMetrics,
        successRate: Math.round(successRate * 10000) / 100, // Percentage with 2 decimal places
        retryRate:
          this.parsingMetrics.totalAttempts > 0
            ? Math.round(
                (this.parsingMetrics.retrySuccesses /
                  this.parsingMetrics.totalAttempts) *
                  10000,
              ) / 100
            : 0,
        fallbackRate:
          this.parsingMetrics.totalAttempts > 0
            ? Math.round(
                (this.parsingMetrics.fallbackUses /
                  this.parsingMetrics.totalAttempts) *
                  10000,
              ) / 100
            : 0,
      },
    };
  }

  /**
   * Track parsing metrics
   */
  private trackParsingMetric(
    success: boolean,
    attempt: number,
    usedFallback: boolean = false,
  ): void {
    this.parsingMetrics.totalAttempts++;

    if (success) {
      this.parsingMetrics.successfulParses++;
      if (attempt > 1) {
        this.parsingMetrics.retrySuccesses++;
      }
    }

    if (usedFallback) {
      this.parsingMetrics.fallbackUses++;
    }

    // Update average attempts
    this.parsingMetrics.averageAttempts =
      (this.parsingMetrics.averageAttempts *
        (this.parsingMetrics.totalAttempts - 1) +
        attempt) /
      this.parsingMetrics.totalAttempts;

    // Log metrics periodically
    if (this.parsingMetrics.totalAttempts % 10 === 0) {
      const successRate =
        this.parsingMetrics.successfulParses /
        this.parsingMetrics.totalAttempts;
      logger.info(
        `Parsing metrics: ${Math.round(successRate * 100)}% success rate, ${Math.round(this.parsingMetrics.averageAttempts * 100) / 100} avg attempts`,
      );
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down EmailThreePhaseAnalysisService");

    // Clear caches
    this.phase1Cache.clear();

    // Connection pool will handle database cleanup automatically

    // Close Redis connection
    await this.redisService.close();

    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const emailAnalysisService = new EmailThreePhaseAnalysisService();
