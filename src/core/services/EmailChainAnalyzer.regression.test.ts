/**
 * CRITICAL REGRESSION TESTS: Chain Completeness Scoring Binary Pathology Fix
 *
 * This test suite validates the fix for the SEVERE binary scoring issue where:
 * - 50% of conversations scored exactly 100%
 * - 50% of conversations scored exactly 0%
 * - NO intermediate scores (1-99%) existed in the entire dataset
 * - 22,654 conversations were affected by this binary pathology
 *
 * CRITICAL VALIDATION:
 * 1. Scores must be distributed across 0-100% range (not just binary)
 * 2. Single emails must NEVER achieve 100% scores
 * 3. Intermediate scores (1-99%) must be common and realistic
 * 4. Scoring must be consistent and deterministic
 * 5. No duplicate scoring logic conflicts
 *
 * These tests prevent regression of the binary scoring pathology that was
 * discovered in the production dataset analysis.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailChainAnalyzer } from './EmailChainAnalyzer';

// Mock database connection
vi.mock('../../database/ConnectionPool', () => ({
  getDatabaseConnection: vi.fn(),
  executeQuery: vi.fn((callback: any) => callback(mockDb)),
  executeTransaction: vi.fn((callback: any) => callback(mockDb)),
}));

let mockDb: any;
let mockDbData: any[] = [];

describe("CRITICAL REGRESSION: Binary Scoring Pathology Fix", () => {
  let analyzer: EmailChainAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbData = [];

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

    analyzer = new EmailChainAnalyzer(":memory:");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("CRITICAL: Anti-Binary Distribution Validation", () => {
    it("should produce distributed scores across 1000 realistic email scenarios", async () => {
      const scores: number[] = [];
      const scoreDistribution: Record<number, number> = {};

      // Generate 1000 varied email scenarios
      for (let i = 0; i < 1000; i++) {
        const scenarioType = i % 10; // 10 different scenario types
        const chain = generateVariedEmailScenario(scenarioType, i);

        if (chain?.length || 0 > 0) {
          mockDbData = chain;
          const analysis = await analyzer.analyzeChain(chain[0].id);
          scores.push(analysis.completeness_score);

          // Track distribution
          const roundedScore = Math.round(analysis.completeness_score);
          scoreDistribution[roundedScore] =
            (scoreDistribution[roundedScore] || 0) + 1;
        }
      }

      // CRITICAL VALIDATION: Anti-Binary Pathology Checks
      expect(scores?.length || 0).toBe(1000);

      // 1. Should not have binary distribution (only 0 and 100)
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBeGreaterThan(10); // Should have many different scores

      // 2. Check for intermediate scores (1-99%)
      const intermediateScores = scores?.filter(
        (score: any) => score > 0 && score < 100,
      );
      expect(intermediateScores?.length || 0).toBeGreaterThan(scores?.length || 0 * 0.7); // At least 70% should be intermediate

      // 3. No score should dominate (prevent 50/50 split)
      const maxOccurrence = Math.max(...Object.values(scoreDistribution));
      const dominanceRatio = maxOccurrence / scores?.length || 0;
      expect(dominanceRatio).toBeLessThan(0.1); // No single score should be >10% of dataset

      // 4. Should have reasonable spread
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      expect(maxScore - minScore).toBeGreaterThan(50); // Range should be > 50 points

      // 5. Average should not be at extremes
      const average =
        scores.reduce((sum: any, score: any) => sum + score, 0) / scores?.length || 0;
      expect(average).toBeGreaterThan(20);
      expect(average).toBeLessThan(80);

      console.log(`Score Distribution Analysis:
        Unique Scores: ${uniqueScores.size}
        Range: ${minScore} - ${maxScore}
        Average: ${average.toFixed(2)}
        Intermediate Scores: ${intermediateScores?.length || 0}/${scores?.length || 0} (${((intermediateScores?.length || 0 / scores?.length || 0) * 100).toFixed(1)}%)
        Max Single Score Occurrence: ${maxOccurrence} (${(dominanceRatio * 100).toFixed(1)}%)
      `);
    });

    it("should NEVER produce only 0% and 100% scores (binary pathology prevention)", async () => {
      const testScenarios = [
        "single_urgent_email",
        "two_email_incomplete_chain",
        "three_email_partial_chain",
        "four_email_moderate_chain",
        "five_email_comprehensive_chain",
        "six_email_complete_chain",
        "seven_email_extensive_chain",
        "partial_quote_process",
        "incomplete_order_process",
        "abandoned_support_ticket",
      ];

      const scores: number[] = [];

      for (const scenario of testScenarios) {
        for (let variation = 0; variation < 10; variation++) {
          const chain = generateSpecificScenario(scenario, variation);
          if (chain?.length || 0 > 0) {
            mockDbData = chain;
            const analysis = await analyzer.analyzeChain(chain[0].id);
            scores.push(analysis.completeness_score);
          }
        }
      }

      // CRITICAL: Should not have binary distribution
      const uniqueScores = new Set(scores);
      const scoreArray = Array.from(uniqueScores).sort((a, b) => a - b);

      // Should not have only 2 scores
      expect(uniqueScores.size).toBeGreaterThan(2);

      // Should not be clustered at only 0 and 100
      const zeroScores = scores?.filter((s: any) => s === 0).length;
      const hundredScores = scores?.filter((s: any) => s === 100).length;
      const intermediateScores = scores?.filter((s: any) => s > 0 && s < 100).length;

      // CRITICAL: Must have intermediate scores
      expect(intermediateScores).toBeGreaterThan(0);
      expect(intermediateScores).toBeGreaterThan(zeroScores + hundredScores);

      console.log(`Binary Pathology Check:
        Total Scenarios: ${scores?.length || 0}
        0% Scores: ${zeroScores}
        100% Scores: ${hundredScores}  
        Intermediate (1-99%): ${intermediateScores}
        Unique Score Values: ${uniqueScores.size}
        Score Range: [${Math.min(...scoreArray)}, ${Math.max(...scoreArray)}]
      `);
    });

    it("should ensure single emails never achieve 100% completeness (critical constraint)", async () => {
      const singleEmailVariations = [
        {
          urgency: "CRITICAL",
          amount: "$1000000",
          customer: "vip@enterprise.com",
          content:
            "URGENT: Need immediate quote for $1M data center equipment. CEO approval ready.",
        },
        {
          urgency: "HIGH",
          amount: "$500000",
          customer: "procurement@fortune500.com",
          content:
            "High priority order for Q1 budget. Need comprehensive proposal with financing options.",
        },
        {
          urgency: "STANDARD",
          amount: "$50000",
          customer: "buyer@company.com",
          content:
            "Standard quote request for server hardware. Standard timeline acceptable.",
        },
        {
          urgency: "LOW",
          amount: "$5000",
          customer: "admin@smallbiz.com",
          content:
            "Looking for basic office equipment. No rush on this request.",
        },
      ];

      for (const variation of singleEmailVariations) {
        const singleEmailChain = [
          {
            id: `single-${Math.random()}`,
            message_id: `msg-single-${Math.random()}`,
            subject: `${variation.urgency}: Equipment Quote Request`,
            from_address: variation.customer,
            to_addresses: "sales@vendor.com",
            received_time: new Date().toISOString(),
            body_text: `${variation.content} Budget: ${variation.amount}`,
            conversation_id: `chain-single-${Math.random()}`,
          },
        ];

        mockDbData = singleEmailChain;
        const analysis = await analyzer.analyzeChain(singleEmailChain[0].id);

        // CRITICAL: Single emails must NEVER be 100% complete
        expect(analysis.completeness_score).toBeLessThan(100);
        expect(analysis.completeness_score).toBeLessThanOrEqual(50); // Should be significantly less
        expect(analysis.chain_length).toBe(1);
        expect(analysis.is_complete).toBe(false);
        expect(analysis.missing_elements).toContain(
          "Multiple emails for context",
        );

        console.log(
          `Single Email Test - ${variation.urgency}: Score=${analysis.completeness_score}% (MUST be <100%)`,
        );
      }
    });

    it("should produce gradual score progression based on chain completeness", async () => {
      const progressionScenarios = [
        { name: "Single Email", emails: 1, expected_range: [0, 30] },
        { name: "Two Emails", emails: 2, expected_range: [25, 55] },
        { name: "Three Emails", emails: 3, expected_range: [45, 70] },
        { name: "Four Emails", emails: 4, expected_range: [60, 80] },
        { name: "Five+ Emails", emails: 6, expected_range: [75, 95] },
      ];

      const results: Array<{
        scenario: string;
        score: number;
        chainLength: number;
      }> = [];

      for (const scenario of progressionScenarios) {
        const chain = generateProgressiveChain(scenario.emails);
        mockDbData = chain;
        const analysis = await analyzer.analyzeChain(chain[0].id);

        results.push({
          scenario: scenario.name,
          score: analysis.completeness_score,
          chainLength: analysis.chain_length,
        });

        // Validate score is within expected range
        expect(analysis.completeness_score).toBeGreaterThanOrEqual(
          scenario.expected_range[0],
        );
        expect(analysis.completeness_score).toBeLessThanOrEqual(
          scenario.expected_range[1],
        );
        expect(analysis.chain_length).toBe(scenario.emails);
      }

      // Validate progression - longer chains should generally score higher
      for (let i = 1; i < results?.length || 0; i++) {
        const current = results[i];
        const previous = results[i - 1];

        // Allow some overlap but longer chains should tend to score higher
        expect(current.score).toBeGreaterThanOrEqual(previous.score - 15); // Allow 15 point overlap
      }

      console.log("Score Progression Validation:");
      results.forEach((r: any) => {
        console.log(`  ${r.scenario}: ${r.score}% (${r.chainLength} emails)`);
      });
    });
  });

  describe("CRITICAL: Scoring Component Validation", () => {
    it("should validate individual scoring components sum correctly", async () => {
      const testChain = [
        {
          id: "comp-test-1",
          message_id: "msg-comp-1",
          subject: "Quote Request for Enterprise Hardware - Quote #123456",
          from_address: "procurement@company.com",
          to_addresses: "sales@vendor.com",
          received_time: new Date().toISOString(),
          body_text:
            "Need comprehensive quote for data center upgrade project. Budget approved.",
          conversation_id: "comp-test-chain",
        },
        {
          id: "comp-test-2",
          message_id: "msg-comp-2",
          subject: "RE: Quote Request - Quote #123456 - Technical Review",
          from_address: "sales@vendor.com",
          to_addresses: "procurement@company.com",
          received_time: new Date(Date.now() + 3600000).toISOString(),
          body_text:
            "Technical team reviewing requirements. Will provide detailed proposal within 48 hours.",
          conversation_id: "comp-test-chain",
        },
        {
          id: "comp-test-3",
          message_id: "msg-comp-3",
          subject: "RE: Quote Request - Quote #123456 - Proposal Ready",
          from_address: "sales@vendor.com",
          to_addresses: "procurement@company.com",
          received_time: new Date(Date.now() + 172800000).toISOString(),
          body_text:
            "Comprehensive proposal attached. Quote #123456 total: $850,000. Includes implementation and support.",
          conversation_id: "comp-test-chain",
        },
        {
          id: "comp-test-4",
          message_id: "msg-comp-4",
          subject: "RE: Quote Request - Quote #123456 - Approved",
          from_address: "procurement@company.com",
          to_addresses: "sales@vendor.com",
          received_time: new Date(Date.now() + 259200000).toISOString(),
          body_text:
            "Quote approved. Proceeding with order. Thank you for the comprehensive proposal and support.",
          conversation_id: "comp-test-chain",
        },
      ];

      mockDbData = testChain;
      const analysis = await analyzer.analyzeChain("comp-test-1");

      // Validate individual components
      expect(analysis.has_start_point).toBe(true); // Should get 30 points
      expect(analysis.has_middle_correspondence).toBe(true); // Should get 30 points
      expect(analysis.has_completion).toBe(true); // Should get 40 points
      expect(analysis.chain_length).toBe(4); // Should get bonus points

      // Score should be reasonable (not exactly 100% but high)
      expect(analysis.completeness_score).toBeGreaterThanOrEqual(80);
      expect(analysis.completeness_score).toBeLessThanOrEqual(100);
      expect(analysis.is_complete).toBe(true); // >= 70% threshold

      // Should have quote number detection
      expect(analysis?.key_entities?.length).toContain("123456");
      expect(analysis.chain_type).toBe("quote_request");

      console.log(`Component Validation:
        Start Point: ${analysis.has_start_point}
        Middle: ${analysis.has_middle_correspondence}  
        Completion: ${analysis.has_completion}
        Chain Length: ${analysis.chain_length}
        Final Score: ${analysis.completeness_score}%
        Is Complete: ${analysis.is_complete}
      `);
    });

    it("should handle edge cases without extreme scoring", async () => {
      const edgeCases = [
        {
          name: "Empty Content",
          chain: [
            {
              id: "edge-1",
              message_id: "msg-edge-1",
              subject: "",
              from_address: "test@example.com",
              to_addresses: "recipient@example.com",
              received_time: new Date().toISOString(),
              body_text: "",
              conversation_id: "edge-chain-1",
            },
          ],
        },
        {
          name: "Null Fields",
          chain: [
            {
              id: "edge-2",
              message_id: "msg-edge-2",
              subject: null,
              from_address: "test@example.com",
              to_addresses: null,
              received_time: new Date().toISOString(),
              body_text: null,
              conversation_id: "edge-chain-2",
            },
          ],
        },
        {
          name: "Very Long Chain",
          chain: Array.from({ length: 25 }, (_, i) => ({
            id: `edge-long-${i}`,
            message_id: `msg-edge-long-${i}`,
            subject: `Long Discussion - Message ${i + 1}`,
            from_address:
              i % 2 === 0 ? "customer@example.com" : "support@vendor.com",
            to_addresses:
              i % 2 === 0 ? "support@vendor.com" : "customer@example.com",
            received_time: new Date(Date.now() + i * 3600000).toISOString(),
            body_text: `This is message ${i + 1} in a very long email chain.`,
            conversation_id: "edge-chain-long",
          })),
        },
      ];

      for (const edgeCase of edgeCases) {
        mockDbData = edgeCase.chain;
        const analysis = await analyzer.analyzeChain(edgeCase.chain[0].id);

        // Should handle gracefully without extreme scores
        expect(analysis.completeness_score).toBeGreaterThanOrEqual(0);
        expect(analysis.completeness_score).toBeLessThanOrEqual(100);
        expect(analysis.chain_length).toBe(edgeCase?.chain?.length);

        // Should not be undefined or null
        expect(analysis.completeness_score).not.toBeUndefined();
        expect(analysis.completeness_score).not.toBeNull();
        expect(typeof analysis.completeness_score).toBe("number");

        console.log(
          `Edge Case - ${edgeCase.name}: Score=${analysis.completeness_score}%, Length=${analysis.chain_length}`,
        );
      }
    });
  });

  describe("CRITICAL: Consistency and Determinism", () => {
    it("should produce identical scores for identical chains (deterministic)", async () => {
      const testChain = generateSpecificScenario("determinism_test", 0);
      const scores: number[] = [];

      // Run same analysis 10 times
      for (let i = 0; i < 10; i++) {
        mockDbData = testChain;
        const analysis = await analyzer.analyzeChain(testChain[0].id);
        scores.push(analysis.completeness_score);
      }

      // All scores should be identical
      const uniqueScores = new Set(scores);
      expect(uniqueScores.size).toBe(1);

      const score = scores[0];
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      console.log(`Determinism Test: All 10 runs produced score=${score}%`);
    });

    it("should show reasonable variation across similar but different chains", async () => {
      const baseScenario = "moderate_order_process";
      const scores: number[] = [];

      // Generate 20 similar but slightly different chains
      for (let variation = 0; variation < 20; variation++) {
        const chain = generateSpecificScenario(baseScenario, variation);
        mockDbData = chain;
        const analysis = await analyzer.analyzeChain(chain[0].id);
        scores.push(analysis.completeness_score);
      }

      // Should have some variation but not extreme
      const uniqueScores = new Set(scores);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const range = maxScore - minScore;

      expect(uniqueScores.size).toBeGreaterThan(1); // Should have variation
      expect(range).toBeGreaterThan(5); // At least 5 points variation
      expect(range).toBeLessThan(50); // But not extreme variation

      console.log(
        `Variation Test: ${uniqueScores.size} unique scores, range=${range} points (${minScore}-${maxScore})`,
      );
    });
  });

  describe("CRITICAL: Production Dataset Simulation", () => {
    it("should simulate 22,654 conversation scoring without binary pathology", async () => {
      const scores: number[] = [];
      const scoreDistribution: { [key: string]: number } = {};

      // Simulate large dataset with realistic distribution
      const scenarioTypes = [
        { type: "single_email", weight: 0.3 }, // 30% single emails
        { type: "incomplete_chain", weight: 0.4 }, // 40% incomplete chains
        { type: "moderate_chain", weight: 0.2 }, // 20% moderate chains
        { type: "complete_chain", weight: 0.1 }, // 10% complete chains
      ];

      // Process 1000 samples (representative of 22,654)
      for (let i = 0; i < 1000; i++) {
        // Select scenario type based on weights
        const rand = Math.random();
        let cumulativeWeight = 0;
        let selectedType = scenarioTypes[0].type;

        for (const scenario of scenarioTypes) {
          cumulativeWeight += scenario.weight;
          if (rand <= cumulativeWeight) {
            selectedType = scenario.type;
            break;
          }
        }

        const chain = generateSpecificScenario(selectedType, i % 100);
        if (chain?.length || 0 > 0) {
          mockDbData = chain;
          const analysis = await analyzer.analyzeChain(chain[0].id);
          scores.push(analysis.completeness_score);

          // Track distribution in 10-point buckets
          const bucket = `${Math.floor(analysis.completeness_score / 10) * 10}-${Math.floor(analysis.completeness_score / 10) * 10 + 9}`;
          scoreDistribution[bucket] = (scoreDistribution[bucket] || 0) + 1;
        }
      }

      // CRITICAL VALIDATION: No binary pathology
      const zeroScores = scores?.filter((s: any) => s === 0).length;
      const hundredScores = scores?.filter((s: any) => s === 100).length;
      const totalExtremes = zeroScores + hundredScores;
      const extremeRatio = totalExtremes / scores?.length || 0;

      // Should not have 50/50 split at extremes
      expect(extremeRatio).toBeLessThan(0.3); // Less than 30% at extremes

      // Should have good distribution across ranges
      const bucketsWithScores = Object.keys(scoreDistribution).length;
      expect(bucketsWithScores).toBeGreaterThan(5); // At least 6 different buckets

      // No single bucket should dominate
      const maxBucketCount = Math.max(...Object.values(scoreDistribution));
      const dominanceRatio = maxBucketCount / scores?.length || 0;
      expect(dominanceRatio).toBeLessThan(0.4); // No bucket >40%

      console.log(`Production Dataset Simulation (1000 samples):
        Score Distribution by 10-point buckets:
        ${Object.entries(scoreDistribution)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(
            ([bucket, count]) =>
              `  ${bucket}%: ${count} (${((count / scores?.length || 0) * 100).toFixed(1)}%)`,
          )
          .join("\n        ")}
        
        Binary Pathology Check:
        - 0% scores: ${zeroScores} (${((zeroScores / scores?.length || 0) * 100).toFixed(1)}%)
        - 100% scores: ${hundredScores} (${((hundredScores / scores?.length || 0) * 100).toFixed(1)}%)
        - Extreme ratio: ${(extremeRatio * 100).toFixed(1)}% (MUST be <30%)
        - Buckets with scores: ${bucketsWithScores}/10
        - Max bucket dominance: ${(dominanceRatio * 100).toFixed(1)}% (MUST be <40%)
      `);
    });
  });
});

// Helper functions for generating test scenarios
function generateVariedEmailScenario(
  scenarioType: number,
  variation: number,
): any[] {
  const baseTime = new Date("2024-01-01T10:00:00Z");
  const scenarioId = `scenario-${scenarioType}-${variation}`;

  switch (scenarioType % 10) {
    case 0: // Single urgent emails
      return [
        {
          id: `${scenarioId}-1`,
          message_id: `msg-${scenarioId}-1`,
          subject: `URGENT: System Issue #${variation}`,
          from_address: `customer${variation}@company.com`,
          to_addresses: "support@vendor.com",
          received_time: baseTime.toISOString(),
          body_text: `Critical system failure in production. Variation ${variation}. Need immediate assistance.`,
          conversation_id: scenarioId,
        },
      ];

    case 1: // Two-email incomplete chains
      return [
        {
          id: `${scenarioId}-1`,
          message_id: `msg-${scenarioId}-1`,
          subject: `Quote Request #QR${variation}`,
          from_address: `buyer${variation}@company.com`,
          to_addresses: "sales@vendor.com",
          received_time: baseTime.toISOString(),
          body_text: `Need quote for project ${variation}. Budget considerations apply.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-2`,
          message_id: `msg-${scenarioId}-2`,
          subject: `RE: Quote Request #QR${variation}`,
          from_address: "sales@vendor.com",
          to_addresses: `buyer${variation}@company.com`,
          received_time: new Date(baseTime.getTime() + 3600000).toISOString(),
          body_text: `Received your request. Working on quote QR${variation}.`,
          conversation_id: scenarioId,
        },
      ];

    case 2: // Three-email moderate chains
      return [
        {
          id: `${scenarioId}-1`,
          message_id: `msg-${scenarioId}-1`,
          subject: `Order Inquiry - Project ${variation}`,
          from_address: `procurement${variation}@corp.com`,
          to_addresses: "orders@vendor.com",
          received_time: baseTime.toISOString(),
          body_text: `Inquiring about hardware for project ${variation}. Timeline is flexible.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-2`,
          message_id: `msg-${scenarioId}-2`,
          subject: `RE: Order Inquiry - Project ${variation}`,
          from_address: "orders@vendor.com",
          to_addresses: `procurement${variation}@corp.com`,
          received_time: new Date(baseTime.getTime() + 7200000).toISOString(),
          body_text: `Thank you for your inquiry about project ${variation}. Preparing options.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-3`,
          message_id: `msg-${scenarioId}-3`,
          subject: `RE: Order Inquiry - Project ${variation} - Options Ready`,
          from_address: "orders@vendor.com",
          to_addresses: `procurement${variation}@corp.com`,
          received_time: new Date(baseTime.getTime() + 86400000).toISOString(),
          body_text: `Here are the options for project ${variation}. Please review and let us know.`,
          conversation_id: scenarioId,
        },
      ];

    // Continue with more scenario types...
    default:
      // Generate random-length chain (1-8 emails)
      const chainLength = Math.min(
        8,
        Math.max(1, Math.floor(Math.random() * 8) + 1),
      );
      return Array.from({ length: chainLength }, (_, i) => ({
        id: `${scenarioId}-${i + 1}`,
        message_id: `msg-${scenarioId}-${i + 1}`,
        subject: `Discussion Thread ${variation} - Message ${i + 1}`,
        from_address:
          i % 2 === 0
            ? `sender${variation}@company.com`
            : "recipient@vendor.com",
        to_addresses:
          i % 2 === 0
            ? "recipient@vendor.com"
            : `sender${variation}@company.com`,
        received_time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
        body_text: `Message ${i + 1} in thread for variation ${variation}. Some business content here.`,
        conversation_id: scenarioId,
      }));
  }
}

function generateSpecificScenario(
  scenarioType: string,
  variation: number,
): any[] {
  const baseTime = new Date("2024-01-01T10:00:00Z");
  const scenarioId = `${scenarioType}-${variation}`;

  switch (scenarioType) {
    case "single_urgent_email":
      return [
        {
          id: `${scenarioId}-1`,
          message_id: `msg-${scenarioId}-1`,
          subject: `CRITICAL: Production Down - Incident ${variation}`,
          from_address: `ops${variation}@company.com`,
          to_addresses: "emergency@vendor.com",
          received_time: baseTime.toISOString(),
          body_text: `Production systems offline. Incident ${variation}. Revenue impact $${10000 + variation * 1000}/hour.`,
          conversation_id: scenarioId,
        },
      ];

    case "incomplete_chain":
    case "two_email_incomplete_chain":
      return [
        {
          id: `${scenarioId}-1`,
          message_id: `msg-${scenarioId}-1`,
          subject: `Service Request SR${variation}`,
          from_address: `user${variation}@client.com`,
          to_addresses: "support@vendor.com",
          received_time: baseTime.toISOString(),
          body_text: `Need assistance with service issue ${variation}. Priority: Medium.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-2`,
          message_id: `msg-${scenarioId}-2`,
          subject: `RE: Service Request SR${variation}`,
          from_address: "support@vendor.com",
          to_addresses: `user${variation}@client.com`,
          received_time: new Date(baseTime.getTime() + 1800000).toISOString(),
          body_text: `Received SR${variation}. Investigating the issue now.`,
          conversation_id: scenarioId,
        },
      ];

    case "complete_chain":
      return [
        {
          id: `${scenarioId}-1`,
          message_id: `msg-${scenarioId}-1`,
          subject: `Project Planning - Initiative ${variation}`,
          from_address: `pm${variation}@enterprise.com`,
          to_addresses: "consulting@vendor.com",
          received_time: baseTime.toISOString(),
          body_text: `Planning initiative ${variation}. Need consulting services for implementation.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-2`,
          message_id: `msg-${scenarioId}-2`,
          subject: `RE: Project Planning - Initiative ${variation}`,
          from_address: "consulting@vendor.com",
          to_addresses: `pm${variation}@enterprise.com`,
          received_time: new Date(baseTime.getTime() + 3600000).toISOString(),
          body_text: `Thank you for initiative ${variation} inquiry. Scheduling consultation call.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-3`,
          message_id: `msg-${scenarioId}-3`,
          subject: `RE: Project Planning - Initiative ${variation} - Proposal`,
          from_address: "consulting@vendor.com",
          to_addresses: `pm${variation}@enterprise.com`,
          received_time: new Date(baseTime.getTime() + 86400000).toISOString(),
          body_text: `Initiative ${variation} proposal ready. Comprehensive solution included.`,
          conversation_id: scenarioId,
        },
        {
          id: `${scenarioId}-4`,
          message_id: `msg-${scenarioId}-4`,
          subject: `RE: Project Planning - Initiative ${variation} - Approved`,
          from_address: `pm${variation}@enterprise.com`,
          to_addresses: "consulting@vendor.com",
          received_time: new Date(baseTime.getTime() + 172800000).toISOString(),
          body_text: `Initiative ${variation} approved. Proceeding with implementation. Thank you for the excellent proposal.`,
          conversation_id: scenarioId,
        },
      ];

    default:
      // Default to moderate chain
      return generateProgressiveChain(3);
  }
}

function generateProgressiveChain(emailCount: number): any[] {
  const baseTime = new Date("2024-01-01T10:00:00Z");
  const chainId = `progressive-${emailCount}-${Math.random().toString(36).substr(2, 9)}`;

  return Array.from({ length: emailCount }, (_, i) => ({
    id: `${chainId}-${i + 1}`,
    message_id: `msg-${chainId}-${i + 1}`,
    subject:
      i === 0 ? `Progressive Chain Request` : `RE: Progressive Chain Request`,
    from_address: i % 2 === 0 ? "customer@company.com" : "vendor@supplier.com",
    to_addresses: i % 2 === 0 ? "vendor@supplier.com" : "customer@company.com",
    received_time: new Date(baseTime.getTime() + i * 3600000).toISOString(),
    body_text:
      i === 0
        ? "Initial request for progressive chain testing"
        : i === emailCount - 1 && emailCount > 3
          ? "Final response completing the chain process. Thank you for your assistance."
          : `Progressive response ${i + 1} continuing the conversation.`,
    conversation_id: chainId,
  }));
}
