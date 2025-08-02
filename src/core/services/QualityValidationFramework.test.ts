/**
 * Comprehensive Tests for Quality Validation Framework
 *
 * Tests the critical quality validation system that prevents poor LLM responses
 * from replacing high-quality fallbacks.
 */

import { EmailThreePhaseAnalysisService } from "./EmailThreePhaseAnalysisService.js";
import { Logger } from "../../utils/logger.js";

const logger = new Logger("QualityValidationTest");

interface TestScenario {
  name: string;
  description: string;
  mockLLMResponse: any;
  mockPhase1Results: any;
  options?: any;
  expectedQuality: {
    scoreRange: [number, number]; // [min, max]
    shouldUseFallback: boolean;
    shouldUseHybrid: boolean;
  };
}

class QualityValidationTester {
  private service: EmailThreePhaseAnalysisService;

  constructor() {
    // Use a test instance
    this.service = new EmailThreePhaseAnalysisService(":memory:");
  }

  /**
   * Run all quality validation tests
   */
  async runAllTests(): Promise<void> {
    logger.info("Starting Quality Validation Framework Tests");

    const scenarios = this.createTestScenarios();
    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
      try {
        await this.runTestScenario(scenario);
        logger.info(`✅ PASSED: ${scenario.name}`);
        passed++;
      } catch (error) {
        logger.error(`❌ FAILED: ${scenario.name} - ${error}`);
        failed++;
      }
    }

    logger.info(`\n=== Test Results ===`);
    logger.info(`Passed: ${passed}`);
    logger.info(`Failed: ${failed}`);
    logger.info(`Total: ${scenarios.length}`);

    if (failed > 0) {
      throw new Error(`${failed} tests failed`);
    }

