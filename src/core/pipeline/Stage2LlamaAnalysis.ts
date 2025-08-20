/**
 * Stage 2: Llama 3.2:3b Analysis
 * Processes priority emails with contextual understanding
 */

import { logger } from "../../utils/logger.js";
import {
  MODEL_CONFIG,
  getModelTimeout,
  getModelBatchSize,
} from "../../config/models.config.js";
import type {
  Email,
  LlamaAnalysisResult,
  LlamaAnalysisResults,
} from "./types.js";
import axios from "axios";

export class Stage2LlamaAnalysis {
  private model = MODEL_CONFIG?.models?.primary;
  private apiUrl = `${MODEL_CONFIG?.api?.ollamaUrl}${MODEL_CONFIG?.api?.endpoints.generate}`;
  private timeout = getModelTimeout("primary");
  private batchSize = getModelBatchSize("primary");
  private progressCallback?: (count: number) => Promise<void>;

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (count: number) => Promise<void>): void {
    this.progressCallback = callback;
  }

  /**
   * Process priority emails with Llama 3.2:3b
   */
  async process(
    emails: Email[],
    resumeFromIndex: number = 0,
  ): Promise<LlamaAnalysisResults> {
    const startTime = Date.now();
    const results: LlamaAnalysisResult[] = [];

    // Load existing results if resuming
    if (resumeFromIndex > 0) {
      const existingResults = await this.loadIntermediateResults();
      results.push(...existingResults.slice(0, resumeFromIndex));
      logger.info(
        `Resuming Llama 3.2:3b analysis from email ${resumeFromIndex + 1}/${emails?.length || 0}`,
        "STAGE2",
      );
    } else {
      logger.info(
        `Starting Llama 3.2:3b analysis for ${emails?.length || 0} priority emails`,
        "STAGE2",
      );
    }

    // Skip already processed emails
    const emailsToProcess = emails.slice(resumeFromIndex);

    // Process in smaller batches with proper timeout management
    for (let i = 0; i < emailsToProcess?.length || 0; i += this.batchSize) {
      const batch = emailsToProcess.slice(i, i + this.batchSize);

      // Process batch sequentially to avoid overwhelming the system
      const batchResults: LlamaAnalysisResult[] = [];
      for (const email of batch) {
        try {
          const result = await this.analyzeWithTimeout(email, this.timeout);
          batchResults.push(result);
        } catch (error) {
          logger.error(
            `Failed to process email ${email.id}`,
            "STAGE2",
            error as Error,
          );
          batchResults.push(
            this.createErrorResult(email, (error as Error).message),
          );
        }
      }

      results.push(...batchResults);

      // Progress logging
      const totalProcessed =
        resumeFromIndex + Math.min(i + this.batchSize, emailsToProcess?.length || 0);
      const progress = ((totalProcessed / emails?.length || 0) * 100).toFixed(1);
      logger.info(
        `Stage 2 Progress: ${totalProcessed}/${emails?.length || 0} (${progress}%)`,
        "STAGE2",
      );

      // Update progress in database with throttling
      if (this.progressCallback && this.shouldUpdateProgress(totalProcessed)) {
        try {
          await this.progressCallback(totalProcessed);
        } catch (error) {
          logger.warn(
            "Progress update failed, continuing processing",
            "STAGE2",
            error as Error,
          );
        }
      }

      // Save intermediate results
      await this.saveIntermediateResults(results);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    logger.info(
      `Llama analysis completed in ${totalTime.toFixed(2)}s`,
      "STAGE2",
    );

    return results;
  }

  private lastProgressUpdate = 0;
  private readonly PROGRESS_THROTTLE_MS = 2000; // Update every 2 seconds

  /**
   * Check if progress should be updated (throttling)
   */
  private shouldUpdateProgress(_processed: number): boolean {
    const now = Date.now();
    if (now - this.lastProgressUpdate > this.PROGRESS_THROTTLE_MS) {
      this.lastProgressUpdate = now;
      return true;
    }
    return false;
  }

  /**
   * Analyze email with timeout protection
   */
  private async analyzeWithTimeout(
    email: Email,
    timeout: number,
  ): Promise<LlamaAnalysisResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const result = await this.analyzeEmail(email, controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        logger.warn(`Llama analysis timeout for email ${email.id}`, "STAGE2");
        return this.createErrorResult(email, "Analysis timeout");
      }

      logger.error(
        `Llama analysis error for email ${email.id}`,
        "STAGE2",
        error,
      );
      return this.createErrorResult(email, error.message);
    }
  }

  /**
   * Analyze a single email with Llama 3.2:3b
   */
  private async analyzeEmail(
    email: Email,
    signal: AbortSignal,
  ): Promise<LlamaAnalysisResult> {
    const startTime = Date.now();

    const prompt = this.buildPrompt(email);

    const response = await axios.post(
      this.apiUrl,
      {
        model: this.model,
        prompt,
        stream: false,
        options: {
          temperature: MODEL_CONFIG?.generation?.temperature,
          num_predict: MODEL_CONFIG?.generation?.numPredict,
          top_k: MODEL_CONFIG?.generation?.topK,
          top_p: MODEL_CONFIG?.generation?.topP,
          repeat_penalty: MODEL_CONFIG?.generation?.repeatPenalty,
        },
      },
      {
        signal,
        timeout: this.timeout,
      },
    );

    const responseText = response?.data?.response;
    const analysis = this.parseResponse(responseText);

    const processingTime = (Date.now() - startTime) / 1000;

    return {
      emailId: email.id,
      contextualSummary: analysis.contextual_summary || "",
      workflowState: analysis.workflow_state || "UNKNOWN",
      businessProcess: analysis.business_process || "General",
      entities: analysis.entities || {
        po_numbers: [],
        quote_numbers: [],
        case_numbers: [],
        part_numbers: [],
        companies: [],
      },
      actionItems: analysis.action_items || [],
      urgencyLevel: analysis.urgency_level || "MEDIUM",
      suggestedResponse: analysis.suggested_response || "",
      qualityScore: this.calculateQualityScore(analysis),
      processingTime,
      model: this.model,
    };
  }

  /**
   * Build analysis prompt for Llama 3.2:3b
   */
  private buildPrompt(email: Email): string {
    return `Analyze this business email and provide a structured analysis.

Subject: ${email.subject}
From: ${email.sender_email}
Body: ${email?.body?.substring(0, 2000)}

Provide a JSON response with the following structure:
{
  "contextual_summary": "A comprehensive business context summary (50-100 words)",
  "workflow_state": "Classify as START_POINT, IN_PROGRESS, WAITING, or COMPLETION",
  "business_process": "Identify the specific business process (e.g., Order Management, Quote Processing, Support Case)",
  "entities": {
    "po_numbers": ["list of PO/BO/SO numbers found"],
    "quote_numbers": ["list of quote numbers found"],
    "case_numbers": ["list of case/ticket numbers found"],
    "part_numbers": ["list of part/SKU numbers found"],
    "companies": ["list of company names found"]
  },
  "action_items": [
    {
      "task": "Specific action required",
      "details": "Detailed description",
      "assignee": "Suggested owner (optional)",
      "deadline": "Suggested deadline (optional)"
    }
  ],
  "urgency_level": "Rate as LOW, MEDIUM, HIGH, or CRITICAL",
  "suggested_response": "Brief professional response approach (1-2 sentences)"
}

Analyze the email carefully and provide accurate, actionable insights. Focus on business value and practical next steps.
Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse Llama response - Returns structured analysis object
   */
  private parseResponse(responseText: string): {
    contextual_summary?: string;
    workflow_state?: string;
    business_process?: string;
    entities?: {
      po_numbers: string[];
      quote_numbers: string[];
      case_numbers: string[];
      part_numbers: string[];
      companies: string[];
    };
    action_items?: Array<{
      task: string;
      details: string;
      assignee?: string;
      deadline?: string;
    }>;
    urgency_level?: string;
    suggested_response?: string;
  } {
    try {
      // Clean response if needed
      let cleanedText = responseText;
      if (responseText.includes("```json")) {
        cleanedText =
          responseText.split("```json")[1]?.split("```")[0] || responseText;
      } else if (responseText.includes("```")) {
        cleanedText =
          responseText.split("```")[1]?.split("```")[0] || responseText;
      }

      return JSON.parse(cleanedText.trim());
    } catch (error) {
      logger.warn("Failed to parse Llama response as JSON", "STAGE2");

      // Return a basic structure
      return {
        contextual_summary: responseText.substring(0, 200),
        workflow_state: "UNKNOWN",
        business_process: "General",
        entities: {
          po_numbers: [],
          quote_numbers: [],
          case_numbers: [],
          part_numbers: [],
          companies: [],
        },
        action_items: [],
        urgency_level: "MEDIUM",
        suggested_response: "Manual review required",
      };
    }
  }

  /**
   * Calculate quality score for the analysis
   */
  private calculateQualityScore(analysis: {
    contextual_summary?: string;
    entities?: any;
    business_process?: string;
    action_items?: any[];
    suggested_response?: string;
  }): number {
    let score = 0;
    const weights = {
      contextualSummary: 0.25,
      entities: 0.2,
      businessProcess: 0.2,
      actionItems: 0.2,
      suggestedResponse: 0.15,
    };

    // Context understanding (0-2.5)
    if (
      analysis.contextual_summary &&
      analysis?.contextual_summary?.length > 50
    ) {
      score += weights.contextualSummary * 10;
    }

    // Entity extraction (0-2.0)
    const entityCount = Object.values(analysis.entities || {})
      .filter(Array.isArray)
      .reduce((sum: number, arr: string[]) => sum + arr?.length || 0, 0);
    score += weights.entities * Math.min(entityCount * 2, 10);

    // Business process recognition (0-2.0)
    if (analysis.business_process && analysis.business_process !== "General") {
      score += weights.businessProcess * 10;
    }

    // Action items (0-2.0)
    if (analysis.action_items && analysis?.action_items?.length > 0) {
      score +=
        weights.actionItems * Math.min(analysis?.action_items?.length * 3, 10);
    }

    // Response suggestion (0-1.5)
    if (
      analysis.suggested_response &&
      analysis?.suggested_response?.length > 20
    ) {
      score += weights.suggestedResponse * 10;
    }

    return Math.min(score, 10);
  }

  /**
   * Handle batch results
   */
  private handleBatchResults(
    results: PromiseSettledResult<LlamaAnalysisResult>[],
    emails: Email[],
  ): LlamaAnalysisResult[] {
    return results?.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        logger.error(
          `Batch processing error for email ${emails[index]!.id}`,
          "STAGE2",
          result.reason,
        );
        return this.createErrorResult(
          emails[index]!,
          (result.reason as Error)?.message || "Unknown error",
        );
      }
    });
  }

  /**
   * Create error result
   */
  private createErrorResult(email: Email, error: string): LlamaAnalysisResult {
    return {
      emailId: email.id,
      contextualSummary: "",
      workflowState: "UNKNOWN",
      businessProcess: "Error",
      entities: {
        po_numbers: [],
        quote_numbers: [],
        case_numbers: [],
        part_numbers: [],
        companies: [],
      },
      actionItems: [],
      urgencyLevel: "MEDIUM",
      suggestedResponse: "Analysis failed - manual review required",
      qualityScore: 0,
      processingTime: 0,
      model: this.model,
      error,
    };
  }

  /**
   * Save intermediate results for resumability
   */
  private async saveIntermediateResults(
    results: LlamaAnalysisResult[],
  ): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const path = "stage2_intermediate_results.json";
      await fs.writeFile(path, JSON.stringify(results, null, 2));
      logger.debug(`Saved ${results?.length || 0} intermediate results`, "STAGE2");
    } catch (error) {
      logger.warn(
        "Failed to save intermediate results",
        "STAGE2",
        error as Error,
      );
    }
  }

  /**
   * Load intermediate results for resumability
   */
  private async loadIntermediateResults(): Promise<LlamaAnalysisResult[]> {
    try {
      const fs = await import("fs/promises");
      const path = "stage2_intermediate_results.json";
      const data = await fs.readFile(path, "utf-8");
      const results = JSON.parse(data) as LlamaAnalysisResult[];
      logger.info(
        `Loaded ${results?.length || 0} existing intermediate results`,
        "STAGE2",
      );
      return results;
    } catch (error) {
      logger.debug("No existing intermediate results found", "STAGE2");
      return [];
    }
  }
}
