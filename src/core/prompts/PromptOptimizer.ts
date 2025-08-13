/**
 * Prompt Optimization Utility
 * Reduces token usage while maintaining accuracy for faster LLM processing
 */

import { Logger } from "../../utils/logger.js";
import type { EmailInput, Phase1Results, Phase2Results } from "../services/EmailThreePhaseAnalysisService.js";

const logger = new Logger("PromptOptimizer");

export interface OptimizationOptions {
  maxTokens?: number;
  preserveEntities?: boolean;
  includeExamples?: boolean;
  compressionLevel?: "low" | "medium" | "high";
}

export class PromptOptimizer {
  private tokenEstimator = {
    // Rough token estimation (1 token ≈ 4 characters)
    estimate: (text: string): number => Math.ceil(text.length / 4),
  };

  /**
   * Optimize Phase 2 prompt for minimal tokens while preserving accuracy
   */
  optimizePhase2Prompt(
    email: EmailInput,
    phase1: Phase1Results,
    options: OptimizationOptions = {}
  ): string {
    const {
      maxTokens = 800,
      preserveEntities = true,
      includeExamples = false,
      compressionLevel = "medium",
    } = options;

    // Extract key information
    const emailSummary = this.summarizeEmail(email, compressionLevel);
    const phase1Summary = this.summarizePhase1(phase1, preserveEntities);
    
    // Build compact prompt
    let prompt = this.buildCompactPrompt(emailSummary, phase1Summary);
    
    // Add examples only if requested and space allows
    if (includeExamples && this.tokenEstimator.estimate(prompt) < maxTokens * 0.7) {
      prompt += this.getMinimalExamples();
    }

    // Ensure prompt fits within token limit
    prompt = this.trimToTokenLimit(prompt, maxTokens);

    logger.debug(`Optimized prompt from ${email.body?.length || 0} chars to ${prompt.length} chars`);
    
    return prompt;
  }

  /**
   * Optimize Phase 3 prompt for strategic analysis
   */
  optimizePhase3Prompt(
    email: EmailInput,
    phase1: Phase1Results,
    phase2: Phase2Results,
    options: OptimizationOptions = {}
  ): string {
    const { maxTokens = 1000, compressionLevel = "low" } = options;

    // For Phase 3, preserve more context but still optimize
    const context = this.buildPhase3Context(email, phase1, phase2, compressionLevel);
    
    const prompt = `Strategic Analysis Request:

Context: ${context}

Provide JSON with:
- strategic_insights: {opportunity, risk, relationship}
- executive_summary: Brief strategic summary
- escalation_needed: boolean
- revenue_impact: string
- workflow_intelligence: {predicted_next_steps[], bottleneck_risks[], optimization_opportunities[]}

Focus on business impact and actionable insights.`;

    return this.trimToTokenLimit(prompt, maxTokens);
  }

  /**
   * Summarize email content efficiently
   */
  private summarizeEmail(email: EmailInput, compressionLevel: string): string {
    const subject = email.subject || "No subject";
    const body = email.body || email.body_preview || "";
    
    // Extract key sentences based on compression level
    let contentLength: number;
    switch (compressionLevel) {
      case "high":
        contentLength = 200;
        break;
      case "medium":
        contentLength = 400;
        break;
      case "low":
        contentLength = 600;
        break;
      default:
        contentLength = 400;
    }

    // Smart truncation - try to keep complete sentences
    let summary = `Subj: ${subject.substring(0, 100)}`;
    
    if (body) {
      const cleanBody = this.cleanEmailBody(body);
      const truncated = this.smartTruncate(cleanBody, contentLength);
      summary += `\nBody: ${truncated}`;
    }

    // Add key metadata
    summary += `\nFrom: ${email.sender_email.split('@')[1]}`; // Just domain
    
    if (email.importance === "high") {
      summary += " [HIGH_PRIORITY]";
    }

    return summary;
  }

  /**
   * Summarize Phase 1 results
   */
  private summarizePhase1(phase1: Phase1Results, preserveEntities: boolean): string {
    let summary = `State:${phase1.workflow_state} Pri:${phase1.priority}`;
    
    // Add entity counts
    const entitySummary = [];
    if (phase1.entities.po_numbers.length > 0) {
      entitySummary.push(`PO:${phase1.entities.po_numbers.length}`);
      if (preserveEntities && phase1.entities.po_numbers.length <= 3) {
        entitySummary.push(`(${phase1.entities.po_numbers.join(",")})`);
      }
    }
    
    if (phase1.entities.quote_numbers.length > 0) {
      entitySummary.push(`Quote:${phase1.entities.quote_numbers.length}`);
    }
    
    if (phase1.entities.dollar_amounts.length > 0) {
      const total = phase1.financial_impact;
      entitySummary.push(`$${total > 1000 ? Math.round(total/1000) + "K" : total}`);
    }

    if (entitySummary.length > 0) {
      summary += ` Entities:${entitySummary.join(" ")}`;
    }

    // Add patterns if critical
    if (phase1.detected_patterns.includes("high_urgency") || 
        phase1.detected_patterns.includes("customer_dissatisfaction")) {
      summary += ` Patterns:${phase1.detected_patterns.join(",")}`;
    }

    // Add chain info if complete
    if (phase1.chain_analysis?.is_complete_chain) {
      summary += ` Chain:COMPLETE(${phase1.chain_analysis.completeness_score})`;
    }

    return summary;
  }

