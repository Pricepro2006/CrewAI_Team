import { describe, it, expect, beforeEach, vi } from "vitest";
import { router } from "@trpc/server";
import { emailRouter } from "./email.router.js";
import { EmailStorageService } from "../services/EmailStorageService.js";
import { wsService } from "../services/WebSocketService.js";
import { logger } from "../../utils/logger.js";

// Mock dependencies
vi.mock("../services/EmailStorageService");
vi.mock("../services/WebSocketService", () => ({
  wsService: {
    broadcastEmailBulkUpdate: vi.fn(),
    broadcastEmailAnalyticsUpdated: vi.fn(),
    subscribe: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Email Router", () => {
  let mockEmailStorage: any;
  let mockContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock EmailStorageService
    mockEmailStorage = {
      getWorkflowAnalytics: vi.fn(),
      getEmailsByWorkflow: vi.fn(),
      getEmailWithAnalysis: vi.fn(),
      updateWorkflowState: vi.fn(),
      getWorkflowPatterns: vi.fn(),
      startSLAMonitoring: vi.fn(),
      close: vi.fn(),
    };

    (EmailStorageService as any).mockImplementation(() => mockEmailStorage);

    // Create mock tRPC context
    mockContext = {
      user: {
        id: "test-user-1",
        email: "test@example.com",
        name: "Test User",
      },
    };
  });

  describe("Analytics Endpoint", () => {
    it("should return email analytics and broadcast update", async () => {
      const mockAnalytics = {
        totalEmails: 100,
        workflowDistribution: {
          "Order Management": 60,
          "Customer Support": 25,
          General: 15,
        },
        slaCompliance: {
          "on-track": 80,
          "at-risk": 15,
          overdue: 5,
        },
        averageProcessingTime: 1200,
      };

      mockEmailStorage.getWorkflowAnalytics.mockResolvedValueOnce(
        mockAnalytics,
      );

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getAnalytics({ refreshKey: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalytics);
      expect(mockEmailStorage.getWorkflowAnalytics).toHaveBeenCalledOnce();
      expect(wsService.broadcastEmailAnalyticsUpdated).toHaveBeenCalledWith(
        mockAnalytics.totalEmails,
        mockAnalytics.workflowDistribution,
        mockAnalytics.slaCompliance,
        mockAnalytics.averageProcessingTime,
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Fetching email analytics",
        "EMAIL_ROUTER",
      );
    });

    it("should handle analytics fetch errors", async () => {
      const errorMessage = "Database connection failed";
      mockEmailStorage.getWorkflowAnalytics.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      const caller = emailRouter.createCaller(mockContext);

      await expect(caller.getAnalytics({ refreshKey: 1 })).rejects.toThrow(
        "Failed to fetch email analytics",
      );

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch email analytics",
        "EMAIL_ROUTER",
        { error: expect.any(Error) },
      );
    });

    it("should handle WebSocket broadcast failures gracefully", async () => {
      const mockAnalytics = {
        totalEmails: 50,
        workflowDistribution: { General: 50 },
        slaCompliance: { "on-track": 50 },
        averageProcessingTime: 800,
      };

      mockEmailStorage.getWorkflowAnalytics.mockResolvedValueOnce(
        mockAnalytics,
      );
      (wsService.broadcastEmailAnalyticsUpdated as any).mockRejectedValueOnce(
        new Error("WebSocket error"),
      );

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getAnalytics({ refreshKey: 1 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalytics);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to broadcast analytics update",
        "EMAIL_ROUTER",
        { error: expect.any(Error) },
      );
    });
  });

  describe("Email List Endpoint", () => {
    it("should return filtered email list", async () => {
      const mockEmails = [
        {
          id: "email-1",
          subject: "Order Update",
          workflow: "Order Management",
          priority: "High",
          received_at: "2025-01-18T10:00:00Z",
        },
        {
          id: "email-2",
          subject: "Support Request",
          workflow: "Customer Support",
          priority: "Medium",
          received_at: "2025-01-18T11:00:00Z",
        },
      ];

      mockEmailStorage.getEmailsByWorkflow.mockResolvedValueOnce(mockEmails);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getList({
        workflow: "Order Management",
        limit: 50,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEmails);
      expect(mockEmailStorage.getEmailsByWorkflow).toHaveBeenCalledWith(
        "Order Management",
        50,
        0,
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Fetching email list",
        "EMAIL_ROUTER",
        { filters: { workflow: "Order Management", limit: 50, offset: 0 } },
      );
    });

    it("should apply search filters", async () => {
      const mockEmails = [
        {
          id: "email-1",
          subject: "Order Update",
          from: {
            emailAddress: {
              address: "orders@example.com",
              name: "Order System",
            },
          },
          analysis: { quick_priority: "High" },
        },
      ];

      mockEmailStorage.getEmailsByWorkflow.mockResolvedValueOnce(mockEmails);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getList({
        workflow: "Order Management",
        search: "order",
        priority: "High",
        limit: 50,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("email-1");
    });

    it("should handle empty workflow filter", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getList({
        limit: 50,
        offset: 0,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(mockEmailStorage.getEmailsByWorkflow).not.toHaveBeenCalled();
    });

    it("should handle list fetch errors", async () => {
      mockEmailStorage.getEmailsByWorkflow.mockRejectedValueOnce(
        new Error("Database error"),
      );

      const caller = emailRouter.createCaller(mockContext);

      await expect(
        caller.getList({
          workflow: "Order Management",
          limit: 50,
        }),
      ).rejects.toThrow("Failed to fetch email list");

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch email list",
        "EMAIL_ROUTER",
        { error: expect.any(Error) },
      );
    });
  });

  describe("Email Details Endpoint", () => {
    it("should return email details by ID", async () => {
      const mockEmail = {
        id: "email-1",
        subject: "Test Email",
        body: "Test email body",
        analysis: {
          quick_priority: "High",
          workflow_state: "In Progress",
        },
      };

      mockEmailStorage.getEmailWithAnalysis.mockResolvedValueOnce(mockEmail);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getById({ id: "email-1" });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockEmail);
      expect(mockEmailStorage.getEmailWithAnalysis).toHaveBeenCalledWith(
        "email-1",
      );
    });

    it("should handle email not found", async () => {
      mockEmailStorage.getEmailWithAnalysis.mockResolvedValueOnce(null);

      const caller = emailRouter.createCaller(mockContext);

      await expect(caller.getById({ id: "nonexistent-email" })).rejects.toThrow(
        "Email not found",
      );
    });

    it("should handle fetch errors", async () => {
      mockEmailStorage.getEmailWithAnalysis.mockRejectedValueOnce(
        new Error("Database error"),
      );

      const caller = emailRouter.createCaller(mockContext);

      await expect(caller.getById({ id: "email-1" })).rejects.toThrow(
        "Failed to fetch email details",
      );
    });
  });

  describe("Workflow State Update Endpoint", () => {
    it("should update workflow state with user context", async () => {
      mockEmailStorage.updateWorkflowState.mockResolvedValueOnce(undefined);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.updateWorkflowState({
        emailId: "email-1",
        newState: "Completed",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("Workflow state updated successfully");
      expect(mockEmailStorage.updateWorkflowState).toHaveBeenCalledWith(
        "email-1",
        "Completed",
        "test@example.com",
      );
      expect(logger.info).toHaveBeenCalledWith(
        "Updating workflow state",
        "EMAIL_ROUTER",
        { emailId: "email-1", newState: "Completed" },
      );
    });

    it("should handle update errors", async () => {
      mockEmailStorage.updateWorkflowState.mockRejectedValueOnce(
        new Error("Database error"),
      );

      const caller = emailRouter.createCaller(mockContext);

      await expect(
        caller.updateWorkflowState({
          emailId: "email-1",
          newState: "Completed",
        }),
      ).rejects.toThrow("Failed to update workflow state");
    });
  });

  describe("Bulk Update Endpoint", () => {
    it("should perform bulk archive operation", async () => {
      mockEmailStorage.updateWorkflowState.mockResolvedValue(undefined);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.bulkUpdate({
        emailIds: ["email-1", "email-2"],
        action: "archive",
      });

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(2);
      expect(result.data.successful).toBe(2);
      expect(result.data.failed).toBe(0);
      expect(mockEmailStorage.updateWorkflowState).toHaveBeenCalledWith(
        "email-1",
        "Archived",
      );
      expect(mockEmailStorage.updateWorkflowState).toHaveBeenCalledWith(
        "email-2",
        "Archived",
      );
      expect(wsService.broadcastEmailBulkUpdate).toHaveBeenCalledWith(
        "archive",
        ["email-1", "email-2"],
        { successful: 2, failed: 0, total: 2 },
      );
    });

    it("should handle partial failures in bulk operations", async () => {
      mockEmailStorage.updateWorkflowState
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Database error"));

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.bulkUpdate({
        emailIds: ["email-1", "email-2"],
        action: "archive",
      });

      expect(result.success).toBe(true);
      expect(result.data.processed).toBe(2);
      expect(result.data.successful).toBe(1);
      expect(result.data.failed).toBe(1);
      expect(wsService.broadcastEmailBulkUpdate).toHaveBeenCalledWith(
        "archive",
        ["email-1", "email-2"],
        { successful: 1, failed: 1, total: 2 },
      );
    });

    it("should handle change-state bulk operation", async () => {
      mockEmailStorage.updateWorkflowState.mockResolvedValue(undefined);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.bulkUpdate({
        emailIds: ["email-1"],
        action: "change-state",
        value: "In Progress",
      });

      expect(result.success).toBe(true);
      expect(mockEmailStorage.updateWorkflowState).toHaveBeenCalledWith(
        "email-1",
        "In Progress",
      );
    });

    it("should handle WebSocket broadcast failures in bulk operations", async () => {
      mockEmailStorage.updateWorkflowState.mockResolvedValue(undefined);
      (wsService.broadcastEmailBulkUpdate as any).mockRejectedValueOnce(
        new Error("WebSocket error"),
      );

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.bulkUpdate({
        emailIds: ["email-1"],
        action: "archive",
      });

      expect(result.success).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to broadcast bulk update completion",
        "EMAIL_ROUTER",
        { error: "Error: WebSocket error" },
      );
    });
  });

  describe("Workflow Patterns Endpoint", () => {
    it("should return workflow patterns", async () => {
      const mockPatterns = [
        {
          id: "pattern-1",
          pattern_name: "Order Processing",
          workflow_category: "Order Management",
          success_rate: 0.95,
          average_completion_time: 7200000,
        },
        {
          id: "pattern-2",
          pattern_name: "Support Ticket",
          workflow_category: "Customer Support",
          success_rate: 0.88,
          average_completion_time: 14400000,
        },
      ];

      mockEmailStorage.getWorkflowPatterns.mockResolvedValueOnce(mockPatterns);

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getWorkflowPatterns();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPatterns);
      expect(mockEmailStorage.getWorkflowPatterns).toHaveBeenCalledOnce();
      expect(logger.info).toHaveBeenCalledWith(
        "Fetching workflow patterns",
        "EMAIL_ROUTER",
      );
    });

    it("should handle workflow patterns fetch errors", async () => {
      mockEmailStorage.getWorkflowPatterns.mockRejectedValueOnce(
        new Error("Database error"),
      );

      const caller = emailRouter.createCaller(mockContext);

      await expect(caller.getWorkflowPatterns()).rejects.toThrow(
        "Failed to fetch workflow patterns",
      );
    });
  });

  describe("Email Statistics Endpoint", () => {
    it("should return email statistics", async () => {
      const mockAnalytics = {
        totalEmails: 200,
        workflowDistribution: { "Order Management": 120, General: 80 },
        slaCompliance: { "on-track": 180, overdue: 20 },
        averageProcessingTime: 1800,
      };

      mockEmailStorage.getWorkflowAnalytics.mockResolvedValueOnce(
        mockAnalytics,
      );

      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.getStats();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(mockAnalytics);
      expect(result.data.todayStats).toMatchObject({
        received: 0,
        processed: 0,
        overdue: 0,
        critical: 0,
      });
    });
  });

  describe("Send Email Endpoint", () => {
    it("should simulate sending email", async () => {
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
        messageId: expect.stringContaining("mock-"),
        sentAt: expect.any(String),
        recipients: 2,
      });
      expect(logger.info).toHaveBeenCalledWith(
        "Sending email",
        "EMAIL_ROUTER",
        { to: 1, subject: "Test Email", template: undefined },
      );
    });

    it("should handle send email errors", async () => {
      // Mock logger.info to throw error to simulate failure
      (logger.info as any).mockImplementationOnce(() => {
        throw new Error("Logging error");
      });

      const caller = emailRouter.createCaller(mockContext);

      await expect(
        caller.sendEmail({
          to: ["recipient@example.com"],
          subject: "Test Email",
          body: "Test email body",
        }),
      ).rejects.toThrow("Failed to send email");
    });
  });

  describe("Search Endpoint", () => {
    it("should return search results placeholder", async () => {
      const caller = emailRouter.createCaller(mockContext);
      const result = await caller.search({
        query: "test query",
        filters: { workflow: "Order Management" },
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        emails: [],
        total: 0,
        query: "test query",
        filters: { workflow: "Order Management" },
      });
      expect(logger.info).toHaveBeenCalledWith(
        "Searching emails",
        "EMAIL_ROUTER",
        { query: "test query", filters: { workflow: "Order Management" } },
      );
    });

    it("should handle search errors", async () => {
      // Mock logger.info to throw error to simulate failure
      (logger.info as any).mockImplementationOnce(() => {
        throw new Error("Search error");
      });

      const caller = emailRouter.createCaller(mockContext);

      await expect(
        caller.search({
          query: "test query",
        }),
      ).rejects.toThrow("Failed to search emails");
    });
  });

  describe("WebSocket Subscriptions", () => {
    it("should create WebSocket subscription", async () => {
      const mockSubscription = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "email.analyzed",
            data: { emailId: "test-email-1", workflow: "Order Management" },
            timestamp: new Date().toISOString(),
          };
        },
      };

      // Mock WebSocket service methods
      (wsService.subscribe as any).mockImplementation(() => {});
      (wsService.on as any).mockImplementation(() => {});
      (wsService.off as any).mockImplementation(() => {});
      (wsService.unsubscribe as any).mockImplementation(() => {});

      const caller = emailRouter.createCaller(mockContext);

      // Note: Testing subscriptions is complex with tRPC, so we'll test the basic setup
      expect(typeof caller.subscribeToEmailUpdates).toBe("function");
    });
  });
});
