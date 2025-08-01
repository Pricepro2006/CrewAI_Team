#!/usr/bin/env tsx
/**
 * Analyze Quality of Phase 3 Email Analysis Results
 * Compare against Claude's 8.5/10 benchmark and 7.75/10 target
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface QualityMetrics {
  workflowAccuracy: number;
  entityExtraction: number;
  businessContext: number;
  actionableInsights: number;
  responseQuality: number;
  overall: number;
}

function analyzeQuality() {
  console.log("📊 Phase 3 Email Analysis Quality Assessment\n");
  console.log("Model: doomgrave/phi-4:14b-tools-Q3_K_S");
  console.log("Target Score: 7.75/10");
  console.log("Benchmark: Claude 8.5/10\n");

  const db = new Database("./data/crewai.db");

  // Get test email IDs
  const testEmailIds = fs
    .readFileSync("/tmp/test_email_ids.txt", "utf-8")
    .split("\n")
    .filter((id) => id.trim());

  // Query analysis results
  const analyses = db
    .prepare(
      `
    SELECT 
      email_id,
      quick_workflow,
      quick_priority,
      deep_workflow_primary,
      deep_workflow_secondary,
      deep_confidence,
      entities_po_numbers,
      entities_quote_numbers,
      entities_case_numbers,
      entities_part_numbers,
      entities_order_references,
      entities_contacts,
      action_summary,
      action_details,
      action_sla_status,
      workflow_state,
      business_impact_revenue,
      business_impact_satisfaction,
      business_impact_urgency_reason,
      contextual_summary,
      suggested_response,
      deep_processing_time
    FROM email_analysis
    WHERE email_id IN (${testEmailIds.map(() => "?").join(",")})
      AND deep_model LIKE '%phi-4%'
  `,
    )
    .all(...testEmailIds) as any[];

  console.log(`Found ${analyses.length} analyzed emails\n`);

  // Analyze each quality dimension
  const metrics: QualityMetrics = {
    workflowAccuracy: 0,
    entityExtraction: 0,
    businessContext: 0,
    actionableInsights: 0,
    responseQuality: 0,
    overall: 0,
  };

  // 1. Workflow Accuracy
  console.log("1️⃣ Workflow State Detection:");
  const workflowStates = analyses
    .map((a) => a.deep_workflow_primary)
    .filter(Boolean);
  const uniqueWorkflows = [...new Set(workflowStates)];
  console.log(
    `   - ${workflowStates.length}/${analyses.length} emails have workflow states`,
  );
  console.log(`   - ${uniqueWorkflows.length} unique workflows identified`);
  console.log(`   - Examples: ${uniqueWorkflows.slice(0, 3).join(", ")}`);

  // Check for proper workflow detection
  const hasStartPoint = workflowStates.some(
    (w) => w?.includes("START") || w?.includes("New"),
  );
  const hasInProgress = workflowStates.some(
    (w) => w?.includes("PROGRESS") || w?.includes("Processing"),
  );
  const hasCompletion = workflowStates.some(
    (w) => w?.includes("COMPLET") || w?.includes("Resolved"),
  );

  metrics.workflowAccuracy =
    (workflowStates.length / analyses.length) *
    (hasStartPoint ? 1.2 : 1) *
    (hasInProgress ? 1.2 : 1) *
    (hasCompletion ? 1.1 : 1) *
    8;

  console.log(`   ✅ Score: ${metrics.workflowAccuracy.toFixed(1)}/10\n`);

  // 2. Entity Extraction
  console.log("2️⃣ Entity Extraction:");
  let totalEntities = 0;
  let emailsWithEntities = 0;

  const entityTypes = [
    "entities_po_numbers",
    "entities_quote_numbers",
    "entities_case_numbers",
    "entities_part_numbers",
    "entities_order_references",
    "entities_contacts",
  ];

  analyses.forEach((analysis) => {
    let hasEntities = false;
    entityTypes.forEach((type) => {
      if (analysis[type]) {
        const count = analysis[type]
          .split(",")
          .filter((e: string) => e.trim()).length;
        if (count > 0) {
          totalEntities += count;
          hasEntities = true;
        }
      }
    });
    if (hasEntities) emailsWithEntities++;
  });

  console.log(`   - ${totalEntities} total entities extracted`);
  console.log(
    `   - ${emailsWithEntities}/${analyses.length} emails have entities`,
  );
  console.log(
    `   - Average: ${(totalEntities / analyses.length).toFixed(1)} entities per email`,
  );

  metrics.entityExtraction = Math.min(
    10,
    (emailsWithEntities / analyses.length) *
      10 *
      (totalEntities > analyses.length ? 1.2 : 1),
  );

  console.log(`   ✅ Score: ${metrics.entityExtraction.toFixed(1)}/10\n`);

  // 3. Business Context Understanding
  console.log("3️⃣ Business Context & Impact:");
  const hasRevenue = analyses.filter((a) => a.business_impact_revenue).length;
  const hasSatisfaction = analyses.filter(
    (a) => a.business_impact_satisfaction,
  ).length;
  const hasUrgency = analyses.filter(
    (a) => a.business_impact_urgency_reason,
  ).length;
  const hasSLA = analyses.filter((a) => a.action_sla_status).length;

  console.log(`   - Revenue impact: ${hasRevenue}/${analyses.length}`);
  console.log(
    `   - Customer satisfaction: ${hasSatisfaction}/${analyses.length}`,
  );
  console.log(`   - Urgency reasons: ${hasUrgency}/${analyses.length}`);
  console.log(`   - SLA status: ${hasSLA}/${analyses.length}`);

  metrics.businessContext =
    ((hasRevenue + hasSatisfaction + hasUrgency + hasSLA) /
      (analyses.length * 4)) *
    10;

  console.log(`   ✅ Score: ${metrics.businessContext.toFixed(1)}/10\n`);

  // 4. Actionable Insights
  console.log("4️⃣ Action Items & Insights:");
  const hasActionSummary = analyses.filter((a) => a.action_summary).length;
  const hasActionDetails = analyses.filter((a) => a.action_details).length;
  const avgConfidence =
    analyses.reduce((sum, a) => sum + (a.deep_confidence || 0), 0) /
    analyses.length;

  console.log(`   - Action summaries: ${hasActionSummary}/${analyses.length}`);
  console.log(`   - Detailed actions: ${hasActionDetails}/${analyses.length}`);
  console.log(`   - Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);

  metrics.actionableInsights =
    ((hasActionSummary + hasActionDetails) / (analyses.length * 2)) *
    avgConfidence *
    10;

  console.log(`   ✅ Score: ${metrics.actionableInsights.toFixed(1)}/10\n`);

  // 5. Response Quality
  console.log("5️⃣ Suggested Responses:");
  const hasResponse = analyses.filter(
    (a) => a.suggested_response && a.suggested_response.length > 20,
  ).length;
  const hasContext = analyses.filter(
    (a) => a.contextual_summary && a.contextual_summary.length > 50,
  ).length;

  console.log(`   - Suggested responses: ${hasResponse}/${analyses.length}`);
  console.log(`   - Contextual summaries: ${hasContext}/${analyses.length}`);

  // Sample a response for quality check
  const sampleResponse = analyses.find(
    (a) => a.suggested_response,
  )?.suggested_response;
  if (sampleResponse) {
    console.log(`   - Sample: "${sampleResponse.substring(0, 100)}..."`);
  }

  metrics.responseQuality =
    ((hasResponse + hasContext) / (analyses.length * 2)) * 10;

  console.log(`   ✅ Score: ${metrics.responseQuality.toFixed(1)}/10\n`);

  // Calculate overall score (weighted average)
  metrics.overall =
    metrics.workflowAccuracy * 0.2 +
    metrics.entityExtraction * 0.25 +
    metrics.businessContext * 0.2 +
    metrics.actionableInsights * 0.2 +
    metrics.responseQuality * 0.15;

  // Performance metrics
  console.log("⚡ Performance Metrics:");
  const avgProcessingTime =
    analyses.reduce((sum, a) => sum + (a.deep_processing_time || 0), 0) /
    analyses.length /
    1000;
  console.log(
    `   - Average processing time: ${avgProcessingTime.toFixed(1)}s per email`,
  );
  console.log(
    `   - Success rate: ${((analyses.length / testEmailIds.length) * 100).toFixed(1)}%`,
  );

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("QUALITY ASSESSMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(
    `Workflow Accuracy:    ${metrics.workflowAccuracy.toFixed(1)}/10 (20% weight)`,
  );
  console.log(
    `Entity Extraction:    ${metrics.entityExtraction.toFixed(1)}/10 (25% weight)`,
  );
  console.log(
    `Business Context:     ${metrics.businessContext.toFixed(1)}/10 (20% weight)`,
  );
  console.log(
    `Actionable Insights:  ${metrics.actionableInsights.toFixed(1)}/10 (20% weight)`,
  );
  console.log(
    `Response Quality:     ${metrics.responseQuality.toFixed(1)}/10 (15% weight)`,
  );
  console.log("─".repeat(60));
  console.log(`OVERALL SCORE:        ${metrics.overall.toFixed(1)}/10`);
  console.log(`Target Score:         7.75/10`);
  console.log(
    `Achievement:          ${((metrics.overall / 7.75) * 100).toFixed(1)}% of target`,
  );
  console.log("=".repeat(60));

  // Recommendations
  console.log("\n📋 Recommendations:");
  if (metrics.overall < 7.75) {
    console.log("❗ Score below target. Consider:");
    if (metrics.entityExtraction < 7) {
      console.log("   - Improve entity extraction patterns in prompts");
    }
    if (metrics.businessContext < 7) {
      console.log("   - Add more business impact analysis to prompts");
    }
    if (metrics.actionableInsights < 7) {
      console.log("   - Enhance action item generation");
    }
  } else {
    console.log("✅ Target score achieved!");
  }

  // Save detailed results
  const resultsPath = path.join(
    __dirname,
    "../test-results",
    `phase3_quality_analysis_${Date.now()}.json`,
  );
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        model: "doomgrave/phi-4:14b-tools-Q3_K_S",
        targetScore: 7.75,
        achievedScore: metrics.overall,
        timestamp: new Date().toISOString(),
        totalEmails: testEmailIds.length,
        analyzedEmails: analyses.length,
        metrics,
        performanceMetrics: {
          avgProcessingTime,
          successRate: analyses.length / testEmailIds.length,
        },
      },
      null,
      2,
    ),
  );

  console.log(`\nDetailed results saved to: ${resultsPath}`);

  db.close();
}

// Run analysis
analyzeQuality();