    logger.info("All quality validation tests passed! 🎉");
  }

  /**
   * Create comprehensive test scenarios
   */
  private createTestScenarios(): TestScenario[] {
    return [
      {
        name: "High Quality LLM Response",
        description: "LLM provides comprehensive, high-quality analysis",
        mockLLMResponse: {
          workflow_validation:
            "Confirmed ORDER_MANAGEMENT workflow with comprehensive validation of purchase order processing requirements and delivery timeline specifications",
          missed_entities: {
            project_names: ["Project Alpha"],
            company_names: ["Acme Corp"],
            people: ["John Smith"],
            products: ["Server Hardware"],
            technical_specs: ["64GB RAM", "2TB Storage"],
            locations: ["Dallas"],
            other_references: [],
          },
          action_items: [
            {
              task: "Process purchase order and confirm availability",
              owner: "Sales Team",
              deadline: "2025-01-15",
              revenue_impact: "$25,000",
            },
            {
              task: "Coordinate delivery logistics with warehouse",
              owner: "Operations",
              deadline: "2025-01-20",
            },
          ],
          risk_assessment:
            "Medium risk due to tight delivery timeline. Recommend expediting warehouse coordination to ensure on-time delivery and maintain customer satisfaction.",
          initial_response:
            "Thank you for your purchase order. We have received your request for server hardware and are processing it immediately. Our sales team will confirm availability within 24 hours.",
          confidence: 0.65,
          business_process: "ORDER_FULFILLMENT",
          extracted_requirements: [
            "64GB RAM requirement",
            "2TB storage specification",
            "Delivery to Dallas location",
          ],
        },
        mockPhase1Results: this.createMockPhase1Results(
          "ORDER_MANAGEMENT",
          "high",
          4,
        ),
        expectedQuality: {
          scoreRange: [8, 10],
          shouldUseFallback: false,
          shouldUseHybrid: false,
        },
      },

      {
        name: "Suspiciously Perfect LLM Response",
        description:
          "LLM provides response with unrealistically high confidence",
        mockLLMResponse: {
          workflow_validation: "Perfect analysis complete",
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
          risk_assessment: "No risk identified",
          initial_response: "Everything is perfect",
          confidence: 0.99, // Suspiciously high
          business_process: "PERFECT",
          extracted_requirements: [],
        },
        mockPhase1Results: this.createMockPhase1Results(
          "START_POINT",
          "medium",
          2,
        ),
        expectedQuality: {
          scoreRange: [0, 4],
          shouldUseFallback: true,
          shouldUseHybrid: false,
        },
      },

      {
        name: "Generic LLM Response",
        description: "LLM provides generic, low-value response",
        mockLLMResponse: {
          workflow_validation: "Standard processing", // Too short and generic
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
          risk_assessment: "Standard risk level", // Generic
          initial_response:
            "Thank you for your email. We are reviewing your request.", // Generic
          confidence: 0.5,
          business_process: "STANDARD_PROCESSING", // Generic
          extracted_requirements: [],
        },
        mockPhase1Results: this.createMockPhase1Results(
          "QUOTE_PROCESSING",
          "high",
          6,
        ),
        expectedQuality: {
          scoreRange: [2, 5],
          shouldUseFallback: false, // Should use hybrid
          shouldUseHybrid: true,
        },
      },

      {
        name: "Parsing Error LLM Response",
        description: "LLM response indicates parsing failure",
        mockLLMResponse: {
          workflow_validation:
            "JSON parsing failed - using rule-based analysis",
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
          risk_assessment:
            "Unable to assess due to parsing error - recommend manual review",
          initial_response:
            "Thank you for your email. We are reviewing your request and will respond shortly.",
          confidence: 0.3,
          business_process: "PARSING_ERROR",
          extracted_requirements: [],
        },
        mockPhase1Results: this.createMockPhase1Results(
          "IN_PROGRESS",
          "critical",
          8,
        ),
        expectedQuality: {
          scoreRange: [0, 3],
          shouldUseFallback: true,
          shouldUseHybrid: false,
        },
      },

      {
        name: "Moderate Quality with Hybrid Potential",
        description:
          "LLM provides some value but could be enhanced with hybrid approach",
        mockLLMResponse: {
          workflow_validation:
            "ORDER_MANAGEMENT workflow confirmed with standard processing requirements",
          missed_entities: {
            project_names: ["Important Project"],
            company_names: [],
            people: [],
            products: ["Hardware"],
            technical_specs: [],
            locations: [],
            other_references: [],
          },
          action_items: [
            {
              task: "Process order",
              owner: "Team",
              deadline: "Soon",
            },
          ],
          risk_assessment: "Some risk exists",
          initial_response: "We got your order and will process it",
          confidence: 0.45,
          business_process: "ORDER_PROCESSING",
          extracted_requirements: ["Hardware needed"],
        },
        mockPhase1Results: this.createMockPhase1Results(
          "ORDER_MANAGEMENT",
          "high",
          5,
        ),
        options: { qualityThreshold: 6.0 },
        expectedQuality: {
          scoreRange: [4, 6],
          shouldUseFallback: false,
          shouldUseHybrid: true,
        },
      },

      {
        name: "High Priority Email with Poor LLM Response",
        description:
          "Critical email gets poor LLM analysis - should use fallback",
        mockLLMResponse: {
          workflow_validation: "Standard", // Too short for critical email
          missed_entities: {
            project_names: [],
            company_names: [],
            people: [],
            products: [],
            technical_specs: [],
            locations: [],
            other_references: [],
          },
          action_items: [], // No action items for critical email is bad
          risk_assessment: "Standard risk level",
          initial_response: "Thanks",
          confidence: 0.95, // Suspiciously high
          business_process: "STANDARD_PROCESSING",
          extracted_requirements: [],
        },
        mockPhase1Results: this.createMockPhase1Results(
          "ESCALATION",
          "critical",
          9,
        ),
        expectedQuality: {
          scoreRange: [0, 4],
          shouldUseFallback: true,
          shouldUseHybrid: false,
        },
      },
    ];
  }

  /**
   * Create mock Phase 1 results for testing
   */
  private createMockPhase1Results(
    workflow: string,
    priority: string,
    urgencyScore: number,
  ): any {
    return {
      workflow_state: workflow,
      priority: priority,
      entities: {
        po_numbers:
          priority === "high" || priority === "critical" ? ["PO123456"] : [],
        quote_numbers: workflow.includes("QUOTE") ? ["Q789012"] : [],
        case_numbers: [],
        part_numbers: ["PART123", "PART456"],
        dollar_amounts:
          priority === "critical"
            ? ["$50000"]
            : priority === "high"
              ? ["$15000"]
              : [],
        dates: ["2025-01-15"],
        contacts: ["test@example.com"],
      },
      key_phrases: ["urgent", "deadline"],
      sender_category: "standard",
      urgency_score: urgencyScore,
      financial_impact:
        priority === "critical" ? 50000 : priority === "high" ? 15000 : 1000,
      processing_time: 500,
      detected_patterns:
        priority === "critical" ? ["high_urgency", "high_value"] : [],
    };
  }

  /**
   * Run individual test scenario
   */
  private async runTestScenario(scenario: TestScenario): Promise<void> {
    logger.info(`\n--- Testing: ${scenario.name} ---`);
    logger.debug(scenario.description);

    // Use reflection to access private method for testing
    const validateMethod = (this.service as any).validateResponseQuality.bind(
      this.service,
    );

    if (!validateMethod) {
      throw new Error("validateResponseQuality method not found");
    }

    // Create merged results as the method expects
    const mergedResults = {
      ...scenario.mockPhase1Results,
      ...scenario.mockLLMResponse,
      phase2_processing_time: 5000,
    };

    const qualityAssessment = validateMethod(
      mergedResults,
      scenario.mockPhase1Results,
      scenario.options || {},
    );

    logger.debug(`Quality Score: ${qualityAssessment.score}/10`);
    logger.debug(`Use Fallback: ${qualityAssessment.useFallback}`);
    logger.debug(`Use Hybrid: ${qualityAssessment.useHybrid}`);
    logger.debug(`Reasons: ${qualityAssessment.reasons.join(", ")}`);

    // Validate score range
    const [minScore, maxScore] = scenario.expectedQuality.scoreRange;
    if (
      qualityAssessment.score < minScore ||
      qualityAssessment.score > maxScore
    ) {
      throw new Error(
        `Score ${qualityAssessment.score} not in expected range [${minScore}, ${maxScore}]`,
      );
    }

    // Validate fallback decision
    if (
      qualityAssessment.useFallback !==
      scenario.expectedQuality.shouldUseFallback
    ) {
      throw new Error(
        `Expected useFallback: ${scenario.expectedQuality.shouldUseFallback}, got: ${qualityAssessment.useFallback}`,
      );
    }

    // Validate hybrid decision
    if (
      qualityAssessment.useHybrid !== scenario.expectedQuality.shouldUseHybrid
    ) {
      throw new Error(
        `Expected useHybrid: ${scenario.expectedQuality.shouldUseHybrid}, got: ${qualityAssessment.useHybrid}`,
      );
    }

    // Test hybrid response creation if applicable
    if (qualityAssessment.useHybrid) {
      const hybridMethod = (this.service as any).createHybridResponse.bind(
        this.service,
      );
      const hybridResponse = hybridMethod(
        mergedResults,
        scenario.mockPhase1Results,
        5000,
      );

      // Validate hybrid response has better quality than pure LLM
      if (
        !hybridResponse.workflow_validation ||
        hybridResponse.workflow_validation.length < 10
      ) {
        throw new Error(
          "Hybrid response should have better workflow validation",
        );
      }
    }

    logger.info(`Quality validation working correctly for: ${scenario.name}`);
  }

  /**
   * Test quality metrics tracking
   */
  async testQualityMetrics(): Promise<void> {
    logger.info("\n--- Testing Quality Metrics ---");

    // Get initial metrics
    const initialMetrics = this.service.getQualityMetrics();
    logger.debug("Initial metrics:", initialMetrics);

    // The metrics should be tracked through actual usage
    // This test validates the structure and calculation methods

    if (typeof initialMetrics.totalResponses !== "number") {
      throw new Error("Invalid totalResponses metric");
    }

    if (typeof initialMetrics.averageQualityScore !== "number") {
      throw new Error("Invalid averageQualityScore metric");
    }

    if (typeof initialMetrics.highQualityRate !== "number") {
      throw new Error("Invalid highQualityRate metric");
    }

    logger.info("Quality metrics structure validated ✅");
  }

  /**
   * Test configuration updates
   */
  async testConfigurationUpdates(): Promise<void> {
    logger.info("\n--- Testing Configuration Updates ---");

    // Test quality threshold update
    this.service.updateQualityConfig({
      minimumQualityThreshold: 7.0,
      enableHybridByDefault: false,
    });

    // Verify the update affects quality decisions
    const testScenario = this.createTestScenarios()[2]; // Generic response
    const validateMethod = (this.service as any).validateResponseQuality.bind(
      this.service,
    );

    const mergedResults = {
      ...testScenario.mockPhase1Results,
      ...testScenario.mockLLMResponse,
      phase2_processing_time: 5000,
    };

    const assessment = validateMethod(
      mergedResults,
      testScenario.mockPhase1Results,
      { qualityThreshold: 7.0, useHybridApproach: false },
    );

    // With higher threshold and hybrid disabled, should use fallback
    if (!assessment.useFallback) {
      throw new Error("Higher threshold should trigger fallback usage");
    }

    logger.info("Configuration updates working correctly ✅");
  }

  /**
   * Integration test with error scenarios
   */
  async testErrorHandling(): Promise<void> {
    logger.info("\n--- Testing Error Handling ---");

    const validateMethod = (this.service as any).validateResponseQuality.bind(
      this.service,
    );

    // Test with malformed data
    try {
      const result = validateMethod(
        null, // Invalid input
        this.createMockPhase1Results("START_POINT", "low", 1),
        {},
      );

      // Should handle gracefully and return low score
      if (result.score > 3) {
        throw new Error("Should handle null input with low quality score");
      }

      logger.info("Error handling validated ✅");
    } catch (error) {
      // Method should handle errors gracefully, not throw
      throw new Error(`Method should handle errors gracefully: ${error}`);
    }
  }

  /**
   * Cleanup after tests
   */
  async cleanup(): Promise<void> {
    await this.service.shutdown();
  }
}

// Export test runner for external usage
export async function runQualityValidationTests(): Promise<void> {
  const tester = new QualityValidationTester();

  try {
    await tester.runAllTests();
    await tester.testQualityMetrics();
    await tester.testConfigurationUpdates();
    await tester.testErrorHandling();

    logger.info("\n🎉 All Quality Validation Framework Tests Passed! 🎉");
  } finally {
    await tester.cleanup();
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQualityValidationTests().catch((error) => {
    logger.error("Quality validation tests failed:", error);
    process.exit(1);
  });
}
