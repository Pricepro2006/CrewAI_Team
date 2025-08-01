#!/usr/bin/env tsx
/**
 * Run three-phase analysis on ONLY 20 test emails
 */

import { PipelineOrchestrator } from "../src/core/pipeline/PipelineOrchestrator.js";
import { getDatabaseConnection } from "../src/database/connection.js";
import fs from "fs";
import path from "path";

async function runTestEmailsOnly() {
  console.log("🚀 Running Three-Phase Analysis on 20 TEST EMAILS ONLY\n");

  try {
    // Load the 20 test emails from our batch files
    const batchDir = "/home/pricepro2006/CrewAI_Team/data/email-batches";
    const testEmails: any[] = [];

    // Read test batch files
    const batchFiles = fs
      .readdirSync(batchDir)
      .filter((f) => f.startsWith("test_emails_batch_") && f.endsWith(".json"))
      .slice(0, 2); // Just first 2 batches = 20 emails

    for (const batchFile of batchFiles) {
      const batchPath = path.join(batchDir, batchFile);
      const emails = JSON.parse(fs.readFileSync(batchPath, "utf-8"));
      testEmails.push(...emails);
    }

    console.log(`📧 Loaded ${testEmails.length} test emails\n`);

    // Create a modified PipelineOrchestrator that processes specific emails
    const orchestrator = new PipelineOrchestrator();

    // Override the getAllEmails method to return only our test emails
    (orchestrator as any).getAllEmails = async () => {
      console.log("📧 Using 20 test emails instead of full database\n");

      // Transform the email format to match what the pipeline expects
      return testEmails.map((email, index) => ({
        id: email.MessageID || `test_${index}`,
        subject: email.Subject || "",
        body: email.BodyText || "",
        bodyPreview:
          email.BodyPreview || email.BodyText?.substring(0, 200) || "",
        from: {
          emailAddress: {
            address: email.SenderEmail || "unknown@email.com",
            name: email.SenderName || "Unknown",
          },
        },
        to: [],
        receivedDateTime: email.ReceivedTime,
        isRead: false,
        categories: [],
        metadata: {},
        // Legacy fields
        sender_email: email.SenderEmail || "unknown@email.com",
        recipient_emails: "",
        date_received: email.ReceivedTime,
        raw_headers: "",
        message_id: email.MessageID,
        in_reply_to: "",
        thread_id: "",
        labels: "",
        attachments: "",
        is_read: false,
        is_starred: false,
        folder: "Inbox",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    };

    console.log("🔬 Running three-phase analysis on TEST emails...\n");
    console.log("Phase 1: Pattern-based triage (20 emails)");
    console.log("Phase 2: Llama 3.2:3b analysis (top 10-15)");
    console.log("Phase 3: Phi-4 14B critical analysis (top 3-5)\n");

    // Run the pipeline
    const results = await orchestrator.runThreeStagePipeline();

    console.log("\n✅ Test pipeline completed!");
    console.log(`📊 Results:`);
    console.log(`   - Total emails processed: ${results.totalEmails}`);
    console.log(`   - Stage 1 (Pattern triage): ${results.stage1Count} emails`);
    console.log(`   - Stage 2 (Llama analysis): ${results.stage2Count} emails`);
    console.log(
      `   - Stage 3 (Critical analysis): ${results.stage3Count} emails`,
    );
  } catch (error) {
    console.error("❌ Test pipeline failed:", error);
  }
}

// Run the test
runTestEmailsOnly().catch(console.error);
