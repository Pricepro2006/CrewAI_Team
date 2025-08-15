/**
 * Comprehensive Tests for JSON Parsing Fixes in EmailThreePhaseAnalysisService
 *
 * This test suite validates the enhanced JSON parsing logic that handles:
 * - Markdown code blocks
 * - LLM response prefixes
 * - Malformed JSON structures
 * - Retry mechanisms with different prompts
 * - Fallback parsing strategies
 *
 * Critical for preventing regression of the JSON parsing improvements
 */

import {
  describe,
  it,
  expect,
  vi,
  MockedFunction,
  beforeEach,
  afterEach,
} from "vitest";
import axios from "axios";
import { EmailThreePhaseAnalysisService } from "./EmailThreePhaseAnalysisService.js";
import { RedisService } from "../cache/RedisService.js";
import { EmailChainAnalyzer } from "./EmailChainAnalyzer.js";

// Mock dependencies
vi.mock("axios");
vi.mock("../cache/RedisService.js");
vi.mock("./EmailChainAnalyzer.js");

// Mock database connection pool with proper mock structure
vi.mock("../../database/ConnectionPool.js", () => {
  const createMockDbImplementation = () => ({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
    close: vi.fn(),
    pragma: vi.fn(),
    transaction: vi.fn((fn: any) => fn()),
    inTransaction: false,
  });
  
  return {
    getDatabaseConnection: vi.fn().mockReturnValue(createMockDbImplementation()),
    executeQuery: vi.fn((callback: any) => callback(createMockDbImplementation())),
    executeTransaction: vi.fn((callback: any) => callback(createMockDbImplementation())),
  };
});

const mockedAxios = axios as any;

