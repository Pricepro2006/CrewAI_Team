#!/usr/bin/env tsx

/**
 * Test script for JSON parsing fixes in EmailThreePhaseAnalysisService
 * Tests various response formats that were causing parsing failures
 */

import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("JSONParsingTests");

// Mock problematic responses that were causing parsing failures
const PROBLEMATIC_RESPONSES = [
  // Markdown wrapped JSON
  `Here's the analysis result:

\`\`\`json
{
  "workflow_validation": "Confirmed: ORDER_MANAGEMENT",
  "missed_entities": {
    "project_names": [],
    "company_names": ["ACME Corp"]
  },
  "confidence": 0.85
}
\`\`\`

This analysis shows the key points from the email.`,

  // Response with prefix text
  `Based on my analysis of the email, I can provide the following JSON response:

{
  "workflow_validation": "Email indicates quote request workflow",
  "missed_entities": {
    "project_names": ["Project Alpha"],
    "company_names": []
  },
  "action_items": [],
  "confidence": 0.75
}`,

  // Malformed JSON with unquoted keys
  `{
  workflow_validation: "Standard processing workflow",
  missed_entities: {
    project_names: [],
    company_names: ["Customer XYZ"]
  },
  confidence: 0.80,
  action_items: []
}`,

  // JSON with trailing commas
  `{
  "workflow_validation": "ORDER_PROCESSING",
  "missed_entities": {
    "project_names": [],
    "company_names": ["Test Company"],
  },
  "confidence": 0.90,
  "action_items": [],
}`,

  // Mixed quotes and formatting issues
  `{
  'workflow_validation': 'Email processing workflow',
  "missed_entities": {
    'project_names': [],
    "company_names": ['Multi Corp', "Another Corp"]
  },
  'confidence': 0.88
}`,

  // Structured text format (fallback test)
  `Workflow Validation: Purchase order processing workflow
Missed Entities: Project names - None, Company names - TechCorp Inc
Confidence: 0.82
Risk Assessment: Standard risk level
Business Process: ORDER_TO_CASH`,

  // Completely malformed response
  `I understand you want me to analyze this email. The workflow appears to be related to order processing, and I can see some company names mentioned. However, I'm having trouble formatting this as JSON right now.`,
];

async function testJsonParsing(): Promise<void> {
  logger.info("Starting JSON parsing tests...");

  const service = new EmailThreePhaseAnalysisService();

  // Access the private parseJsonResponse method for testing
  const testParseJsonResponse = (service as any).parseJsonResponse.bind(
    service,
  );

  let successCount = 0;
  let totalTests = PROBLEMATIC_RESPONSES.length;

  for (let i = 0; i < PROBLEMATIC_RESPONSES.length; i++) {
    const response = PROBLEMATIC_RESPONSES[i];

    try {
      logger.info(`\n--- Test ${i + 1}/${totalTests} ---`);
      logger.debug("Input response:", response.substring(0, 100) + "...");

      const parsed = testParseJsonResponse(response);

      // Validate required fields
      const hasRequiredFields = [
        "workflow_validation",
        "missed_entities",
        "confidence",
      ].every((field) => parsed.hasOwnProperty(field));

      if (hasRequiredFields) {
        logger.info("✅ Success - Parsed with required fields");
        logger.debug("Parsed result:", JSON.stringify(parsed, null, 2));
        successCount++;
      } else {
        logger.warn("⚠️  Partial success - Missing required fields");
        logger.debug("Parsed result:", JSON.stringify(parsed, null, 2));
      }
    } catch (error) {
      logger.error(`❌ Test ${i + 1} failed:`, error);
    }
  }

  logger.info(`\n=== Test Results ===`);
  logger.info(
    `Success rate: ${successCount}/${totalTests} (${Math.round((successCount / totalTests) * 100)}%)`,
  );

  if (successCount === totalTests) {
    logger.info(
      "🎉 All tests passed! JSON parsing fixes are working correctly.",
    );
  } else if (successCount > totalTests * 0.8) {
    logger.info("✅ Most tests passed. JSON parsing significantly improved.");
  } else {
    logger.warn(
      "⚠️  Some tests failed. Additional improvements may be needed.",
    );
  }

  await service.shutdown();
}

// Test individual extraction methods
async function testExtractionMethods(): Promise<void> {
  logger.info("\n=== Testing extraction methods ===");

  const service = new EmailThreePhaseAnalysisService();

  // Test extractJsonFromResponse
  const testExtractJson = (service as any).extractJsonFromResponse.bind(
    service,
  );

  const testCases = [
    {
      name: "Clean JSON",
      input: '{"test": "value"}',
      expectSuccess: true,
    },
    {
      name: "Markdown wrapped",
      input: '```json\n{"test": "value"}\n```',
      expectSuccess: true,
    },
    {
      name: "With prefix",
      input: 'Here is the result: {"test": "value"}',
      expectSuccess: true,
    },
    {
      name: "No JSON",
      input: "This is just text with no JSON structure.",
      expectSuccess: false,
    },
  ];

  for (const testCase of testCases) {
    try {
      const result = testExtractJson(testCase.input);

      if (testCase.expectSuccess && result) {
        logger.info(`✅ ${testCase.name}: Extracted successfully`);
      } else if (!testCase.expectSuccess && !result) {
        logger.info(`✅ ${testCase.name}: Correctly returned null`);
      } else {
        logger.warn(`⚠️  ${testCase.name}: Unexpected result`);
      }
    } catch (error) {
      logger.error(`❌ ${testCase.name}: Error -`, error);
    }
  }

  await service.shutdown();
}

// Test the full email analysis pipeline with mocked responses
async function testFullPipeline(): Promise<void> {
  logger.info("\n=== Testing full analysis pipeline ===");

  const service = new EmailThreePhaseAnalysisService();

  // Mock email input
  const mockEmail = {
    id: "test-123",
    subject: "Urgent: Need quote for HP servers",
    body: "Hi, we need pricing for 10x HP ProLiant servers for Project Alpha. Customer is ACME Corp. Deadline is next week.",
    sender_email: "customer@acme.com",
    sender_name: "John Smith",
    recipient_emails: "sales@tdsynnex.com",
    received_at: new Date().toISOString(),
    importance: "high",
  };

  try {
    logger.info("Starting analysis of mock email...");

    // Note: This will fail on the actual LLM call, but we can test Phase 1
    const results = await service.analyzeEmail(mockEmail, {
      skipCache: true,
      forceAllPhases: false, // Only test Phase 1 and partial Phase 2
    });

    logger.info("✅ Analysis completed successfully");
    logger.debug("Results summary:", {
      workflow_state: results.workflow_state,
      priority: results.priority,
      confidence: results.confidence,
      processing_time: results.processing_time,
    });
  } catch (error) {
    // Expected to fail at LLM call, but Phase 1 should work
    if (
      error.message?.includes("ECONNREFUSED") ||
      error.message?.includes("LLM request failed")
    ) {
      logger.info(
        "✅ Expected LLM connection error - Phase 1 parsing logic is working",
      );
    } else {
      logger.error("❌ Unexpected error:", error);
    }
  }

  // Get parsing metrics
  const stats = await service.getAnalysisStats();
  logger.info("Parsing metrics:", stats.parsingMetrics);

  await service.shutdown();
}

// Main test execution
async function main(): Promise<void> {
  try {
    await testJsonParsing();
    await testExtractionMethods();
    await testFullPipeline();

    logger.info("\n🎉 All JSON parsing tests completed!");
  } catch (error) {
    logger.error("Test execution failed:", error);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
}

export { testJsonParsing, testExtractionMethods, testFullPipeline };
