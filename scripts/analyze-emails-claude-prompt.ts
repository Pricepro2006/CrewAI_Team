#!/usr/bin/env tsx

/**
 * Email Analysis with doomgrave/phi-4 using Claude's 8-point prompt
 * This uses the EXACT prompt that achieved 8.5/10 with Claude
 */

import Database from "better-sqlite3";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Initialize database
const db = db.pragma("foreign_keys = ON"); // Use connection pool instead: getDatabaseConnection().getDatabase() or executeQuery((db) => ...)"./data/crewai.db");

// Ollama configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const MODEL = "doomgrave/phi-4:14b-tools-Q3_K_S";

interface Email {
  id?: string;
  MessageID?: string;
  Subject: string;
  SenderEmail: string;
  SenderName: string;
  ReceivedAt: string;
  BodyText?: string;
  BodyPreview?: string;
}

/**
 * The comprehensive 8-point analysis prompt that achieved 8.5/10 with Claude
 */
function buildComprehensivePrompt(email: Email): string {
  return `You are an expert email analyst with deep understanding of TD SYNNEX business communications and workflows. Analyze this email data with comprehensive depth for real-time workflow management.

EMAIL DATA:
MessageID: ${email.MessageID || email.id}
Subject: ${email.Subject}
From: ${email.SenderName} <${email.SenderEmail}>
Date: ${email.ReceivedAt}
Body: ${email.BodyText || email.BodyPreview || "No body content"}

COMPREHENSIVE ANALYSIS REQUIREMENTS:

1. WORKFLOW STATE IDENTIFICATION & TRANSITIONS
   Identify precise markers for workflow states:
   
   START POINTS (🔴):
   - Quote/pricing requests ("Could you provide a quote for...", "Need pricing on...")
   - New inquiries ("We need assistance with...", "Please process...")
   - Urgent requests ("[URGENT]", "ASAP", "immediate attention")
   - Approval requests ("Require approval", "Please advise")
   
   IN-PROGRESS INDICATORS (🟡):
   - Active processing ("working on this", "processing your request", "investigating")
   - Status updates ("pending approval", "under review", "following up")
   - Information gathering ("checking availability", "awaiting response")
   - Acknowledgments ("Re:", "received your request")
   
   COMPLETION MARKERS (🟢):
   - Delivery confirmations ("attached is...", "order confirmed", "shipped")
   - Resolution statements ("completed", "processed", "resolved", "closed")
   - Final outcomes ("issue resolved", "order fulfilled", "approved")

2. DEEP ENTITY EXTRACTION
   Extract with high precision:
   - Reference Numbers: PO numbers (PO #XXXXXX), Quote numbers (WQ######), SO numbers, tracking IDs, case IDs
   - Financial Data: Pricing, amounts, rebate IDs, Special Pricing Agreement (SPA) numbers
   - Products: Part numbers, SKUs, product names, service types
   - Participants: Senders, recipients, internal vs external contacts, decision makers
   - Temporal: Deadlines, expiration dates, delivery dates, follow-up dates
   - Locations: Shipping addresses, relevant locations
   - Error Messages: System errors, process failures, specific error codes

3. BUSINESS PROCESS ANALYSIS
   Identify underlying workflows:
   - Quote-to-order conversion processes
   - Order fulfillment stages
   - Support ticket lifecycles
   - Approval workflows
   - Escalation patterns
   - Handoff procedures between teams/departments

4. COMMUNICATION PATTERN DISCOVERY
   Analyze organic patterns:
   - Thread reconstruction and conversation flows
   - Authority/hierarchy indicators
   - Decision-making processes
   - Information flow bottlenecks
   - Response time patterns
   - Escalation triggers

5. PRIORITY & URGENCY ASSESSMENT
   Determine criticality through:
   - Explicit urgency indicators (ALL CAPS, urgent keywords)
   - Implicit priority signals (executive involvement, high-value amounts)
   - Time sensitivity (approaching deadlines, quote expiration)
   - Business impact (key clients, large orders, critical issues)
   - Sentiment analysis (frustration, satisfaction, concern)

6. ACTION ITEM & OWNERSHIP IDENTIFICATION
   Extract actionable intelligence:
   - Specific tasks requiring completion
   - Clear ownership assignment
   - Dependencies and blockers
   - Next steps and follow-up requirements
   - Deadline associations

7. HIGH-VALUE INFORMATION CAPTURE
   Focus on business-critical elements:
   - Large quotes and significant deals
   - Key client mentions (major accounts)
   - Quote-to-order conversion tracking
   - Expiring quotes and time-sensitive opportunities
   - Recurring issues and error patterns
   - Performance metrics and efficiency indicators

8. RELATIONSHIP & CONTEXT MAPPING
   Understand communication dynamics:
   - External vs internal communication patterns
   - Key participant roles and responsibilities
   - Recurring business relationships
   - Workflow dependencies
   - Team interaction matrices

Return comprehensive analysis in markdown format with:
- Precise workflow state classification with supporting evidence
- Complete entity extraction with context
- Communication flow analysis
- Priority assessment with reasoning
- Action items with clear ownership
- Business insights and patterns
- Efficiency indicators and bottlenecks

Focus on TD SYNNEX distribution workflows (quotes, orders, support, approvals) while maintaining analytical depth for real-time dashboard insights.`;
}

