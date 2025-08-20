/**
 * Comprehensive JSON Parsing Validation Tests
 *
 * These tests validate the enhanced JSON parsing logic that handles:
 * - LLM returning markdown instead of JSON
 * - Various problematic response formats
 * - Retry mechanism functionality
 * - Fallback extraction methods
 *
 * Critical for preventing regression of JSON parsing improvements
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from "axios";
import { EmailThreePhaseAnalysisService } from './EmailThreePhaseAnalysisService';

// Mock dependencies
vi.mock("axios");
vi.mock('../cache/RedisService');
vi.mock('./EmailChainAnalyzer');

// Mock database connection pool with proper mock structure
vi.mock('../../database/ConnectionPool', () => {
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

// Test data for various problematic LLM response formats
const PROBLEMATIC_RESPONSES = {
  // Markdown with additional text
  MARKDOWN_WITH_EXPLANATIONS: `
I'll analyze this email step by step.

\`\`\`json
{
  "workflow_validation": "QUOTE_PROCESSING confirmed",
  "missed_entities": {
    "project_names": ["Data Center Expansion"],
    "company_names": ["TechCorp Inc"],
    "people": ["John Smith", "Sarah Johnson"],
    "products": ["HPE Servers", "Network Equipment"],
    "technical_specs": ["64GB RAM", "NVMe Storage"],
    "locations": ["New York Office"],
    "other_references": ["Quote #12345"]
  },
  "action_items": [
    {
      "task": "Prepare detailed quote",
      "owner": "sales team",
      "deadline": "2024-02-15",
      "revenue_impact": "$500000"
    }
  ],
  "risk_assessment": "Medium risk - large deal with competitive pressure",
  "initial_response": "Thank you for your quote request. We'll provide a comprehensive proposal within 48 hours.",
  "confidence": 0.87,
  "business_process": "ENTERPRISE_QUOTE_PROCESSING",
  "extracted_requirements": ["High availability", "24/7 support", "3-year warranty"]
}
\`\`\`

This analysis shows a high-value quote request with specific technical requirements.
  `,

  // Multiple code blocks (should pick the right one)
  MULTIPLE_CODE_BLOCKS: `
First, let me show some pseudocode:

\`\`\`
if (email.isQuote) {
  processQuote();
}
\`\`\`

Now here's the actual JSON analysis:

\`\`\`json
{
  "workflow_validation": "ORDER_MANAGEMENT validated", 
  "missed_entities": {
    "project_names": [],
    "company_names": ["ACME Corp"],
    "people": ["Mike Wilson"],
    "products": ["Storage Array"],
    "technical_specs": ["10TB Capacity"],
    "locations": [],
    "other_references": ["PO #789456"]
  },
  "action_items": [
    {
      "task": "Verify PO details",
      "owner": "order processing",
      "deadline": "2024-02-10"
    }
  ],
  "risk_assessment": "Low risk - standard order processing",
  "initial_response": "Order received and processing has begun",
  "confidence": 0.92,
  "business_process": "STANDARD_ORDER_FULFILLMENT",
  "extracted_requirements": ["Standard delivery", "Email notifications"]
}
\`\`\`

And here's some additional analysis code:

\`\`\`python
def analyze_email():
    return "analysis complete"
\`\`\`
  `,

  // Malformed JSON with common errors
  MALFORMED_JSON: `{
    workflow_validation: "SUPPORT_TICKET confirmed", // Missing quotes on keys
    missed_entities: {
      project_names: [Project Alpha], // Missing quotes on string values
      company_names: ["Support Corp"],
      people: ["Alice Brown",], // Trailing comma
      products: [],
      technical_specs: [],
      locations: [],
      other_references: []
    },
    action_items: [
      {
        task: "Investigate server issue", // Missing quotes
        owner: "technical support",
        deadline: "2024-02-12"
      }
    ],
    risk_assessment: "High priority - production system down",
    initial_response: "We've received your urgent support request and are investigating immediately.",
    confidence: 0.78,
    business_process: TECHNICAL_SUPPORT, // Missing quotes
    extracted_requirements: ["Immediate response", "Root cause analysis"]
  }`,

  // JSON with extra commas and syntax errors
  SYNTAX_ERRORS: `{
    "workflow_validation": "ESCALATION required",
    "missed_entities": {
      "project_names": [],
      "company_names": ["Enterprise Client"],
      "people": ["CEO John Doe"],
      "products": [],
      "technical_specs": [],
      "locations": [],
      "other_references": [],
    },
    "action_items": [
      {
        "task": "Schedule executive call",
        "owner": "account manager",
        "deadline": "2024-02-08",
        "revenue_impact": "$2000000",
      },
    ],
    "risk_assessment": "Critical - C-level escalation required",
    "initial_response": "Thank you for bringing this to our attention. Our executive team will contact you immediately.",
    "confidence": 0.95,
    "business_process": "EXECUTIVE_ESCALATION",
    "extracted_requirements": ["Executive attention", "Immediate response"],
  }`,

  // Mixed content with partial JSON
  MIXED_CONTENT: `
Based on my analysis of the email content, I can provide the following insights:

The email appears to be related to shipping and logistics. Here are the key findings:

{
  "workflow_validation": "SHIPPING confirmed",
  "confidence": 0.85,
  "risk_assessment": "Standard shipping - no issues identified"
}

Additional analysis shows this is routine correspondence about delivery schedules.
The customer seems satisfied with the proposed timeline.

Missing some fields but the core analysis is above.
  `,

  // Nested markdown with indentation
  NESTED_MARKDOWN: `
## Email Analysis Results

### Primary Analysis

The email content suggests an urgent request for technical support.

\`\`\`json
{
  "workflow_validation": "URGENT_SUPPORT confirmed",
  "missed_entities": {
    "project_names": ["Critical System"],
    "company_names": ["Healthcare Provider"],
    "people": ["Dr. Smith", "IT Manager"],
    "products": ["Medical Equipment"],
    "technical_specs": ["FDA Compliant"],
    "locations": ["Hospital Network"],
    "other_references": ["Case #555123"]
  },
  "action_items": [
    {
      "task": "Immediate technical assistance",
      "owner": "senior engineer",
      "deadline": "2024-02-07T16:00:00Z",
      "revenue_impact": "Retention risk"
    }
  ],
  "risk_assessment": "Critical - healthcare system impact",
  "initial_response": "Emergency support team has been notified and will contact you within 1 hour.",
  "confidence": 0.93,
  "business_process": "CRITICAL_SUPPORT_ESCALATION",
  "extracted_requirements": ["Immediate response", "Healthcare compliance", "System restoration"]
}
\`\`\`

### Secondary Considerations

This requires immediate escalation due to the healthcare context.
  `,

  // HTML-like content mixed with JSON
  HTML_MIXED: `
<analysis>
<summary>The email requires quote processing</summary>

<json>
{
  "workflow_validation": "QUOTE_REQUEST validated",
  "missed_entities": {
    "project_names": ["Infrastructure Upgrade"],
    "company_names": ["Manufacturing Corp"],
    "people": ["Plant Manager"],
    "products": ["Industrial Servers"],
    "technical_specs": ["Ruggedized Design"],
    "locations": ["Factory Floor"],
    "other_references": ["RFQ #999888"]
  },
  "action_items": [
    {
      "task": "Industrial specification review",
      "owner": "technical sales",
      "deadline": "2024-02-20"
    }
  ],
  "risk_assessment": "Medium risk - specialized requirements",
  "initial_response": "We specialize in industrial computing solutions and will prepare a tailored quote.",
  "confidence": 0.81,
  "business_process": "SPECIALIZED_QUOTE_PROCESSING",
  "extracted_requirements": ["Industrial grade", "Extended warranty"]
}
</json>
</analysis>
  `,

  // Key-value pairs instead of JSON
  KEY_VALUE_FORMAT: `
workflow_validation: RETURNS_PROCESSING confirmed
confidence: 0.76
risk_assessment: Low risk - standard return request
business_process: RETURN_MERCHANDISE_AUTHORIZATION
initial_response: Your return request has been received and an RMA number will be provided shortly.

missed_entities:
  project_names: []
  company_names: [Customer Services Corp]
  people: [Returns Manager]
  products: [Defective Hardware]
  technical_specs: []
  locations: [Warehouse]
  other_references: [RMA #777666]

action_items:
  - task: Process return authorization
    owner: returns team
    deadline: 2024-02-14

extracted_requirements:
  - Return label
  - Inspection report
  `,

  // Completely invalid responses
  NO_JSON_AT_ALL: `
This email appears to be a standard business inquiry about pricing.
The customer is asking for information about server configurations.
I would recommend following up with a detailed quote.
No structured data can be extracted from this format.
  `,

  // Empty or minimal responses
  EMPTY_RESPONSE: "",

  MINIMAL_RESPONSE: "{}",

  // Unicode and special characters
  UNICODE_CONTENT: `
\`\`\`json
{
  "workflow_validation": "INTERNATIONAL_ORDER confirmed ✓",
  "missed_entities": {
    "project_names": ["Ñew Proyect 2024"],
    "company_names": ["Töch Corp GmbH"],
    "people": ["José García", "François Dubois"],
    "products": ["Sërvér Equipment"],
    "technical_specs": ["UTF-8 Compatible"],
    "locations": ["München, Germany"],
    "other_references": ["€50,000 Budget"]
  },
  "action_items": [
    {
      "task": "Prepare international quote",
      "owner": "EMEA sales",
      "deadline": "2024-02-25",
      "revenue_impact": "€50000"
    }
  ],
  "risk_assessment": "Standard risk - established EU client",
  "initial_response": "Guten Tag! We'll prepare your quote with international shipping options.",
  "confidence": 0.89,
  "business_process": "INTERNATIONAL_SALES",
  "extracted_requirements": ["CE Certification", "EU Compliance", "Multi-language support"]
}
\`\`\`
  `,
};

describe("JSON Parsing Validation Tests", () => {
  let service: EmailThreePhaseAnalysisService;

  const sampleEmail = {
    id: "test-email-json",
    subject: "Test Email for JSON Parsing",
    body: "Test email body content for parsing validation",
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

  describe("Enhanced Markdown Extraction", () => {
    it("should extract JSON from markdown with explanatory text", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.MARKDOWN_WITH_EXPLANATIONS },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("QUOTE_PROCESSING confirmed");
      expect(analysis?.missed_entities).toEqual([
        "Data Center Expansion",
      ]);
      expect(analysis?.missed_entities).toEqual(["TechCorp Inc"]);
      expect(analysis.action_items).toHaveLength(1);
      expect(analysis.action_items[0].task).toBe("Prepare detailed quote");
      expect(analysis.confidence).toBe(0.87);
      expect(analysis.business_process).toBe("ENTERPRISE_QUOTE_PROCESSING");
    });

    it("should select correct JSON from multiple code blocks", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.MULTIPLE_CODE_BLOCKS },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("ORDER_MANAGEMENT validated");
      expect(analysis?.missed_entities).toEqual(["ACME Corp"]);
      expect(analysis.business_process).toBe("STANDARD_ORDER_FULFILLMENT");
      expect(analysis.confidence).toBe(0.92);
    });

    it("should handle nested markdown structure", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.NESTED_MARKDOWN },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("URGENT_SUPPORT confirmed");
      expect(analysis?.missed_entities).toEqual([
        "Critical System",
      ]);
      expect(analysis.business_process).toBe("CRITICAL_SUPPORT_ESCALATION");
      expect(analysis.risk_assessment).toBe(
        "Critical - healthcare system impact",
      );
    });
  });

  describe("Malformed JSON Recovery", () => {
    it("should fix common JSON syntax errors on retry", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: PROBLEMATIC_RESPONSES.MALFORMED_JSON },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: "SUPPORT_TICKET confirmed",
              missed_entities: {
                project_names: ["Project Alpha"],
                company_names: ["Support Corp"],
                people: ["Alice Brown"],
                products: [],
                technical_specs: [],
                locations: [],
                other_references: [],
              },
              action_items: [
                {
                  task: "Investigate server issue",
                  owner: "technical support",
                  deadline: "2024-02-12",
                },
              ],
              risk_assessment: "High priority - production system down",
              initial_response:
                "We've received your urgent support request and are investigating immediately.",
              confidence: 0.78,
              business_process: "TECHNICAL_SUPPORT",
              extracted_requirements: [
                "Immediate response",
                "Root cause analysis",
              ],
            }),
          },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Initial + retry
      expect(analysis.workflow_validation).toBe("SUPPORT_TICKET confirmed");
      expect(analysis.business_process).toBe("TECHNICAL_SUPPORT");
      expect(analysis.confidence).toBe(0.78);
    });

    it("should handle extra commas and trailing syntax errors", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: PROBLEMATIC_RESPONSES.SYNTAX_ERRORS },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: "ESCALATION required",
              missed_entities: {
                project_names: [],
                company_names: ["Enterprise Client"],
                people: ["CEO John Doe"],
                products: [],
                technical_specs: [],
                locations: [],
                other_references: [],
              },
              action_items: [
                {
                  task: "Schedule executive call",
                  owner: "account manager",
                  deadline: "2024-02-08",
                  revenue_impact: "$2000000",
                },
              ],
              risk_assessment: "Critical - C-level escalation required",
              initial_response:
                "Thank you for bringing this to our attention. Our executive team will contact you immediately.",
              confidence: 0.95,
              business_process: "EXECUTIVE_ESCALATION",
              extracted_requirements: [
                "Executive attention",
                "Immediate response",
              ],
            }),
          },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("ESCALATION required");
      expect(analysis.business_process).toBe("EXECUTIVE_ESCALATION");
      expect(analysis.confidence).toBe(0.95);
    });
  });

  describe("Fallback Extraction Methods", () => {
    it("should extract from partial JSON in mixed content", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.MIXED_CONTENT },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("SHIPPING confirmed");
      expect(analysis.confidence).toBe(0.85);
      expect(analysis.risk_assessment).toBe(
        "Standard shipping - no issues identified",
      );
      // Should have default values for missing fields
      expect(analysis.missed_entities).toBeDefined();
      expect(analysis.action_items).toBeDefined();
      expect(analysis.business_process).toBeDefined();
    });

    it("should parse key-value format when JSON fails", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.KEY_VALUE_FORMAT },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("RETURNS_PROCESSING confirmed");
      expect(analysis.confidence).toBe(0.76);
      expect(analysis.risk_assessment).toBe(
        "Low risk - standard return request",
      );
      expect(analysis.business_process).toBe(
        "RETURN_MERCHANDISE_AUTHORIZATION",
      );
    });

    it("should handle HTML-like mixed content", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.HTML_MIXED },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe("QUOTE_REQUEST validated");
      expect(analysis?.missed_entities).toEqual([
        "Infrastructure Upgrade",
      ]);
      expect(analysis.business_process).toBe("SPECIALIZED_QUOTE_PROCESSING");
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    it("should handle completely invalid responses with graceful fallback", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: PROBLEMATIC_RESPONSES.NO_JSON_AT_ALL },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Still not JSON format" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Final attempt failed too" },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // All retry attempts
      expect(analysis.workflow_validation).toContain("rule-based analysis");
      expect(analysis.confidence).toBe(0.5); // Fallback confidence
      expect(analysis.business_process).toBe("PARSING_ERROR");
      expect(analysis.risk_assessment).toContain("Unable to assess");
    });

    it("should handle empty responses", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.EMPTY_RESPONSE },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBeDefined();
      expect(analysis.missed_entities).toBeDefined();
      expect(analysis.action_items).toBeDefined();
      expect(analysis.confidence).toBe(0.5); // Fallback
    });

    it("should handle minimal JSON responses", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.MINIMAL_RESPONSE },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      // Should fill in all required fields with defaults
      expect(analysis.workflow_validation).toBe(
        "Unable to validate workflow from response",
      );
      expect(analysis.missed_entities).toBeDefined();
      expect(Array.isArray(analysis.action_items)).toBe(true);
      expect(analysis.confidence).toBe(0.5);
    });

    it("should handle Unicode and special characters", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.UNICODE_CONTENT },
      });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(analysis.workflow_validation).toBe(
        "INTERNATIONAL_ORDER confirmed ✓",
      );
      expect(analysis?.missed_entities).toEqual([
        "Ñew Proyect 2024",
      ]);
      expect(analysis?.missed_entities).toEqual([
        "Töch Corp GmbH",
      ]);
      expect(analysis?.missed_entities).toEqual([
        "José García",
        "François Dubois",
      ]);
      expect(analysis.business_process).toBe("INTERNATIONAL_SALES");
    });
  });

  describe("Retry Logic and Temperature Adjustment", () => {
    it("should use progressively lower temperatures on retries", async () => {
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
          data: {
            response: JSON.stringify({
              workflow_validation: "Success on final attempt",
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
              initial_response: "Final attempt successful",
              confidence: 0.7,
              business_process: "STANDARD_PROCESSING",
              extracted_requirements: [],
            }),
          },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);

      // Verify temperature progression
      const calls = mockedAxios?.post?.mock.calls;
      expect(calls[0][1].options.temperature).toBe(0.1); // First attempt
      expect(calls[1][1].options.temperature).toBe(0.05); // Second attempt (retry)
      expect(calls[2][1].options.temperature).toBe(0.05); // Third attempt (retry)

      expect(analysis.workflow_validation).toBe("Success on final attempt");
    });

    it("should use different prompts on retry attempts", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Not JSON" },
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
              initial_response: "Success",
              confidence: 0.8,
              business_process: "RETRY_SUCCESS",
              extracted_requirements: [],
            }),
          },
        });

      const analysis = await service.analyzeEmail(sampleEmail);

      const calls = mockedAxios?.post?.mock.calls;
      expect(calls[0][1].prompt).not.toContain("retry attempt");
      expect(calls[1][1].prompt).toContain("retry attempt");

      expect(analysis.business_process).toBe("RETRY_SUCCESS");
    });
  });

  describe("Parsing Metrics Tracking", () => {
    it("should track successful parsing on first attempt", async () => {
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
        risk_assessment: "Standard",
        initial_response: "Success",
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
      expect(stats?.parsingMetrics).toBeGreaterThan(0);
      expect(stats?.parsingMetrics).toBeGreaterThan(0);
      expect(stats).toBeDefined(); // No retries needed
    });

    it("should track retry success metrics", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Failed first attempt" },
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
              initial_response: "Success",
              confidence: 0.8,
              business_process: "STANDARD",
              extracted_requirements: [],
            }),
          },
        });

      await service.analyzeEmail(sampleEmail);

      const stats = await service.getAnalysisStats();
      expect(stats?.parsingMetrics).toBeGreaterThan(0);
      expect(stats?.parsingMetrics).toBeGreaterThan(0);
    });

    it("should track fallback usage when all retries fail", async () => {
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Failed attempt 1" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Failed attempt 2" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Failed attempt 3" },
        });

      await service.analyzeEmail(sampleEmail);

      const stats = await service.getAnalysisStats();
      expect(stats?.parsingMetrics).toBeGreaterThan(0);
      expect(stats).toBeDefined();
    });
  });

  describe("Performance and Consistency", () => {
    it("should parse complex JSON responses within reasonable time", async () => {
      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: PROBLEMATIC_RESPONSES.MARKDOWN_WITH_EXPLANATIONS },
      });

      const startTime = Date.now();
      const analysis = await service.analyzeEmail(sampleEmail);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(analysis.workflow_validation).toBeDefined();
    });

    it("should produce consistent results for identical inputs", async () => {
      const response = PROBLEMATIC_RESPONSES?.NESTED_MARKDOWN;

      const analyses = [];
      for (let i = 0; i < 3; i++) {
        mockedAxios?.post?.mockResolvedValue({
          status: 200,
          data: { response },
        });

        const analysis = await service.analyzeEmail(sampleEmail);
        analyses.push(analysis);
      }

      // All analyses should have identical core fields
      expect(analyses[0].workflow_validation).toBe(
        analyses[1].workflow_validation,
      );
      expect(analyses[1].workflow_validation).toBe(
        analyses[2].workflow_validation,
      );
      expect(analyses[0].confidence).toBe(analyses[1].confidence);
      expect(analyses[1].confidence).toBe(analyses[2].confidence);
    });
  });
});
