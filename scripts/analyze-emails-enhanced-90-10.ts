#!/usr/bin/env tsx
/**
 * Enhanced Email Analysis with Smart 90/10 Split
 * Optimizations for better insights without significant time increase
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced prompts for better actionable insights
const ENHANCED_LLAMA_PROMPT = `You are a TD SYNNEX email analyzer. Analyze the email and respond ONLY with valid JSON.

FOCUS ON ACTIONABLE INSIGHTS:
1. Workflow state: START_POINT, IN_PROGRESS, or COMPLETION
2. Priority: CRITICAL (revenue risk >$10k), HIGH (customer escalation), MEDIUM, LOW
3. Extract ALL business entities (PO, quotes, case numbers, dollar amounts)
4. Identify SPECIFIC action items with owners and deadlines
5. Flag any compliance or risk issues
6. Spot revenue opportunities (upsell, renewal, expansion)

Response format (JSON ONLY):
{
  "workflow_state": "START_POINT|IN_PROGRESS|COMPLETION",
  "priority": "CRITICAL|HIGH|MEDIUM|LOW",
  "confidence": 0.0-1.0,
  "entities": {
    "po_numbers": ["PO12345"],
    "quote_numbers": ["Q-12345"],
    "case_numbers": ["CASE123"],
    "part_numbers": ["ABC123"],
    "companies": ["Company Name"],
    "contacts": ["John Doe - Title"],
    "dollar_amounts": ["$10,000"]
  },
  "business_process": "Order Management|Quote Processing|Support|etc",
  "action_items": [
    {"task": "Specific action", "owner": "Role/Person", "deadline": "Date", "revenue_impact": "$amount"}
  ],
  "urgency_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "urgency_indicators": ["urgent", "asap", "at risk"],
  "risks": {
    "customer_satisfaction": "HIGH|MEDIUM|LOW",
    "revenue_at_risk": "$amount",
    "compliance_issues": ["list any"]
  },
  "opportunities": {
    "upsell_potential": "$amount",
    "expansion_opportunity": "description"
  },
  "sla_status": "ON_TRACK|AT_RISK|VIOLATED",
  "contextual_summary": "Brief actionable summary",
  "suggested_response": "Professional response with next steps"
}

Email to analyze:`;

// Load phi-4 prompt
const PHI4_PROMPT = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../prompts/optimized/doomgrave_phi-4_14b-tools-Q3_K_S_prompt.json",
    ),
    "utf-8",
  ),
).prompt;

// Enhanced selection criteria for phi-4 (still ~10% but smarter selection)
function shouldUsePhi4(email: any, index: number): boolean {
  const subject = (email.subject || "").toLowerCase();
  const body = (email.body || email.body_preview || "").toLowerCase();
  const content = subject + " " + body;

  // High-value indicators that warrant phi-4 analysis
  const highValueIndicators = [
    // Financial indicators
    /\$\s*\d{4,}/, // Dollar amounts >= $1000
    /\b\d{6,}\s*(usd|dollars?)\b/i,

    // Urgency indicators
    /\b(urgent|critical|escalat|asap|immediate|emergency)\b/i,

    // Risk indicators
    /\b(cancel|terminat|dissatisf|unhappy|complain|risk|threat)\b/i,

    // Opportunity indicators
    /\b(renew|expand|upgrade|additional|interested|opportunity)\b/i,

    // Key business terms
    /\b(contract|agreement|sla|compliance|audit)\b/i,
  ];

  // Use phi-4 for:
  // 1. High importance emails
  if (email.importance === "high" || email.importance === "critical")
    return true;

  // 2. Emails with high-value indicators
  if (highValueIndicators.some((pattern) => pattern.test(content))) return true;

  // 3. Key senders (top support/order addresses)
  const keySenders = [
    "insightordersupport@tdsynnex.com",
    "team4401@tdsynnex.com",
    "insighthpi@tdsynnex.com",
    "insight3@tdsynnex.com",
  ];
  if (keySenders.includes(email.sender_email?.toLowerCase())) return true;

  // 4. Every 10th email for quality sampling
  if (index % 10 === 0) return true;

  return false;
}

// Smart batching - process high-value emails first
function prioritizeEmails(emails: any[]): any[] {
  return emails.sort((a, b) => {
    // Priority 1: High importance
    if (a.importance === "high" && b.importance !== "high") return -1;
    if (b.importance === "high" && a.importance !== "high") return 1;

    // Priority 2: Key senders
    const keySenders = ["insightordersupport", "team4401", "insighthpi"];
    const aIsKey = keySenders.some((s) => a.sender_email?.includes(s));
    const bIsKey = keySenders.some((s) => b.sender_email?.includes(s));
    if (aIsKey && !bIsKey) return -1;
    if (bIsKey && !aIsKey) return 1;

    // Priority 3: Recent emails first
    return (
      new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
    );
  });
}

async function callLLM(model: string, prompt: string): Promise<any> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      "http://localhost:11434/api/generate",
      {
        model,
        prompt,
        stream: false,
        options: {
          temperature: model.includes("llama") ? 0.1 : 0.3,
          num_predict: model.includes("llama") ? 1000 : 2000,
          timeout: model.includes("llama") ? 60000 : 180000,
        },
      },
      {
        timeout: model.includes("llama") ? 60000 : 180000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      },
    );

    const elapsed = (Date.now() - startTime) / 1000;

    let responseText = response.data.response || "";

    // Parse JSON response
    if (responseText.includes("```json")) {
      responseText = responseText.split("```json")[1].split("```")[0];
    } else if (responseText.includes("{")) {
      const start = responseText.indexOf("{");
      const end = responseText.lastIndexOf("}") + 1;
      if (end > start) {
        responseText = responseText.substring(start, end);
      }
    }

    // Clean response
    responseText = responseText
      .replace(/```/g, "")
      .replace(/\*\*/g, "")
      .replace(/\\n/g, " ")
      .replace(/\n(?=(?:[^"]*"[^"]*")*[^"]*$)/g, " ");

    return {
      result: JSON.parse(responseText),
      processingTime: elapsed * 1000,
    };
  } catch (error: any) {
    const elapsed = (Date.now() - startTime) / 1000;
    console.error(
      `❌ LLM error after ${elapsed.toFixed(1)}s: ${error.message}`,
    );

    return {
      result: {
        workflow_state: "START_POINT",
        priority: "MEDIUM",
        confidence: 0.5,
        entities: {},
        error: error.message,
      },
      processingTime: elapsed * 1000,
    };
  }
}

async function analyzeBatch(batchNumber: number, startIndex: number = 0) {
  const batchFile = path.join(
    __dirname,
    `../data/email-batches/may-july-2025/batch_${batchNumber}.json`,
  );

  if (!fs.existsSync(batchFile)) {
    console.log(`❌ Batch ${batchNumber} not found`);
    return;
  }

  let emails = JSON.parse(fs.readFileSync(batchFile, "utf-8"));

  // Smart prioritization within batch
  emails = prioritizeEmails(emails);

  console.log(
    `\n📦 Processing Batch ${batchNumber}: ${emails.length} emails (prioritized)`,
  );
  console.log(`   Starting from index ${startIndex}`);

  const db = new Database("./data/crewai.db");
  let successCount = 0;
  let failureCount = 0;
  let phi4Count = 0;
  let llamaCount = 0;
  let totalRevenue = 0;
  let criticalCount = 0;

  // Process emails with dynamic model selection
  for (let i = startIndex; i < emails.length; i++) {
    const email = emails[i];
    const usePhi4 = shouldUsePhi4(email, i);
    const model = usePhi4 ? "doomgrave/phi-4:14b-tools-Q3_K_S" : "llama3.2:3b";

    if (usePhi4) phi4Count++;
    else llamaCount++;

    try {
      // Build prompt
      const emailContent = `\n\nSubject: ${email.subject}\n\nBody: ${email.body || email.body_preview || "No body content"}`;
      const prompt = usePhi4
        ? PHI4_PROMPT.replace(
            "Email to analyze:",
            `Email to analyze:${emailContent}`,
          )
        : ENHANCED_LLAMA_PROMPT + emailContent;

      console.log(
        `\n   [${i + 1}/${emails.length}] ${usePhi4 ? "🔷 phi-4" : "🦙 llama"} analyzing...`,
      );

      // Call LLM
      const { result: analysis, processingTime } = await callLLM(model, prompt);

      // Track insights
      if (analysis.priority === "CRITICAL") criticalCount++;
      if (analysis.risks?.revenue_at_risk) {
        const amount = parseFloat(
          analysis.risks.revenue_at_risk.replace(/[\$,]/g, ""),
        );
        if (!isNaN(amount)) totalRevenue += amount;
      }

      // Save enhanced analysis to database
      const analysisId = `enhanced_${batchNumber}_${i}_${Date.now()}`;
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO email_analysis (
          id, email_id, 
          quick_workflow, quick_priority, quick_intent, quick_urgency,
          quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
          deep_workflow_primary, deep_workflow_secondary, deep_confidence,
          entities_po_numbers, entities_quote_numbers, entities_case_numbers,
          entities_part_numbers, entities_order_references, entities_contacts,
          action_summary, action_details, action_sla_status,
          business_impact_revenue, business_impact_satisfaction, business_impact_urgency_reason,
          contextual_summary, suggested_response,
          deep_model, deep_processing_time,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      stmt.run(
        analysisId,
        email.id,
        // Quick analysis
        analysis.workflow_state || "START_POINT",
        analysis.priority || "MEDIUM",
        "REQUEST",
        analysis.urgency_level || "MEDIUM",
        analysis.confidence || 0.75,
        "NEW",
        "enhanced-90-10",
        50,
        // Deep analysis
        analysis.workflow_state ||
          analysis.business_process ||
          "Order Management",
        null,
        analysis.confidence || 0.75,
        // Entities (enhanced with dollar amounts)
        analysis.entities?.po_numbers?.join(",") || null,
        analysis.entities?.quote_numbers?.join(",") || null,
        analysis.entities?.case_numbers?.join(",") || null,
        analysis.entities?.part_numbers?.join(",") || null,
        analysis.entities?.dollar_amounts?.join(",") || null,
        analysis.entities?.contacts?.join(",") || null,
        // Actions (enhanced with revenue impact)
        analysis.action_items
          ?.map((a: any) => `${a.task} (${a.revenue_impact || "N/A"})`)
          .join("; ") || null,
        JSON.stringify(analysis.action_items || []),
        analysis.sla_status || "ON_TRACK",
        // Business impact (enhanced)
        analysis.risks?.revenue_at_risk ||
          analysis.opportunities?.upsell_potential ||
          null,
        analysis.risks?.customer_satisfaction || "Medium",
        analysis.urgency_indicators?.join(", ") || null,
        // Summary and response
        analysis.contextual_summary || null,
        analysis.suggested_response || null,
        // Metadata
        model,
        processingTime,
        now,
        now,
      );

      successCount++;
      console.log(`      ✅ Success (${(processingTime / 1000).toFixed(1)}s)`);
      if (analysis.priority === "CRITICAL") {
        console.log(`      🚨 CRITICAL: ${analysis.contextual_summary}`);
      }
    } catch (error) {
      failureCount++;
      console.error(`      ❌ Failed: ${error}`);
    }

    // Save progress every 10 emails
    if (i % 10 === 0) {
      const progress = {
        batch: batchNumber,
        lastProcessedIndex: i,
        successCount,
        failureCount,
        phi4Count,
        llamaCount,
        criticalCount,
        revenueAtRisk: totalRevenue,
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(
        path.join(
          __dirname,
          `../data/email-batches/may-july-2025/enhanced_progress_batch_${batchNumber}.json`,
        ),
        JSON.stringify(progress, null, 2),
      );
    }
  }

  db.close();

  console.log(`\n✅ Batch ${batchNumber} complete:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failureCount}`);
  console.log(`   Models: ${llamaCount} llama, ${phi4Count} phi-4`);
  console.log(`   Critical issues: ${criticalCount}`);
  console.log(`   Revenue at risk: $${totalRevenue.toLocaleString()}`);

  return {
    successCount,
    failureCount,
    phi4Count,
    llamaCount,
    criticalCount,
    totalRevenue,
  };
}

// Update UI with real-time insights
async function updateDashboard(batchResults: any) {
  const db = new Database("./data/crewai.db");

  // Get aggregated insights
  const insights = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total_analyzed,
      SUM(CASE WHEN quick_priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN quick_priority = 'HIGH' THEN 1 ELSE 0 END) as high_count,
      SUM(CASE WHEN action_sla_status = 'VIOLATED' THEN 1 ELSE 0 END) as sla_violations,
      SUM(CAST(business_impact_revenue AS REAL)) as total_revenue_impact
    FROM email_analysis
    WHERE deep_model IN ('llama3.2:3b', 'doomgrave/phi-4:14b-tools-Q3_K_S')
      AND created_at > datetime('now', '-1 day')
  `,
    )
    .get() as any;

  console.log("\n📊 Dashboard Update:");
  console.log(`   Total analyzed: ${insights.total_analyzed}`);
  console.log(`   Critical issues: ${insights.critical_count}`);
  console.log(`   High priority: ${insights.high_count}`);
  console.log(`   SLA violations: ${insights.sla_violations}`);
  console.log(
    `   Revenue impact: $${(insights.total_revenue_impact || 0).toLocaleString()}`,
  );

  db.close();

  // This would trigger real UI update via WebSocket or API
  // For now, save to file for UI to poll
  fs.writeFileSync(
    path.join(__dirname, "../data/dashboard-insights.json"),
    JSON.stringify(
      {
        ...insights,
        lastUpdated: new Date().toISOString(),
        batchResults,
      },
      null,
      2,
    ),
  );
}

async function analyzeAllBatches() {
  console.log("🚀 Enhanced Email Analysis with Smart 90/10 Split");
  console.log("📊 Optimized for actionable insights\n");

  const summaryPath = path.join(
    __dirname,
    "../data/email-batches/may-july-2025/pull_summary.json",
  );
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));

  console.log(`📧 Total emails: ${summary.total_emails}`);
  console.log(`📦 Total batches: ${summary.batches}`);
  console.log(`🎯 Focus: High-value actionable insights\n`);

  const startTime = Date.now();
  let totalResults = {
    success: 0,
    failure: 0,
    phi4: 0,
    llama: 0,
    critical: 0,
    revenue: 0,
  };

  // Process first 5 batches as demonstration
  const batchesToProcess = 5;
  console.log(`🔬 Processing first ${batchesToProcess} batches...\n`);

  for (let batch = 1; batch <= batchesToProcess; batch++) {
    const result = await analyzeBatch(batch);
    if (result) {
      totalResults.success += result.successCount;
      totalResults.failure += result.failureCount;
      totalResults.phi4 += result.phi4Count;
      totalResults.llama += result.llamaCount;
      totalResults.critical += result.criticalCount;
      totalResults.revenue += result.totalRevenue;

      // Update dashboard after each batch
      await updateDashboard(totalResults);
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log("\n" + "=".repeat(60));
  console.log("ENHANCED ANALYSIS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Batches processed: ${batchesToProcess}`);
  console.log(
    `Emails analyzed: ${totalResults.success + totalResults.failure}`,
  );
  console.log(
    `Model split: ${totalResults.llama} llama (${((totalResults.llama / (totalResults.llama + totalResults.phi4)) * 100).toFixed(1)}%), ${totalResults.phi4} phi-4 (${((totalResults.phi4 / (totalResults.llama + totalResults.phi4)) * 100).toFixed(1)}%)`,
  );
  console.log(`Critical issues found: ${totalResults.critical}`);
  console.log(
    `Total revenue at risk: $${totalResults.revenue.toLocaleString()}`,
  );
  console.log(`Processing time: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(
    `Average per email: ${(totalTime / totalResults.success).toFixed(1)}s`,
  );
}

// Run analysis
analyzeAllBatches().catch(console.error);
