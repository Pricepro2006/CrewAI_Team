/**
 * CRITICAL INTEGRATION TESTS: Full Pipeline Validation with JSON Parsing & Chain Scoring Fixes
 *
 * This comprehensive test suite validates the complete email analysis pipeline
 * with both critical fixes applied:
 *
 * 1. JSON PARSING FIXES:
 *    - Enhanced parsing logic for LLM markdown responses
 *    - Retry mechanisms with different prompts and parameters
 *    - Fallback extraction methods for malformed JSON
 *    - Response structure validation and normalization
 *
 * 2. CHAIN SCORING FIXES:
 *    - Elimination of binary scoring pathology (50% at 0%, 50% at 100%)
 *    - Proper gradual scoring across 0-100% range
 *    - Intermediate scores (1-99%) validation
 *    - Single emails never achieving 100% scores
 *
 * These integration tests ensure no regression occurs when both fixes
 * operate together in the complete email analysis pipeline.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from "axios";
import { EmailThreePhaseAnalysisService } from './EmailThreePhaseAnalysisService';
import { EmailChainAnalyzer } from './EmailChainAnalyzer';
import { RedisService } from '../cache/RedisService';

// Mock dependencies
vi.mock("axios");
vi.mock('../cache/RedisService');
vi.mock('../../database/ConnectionPool', () => ({
  getDatabaseConnection: vi.fn(),
  executeQuery: vi.fn((callback: any) => callback(mockDb)),
  executeTransaction: vi.fn((callback: any) => callback(mockDb)),
}));

const mockedAxios = axios as any;
let mockDb: any;
let mockDbData: any[] = [];

describe("CRITICAL INTEGRATION: Full Pipeline with JSON Parsing & Chain Scoring Fixes", () => {
  let analysisService: EmailThreePhaseAnalysisService;
  let chainAnalyzer: EmailChainAnalyzer;
  let mockRedisService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbData = [];

    // Mock database
    mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        return {
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
          get: vi.fn().mockImplementation((id: string) => {
            return mockDbData.find((email: any) => email.id === id) || null;
          }),
          all: vi.fn().mockImplementation((param?: string) => {
            if (typeof param === "string") {
              return mockDbData?.filter(
                (email: any) =>
                  email.thread_id === param || email.conversation_id === param,
              );
            }
            return mockDbData;
          }),
        };
      }),
      exec: vi.fn(),
    };

    // Mock RedisService
    mockRedisService = {
      set: vi.fn().mockResolvedValue("OK"),
      get: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockResolvedValue(undefined),
    };
    (RedisService as any).mockImplementation(() => mockRedisService);

    // Initialize services
    chainAnalyzer = new EmailChainAnalyzer(":memory:");
    analysisService = new EmailThreePhaseAnalysisService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CRITICAL: End-to-End Pipeline with Both Fixes", () => {
    it("should handle problematic LLM responses with correct chain scoring", async () => {
      // Setup: Single email chain (should score low, never 100%)
      const singleEmailChain = [
        {
          id: "integration-single-1",
          message_id: "msg-integration-1",
          subject: "URGENT: Critical System Failure - Need Immediate Quote",
          from_address: "cto@enterprise.com",
          to_addresses: "emergency@vendor.com",
          received_time: new Date().toISOString(),
          body_text:
            "Production systems are down. Need emergency hardware quote for $500K budget. CEO approved.",
          conversation_id: "integration-single-chain",
        },
      ];
      mockDbData = singleEmailChain;

      // Mock problematic LLM response (markdown + explanatory text)
      const problematicLLMResponse = `
I understand this is a critical situation requiring immediate attention. Let me analyze this urgent request.

Based on the content, this appears to be a high-priority emergency request that needs special handling.

\`\`\`json
{
  "workflow_validation": "EMERGENCY_ESCALATION confirmed - critical system failure",
  "missed_entities": {
    "project_names": ["System Recovery"],
    "company_names": ["Enterprise Corp"],
    "people": ["CTO"],
    "products": ["Emergency Hardware"],
    "technical_specs": ["Production Systems"],
    "locations": ["Primary Data Center"],
    "other_references": ["$500K Budget", "CEO Approval"]
  },
  "action_items": [
    {
      "task": "Prepare emergency quote immediately",
      "owner": "emergency_response_team",
      "deadline": "2024-01-30T18:00:00Z",
      "revenue_impact": "$500000"
    }
  ],
  "risk_assessment": "CRITICAL - Production down, revenue impact escalating, customer retention at risk",
  "initial_response": "Emergency response activated. Priority quote being prepared immediately. Technical team standing by.",
  "confidence": 0.98,
  "business_process": "EMERGENCY_ESCALATION",
  "extracted_requirements": ["Immediate response", "Emergency pricing", "Expedited delivery", "24/7 support"]
}
\`\`\`

This is clearly a critical emergency that requires our highest priority response and escalation to executive level.
      `;

      mockedAxios?.post?.mockResolvedValue({
        status: 200,
        data: { response: problematicLLMResponse },
      });

      const sampleEmail = {
        id: "integration-single-1",
        subject: "URGENT: Critical System Failure - Need Immediate Quote",
        body: "Production systems are down. Need emergency hardware quote for $500K budget. CEO approved.",
        sender_email: "cto@enterprise.com",
        recipient_emails: "emergency@vendor.com",
        received_at: new Date().toISOString(),
      };

      const analysis = await analysisService.analyzeEmail(sampleEmail);

      // CRITICAL VALIDATION: JSON Parsing Fix Working
      expect(analysis.workflow_validation).toBe(
        "EMERGENCY_ESCALATION confirmed - critical system failure",
      );
      expect(analysis?.missed_entities).toEqual([
        "System Recovery",
      ]);
      expect(analysis.confidence).toBe(0.98);
      expect(analysis.business_process).toBe("EMERGENCY_ESCALATION");
      expect(analysis.action_items).toHaveLength(1);
      expect(analysis.action_items[0].revenue_impact).toBe("$500000");

      // CRITICAL VALIDATION: Chain Scoring Fix Working
      expect(analysis.chain_analysis?.length).toBeLessThan(100); // Single email never 100%
      expect(analysis.chain_analysis?.length).toBeLessThanOrEqual(
        30,
      ); // Should be low
      expect(analysis.chain_analysis?.length).toBe(false);
      expect(analysis.chain_analysis?).toHaveLength(1);
      expect(analysis.chain_analysis?.length).toContain(
        "Multiple emails for context",
      );

      // Should complete with Phase 2 only (incomplete chain)
      expect(analysis.phase2_processing_time).toBeGreaterThan(0);
      expect(analysis?.strategic_insights?.length).toContain(
        "Incomplete chain",
      );

      console.log(`Integration Test - Single Email:
        JSON Parsing: ✓ Successfully parsed markdown LLM response
        Chain Scoring: ✓ Score=${analysis.chain_analysis?.completeness_score}% (correctly <100%)
        Phase Selection: ✓ Phase 2 only (incomplete chain)
        Confidence: ${analysis.confidence}
      `);
    });

    it("should handle retry scenarios with progressive chain scoring", async () => {
      // Setup: Progressive chain that should get better scores as it grows
      const progressiveChain = [
        {
          id: "integration-progressive-1",
          message_id: "msg-progressive-1",
          subject: "Data Center Modernization - RFP #2024-001",
          from_address: "procurement@megacorp.com",
          to_addresses: "enterprise@vendor.com",
          received_time: new Date().toISOString(),
          body_text:
            "Request for proposal for complete data center modernization. Budget: $2.5M. Timeline: Q2 2024.",
          conversation_id: "integration-progressive-chain",
        },
        {
          id: "integration-progressive-2",
          message_id: "msg-progressive-2",
          subject: "RE: Data Center Modernization - RFP #2024-001",
          from_address: "enterprise@vendor.com",
          to_addresses: "procurement@megacorp.com",
          received_time: new Date(Date.now() + 3600000).toISOString(),
          body_text:
            "Received RFP #2024-001. Technical team reviewing requirements. Will provide comprehensive proposal.",
          conversation_id: "integration-progressive-chain",
        },
        {
          id: "integration-progressive-3",
          message_id: "msg-progressive-3",
          subject:
            "RE: Data Center Modernization - RFP #2024-001 - Proposal Ready",
          from_address: "enterprise@vendor.com",
          to_addresses: "procurement@megacorp.com",
          received_time: new Date(Date.now() + 172800000).toISOString(),
          body_text:
            "Comprehensive proposal attached for RFP #2024-001. Total investment: $2.3M including implementation and 3-year support.",
          conversation_id: "integration-progressive-chain",
        },
        {
          id: "integration-progressive-4",
          message_id: "msg-progressive-4",
          subject: "RE: Data Center Modernization - RFP #2024-001 - Approved",
          from_address: "procurement@megacorp.com",
          to_addresses: "enterprise@vendor.com",
          received_time: new Date(Date.now() + 432000000).toISOString(),
          body_text:
            "RFP #2024-001 approved by executive committee. Proceeding with modernization project. Excellent proposal.",
          conversation_id: "integration-progressive-chain",
        },
      ];
      mockDbData = progressiveChain;

      // Mock retry scenario: First attempt fails, second succeeds
      const invalidFirstResponse =
        "This is not valid JSON at all - just explanatory text without structure";

      const validRetryResponse = {
        workflow_validation:
          "PROJECT_APPROVAL confirmed - complete RFP cycle executed",
        missed_entities: {
          project_names: ["Data Center Modernization"],
          company_names: ["MegaCorp"],
          people: ["Procurement Team", "Executive Committee"],
          products: ["Data Center Infrastructure", "Implementation Services"],
          technical_specs: ["Complete modernization", "3-year support"],
          locations: ["Primary Data Center"],
          other_references: [
            "RFP #2024-001",
            "$2.3M Investment",
            "Q2 2024 Timeline",
          ],
        },
        action_items: [
          {
            task: "Initiate project kickoff meeting",
            owner: "project_management",
            deadline: "2024-02-15",
            revenue_impact: "$2300000",
          },
        ],
        risk_assessment:
          "Low risk - approved project with clear timeline and budget",
        initial_response:
          "Project approved. Scheduling kickoff meeting and resource allocation.",
        confidence: 0.94,
        business_process: "ENTERPRISE_PROJECT_EXECUTION",
        extracted_requirements: [
          "Complete modernization",
          "Implementation support",
          "3-year warranty",
        ],
      };

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: invalidFirstResponse },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: JSON.stringify(validRetryResponse) },
        });

      const sampleEmail = {
        id: "integration-progressive-1",
        subject: "Data Center Modernization - RFP #2024-001",
        body: "Request for proposal for complete data center modernization. Budget: $2.5M. Timeline: Q2 2024.",
        sender_email: "procurement@megacorp.com",
        recipient_emails: "enterprise@vendor.com",
        received_at: new Date().toISOString(),
      };

      const analysis = await analysisService.analyzeEmail(sampleEmail);

      // CRITICAL VALIDATION: JSON Parsing with Retry Working
      expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Failed first, succeeded on retry
      expect(analysis.workflow_validation).toBe(
        "PROJECT_APPROVAL confirmed - complete RFP cycle executed",
      );
      expect(analysis.confidence).toBe(0.94);
      expect(analysis.business_process).toBe("ENTERPRISE_PROJECT_EXECUTION");
      expect(analysis?.missed_entities).toEqual([
        "Data Center Modernization",
      ]);

      // CRITICAL VALIDATION: Progressive Chain Scoring Working
      expect(
        analysis.chain_analysis?.completeness_score,
      ).toBeGreaterThanOrEqual(75); // Complete chain should score high
      expect(analysis.chain_analysis?.length).toBeLessThanOrEqual(
        100,
      );
      expect(analysis.chain_analysis?.length).toBe(true);
      expect(analysis.chain_analysis?).toHaveLength(4);
      expect(analysis.chain_analysis?.length).toBe("quote_request");
      expect(analysis.chain_analysis?.length).toHaveLength(0); // Complete chain

      // Should trigger Phase 3 (complete chain)
      expect(analysis.strategic_insights).toBeDefined();
      expect(analysis.phase3_processing_time).toBeGreaterThan(0);

      console.log(`Integration Test - Progressive Chain:
        JSON Parsing: ✓ Retry mechanism worked (failed → succeeded)
        Chain Scoring: ✓ Score=${analysis.chain_analysis?.completeness_score}% (correctly high for complete chain)
        Phase Selection: ✓ Phase 3 triggered (complete chain)
        Confidence: ${analysis.confidence}
      `);
    });

    it("should handle fallback extraction with intermediate chain scoring", async () => {
      // Setup: Moderate chain (should get intermediate scores, not binary)
      const moderateChain = [
        {
          id: "integration-moderate-1",
          message_id: "msg-moderate-1",
          subject: "Software License Renewal - Contract #SL-2024-456",
          from_address: "it@company.com",
          to_addresses: "licensing@vendor.com",
          received_time: new Date().toISOString(),
          body_text:
            "Need to renew software licenses for 500 users. Contract #SL-2024-456 expires end of month.",
          conversation_id: "integration-moderate-chain",
        },
        {
          id: "integration-moderate-2",
          message_id: "msg-moderate-2",
          subject: "RE: Software License Renewal - Contract #SL-2024-456",
          from_address: "licensing@vendor.com",
          to_addresses: "it@company.com",
          received_time: new Date(Date.now() + 7200000).toISOString(),
          body_text:
            "Received renewal request for Contract #SL-2024-456. Preparing updated licensing proposal.",
          conversation_id: "integration-moderate-chain",
        },
        {
          id: "integration-moderate-3",
          message_id: "msg-moderate-3",
          subject:
            "RE: Software License Renewal - Contract #SL-2024-456 - Proposal",
          from_address: "licensing@vendor.com",
          to_addresses: "it@company.com",
          received_time: new Date(Date.now() + 86400000).toISOString(),
          body_text:
            "Renewal proposal attached for Contract #SL-2024-456. 500 user licenses with 15% volume discount.",
          conversation_id: "integration-moderate-chain",
        },
      ];
      mockDbData = moderateChain;

      // Mock complete parsing failure - should trigger fallback extraction
      const unparseableResponses = [
        "Random text without any structure or JSON content whatsoever",
        "Another completely unstructured response that cannot be parsed",
        "Final attempt also completely unparseable - no JSON or key-value pairs",
      ];

      unparseableResponses.forEach((response: any) => {
        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: { response },
        });
      });

      const sampleEmail = {
        id: "integration-moderate-1",
        subject: "Software License Renewal - Contract #SL-2024-456",
        body: "Need to renew software licenses for 500 users. Contract #SL-2024-456 expires end of month.",
        sender_email: "it@company.com",
        recipient_emails: "licensing@vendor.com",
        received_at: new Date().toISOString(),
      };

      const analysis = await analysisService.analyzeEmail(sampleEmail);

      // CRITICAL VALIDATION: Fallback Extraction Working
      expect(mockedAxios.post).toHaveBeenCalledTimes(3); // All retries exhausted
      expect(analysis.workflow_validation).toContain("parsing failed");
      expect(analysis.confidence).toBe(0.3); // Fallback confidence
      expect(analysis.business_process).toBe("PARSING_ERROR");

      // CRITICAL VALIDATION: Intermediate Chain Scoring Working
      expect(analysis.chain_analysis?.length).toBeGreaterThan(30); // Not at binary extremes
      expect(analysis.chain_analysis?.length).toBeLessThan(80); // Moderate chain
      expect(analysis.chain_analysis?.length).toBe(false); // Incomplete (no resolution)
      expect(analysis.chain_analysis?).toHaveLength(3);
      expect(analysis.chain_analysis?.length).toContain(
        "Completion/resolution confirmation",
      );

      // Should complete with Phase 2 fallback (incomplete chain)
      expect(analysis?.strategic_insights?.length).toContain(
        "Incomplete chain",
      );
      expect(analysis.phase3_processing_time).toBe(0); // No Phase 3

      console.log(`Integration Test - Moderate Chain with Fallback:
        JSON Parsing: ✓ Fallback extraction used after all retries failed
        Chain Scoring: ✓ Score=${analysis.chain_analysis?.completeness_score}% (correctly intermediate)
        Phase Selection: ✓ Phase 2 only (incomplete chain)
        Confidence: ${analysis.confidence} (fallback)
      `);
    });

    it("should validate parsing metrics tracking across multiple analyses", async () => {
      const testScenarios = [
        {
          name: "Success First Try",
          chain: createTestChain("success", 1),
          responses: [
            JSON.stringify({
              workflow_validation: "SUCCESS_FIRST_TRY",
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
            }),
          ],
        },
        {
          name: "Success After Retry",
          chain: createTestChain("retry", 2),
          responses: [
            "Invalid JSON first attempt",
            JSON.stringify({
              workflow_validation: "SUCCESS_AFTER_RETRY",
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
              initial_response: "Success after retry",
              confidence: 0.85,
              business_process: "RETRY_SUCCESS",
              extracted_requirements: [],
            }),
          ],
        },
        {
          name: "Fallback Usage",
          chain: createTestChain("fallback", 3),
          responses: [
            "Unparseable response 1",
            "Unparseable response 2",
            "Unparseable response 3",
          ],
        },
      ];

      const results: any[] = [];

      for (const scenario of testScenarios) {
        mockDbData = scenario.chain;

        scenario?.responses?.forEach((response: any) => {
          mockedAxios?.post?.mockResolvedValueOnce({
            status: 200,
            data: { response },
          });
        });

        const sampleEmail = {
          id: scenario.chain[0].id,
          subject: scenario.chain[0].subject,
          body: scenario.chain[0].body_text,
          sender_email: scenario.chain[0].from_address,
          recipient_emails: scenario.chain[0].to_addresses,
          received_at: scenario.chain[0].received_time,
        };

        const analysis = await analysisService.analyzeEmail(sampleEmail);
        results.push({
          scenario: scenario.name,
          chainScore: analysis.chain_analysis?.completeness_score,
          confidence: analysis.confidence,
          workflow: analysis.workflow_validation,
        });
      }

      // Validate parsing metrics were tracked
      const stats = await analysisService.getAnalysisStats();
      expect(stats?.parsingMetrics).toBeGreaterThan(3);
      expect(stats?.parsingMetrics).toBeGreaterThanOrEqual(2);
      expect(stats?.parsingMetrics).toBeGreaterThanOrEqual(1);
      expect(stats?.parsingMetrics).toBeGreaterThanOrEqual(1);

      // Validate chain scoring diversity
      const chainScores = results
        .map((r: any) => r.chainScore)
        .filter((s: any) => s !== undefined);
      const uniqueChainScores = new Set(chainScores);
      expect(uniqueChainScores.size).toBeGreaterThan(1); // Should have varied scores

      console.log(`Integration Test - Parsing Metrics:
        Total Attempts: ${stats?.parsingMetrics?.totalAttempts}
        Success Rate: ${stats?.parsingMetrics?.successRate}%
        Retry Rate: ${stats?.parsingMetrics?.retryRate}%
        Fallback Rate: ${stats?.parsingMetrics?.fallbackRate}%
        
        Chain Score Diversity: ${uniqueChainScores.size} unique scores
        Results: ${results?.map((r: any) => `${r.scenario}: ${r.chainScore}%`).join(", ")}
      `);
    });
  });

  describe("CRITICAL: Stress Testing Both Fixes Together", () => {
    it("should handle 100 varied scenarios without regression", async () => {
      const results: Array<{
        scenario: number;
        chainLength: number;
        chainScore: number;
        jsonParsingAttempts: number;
        confidence: number;
        isComplete: boolean;
      }> = [];

      for (let i = 0; i < 100; i++) {
        // Generate varied scenario
        const chainLength = Math.floor(Math.random() * 8) + 1; // 1-8 emails
        const chain = createRandomChain(i, chainLength);
        mockDbData = chain;

        // Randomly select response type to test different parsing scenarios
        const responseType = i % 4;
        const mockResponses = generateMockResponses(responseType, i);

        mockResponses.forEach((response: any) => {
          mockedAxios?.post?.mockResolvedValueOnce({
            status: 200,
            data: { response },
          });
        });

        const sampleEmail = {
          id: chain[0].id,
          subject: chain[0].subject,
          body: chain[0].body_text,
          sender_email: chain[0].from_address,
          recipient_emails: chain[0].to_addresses,
          received_at: chain[0].received_time,
        };

        try {
          const analysis = await analysisService.analyzeEmail(sampleEmail);

          results.push({
            scenario: i,
            chainLength: analysis.chain_analysis?.chain_length || 0,
            chainScore: analysis.chain_analysis?.completeness_score || 0,
            jsonParsingAttempts: mockResponses?.length || 0,
            confidence: analysis.confidence,
            isComplete: analysis.chain_analysis?.is_complete_chain || false,
          });
        } catch (error) {
          console.error(`Scenario ${i} failed:`, error);
          // Should not throw - tests pipeline robustness
          expect(true).toBe(false); // Fail if any scenario throws
        }
      }

      // Validate overall results
      expect(results?.length || 0).toBe(100);

      // Chain scoring validation
      const chainScores = results?.map((r: any) => r.chainScore);
      const uniqueScores = new Set(chainScores);
      const zeroScores = chainScores?.filter((s: any) => s === 0).length;
      const hundredScores = chainScores?.filter((s: any) => s === 100).length;
      const intermediateScores = chainScores?.filter(
        (s: any) => s > 0 && s < 100,
      ).length;

      // CRITICAL: No binary pathology
      expect(uniqueScores.size).toBeGreaterThan(10); // Many different scores
      expect(intermediateScores).toBeGreaterThan(results?.length || 0 * 0.5); // >50% intermediate
      expect(zeroScores + hundredScores).toBeLessThan(results?.length || 0 * 0.3); // <30% at extremes

      // JSON parsing validation
      const totalAttempts = results.reduce(
        (sum, r) => sum + r.jsonParsingAttempts,
        0,
      );
      expect(totalAttempts).toBeGreaterThan(100); // Some retries occurred

      // All scenarios should complete successfully
      const confidences = results?.map((r: any) => r.confidence);
      expect(Math.min(...confidences)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...confidences)).toBeLessThanOrEqual(1);

      console.log(`Stress Test Results (${testScenarios} scenarios):
        Chain Scoring:
        - Unique scores: ${uniqueScores.size}
        - Intermediate (1-99%): ${intermediateScores}
        - Extreme (0% or 100%): ${zeroScores + hundredScores}
        - Score range: ${Math.min(...chainScores)} - ${Math.max(...chainScores)}
        
        JSON Parsing:
        - Total attempts: ${totalAttempts}
        - Average attempts: ${(totalAttempts / results?.length || 0).toFixed(2)}
        - Confidence range: ${Math.min(...confidences).toFixed(2)} - ${Math.max(...confidences).toFixed(2)}
      `);
    });
  });
});

// Helper functions for test data generation
function createTestChain(type: string, length: number): any[] {
  const baseTime = new Date();
  const chainId = `test-${type}-${Math.random().toString(36).substr(2, 9)}`;

  return Array.from({ length }, (_, i) => ({
    id: `${chainId}-${i + 1}`,
    message_id: `msg-${chainId}-${i + 1}`,
    subject: i === 0 ? `Test ${type} Chain` : `RE: Test ${type} Chain`,
    from_address: i % 2 === 0 ? "sender@test.com" : "recipient@test.com",
    to_addresses: i % 2 === 0 ? "recipient@test.com" : "sender@test.com",
    received_time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
    body_text: `Test email ${i + 1} for ${type} scenario`,
    conversation_id: chainId,
  }));
}

function createRandomChain(seed: number, length: number): any[] {
  const chainId = `random-${seed}`;
  const baseTime = new Date();

  return Array.from({ length }, (_, i) => ({
    id: `${chainId}-${i + 1}`,
    message_id: `msg-${chainId}-${i + 1}`,
    subject:
      i === 0 ? `Random Scenario ${seed}` : `RE: Random Scenario ${seed}`,
    from_address: i % 2 === 0 ? `customer${seed}@test.com` : "vendor@test.com",
    to_addresses: i % 2 === 0 ? "vendor@test.com" : `customer${seed}@test.com`,
    received_time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
    body_text: `Random content ${i + 1} for scenario ${seed}. Some business content here.`,
    conversation_id: chainId,
  }));
}

function generateMockResponses(type: number, seed: number): string[] {
  const validResponse = {
    workflow_validation: `SCENARIO_${seed}_VALIDATED`,
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
    risk_assessment: `Standard risk for scenario ${seed}`,
    initial_response: `Processing scenario ${seed}`,
    confidence: 0.8 + (seed % 20) / 100, // Vary confidence
    business_process: "STANDARD_PROCESSING",
    extracted_requirements: [],
  };

  switch (type) {
    case 0: // Success first try
      return [JSON.stringify(validResponse)];

    case 1: // Success after retry
      return ["Invalid JSON first attempt", JSON.stringify(validResponse)];

    case 2: // Success after markdown parsing
      return [`\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``];

    case 3: // Fallback usage
      return [
        "Unparseable response",
        "Still unparseable",
        "Final unparseable response",
      ];

    default:
      return [JSON.stringify(validResponse)];
  }
}
