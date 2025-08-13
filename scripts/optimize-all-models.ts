#!/usr/bin/env ts-node
import { DatabaseManager } from "../src/database/DatabaseManager";
import { PromptOptimizer } from "../src/core/prompt-optimization/PromptOptimizer";
import { logger } from "../src/utils/logger";
import * as fs from "fs";
import * as path from "path";

// Test email IDs (same 20 emails used in all tests)
const TEST_EMAIL_IDS = [
  "email-8ef42296-42ba-4e7d-90be-0db338a66daf",
  "email-caa27fb2-eb96-4a20-b007-3891e38263af",
  "email-9bc600d9-a47a-4cef-8972-d05dea17b9ef",
  "email-9cc82b32-7e12-4012-b41a-83757a77f210",
  "email-ff0620c2-1900-4808-a12e-51db1a7ba6ea",
  "email-0b7ae5b6-5246-49c5-aed5-c06e56c9f3a9",
  "email-d534d622-7058-4422-9111-9f8c8fd249fc",
  "email-98dc5793-e04e-4597-8299-d2194105aff5",
  "email-b69eaf2d-1c09-4051-9cb5-b1a707b7b707",
  "email-41bdb30a-ee78-4c20-9afa-5448275be868",
  "email-62e24275-8dc5-4a5b-909f-ba3f9e9e7f5e",
  "email-b13a9b95-8e72-4b72-a11f-15b8701edd66",
  "email-cf02c0c3-50f6-4242-8e18-ed97b4f0a2c2",
  "email-bb27f75f-bc12-4b19-afed-8ce9a4b652b9",
  "email-f6f45a48-e3ba-460b-98c9-65a10e93c87c",
  "email-98f1f279-79ba-4e52-82e5-2cc3c19ba9e9",
  "email-5e088517-88db-43ba-b88d-79f2e5ad3ea1",
  "email-0dd89b76-0e15-42ce-8c2e-ab87ee1ab65a",
  "email-5dc0daa6-0b5d-4e3f-b8a7-89bc2f8ae7a9",
  "email-d9c5a92f-ddad-4c4f-8cd6-c90b9bbae42e",
];

// Model configurations
const MODEL_CONFIGS = [
  {
    name: "llama3.2:3b",
    currentScore: 6.56,
    targetScore: 7.5,
    initialPrompt: `Analyze this TD SYNNEX business email and extract key information.

Provide a JSON response with:
- workflow_state: Current state of the business process
- entities: Business entities found in the email
- priority: Urgency level
- action_items: Required actions
- suggested_response: How to respond

Be thorough but concise.`,
  },
  {
    name: "doomgrave/phi-4:14b-tools-Q3_K_S",
    currentScore: 3.0,
    targetScore: 8.0,
    initialPrompt: `Analyze this business email from TD SYNNEX.

Extract and provide:
1. Workflow state
2. All business entities
3. Priority level
4. Action items
5. Suggested response

Format as JSON.`,
  },
];

async function loadTestEmails(db: DatabaseManager) {
  const emails = [];
  for (const id of TEST_EMAIL_IDS) {
    const email = await db.emails.getById(id);
    if (email) {
      emails.push(email);
    } else {
      logger.warn(`Test email not found: ${id}`);
    }
  }
  return emails;
}

async function loadBaselineResults(): Promise<any[]> {
  // Load Claude's 8.5/10 baseline results
  const baselinePath = path.join(
    __dirname,
    "../data/claude-baseline-results.json",
  );

  if (fs.existsSync(baselinePath)) {
    return JSON.parse(fs.readFileSync(baselinePath, "utf-8"));
  }

  logger.warn("Baseline results not found, using mock data");
  // Return mock baseline for testing
  return TEST_EMAIL_IDS.map((id) => ({
    email_id: id,
    workflow_state: "IN_PROGRESS",
    entities: {
      po_numbers: ["12345678"],
      quote_numbers: [],
      case_numbers: [],
      part_numbers: [],
      companies: ["TD SYNNEX"],
      contacts: [],
    },
    priority: "HIGH",
    action_items: [
      {
        task: "Review and process",
        owner: "Operations",
        deadline: "24 hours",
      },
    ],
    suggested_response: "Acknowledged. We will process this request.",
    confidence: 0.85,
  }));
}

