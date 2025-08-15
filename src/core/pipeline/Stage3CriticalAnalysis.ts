/**
 * Stage 3: Critical Analysis
 * Deep analysis for top 500 critical emails using Phi-4 with Llama fallback
 */

import { logger } from "../../utils/logger.js";
import { MODEL_CONFIG } from "../../config/models?.config.js";
import type {
  Email,
  CriticalAnalysisResult,
  CriticalAnalysisResults,
} from "./types.js";
import axios from "axios";

export class Stage3CriticalAnalysis {
  private primaryModel = MODEL_CONFIG?.models?.critical;
  private fallbackModel = MODEL_CONFIG?.models?.primary;
  private apiUrl = `${MODEL_CONFIG?.api?.ollamaUrl}${MODEL_CONFIG?.api?.endpoints.generate}`;
  private primaryTimeout = MODEL_CONFIG?.timeouts?.critical;
  private fallbackTimeout = MODEL_CONFIG?.timeouts?.fallback;
  private progressCallback?: (count: number) => Promise<void>;
  private lastProgressUpdate = 0;
  private readonly PROGRESS_THROTTLE_MS = 2000; // Update every 2 seconds

  /**
   * Set progress callback for real-time updates
   */
  setProgressCallback(callback: (count: number) => Promise<void>): void {
    this.progressCallback = callback;
  }

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
   * Process critical emails with deep analysis
   */
  async process(emails: Email[]): Promise<CriticalAnalysisResults> {
    const startTime = Date.now();
    const results: CriticalAnalysisResult[] = [];

    logger.info(
      `Starting critical analysis for ${emails?.length || 0} high-priority emails`,
      "STAGE3",
    );

    // Process one at a time for critical emails
    for (let i = 0; i < emails?.length || 0; i++) {
      const email = emails[i]!;

      try {
        // Try Phi-4 first
        logger.debug(
          `Attempting Phi-4 analysis for email ${email.id}`,
          "STAGE3",
        );
        const result = await this.analyzeWithPhi4(email);
        results.push(result);
      } catch (error: unknown) {
        // Fallback to Llama 3.2:3b
        logger.warn(
          `Phi-4 failed for email ${email.id}, using Llama 3.2:3b fallback`,
          "STAGE3",
        );
        const fallbackResult = await this.analyzeWithLlama(email);
        results.push(fallbackResult);
      }

      // Progress logging
      const progress = (((i + 1) / emails?.length || 0) * 100).toFixed(1);
      logger.info(
        `Stage 3 Progress: ${i + 1}/${emails?.length || 0} (${progress}%)`,
        "STAGE3",
      );

      // Update progress in database with throttling
      if (this.progressCallback && this.shouldUpdateProgress(i + 1)) {
        try {
          await this.progressCallback(i + 1);
        } catch (error) {
          logger.warn(
            "Progress update failed, continuing processing",
            "STAGE3",
            error as Error,
          );
        }
      }

      // Save intermediate results
      await this.saveIntermediateResults(results);
    }

    const totalTime = (Date.now() - startTime) / 1000;
    logger.info(
      `Critical analysis completed in ${totalTime.toFixed(2)}s`,
      "STAGE3",
    );

    return results;
  }

