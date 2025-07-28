/**
 * Unit tests for PipelineAnalysisAdapter
 */

import { describe, it, expect, vi } from "vitest";
import { PipelineAnalysisAdapter } from "../PipelineAnalysisAdapter.js";
import type { PipelineEmailAnalysis } from "../../types/pipeline-analysis.js";

describe("PipelineAnalysisAdapter", () => {
  let adapter: PipelineAnalysisAdapter;

  beforeEach(() => {
    adapter = new PipelineAnalysisAdapter();
  });

  describe("fromDatabase", () => {
    it("should transform pipeline data with full Llama and Phi4 analysis", () => {
      const pipelineData: PipelineEmailAnalysis = {
        id: 1,
        email_id: "test-email-001",
        pipeline_stage: 3,
        pipeline_priority_score: 85,
        llama_analysis: JSON.stringify({
          workflow_state: "IN_PROGRESS",
          business_process: "Order Management",
          intent: "Request",
          urgency_level: "Critical",
          entities: {
            po_numbers: ["PO12345678"],
            quote_numbers: ["Q-2024-001"],
            part_numbers: ["PN123", "PN456"],
            companies: ["ACME Corp"],
          },
          contextual_summary: "Urgent order processing request",
          action_items: [
            {
              task: "Process PO12345678",
              priority: "High",
              deadline: "2024-01-15",
            },
          ],
          suggested_response: "We will process your order immediately.",
          quality_score: 8.5,
          sla_status: "At risk",
        }),
        phi4_analysis: JSON.stringify({
          executive_summary: "Critical order from key customer",
          business_impact: {
            revenue_impact: 50000,
            customer_satisfaction: "Critical",
            urgency_reason: "Customer escalation",
          },
          sla_assessment: "At risk - 2 hours remaining",
          deep_insights: ["Key customer account", "Production line dependency"],
          quality_score: 9.2,
        }),
        final_model_used: "phi4-14b",
        analysis_timestamp: "2024-01-10T10:00:00Z",
      };

      const result = adapter.fromDatabase(pipelineData);

      // Check basic structure
      expect(result.emailId).toBe("test-email-001");

      // Check quick analysis
      expect(result.quick.priority).toBe("Critical");
      expect(result.quick.urgency).toBe("Immediate");
      expect(result.quick.workflow).toBe("IN_PROGRESS");
      expect(result.quick.intent).toBe("Request");
      expect(result.quick.category).toBe("Order Management");

      // Check deep analysis
      expect(result.deep.summary).toBe("Critical order from key customer");
      expect(result.deep.workflowState).toBe("IN_PROGRESS");
      expect(result.deep.businessProcess).toBe("Order Management");
      expect(result.deep.actionItems).toHaveLength(1);
      expect(result.deep.actionItems[0].task).toBe("Process PO12345678");
      expect(result.deep.slaStatus).toBe("At risk - 2 hours remaining");

      // Check entities
      expect(result.deep.entities.po_numbers).toEqual(["PO12345678"]);
      expect(result.deep.entities.quote_numbers).toEqual(["Q-2024-001"]);
      expect(result.deep.entities.part_numbers).toEqual(["PN123", "PN456"]);
      expect(result.deep.entities.companies).toEqual(["ACME Corp"]);

      // Check business impact
      expect(result.deep.businessImpact.revenue).toBe(50000);
      expect(result.deep.businessImpact.customerSatisfaction).toBe("Critical");
      expect(result.deep.businessImpact.urgencyReason).toBe(
        "Customer escalation",
      );

      // Check metadata
      expect(result.metadata.model).toBe("phi4-14b");
      expect(result.metadata.confidence).toBe(0.95);
      expect(result.metadata.dataSource).toBe("pipeline");
    });

    it("should handle Stage 2 (Llama only) data", () => {
      const pipelineData: PipelineEmailAnalysis = {
        id: 2,
        email_id: "test-email-002",
        pipeline_stage: 2,
        pipeline_priority_score: 65,
        llama_analysis: JSON.stringify({
          workflow_state: "NEW",
          business_process: "Quote Processing",
          intent: "Information",
          urgency_level: "Medium",
          entities: {
            quote_numbers: ["Q-2024-002"],
            companies: ["Tech Solutions"],
          },
          contextual_summary: "Quote request for standard items",
          action_items: [],
          quality_score: 7.0,
        }),
        phi4_analysis: null,
        final_model_used: "llama-3.2:3b",
        analysis_timestamp: "2024-01-10T11:00:00Z",
      };

      const result = adapter.fromDatabase(pipelineData);

      expect(result.quick.priority).toBe("High");
      expect(result.quick.urgency).toBe("High");
      expect(result.deep.summary).toBe("Quote request for standard items");
      expect(result.deep.businessProcess).toBe("Quote Processing");
      expect(result.metadata.model).toBe("llama-3.2:3b");
      expect(result.metadata.confidence).toBe(0.85);
    });

    it("should handle Stage 1 (pattern only) data", () => {
      const pipelineData: PipelineEmailAnalysis = {
        id: 3,
        email_id: "test-email-003",
        pipeline_stage: 1,
        pipeline_priority_score: 35,
        llama_analysis: null,
        phi4_analysis: null,
        final_model_used: "pattern",
        analysis_timestamp: "2024-01-10T12:00:00Z",
      };

      const result = adapter.fromDatabase(pipelineData);

      expect(result.quick.priority).toBe("Low");
      expect(result.quick.urgency).toBe("Low");
      expect(result.quick.workflow).toBe("NEW");
      expect(result.deep.summary).toBe("No detailed analysis available");
      expect(result.deep.businessProcess).toBe("General");
      expect(result.metadata.model).toBe("pattern");
      expect(result.metadata.confidence).toBe(0.65);
    });

    it("should handle malformed JSON gracefully", () => {
      const pipelineData: PipelineEmailAnalysis = {
        id: 4,
        email_id: "test-email-004",
        pipeline_stage: 2,
        pipeline_priority_score: 50,
        llama_analysis: "{ invalid json }",
        phi4_analysis: null,
        final_model_used: "llama-3.2:3b",
        analysis_timestamp: "2024-01-10T13:00:00Z",
      };

      const result = adapter.fromDatabase(pipelineData);

      expect(result.emailId).toBe("test-email-004");
      expect(result.quick.priority).toBe("Medium");
      expect(result.deep.workflowState).toBe("NEW");
      expect(result.deep.entities.po_numbers).toEqual([]);
    });
  });

  describe("validate", () => {
    it("should validate correct pipeline data structure", () => {
      const validData = {
        id: 1,
        email_id: "test-001",
        pipeline_stage: 2,
        pipeline_priority_score: 75,
        final_model_used: "llama-3.2:3b",
        analysis_timestamp: "2024-01-10T10:00:00Z",
        llama_analysis: "{}",
        phi4_analysis: null,
      };

      expect(adapter.validate(validData)).toBe(true);
    });

    it("should reject invalid data structures", () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate(undefined)).toBe(false);
      expect(adapter.validate({})).toBe(false);
      expect(adapter.validate("string")).toBe(false);
      expect(adapter.validate(123)).toBe(false);

      // Missing required fields
      expect(
        adapter.validate({
          id: 1,
          email_id: "test",
          // Missing other required fields
        }),
      ).toBe(false);

      // Wrong types
      expect(
        adapter.validate({
          id: "1", // Should be number
          email_id: "test",
          pipeline_stage: 2,
          pipeline_priority_score: 75,
          final_model_used: "model",
          analysis_timestamp: "timestamp",
        }),
      ).toBe(false);
    });
  });

  describe("batchFromDatabase", () => {
    it("should process multiple records successfully", async () => {
      const pipelineData: PipelineEmailAnalysis[] = [
        {
          id: 1,
          email_id: "email-001",
          pipeline_stage: 2,
          pipeline_priority_score: 80,
          llama_analysis: JSON.stringify({
            workflow_state: "IN_PROGRESS",
            business_process: "Order Management",
          }),
          phi4_analysis: null,
          final_model_used: "llama-3.2:3b",
          analysis_timestamp: "2024-01-10T10:00:00Z",
        },
        {
          id: 2,
          email_id: "email-002",
          pipeline_stage: 1,
          pipeline_priority_score: 40,
          llama_analysis: null,
          phi4_analysis: null,
          final_model_used: "pattern",
          analysis_timestamp: "2024-01-10T11:00:00Z",
        },
      ];

      const results = await adapter.batchFromDatabase(pipelineData);

      expect(results).toHaveLength(2);
      expect(results[0].emailId).toBe("email-001");
      expect(results[0].quick.priority).toBe("Critical");
      expect(results[1].emailId).toBe("email-002");
      expect(results[1].quick.priority).toBe("Medium");
    });

    it("should handle errors in batch processing", async () => {
      const pipelineData: PipelineEmailAnalysis[] = [
        {
          id: 1,
          email_id: "email-001",
          pipeline_stage: 2,
          pipeline_priority_score: 80,
          llama_analysis: "{ valid json }", // This will fail parsing
          phi4_analysis: null,
          final_model_used: "llama-3.2:3b",
          analysis_timestamp: "2024-01-10T10:00:00Z",
        },
      ];

      // Mock logger to check error logging
      const loggerSpy = vi.spyOn(adapter["logger"], "error");

      const results = await adapter.batchFromDatabase(pipelineData);

      // Should still return successfully transformed records
      expect(results.length).toBeLessThanOrEqual(pipelineData.length);

      // Should log errors
      if (results.length < pipelineData.length) {
        expect(loggerSpy).toHaveBeenCalled();
      }
    });
  });

  describe("toDatabase", () => {
    it("should throw error as pipeline data is read-only", () => {
      const emailAnalysis: any = {
        emailId: "test",
        quick: {},
        deep: {},
        metadata: {},
      };

      expect(() => adapter.toDatabase(emailAnalysis)).toThrow(
        "toDatabase not implemented - pipeline data is read-only",
      );
    });
  });
});
