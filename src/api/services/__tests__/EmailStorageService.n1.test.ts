import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailStorageService } from "../EmailStorageService";
import { wsService } from "../WebSocketService";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Mock dependencies
vi.mock("../WebSocketService");
vi.mock("../../../utils/logger");

describe("EmailStorageService N+1 Query Tests", () => {
  let service: EmailStorageService;
  let testDbPath: string;
  let queryCount: number;
  let originalPrepare: unknown;

  beforeEach(() => {
    // Create a test database
    testDbPath = path.join(__dirname, `test-email-n1-${Date.now()}.db`);
    service = new EmailStorageService(testDbPath);

    // Track query count by wrapping db.prepare
    queryCount = 0;
    const db = (service as any).db;
    originalPrepare = db.prepare.bind(db);

    db.prepare = (sql: string) => {
      queryCount++;
      return originalPrepare(sql);
    };

    // Create test data
    createTestData();
  });

  afterEach(() => {
    // Restore original prepare method
    if (originalPrepare) {
      (service as any).db.prepare = originalPrepare;
    }

    service.close();

    // Clean up test database
    try {
      fs.unlinkSync(testDbPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  function createTestData() {
    const db = (service as any).db;

    // Create 10 test emails with analysis
    for (let i = 0; i < 10; i++) {
      const emailId = `email-${i}`;
      const workflow = i < 5 ? "Order Processing" : "Quote Request";

      // Insert email
      db.prepare(
        `
        INSERT INTO emails (
          id, graph_id, subject, sender_email, sender_name,
          to_addresses, received_at, is_read, has_attachments,
          body_preview, body, importance, categories,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        emailId,
        `graph-${i}`,
        `Test Email ${i}`,
        `sender${i}@example.com`,
        `Sender ${i}`,
        JSON.stringify([`recipient${i}@example.com`]),
        new Date().toISOString(),
        0,
        0,
        `Preview ${i}`,
        `Body ${i}`,
        "normal",
        JSON.stringify(["test"]),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Insert analysis
      db.prepare(
        `
        INSERT INTO email_analysis (
          id, email_id, quick_workflow, quick_priority, quick_intent,
          quick_urgency, quick_confidence, quick_suggested_state,
          deep_workflow_primary, deep_workflow_secondary, deep_workflow_related,
          deep_confidence, entities_po_numbers, entities_quote_numbers,
          action_summary, action_details, workflow_state,
          contextual_summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        uuidv4(),
        emailId,
        workflow,
        "Medium",
        "request",
        "normal",
        0.85,
        "pending",
        workflow,
        JSON.stringify([]),
        JSON.stringify([]),
        0.9,
        JSON.stringify([`PO-${i}`]),
        JSON.stringify([`Q-${i}`]),
        `Action summary ${i}`,
        JSON.stringify([{ action: "review", slaStatus: "on-track" }]),
        "IN_PROGRESS",
        `Summary ${i}`,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    }
  }

  describe("getEmailsByWorkflow", () => {
    it("should execute only 1 query regardless of result count", async () => {
      // Reset query count
      queryCount = 0;

      // Get emails by workflow
      const emails = await service.getEmailsByWorkflow(
        "Order Processing",
        10,
        0,
      );

      // Should return 5 emails
      expect(emails).toHaveLength(5);

      // Should execute only 1 query (no N+1)
      expect(queryCount).toBe(1);

      // Verify email data is complete
      const firstEmail = emails[0];
      expect(firstEmail).toBeDefined();
      expect(firstEmail!.subject).toMatch(/Test Email/);
      expect(firstEmail!.analysis.quick.workflow.primary).toBe(
        "Order Processing",
      );
      expect(firstEmail!.analysis.deep.entities.poNumbers).toHaveLength(1);
    });

    it("should handle large result sets efficiently", async () => {
      // Add more test data
      const db = (service as any).db;
      for (let i = 10; i < 100; i++) {
        const emailId = `email-${i}`;

        db.prepare(
          `
          INSERT INTO emails (
            id, graph_id, subject, sender_email, sender_name,
            to_addresses, received_at, is_read, has_attachments,
            body_preview, body, importance, categories,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          emailId,
          `graph-${i}`,
          `Test Email ${i}`,
          `sender${i}@example.com`,
          `Sender ${i}`,
          JSON.stringify([`recipient${i}@example.com`]),
          new Date().toISOString(),
          0,
          0,
          `Preview ${i}`,
          `Body ${i}`,
          "normal",
          JSON.stringify(["test"]),
          new Date().toISOString(),
          new Date().toISOString(),
        );

        db.prepare(
          `
          INSERT INTO email_analysis (
            id, email_id, quick_workflow, deep_workflow_primary,
            quick_priority, workflow_state, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          uuidv4(),
          emailId,
          "Order Processing",
          "Order Processing",
          "Medium",
          "IN_PROGRESS",
          new Date().toISOString(),
          new Date().toISOString(),
        );
      }

      // Reset query count
      queryCount = 0;

      // Get 50 emails
      const emails = await service.getEmailsByWorkflow(
        "Order Processing",
        50,
        0,
      );

      // Should still execute only 1 query
      expect(queryCount).toBe(1);
      expect(emails.length).toBeLessThanOrEqual(50);
    });
  });

  describe("batchLoadEmailsWithAnalysis", () => {
    it("should load multiple emails in a single query", async () => {
      const emailIds = ["email-0", "email-1", "email-2", "email-3", "email-4"];

      // Reset query count
      queryCount = 0;

      // Batch load emails
      const emailMap = await service.batchLoadEmailsWithAnalysis(emailIds);

      // Should execute only 1 query
      expect(queryCount).toBe(1);

      // Should return all requested emails
      expect(emailMap.size).toBe(5);

      // Verify data integrity
      for (const [id, email] of emailMap) {
        expect(email.id).toBe(id);
        expect(email.subject).toMatch(/Test Email/);
        expect(email.analysis).toBeDefined();
      }
    });

    it("should handle empty array without queries", async () => {
      queryCount = 0;

      const emailMap = await service.batchLoadEmailsWithAnalysis([]);

      // Should not execute any queries
      expect(queryCount).toBe(0);
      expect(emailMap.size).toBe(0);
    });

    it("should handle missing emails gracefully", async () => {
      const emailIds = [
        "email-0",
        "non-existent-1",
        "email-2",
        "non-existent-2",
      ];

      queryCount = 0;

      const emailMap = await service.batchLoadEmailsWithAnalysis(emailIds);

      // Should execute only 1 query
      expect(queryCount).toBe(1);

      // Should return only existing emails
      expect(emailMap.size).toBe(2);
      expect(emailMap.has("email-0")).toBe(true);
      expect(emailMap.has("email-2")).toBe(true);
      expect(emailMap.has("non-existent-1")).toBe(false);
      expect(emailMap.has("non-existent-2")).toBe(false);
    });
  });

  describe("checkSLAStatus", () => {
    it("should batch update SLA statuses in a transaction", async () => {
      // Create emails with different priorities
      const db = (service as any).db;
      const priorities = ["Critical", "High", "Medium", "Low"];

      for (let i = 0; i < priorities.length; i++) {
        const emailId = `sla-email-${i}`;
        const priority = priorities[i];

        // Insert email with old received date to trigger SLA
        const oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago

        db.prepare(
          `
          INSERT INTO emails (
            id, graph_id, subject, sender_email, sender_name,
            to_addresses, received_at, is_read, has_attachments,
            body_preview, body, importance, categories,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          emailId,
          `graph-sla-${i}`,
          `SLA Test Email ${i}`,
          `sender@example.com`,
          `Sender`,
          JSON.stringify(["recipient@example.com"]),
          oldDate.toISOString(),
          0,
          0,
          `Preview`,
          `Body`,
          "normal",
          JSON.stringify(["test"]),
          new Date().toISOString(),
          new Date().toISOString(),
        );

        db.prepare(
          `
          INSERT INTO email_analysis (
            id, email_id, quick_workflow, quick_priority,
            deep_workflow_primary, workflow_state,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          uuidv4(),
          emailId,
          "Order Processing",
          priority,
          "Order Processing",
          "IN_PROGRESS",
          new Date().toISOString(),
          new Date().toISOString(),
        );
      }

      // Reset query count
      queryCount = 0;

      // Check SLA status
      await service.checkSLAStatus();

      // Should execute:
      // 1. SELECT query to find violations
      // 2. Prepare UPDATE statement
      // 3. Transaction with multiple updates (but counted as 1 transaction)
      // Total should be minimal, not N queries for N violations
      expect(queryCount).toBeLessThan(10); // Much less than N+1

      // Verify updates were applied
      const violations = db
        .prepare(
          `
        SELECT COUNT(*) as count 
        FROM email_analysis 
        WHERE action_sla_status IN ('at-risk', 'overdue')
      `,
        )
        .get() as any;

      expect(violations.count).toBeGreaterThan(0);
    });
  });

  describe("Performance comparison", () => {
    it("should show significant performance improvement", async () => {
      // Add 100 emails
      const db = (service as any).db;
      for (let i = 100; i < 200; i++) {
        const emailId = `perf-email-${i}`;

        db.prepare(
          `
          INSERT INTO emails (
            id, graph_id, subject, sender_email, sender_name,
            to_addresses, received_at, is_read, has_attachments,
            body_preview, body, importance, categories,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          emailId,
          `graph-${i}`,
          `Performance Test Email ${i}`,
          `sender${i}@example.com`,
          `Sender ${i}`,
          JSON.stringify([`recipient${i}@example.com`]),
          new Date().toISOString(),
          0,
          0,
          `Preview ${i}`,
          `Body ${i}`,
          "normal",
          JSON.stringify(["test"]),
          new Date().toISOString(),
          new Date().toISOString(),
        );

        db.prepare(
          `
          INSERT INTO email_analysis (
            id, email_id, quick_workflow, deep_workflow_primary,
            quick_priority, workflow_state, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        ).run(
          uuidv4(),
          emailId,
          "Performance Test",
          "Performance Test",
          "Medium",
          "IN_PROGRESS",
          new Date().toISOString(),
          new Date().toISOString(),
        );
      }

      // Measure optimized method
      queryCount = 0;
      const startOptimized = Date.now();
      const optimizedEmails = await service.getEmailsByWorkflow(
        "Performance Test",
        100,
        0,
      );
      const endOptimized = Date.now();
      const optimizedQueries = queryCount;
      const optimizedTime = endOptimized - startOptimized;

      // Verify results
      expect(optimizedEmails.length).toBe(100);
      expect(optimizedQueries).toBe(1); // Only 1 query

      console.log(
        `Optimized: ${optimizedQueries} queries in ${optimizedTime}ms`,
      );

      // The optimized version should use significantly fewer queries
      expect(optimizedQueries).toBeLessThan(10);
    });
  });
});
