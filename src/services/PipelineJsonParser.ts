/**
 * Service for parsing JSON data from pipeline analysis results
 * Implements safe parsing with validation and fallback values
 */

import { logger } from "../utils/logger.js";
import type {
  LlamaAnalysisData,
  Phi4AnalysisData,
  WorkflowState,
  PriorityLevel,
  BusinessProcess,
  ValidationResult,
} from "../types/pipeline-analysis.js";
import type {
  ExtractedEntities,
  ActionItem,
  BusinessImpact,
} from "../types/analysis-results.js";

export class PipelineJsonParser {
  private readonly logger = logger;

  /**
   * Parse Llama 3.2:3b analysis JSON with validation
   */
  parseLlamaAnalysis(jsonStr: string | null): Partial<LlamaAnalysisData> {
    if (!jsonStr) {
      this.logger.debug("No Llama analysis JSON provided, returning defaults");
      return this.getDefaultLlamaAnalysis();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = this.validateLlamaAnalysis(parsed);

      if (validated.errors.length > 0) {
        this.logger.warn(
          `Llama analysis validation warnings - warnings: ${validated.warnings.join(", ")}, errors: ${validated.errors.join(", ")}`,
        );
      }

      return this.normalizeLlamaAnalysis(parsed);
    } catch (error) {
      this.logger.error(
        `Failed to parse Llama analysis JSON - error: ${error instanceof Error ? error.message : "Unknown error"}, jsonPreview: ${jsonStr.substring(0, 100)}`,
      );
      return this.getDefaultLlamaAnalysis();
    }
  }

  /**
   * Parse Phi-4 14B analysis JSON with validation
   */
  parsePhi4Analysis(jsonStr: string | null): Partial<Phi4AnalysisData> {
    if (!jsonStr) {
      this.logger.debug("No Phi4 analysis JSON provided, returning defaults");
      return this.getDefaultPhi4Analysis();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = this.validatePhi4Analysis(parsed);

      if (validated.errors.length > 0) {
        this.logger.warn(
          `Phi4 analysis validation warnings - warnings: ${validated.warnings.join(", ")}, errors: ${validated.errors.join(", ")}`,
        );
      }

      return this.normalizePhi4Analysis(parsed);
    } catch (error) {
      this.logger.error(
        `Failed to parse Phi4 analysis JSON - error: ${error instanceof Error ? error.message : "Unknown error"}, jsonPreview: ${jsonStr.substring(0, 100)}`,
      );
      return this.getDefaultPhi4Analysis();
    }
  }

  /**
   * Extract entities from Llama analysis data
   */
  extractEntities(llamaData: Partial<LlamaAnalysisData>): ExtractedEntities {
    const entities = llamaData.entities || {};

    return {
      po_numbers: this.normalizeArray((entities as any).po_numbers),
      quote_numbers: this.normalizeArray((entities as any).quote_numbers),
      case_numbers: this.normalizeArray((entities as any).case_numbers),
      part_numbers: this.normalizeArray((entities as any).part_numbers),
      companies: this.normalizeArray((entities as any).companies),
      contacts: this.normalizeArray((entities as any).contacts),
      reference_numbers: this.normalizeArray(
        (entities as any).reference_numbers,
      ),
      order_references: this.extractOrderReferences(entities),
    };
  }

  /**
   * Map workflow state string to enum
   */
  mapWorkflowState(state: string | undefined): WorkflowState {
    const stateMap: Record<string, WorkflowState> = {
      new: "NEW",
      start_point: "NEW",
      in_progress: "IN_PROGRESS",
      "in progress": "IN_PROGRESS",
      waiting: "WAITING",
      complete: "COMPLETE",
      completed: "COMPLETE",
      blocked: "BLOCKED",
      cancelled: "CANCELLED",
    };

    const normalized = (state || "").toLowerCase().trim();
    return stateMap[normalized] || "NEW";
  }

  /**
   * Map priority score to priority level
   */
  mapPriorityScore(score: number): PriorityLevel {
    if (score >= 8) return "Critical";
    if (score >= 6) return "High";
    if (score >= 4) return "Medium";
    return "Low";
  }

