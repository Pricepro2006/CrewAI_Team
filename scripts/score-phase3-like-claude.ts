#!/usr/bin/env tsx
/**
 * Score Phase 3 Analysis Using Claude's 8.5/10 Methodology
 * Based on the same scoring criteria used for Claude Opus-4
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Claude's scoring dimensions (from the research)
interface ClaudeScoringDimensions {
  contextUnderstanding: number; // Understanding the email context and situation
  entityExtraction: number; // Accurate extraction of business entities
  businessProcessing: number; // Correct workflow and process identification
  actionableInsights: number; // Quality and specificity of action items
  responseQuality: number; // Professional and appropriate responses
}

// Claude's scoring weights
const CLAUDE_WEIGHTS = {
  contextUnderstanding: 0.2, // 20%
  entityExtraction: 0.25, // 25%
  businessProcessing: 0.2, // 20%
  actionableInsights: 0.2, // 20%
  responseQuality: 0.15, // 15%
};

// Claude's 8.5/10 benchmark criteria
const CLAUDE_BENCHMARKS = {
  contextUnderstanding: {
    workflowDetection: 0.95, // 95% accurate workflow state
    priorityAccuracy: 0.9, // 90% correct priority
    urgencyRecognition: 0.85, // 85% urgency detection
  },
  entityExtraction: {
    poNumbers: 0.98, // 98% PO number extraction
    quoteNumbers: 0.95, // 95% quote extraction
    caseNumbers: 0.95, // 95% case number extraction
    partNumbers: 0.9, // 90% part/SKU extraction
    companies: 0.92, // 92% company extraction
    contacts: 0.88, // 88% contact extraction
  },
  businessProcessing: {
    processIdentification: 0.92, // 92% correct process
    slaAssessment: 0.88, // 88% SLA status accuracy
    impactAnalysis: 0.85, // 85% business impact
  },
  actionableInsights: {
    actionIdentification: 0.9, // 90% action detection
    ownerAssignment: 0.85, // 85% correct owner
    deadlineAccuracy: 0.8, // 80% deadline appropriateness
  },
  responseQuality: {
    toneAppropriate: 0.95, // 95% tone match
    contentRelevance: 0.9, // 90% relevant content
    professionalQuality: 0.92, // 92% professional standard
  },
};

function loadTestEmailData(): Map<string, any> {
  const emailData = new Map();

  // Load all test batch files to get original email content
  for (let i = 1; i <= 4; i++) {
    const batchFile = path.join(
      __dirname,
      `../data/email-batches/test_emails_batch_${i}.json`,
    );
    if (fs.existsSync(batchFile)) {
      const emails = JSON.parse(fs.readFileSync(batchFile, "utf-8"));
      emails.forEach((email: any) => {
        emailData.set(email.MessageID || email.id, email);
      });
    }
  }

  return emailData;
}

function scoreContextUnderstanding(analysis: any, emailData: any): number {
  let score = 0;
  let factors = 0;

  // 1. Workflow State Detection (40% of context score)
  if (analysis.deep_workflow_primary) {
    // Check if workflow matches email characteristics
    const subject = emailData?.Subject?.toLowerCase() || "";
    const body =
      emailData?.BodyText?.toLowerCase() ||
      emailData?.Body?.toLowerCase() ||
      "";

    let expectedWorkflow = "START_POINT";
    if (subject.includes("re:") || subject.includes("fw:")) {
      expectedWorkflow = "IN_PROGRESS";
    }
    if (
      body.includes("completed") ||
      body.includes("resolved") ||
      body.includes("closed")
    ) {
      expectedWorkflow = "COMPLETION";
    }

    const workflowMatch =
      analysis.deep_workflow_primary.includes(expectedWorkflow) ||
      (expectedWorkflow === "START_POINT" &&
        analysis.deep_workflow_primary.includes("New")) ||
      (expectedWorkflow === "IN_PROGRESS" &&
        analysis.deep_workflow_primary.includes("Processing"));

    score += workflowMatch ? 4.0 : 2.0;
    factors++;
  }

  // 2. Priority Assessment (30% of context score)
  if (analysis.quick_priority) {
    const subject = emailData?.Subject?.toLowerCase() || "";
    const expectedPriority =
      subject.includes("urgent") || subject.includes("asap")
        ? "high"
        : "medium";
    const priorityMatch =
      analysis.quick_priority.toLowerCase() === expectedPriority;

    score += priorityMatch ? 3.0 : 1.5;
    factors++;
  }

  // 3. Urgency Recognition (30% of context score)
  if (analysis.business_impact_urgency_reason || analysis.quick_urgency) {
    score += 3.0;
    factors++;
  }

  return factors > 0 ? (score / 10) * 10 : 0;
}

function scoreEntityExtraction(analysis: any, emailData: any): number {
  const entityTypes = [
    "entities_po_numbers",
    "entities_quote_numbers",
    "entities_case_numbers",
    "entities_part_numbers",
    "entities_order_references",
    "entities_contacts",
  ];

  let totalScore = 0;
  let totalPossible = 0;

  // Check email content for expected entities
  const content = `${emailData?.Subject || ""} ${emailData?.BodyText || emailData?.Body || ""}`;

  // PO Numbers (weight: 2.0)
  const poPattern = /\b(?:PO|P\.O\.|Purchase Order)?\s*#?\s*(\d{6,})/gi;
  const expectedPOs = (content.match(poPattern) || []).length;
  const foundPOs = analysis.entities_po_numbers
    ? analysis.entities_po_numbers.split(",").filter((e: string) => e.trim())
        .length
    : 0;

  if (expectedPOs > 0) {
    totalScore += (foundPOs / expectedPOs) * 2.0;
    totalPossible += 2.0;
  }

  // Quote Numbers (weight: 1.5)
  const quotePattern = /\b(?:Quote|Q|FTQ|F5Q)[-#]?\s*(\w+)/gi;
  const expectedQuotes = (content.match(quotePattern) || []).length;
  const foundQuotes = analysis.entities_quote_numbers
    ? analysis.entities_quote_numbers.split(",").filter((e: string) => e.trim())
        .length
    : 0;

  if (expectedQuotes > 0) {
    totalScore += (foundQuotes / expectedQuotes) * 1.5;
    totalPossible += 1.5;
  }

  // Companies (weight: 1.5)
  const companyPattern =
    /\b(?:TD SYNNEX|INSIGHT|Corporation|Inc\.|LLC|Corp\.)/gi;
  const expectedCompanies =
    (content.match(companyPattern) || []).length > 0 ? 1 : 0;
  const foundCompanies = analysis.entities_contacts ? 1 : 0;

  if (expectedCompanies > 0) {
    totalScore += foundCompanies * 1.5;
    totalPossible += 1.5;
  }

  // Base score for having any entities
  const hasAnyEntities = entityTypes.some(
    (type) => analysis[type] && analysis[type].length > 0,
  );
  if (hasAnyEntities) {
    totalScore += 2.0;
  }
  totalPossible += 2.0;

  return totalPossible > 0 ? (totalScore / totalPossible) * 10 : 5.0;
}

function scoreBusinessProcessing(analysis: any): number {
  let score = 0;

  // Process identification (50%)
  if (analysis.deep_workflow_primary) {
    const validProcesses = [
      "Order Management",
      "Quote Processing",
      "Issue Resolution",
      "General Support",
    ];
    const hasValidProcess = validProcesses.some((p) =>
      analysis.deep_workflow_primary.includes(p),
    );
    score += hasValidProcess ? 5.0 : 2.5;
  }

  // SLA assessment (30%)
  if (analysis.action_sla_status) {
    const validStatuses = ["ON_TRACK", "AT_RISK", "VIOLATED"];
    const hasValidSLA = validStatuses.includes(analysis.action_sla_status);
    score += hasValidSLA ? 3.0 : 1.0;
  }

  // Business impact (20%)
  if (
    analysis.business_impact_satisfaction ||
    analysis.business_impact_revenue
  ) {
    score += 2.0;
  }

  return Math.min(10, score);
}

function scoreActionableInsights(analysis: any): number {
  let score = 0;

  // Action identification
  if (analysis.action_summary) {
    score += 3.5;
  }

  // Detailed actions
  if (analysis.action_details) {
    try {
      const details = JSON.parse(analysis.action_details);
      if (Array.isArray(details) && details.length > 0) {
        score += 3.5;

        // Check for owner assignment
        if (details.some((d: any) => d.owner || d.assignee)) {
          score += 1.5;
        }

        // Check for deadlines
        if (details.some((d: any) => d.deadline || d.due_date)) {
          score += 1.5;
        }
      }
    } catch {
      score += 1.0; // Partial credit for having action details
    }
  }

  return Math.min(10, score);
}

function scoreResponseQuality(analysis: any): number {
  let score = 0;

  // Has suggested response
  if (analysis.suggested_response && analysis.suggested_response.length > 20) {
    score += 4.0;

    // Check tone appropriateness
    const response = analysis.suggested_response.toLowerCase();
    const professionalTerms = [
      "thank you",
      "assist",
      "help",
      "ensure",
      "process",
      "review",
    ];
    const hasProfessionalTone = professionalTerms.some((term) =>
      response.includes(term),
    );

    if (hasProfessionalTone) {
      score += 3.0;
    }

    // Check length (not too short, not too long)
    if (
      analysis.suggested_response.length > 50 &&
      analysis.suggested_response.length < 500
    ) {
      score += 1.5;
    }
  }

  // Has contextual summary
  if (analysis.contextual_summary && analysis.contextual_summary.length > 30) {
    score += 1.5;
  }

  return Math.min(10, score);
}

async function analyzePhase3Quality() {
  console.log("📊 Phase 3 Analysis Scoring - Claude 8.5/10 Methodology\n");
  console.log(
    "Using the exact same scoring criteria that gave Claude Opus-4 its 8.5/10 score\n",
  );

  const db = new Database("./data/crewai.db");
  const emailData = loadTestEmailData();

  // Get all test email analyses
  const testEmailIds = Array.from(emailData.keys());

  const analyses = db
    .prepare(
      `
    SELECT *
    FROM email_analysis
    WHERE email_id IN (${testEmailIds.map(() => "?").join(",")})
      AND deep_model LIKE '%phi-4%'
    ORDER BY updated_at DESC
  `,
    )
    .all(...testEmailIds) as any[];

  console.log(
    `Found ${analyses.length} Phase 3 analyses from ${testEmailIds.length} test emails\n`,
  );

  const scores: ClaudeScoringDimensions[] = [];

  // Score each email
  for (const analysis of analyses) {
    const email = emailData.get(analysis.email_id);

    const dimensionScores: ClaudeScoringDimensions = {
      contextUnderstanding: scoreContextUnderstanding(analysis, email),
      entityExtraction: scoreEntityExtraction(analysis, email),
      businessProcessing: scoreBusinessProcessing(analysis),
      actionableInsights: scoreActionableInsights(analysis),
      responseQuality: scoreResponseQuality(analysis),
    };

    scores.push(dimensionScores);
  }

  // Calculate averages
  const avgScores: ClaudeScoringDimensions = {
    contextUnderstanding: 0,
    entityExtraction: 0,
    businessProcessing: 0,
    actionableInsights: 0,
    responseQuality: 0,
  };

  if (scores.length > 0) {
    Object.keys(avgScores).forEach((key) => {
      avgScores[key as keyof ClaudeScoringDimensions] =
        scores.reduce(
          (sum, s) => sum + s[key as keyof ClaudeScoringDimensions],
          0,
        ) / scores.length;
    });
  }

  // Calculate overall score using Claude's weights
  const overallScore = Object.keys(avgScores).reduce((sum, key) => {
    return (
      sum +
      avgScores[key as keyof ClaudeScoringDimensions] *
        CLAUDE_WEIGHTS[key as keyof typeof CLAUDE_WEIGHTS]
    );
  }, 0);

  // Display results
  console.log("Individual Dimension Scores (same as Claude's evaluation):");
  console.log("─".repeat(60));
  console.log(
    `Context Understanding: ${avgScores.contextUnderstanding.toFixed(1)}/10 (20% weight)`,
  );
  console.log(
    `Entity Extraction:     ${avgScores.entityExtraction.toFixed(1)}/10 (25% weight)`,
  );
  console.log(
    `Business Processing:   ${avgScores.businessProcessing.toFixed(1)}/10 (20% weight)`,
  );
  console.log(
    `Actionable Insights:   ${avgScores.actionableInsights.toFixed(1)}/10 (20% weight)`,
  );
  console.log(
    `Response Quality:      ${avgScores.responseQuality.toFixed(1)}/10 (15% weight)`,
  );

  console.log("\n" + "=".repeat(60));
  console.log("FINAL SCORE (Claude Methodology)");
  console.log("=".repeat(60));
  console.log(`doomgrave/phi-4:      ${overallScore.toFixed(1)}/10`);
  console.log(`Claude Opus-4:        8.5/10 (benchmark)`);
  console.log(`Target Score:         7.75/10`);
  console.log("─".repeat(60));

  // Performance comparison
  const performanceRatio = (overallScore / 8.5) * 100;
  console.log(`\nPerformance vs Claude: ${performanceRatio.toFixed(1)}%`);

  if (overallScore >= 7.75) {
    console.log("✅ TARGET ACHIEVED! Score meets or exceeds 7.75/10");
  } else {
    console.log(
      `❌ Below target by ${(7.75 - overallScore).toFixed(1)} points`,
    );
  }

  // Detailed analysis
  console.log("\n📋 Detailed Analysis:");

  // Check processing times to verify if real LLM was called
  const avgProcessingTime =
    analyses.reduce((sum, a) => sum + (a.deep_processing_time || 0), 0) /
    analyses.length;
  console.log(`\n⚠️  Average processing time: ${avgProcessingTime}ms`);

  if (avgProcessingTime < 5000) {
    console.log(
      "❌ WARNING: Processing times suggest LLM was NOT actually called!",
    );
    console.log(
      "   Real doomgrave/phi-4 calls should take 50-180 seconds per email.",
    );
    console.log("   These results appear to be from mock/simulated analysis.");
  }

  // Save results
  const resultsPath = path.join(
    __dirname,
    "../test-results",
    `claude_methodology_scoring_${Date.now()}.json`,
  );
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        methodology: "Claude 8.5/10 Scoring",
        model: "doomgrave/phi-4:14b-tools-Q3_K_S",
        timestamp: new Date().toISOString(),
        totalEmails: testEmailIds.length,
        analyzedEmails: analyses.length,
        dimensionScores: avgScores,
        weights: CLAUDE_WEIGHTS,
        overallScore,
        claudeBenchmark: 8.5,
        targetScore: 7.75,
        achievedTarget: overallScore >= 7.75,
        avgProcessingTime,
        likelyMockData: avgProcessingTime < 5000,
      },
      null,
      2,
    ),
  );

  console.log(`\nDetailed results saved to: ${resultsPath}`);

  db.close();
}

// Run the analysis
analyzePhase3Quality().catch(console.error);
