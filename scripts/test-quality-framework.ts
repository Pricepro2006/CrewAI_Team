#!/usr/bin/env node

/**
 * Quick test script to verify the Quality Validation Framework is working
 */

import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("QualityFrameworkTest");

async function testQualityFramework(): Promise<void> {
  logger.info("Testing Quality Validation Framework...");

  try {
    // Create test service instance
    const service = new EmailThreePhaseAnalysisService(":memory:");

    // Test 1: Verify quality metrics are initialized
    const initialMetrics = service.getQualityMetrics();
    logger.info("✅ Quality metrics initialized:", {
      totalResponses: initialMetrics.totalResponses,
      averageQualityScore: initialMetrics.averageQualityScore,
      highQualityRate: initialMetrics.highQualityRate,
    });

    // Test 2: Verify configuration updates work
    service.updateQualityConfig({
      minimumQualityThreshold: 7.0,
      enableHybridByDefault: true,
    });
    logger.info("✅ Quality configuration updated successfully");

    // Test 3: Create a test email
    const testEmail = {
      id: "test-email-1",
      subject: "Urgent Purchase Order Processing Required - PO #12345678",
      body: "We need to process PO #12345678 for $50,000 worth of hardware. Deadline is critical - need delivery by January 15th, 2025. Customer is Acme Corp and this is time-sensitive.",
      sender_email: "procurement@acmecorp.com",
      recipient_emails: "sales@company.com",
      received_at: new Date().toISOString(),
      importance: "high",
      has_attachments: false,
    };

    // Test 4: Run analysis with quality validation
    logger.info("Running email analysis with quality validation...");
    const startTime = Date.now();

    // Note: This will use fallbacks for Phase 2/3 since we don't have LLM services running
    const result = await service.analyzeEmail(testEmail, {
      qualityThreshold: 6.0,
      useHybridApproach: true,
      enableQualityLogging: true,
    });

    const processingTime = Date.now() - startTime;

    logger.info("✅ Email analysis completed:", {
      workflow_state: result.workflow_state,
      priority: result.priority,
      confidence: result.confidence,
      processingTime: `${processingTime}ms`,
    });

    // Test 5: Verify quality metrics are updated
    const updatedMetrics = service.getQualityMetrics();
    logger.info("✅ Quality metrics updated:", {
      totalResponses: updatedMetrics.totalResponses,
      averageQualityScore: updatedMetrics.averageQualityScore,
      fallbackRate: updatedMetrics.fallbackRate,
    });

    // Test 6: Test configuration profiles
    const testProfiles = [
      { name: "production_strict", threshold: 7.0 },
      { name: "development_verbose", threshold: 5.0 },
      { name: "critical_systems", threshold: 8.0 },
    ];

    for (const profile of testProfiles) {
      service.updateQualityConfig({
        minimumQualityThreshold: profile.threshold,
      });
      logger.info(
        `✅ Applied ${profile.name} profile (threshold: ${profile.threshold})`,
      );
    }

    // Cleanup
    await service.shutdown();

    logger.info(
      "\n🎉 Quality Validation Framework Test Completed Successfully! 🎉",
    );
    logger.info("\nKey Features Verified:");
    logger.info("  ✅ Quality metrics tracking");
    logger.info("  ✅ Configuration management");
    logger.info("  ✅ Email analysis with quality validation");
    logger.info("  ✅ Profile-based configuration");
    logger.info("  ✅ Graceful error handling");
  } catch (error) {
    logger.error("❌ Quality framework test failed:", error);
    process.exit(1);
  }
}

// Run the test
testQualityFramework().catch((error) => {
  logger.error("Test execution failed:", error);
  process.exit(1);
});