describe("EmailThreePhaseAnalysisService - JSON Parsing Tests", () => {
  let service: EmailThreePhaseAnalysisService;
  let mockRedisService: any;
  let mockChainAnalyzer: any;

  const sampleEmail = {
    id: "test-email-1",
    subject: "Test Email Subject",
    body: "Test email body content",
    sender_email: "test@example.com",
    recipient_emails: "recipient@example.com",
    received_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock RedisService
    mockRedisService = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (RedisService as any).mockImplementation(() => mockRedisService);

    // Mock EmailChainAnalyzer
    mockChainAnalyzer = {
      analyzeChain: vi.fn().mockResolvedValue({
        chain_id: "test-chain",
        is_complete: false,
        chain_length: 1,
        completeness_score: 30,
        chain_type: "general_inquiry",
        missing_elements: ["completion"],
      }),
    };
    (EmailChainAnalyzer as any).mockImplementation(() => mockChainAnalyzer);

    service = new EmailThreePhaseAnalysisService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("JSON Parsing Success Cases", () => {
    it("should parse clean JSON response correctly", async () => {
      const validJsonResponse = {
        workflow_validation: "QUOTE_PROCESSING confirmed",
        missed_entities: {
          project_names: ["Project Alpha"],
          company_names: ["ACME Corp"],
          people: ["John Doe"],
          products: ["Widget X"],
          technical_specs: ["CPU: Intel i7"],
          locations: ["New York"],
          other_references: ["Contract ABC"],
        },
        action_items: [
          {
            task: "Follow up on quote",
            owner: "sales",
            deadline: "2024-02-01",
            revenue_impact: "$50000",
          },
        ],
        risk_assessment: "Medium risk - competitor evaluation ongoing",
        initial_response:
          "Thank you for your quote request. We will respond within 24 hours.",
        confidence: 0.85,
        business_process: "QUOTE_REQUEST_PROCESSING",
        extracted_requirements: ["High-performance computing", "24/7 support"],
      };

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(validJsonResponse) },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("QUOTE_PROCESSING confirmed");
      expect(analysis?.missed_entities?.project_names).toEqual(["Project Alpha"]);
      expect(analysis.action_items).toHaveLength(1);
      expect(analysis.confidence).toBe(0.85);
      expect(analysis.business_process).toBe("QUOTE_REQUEST_PROCESSING");
    });

    it("should handle markdown code blocks", async () => {
      const markdownResponse = `
Here's the analysis in JSON format:

\`\`\`json
{
  "workflow_validation": "ORDER_MANAGEMENT confirmed",
  "missed_entities": {
    "project_names": [],
    "company_names": ["TechCorp"],
    "people": ["Alice Smith"],
    "products": ["Server"],
    "technical_specs": [],
    "locations": [],
    "other_references": []
  },
  "action_items": [
    {
      "task": "Process order",
      "owner": "fulfillment",
      "deadline": "2024-02-03"
    }
  ],
  "risk_assessment": "Low risk - standard order",
  "initial_response": "Order received and being processed",
  "confidence": 0.9,
  "business_process": "ORDER_FULFILLMENT",
  "extracted_requirements": ["Standard delivery"]
}
\`\`\`

This analysis shows a straightforward order processing scenario.
      `;

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: markdownResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("ORDER_MANAGEMENT confirmed");
      expect(analysis?.missed_entities?.company_names).toEqual(["TechCorp"]);
      expect(analysis.confidence).toBe(0.9);
      expect(analysis.business_process).toBe("ORDER_FULFILLMENT");
    });

    it("should handle LLM response prefixes", async () => {
      const prefixedResponse = `
Based on the analysis of the email content, here's the structured response:

{
  "workflow_validation": "SUPPORT_TICKET confirmed",
  "missed_entities": {
    "project_names": [],
    "company_names": [],
    "people": ["Support Agent"],
    "products": ["Software License"],
    "technical_specs": ["Version 2.3"],
    "locations": [],
    "other_references": ["Ticket #12345"]
  },
  "action_items": [
    {
      "task": "Investigate issue",
      "owner": "technical support",
      "deadline": "2024-02-02"
    }
  ],
  "risk_assessment": "High priority - customer escalation",
  "initial_response": "We've received your support request and will investigate immediately",
  "confidence": 0.75,
  "business_process": "TECHNICAL_SUPPORT",
  "extracted_requirements": ["Root cause analysis", "Quick resolution"]
}

This indicates a high-priority support scenario requiring immediate attention.
      `;

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: prefixedResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("SUPPORT_TICKET confirmed");
      expect(analysis.risk_assessment).toBe(
        "High priority - customer escalation",
      );
      expect(analysis.business_process).toBe("TECHNICAL_SUPPORT");
      expect(analysis.confidence).toBe(0.75);
    });

    it("should handle mixed markdown and prefixes", async () => {
      const complexResponse = `
Analysis complete. Here are the results:

\`\`\`json
{
  "workflow_validation": "SHIPPING confirmed",
  "missed_entities": {
    "project_names": ["Deployment Phase 1"],
    "company_names": ["LogisticsCorp"],
    "people": [],
    "products": ["Hardware Kit"],
    "technical_specs": [],
    "locations": ["Warehouse B"],
    "other_references": ["Tracking: ABC123"]
  },
  "action_items": [],
  "risk_assessment": "Low risk - routine shipment",
  "initial_response": "Shipment is on schedule and will arrive as planned",
  "confidence": 0.95,
  "business_process": "LOGISTICS_MANAGEMENT",
  "extracted_requirements": ["Delivery confirmation"]
}
\`\`\`

The analysis shows standard logistics processing.
      `;

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: complexResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("SHIPPING confirmed");
      expect(analysis?.missed_entities?.project_names).toEqual([
        "Deployment Phase 1",
      ]);
      expect(analysis.confidence).toBe(0.95);
    });
  });

  describe("JSON Parsing Error Handling", () => {
    it("should handle malformed JSON with retry", async () => {
      const malformedResponse = `{
        workflow_validation: "QUOTE_PROCESSING confirmed", // Missing quotes
        missed_entities: {
          project_names: [Project Alpha], // Missing quotes
          company_names: ["ACME Corp"],
          people: [],
          products: [],
          technical_specs: [],
          locations: [],
          other_references: []
        },
        action_items: [],
        risk_assessment: "Standard processing",
        initial_response: "Processing your request",
        confidence: 0.8,
        business_process: QUOTE_PROCESSING, // Missing quotes
        extracted_requirements: []
      }`;

      const validRetryResponse = {
        workflow_validation: "QUOTE_PROCESSING confirmed",
        missed_entities: {
          project_names: ["Project Alpha"],
          company_names: ["ACME Corp"],
          people: [],
          products: [],
          technical_specs: [],
          locations: [],
          other_references: [],
        },
        action_items: [],
        risk_assessment: "Standard processing",
        initial_response: "Processing your request",
        confidence: 0.8,
        business_process: "QUOTE_PROCESSING",
        extracted_requirements: [],
      };

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: malformedResponse },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: JSON.stringify(validRetryResponse) },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // First attempt + retry
      expect(analysis.workflow_validation).toBe("QUOTE_PROCESSING confirmed");
      expect(analysis.business_process).toBe("QUOTE_PROCESSING");
    });

    it("should use fallback after all retries fail", async () => {
      const invalidResponses = [
        "This is not JSON at all",
        "{ invalid: json, structure",
        "Still not valid JSON",
      ];

      invalidResponses.forEach((response: any) => {
        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: { response },
        });
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // All retry attempts
      expect(analysis.workflow_validation).toContain("rule-based analysis");
      expect(analysis.confidence).toBe(0.5); // Fallback confidence
      expect(analysis.risk_assessment).toContain("Unable to assess");
    });

    it("should handle LLM service errors gracefully", async () => {
      mockedAxios?.post?.mockRejectedValue(new Error("LLM service unavailable"));

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should complete Phase 1 and return Phase 2 results with fallback
      expect(analysis.workflow_validation).toBeDefined();
      expect(analysis.confidence).toBe(0.5); // Fallback confidence
    });

    it("should handle empty LLM responses", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: "" },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toContain("rule-based analysis");
      expect(analysis.business_process).toBeDefined();
    });

    it("should handle null/undefined LLM responses", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: null },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBeDefined();
      expect(analysis.initial_response).toBeDefined();
    });
  });

  describe("Fallback Extraction Methods", () => {
    it("should extract from key-value formatted text", async () => {
      const kvResponse = `
workflow_validation: ORDER_PROCESSING validated
confidence: 0.88
risk_assessment: Medium risk - large order value
business_process: ENTERPRISE_ORDER
      `;

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: kvResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("ORDER_PROCESSING validated");
      expect(analysis.confidence).toBe(0.88);
      expect(analysis.risk_assessment).toBe("Medium risk - large order value");
      expect(analysis.business_process).toBe("ENTERPRISE_ORDER");
    });

    it("should handle mixed valid and invalid JSON sections", async () => {
      const mixedResponse = `
Here's some intro text that should be ignored.

{
  "workflow_validation": "RETURNS_PROCESSING confirmed",
  "confidence": 0.92,
  "risk_assessment": "Low risk - standard return"
}

And some trailing text that should also be ignored.
      `;

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: mixedResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("RETURNS_PROCESSING confirmed");
      expect(analysis.confidence).toBe(0.92);
      expect(analysis.risk_assessment).toBe("Low risk - standard return");
    });
  });

  describe("Retry Logic Validation", () => {
    it("should use different prompts on retry attempts", async () => {
      const invalidFirstResponse = "Invalid JSON response";
      const validSecondResponse = {
        workflow_validation: "ESCALATION confirmed",
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
        risk_assessment: "Critical - immediate attention required",
        initial_response: "Escalating to management immediately",
        confidence: 0.95,
        business_process: "MANAGEMENT_ESCALATION",
        extracted_requirements: [],
      };

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: invalidFirstResponse },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: JSON.stringify(validSecondResponse) },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(analysis.business_process).toBe("MANAGEMENT_ESCALATION");
      expect(analysis.confidence).toBe(0.95);

      // Verify that retry used different prompt (check call arguments)
      const firstCall = mockedAxios?.post?.mock.calls[0];
      const secondCall = mockedAxios?.post?.mock.calls[1];

      expect(firstCall[1].prompt).not.toBe(secondCall[1].prompt);
      expect(secondCall[1].prompt).toContain("retry attempt"); // Retry prompt should mention retry
    });

    it("should adjust temperature on retries", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid first response" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: "Success on retry",
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
              risk_assessment: "Standard",
              initial_response: "Processed",
              confidence: 0.8,
              business_process: "STANDARD",
              extracted_requirements: [],
            }),
          },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      const firstCall = mockedAxios?.post?.mock.calls[0];
      const secondCall = mockedAxios?.post?.mock.calls[1];

      // First call should use higher temperature (0.1)
      expect(firstCall[1].options.temperature).toBe(0.1);
      // Retry should use lower temperature (0.05)
      expect(secondCall[1].options.temperature).toBe(0.05);
    });
  });

  describe("Parsing Metrics Tracking", () => {
    it("should track successful parsing metrics", async () => {
      const validResponse = {
        workflow_validation: "SUCCESS",
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
        risk_assessment: "Low",
        initial_response: "Thank you",
        confidence: 0.9,
        business_process: "STANDARD",
        extracted_requirements: [],
      };

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(validResponse) },
      });

      await service.analyzeEmail(sampleEmail);

      const stats = await service.getAnalysisStats();
      expect(stats?.parsingMetrics?.successRate).toBeGreaterThan(0);
      expect(stats?.parsingMetrics?.totalAttempts).toBeGreaterThan(0);
    });

    it("should track retry success metrics", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid JSON" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: "Retry success",
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
              risk_assessment: "Standard",
              initial_response: "Processed",
              confidence: 0.8,
              business_process: "STANDARD",
              extracted_requirements: [],
            }),
          },
        });

      await service.analyzeEmail(sampleEmail);

      const stats = await service.getAnalysisStats();
      expect(stats?.parsingMetrics?.retryRate).toBeGreaterThan(0);
    });

    it("should track fallback usage metrics", async () => {
      // Mock multiple failures to trigger fallback
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid response 1" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid response 2" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid response 3" },
        });

      await service.analyzeEmail(sampleEmail);

      const stats = await service.getAnalysisStats();
      expect(stats?.parsingMetrics?.fallbackRate).toBeGreaterThan(0);
    });
  });

  describe("Response Structure Validation", () => {
    it("should ensure all required Phase 2 fields are present", async () => {
      const incompleteResponse = {
        workflow_validation: "PARTIAL_RESPONSE",
        // Missing many required fields
        confidence: 0.7,
      };

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(incompleteResponse) },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should have all required fields with defaults
      expect(analysis.workflow_validation).toBeDefined();
      expect(analysis.missed_entities).toBeDefined();
      expect(analysis.action_items).toBeDefined();
      expect(analysis.risk_assessment).toBeDefined();
      expect(analysis.initial_response).toBeDefined();
      expect(analysis.business_process).toBeDefined();
      expect(analysis.extracted_requirements).toBeDefined();

      // Should maintain valid structure
      expect(Array.isArray(analysis.action_items)).toBe(true);
      expect(Array.isArray(analysis.extracted_requirements)).toBe(true);
      expect(typeof analysis.confidence).toBe("number");
    });

    it("should normalize confidence values to valid range", async () => {
      const invalidConfidence = {
        workflow_validation: "TEST",
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
        risk_assessment: "Standard",
        initial_response: "Processed",
        confidence: 1.5, // Invalid - over 1.0
        business_process: "STANDARD",
        extracted_requirements: [],
      };

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(invalidConfidence) },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.confidence).toBeLessThanOrEqual(1.0);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Integration with Chain Analysis", () => {
    it("should handle complete chains correctly", async () => {
      // Mock complete chain
      mockChainAnalyzer?.analyzeChain?.mockResolvedValue({
        chain_id: "complete-chain",
        is_complete: true,
        chain_length: 5,
        completeness_score: 85,
        chain_type: "quote_request",
        missing_elements: [],
      });

      const validResponse = {
        workflow_validation: "COMPLETE_CHAIN_PROCESSING",
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
        risk_assessment: "Standard",
        initial_response: "Complete chain processed",
        confidence: 0.9,
        business_process: "COMPLETE_WORKFLOW",
        extracted_requirements: [],
      };

      // Mock Phase 2 response
      mockedAxios?.post?.mockResolvedValueOnce({
        status: 200,
        data: { response: JSON.stringify(validResponse) },
      });

      // Mock Phase 3 response
      mockedAxios?.post?.mockResolvedValueOnce({
        status: 200,
        data: {
          response: JSON.stringify({
            strategic_insights: {
              opportunity: "High-value customer engagement",
              risk: "Minimal risk - established relationship",
              relationship: "Strong partnership",
            },
            executive_summary: "Complete workflow successfully processed",
            escalation_needed: false,
            revenue_impact: "$75000",
            workflow_intelligence: {
              predicted_next_steps: ["Send quote", "Schedule follow-up"],
              bottleneck_risks: ["None identified"],
              optimization_opportunities: ["Automate quote generation"],
            },
          }),
        },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should have Phase 3 results
      expect(analysis.strategic_insights).toBeDefined();
      expect(analysis.executive_summary).toBeDefined();
      expect(analysis.workflow_intelligence).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Phase 2 + Phase 3
    });
  });
});
