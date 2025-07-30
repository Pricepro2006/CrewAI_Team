import { EmailAnalysisPipeline } from "../src/core/processors/EmailAnalysisPipeline.js";
import { logger } from "../src/utils/logger.js";

async function testPipeline() {
  logger.info("Testing Email Pipeline", "TEST");

  const pipeline = new EmailAnalysisPipeline();

  // Test email
  const testEmail = {
    id: "test-123",
    from: "test@example.com",
    to: ["support@company.com"],
    subject: "Urgent: Order #12345 not delivered",
    body: "I ordered product ABC last week but it has not arrived yet. Please help!",
    receivedDateTime: new Date().toISOString(),
    hasAttachments: false,
    importance: "high",
  };

  try {
    const result = await pipeline.process(testEmail);

    logger.info("Pipeline Result", "TEST", {
      workflow: result.workflow,
      priority: result.priority,
      entities: result.entities,
      analysis: result.analysis,
    });

    console.log("\n✅ Email Pipeline is working!\n");
    console.log("Results:");
    console.log(
      `- Workflow: ${result.workflow.type} (${result.workflow.state})`,
    );
    console.log(`- Priority: ${result.priority}`);
    console.log(`- Sentiment: ${result.analysis.sentiment}`);
    console.log(`- Intent: ${result.analysis.intent}`);
    console.log(`- Order Numbers: ${result.entities.orderNumbers.join(", ")}`);
  } catch (error) {
    logger.error("Pipeline test failed", "TEST", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

testPipeline();
