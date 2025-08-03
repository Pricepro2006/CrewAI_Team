import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import { graphWebhookHandler } from "./microsoft-graph";

// Mock bullmq
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "test-job-id" }),
  })),
}));

// Mock logger
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Microsoft Graph Webhook Handler", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSend: unknown;
  let mockStatus: unknown;

  beforeEach(() => {
    mockSend = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ send: mockSend });

    mockRequest = {
      query: {},
      body: null,
    };

    mockResponse = {
      send: mockSend,
      status: mockStatus,
    };
  });

  describe("Subscription Validation", () => {
    it("should respond with validation token when provided", async () => {
      const validationToken = "test-validation-token-12345";
      mockRequest.query = { validationToken };

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockSend).toHaveBeenCalledWith(validationToken);
      expect(mockStatus).not.toHaveBeenCalled();
    });
  });

  describe("Change Notifications", () => {
    it("should process valid notifications successfully", async () => {
      const notifications = {
        value: [
          {
            id: "notif-1",
            subscriptionId: "sub-123",
            subscriptionExpirationDateTime: "2025-01-19T10:00:00Z",
            changeType: "created",
            resource:
              "/users/user@tdsynnex.com/mailFolders/inbox/messages/msg-123",
            resourceData: {
              "@odata.type": "#microsoft.graph.message",
              "@odata.id": "messages/msg-123",
              "@odata.etag": 'W/"etag123"',
              id: "msg-123",
            },
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
        ],
      };

      mockRequest.body = notifications;

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(202);
      expect(mockSend).toHaveBeenCalled();
    });

    it("should reject notifications with invalid client state", async () => {
      const notifications = {
        value: [
          {
            id: "notif-1",
            subscriptionId: "sub-123",
            subscriptionExpirationDateTime: "2025-01-19T10:00:00Z",
            changeType: "created",
            resource:
              "/users/user@tdsynnex.com/mailFolders/inbox/messages/msg-123",
            clientState: "InvalidClientState",
            tenantId: "tenant-123",
          },
        ],
      };

      mockRequest.body = notifications;

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Should still respond with 202 to prevent retry storms
      expect(mockStatus).toHaveBeenCalledWith(202);
      expect(mockSend).toHaveBeenCalled();
    });

    it("should handle invalid notification format", async () => {
      mockRequest.body = { invalid: "format" };

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockSend).toHaveBeenCalledWith("Invalid notification format");
    });

    it("should handle multiple notifications in batch", async () => {
      const notifications = {
        value: [
          {
            id: "notif-1",
            subscriptionId: "sub-123",
            changeType: "created",
            resource:
              "/users/user1@tdsynnex.com/mailFolders/inbox/messages/msg-1",
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
          {
            id: "notif-2",
            subscriptionId: "sub-123",
            changeType: "updated",
            resource:
              "/users/user2@tdsynnex.com/mailFolders/inbox/messages/msg-2",
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
          {
            id: "notif-3",
            subscriptionId: "sub-123",
            changeType: "created",
            resource:
              "/users/user3@tdsynnex.com/mailFolders/inbox/messages/msg-3",
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
        ],
      };

      mockRequest.body = notifications;

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(202);
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle processing errors gracefully", async () => {
      // Mock an error in the Queue
      const { Queue } = await import("bullmq");
      (Queue as any).mockImplementationOnce(() => ({
        add: vi.fn().mockRejectedValue(new Error("Queue error")),
      }));

      const notifications = {
        value: [
          {
            id: "notif-1",
            subscriptionId: "sub-123",
            changeType: "created",
            resource:
              "/users/user@tdsynnex.com/mailFolders/inbox/messages/msg-123",
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
        ],
      };

      mockRequest.body = notifications;

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      // Should still respond with 202 even on error
      expect(mockStatus).toHaveBeenCalledWith(202);
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe("Notification Types", () => {
    it("should handle created change type", async () => {
      const notifications = {
        value: [
          {
            id: "notif-1",
            subscriptionId: "sub-123",
            changeType: "created",
            resource:
              "/users/user@tdsynnex.com/mailFolders/inbox/messages/msg-new",
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
        ],
      };

      mockRequest.body = notifications;

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(202);
    });

    it("should handle updated change type", async () => {
      const notifications = {
        value: [
          {
            id: "notif-1",
            subscriptionId: "sub-123",
            changeType: "updated",
            resource:
              "/users/user@tdsynnex.com/mailFolders/inbox/messages/msg-updated",
            clientState:
              process.env.WEBHOOK_CLIENT_STATE || "SecretClientState",
            tenantId: "tenant-123",
          },
        ],
      };

      mockRequest.body = notifications;

      await graphWebhookHandler(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockStatus).toHaveBeenCalledWith(202);
    });
  });
});