async function optimizeModel(
  modelConfig: (typeof MODEL_CONFIGS)[0],
  testEmails: any[],
  baselineResults: any[],
) {
  logger.info(`\n${"=".repeat(60)}`);
  logger.info(`Optimizing ${modelConfig.name}`);
  logger.info(`Current score: ${modelConfig.currentScore}/10`);
  logger.info(`Target score: ${modelConfig.targetScore}/10`);
  logger.info(`${"=".repeat(60)}`);

  const optimizer = new PromptOptimizer(
    testEmails,
    baselineResults,
    modelConfig.name,
  );

  const startTime = Date.now();

  try {
    const result = await optimizer.optimizePrompt(
      modelConfig.initialPrompt,
      modelConfig.targetScore,
      30, // Max 30 iterations
    );

    const duration = (Date.now() - startTime) / 1000;

    logger.info(`\nOptimization complete for ${modelConfig.name}`);
    logger.info(`Final score: ${result.score}/10`);
    logger.info(
      `Improvement: +${(result.score - modelConfig.currentScore).toFixed(2)} points`,
    );
    logger.info(`Iterations: ${result.iterations}`);
    logger.info(`Duration: ${duration.toFixed(1)}s`);

    // Save optimized prompt
    const outputPath = path.join(
      __dirname,
      `../prompts/optimized/${modelConfig.name.replace(/[/:]/g, "_")}_prompt.json`,
    );

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          model: modelConfig.name,
          originalScore: modelConfig.currentScore,
          optimizedScore: result.score,
          targetScore: modelConfig.targetScore,
          iterations: result.iterations,
          prompt: result.prompt,
          improvements: result.improvements,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    logger.info(`Optimized prompt saved to: ${outputPath}`);

    return result;
  } catch (error) {
    logger.error(`Failed to optimize ${modelConfig.name}: ${error}`);
    return null;
  }
}

async function main() {
  logger.info("Starting model prompt optimization");

  const db = getDatabaseManager();
  await db.initialize();

  try {
    // Load test data
    const testEmails = await loadTestEmails(db);
    const baselineResults = await loadBaselineResults();

    if (testEmails.length < TEST_EMAIL_IDS.length) {
      logger.warn(
        `Only found ${testEmails.length}/${TEST_EMAIL_IDS.length} test emails`,
      );
    }

    // Run optimization for each model
    const results = [];
    for (const modelConfig of MODEL_CONFIGS) {
      const result = await optimizeModel(
        modelConfig,
        testEmails,
        baselineResults,
      );
      if (result) {
        results.push({
          model: modelConfig.name,
          originalScore: modelConfig.currentScore,
          optimizedScore: result.score,
          improvement: result.score - modelConfig.currentScore,
        });
      }
    }

    // Generate summary report
    logger.info(`\n${"=".repeat(60)}`);
    logger.info("OPTIMIZATION SUMMARY");
    logger.info(`${"=".repeat(60)}`);

    for (const result of results) {
      const improvement =
        result.improvement > 0
          ? `+${result.improvement.toFixed(2)}`
          : result.improvement.toFixed(2);
      logger.info(`${result.model}:`);
      logger.info(`  Original: ${result.originalScore}/10`);
      logger.info(`  Optimized: ${result.optimizedScore}/10`);
      logger.info(`  Improvement: ${improvement} points`);
    }

    // Save summary
    const summaryPath = path.join(
      __dirname,
      "../prompts/optimization-summary.json",
    );
    fs.writeFileSync(
      summaryPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results,
          testEmailCount: testEmails.length,
          baselineScore: 8.5,
        },
        null,
        2,
      ),
    );

    logger.info(`\nSummary saved to: ${summaryPath}`);
  } catch (error) {
    logger.error("Optimization failed:", error);
  } finally {
    await db.close();
  }
}

// Run the optimization
if (require.main === module) {
  main().catch(console.error);
}
