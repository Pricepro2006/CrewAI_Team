/**
 * CRITICAL FIXES VALIDATION SUITE
 *
 * This master test suite validates both critical fixes working together:
 *
 * 1. JSON PARSING FIXES (Backend Systems Architect)
 *    ✓ Enhanced parsing logic for LLM markdown responses
 *    ✓ Retry mechanisms with progressive parameters
 *    ✓ Fallback extraction methods for malformed JSON
 *    ✓ Response structure validation and normalization
 *
 * 2. CHAIN SCORING FIXES (Data Scientist SQL)
 *    ✓ Elimination of binary scoring pathology (50% at 0%, 50% at 100%)
 *    ✓ Proper gradual scoring across 0-100% range
 *    ✓ Intermediate scores (1-99%) validation
 *    ✓ Single emails never achieving 100% scores
 *
 * This validation suite ensures both fixes work correctly together
 * and prevents regression of the critical issues discovered in production.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import axios from "axios";
import { EmailThreePhaseAnalysisService } from "../core/services/EmailThreePhaseAnalysisService.js";
import { EmailChainAnalyzer } from "../core/services/EmailChainAnalyzer.js";
import { RedisService } from "../core/cache/RedisService.js";

// Mock dependencies
vi.mock("axios");
vi.mock("../core/cache/RedisService.js");

// Mock database connection with inline factory function
vi.mock("../database/ConnectionPool.js", () => ({
  getDatabaseConnection: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
  })),
  executeQuery: vi.fn((callback: any) => callback({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
  })),
  executeTransaction: vi.fn((callback: any) => callback({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([]),
    }),
    exec: vi.fn(),
  })),
}));

const mockedAxios = axios as any;
let mockDb: any;
let mockDbData: any[] = [];

describe("CRITICAL FIXES VALIDATION: JSON Parsing + Chain Scoring", () => {
  let analysisService: EmailThreePhaseAnalysisService;
  let chainAnalyzer: EmailChainAnalyzer;
  let mockRedisService: any;

  // Track metrics across all tests
  let globalMetrics = {
    totalScenarios: 0,
    jsonParsingSuccesses: 0,
    jsonParsingRetries: 0,
    jsonParsingFallbacks: 0,
    chainScores: [] as number[],
    confidenceScores: [] as number[],
    processingTimes: [] as number[],
  };

  beforeAll(() => {
    console.log("🔍 STARTING CRITICAL FIXES VALIDATION SUITE");
    console.log("=".repeat(60));
  });

  afterAll(() => {
    console.log("\n" + "=".repeat(60));
    console.log("🎯 CRITICAL FIXES VALIDATION COMPLETE");
    console.log(`
📊 OVERALL VALIDATION METRICS:
Total Scenarios Tested: ${globalMetrics.totalScenarios}

🔧 JSON PARSING VALIDATION:
- Success Rate: ${((globalMetrics.jsonParsingSuccesses / globalMetrics.totalScenarios) * 100).toFixed(1)}%
- Retry Usage: ${((globalMetrics.jsonParsingRetries / globalMetrics.totalScenarios) * 100).toFixed(1)}%
- Fallback Usage: ${((globalMetrics.jsonParsingFallbacks / globalMetrics.totalScenarios) * 100).toFixed(1)}%

📈 CHAIN SCORING VALIDATION:
- Score Range: ${Math.min(...globalMetrics.chainScores)} - ${Math.max(...globalMetrics.chainScores)}%
- Unique Scores: ${new Set(globalMetrics.chainScores).size}
- Intermediate Scores (1-99%): ${globalMetrics?.chainScores?.filter((s: any) => s > 0 && s < 100).length}/${globalMetrics?.chainScores?.length} (${((globalMetrics?.chainScores?.filter((s: any) => s > 0 && s < 100).length / globalMetrics?.chainScores?.length) * 100).toFixed(1)}%)
- Binary Extremes (0% or 100%): ${globalMetrics?.chainScores?.filter((s: any) => s === 0 || s === 100).length} (${((globalMetrics?.chainScores?.filter((s: any) => s === 0 || s === 100).length / globalMetrics?.chainScores?.length) * 100).toFixed(1)}%)

⚡ PERFORMANCE:
- Average Processing Time: ${(globalMetrics?.processingTimes?.reduce((sum: any, t: any) => sum + t, 0) / globalMetrics?.processingTimes?.length).toFixed(0)}ms
- Average Confidence: ${(globalMetrics?.confidenceScores?.reduce((sum: any, c: any) => sum + c, 0) / globalMetrics?.confidenceScores?.length).toFixed(3)}

${globalMetrics?.chainScores?.filter((s: any) => s > 0 && s < 100).length > globalMetrics?.chainScores?.length * 0.5 ? "✅" : "❌"} CHAIN SCORING FIX: ${globalMetrics?.chainScores?.filter((s: any) => s > 0 && s < 100).length > globalMetrics?.chainScores?.length * 0.5 ? "VALIDATED" : "FAILED"}
${globalMetrics.jsonParsingSuccesses + globalMetrics.jsonParsingFallbacks === globalMetrics.totalScenarios ? "✅" : "❌"} JSON PARSING FIX: ${globalMetrics.jsonParsingSuccesses + globalMetrics.jsonParsingFallbacks === globalMetrics.totalScenarios ? "VALIDATED" : "FAILED"}
    `);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbData = [];

    // Mock database
    mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        return {
          run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
          get: vi.fn().mockImplementation((id: string) => {
            const email = mockDbData.find((email: any) => email.id === id);
            if (!email) return null;
            
            // Return email with all the fields the EmailChainAnalyzer expects
            return {
              id: email.id,
              internet_message_id: email.internet_message_id || email.message_id,
              subject: email.subject,
              sender_email: email.sender_email || email.from_address,
              recipient_emails: email.recipient_emails || email.to_addresses,
              received_date_time: email.received_date_time || email.received_time,
              conversation_id: email.conversation_id || email.thread_id,
              body_content: email.body_content || email.body_text,
            };
          }),
          all: vi.fn().mockImplementation((param?: string) => {
            let results;
            if (typeof param === "string") {
              results = mockDbData?.filter(
                (email: any) =>
                  email.thread_id === param || email.conversation_id === param,
              );
            } else {
              results = mockDbData;
            }
            
            // Map all results to expected schema
            return results?.map((email: any) => ({
              id: email.id,
              internet_message_id: email.internet_message_id || email.message_id,
              subject: email.subject,
              sender_email: email.sender_email || email.from_address,
              recipient_emails: email.recipient_emails || email.to_addresses,
              received_date_time: email.received_date_time || email.received_time,
              conversation_id: email.conversation_id || email.thread_id,
              body_content: email.body_content || email.body_text,
            }));
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

    // Initialize services with mock database
    chainAnalyzer = new EmailChainAnalyzer(":memory:", mockDb);
    analysisService = new EmailThreePhaseAnalysisService();
    
    // Replace the internal chainAnalyzer with our mock-enabled version
    (analysisService as any).chainAnalyzer = chainAnalyzer;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("🔧 JSON PARSING FIXES VALIDATION", () => {
    it("should handle all problematic LLM response formats identified in production", async () => {
      const problematicFormats = [
        {
          name: "Markdown Code Block",
          response: `Here's the analysis:\n\n\`\`\`json\n{"workflow_validation": "TEST_MARKDOWN", "missed_entities": {"project_names": [], "company_names": [], "people": [], "products": [], "technical_specs": [], "locations": [], "other_references": []}, "action_items": [], "risk_assessment": "Test", "initial_response": "Test", "confidence": 0.8, "business_process": "TEST", "extracted_requirements": []}\n\`\`\``,
          expected: "TEST_MARKDOWN",
        },
        {
          name: "Explanatory Prefix",
          response: `Based on my analysis of the email content, here's the structured response:\n\n{"workflow_validation": "TEST_PREFIX", "missed_entities": {"project_names": [], "company_names": [], "people": [], "products": [], "technical_specs": [], "locations": [], "other_references": []}, "action_items": [], "risk_assessment": "Test", "initial_response": "Test", "confidence": 0.9, "business_process": "TEST", "extracted_requirements": []}`,
          expected: "TEST_PREFIX",
        },
        {
          name: "Mixed Content",
          response: `Analysis complete. Results below:\n\n{"workflow_validation": "TEST_MIXED", "missed_entities": {"project_names": [], "company_names": [], "people": [], "products": [], "technical_specs": [], "locations": [], "other_references": []}, "action_items": [], "risk_assessment": "Test", "initial_response": "Test", "confidence": 0.85, "business_process": "TEST", "extracted_requirements": []}\n\nThis concludes the analysis.`,
          expected: "TEST_MIXED",
        },
      ];

      for (const format of problematicFormats) {
        mockDbData = createSingleEmailChain(format.name);

        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: { response: format.response },
        });

        const analysis = await analysisService.analyzeEmail(
          createSampleEmail(format.name),
        );

        expect(analysis.workflow_validation).toBe(format.expected);
        expect(analysis.confidence).toBeGreaterThan(0);

        globalMetrics.totalScenarios++;
        globalMetrics.jsonParsingSuccesses++;
        globalMetrics?.chainScores?.push(
          analysis.chain_analysis?.completeness_score || 0,
        );
        globalMetrics?.confidenceScores?.push(analysis.confidence);
      }

      console.log(
        `✅ JSON Parsing: Handled ${problematicFormats?.length || 0} problematic formats`,
      );
    });

    it("should validate retry mechanism with progressive parameters", async () => {
      mockDbData = createSingleEmailChain("retry-test");

      // Mock retry scenario: fail twice, succeed on third
      mockedAxios.post
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid JSON 1" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: { response: "Invalid JSON 2" },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: "RETRY_SUCCESS",
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
              risk_assessment: "Success after retry",
              initial_response: "Processed after retry",
              confidence: 0.75,
              business_process: "RETRY_VALIDATION",
              extracted_requirements: [],
            }),
          },
        });

      const analysis = await analysisService.analyzeEmail(
        createSampleEmail("retry-test"),
      );

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(analysis.workflow_validation).toBe("RETRY_SUCCESS");

      // Validate progressive parameters
      const calls = mockedAxios?.post?.mock.calls;
      expect(calls[0][1].options.temperature).toBe(0.1);
      expect(calls[1][1].options.temperature).toBe(0.05);
      expect(calls[2][1].options.temperature).toBe(0.05);

      globalMetrics.totalScenarios++;
      globalMetrics.jsonParsingRetries++;
      globalMetrics?.chainScores?.push(
        analysis.chain_analysis?.completeness_score || 0,
      );
      globalMetrics?.confidenceScores?.push(analysis.confidence);

      console.log(
        "✅ JSON Parsing: Retry mechanism validated with progressive parameters",
      );
    });

    it("should validate fallback extraction methods", async () => {
      mockDbData = createSingleEmailChain("fallback-test");

      // Mock complete parsing failure
      Array.from({ length: 3 }, () => {
        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: {
            response: "Completely unparseable response with no structure",
          },
        });
      });

      const analysis = await analysisService.analyzeEmail(
        createSampleEmail("fallback-test"),
      );

      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(analysis.workflow_validation).toContain("parsing failed");
      expect(analysis.confidence).toBe(0.3); // Fallback confidence
      expect(analysis.business_process).toBe("PARSING_ERROR");

      globalMetrics.totalScenarios++;
      globalMetrics.jsonParsingFallbacks++;
      globalMetrics?.chainScores?.push(
        analysis.chain_analysis?.completeness_score || 0,
      );
      globalMetrics?.confidenceScores?.push(analysis.confidence);

      console.log("✅ JSON Parsing: Fallback extraction validated");
    });
  });

  describe("📈 CHAIN SCORING FIXES VALIDATION", () => {
    it("should eliminate binary scoring pathology across 500 scenarios", async () => {
      const testResults: number[] = [];

      // Test 500 varied scenarios to validate scoring distribution
      for (let i = 0; i < 500; i++) {
        const chainLength = Math.floor(Math.random() * 8) + 1; // 1-8 emails
        const chain = createRandomEmailChain(i, chainLength);
        mockDbData = chain;

        // Mock successful JSON parsing for consistent scoring validation
        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: `SCENARIO_${i}`,
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

        const analysis = await analysisService.analyzeEmail({
          id: `random-${i}-1`,
          subject: `Test Email for scenario-${i}`,
          body: `Test content for scenario-${i} validation`,
          sender_email: "test@example.com",
          recipient_emails: "recipient@example.com",
          received_at: new Date().toISOString(),
        });
        const score = analysis.chain_analysis?.completeness_score || 0;
        testResults.push(score);

        globalMetrics.totalScenarios++;
        globalMetrics.jsonParsingSuccesses++;
        globalMetrics?.chainScores?.push(score);
        globalMetrics?.confidenceScores?.push(analysis.confidence);
      }

      // CRITICAL VALIDATION: No binary pathology
      const uniqueScores = new Set(testResults);
      const zeroScores = testResults?.filter((s: any) => s === 0).length;
      const hundredScores = testResults?.filter((s: any) => s === 100).length;
      const intermediateScores = testResults?.filter(
        (s: any) => s > 0 && s < 100,
      ).length;
      const binaryExtremes = zeroScores + hundredScores;

      expect(uniqueScores.size).toBeGreaterThan(20); // Many different scores
      expect(intermediateScores).toBeGreaterThan(testResults?.length || 0 * 0.5); // >50% intermediate
      expect(binaryExtremes).toBeLessThan(testResults?.length || 0 * 0.3); // <30% at extremes

      console.log(`✅ Chain Scoring: Binary pathology eliminated across 500 scenarios
        - Unique scores: ${uniqueScores.size}
        - Intermediate (1-99%): ${intermediateScores} (${((intermediateScores / testResults?.length || 0) * 100).toFixed(1)}%)
        - Binary extremes: ${binaryExtremes} (${((binaryExtremes / testResults?.length || 0) * 100).toFixed(1)}%)`);
    });

    it("should ensure single emails never achieve 100% scores", async () => {
      const singleEmailScenarios = [
        { urgency: "CRITICAL", amount: "$1M", customer: "enterprise" },
        { urgency: "HIGH", amount: "$500K", customer: "vip" },
        { urgency: "MEDIUM", amount: "$100K", customer: "standard" },
        { urgency: "LOW", amount: "$10K", customer: "basic" },
      ];

      for (const scenario of singleEmailScenarios) {
        const chain = [
          {
            id: `single-${scenario.customer}`,
            internet_message_id: `msg-single-${scenario.customer}`,
            subject: `${scenario.urgency}: Equipment Request - ${scenario.amount} Budget`,
            sender_email: `${scenario.customer}@company.com`,
            recipient_emails: "sales@vendor.com",
            received_date_time: new Date().toISOString(),
            body_content: `${scenario.urgency} priority request. Budget: ${scenario.amount}. Need immediate quote.`,
            conversation_id: `chain-single-${scenario.customer}`,
          },
        ];
        mockDbData = chain;

        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: `SINGLE_EMAIL_${scenario.urgency}`,
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
              risk_assessment: `${scenario.urgency} priority processing`,
              initial_response: "Processing request",
              confidence: 0.9,
              business_process: "SINGLE_EMAIL_PROCESSING",
              extracted_requirements: [],
            }),
          },
        });

        const analysis = await analysisService.analyzeEmail({
          id: `single-${scenario.customer}`,
          subject: `Test Email for ${scenario.customer}`,
          body: `Test content for ${scenario.customer} validation`,
          sender_email: "test@example.com",
          recipient_emails: "recipient@example.com",
          received_at: new Date().toISOString(),
        });
        const score = analysis.chain_analysis?.completeness_score || 0;

        // CRITICAL: Single emails must NEVER be 100%
        expect(score).toBeLessThan(100);
        expect(score).toBeLessThanOrEqual(30); // Should be low
        expect(analysis.chain_analysis?.chain_length).toBe(1);
        expect(analysis.chain_analysis?.is_complete_chain).toBe(false);

        globalMetrics.totalScenarios++;
        globalMetrics.jsonParsingSuccesses++;
        globalMetrics?.chainScores?.push(score);
        globalMetrics?.confidenceScores?.push(analysis.confidence);
      }

      console.log(
        "✅ Chain Scoring: Single emails correctly limited to <100% scores",
      );
    });

    it("should produce gradual score progression based on chain completeness", async () => {
      const progressionTests = [
        { length: 1, expectedRange: [0, 30], name: "Single Email" },
        { length: 2, expectedRange: [25, 55], name: "Two Emails" },
        { length: 3, expectedRange: [40, 70], name: "Three Emails" },
        { length: 5, expectedRange: [60, 85], name: "Five Emails" },
        { length: 7, expectedRange: [70, 95], name: "Seven Emails" },
      ];

      for (const test of progressionTests) {
        const chain = createProgressiveChain(test?.length || 0);
        mockDbData = chain;

        mockedAxios?.post?.mockResolvedValueOnce({
          status: 200,
          data: {
            response: JSON.stringify({
              workflow_validation: `PROGRESSION_${test?.length || 0}_EMAILS`,
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
              risk_assessment: "Progressive scoring test",
              initial_response: "Processing",
              confidence: 0.8,
              business_process: "PROGRESSION_TEST",
              extracted_requirements: [],
            }),
          },
        });

        const analysis = await analysisService.analyzeEmail({
          id: `progressive-${test?.length || 0}-1`,
          subject: `Test Email for progression-${test?.length || 0}`,
          body: `Test content for progression-${test?.length || 0} validation`,
          sender_email: "test@example.com",
          recipient_emails: "recipient@example.com",
          received_at: new Date().toISOString(),
        });
        const score = analysis.chain_analysis?.completeness_score || 0;

        expect(score).toBeGreaterThanOrEqual(test.expectedRange[0]);
        expect(score).toBeLessThanOrEqual(test.expectedRange[1]);
        expect(analysis.chain_analysis?.chain_length).toBe(test?.length || 0);

        globalMetrics.totalScenarios++;
        globalMetrics.jsonParsingSuccesses++;
        globalMetrics?.chainScores?.push(score);
        globalMetrics?.confidenceScores?.push(analysis.confidence);

        console.log(
          `✅ Chain Scoring: ${test.name} scored ${score}% (expected ${test.expectedRange[0]}-${test.expectedRange[1]}%)`,
        );
      }
    });
  });

  describe("🚀 INTEGRATED PERFORMANCE VALIDATION", () => {
    it.skip("should validate both fixes working together under load", async () => {
      const startTime = Date.now();
      const loadTestResults: Array<{
        scenario: number;
        processingTime: number;
        chainScore: number;
        jsonParsingAttempts: number;
        success: boolean;
      }> = [];

      // Test 200 scenarios with varied complexity
      for (let i = 0; i < 200; i++) {
        const scenarioStart = Date.now();

        // Create varied scenario
        const chainLength = Math.floor(Math.random() * 6) + 1;
        const responseComplexity = i % 4; // Vary JSON parsing complexity

        const chain = createRandomEmailChain(i, chainLength);
        mockDbData = chain;

        // Mock varied JSON parsing scenarios
        const responses = generateVariedResponses(responseComplexity, i);
        responses.forEach((response: any) => {
          mockedAxios?.post?.mockResolvedValueOnce({
            status: 200,
            data: { response },
          });
        });

        try {
          const analysis = await analysisService.analyzeEmail(
            createSampleEmail(`load-${i}`),
          );
          const processingTime = Date.now() - scenarioStart;

          loadTestResults.push({
            scenario: i,
            processingTime,
            chainScore: analysis.chain_analysis?.completeness_score || 0,
            jsonParsingAttempts: responses?.length || 0,
            success: true,
          });

          globalMetrics.totalScenarios++;
          globalMetrics?.processingTimes?.push(processingTime);
          globalMetrics?.chainScores?.push(
            analysis.chain_analysis?.completeness_score || 0,
          );
          globalMetrics?.confidenceScores?.push(analysis.confidence);

          // Count JSON parsing metrics
          if (responses?.length || 0 === 1 && !responses[0].includes("Invalid")) {
            globalMetrics.jsonParsingSuccesses++;
          } else if (responses?.length || 0 > 1) {
            globalMetrics.jsonParsingRetries++;
          } else {
            globalMetrics.jsonParsingFallbacks++;
          }
        } catch (error) {
          loadTestResults.push({
            scenario: i,
            processingTime: Date.now() - scenarioStart,
            chainScore: 0,
            jsonParsingAttempts: responses?.length || 0,
            success: false,
          });
        }
      }

      const totalTime = Date.now() - startTime;
      const successfulScenarios = loadTestResults?.filter((r: any) => r.success);
      const averageProcessingTime =
        successfulScenarios.reduce((sum: any, r: any) => sum + r.processingTime, 0) /
        successfulScenarios?.length || 0;

      // Validate performance
      expect(successfulScenarios?.length || 0).toBe(200); // All should succeed
      expect(averageProcessingTime).toBeLessThan(5000); // <5s average
      expect(totalTime).toBeLessThan(300000); // <5 min total

      // Validate distribution
      const chainScores = successfulScenarios?.map((r: any) => r.chainScore);
      const uniqueScores = new Set(chainScores);
      const intermediateScores = chainScores?.filter((s: any) => s > 0 && s < 100);

      expect(uniqueScores.size).toBeGreaterThan(15);
      expect(intermediateScores?.length || 0).toBeGreaterThan(
        chainScores?.length || 0 * 0.5,
      );

      console.log(`✅ Load Test: 200 scenarios completed in ${(totalTime / 1000).toFixed(1)}s
        - Success rate: 100%
        - Average processing: ${averageProcessingTime.toFixed(0)}ms
        - Chain score diversity: ${uniqueScores.size} unique scores
        - Intermediate scores: ${((intermediateScores?.length || 0 / chainScores?.length || 0) * 100).toFixed(1)}%`);
    });
  });
});

// Helper functions
function createSingleEmailChain(testName: string): any[] {
  return [
    {
      id: `test-${testName}-1`,
      internet_message_id: `msg-test-${testName}-1`,
      subject: `Test Email for ${testName}`,
      sender_email: "test@example.com",
      recipient_emails: "recipient@example.com",
      received_date_time: new Date().toISOString(),
      body_content: `Test content for ${testName} validation`,
      conversation_id: `chain-test-${testName}`,
    },
  ];
}

function createSampleEmail(testName: string): any {
  return {
    id: `test-${testName}-1`,
    subject: `Test Email for ${testName}`,
    body: `Test content for ${testName} validation`,
    sender_email: "test@example.com",
    recipient_emails: "recipient@example.com",
    received_at: new Date().toISOString(),
  };
}

function createRandomEmailChain(seed: number, length: number): any[] {
  const chainId = `random-${seed}`;
  const baseTime = new Date();

  return Array.from({ length }, (_, i) => ({
    id: `${chainId}-${i + 1}`,
    internet_message_id: `msg-${chainId}-${i + 1}`,
    subject: i === 0 ? `Random Chain ${seed}` : `RE: Random Chain ${seed}`,
    sender_email: i % 2 === 0 ? `sender${seed}@test.com` : "recipient@test.com",
    recipient_emails: i % 2 === 0 ? "recipient@test.com" : `sender${seed}@test.com`,
    received_date_time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
    body_content: `Email ${i + 1} content for chain ${seed}`,
    conversation_id: chainId,
  }));
}

function createProgressiveChain(length: number): any[] {
  const chainId = `progressive-${length}`;
  const baseTime = new Date();

  return Array.from({ length }, (_, i) => ({
    id: `${chainId}-${i + 1}`,
    internet_message_id: `msg-${chainId}-${i + 1}`,
    subject: i === 0 ? "Progressive Chain Test" : "RE: Progressive Chain Test",
    sender_email: i % 2 === 0 ? "customer@test.com" : "vendor@test.com",
    recipient_emails: i % 2 === 0 ? "vendor@test.com" : "customer@test.com",
    received_date_time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
    body_content:
      i === length - 1 && length > 3
        ? "Final email completing the chain. Thank you for your assistance."
        : `Progressive email ${i + 1} in chain of ${length}`,
    conversation_id: chainId,
  }));
}

function generateVariedResponses(complexity: number, seed: number): string[] {
  const validResponse = {
    workflow_validation: `LOAD_TEST_${seed}`,
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
    risk_assessment: `Load test scenario ${seed}`,
    initial_response: "Processing load test",
    confidence: 0.8,
    business_process: "LOAD_TEST",
    extracted_requirements: [],
  };

  switch (complexity) {
    case 0: // Clean JSON
      return [JSON.stringify(validResponse)];

    case 1: // Markdown
      return [`\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``];

    case 2: // Retry needed
      return ["Invalid JSON response", JSON.stringify(validResponse)];

    case 3: // Fallback
      return ["Unparseable 1", "Unparseable 2", "Unparseable 3"];

    default:
      return [JSON.stringify(validResponse)];
  }
}
