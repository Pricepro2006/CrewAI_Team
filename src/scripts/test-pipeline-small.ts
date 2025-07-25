#!/usr/bin/env tsx
/**
 * Test pipeline with small limits to verify all stages save
 */

import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";

async function testSmallPipeline() {
  logger.info("Running small pipeline test...", "TEST");

  const orchestrator = new PipelineOrchestrator({
    stage2Limit: 5, // Only process 5 emails in Stage 2
    stage3Limit: 2, // Only process 2 emails in Stage 3
    mockMode: true, // Use mock mode for faster testing
  });

  try {
    const startTime = Date.now();
    const results = await orchestrator.runThreeStagePipeline();
    const elapsed = (Date.now() - startTime) / 1000;

    logger.info("Pipeline completed!", "TEST", {
      totalEmails: results.totalEmails,
      stage1: results.stage1Count,
      stage2: results.stage2Count,
      stage3: results.stage3Count,
      timeSeconds: elapsed,
    });

    // Verify each stage worked
    if (results.stage1Count === 0) {
      throw new Error("Stage 1 failed to process any emails");
    }
    if (results.stage2Count === 0) {
      throw new Error("Stage 2 failed to process any emails");
    }
    if (results.stage3Count === 0) {
      throw new Error("Stage 3 failed to process any emails");
    }

    logger.info("✅ All stages completed successfully!", "TEST");
  } catch (error) {
    logger.error("Pipeline test failed", "TEST", {}, error as Error);
    throw error;
  }
}

// Run test
testSmallPipeline()
  .then(() => {
    logger.info("Test completed successfully", "TEST");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Test failed", "TEST", {}, error as Error);
    process.exit(1);
  });
