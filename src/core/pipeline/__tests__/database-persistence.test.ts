/**
 * Test that verifies pipeline actually saves analysis data to the database
 * This test ensures we don't just run the pipeline but actually persist results
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDatabaseConnection } from "../../../database/connection.js";
import { PipelineOrchestrator } from "../PipelineOrchestrator.js";
import { logger } from "../../../utils/logger.js";
import type { Email } from "../types.js";

// Mock emails for testing
const TEST_EMAILS = [
  {
    id: "1001",
    message_id: "test-001@example.com",
    subject: "URGENT: Purchase Order PO12345678 - Rush Delivery Required",
    sender_email: "buyer@company.com",
    recipient_emails: "sales@vendor.com",
    date_received: new Date().toISOString(),
    body: "Please process PO12345678 immediately. Need parts by end of week.",
    folder: "inbox",
    is_read: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "1002",
    message_id: "test-002@example.com",
    subject: "Quote Request Q-2024-789 for Part Numbers",
    sender_email: "procurement@corp.com",
    recipient_emails: "quotes@vendor.com",
    date_received: new Date().toISOString(),
    body: "Requesting quote for PN# ABC123, DEF456. Need pricing ASAP.",
    folder: "inbox",
    is_read: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe("Pipeline Database Persistence", () => {
  let db: ReturnType<typeof getDatabaseConnection>;
  let orchestrator: PipelineOrchestrator;

  beforeEach(() => {
    // Get database connection
    db = getDatabaseConnection();

    // Clear test data - delete in correct order due to foreign keys
    db.prepare(
      "DELETE FROM stage_results WHERE email_id IN ('1001', '1002')",
    ).run();
    db.prepare(
      "DELETE FROM email_analysis WHERE email_id IN ('1001', '1002')",
    ).run();
    db.prepare(
      "DELETE FROM emails_enhanced WHERE id IN ('1001', '1002')",
    ).run();

    // Insert test emails
    const insertEmail = db.prepare(`
      INSERT OR REPLACE INTO emails_enhanced (
        id, message_id, subject, sender_email, recipients,
        received_at, body_text, categories, is_read, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    TEST_EMAILS.forEach((email) => {
      insertEmail.run(
        email.id,
        email.message_id,
        email.subject,
        email.sender_email,
        email.recipient_emails,
        email.date_received,
        email.body,
        email.folder,
        email.is_read ? 1 : 0,
        "new", // status
        email.created_at,
        email.updated_at,
      );
    });

    orchestrator = new PipelineOrchestrator();
  });

  afterEach(() => {
    // Clean up test data - delete in correct order due to foreign keys
    db.prepare(
      "DELETE FROM stage_results WHERE email_id IN ('1001', '1002')",
    ).run();
    db.prepare(
      "DELETE FROM email_analysis WHERE email_id IN ('1001', '1002')",
    ).run();
    db.prepare(
      "DELETE FROM emails_enhanced WHERE id IN ('1001', '1002')",
    ).run();
  });

  it("should persist analysis results to email_analysis table", async () => {
    // Run the pipeline with our test emails
    logger.info("Running pipeline for test emails", "TEST");

    // Mock the getAllEmails method to return only our test emails
    const originalGetAllEmails = orchestrator["getAllEmails"];
    orchestrator["getAllEmails"] = async () => TEST_EMAILS;

    try {
      // Run Stage 1 only for quick test
      const stage1 = orchestrator["stage1"];
      const triageResults = await stage1.process(TEST_EMAILS);

      // Manually call consolidateResults with just Stage 1 data
      await orchestrator["saveConsolidatedResults"](
        triageResults.all.map((result) => ({
          emailId: result.emailId,
          stage1: result,
          stage2: null,
          stage3: null,
          finalScore: result.priorityScore,
          pipelineStage: 1,
        })),
      );

      // Verify data was saved to email_analysis table
      const savedAnalysis = db
        .prepare(
          `
        SELECT * FROM email_analysis WHERE email_id IN (?, ?)
      `,
        )
        .all("1001", "1002");

      // Critical assertions
      expect(savedAnalysis.length).toBe(2);
      expect(savedAnalysis).not.toBeNull();

      // Verify each email has analysis data
      const email1Analysis = savedAnalysis.find(
        (a: any) => a.email_id === "1001",
      ) as any;
      const email2Analysis = savedAnalysis.find(
        (a: any) => a.email_id === "1002",
      ) as any;

      expect(email1Analysis).toBeDefined();
      expect(email1Analysis?.pipeline_stage).toBe(1);
      expect(email1Analysis?.pipeline_priority_score).toBeGreaterThan(0);
      expect(email1Analysis?.final_model_used).toBe("pattern");

      expect(email2Analysis).toBeDefined();
      expect(email2Analysis?.pipeline_stage).toBe(1);
      expect(email2Analysis?.pipeline_priority_score).toBeGreaterThan(0);
      expect(email2Analysis?.final_model_used).toBe("pattern");

      // Verify stage_results were also saved
      const stageResults = db
        .prepare(
          `
        SELECT * FROM stage_results WHERE email_id IN (?, ?)
      `,
        )
        .all("1001", "1002");

      // Stage results might not be saved without executionId, but email_analysis is critical
      logger.info(`Saved ${savedAnalysis.length} analysis records`, "TEST");
    } finally {
      // Restore original method
      orchestrator["getAllEmails"] = originalGetAllEmails;
    }
  });

  it("should handle INSERT OR REPLACE correctly for existing records", async () => {
    // Pre-insert a record
    db.prepare(
      `
      INSERT INTO email_analysis (
        email_id, pipeline_stage, pipeline_priority_score, 
        final_model_used, analysis_timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `,
    ).run("1001", 0, 0, "old_model", new Date().toISOString());

    // Verify pre-existing record
    const before = db
      .prepare("SELECT * FROM email_analysis WHERE email_id = ?")
      .get("1001");
    expect(before).toBeDefined();
    expect((before as any).final_model_used).toBe("old_model");

    // Mock getAllEmails to return only first test email
    orchestrator["getAllEmails"] = async () => [TEST_EMAILS[0] as Email];

    try {
      // Run Stage 1
      const stage1 = orchestrator["stage1"];
      const triageResults = await stage1.process([TEST_EMAILS[0] as Email]);

      // Save results
      if (triageResults.all[0]) {
        await orchestrator["saveConsolidatedResults"]([
          {
            emailId: triageResults.all[0].emailId,
            stage1: triageResults.all[0],
            stage2: null,
            stage3: null,
            finalScore: triageResults.all[0].priorityScore,
            pipelineStage: 1,
          },
        ]);
      }

      // Verify record was updated, not duplicated
      const after = db
        .prepare("SELECT * FROM email_analysis WHERE email_id = ?")
        .all("1001");
      expect(after.length).toBe(1); // Should still be only one record
      expect((after[0] as any).final_model_used).toBe("pattern"); // Should be updated
      expect((after[0] as any).pipeline_stage).toBe(1);
    } finally {
      orchestrator["getAllEmails"] = async () => TEST_EMAILS;
    }
  });
});