/**
 * Call Ollama API with the doomgrave/phi-4 model
 */
async function callOllamaLLM(prompt: string): Promise<string> {
  console.log(`    🤖 Calling ${MODEL} with comprehensive prompt...`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temperature for more consistent output
          top_p: 0.9,
          max_tokens: 4096, // Increased for comprehensive analysis
          repeat_penalty: 1.1,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;
    console.log(
      `    ✅ LLM response received (${data.response.length} chars) in ${processingTime}ms`,
    );
    return data.response;
  } catch (error) {
    console.error(`    ❌ LLM call failed:`, error);
    throw error;
  }
}

/**
 * Save analysis to database with proper structure
 */
async function saveAnalysisToDatabase(
  email: Email,
  analysis: string,
  processingTime: number,
): Promise<void> {
  const analysisId = uuidv4();
  const emailId = email.MessageID || email.id;

  if (!emailId) {
    throw new Error("Email has no ID");
  }

  // Extract workflow state from analysis
  const workflowMatch = analysis.match(
    /workflow.{0,20}state[:\s]+([🔴🟡🟢]?\s*\w+)/i,
  );
  const workflow = workflowMatch ? workflowMatch[1].trim() : "Unknown";

  // Extract priority from analysis
  const priorityMatch = analysis.match(/priority[:\s]+(\w+)/i);
  const priority = priorityMatch ? priorityMatch[1].trim() : "Medium";

  const stmt = db.prepare(`
    INSERT INTO email_analysis (
      id, email_id, 
      quick_workflow, quick_priority, quick_intent, quick_urgency, quick_confidence,
      quick_suggested_state, quick_model, quick_processing_time,
      deep_workflow_primary, deep_confidence,
      contextual_summary, suggested_response,
      deep_model, deep_processing_time,
      total_processing_time, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    analysisId,
    emailId,
    workflow,
    priority,
    "Analysis",
    "Normal",
    0.85,
    "analyzed",
    MODEL,
    processingTime,
    workflow,
    0.85,
    analysis.substring(0, 1000), // First 1000 chars as summary
    "See full analysis",
    MODEL,
    processingTime,
    processingTime,
    new Date().toISOString(),
    new Date().toISOString(),
  );
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n🚀 Email Analysis with Claude's 8-Point Prompt\n`);
  console.log(`Using model: ${MODEL}\n`);

  // Check if Ollama is running
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    const data = await response.json();
    const hasModel = data.models?.some((m: any) => m.name === MODEL);

    if (!hasModel) {
      console.error(`❌ Model ${MODEL} not found in Ollama`);
      console.log(
        "Available models:",
        data.models?.map((m: any) => m.name).join(", "),
      );
      console.log(`\nPull the model with: ollama pull ${MODEL}`);
      process.exit(1);
    }

    console.log(`✅ Ollama is running with ${MODEL}\n`);
  } catch (error) {
    console.error("❌ Cannot connect to Ollama. Is it running?");
    console.error(`Start Ollama with: ollama serve`);
    process.exit(1);
  }

  // Load test batch files
  const batchDir = "./test_batches_converted";
  const batchFiles = await readdir(batchDir);
  const emailBatches = batchFiles.filter(
    (f) => f.endsWith(".json") && f.startsWith("emails_batch"),
  );

  console.log(`📁 Found ${emailBatches.length} email batch files\n`);

  let totalAnalyzed = 0;
  let totalFailed = 0;
  const results: Array<{
    email: string;
    workflow: string;
    priority: string;
    time: number;
  }> = [];

  // Process each batch
  for (const [batchIndex, batchFile] of emailBatches.entries()) {
    console.log(
      `\n[${batchIndex + 1}/${emailBatches.length}] Processing ${batchFile}...`,
    );

    const content = await readFile(join(batchDir, batchFile), "utf-8");
    const batch = JSON.parse(content);
    const emails = batch.emails || [batch];

    console.log(`  📧 ${emails.length} emails in batch\n`);

    for (const email of emails) {
      try {
        console.log(
          `  📅 ${email.Subject?.substring(0, 50) || email.subject?.substring(0, 50)}...`,
        );

        // Build comprehensive prompt
        const prompt = buildComprehensivePrompt(email);

        // Get analysis from LLM
        const startTime = Date.now();
        const analysis = await callOllamaLLM(prompt);
        const processingTime = Date.now() - startTime;

        // Save to database
        await saveAnalysisToDatabase(email, analysis, processingTime);

        // Extract key results
        const workflowMatch = analysis.match(
          /workflow.{0,20}state[:\s]+([🔴🟡🟢]?\s*\w+)/i,
        );
        const priorityMatch = analysis.match(/priority[:\s]+(\w+)/i);

        const workflow = workflowMatch ? workflowMatch[1].trim() : "Unknown";
        const priority = priorityMatch ? priorityMatch[1].trim() : "Unknown";

        console.log(`    ✅ Analysis complete`);
        console.log(`    📊 Workflow: ${workflow}, Priority: ${priority}`);
        console.log(`    ⏱️  Time: ${(processingTime / 1000).toFixed(1)}s`);

        results.push({
          email: email.Subject || email.subject || "No subject",
          workflow,
          priority,
          time: processingTime,
        });

        totalAnalyzed++;
      } catch (error) {
        console.error(`    ❌ Failed:`, error.message);
        totalFailed++;
      }
    }
  }

  // Summary
  console.log(`\n📊 Final Results:`);
  console.log(`  ✅ Successfully analyzed: ${totalAnalyzed}`);
  console.log(`  ❌ Failed: ${totalFailed}`);
  console.log(
    `  📈 Success rate: ${((totalAnalyzed / (totalAnalyzed + totalFailed)) * 100).toFixed(1)}%`,
  );

  // Workflow distribution
  const workflowCounts = results.reduce(
    (acc, r) => {
      acc[r.workflow] = (acc[r.workflow] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log(`\n📊 Workflow Distribution:`);
  Object.entries(workflowCounts).forEach(([workflow, count]) => {
    console.log(`  ${workflow}: ${count}`);
  });

  // Priority distribution
  const priorityCounts = results.reduce(
    (acc, r) => {
      acc[r.priority] = (acc[r.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log(`\n📊 Priority Distribution:`);
  Object.entries(priorityCounts).forEach(([priority, count]) => {
    console.log(`  ${priority}: ${count}`);
  });

  // Average processing time
  const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  console.log(
    `\n⏱️  Average processing time: ${(avgTime / 1000).toFixed(1)}s per email`,
  );

  console.log(
    `\n✨ Analysis complete with Claude's comprehensive 8-point prompt!\n`,
  );

  db.close();
}

// Run the script
main().catch(console.error);
