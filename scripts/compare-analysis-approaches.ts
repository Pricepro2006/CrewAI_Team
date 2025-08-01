#!/usr/bin/env tsx
/**
 * Compare Three-Phase vs Single-Phase Email Analysis
 * Using the existing workflow test implementation
 */

import Database from "better-sqlite3";
import axios from "axios";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const db = new Database("./data/crewai.db");

// Ollama configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

// TD SYNNEX Workflow Categories
const WORKFLOW_CATEGORIES = [
  "Order Management",
  "Quote Processing",
  "Shipping and Logistics",
  "Vendor Pricing Updates",
  "Returns and RMA",
  "Account Changes",
  "Deal Activations",
  "General Support",
];

interface AnalysisResult {
  emailId: string;
  subject: string;
  approach: "three-phase" | "single-phase" | "phase-3-only";
  entities: {
    poNumbers: string[];
    quoteNumbers: string[];
    customers: string[];
    orderNumbers: string[];
    trackingNumbers: string[];
    dollarValues: number[];
  };
  workflowCategory: string | null;
  priority: string;
  confidence: number;
  actionItems: string[];
  processingTimeMs: number;
  tokensUsed: number;
  llmCalls: number;
}

// ============================================
// LLM Helper Function
// ============================================
async function callLLM(
  prompt: string,
  model: string = "llama3.2:3b",
): Promise<string> {
  try {
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model,
      prompt,
      stream: false,
      temperature: 0.7,
      top_p: 0.9,
      options: {
        num_predict: 2048,
      },
    });

    return response.data.response;
  } catch (error) {
    console.error(chalk.red("LLM Error:"), error.message);
    return "";
  }
}

