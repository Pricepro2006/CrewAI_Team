#!/usr/bin/env tsx
/**
 * Test monitor display with correct property names
 */

import { PipelineOrchestrator } from "../core/pipeline/PipelineOrchestrator";
import { logger } from "../utils/logger";

async function testMonitorDisplay() {
  logger.info("Testing monitor display with correct property names...", "TEST");

  const orchestrator = new PipelineOrchestrator({
    stage2Limit: 5,
    stage3Limit: 2,
    mockMode: true,
  });

  // Start pipeline in background
  const pipelinePromise = orchestrator.runThreeStagePipeline();

  // Monitor progress
  let lastStage1 = 0;
  let lastStage2 = 0;
  let lastStage3 = 0;

  const monitorInterval = setInterval(async () => {
    const status = await orchestrator.getStatus();

    if (status.status === "running") {
      // Check both property names work
      const stage1New = status.stage1Progress || 0;
      const stage1Old = status.stage1_count || 0;
      const stage2New = status.stage2Progress || 0;
      const stage2Old = status.stage2_count || 0;
      const stage3New = status.stage3Progress || 0;
      const stage3Old = status.stage3_count || 0;

      // Verify both properties match
      if (stage1New !== stage1Old) {
        logger.error(
          `Property mismatch: stage1Progress=${stage1New}, stage1_count=${stage1Old}`,
          "TEST",
        );
      }

      // Show progress
      if (
        stage1New !== lastStage1 ||
        stage2New !== lastStage2 ||
        stage3New !== lastStage3
      ) {
        console.log("\n--- Monitor Display Test ---");
        console.log(
          `Stage 1: ${stage1New} emails (${((stage1New / 33799) * 100).toFixed(1)}%)`,
        );
        console.log(`Stage 2: ${stage2New} emails`);
        console.log(`Stage 3: ${stage3New} emails`);
        console.log(
          `Properties work: stage1Progress=${stage1New}, stage1_count=${stage1Old}`,
        );

        lastStage1 = stage1New;
        lastStage2 = stage2New;
        lastStage3 = stage3New;
      }
    }
  }, 1000);

  // Wait for pipeline to complete
  try {
    const results = await pipelinePromise;
    clearInterval(monitorInterval);

    logger.info("Pipeline completed!", "TEST", {
      stage1: results.stage1Count,
      stage2: results.stage2Count,
      stage3: results.stage3Count,
    });

    // Final status check
    const finalStatus = await orchestrator.getStatus();
    console.log("\nFinal status check:");
    console.log("- stage1Progress:", finalStatus.stage1Progress);
    console.log("- stage1_count:", finalStatus.stage1_count);
    console.log(
      "- Both match:",
      finalStatus.stage1Progress === finalStatus.stage1_count,
    );
  } catch (error) {
    clearInterval(monitorInterval);
    logger.error("Pipeline failed", "TEST", {}, error as Error);
    throw error;
  }
}

// Run test
testMonitorDisplay()
  .then(() => {
    logger.info("Monitor display test completed successfully", "TEST");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Monitor display test failed", "TEST", {}, error as Error);
    process.exit(1);
  });
