import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Context } from "../trpc/context.js";
import { emailRouter } from "./email.router.js";
import { EmailStorageService } from "../services/EmailStorageService.js";
import Database from "better-sqlite3";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

describe("Email Router", () => {
  let testDb: InstanceType<typeof Database>;
  let emailStorageService: EmailStorageService;
  let mockContext: Context;

  beforeEach(async () => {
    // Create in-memory test database
    testDb = new Database(":memory:");
    emailStorageService = new EmailStorageService(":memory:", false);
    
    // Seed test data
    await seedTestData();

    // Create test context - using unknown first to avoid complex type checking
    mockContext = {
      user: {
        id: "test-user-1",
        email: "test@example.com",
        name: "Test User",
        role: "user",
        isAdmin: false,
      },
      session: null,
      ip: "127.0.0.1",
      userAgent: "test-agent",
      req: {} as any,
      res: {} as any,
      requestId: "test-request",
      timestamp: new Date(),
      traceId: "test-trace",
      spanId: "test-span",
      device: {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        browser: "test",
        os: "test"
      },
      security: {
        rateLimitRemaining: 100,
        rateLimitReset: new Date(),
        requestCount: 1,
        isSecure: true,
        csrfToken: "test-token"
      },
      performance: {
        startTime: Date.now(),
        memoryUsage: process.memoryUsage()
      },
      metadata: {},
      featureFlags: {},
      batchId: "test-batch",
      validatedInput: {},
      masterOrchestrator: {} as any,
      conversationService: {} as any,
      emailStorageService: {} as any,
      businessIntelligenceService: {} as any,
      healthCheckService: {} as any,
      databaseManager: {} as any,
      cache: new Map(),
      redisClient: {} as any,
      monitoring: {} as any,
      llmService: {} as any
    } as unknown as Context;
  });

  afterEach(async () => {
    await emailStorageService.close();
    testDb.close();
  });

  async function seedTestData() {
    // Insert test emails
    const testEmails = [
      {
        id: "email-1",
        subject: "Order Update - PO123456",
        sender_email: "orders@example.com",
        sender_name: "Order System",
        received_at: new Date().toISOString(),
      },
      {
        id: "email-2", 
        subject: "Support Request - Issue with delivery",
        sender_email: "support@example.com",
        sender_name: "Support Team",
        received_at: new Date().toISOString(),
      }
    ];

    for (const email of testEmails) {
      testDb.prepare(`
        INSERT INTO emails (id, subject, sender_email, sender_name, received_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(email.id, email.subject, email.sender_email, email.sender_name, email.received_at);
    }

    // Insert test analysis data
    const testAnalysis = [
      {
        id: uuidv4(),
        email_id: "email-1",
        quick_workflow: "Order Management",
        quick_priority: "High",
        deep_workflow_primary: "Order Management",
        workflow_state: "IN_PROGRESS",
        action_sla_status: "on-track",
      },
      {
        id: uuidv4(),
        email_id: "email-2",
        quick_workflow: "Customer Support", 
        quick_priority: "Medium",
        deep_workflow_primary: "Customer Support",
        workflow_state: "START_POINT",
        action_sla_status: "on-track",
      }
    ];

    for (const analysis of testAnalysis) {
      testDb.prepare(`
        INSERT INTO email_analysis (
          id, email_id, quick_workflow, quick_priority, 
          deep_workflow_primary, workflow_state, action_sla_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        analysis.id, analysis.email_id, analysis.quick_workflow, 
        analysis.quick_priority, analysis.deep_workflow_primary,
        analysis.workflow_state, analysis.action_sla_status
      );
    }

    // Insert workflow patterns
    testDb.prepare(`
      INSERT INTO workflow_patterns (id, pattern_name, workflow_category, success_rate, average_completion_time)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), "Order Processing", "Order Management", 0.95, 7200000);
  }

  describe("Analytics Endpoint", () => {
    it("should return email analytics from real database", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getAnalytics({ refreshKey: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        totalEmails: expect.any(Number),
        workflowDistribution: expect.any(Object),
        slaCompliance: expect.any(Object),
        averageProcessingTime: expect.any(Number),
      });
      expect(result.data.totalEmails).toBeGreaterThanOrEqual(2);
      expect(result.data.workflowDistribution["Order Management"]).toBeGreaterThanOrEqual(1);
      expect(result.data.workflowDistribution["Customer Support"]).toBeGreaterThanOrEqual(1);
    });

    it("should handle database errors gracefully", async () => {
      // Close the database to simulate connection error
      testDb.close();
      
      const caller = emailRouter.createCaller(mockContext);
      
      await expect(caller.getAnalytics({ refreshKey: 1 })).rejects.toThrow();
    });
  });

  describe("Email List Endpoint", () => {
    it("should return filtered email list from database", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getList({
        workflow: "Order Management",
        limit: 50,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      
      const orderEmail = result.data.find((email: any) => 
        email.analysis?.quick?.workflow?.primary === "Order Management"
      );
      expect(orderEmail).toBeDefined();
      expect(orderEmail.subject).toContain("Order Update");
    });

    it("should return empty array for non-existent workflow", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getList({
        workflow: "Non-Existent Workflow",
        limit: 50,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("Email Details Endpoint", () => {
    it("should return email details by ID from database", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getById({ id: "email-1" });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe("email-1");
      expect(result.data.subject).toContain("Order Update");
      expect(result.data.analysis).toBeDefined();
      expect(result.data.analysis.quick.workflow.primary).toBe("Order Management");
    });

    it("should throw error for non-existent email", async () => {
      const caller = emailRouter.createCaller(mockContext);

      await expect(caller.getById({ id: "non-existent-email" })).rejects.toThrow(
        "Email not found"
      );
    });
  });

  describe("Workflow State Update Endpoint", () => {
    it("should update workflow state in database", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.updateWorkflowState({
        emailId: "email-1",
        newState: "Completed",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Workflow state updated successfully");

      // Verify the update in database
      const updatedEmail = await caller.getById({ id: "email-1" });
      expect(updatedEmail.data.analysis.deep.workflowState.current).toBe("Completed");
    });

    it("should handle updates to non-existent emails", async () => {
      const caller = emailRouter.createCaller(mockContext);

      // This should not throw but may not update anything
      const result = await caller.updateWorkflowState({
        emailId: "non-existent-email",
        newState: "Completed",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Bulk Update Endpoint", () => {
    it("should perform bulk archive operation on real data", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.bulkUpdate({
        emailIds: ["email-1", "email-2"],
        action: "archive",
      });

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(2);
      expect(result.data.successful).toBe(2);
      expect(result.data.failed).toBe(0);

      // Verify both emails were archived
      const email1 = await caller.getById({ id: "email-1" });
      const email2 = await caller.getById({ id: "email-2" });
      expect(email1.data.analysis.deep.workflowState.current).toBe("Archived");
      expect(email2.data.analysis.deep.workflowState.current).toBe("Archived");
    });

    it("should handle mixed success/failure in bulk operations", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.bulkUpdate({
        emailIds: ["email-1", "non-existent-email"],
        action: "archive",
      });

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(2);
      // Should still report success since non-existent emails don't error
      expect(result.data.successful).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Workflow Patterns Endpoint", () => {
    it("should return workflow patterns from database", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getWorkflowPatterns();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      
      const orderPattern = result.data.find((pattern: any) => 
        pattern.pattern_name === "Order Processing"
      );
      expect(orderPattern).toBeDefined();
      expect(orderPattern.workflow_category).toBe("Order Management");
      expect(orderPattern.success_rate).toBe(0.95);
    });
  });

  describe("Email Statistics Endpoint", () => {
    it("should return real email statistics", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getStats();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        totalEmails: expect.any(Number),
        workflowDistribution: expect.any(Object),
        slaCompliance: expect.any(Object),
        averageProcessingTime: expect.any(Number),
        todayStats: expect.objectContaining({
          received: expect.any(Number),
          processed: expect.any(Number),
          overdue: expect.any(Number),
          critical: expect.any(Number),
        }),
      });
      expect(result.data.totalEmails).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Send Email Endpoint", () => {
    it("should simulate sending email with proper validation", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.sendEmail({
        to: ["recipient@example.com"],
        cc: ["cc@example.com"],
        subject: "Test Email",
        body: "Test email body",
        priority: "high",
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        messageId: expect.stringMatching(/^mock-/),
        sentAt: expect.any(String),
        recipients: 2,
      });
    });

    it("should validate required email fields", async () => {
      const caller = emailRouter.createCaller(mockContext);

      await expect(
        caller.sendEmail({
          to: [],
          subject: "",
          body: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("Search Endpoint", () => {
    it("should search emails by subject", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.search({
        query: "Order",
        filters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        emails: expect.any(Array),
        total: expect.any(Number),
        query: "Order",
        filters: expect.any(Object),
      });
      
      // Should find the order email
      expect(result.data.total).toBeGreaterThanOrEqual(1);
    });

    it("should return empty results for non-matching search", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.search({
        query: "NonExistentTerm123",
        filters: {},
      });

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(0);
      expect(result.data.emails).toEqual([]);
    });
  });
});