  /**
   * Analyze with Phi-4 14B model
   */
  private async analyzeWithPhi4(email: Email): Promise<CriticalAnalysisResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.primaryTimeout);

    try {
      const prompt = this.buildCriticalPrompt(email);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.primaryModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.2, // Lower temperature for critical analysis
            num_predict: 1500, // More tokens for detailed analysis
            top_k: MODEL_CONFIG?.generation?.topK,
            top_p: MODEL_CONFIG?.generation?.topP,
          },
        },
        {
          signal: controller.signal,
          timeout: this.primaryTimeout,
        },
      );

      clearTimeout(timeoutId);

      const responseText = response?.data?.response;
      const analysis = this.parseCriticalResponse(responseText);
      const processingTime = (Date.now() - startTime) / 1000;

      return {
        emailId: email.id,
        executiveSummary: analysis.executive_summary || "",
        businessImpact: analysis.business_impact || {},
        keyStakeholders: analysis.key_stakeholders || [],
        recommendedActions: (analysis.recommended_actions || []).map(
          (action: any) => ({
            action: action.action || "",
            priority:
              action.priority === "HIGH" || action.priority === "CRITICAL"
                ? action.priority
                : ("HIGH" as const),
            owner: action.owner || "",
            deadline: action.deadline || "",
          }),
        ) as Array<{
          action: string;
          priority: "HIGH" | "CRITICAL";
          owner: string;
          deadline: string;
        }>,
        strategicInsights: analysis.strategic_insights || "",
        modelUsed: this.primaryModel,
        qualityScore: this.calculateCriticalQualityScore(analysis),
        processingTime,
        fallbackUsed: false,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as any).name === "AbortError") {
        throw new Error("Phi-4 timeout");
      }

      throw error;
    }
  }

  /**
   * Analyze with Llama 3.2:3b fallback
   */
  private async analyzeWithLlama(
    email: Email,
  ): Promise<CriticalAnalysisResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildCriticalPrompt(email);

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.fallbackModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 1200,
            top_k: MODEL_CONFIG?.generation?.topK,
            top_p: MODEL_CONFIG?.generation?.topP,
          },
        },
        {
          timeout: this.fallbackTimeout,
        },
      );

      const responseText = response?.data?.response;
      const analysis = this.parseCriticalResponse(responseText);
      const processingTime = (Date.now() - startTime) / 1000;

      return {
        emailId: email.id,
        executiveSummary: analysis.executive_summary || "",
        businessImpact: analysis.business_impact || {},
        keyStakeholders: analysis.key_stakeholders || [],
        recommendedActions: (analysis.recommended_actions || []).map(
          (action: any) => ({
            action: action.action || "",
            priority:
              action.priority === "HIGH" || action.priority === "CRITICAL"
                ? action.priority
                : ("HIGH" as const),
            owner: action.owner || "",
            deadline: action.deadline || "",
          }),
        ) as Array<{
          action: string;
          priority: "HIGH" | "CRITICAL";
          owner: string;
          deadline: string;
        }>,
        strategicInsights: analysis.strategic_insights || "",
        modelUsed: this.fallbackModel,
        qualityScore: this.calculateCriticalQualityScore(analysis),
        processingTime,
        fallbackUsed: true,
      };
    } catch (error: unknown) {
      logger.error(
        `Critical analysis failed for email ${email.id}`,
        "STAGE3",
        error as Error,
      );

      // Return minimal result on complete failure
      return {
        emailId: email.id,
        executiveSummary: "Analysis failed - requires manual executive review",
        businessImpact: {},
        keyStakeholders: [],
        recommendedActions: [
          {
            action: "Manual review required",
            priority: "HIGH",
            owner: "Executive Team",
            deadline: "Immediate",
          },
        ],
        strategicInsights: "",
        modelUsed: "failed",
        qualityScore: 0,
        processingTime: (Date.now() - startTime) / 1000,
        fallbackUsed: true,
      };
    }
  }

  /**
   * Build critical analysis prompt
   */
  private buildCriticalPrompt(email: Email): string {
    return `You are analyzing a critical business email for executive decision-making. Provide deep insights and strategic recommendations.

Subject: ${email.subject}
From: ${email.sender_email}
Body: ${email.body}

Provide a comprehensive JSON analysis with the following structure:
{
  "executive_summary": "A concise executive summary highlighting key business implications (100-150 words)",
  "business_impact": {
    "revenue": "Potential revenue impact or opportunity",
    "risk": "Key risks and mitigation strategies",
    "opportunity": "Strategic opportunities identified"
  },
  "key_stakeholders": ["List of key stakeholders who should be informed"],
  "recommended_actions": [
    {
      "action": "Specific strategic action",
      "priority": "HIGH or CRITICAL",
      "owner": "Suggested executive owner",
      "deadline": "Recommended timeline"
    }
  ],
  "strategic_insights": "Deep analysis of long-term implications and strategic considerations (100-200 words)"
}

Focus on:
1. Business-critical decisions and their implications
2. Risk assessment and mitigation
3. Strategic opportunities and competitive advantages
4. Cross-functional impacts and dependencies
5. Executive-level recommendations

Provide actionable, strategic insights suitable for C-level decision-making.
Respond ONLY with valid JSON, no additional text.`;
  }

  /**
   * Parse critical response - Returns structured critical analysis object
   */
  private parseCriticalResponse(responseText: string): {
    executive_summary?: string;
    business_impact?: {
      revenue?: string;
      risk?: string;
      opportunity?: string;
    };
    key_stakeholders?: string[];
    recommended_actions?: Array<{
      action: string;
      priority: "HIGH" | "CRITICAL" | string;
      owner: string;
      deadline: string;
    }>;
    strategic_insights?: string;
  } {
    try {
      // Clean response if needed
      let cleanedText = responseText;
      const jsonSplit = responseText.split("```json");
      const codeSplit = responseText.split("```");

      if (jsonSplit?.length || 0 > 1 && jsonSplit[1]) {
        const afterJson = jsonSplit[1];
        const endSplit = afterJson.split("```");
        cleanedText =
          endSplit?.length || 0 > 0 && endSplit[0] ? endSplit[0] : afterJson;
      } else if (codeSplit?.length || 0 > 1 && codeSplit[1]) {
        const afterCode = codeSplit[1];
        const endSplit = afterCode.split("```");
        cleanedText =
          endSplit?.length || 0 > 0 && endSplit[0] ? endSplit[0] : afterCode;
      }

      return JSON.parse(cleanedText.trim());
    } catch (error) {
      logger.warn("Failed to parse critical response as JSON", "STAGE3");

      // Return a basic structure
      return {
        executive_summary: responseText.substring(0, 300),
        business_impact: {},
        key_stakeholders: [],
        recommended_actions: [],
        strategic_insights: "",
      };
    }
  }

  /**
   * Calculate quality score for critical analysis
   */
  private calculateCriticalQualityScore(analysis: {
    executive_summary?: string;
    business_impact?: Record<string, any>;
    recommended_actions?: any[];
    strategic_insights?: string;
  }): number {
    let score = 0;
    const weights = {
      executiveSummary: 0.25,
      businessImpact: 0.25,
      recommendedActions: 0.25,
      strategicInsights: 0.25,
    };

    // Executive summary quality
    if (analysis.executive_summary && analysis?.executive_summary?.length > 100) {
      score += weights.executiveSummary * 10;
    }

    // Business impact assessment
    const impactKeys = Object.keys(analysis.business_impact || {});
    if (impactKeys?.length || 0 >= 2) {
      score += weights.businessImpact * 10;
    }

    // Recommended actions
    if (
      analysis.recommended_actions &&
      analysis?.recommended_actions?.length > 0
    ) {
      const actionQuality = (analysis.recommended_actions as unknown[]).every(
        (a: unknown) => {
          const action = a as Record<string, unknown>;
          return (
            action.action && action.priority && action.owner && action.deadline
          );
        },
      );
      score += weights.recommendedActions * (actionQuality ? 10 : 5);
    }

    // Strategic insights
    if (
      analysis.strategic_insights &&
      analysis?.strategic_insights?.length > 100
    ) {
      score += weights.strategicInsights * 10;
    }

    return Math.min(score, 10);
  }

  /**
   * Save intermediate results for resumability
   */
  private async saveIntermediateResults(
    results: CriticalAnalysisResult[],
  ): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const path = "stage3_intermediate_results.json";
      await fs.writeFile(path, JSON.stringify(results, null, 2));
    } catch (error) {
      logger.warn(
        "Failed to save intermediate results",
        "STAGE3",
        error as Error,
      );
    }
  }
}
