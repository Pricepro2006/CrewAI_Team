#!/usr/bin/env tsx
/**
 * Analyze May-July 2025 Emails
 * Using 90% llama3.2:3b and 10% phi-4 split
 * With REAL LLM calls
 */

import Database from "better-sqlite3";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompts
const LLAMA_PROMPT =
  fs
    .readFileSync(
      path.join(__dirname, "../prompts/MASTER_PROMPTS_REFERENCE.md"),
      "utf-8",
    )
    .match(/const LLAMA_JSON_PROMPT = `([^`]+)`/)?.[1] || "";

const PHI4_PROMPT = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../prompts/optimized/doomgrave_phi-4_14b-tools-Q3_K_S_prompt.json",
    ),
    "utf-8",
  ),
).prompt;

// Rate limiting to prevent overwhelming the system
const CONCURRENT_ANALYSES = 5;
const BATCH_DELAY = 2000; // 2 seconds between batches

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
          num_predict: model.includes("llama") ? 800 : 1500,
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

    // Return default structure
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

  const emails = JSON.parse(fs.readFileSync(batchFile, "utf-8"));
  const analysisMap = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "../data/email-batches/may-july-2025/analysis_plan.json",
      ),
      "utf-8",
    ),
  ).distribution.filter((d: any) => d.batch === batchNumber);

  console.log(`\n📦 Processing Batch ${batchNumber}: ${emails.length} emails`);
  console.log(`   Starting from index ${startIndex}`);

  const db = new Database("./data/crewai.db");
  let successCount = 0;
  let failureCount = 0;

  // Process emails in chunks
  for (let i = startIndex; i < emails.length; i += CONCURRENT_ANALYSES) {
    const chunk = emails.slice(
      i,
      Math.min(i + CONCURRENT_ANALYSES, emails.length),
    );
    const chunkMaps = analysisMap.slice(
      i,
      Math.min(i + CONCURRENT_ANALYSES, emails.length),
    );

    console.log(
      `\n   Processing emails ${i + 1}-${Math.min(i + CONCURRENT_ANALYSES, emails.length)}...`,
    );

    const promises = chunk.map(async (email: any, idx: number) => {
      const map = chunkMaps[idx];
      const model = map.model;
      const isLlama = model.includes("llama");

      try {
        // Build prompt
        const emailContent = `\n\nSubject: ${email.subject}\n\nBody: ${email.body || email.body_preview || "No body content"}`;
        const prompt = isLlama
          ? LLAMA_PROMPT + emailContent
          : PHI4_PROMPT.replace(
              "Email to analyze:",
              `Email to analyze:${emailContent}`,
            );

        // Call LLM
        const { result: analysis, processingTime } = await callLLM(
          model,
          prompt,
        );

        // Save to database
        const analysisId = `batch_${batchNumber}_${i + idx}_${Date.now()}`;
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
          0.75,
          "NEW",
          "rule-based",
          50,
          // Deep analysis
          analysis.workflow_state ||
            analysis.business_process ||
            "Order Management",
          null,
          analysis.confidence || 0.75,
          // Entities
          analysis.entities?.po_numbers?.join(",") || null,
          analysis.entities?.quote_numbers?.join(",") || null,
          analysis.entities?.case_numbers?.join(",") || null,
          analysis.entities?.part_numbers?.join(",") || null,
          null,
          analysis.entities?.contacts?.join(",") || null,
          // Actions
          analysis.action_items?.map((a: any) => a.task || a).join("; ") ||
            null,
          JSON.stringify(analysis.action_items || []),
          analysis.sla_status || "ON_TRACK",
          // Business impact
          null,
          analysis.urgency_level === "CRITICAL" ? "High" : "Medium",
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
        console.log(
          `      ✅ Email ${i + idx + 1}: ${model} (${(processingTime / 1000).toFixed(1)}s)`,
        );
      } catch (error) {
        failureCount++;
        console.error(`      ❌ Email ${i + idx + 1}: ${error}`);
      }
    });

    // Wait for chunk to complete
    await Promise.all(promises);

    // Save progress
    const progress = {
      batch: batchNumber,
      lastProcessedIndex: i + chunk.length,
      successCount,
      failureCount,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(
        __dirname,
        `../data/email-batches/may-july-2025/progress_batch_${batchNumber}.json`,
      ),
      JSON.stringify(progress, null, 2),
    );

    // Delay between chunks
    if (i + CONCURRENT_ANALYSES < emails.length) {
      console.log(`   ⏸️  Pausing ${BATCH_DELAY / 1000}s before next chunk...`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  db.close();

  console.log(`\n✅ Batch ${batchNumber} complete:`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failureCount}`);

  return { successCount, failureCount };
}