  /**
   * Map business process string to enum
   */
  mapBusinessProcess(process: string | undefined): BusinessProcess {
    const processMap: Record<string, BusinessProcess> = {
      "order management": "Order Management",
      order: "Order Management",
      "quote processing": "Quote Processing",
      quote: "Quote Processing",
      "customer support": "Customer Support",
      support: "Customer Support",
      "technical support": "Technical Support",
      "tech support": "Technical Support",
      billing: "Billing",
      invoice: "Billing",
      general: "General",
    };

    const normalized = (process || "").toLowerCase().trim();
    return processMap[normalized] || "General";
  }

  /**
   * Convert action items to standardized format
   */
  parseActionItems(items: any[]): ActionItem[] {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => ({
        task: String(item.task || item.description || ""),
        priority: this.mapPriorityLevel(item.priority),
        deadline: this.parseDeadline(item.deadline),
        owner: item.owner || item.assignee || undefined,
        status: "Pending" as const,
      }))
      .filter((item) => item.task.length > 0);
  }

  /**
   * Parse business impact data
   */
  parseBusinessImpact(llamaImpact: any, phi4Impact: any): BusinessImpact {
    const revenue =
      phi4Impact?.revenue_impact || llamaImpact?.revenue || undefined;
    const satisfaction = this.parseCustomerSatisfaction(
      phi4Impact?.customer_satisfaction || llamaImpact?.customer_satisfaction,
    );
    const urgencyReason =
      phi4Impact?.urgency_reason ||
      llamaImpact?.urgency_reason ||
      "Standard processing required";
    const riskLevel = this.parseRiskLevel(phi4Impact?.risk_assessment);

    return {
      revenue: revenue,
      customerSatisfaction: satisfaction,
      urgencyReason: urgencyReason,
      riskLevel: riskLevel,
    };
  }

  // Private helper methods

  private validateLlamaAnalysis(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== "object") {
      errors.push("Invalid Llama analysis data structure");
      return { isValid: false, errors, warnings };
    }

    // Check required fields
    if (!data.workflow_state) warnings.push("Missing workflow_state");
    if (!data.business_process) warnings.push("Missing business_process");
    if (!data.entities) warnings.push("Missing entities object");
    if (!data.contextual_summary) warnings.push("Missing contextual_summary");

    // Validate nested structures
    if (data.entities && typeof data.entities !== "object") {
      errors.push("Invalid entities structure");
    }

    if (data.action_items && !Array.isArray(data.action_items)) {
      errors.push("action_items must be an array");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validatePhi4Analysis(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== "object") {
      errors.push("Invalid Phi4 analysis data structure");
      return { isValid: false, errors, warnings };
    }

    // Check required fields
    if (!data.executive_summary) warnings.push("Missing executive_summary");
    if (!data.business_impact) warnings.push("Missing business_impact");
    if (!data.sla_assessment) warnings.push("Missing sla_assessment");

    // Validate nested structures
    if (data.business_impact && typeof data.business_impact !== "object") {
      errors.push("Invalid business_impact structure");
    }

    if (data.deep_insights && !Array.isArray(data.deep_insights)) {
      errors.push("deep_insights must be an array");
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private normalizeLlamaAnalysis(data: any): Partial<LlamaAnalysisData> {
    return {
      workflow_state: data.workflow_state || "NEW",
      business_process: data.business_process || "General",
      intent: data.intent || "Information",
      urgency_level: data.urgency_level || "Medium",
      entities: this.normalizeEntities(data.entities),
      contextual_summary: data.contextual_summary || "",
      action_items: this.normalizeActionItems(data.action_items),
      suggested_response: data.suggested_response,
      quality_score: this.normalizeQualityScore(data.quality_score),
      sla_status: data.sla_status,
      business_impact: data.business_impact,
    };
  }

  private normalizePhi4Analysis(data: any): Partial<Phi4AnalysisData> {
    return {
      executive_summary: data.executive_summary || "",
      business_impact: this.normalizeBusinessImpact(data.business_impact),
      sla_assessment: data.sla_assessment || "",
      deep_insights: this.normalizeArray(data.deep_insights),
      strategic_recommendations: this.normalizeArray(
        data.strategic_recommendations,
      ),
      quality_score: this.normalizeQualityScore(data.quality_score),
      confidence_level: data.confidence_level,
    };
  }

  private normalizeEntities(entities: any): LlamaAnalysisData["entities"] {
    if (!entities || typeof entities !== "object") {
      return {
        po_numbers: [],
        quote_numbers: [],
        case_numbers: [],
        part_numbers: [],
        companies: [],
      };
    }

    return {
      po_numbers: this.normalizeArray(entities.po_numbers),
      quote_numbers: this.normalizeArray(entities.quote_numbers),
      case_numbers: this.normalizeArray(entities.case_numbers),
      part_numbers: this.normalizeArray(entities.part_numbers),
      companies: this.normalizeArray(entities.companies),
      contacts: this.normalizeArray(entities.contacts),
      reference_numbers: this.normalizeArray(entities.reference_numbers),
    };
  }

  private normalizeActionItems(items: any): LlamaAnalysisData["action_items"] {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => ({
        task: String(item.task || item.description || ""),
        priority: String(item.priority || "Medium"),
        deadline: item.deadline,
        owner: item.owner,
      }))
      .filter((item) => item.task.length > 0);
  }

  private normalizeBusinessImpact(
    impact: any,
  ): Phi4AnalysisData["business_impact"] {
    if (!impact || typeof impact !== "object") {
      return {
        customer_satisfaction: "Neutral",
        urgency_reason: "Standard processing",
      };
    }

    return {
      revenue_impact: impact.revenue_impact,
      customer_satisfaction: impact.customer_satisfaction || "Neutral",
      urgency_reason: impact.urgency_reason || "Standard processing",
      risk_assessment: impact.risk_assessment,
    };
  }

  private normalizeArray(arr: any): string[] {
    if (!arr) return [];
    if (!Array.isArray(arr)) return [String(arr)];
    return arr.map((item) => String(item)).filter((item) => item.length > 0);
  }

  private normalizeQualityScore(score: any): number {
    const parsed = parseFloat(score);
    if (isNaN(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), 10);
  }

  private extractOrderReferences(entities: any): string[] {
    const references: string[] = [];

    // Combine various order-related references
    if (entities.po_numbers) references.push(...entities.po_numbers);
    if (entities.so_numbers) references.push(...entities.so_numbers);
    if (entities.order_numbers) references.push(...entities.order_numbers);

    return [...new Set(references)]; // Remove duplicates
  }

  private mapPriorityLevel(priority: any): PriorityLevel {
    const priorityMap: Record<string, PriorityLevel> = {
      critical: "Critical",
      high: "High",
      medium: "Medium",
      low: "Low",
    };

    const normalized = String(priority || "medium").toLowerCase();
    return priorityMap[normalized] || "Medium";
  }

  private parseDeadline(deadline: any): string | undefined {
    if (!deadline) return undefined;

    // Try to parse as date
    const date = new Date(deadline);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Return as string if valid
    const str = String(deadline).trim();
    return str.length > 0 ? str : undefined;
  }

  private parseCustomerSatisfaction(
    satisfaction: any,
  ): BusinessImpact["customerSatisfaction"] {
    const satisfactionMap: Record<
      string,
      BusinessImpact["customerSatisfaction"]
    > = {
      positive: "Positive",
      neutral: "Neutral",
      negative: "Negative",
      critical: "Critical",
    };

    const normalized = String(satisfaction || "neutral").toLowerCase();
    return satisfactionMap[normalized] || "Neutral";
  }

  private parseRiskLevel(risk: any): "High" | "Medium" | "Low" | undefined {
    if (!risk) return undefined;

    const riskMap: Record<string, "High" | "Medium" | "Low"> = {
      high: "High",
      medium: "Medium",
      low: "Low",
    };

    const normalized = String(risk).toLowerCase();
    return riskMap[normalized];
  }

  private getDefaultLlamaAnalysis(): Partial<LlamaAnalysisData> {
    return {
      workflow_state: "NEW",
      business_process: "General",
      intent: "Information",
      urgency_level: "Medium",
      entities: {
        po_numbers: [],
        quote_numbers: [],
        case_numbers: [],
        part_numbers: [],
        companies: [],
      },
      contextual_summary: "",
      action_items: [],
      quality_score: 0,
    };
  }

  private getDefaultPhi4Analysis(): Partial<Phi4AnalysisData> {
    return {
      executive_summary: "",
      business_impact: {
        customer_satisfaction: "Neutral",
        urgency_reason: "Standard processing",
      },
      sla_assessment: "",
      deep_insights: [],
      quality_score: 0,
    };
  }
}
