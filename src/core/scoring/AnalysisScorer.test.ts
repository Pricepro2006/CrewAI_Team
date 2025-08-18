import { describe, it, expect } from "vitest";
import { AnalysisScorer, scoreAnalysis, getDetailedScore } from "./AnalysisScorer";
import type { EmailAnalysis } from "../../types/AnalysisTypes";

describe("AnalysisScorer", () => {
  const createMockAnalysis = (overrides?: Partial<EmailAnalysis>): EmailAnalysis => ({
    id: "test-id",
    email_id: "email-123",
    analysis_version: "1.0.0",
    workflow_type: "Order Processing",
    phase1_results: {
      basic_classification: {
        type: "order",
        priority: "HIGH",
        urgency: true,
        requires_response: true,
      },
      entities: {
        po_numbers: ["PO123", "PO456"],
        quotes: ["Q789"],
        cases: [],
        parts: ["PART-A", "PART-B"],
        people: ["John Doe"],
        companies: ["Acme Corp"],
      },
      key_phrases: ["urgent", "asap"],
      sentiment: "neutral",
      processing_time_ms: 100,
    },
    phase2_results: {
      enhanced_classification: {
        primary_intent: "order_inquiry",
        secondary_intents: [],
        confidence: 0.95,
      },
      missed_entities: {
        company_names: [],
        people: [],
        technical_terms: [],
        deadlines: ["tomorrow"],
      },
      action_items: [
        {
          task: "Process order",
          owner: "Sales Team",
          deadline: "24 hours",
          priority: "HIGH",
        },
      ],
      contextual_insights: {
        business_impact: "High revenue impact",
        recommended_actions: ["Expedite processing", "Contact customer"],
        risk_level: "AT_RISK",
      },
      processing_time_ms: 200,
    },
    final_summary: {
      email_id: "email-123",
      overall_priority: "HIGH",
      recommended_actions: ["Process immediately"],
      key_insights: ["Urgent order"],
      workflow_recommendations: ["Fast track"],
      confidence_score: 0.9,
    },
    confidence_score: 0.9,
    is_complete_chain: false,
    total_processing_time_ms: 300,
    phases_completed: ["phase_1", "phase_2"],
    created_at: new Date(),
    ...overrides,
  });

  describe("scoreAnalysis", () => {
    it("should score identical analyses as 10", () => {
      const analysis = createMockAnalysis();
      const score = scoreAnalysis(analysis, analysis);
      expect(score).toBe(10);
    });

    it("should handle missing phase1_results gracefully", () => {
      const analysis = createMockAnalysis({ phase1_results: undefined });
      const baseline = createMockAnalysis();
      const score = scoreAnalysis(analysis, baseline);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });

    it("should handle missing phase2_results gracefully", () => {
      const analysis = createMockAnalysis({ phase2_results: undefined });
      const baseline = createMockAnalysis();
      const score = scoreAnalysis(analysis, baseline);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
    });

    it("should handle different workflow types", () => {
      const analysis = createMockAnalysis({ workflow_type: "Quote Processing" });
      const baseline = createMockAnalysis({ workflow_type: "Order Processing" });
      const score = scoreAnalysis(analysis, baseline);
      expect(score).toBeLessThan(10);
    });
  });

  describe("getDetailedScore", () => {
    it("should return detailed scoring dimensions", () => {
      const analysis = createMockAnalysis();
      const baseline = createMockAnalysis();
      const detailed = getDetailedScore(analysis, baseline);
      
      expect(detailed).toHaveProperty("overall");
      expect(detailed).toHaveProperty("dimensions");
      expect(detailed).toHaveProperty("details");
      expect(detailed.dimensions).toHaveProperty("contextUnderstanding");
      expect(detailed.dimensions).toHaveProperty("entityExtraction");
      expect(detailed.dimensions).toHaveProperty("businessProcessing");
      expect(detailed.dimensions).toHaveProperty("actionableInsights");
      expect(detailed.dimensions).toHaveProperty("responseQuality");
    });

    it("should handle mismatched entities", () => {
      const analysis = createMockAnalysis();
      const baseline = createMockAnalysis();
      
      // Modify baseline to have different entities
      if (baseline.phase1_results?.entities) {
        baseline.phase1_results.entities.po_numbers = ["PO999"];
        baseline.phase1_results.entities.quotes = [];
      }
      
      const detailed = getDetailedScore(analysis, baseline);
      expect(detailed.dimensions.entityExtraction).toBeLessThan(10);
      expect(detailed.details.some(d => d.includes("po_numbers"))).toBe(true);
    });

    it("should handle different priority levels", () => {
      const analysis = createMockAnalysis();
      const baseline = createMockAnalysis();
      
      if (baseline.phase1_results?.basic_classification) {
        baseline.phase1_results.basic_classification.priority = "LOW";
      }
      
      const detailed = getDetailedScore(analysis, baseline);
      expect(detailed.dimensions.contextUnderstanding).toBeLessThan(10);
    });

    it("should handle recommended_actions as string or array", () => {
      const analysisWithString = createMockAnalysis();
      if (analysisWithString.phase2_results?.contextual_insights) {
        analysisWithString.phase2_results.contextual_insights.recommended_actions = "Single action string";
      }
      
      const analysisWithArray = createMockAnalysis();
      const score1 = scoreAnalysis(analysisWithString, analysisWithArray);
      const score2 = scoreAnalysis(analysisWithArray, analysisWithString);
      
      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score2).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Safe property access", () => {
    it("should not throw errors with deeply nested undefined properties", () => {
      const emptyAnalysis: EmailAnalysis = {
        id: "empty",
        email_id: "empty-email",
        analysis_version: "1.0.0",
        workflow_type: "Unknown",
        final_summary: {
          email_id: "empty-email",
          overall_priority: "LOW",
          recommended_actions: [],
          key_insights: [],
          workflow_recommendations: [],
          confidence_score: 0,
        },
        confidence_score: 0,
        is_complete_chain: false,
        total_processing_time_ms: 0,
        phases_completed: [],
        created_at: new Date(),
      };
      
      const fullAnalysis = createMockAnalysis();
      
      // Should not throw any errors
      expect(() => scoreAnalysis(emptyAnalysis, fullAnalysis)).not.toThrow();
      expect(() => scoreAnalysis(fullAnalysis, emptyAnalysis)).not.toThrow();
      expect(() => getDetailedScore(emptyAnalysis, fullAnalysis)).not.toThrow();
    });
  });
});