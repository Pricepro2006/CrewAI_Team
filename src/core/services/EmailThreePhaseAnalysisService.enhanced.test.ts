/**
 * Enhanced Validation Tests for EmailThreePhaseAnalysisService
 *
 * This comprehensive test suite validates the critical JSON parsing fixes
 * and ensures the enhanced parsing logic handles all edge cases properly.
 *
 * CRITICAL FIXES VALIDATED:
 * 1. JSON Parsing Enhancement - Handles markdown, prefixes, malformed JSON
 * 2. Retry Logic - Multiple attempts with different prompts and temperatures
 * 3. Fallback Extraction - Key-value pair extraction and structured fallbacks
 * 4. Response Validation - Ensures proper structure and field validation
 *
 * These tests prevent regression of the critical JSON parsing improvements
 * that resolved LLM returning markdown instead of JSON issues.
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

// Mock dependencies first
vi.mock("axios");

// Mock RedisService with proper structure
vi.mock("../cache/RedisService.js", () => {
  return {
    RedisService: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockResolvedValue(undefined),
      client: {
        on: vi.fn(),
        set: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
      },
    })),
  };
});

// Mock EmailChainAnalyzer with proper structure
vi.mock("./EmailChainAnalyzer.js", () => {
  return {
    EmailChainAnalyzer: vi.fn().mockImplementation(() => ({
      analyzeChain: vi.fn().mockResolvedValue({
        chain_id: "test-chain",
        is_complete: false,
        chain_length: 2,
        completeness_score: 45,
        chain_type: "general_inquiry",
        missing_elements: ["completion"],
      }),
    })),
  };
});

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

// Mock other services
vi.mock("../../api/services/QueryPerformanceMonitor.js", () => {
  return {
    QueryPerformanceMonitor: vi.fn().mockImplementation(() => ({
      trackOperation: vi.fn(),
    })),
  };
});

vi.mock("../../core/cache/EmailAnalysisCache.js", () => {
  return {
    EmailAnalysisCache: vi.fn().mockImplementation(() => ({
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      clear: vi.fn(),
    })),
  };
});

vi.mock("./LLMRateLimiter.js", () => {
  return {
    llmRateLimiters: {
      modelSpecific: {
        checkAndConsume: vi.fn().mockResolvedValue({
          allowed: true,
          remainingRequests: 100,
          resetTime: Date.now() + 3600000,
        }),
      },
    },
  };
});

// Mock PromptSanitizer
vi.mock("../../utils/PromptSanitizer.js", () => {
  return {
    PromptSanitizer: {
      sanitizeEmailContent: vi.fn().mockReturnValue({
        subject: "Test Subject",
        body: "Test Body",
        sender: "test@example.com",
      }),
      detectInjectionAttempt: vi.fn().mockReturnValue(false),
    },
  };
});

// Mock ThreePhasePrompts
vi.mock("../prompts/ThreePhasePrompts.js", () => {
  return {
    PHASE2_ENHANCED_PROMPT: "Enhanced Phase 2 prompt template with {PHASE1_RESULTS}, {EMAIL_SUBJECT}, {EMAIL_BODY}",
    PHASE2_RETRY_PROMPT: "Retry Phase 2 prompt template with {PHASE1_RESULTS}, {EMAIL_SUBJECT}, {EMAIL_BODY}",
    PHASE3_STRATEGIC_PROMPT: "Phase 3 strategic prompt template with {PHASE1_RESULTS}, {PHASE2_RESULTS}, {EMAIL_SUBJECT}, {EMAIL_BODY}",
    enhancePromptForEmailType: vi.fn().mockImplementation((prompt, characteristics) => prompt),
  };
});

const mockedAxios = axios as any;

describe("EmailThreePhaseAnalysisService - Enhanced JSON Parsing Validation", () => {
  let service: EmailThreePhaseAnalysisService;

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
    service = new EmailThreePhaseAnalysisService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CRITICAL: Problematic LLM Response Formats", () => {
    it("should handle LLM responses with explanatory text before JSON", async () => {
      const problematicResponse = `
I'll analyze this email and provide the structured response you requested. Based on the content, this appears to be a quote request that needs careful handling.

Here's my analysis:

{
  "workflow_validation": "QUOTE_PROCESSING confirmed - customer seeking pricing information",
  "missed_entities": {
    "project_names": ["Data Center Upgrade"],
    "company_names": ["TechCorp Solutions"],
    "people": ["Sarah Johnson", "Mike Chen"],
    "products": ["HPE ProLiant Servers", "Storage Arrays"],
    "technical_specs": ["64GB RAM", "SSD Storage"],
    "locations": ["San Francisco Office"],
    "other_references": ["Budget: Q1 2024"]
  },
  "action_items": [
    {
      "task": "Prepare comprehensive quote",
      "owner": "sales_engineer",
      "deadline": "2024-02-01",
      "revenue_impact": "$250000"
    }
  ],
  "risk_assessment": "Medium risk - competitive evaluation in progress",
  "initial_response": "Thank you for your quote request. Our technical team will prepare a comprehensive proposal within 24 hours.",
  "confidence": 0.87,
  "business_process": "ENTERPRISE_QUOTE_REQUEST",
  "extracted_requirements": ["High availability", "24/7 support", "Redundant storage"]
}

This analysis indicates a high-value opportunity that requires careful attention to technical specifications and competitive positioning.
      `;

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { response: problematicResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe(
        "QUOTE_PROCESSING confirmed - customer seeking pricing information",
      );
      expect(analysis.missed_entities.project_names).toEqual([
        "Data Center Upgrade",
      ]);
      expect(analysis.missed_entities.company_names).toEqual([
        "TechCorp Solutions",
      ]);
      expect(analysis.confidence).toBe(0.87);
      expect(analysis.business_process).toBe("ENTERPRISE_QUOTE_REQUEST");
      expect(analysis.action_items).toHaveLength(1);
      expect(analysis.action_items[0].revenue_impact).toBe("$250000");
    });

    it("should handle nested markdown code blocks with additional formatting", async () => {
      const complexMarkdownResponse = `
## Email Analysis Results

The following analysis has been completed for the submitted email:

### Structured Response

\`\`\`json
{
  "workflow_validation": "ORDER_MANAGEMENT validated - purchase order received",
  "missed_entities": {
    "project_names": ["Phoenix Migration"],
    "company_names": ["Enterprise Systems Inc"],
    "people": ["David Rodriguez", "Lisa Park"],
    "products": ["Dell PowerEdge R750", "VMware Licenses"],
    "technical_specs": ["Intel Xeon processors", "128GB ECC RAM"],
    "locations": ["Austin Data Center"],
    "other_references": ["PO #789123", "Contract Amendment #4"]
  },
  "action_items": [
    {
      "task": "Validate PO terms and conditions",
      "owner": "contracts_team",
      "deadline": "2024-01-31",
      "revenue_impact": "$180000"
    },
    {
      "task": "Schedule technical implementation call",
      "owner": "solutions_architect",
      "deadline": "2024-02-05"
    }
  ],
  "risk_assessment": "Low risk - established customer with valid PO and clear requirements",
  "initial_response": "Purchase order received and validated. Implementation team will contact you within 48 hours.",
  "confidence": 0.92,
  "business_process": "ENTERPRISE_ORDER_FULFILLMENT",
  "extracted_requirements": ["Professional services", "On-site installation", "Training included"]
}
\`\`\`

### Summary

This represents a straightforward order fulfillment scenario with clear next steps.
      `;

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { response: complexMarkdownResponse },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe(
        "ORDER_MANAGEMENT validated - purchase order received",
      );
      expect(analysis.confidence).toBe(0.92);
      expect(analysis.action_items).toHaveLength(2);
      expect(analysis.risk_assessment).toBe(
        "Low risk - established customer with valid PO and clear requirements",
      );
      expect(analysis.business_process).toBe("ENTERPRISE_ORDER_FULFILLMENT");
    });

    it("should handle JSON with inline comments (common LLM mistake)", async () => {
      const jsonWithComments = `
{
  "workflow_validation": "SUPPORT_TICKET confirmed", // This is clearly a support request
  "missed_entities": {
    "project_names": [], // No project names mentioned
    "company_names": ["Acme Corporation"], // Clear company identification
    "people": ["John Smith"], // Customer contact
    "products": ["Server Hardware"], // General product category
    "technical_specs": ["CPU overheating"], // Technical issue details
    "locations": [], // No locations specified
    "other_references": ["Ticket #SUP-2024-001"] // Support ticket reference
  },
  "action_items": [
    {
      "task": "Investigate hardware issue", // Primary action
      "owner": "technical_support",
      "deadline": "2024-01-30"
    }
  ],
  "risk_assessment": "High priority - system downtime affecting operations", // Critical issue
  "initial_response": "We've received your support request and our technical team will investigate immediately.",
  "confidence": 0.88, // High confidence in analysis
  "business_process": "CRITICAL_SUPPORT", // Escalated support process
  "extracted_requirements": ["Hardware diagnostics", "Urgent resolution"] // Key requirements
}
      `;

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { response: jsonWithComments },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("SUPPORT_TICKET confirmed");
      expect(analysis.missed_entities.company_names).toEqual([
        "Acme Corporation",
      ]);
      expect(analysis.confidence).toBe(0.88);
      expect(analysis.business_process).toBe("CRITICAL_SUPPORT");
    });

    it("should handle LLM responses with broken JSON structure but extractable content", async () => {
      const brokenJsonResponse = `
Based on my analysis, here's what I found:

{
  "workflow_validation": "ESCALATION required - customer complaint received",
  "missed_entities": {
    "project_names": ["System Upgrade Q1",
    "company_names": ["MegaCorp Industries"], // Missing closing bracket above
    "people": ["Amanda Wilson", "Robert Chen"],
    "products": ["Software License Renewal"
    "technical_specs": [], // Missing comma above
    "locations": ["New York Office"],
    "other_references": ["Complaint #CMP-2024-007"]
  },
  "action_items": [
    {
      "task": "Review customer complaint details",
      "owner": "customer_success"
      "deadline": "2024-01-29" // Missing comma above
    }
  ],
  "risk_assessment": "Critical - customer satisfaction at risk, potential churn",
  "initial_response": "We sincerely apologize for the inconvenience and will address this immediately.",
  "confidence": 0.85,
  "business_process": "CUSTOMER_COMPLAINT_RESOLUTION"
  "extracted_requirements": ["Immediate response", "Manager involvement"] // Missing comma above
}
      `;

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: brokenJsonResponse },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation:
                "ESCALATION required - customer complaint received",
              missed_entities: {
                project_names: ["System Upgrade Q1"],
                company_names: ["MegaCorp Industries"],
                people: ["Amanda Wilson", "Robert Chen"],
                products: ["Software License Renewal"],
                technical_specs: [],
                locations: ["New York Office"],
                other_references: ["Complaint #CMP-2024-007"],
              },
              action_items: [
                {
                  task: "Review customer complaint details",
                  owner: "customer_success",
                  deadline: "2024-01-29",
                },
              ],
              risk_assessment:
                "Critical - customer satisfaction at risk, potential churn",
              initial_response:
                "We sincerely apologize for the inconvenience and will address this immediately.",
              confidence: 0.85,
              business_process: "CUSTOMER_COMPLAINT_RESOLUTION",
              extracted_requirements: [
                "Immediate response",
                "Manager involvement",
              ],
            }),
          },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Retry triggered
      expect(analysis.workflow_validation).toBe(
        "ESCALATION required - customer complaint received",
      );
      expect(analysis.business_process).toBe("CUSTOMER_COMPLAINT_RESOLUTION");
      expect(analysis.confidence).toBe(0.85);
    });
  });

  describe("CRITICAL: Retry Mechanism Validation", () => {
    it("should use progressively stricter parameters on retries", async () => {
      const invalidResponses = [
        "This is not JSON at all - just plain text",
        "{ still: not, valid: json",
        JSON.stringify({
          workflow_validation: "Finally valid on third attempt",
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
          risk_assessment: "Standard processing",
          initial_response: "Thank you for your email",
          confidence: 0.9,
          business_process: "STANDARD_PROCESSING",
          extracted_requirements: [],
        }),
      ];

      invalidResponses.forEach((response, index) => {
        mockedAxios.post.mockResolvedValueOnce({
          status: 200,
          data: { response },
        });
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(analysis.workflow_validation).toBe(
        "Finally valid on third attempt",
      );
      expect(analysis.confidence).toBe(0.9);

      // Verify temperature progression: 0.1 -> 0.05 -> 0.05
      const calls = mockedAxios.post.mock.calls;
      expect(calls[0][1].options.temperature).toBe(0.1);
      expect(calls[1][1].options.temperature).toBe(0.05);
      expect(calls[2][1].options.temperature).toBe(0.05);
    });

    it("should use different stop tokens on retries", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid first attempt" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation:
                "Retry successful with different stop tokens",
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

      const calls = mockedAxios.post.mock.calls;
      expect(calls[0][1].options.stop).toEqual(["\n\n", "```"]);
      expect(calls[1][1].options.stop).toEqual(["```", "END_JSON"]);
    });

    it("should modify prompts with retry-specific instructions", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid JSON response" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: "Retry prompt worked",
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
              confidence: 0.85,
              business_process: "RETRY_SUCCESS",
              extracted_requirements: [],
            }),
          },
        });

      await service.analyzeEmail(sampleEmail);

      const calls = mockedAxios.post.mock.calls;
      const firstPrompt = calls[0][1].prompt;
      const retryPrompt = calls[1][1].prompt;

      expect(retryPrompt).toContain("retry attempt");
      expect(retryPrompt).toContain("ONLY valid JSON");
      expect(retryPrompt).toContain("no explanatory text");
      expect(firstPrompt).not.toContain("retry attempt");
    });
  });

  describe("CRITICAL: Fallback Extraction Validation", () => {
    it("should extract from structured text when JSON parsing fails", async () => {
      const structuredTextResponse = `
Analysis Results:

workflow_validation: SHIPPING_NOTIFICATION confirmed
missed_entities:
  project_names: [Project Delta, Phase 2 Implementation]
  company_names: [Global Logistics Corp]
  people: [Maria Garcia, Tom Wilson]
  products: [Network Equipment, Switches]
  technical_specs: [48-port Gigabit, Layer 3 capabilities]
  locations: [Distribution Center B]
  other_references: [Tracking: 1Z999AA1234567890]

action_items:
  - task: Verify delivery address
    owner: logistics_team
    deadline: 2024-02-01

risk_assessment: Low risk - routine shipment to established location
initial_response: Your shipment is on schedule and will arrive as planned
confidence: 0.91
business_process: LOGISTICS_FULFILLMENT
extracted_requirements: [Signature required, Handle with care]
      `;

      // All retry attempts fail, should trigger fallback
      Array.from({ length: 3 }, () => {
        mockedAxios.post.mockResolvedValueOnce({
          status: 200,
          data: { response: structuredTextResponse },
        });
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(analysis.workflow_validation).toBe(
        "SHIPPING_NOTIFICATION confirmed",
      );
      expect(analysis.confidence).toBe(0.91);
      expect(analysis.business_process).toBe("LOGISTICS_FULFILLMENT");
      expect(analysis.risk_assessment).toBe(
        "Low risk - routine shipment to established location",
      );
    });

    it("should use structured fallback when all extraction methods fail", async () => {
      // Completely unparseable responses
      const unparseableResponses = [
        "This is just random text with no structure",
        "More random content without any JSON or key-value pairs",
        "Final attempt also completely unstructured",
      ];

      unparseableResponses.forEach((response) => {
        mockedAxios.post.mockResolvedValueOnce({
          status: 200,
          data: { response },
        });
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(analysis.workflow_validation).toContain("parsing failed");
      expect(analysis.confidence).toBe(0.3); // Fallback confidence
      expect(analysis.business_process).toBe("PARSING_ERROR");
      expect(analysis.risk_assessment).toContain("parsing error");
      expect(analysis.initial_response).toContain("review your request");
    });

    it("should handle partial extraction from mixed content", async () => {
      const mixedContentResponse = `
Some random text at the beginning...

workflow_validation: RETURNS_PROCESSING validated

More unstructured content here...

confidence: 0.76

Even more random text...

risk_assessment: Medium risk - return window expiring soon

And some trailing content...

business_process: RETURNS_MANAGEMENT
      `;

      Array.from({ length: 3 }, () => {
        mockedAxios.post.mockResolvedValueOnce({
          status: 200,
          data: { response: mixedContentResponse },
        });
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("RETURNS_PROCESSING validated");
      expect(analysis.confidence).toBe(0.76);
      expect(analysis.risk_assessment).toBe(
        "Medium risk - return window expiring soon",
      );
      expect(analysis.business_process).toBe("RETURNS_MANAGEMENT");
    });
  });

  describe("CRITICAL: Response Structure Validation", () => {
    it("should handle missing nested entity structures", async () => {
      const incompleteEntitiesResponse = {
        workflow_validation: "INCOMPLETE_ENTITIES_TEST",
        missed_entities: {
          // Missing several required fields
          project_names: ["Project Alpha"],
          company_names: ["Test Corp"],
          // Missing: people, products, technical_specs, locations, other_references
        },
        action_items: [],
        risk_assessment: "Test risk assessment",
        initial_response: "Test response",
        confidence: 0.8,
        business_process: "TEST_PROCESS",
        extracted_requirements: [],
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(incompleteEntitiesResponse) },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should fill in missing entity fields with empty arrays
      expect(analysis.missed_entities.people).toEqual([]);
      expect(analysis.missed_entities.products).toEqual([]);
      expect(analysis.missed_entities.technical_specs).toEqual([]);
      expect(analysis.missed_entities.locations).toEqual([]);
      expect(analysis.missed_entities.other_references).toEqual([]);

      // Should preserve existing fields
      expect(analysis.missed_entities.project_names).toEqual(["Project Alpha"]);
      expect(analysis.missed_entities.company_names).toEqual(["Test Corp"]);
    });

    it("should validate and normalize action items structure", async () => {
      const invalidActionItemsResponse = {
        workflow_validation: "ACTION_ITEMS_TEST",
        missed_entities: {
          project_names: [],
          company_names: [],
          people: [],
          products: [],
          technical_specs: [],
          locations: [],
          other_references: [],
        },
        action_items: "This should be an array but it's a string", // Invalid type
        risk_assessment: "Test risk",
        initial_response: "Test response",
        confidence: 0.7,
        business_process: "TEST",
        extracted_requirements: "Also should be array", // Invalid type
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(invalidActionItemsResponse) },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should normalize to empty arrays
      expect(Array.isArray(analysis.action_items)).toBe(true);
      expect(analysis.action_items).toEqual([]);
      expect(Array.isArray(analysis.extracted_requirements)).toBe(true);
      expect(analysis.extracted_requirements).toEqual([]);
    });

    it("should clamp confidence values to valid range", async () => {
      const invalidConfidenceResponses = [
        { confidence: 1.5 }, // Over 1.0
        { confidence: -0.3 }, // Below 0
        { confidence: 5.0 }, // Way over 1.0
        { confidence: "0.8" }, // String instead of number
        { confidence: null }, // Null value
      ];

      for (const confResponse of invalidConfidenceResponses) {
        const fullResponse = {
          workflow_validation: "CONFIDENCE_TEST",
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
          risk_assessment: "Test",
          initial_response: "Test",
          business_process: "TEST",
          extracted_requirements: [],
          ...confResponse,
        };

        mockedAxios.post.mockResolvedValueOnce({
          status: 200,
          data: { response: JSON.stringify(fullResponse) },
        });

        const analysis = await service.analyzeEmail(sampleEmail);

        expect(typeof analysis.confidence).toBe("number");
        expect(analysis.confidence).toBeGreaterThanOrEqual(0);
        expect(analysis.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("CRITICAL: Error Recovery and Metrics", () => {
    it("should track parsing success metrics accurately", async () => {
      const validResponse = {
        workflow_validation: "METRICS_TEST",
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
        risk_assessment: "Test",
        initial_response: "Test",
        confidence: 0.8,
        business_process: "TEST",
        extracted_requirements: [],
      };

      mockedAxios.post.mockResolvedValue({
        status: 200,
        data: { response: JSON.stringify(validResponse) },
      });

      await service.analyzeEmail(sampleEmail);

      const stats = await service.getAnalysisStats();
      expect(stats.parsingMetrics.successRate).toBeGreaterThan(0);
      expect(stats.parsingMetrics.totalAttempts).toBeGreaterThan(0);
      expect(stats.parsingMetrics.averageAttempts).toBeGreaterThanOrEqual(1);
    });

    it("should handle LLM service timeouts gracefully", async () => {
      mockedAxios.post.mockRejectedValue(new Error("Request timeout"));

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should complete with fallback results
      expect(analysis.workflow_validation).toBeDefined();
      expect(analysis.confidence).toBe(0.5); // Fallback confidence
      expect(analysis.business_process).toBeDefined();
    });

    it("should handle LLM service 500 errors", async () => {
      mockedAxios.post.mockResolvedValue({
        status: 500,
        data: { error: "Internal server error" },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should use fallback processing
      expect(analysis.workflow_validation).toContain("rule-based analysis");
      expect(analysis.confidence).toBe(0.5);
    });

    it("should validate parsing metrics over multiple analyses", async () => {
      const scenarios = [
        // Success on first try
        [
          JSON.stringify({
            workflow_validation: "Success 1",
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
            risk_assessment: "Test",
            initial_response: "Test",
            confidence: 0.9,
            business_process: "TEST",
            extracted_requirements: [],
          }),
        ],

        // Success on retry
        [
          "Invalid JSON",
          JSON.stringify({
            workflow_validation: "Success 2",
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
            risk_assessment: "Test",
            initial_response: "Test",
            confidence: 0.8,
            business_process: "TEST",
            extracted_requirements: [],
          }),
        ],

        // Fallback usage
        ["Invalid 1", "Invalid 2", "Invalid 3"],
      ];

      for (const scenario of scenarios) {
        scenario.forEach((response) => {
          mockedAxios.post.mockResolvedValueOnce({
            status: 200,
            data: { response },
          });
        });

        await service.analyzeEmail({
          ...sampleEmail,
          id: `test-${Math.random()}`,
        });
      }

      const stats = await service.getAnalysisStats();
      expect(stats.parsingMetrics.totalAttempts).toBeGreaterThan(3);
      expect(stats.parsingMetrics.successfulParses).toBeGreaterThanOrEqual(2);
      expect(stats.parsingMetrics.retrySuccesses).toBeGreaterThanOrEqual(1);
      expect(stats.parsingMetrics.fallbackUses).toBeGreaterThanOrEqual(1);
    });
  });

  describe("CRITICAL: Integration with Adaptive Phase Selection", () => {
    it("should handle incomplete chains with Phase 2 fallback when parsing fails", async () => {
      // Mock incomplete chain (should not trigger Phase 3) - provide chain analysis with email
      const emailWithChainAnalysis = {
        ...sampleEmail,
        chainAnalysis: {
          chain_id: "incomplete-chain",
          is_complete_chain: false,
          chain_length: 2,
          completeness_score: 35,
          chain_type: "general_inquiry",
          missing_elements: ["completion", "middle_correspondence"],
        },
      };

      // Mock Phase 2 parsing failure with fallback
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid JSON response" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Still invalid JSON" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Final invalid JSON" },
        });

      const analysis = await service.analyzeEmail(emailWithChainAnalysis);

      // Should complete with Phase 2 results using fallback parsing
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // No Phase 3 calls
      expect(analysis.workflow_validation).toContain("parsing failed");
      expect(analysis.confidence).toBe(0.3);
      expect(analysis.strategic_insights).toBeDefined(); // Should have Phase 2 fallback strategic insights
      expect(analysis.strategic_insights.opportunity).toContain(
        "Incomplete chain",
      );
    });

    it("should handle complete chains with Phase 3 parsing enhancement", async () => {
      // Mock complete chain (should trigger Phase 3)
      const emailWithCompleteChain = {
        ...sampleEmail,
        chainAnalysis: {
          chain_id: "complete-chain",
          is_complete_chain: true,
          chain_length: 6,
          completeness_score: 88,
          chain_type: "quote_request",
          missing_elements: [],
        },
      };

      const phase2Response = {
        workflow_validation: "COMPLETE_CHAIN_PHASE2",
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
        risk_assessment: "Phase 2 assessment",
        initial_response: "Phase 2 response",
        confidence: 0.85,
        business_process: "COMPLETE_WORKFLOW",
        extracted_requirements: [],
      };

      const phase3Response = {
        strategic_insights: {
          opportunity: "High-value complete workflow opportunity",
          risk: "Minimal risk - complete chain analysis",
          relationship: "Strong customer relationship",
        },
        executive_summary: "Complete workflow analysis successful",
        escalation_needed: false,
        revenue_impact: "$95000",
        workflow_intelligence: {
          predicted_next_steps: ["Finalize quote", "Schedule implementation"],
          bottleneck_risks: ["None identified"],
          optimization_opportunities: ["Automated workflow possible"],
        },
      };

      // Mock Phase 2 success
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { response: JSON.stringify(phase2Response) },
      });

      // Mock Phase 3 success
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { response: JSON.stringify(phase3Response) },
      });

      const analysis = await service.analyzeEmail(emailWithCompleteChain);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Phase 2 + Phase 3
      expect(analysis.strategic_insights.opportunity).toBe(
        "High-value complete workflow opportunity",
      );
      expect(analysis.executive_summary).toBe(
        "Complete workflow analysis successful",
      );
      expect(analysis.workflow_intelligence).toBeDefined();
      expect(analysis.phase3_processing_time).toBeGreaterThan(0);
    });
  });
});