  /**
   * Build compact prompt structure
   */
  private buildCompactPrompt(emailSummary: string, phase1Summary: string): string {
    return `Analyze email for business processing.

Email: ${emailSummary}
Analysis: ${phase1Summary}

Return JSON only:
{
  "workflow_validation": "Validated workflow state",
  "missed_entities": {"company_names":[], "people":[], "products":[]},
  "action_items": [{"task":"", "owner":"", "deadline":""}],
  "risk_assessment": "Risk level and reason",
  "initial_response": "Professional response",
  "confidence": 0.0-1.0,
  "business_process": "Process type"
}

Be concise. Focus on actionable insights.`;
  }

  /**
   * Get minimal examples for few-shot learning
   */
  private getMinimalExamples(): string {
    return `

Example:
Input: "Urgent: PO 12345 delayed. Customer ABC threatening cancellation."
Output: {"workflow_validation":"ESCALATION_REQUIRED","risk_assessment":"High - Customer churn risk","confidence":0.85}`;
  }

  /**
   * Build Phase 3 context efficiently
   */
  private buildPhase3Context(
    email: EmailInput,
    phase1: Phase1Results,
    phase2: Phase2Results,
    compressionLevel: string
  ): string {
    // Only include most relevant information
    const context = {
      workflow: phase2.workflow_validation,
      priority: phase1.priority,
      financial: phase1.financial_impact,
      risk: phase2.risk_assessment,
      confidence: phase2.confidence,
      key_entities: {
        po: phase1.entities.po_numbers.length,
        quotes: phase1.entities.quote_numbers.length,
        value: phase1.financial_impact,
      },
      actions: phase2.action_items.length,
      chain_complete: phase1.chain_analysis?.is_complete_chain || false,
    };

    return JSON.stringify(context);
  }

  /**
   * Clean email body for processing
   */
  private cleanEmailBody(body: string): string {
    return body
      .replace(/[\r\n]+/g, " ") // Replace newlines with spaces
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .replace(/<[^>]*>/g, "") // Remove HTML tags
      .replace(/[^\x20-\x7E]/g, "") // Remove non-printable characters
      .replace(/_{3,}/g, "") // Remove long underscores
      .replace(/-{3,}/g, "") // Remove long dashes
      .trim();
  }

  /**
   * Smart truncation that preserves sentence boundaries
   */
  private smartTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Try to cut at sentence boundary
    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastQuestion = truncated.lastIndexOf("?");
    const lastExclamation = truncated.lastIndexOf("!");
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // Fall back to word boundary
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  }

  /**
   * Ensure prompt fits within token limit
   */
  private trimToTokenLimit(prompt: string, maxTokens: number): string {
    const estimatedTokens = this.tokenEstimator.estimate(prompt);
    
    if (estimatedTokens <= maxTokens) {
      return prompt;
    }

    // Calculate how much to trim
    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(prompt.length * ratio * 0.95); // 95% to be safe
    
    return this.smartTruncate(prompt, targetLength);
  }

  /**
   * Analyze prompt efficiency
   */
  analyzePromptEfficiency(original: string, optimized: string): {
    originalTokens: number;
    optimizedTokens: number;
    reduction: number;
    savingsPercentage: number;
  } {
    const originalTokens = this.tokenEstimator.estimate(original);
    const optimizedTokens = this.tokenEstimator.estimate(optimized);
    const reduction = originalTokens - optimizedTokens;
    const savingsPercentage = (reduction / originalTokens) * 100;

    return {
      originalTokens,
      optimizedTokens,
      reduction,
      savingsPercentage,
    };
  }

  /**
   * Batch optimization for multiple prompts
   */
  optimizeBatch(
    prompts: Array<{ email: EmailInput; phase1: Phase1Results }>,
    options: OptimizationOptions = {}
  ): string[] {
    // Find common patterns across batch
    const commonPatterns = this.findCommonPatterns(prompts);
    
    // Optimize each prompt with shared context
    return prompts.map(({ email, phase1 }) => {
      const optimized = this.optimizePhase2Prompt(email, phase1, {
        ...options,
        // Even more aggressive compression for batches
        compressionLevel: "high",
        includeExamples: false,
      });

      // Add batch context if beneficial
      if (commonPatterns.length > 0 && options.maxTokens && options.maxTokens > 600) {
        return `Batch context: ${commonPatterns.join(", ")}\n\n${optimized}`;
      }

      return optimized;
    });
  }

  /**
   * Find common patterns in batch for context sharing
   */
  private findCommonPatterns(
    prompts: Array<{ email: EmailInput; phase1: Phase1Results }>
  ): string[] {
    const patterns: string[] = [];
    
    // Check workflow states
    const workflowStates = prompts.map(p => p.phase1.workflow_state);
    const mostCommonWorkflow = this.mostCommon(workflowStates);
    if (mostCommonWorkflow && workflowStates.filter(w => w === mostCommonWorkflow).length > prompts.length * 0.6) {
      patterns.push(`Common workflow: ${mostCommonWorkflow}`);
    }

    // Check priority distribution
    const priorities = prompts.map(p => p.phase1.priority);
    const highPriorityCount = priorities.filter(p => p === "high" || p === "critical").length;
    if (highPriorityCount > prompts.length * 0.5) {
      patterns.push("High priority batch");
    }

    return patterns;
  }

  /**
   * Find most common element in array
   */
  private mostCommon<T>(arr: T[]): T | undefined {
    const counts = new Map<T, number>();
    
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommonItem: T | undefined;
    
    for (const [item, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonItem = item;
      }
    }

    return mostCommonItem;
  }
}

// Export singleton instance
export const promptOptimizer = new PromptOptimizer();