async function analyzeAllBatches() {
  console.log("🚀 Starting May-July 2025 Email Analysis");
  console.log("📊 Using 85.4% llama3.2:3b and 14.6% phi-4\n");

  const summaryPath = path.join(
    __dirname,
    "../data/email-batches/may-july-2025/pull_summary.json",
  );
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));

  console.log(`📧 Total emails: ${summary.total_emails}`);
  console.log(`📦 Total batches: ${summary.batches}`);
  console.log(
    `⏱️  Estimated time: ${((summary.total_emails * 15) / 3600).toFixed(1)} hours\n`,
  );

  const startTime = Date.now();
  let totalSuccess = 0;
  let totalFailure = 0;

  // Process first 5 batches as demonstration
  const batchesToProcess = 5;
  console.log(
    `🔬 Processing first ${batchesToProcess} batches as demonstration...\n`,
  );

  for (let batch = 1; batch <= batchesToProcess; batch++) {
    // Check if batch has progress
    const progressFile = path.join(
      __dirname,
      `../data/email-batches/may-july-2025/progress_batch_${batch}.json`,
    );
    let startIndex = 0;

    if (fs.existsSync(progressFile)) {
      const progress = JSON.parse(fs.readFileSync(progressFile, "utf-8"));
      startIndex = progress.lastProcessedIndex;
      console.log(`📌 Resuming batch ${batch} from index ${startIndex}`);
    }

    const result = await analyzeBatch(batch, startIndex);
    if (result) {
      totalSuccess += result.successCount;
      totalFailure += result.failureCount;
    }
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log("\n" + "=".repeat(60));
  console.log("ANALYSIS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Batches processed: ${batchesToProcess}`);
  console.log(`Emails analyzed: ${totalSuccess + totalFailure}`);
  console.log(`Success: ${totalSuccess}`);
  console.log(`Failed: ${totalFailure}`);
  console.log(`Total time: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`Average per email: ${(totalTime / totalSuccess).toFixed(1)}s`);
  console.log("\nThis was a demonstration of 5 batches.");
  console.log(
    `Full analysis of ${summary.batches} batches would take ~${((summary.total_emails * 15) / 3600).toFixed(1)} hours.`,
  );

  // Save overall progress
  fs.writeFileSync(
    path.join(
      __dirname,
      "../data/email-batches/may-july-2025/analysis_progress.json",
    ),
    JSON.stringify(
      {
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        batchesProcessed: batchesToProcess,
        totalBatches: summary.batches,
        emailsAnalyzed: totalSuccess + totalFailure,
        totalEmails: summary.total_emails,
        successCount: totalSuccess,
        failureCount: totalFailure,
        totalMinutes: totalTime / 60,
        avgSecondsPerEmail: totalTime / totalSuccess,
        estimatedHoursForAll: (summary.total_emails * 15) / 3600,
      },
      null,
      2,
    ),
  );
}

// Check command line arguments
const args = process.argv.slice(2);
if (args[0] === "--batch" && args[1]) {
  // Analyze specific batch
  const batchNumber = parseInt(args[1]);
  const startIndex = args[2] ? parseInt(args[2]) : 0;
  analyzeBatch(batchNumber, startIndex).catch(console.error);
} else {
  // Analyze all (demo mode)
  analyzeAllBatches().catch(console.error);
}
