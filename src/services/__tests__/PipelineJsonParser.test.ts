/**
 * Unit tests for PipelineJsonParser service
 */

import { describe, it, expect } from "vitest";
import { PipelineJsonParser } from "../PipelineJsonParser";

describe("PipelineJsonParser", () => {
  let parser: PipelineJsonParser;

  beforeEach(() => {
    parser = new PipelineJsonParser();
  });

  describe("parseLlamaAnalysis", () => {
    it("should parse valid Llama analysis JSON", () => {
      const validJson = JSON.stringify({
        workflow_state: "IN_PROGRESS",
        business_process: "Order Management",
        intent: "Request",
        urgency_level: "High",
        entities: {
          po_numbers: ["PO12345678", "PO87654321"],
          quote_numbers: ["Q-2024-001"],
          case_numbers: ["CAS-123456"],
          part_numbers: ["PN123", "PN456"],
          companies: ["ACME Corp", "Tech Solutions Inc"],
        },
        contextual_summary: "Urgent order processing request for multiple POs",
        action_items: [
          {
            task: "Process PO12345678",
            priority: "High",
            deadline: "2024-01-15",
            owner: "Order Processing Team",
          },
        ],
        suggested_response: "We will process your order immediately.",
        quality_score: 8.5,
      });

      const result = parser.parseLlamaAnalysis(validJson);

      expect(result.workflow_state).toBe("IN_PROGRESS");
      expect(result.business_process).toBe("Order Management");
      expect(result.entities?.po_numbers).toHaveLength(2);
      expect(result.entities?.quote_numbers).toHaveLength(1);
      expect(result.action_items).toHaveLength(1);
      expect(result.quality_score).toBe(8.5);
    });

    it("should handle null JSON gracefully", () => {
      const result = parser.parseLlamaAnalysis(null);

      expect(result.workflow_state).toBe("NEW");
      expect(result.business_process).toBe("General");
      expect(result.entities?.po_numbers).toEqual([]);
      expect(result.action_items).toEqual([]);
    });

    it("should handle malformed JSON gracefully", () => {
      const malformedJson = "{ invalid json }";
      const result = parser.parseLlamaAnalysis(malformedJson);

      expect(result.workflow_state).toBe("NEW");
      expect(result.business_process).toBe("General");
      expect(result.entities).toBeDefined();
    });

    it("should handle missing fields with defaults", () => {
      const incompleteJson = JSON.stringify({
        workflow_state: "COMPLETE",
        // Missing other fields
      });

      const result = parser.parseLlamaAnalysis(incompleteJson);

      expect(result.workflow_state).toBe("COMPLETE");
      expect(result.business_process).toBe("General");
      expect(result.entities?.po_numbers).toEqual([]);
      expect(result.contextual_summary).toBe("");
    });

    it("should normalize entity arrays correctly", () => {
      const jsonWithMixedEntities = JSON.stringify({
        entities: {
          po_numbers: "PO12345678", // String instead of array
          quote_numbers: null, // Null
          case_numbers: ["CAS-123", "CAS-456"], // Proper array
          part_numbers: [], // Empty array
        },
      });

      const result = parser.parseLlamaAnalysis(jsonWithMixedEntities);

      expect(result.entities?.po_numbers).toEqual(["PO12345678"]);
      expect(result.entities?.quote_numbers).toEqual([]);
      expect(result.entities?.case_numbers).toEqual(["CAS-123", "CAS-456"]);
      expect(result.entities?.part_numbers).toEqual([]);
    });
  });

  describe("parsePhi4Analysis", () => {
    it("should parse valid Phi4 analysis JSON", () => {
      const validJson = JSON.stringify({
        executive_summary: "Critical order requiring immediate attention",
        business_impact: {
          revenue_impact: 50000,
          customer_satisfaction: "Critical",
          urgency_reason: "Major customer at risk",
          risk_assessment: "High",
        },
        sla_assessment: "At risk - 2 hours remaining",
        deep_insights: [
          "Customer has escalated to executive level",
          "Order contains critical parts for production line",
        ],
        strategic_recommendations: [
          "Expedite shipping",
          "Assign senior account manager",
        ],
        quality_score: 9.2,
        confidence_level: 0.95,
      });

      const result = parser.parsePhi4Analysis(validJson);

      expect(result.executive_summary).toBe(
        "Critical order requiring immediate attention",
      );
      expect(result.business_impact?.revenue_impact).toBe(50000);
      expect(result.business_impact?.customer_satisfaction).toBe("Critical");
      expect(result.deep_insights).toHaveLength(2);
      expect(result.quality_score).toBe(9.2);
    });

    it("should handle null JSON gracefully", () => {
      const result = parser.parsePhi4Analysis(null);

      expect(result.executive_summary).toBe("");
      expect(result.business_impact?.customer_satisfaction).toBe("Neutral");
      expect(result.deep_insights).toEqual([]);
    });
  });

  describe("extractEntities", () => {
    it("should extract all entity types correctly", () => {
      const llamaData = {
        entities: {
          po_numbers: ["PO12345678"],
          quote_numbers: ["Q-2024-001"],
          case_numbers: ["CAS-123456"],
          part_numbers: ["PN123", "PN456"],
          companies: ["ACME Corp"],
          contacts: ["john@acme.com"],
          reference_numbers: ["REF-789"],
        },
      };

      const result = parser.extractEntities(llamaData);

      expect(result.po_numbers).toEqual(["PO12345678"]);
      expect(result.quote_numbers).toEqual(["Q-2024-001"]);
      expect(result.case_numbers).toEqual(["CAS-123456"]);
      expect(result.part_numbers).toEqual(["PN123", "PN456"]);
      expect(result.companies).toEqual(["ACME Corp"]);
      expect(result.contacts).toEqual(["john@acme.com"]);
      expect(result.reference_numbers).toEqual(["REF-789"]);
      expect(result.order_references).toContain("PO12345678");
    });

    it("should handle missing entities gracefully", () => {
      const emptyData = {};
      const result = parser.extractEntities(emptyData);

      expect(result.po_numbers).toEqual([]);
      expect(result.quote_numbers).toEqual([]);
      expect(result.case_numbers).toEqual([]);
      expect(result.part_numbers).toEqual([]);
      expect(result.companies).toEqual([]);
      expect(result.contacts).toEqual([]);
      expect(result.reference_numbers).toEqual([]);
      expect(result.order_references).toEqual([]);
    });
  });

  describe("mapWorkflowState", () => {
    it("should map workflow states correctly", () => {
      expect(parser.mapWorkflowState("new")).toBe("NEW");
      expect(parser.mapWorkflowState("start_point")).toBe("NEW");
      expect(parser.mapWorkflowState("in_progress")).toBe("IN_PROGRESS");
      expect(parser.mapWorkflowState("in progress")).toBe("IN_PROGRESS");
      expect(parser.mapWorkflowState("waiting")).toBe("WAITING");
      expect(parser.mapWorkflowState("complete")).toBe("COMPLETE");
      expect(parser.mapWorkflowState("completed")).toBe("COMPLETE");
      expect(parser.mapWorkflowState("blocked")).toBe("BLOCKED");
      expect(parser.mapWorkflowState("cancelled")).toBe("CANCELLED");
    });

    it("should handle unknown states with default", () => {
      expect(parser.mapWorkflowState("unknown")).toBe("NEW");
      expect(parser.mapWorkflowState(undefined)).toBe("NEW");
      expect(parser.mapWorkflowState("")).toBe("NEW");
    });
  });

  describe("mapPriorityScore", () => {
    it("should map priority scores to levels correctly", () => {
      expect(parser.mapPriorityScore(10)).toBe("Critical");
      expect(parser.mapPriorityScore(8)).toBe("Critical");
      expect(parser.mapPriorityScore(7)).toBe("High");
      expect(parser.mapPriorityScore(6)).toBe("High");
      expect(parser.mapPriorityScore(5)).toBe("Medium");
      expect(parser.mapPriorityScore(4)).toBe("Medium");
      expect(parser.mapPriorityScore(3)).toBe("Low");
      expect(parser.mapPriorityScore(0)).toBe("Low");
    });
  });

  describe("mapBusinessProcess", () => {
    it("should map business processes correctly", () => {
      expect(parser.mapBusinessProcess("order management")).toBe(
        "Order Management",
      );
      expect(parser.mapBusinessProcess("order")).toBe("Order Management");
      expect(parser.mapBusinessProcess("quote processing")).toBe(
        "Quote Processing",
      );
      expect(parser.mapBusinessProcess("quote")).toBe("Quote Processing");
      expect(parser.mapBusinessProcess("customer support")).toBe(
        "Customer Support",
      );
      expect(parser.mapBusinessProcess("support")).toBe("Customer Support");
      expect(parser.mapBusinessProcess("technical support")).toBe(
        "Technical Support",
      );
      expect(parser.mapBusinessProcess("tech support")).toBe(
        "Technical Support",
      );
      expect(parser.mapBusinessProcess("billing")).toBe("Billing");
      expect(parser.mapBusinessProcess("invoice")).toBe("Billing");
      expect(parser.mapBusinessProcess("general")).toBe("General");
    });

    it("should handle unknown processes with default", () => {
      expect(parser.mapBusinessProcess("unknown")).toBe("General");
      expect(parser.mapBusinessProcess(undefined)).toBe("General");
      expect(parser.mapBusinessProcess("")).toBe("General");
    });
  });

  describe("parseActionItems", () => {
    it("should parse action items correctly", () => {
      const items = [
        {
          task: "Process order",
          priority: "high",
          deadline: "2024-01-15",
          owner: "John Doe",
        },
        {
          description: "Review quote", // Using description instead of task
          priority: "medium",
        },
      ];

      const result = parser.parseActionItems(items);

      expect(result).toHaveLength(2);
      expect(result[0].task).toBe("Process order");
      expect(result[0].priority).toBe("High");
      expect(result[0].deadline).toBe("2024-01-15");
      expect(result[0].owner).toBe("John Doe");
      expect(result[0].status).toBe("Pending");

      expect(result[1].task).toBe("Review quote");
      expect(result[1].priority).toBe("Medium");
      expect(result[1].deadline).toBeUndefined();
      expect(result[1].owner).toBeUndefined();
    });

    it("should handle invalid action items", () => {
      const invalidItems = [
        { task: "" }, // Empty task
        { priority: "high" }, // Missing task
        null, // Null item
      ];

      const result = parser.parseActionItems(invalidItems as any);

      expect(result).toHaveLength(0); // All invalid items filtered out
    });

    it("should handle non-array input", () => {
      const result = parser.parseActionItems("not an array" as any);
      expect(result).toEqual([]);
    });
  });

  describe("parseBusinessImpact", () => {
    it("should combine Llama and Phi4 business impact data", () => {
      const llamaImpact = {
        revenue: "25000",
        customer_satisfaction: "Negative",
      };

      const phi4Impact = {
        revenue_impact: 50000,
        customer_satisfaction: "Critical",
        urgency_reason: "Major customer escalation",
        risk_assessment: "High",
      };

      const result = parser.parseBusinessImpact(llamaImpact, phi4Impact);

      expect(result.revenue).toBe(50000); // Phi4 takes precedence
      expect(result.customerSatisfaction).toBe("Critical");
      expect(result.urgencyReason).toBe("Major customer escalation");
      expect(result.riskLevel).toBe("High");
    });

    it("should handle missing impact data", () => {
      const result = parser.parseBusinessImpact(undefined, undefined);

      expect(result.revenue).toBeUndefined();
      expect(result.customerSatisfaction).toBe("Neutral");
      expect(result.urgencyReason).toBe("Standard processing required");
      expect(result.riskLevel).toBeUndefined();
    });
  });
});
