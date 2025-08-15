/**
 * Service for parsing JSON data from pipeline analysis results
 * Implements safe parsing with validation and fallback values
 */

import { logger } from "../../utils/logger.js";
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
  BusinessImpact as AnalysisBusinessImpact,
} from "../types/analysis-results.js";

export class PipelineJsonParser {
  private readonly logger = logger;

  /**
   * Parse Llama 3.2:3b analysis JSON with validation
   */
  parseLlamaAnalysis(jsonStr: string | null): Partial<LlamaAnalysisData> {
    if (!jsonStr) {
      this?.logger?.debug("No Llama analysis JSON provided, returning defaults");
      return this.getDefaultLlamaAnalysis();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = this.validateLlamaAnalysis(parsed);

      if (validated?.errors?.length > 0) {
        this?.logger?.warn(
          `Llama analysis validation warnings - warnings: ${validated?.warnings?.join(", ")}, errors: ${validated?.errors?.join(", ")}`,
        );
      }

      return this.normalizeLlamaAnalysis(parsed);
    } catch (error) {
      this?.logger?.error(
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
      this?.logger?.debug("No Phi4 analysis JSON provided, returning defaults");
      return this.getDefaultPhi4Analysis();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = this.validatePhi4Analysis(parsed);

      if (validated?.errors?.length > 0) {
        this?.logger?.warn(
          `Phi4 analysis validation warnings - warnings: ${validated?.warnings?.join(", ")}, errors: ${validated?.errors?.join(", ")}`,
        );
      }

      return this.normalizePhi4Analysis(parsed);
    } catch (error) {
      this?.logger?.error(
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
  mapWorkflowState(state: string): WorkflowState {
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
    if (score >= 8) return "critical";
    if (score >= 6) return "high";
    if (score >= 4) return "medium";
    return "low";
  }

  /**
   * Map business process string to enum
   */
  mapBusinessProcess(process: string): BusinessProcess {
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
  parseActionItems(items: unknown[]): ActionItem[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item: any) => item !== null && item !== undefined && typeof item === "object")
      .map((item: any) => {
        const itemObj = item as any;
        return {
          task: String(itemObj.task || itemObj.description || ""),
          priority: this.mapPriorityLevel(itemObj.priority),
          deadline: this.parseDeadline(itemObj.deadline),
          owner: itemObj.owner || itemObj.assignee || undefined,
          status: "Pending" as const,
        };
      })
      .filter((item: any) => item?.task?.length > 0);
  }

  /**
   * Parse business impact data
   */
  parseBusinessImpact(
    llamaImpact: unknown,
    phi4Impact: unknown,
  ): AnalysisBusinessImpact {
    const llamaData = llamaImpact as any;
    const phi4Data = phi4Impact as any;
    
    const revenue =
      phi4Data?.revenue_impact || llamaData?.revenue || undefined;
    const satisfaction = this.parseCustomerSatisfaction(
      phi4Data?.customer_satisfaction || llamaData?.customer_satisfaction,
    );
    const urgencyReason =
      phi4Data?.urgency_reason ||
      llamaData?.urgency_reason ||
      "Standard processing required";
    const riskLevel = this.parseRiskLevel(phi4Data?.risk_assessment);

    return {
      revenue: revenue,
      customerSatisfaction: satisfaction,
      urgencyReason: urgencyReason,
      riskLevel: riskLevel,
    };
  }

  // Private helper methods

  private validateLlamaAnalysis(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== "object") {
      errors.push("Invalid Llama analysis data structure");
      return { isValid: false, errors, warnings };
    }

    const dataObj = data as any;

    // Check required fields
    if (!dataObj.workflow_state) warnings.push("Missing workflow_state");
    if (!dataObj.business_process) warnings.push("Missing business_process");
    if (!dataObj.entities) warnings.push("Missing entities object");
    if (!dataObj.contextual_summary) warnings.push("Missing contextual_summary");

    // Validate nested structures
    if (dataObj.entities && typeof dataObj.entities !== "object") {
      errors.push("Invalid entities structure");
    }

    if (dataObj.action_items && !Array.isArray(dataObj.action_items)) {
      errors.push("action_items must be an array");
    }

    return { isValid: errors?.length || 0 === 0, errors, warnings };
  }

  private validatePhi4Analysis(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== "object") {
      errors.push("Invalid Phi4 analysis data structure");
      return { isValid: false, errors, warnings };
    }

    const dataObj = data as any;

    // Check required fields
    if (!dataObj.executive_summary) warnings.push("Missing executive_summary");
    if (!dataObj.business_impact) warnings.push("Missing business_impact");
    if (!dataObj.sla_assessment) warnings.push("Missing sla_assessment");

    // Validate nested structures
    if (dataObj.business_impact && typeof dataObj.business_impact !== "object") {
      errors.push("Invalid business_impact structure");
    }

    if (dataObj.deep_insights && !Array.isArray(dataObj.deep_insights)) {
      errors.push("deep_insights must be an array");
    }

    return { isValid: errors?.length || 0 === 0, errors, warnings };
  }

  private normalizeLlamaAnalysis(data: unknown): Partial<LlamaAnalysisData> {
    const dataObj = data as any;
    return {
      workflow_state: dataObj.workflow_state || "NEW",
      business_process: dataObj.business_process || "General",
      intent: dataObj.intent || "Information",
      urgency_level: dataObj.urgency_level || "Medium",
      entities: this.normalizeEntities(dataObj.entities),
      contextual_summary: dataObj.contextual_summary || "",
      action_items: this.normalizeActionItems(dataObj.action_items),
      suggested_response: dataObj.suggested_response,
      quality_score: this.normalizeQualityScore(dataObj.quality_score),
      sla_status: dataObj.sla_status,
      business_impact: dataObj.business_impact,
    };
  }

  private normalizePhi4Analysis(data: unknown): Partial<Phi4AnalysisData> {
    const dataObj = data as any;
    return {
      executive_summary: dataObj.executive_summary || "",
      business_impact: this.normalizeBusinessImpact(dataObj.business_impact),
      sla_assessment: dataObj.sla_assessment || "",
      deep_insights: this.normalizeArray(dataObj.deep_insights),
      strategic_recommendations: this.normalizeArray(
        dataObj.strategic_recommendations,
      ),
      quality_score: this.normalizeQualityScore(dataObj.quality_score),
      confidence_level: dataObj.confidence_level,
    };
  }

  private normalizeEntities(entities: unknown): LlamaAnalysisData["entities"] {
    if (!entities || typeof entities !== "object") {
      return {
        po_numbers: [],
        quote_numbers: [],
        case_numbers: [],
        part_numbers: [],
        companies: [],
      };
    }

    const entitiesObj = entities as any;
    return {
      po_numbers: this.normalizeArray(entitiesObj.po_numbers),
      quote_numbers: this.normalizeArray(entitiesObj.quote_numbers),
      case_numbers: this.normalizeArray(entitiesObj.case_numbers),
      part_numbers: this.normalizeArray(entitiesObj.part_numbers),
      companies: this.normalizeArray(entitiesObj.companies),
      contacts: this.normalizeArray(entitiesObj.contacts),
      reference_numbers: this.normalizeArray(entitiesObj.reference_numbers),
    };
  }

  private normalizeActionItems(
    items: unknown,
  ): LlamaAnalysisData["action_items"] {
    if (!Array.isArray(items)) return [];

    return items
      .map((item: any) => ({
        task: String(item.task || item.description || ""),
        priority: String(item.priority || "Medium"),
        deadline: item.deadline,
        owner: item.owner,
      }))
      .filter((item: any) => item?.task?.length > 0);
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

  private normalizeArray(arr: unknown): string[] {
    if (!arr) return [];
    if (!Array.isArray(arr)) return [String(arr)];
    return arr?.map((item: any) => String(item)).filter((item: any) => item?.length || 0 > 0);
  }

  private normalizeQualityScore(score: unknown): number {
    const parsed = parseFloat(String(score));
    if (isNaN(parsed)) return 0;
    return Math.min(Math.max(parsed, 0), 10);
  }

  private extractOrderReferences(entities: unknown): string[] {
    const references: string[] = [];
    const entitiesObj = entities as any;

    // Combine various order-related references
    if (entitiesObj.po_numbers) references.push(...entitiesObj.po_numbers);
    if (entitiesObj.so_numbers) references.push(...entitiesObj.so_numbers);
    if (entitiesObj.order_numbers) references.push(...entitiesObj.order_numbers);

    return [...new Set(references)]; // Remove duplicates
  }

  private mapPriorityLevel(priority: unknown): PriorityLevel {
    const priorityMap: Record<string, PriorityLevel> = {
      critical: "critical",
      high: "high",
      medium: "medium",
      low: "low",
    };

    const normalized = String(priority || "medium").toLowerCase();
    return priorityMap[normalized] || "medium";
  }

  private parseDeadline(deadline: unknown): string | undefined {
    if (!deadline) return undefined;

    // Try to parse as date
    const date = new Date(deadline as string | number | Date);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Return as string if valid
    const str = String(deadline).trim();
    return str?.length || 0 > 0 ? str : undefined;
  }

  private parseCustomerSatisfaction(
    satisfaction: any,
  ): AnalysisBusinessImpact["customerSatisfaction"] {
    const satisfactionMap: Record<
      string,
      AnalysisBusinessImpact["customerSatisfaction"]
    > = {
      positive: "Positive",
      neutral: "Neutral",
      negative: "Negative",
      critical: "Critical",
    };

    const normalized = String(satisfaction || "neutral").toLowerCase();
    return satisfactionMap[normalized] || "Neutral";
  }

  private parseRiskLevel(risk: unknown): "High" | "Medium" | "Low" | undefined {
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