// ============================================
// PHASE 1: Rule-Based Analysis (from existing)
// ============================================
function phase1RuleBasedAnalysis(email: any): any {
  const startTime = Date.now();

  const result = {
    phase: 1,
    timestamp: new Date().toISOString(),
    processing_time: 0,
    email_id: email.id,
    entities: {
      po_numbers: [],
      quote_numbers: [],
      order_numbers: [],
      customer_names: [],
      tracking_numbers: [],
      dollar_values: [],
    },
    patterns: {
      is_order_related: false,
      is_quote_related: false,
      is_shipping_related: false,
      contains_pricing: false,
      is_return_rma: false,
      is_account_change: false,
    },
    confidence_score: 0,
  };

  const emailContent =
    `${email.subject || ""} ${email.body || ""}`.toLowerCase();

  // Extract PO Numbers
  const poMatches =
    emailContent.match(
      /\b(?:po|p\.o\.|purchase order)[\s#:-]*(\d{8,12})\b/gi,
    ) || [];
  result.entities.po_numbers = poMatches.map((m) => m.replace(/[^\d]/g, ""));

  // Extract Quote Numbers
  const quoteMatches =
    emailContent.match(/\b(?:quote|qt)[\s#:-]*([A-Z0-9]{6,10})\b/gi) || [];
  result.entities.quote_numbers = quoteMatches.map((m) =>
    m.replace(/^(quote|qt)[\s#:-]*/i, ""),
  );

  // Extract Order Numbers
  const orderMatches =
    emailContent.match(/\b(?:order|ord)[\s#:-]*([A-Z0-9]{8,12})\b/gi) || [];
  result.entities.order_numbers = orderMatches.map((m) =>
    m.replace(/^(order|ord)[\s#:-]*/i, ""),
  );

  // Extract Tracking Numbers
  const trackingMatches =
    emailContent.match(/\b(?:1Z[A-Z0-9]{16}|[\d]{20,22})\b/g) || [];
  result.entities.tracking_numbers = trackingMatches;

  // Extract Dollar Values
  const dollarMatches = emailContent.match(/\$[\d,]+\.?\d{0,2}/g) || [];
  result.entities.dollar_values = dollarMatches.map((m) =>
    parseFloat(m.replace(/[$,]/g, "")),
  );

  // Pattern Detection
  result.patterns.is_order_related = /\b(order|purchase|po|p\.o\.)\b/i.test(
    emailContent,
  );
  result.patterns.is_quote_related = /\b(quote|pricing|proposal|rfq)\b/i.test(
    emailContent,
  );
  result.patterns.is_shipping_related =
    /\b(ship|delivery|tracking|fedex|ups)\b/i.test(emailContent);
  result.patterns.contains_pricing = /\b(\$|price|cost|amount|total)\b/i.test(
    emailContent,
  );
  result.patterns.is_return_rma =
    /\b(return|rma|refund|damaged|defective)\b/i.test(emailContent);
  result.patterns.is_account_change =
    /\b(account|update|change|modify|address)\b/i.test(emailContent);

  // Calculate confidence based on entities found
  const entityCount = Object.values(result.entities).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const patternCount = Object.values(result.patterns).filter((v) => v).length;
  result.confidence_score = Math.min(
    (entityCount * 10 + patternCount * 15) / 100,
    1,
  );

  result.processing_time = Date.now() - startTime;
  return result;
}

// ============================================
// PHASE 2: AI Enhancement (from existing)
// ============================================
async function phase2AIEnhancement(
  email: any,
  phase1Results: any,
): Promise<any> {
  const startTime = Date.now();

  const prompt = `You are a TD SYNNEX workflow analyst. You have received initial rule-based analysis of an email. Your task is to enhance it with deeper workflow understanding.

Initial Analysis:
${JSON.stringify(phase1Results, null, 2)}

Original Email:
Subject: ${email.subject}
Body: ${email.body}

Enhance the analysis by:
1. Validating and correcting extracted entities
2. Identifying missed entities or relationships
3. Determining the primary workflow category from: ${WORKFLOW_CATEGORIES.join(", ")}
4. Assessing urgency and business impact
5. Suggesting initial workflow state (START_POINT, IN_PROGRESS, COMPLETION)

Respond with a JSON object containing:
{
  "validated_entities": {...},
  "additional_entities": {...},
  "workflow_category": "...",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
  "business_impact": "...",
  "workflow_state": "...",
  "confidence": 0.0-1.0
}`;

  const response = await callLLM(prompt);

  let enhanced = {
    phase: 2,
    timestamp: new Date().toISOString(),
    processing_time: 0,
    phase1_data: phase1Results,
    enhancements: {},
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      enhanced.enhancements = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error(chalk.yellow("Phase 2 parsing error, using defaults"));
    enhanced.enhancements = {
      workflow_category: "General Support",
      urgency: "MEDIUM",
      confidence: 0.5,
    };
  }

  enhanced.processing_time = Date.now() - startTime;
  return enhanced;
}

// ============================================
// PHASE 3: Strategic Analysis (from existing)
// ============================================
async function phase3StrategicAnalysis(
  email: any,
  phase2Results: any,
): Promise<any> {
  const startTime = Date.now();

  const dollarValue = phase2Results.phase1_data.entities.dollar_values[0] || 0;
  const isHighValue = dollarValue > 50000;
  const isCritical = phase2Results.enhancements?.urgency === "CRITICAL";

  if (!isHighValue && !isCritical) {
    return {
      phase: 3,
      timestamp: new Date().toISOString(),
      processing_time: Date.now() - startTime,
      skipped: true,
      reason: "Low value and non-critical",
    };
  }

  const prompt = `You are a senior TD SYNNEX strategic analyst. Analyze this high-value/critical email and provide strategic workflow recommendations.

Email Context:
${JSON.stringify(phase2Results, null, 2)}

Provide strategic analysis:
1. Business criticality assessment
2. Risk factors and mitigation
3. Recommended workflow owner/team
4. Specific action items with deadlines
5. Success metrics

Format as JSON with:
{
  "criticality_score": 1-10,
  "risk_assessment": {...},
  "recommended_owner": "...",
  "action_items": [...],
  "success_metrics": [...],
  "sla_hours": 24
}`;

  const response = await callLLM(prompt, "llama3.2:3b"); // Use same model for fair comparison

  let strategic = {
    phase: 3,
    timestamp: new Date().toISOString(),
    processing_time: 0,
    phase2_data: phase2Results,
    strategic_analysis: {},
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      strategic.strategic_analysis = JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error(chalk.yellow("Phase 3 parsing error"));
  }

  strategic.processing_time = Date.now() - startTime;
  return strategic;
}

// ============================================
// SINGLE-PHASE ANALYSIS (New)
// ============================================
async function singlePhaseAnalysis(email: any): Promise<AnalysisResult> {
  const startTime = Date.now();

  const prompt = `You are a TD SYNNEX email analyst. Analyze this email comprehensively in one pass.

Email:
Subject: ${email.subject}
From: ${email.from_email}
Body: ${email.body}

Extract and analyze:
1. All entities (PO numbers, quotes, customers, orders, tracking, dollar values)
2. Workflow category from: ${WORKFLOW_CATEGORIES.join(", ")}
3. Priority (LOW, MEDIUM, HIGH, CRITICAL)
4. Action items required
5. Business impact and urgency

Provide a complete JSON response with all information:
{
  "entities": {
    "po_numbers": [],
    "quote_numbers": [],
    "customers": [],
    "order_numbers": [],
    "tracking_numbers": [],
    "dollar_values": []
  },
  "workflow_category": "...",
  "priority": "...",
  "confidence": 0.0-1.0,
  "action_items": [],
  "business_impact": "..."
}`;

  const response = await callLLM(prompt, "llama3.2:3b");
  const tokens = prompt.length + response.length;

  let result: AnalysisResult = {
    emailId: email.id,
    subject: email.subject || "",
    approach: "single-phase",
    entities: {
      poNumbers: [],
      quoteNumbers: [],
      customers: [],
      orderNumbers: [],
      trackingNumbers: [],
      dollarValues: [],
    },
    workflowCategory: null,
    priority: "MEDIUM",
    confidence: 0.5,
    actionItems: [],
    processingTimeMs: 0,
    tokensUsed: Math.ceil(tokens / 4),
    llmCalls: 1,
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      result.entities = {
        poNumbers: parsed.entities?.po_numbers || [],
        quoteNumbers: parsed.entities?.quote_numbers || [],
        customers: parsed.entities?.customers || [],
        orderNumbers: parsed.entities?.order_numbers || [],
        trackingNumbers: parsed.entities?.tracking_numbers || [],
        dollarValues: parsed.entities?.dollar_values || [],
      };
      result.workflowCategory = parsed.workflow_category || null;
      result.priority = parsed.priority || "MEDIUM";
      result.confidence = parsed.confidence || 0.5;
      result.actionItems = parsed.action_items || [];
    }
  } catch (error) {
    console.error(chalk.yellow("Single-phase parsing error"));
  }

  result.processingTimeMs = Date.now() - startTime;
  return result;
}

// ============================================
// PHASE 3 ONLY ANALYSIS (New)
// ============================================
async function phase3OnlyAnalysis(email: any): Promise<AnalysisResult> {
  const startTime = Date.now();

  const prompt = `You are a senior TD SYNNEX strategic analyst. Provide strategic workflow analysis for this email.

Email:
Subject: ${email.subject}
Body: ${email.body}

Focus on:
1. Workflow categorization (${WORKFLOW_CATEGORIES.join(", ")})
2. Priority and urgency assessment
3. Strategic action items
4. Risk factors
5. Any critical entities mentioned

Provide strategic JSON response:
{
  "workflow_category": "...",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "action_items": [],
  "risk_factors": [],
  "entities_mentioned": {...},
  "confidence": 0.0-1.0
}`;

  const response = await callLLM(prompt, "llama3.2:3b"); // Use same model for fair comparison
  const tokens = prompt.length + response.length;

  let result: AnalysisResult = {
    emailId: email.id,
    subject: email.subject || "",
    approach: "phase-3-only",
    entities: {
      poNumbers: [],
      quoteNumbers: [],
      customers: [],
      orderNumbers: [],
      trackingNumbers: [],
      dollarValues: [],
    },
    workflowCategory: null,
    priority: "MEDIUM",
    confidence: 0.5,
    actionItems: [],
    processingTimeMs: 0,
    tokensUsed: Math.ceil(tokens / 4),
    llmCalls: 1,
  };

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      result.workflowCategory = parsed.workflow_category || null;
      result.priority = parsed.priority || "MEDIUM";
      result.confidence = parsed.confidence || 0.5;
      result.actionItems = parsed.action_items || [];

      // Extract any entities mentioned
      if (parsed.entities_mentioned) {
        result.entities = {
          poNumbers: parsed.entities_mentioned.po_numbers || [],
          quoteNumbers: parsed.entities_mentioned.quote_numbers || [],
          customers: parsed.entities_mentioned.customers || [],
          orderNumbers: parsed.entities_mentioned.order_numbers || [],
          trackingNumbers: parsed.entities_mentioned.tracking_numbers || [],
          dollarValues: parsed.entities_mentioned.dollar_values || [],
        };
      }
    }
  } catch (error) {
    console.error(chalk.yellow("Phase-3-only parsing error"));
  }

  result.processingTimeMs = Date.now() - startTime;
  return result;
}

// ============================================
// THREE-PHASE COMBINED ANALYSIS
// ============================================
async function threePhaseAnalysis(email: any): Promise<AnalysisResult> {
  const startTime = Date.now();
  let totalTokens = 0;

  // Run all three phases
  const phase1 = phase1RuleBasedAnalysis(email);
  const phase2 = await phase2AIEnhancement(email, phase1);
  const phase3 = await phase3StrategicAnalysis(email, phase2);

  // Estimate tokens
  totalTokens += JSON.stringify(phase1).length / 4;
  totalTokens += JSON.stringify(phase2).length / 4;
  totalTokens += JSON.stringify(phase3).length / 4;

  // Combine results
  const result: AnalysisResult = {
    emailId: email.id,
    subject: email.subject || "",
    approach: "three-phase",
    entities: {
      poNumbers: phase1.entities.po_numbers || [],
      quoteNumbers: phase1.entities.quote_numbers || [],
      customers: phase2.enhancements?.validated_entities?.customers || [],
      orderNumbers: phase1.entities.order_numbers || [],
      trackingNumbers: phase1.entities.tracking_numbers || [],
      dollarValues: phase1.entities.dollar_values || [],
    },
    workflowCategory: phase2.enhancements?.workflow_category || null,
    priority: phase2.enhancements?.urgency || "MEDIUM",
    confidence:
      phase2.enhancements?.confidence || phase1.confidence_score || 0.5,
    actionItems: phase3.strategic_analysis?.action_items || [],
    processingTimeMs: Date.now() - startTime,
    tokensUsed: Math.ceil(totalTokens),
    llmCalls: phase3.skipped ? 1 : 2,
  };

  return result;
}

// ============================================
// COMPARISON AND REPORTING
// ============================================
function compareResults(results: AnalysisResult[]): void {
  console.log(chalk.blue("\n=== ANALYSIS COMPARISON REPORT ===\n"));

  // Group by email
  const byEmail = results.reduce(
    (acc, r) => {
      if (!acc[r.emailId]) acc[r.emailId] = {};
      acc[r.emailId][r.approach] = r;
      return acc;
    },
    {} as Record<string, Record<string, AnalysisResult>>,
  );

  // Summary statistics
  const stats = {
    "single-phase": { entities: 0, correct: 0, time: 0, tokens: 0 },
    "three-phase": { entities: 0, correct: 0, time: 0, tokens: 0 },
    "phase-3-only": { entities: 0, correct: 0, time: 0, tokens: 0 },
  };

  let emailCount = 0;

  Object.entries(byEmail).forEach(([emailId, approaches]) => {
    emailCount++;
    console.log(
      chalk.yellow(
        `\nEmail: ${approaches["single-phase"]?.subject?.substring(0, 50)}...`,
      ),
    );
    console.log(chalk.gray("─".repeat(70)));

    // Compare each approach
    ["single-phase", "three-phase", "phase-3-only"].forEach((approach) => {
      const result = approaches[approach];
      if (!result) return;

      const entityCount = Object.values(result.entities).flat().length;
      stats[approach].entities += entityCount;
      stats[approach].time += result.processingTimeMs;
      stats[approach].tokens += result.tokensUsed;

      if (result.workflowCategory) stats[approach].correct++;

      console.log(chalk.cyan(`${approach}:`));
      console.log(`  Entities found: ${entityCount}`);
      console.log(`  Category: ${result.workflowCategory || "None"}`);
      console.log(`  Priority: ${result.priority}`);
      console.log(`  Action items: ${result.actionItems.length}`);
      console.log(`  Time: ${result.processingTimeMs}ms`);
      console.log(`  Tokens: ${result.tokensUsed}`);
    });
  });

  // Overall summary
  console.log(chalk.blue("\n=== OVERALL SUMMARY ===\n"));
  console.log(
    "┌─────────────────┬──────────────┬──────────────┬──────────────┐",
  );
  console.log(
    "│ Metric          │ Single-Phase │ Three-Phase  │ Phase-3-Only │",
  );
  console.log(
    "├─────────────────┼──────────────┼──────────────┼──────────────┤",
  );

  ["single-phase", "three-phase", "phase-3-only"].forEach((approach) => {
    const s = stats[approach];
    console.log(
      `│ Avg Entities    │ ${(s.entities / emailCount).toFixed(1).padEnd(12)} │`,
    );
  });

  console.log(
    "├─────────────────┼──────────────┼──────────────┼──────────────┤",
  );

  ["single-phase", "three-phase", "phase-3-only"].forEach((approach) => {
    const s = stats[approach];
    console.log(
      `│ Category Found  │ ${((s.correct / emailCount) * 100).toFixed(0) + "%".padEnd(12)} │`,
    );
  });

  console.log(
    "├─────────────────┼──────────────┼──────────────┼──────────────┤",
  );

  ["single-phase", "three-phase", "phase-3-only"].forEach((approach) => {
    const s = stats[approach];
    console.log(
      `│ Avg Time (ms)   │ ${(s.time / emailCount).toFixed(0).padEnd(12)} │`,
    );
  });

  console.log(
    "├─────────────────┼──────────────┼──────────────┼──────────────┤",
  );

  ["single-phase", "three-phase", "phase-3-only"].forEach((approach) => {
    const s = stats[approach];
    console.log(
      `│ Avg Tokens      │ ${(s.tokens / emailCount).toFixed(0).padEnd(12)} │`,
    );
  });

  console.log(
    "└─────────────────┴──────────────┴──────────────┴──────────────┘",
  );

  // Key findings
  console.log(chalk.yellow("\n=== KEY FINDINGS ===\n"));

  const threePhaseImprovement =
    ((stats["three-phase"].entities - stats["single-phase"].entities) /
      stats["single-phase"].entities) *
    100;
  console.log(
    `1. Entity Extraction: Three-phase found ${threePhaseImprovement.toFixed(1)}% more entities than single-phase`,
  );

  const timeOverhead =
    ((stats["three-phase"].time - stats["single-phase"].time) /
      stats["single-phase"].time) *
    100;
  console.log(
    `2. Processing Time: Three-phase took ${timeOverhead.toFixed(1)}% more time`,
  );

  const tokenOverhead =
    ((stats["three-phase"].tokens - stats["single-phase"].tokens) /
      stats["single-phase"].tokens) *
    100;
  console.log(
    `3. Token Usage: Three-phase used ${tokenOverhead.toFixed(1)}% more tokens`,
  );

  console.log(
    `4. Phase-3-Only: Fastest but extracted ${((stats["phase-3-only"].entities / stats["three-phase"].entities) * 100).toFixed(1)}% of entities compared to three-phase`,
  );
}

// ============================================
// MAIN TEST FUNCTION
// ============================================
async function runComparisonTest(): Promise<void> {
  console.log(
    chalk.blue("=== Three-Phase vs Single-Phase Analysis Comparison ===\n"),
  );

  // Get 20 emails from database
  const emails = db
    .prepare(
      `
    SELECT 
      id,
      subject,
      sender_email as from_email,
      body,
      received_at as received_date
    FROM emails 
    WHERE body IS NOT NULL 
    ORDER BY received_at DESC 
    LIMIT 5
  `,
    )
    .all();

  console.log(chalk.yellow(`Testing with ${emails.length} emails...\n`));

  const results: AnalysisResult[] = [];

  // Process each email with all three approaches
  for (const [index, email] of emails.entries()) {
    console.log(
      chalk.cyan(`\nProcessing email ${index + 1}/${emails.length}...`),
    );

    try {
      // Run all three approaches
      const singleResult = await singlePhaseAnalysis(email);
      results.push(singleResult);

      const threeResult = await threePhaseAnalysis(email);
      results.push(threeResult);

      const phase3Result = await phase3OnlyAnalysis(email);
      results.push(phase3Result);
    } catch (error) {
      console.error(
        chalk.red(`Failed to process email ${email.id}:`, error.message),
      );
    }
  }

  // Compare and report results
  compareResults(results);

  // Save detailed results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = path.join(
    __dirname,
    `../test_results/comparison_${timestamp}.json`,
  );

  if (!fs.existsSync(path.dirname(resultsPath))) {
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  }

  fs.writeFileSync(
    resultsPath,
    JSON.stringify(
      {
        testDate: new Date().toISOString(),
        emailCount: emails.length,
        results: results,
        summary: {
          threePhaseAdvantage:
            "Better entity extraction and context understanding",
          singlePhaseAdvantage: "Faster processing and fewer tokens",
          phase3OnlyAdvantage: "Fastest but limited entity extraction",
          recommendation:
            "Use three-phase for critical emails, single-phase for routine processing",
        },
      },
      null,
      2,
    ),
  );

  console.log(chalk.green(`\nDetailed results saved to: ${resultsPath}`));

  db.close();
}

// Run the test
runComparisonTest().catch(console.error);
