import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailAnalysisAgent } from "./EmailAnalysisAgent.js";
import { OllamaProvider } from "../../llm/OllamaProvider.js";

// Mock the OllamaProvider
vi.mock("../../llm/OllamaProvider", () => ({
  OllamaProvider: vi.fn().mockImplementation(() => ({
    generate: vi.fn(),
  })),
}));

describe("EmailAnalysisAgent", () => {
  let agent: EmailAnalysisAgent;
  let mockOllamaProvider: unknown;

  beforeEach(() => {
    agent = new EmailAnalysisAgent();
    mockOllamaProvider = (OllamaProvider as any).mock.results[0].value;
  });

  describe("Entity Extraction", () => {
    it("should extract PO numbers correctly", async () => {
      const email = {
        id: "test-email-1",
        subject: "Order Confirmation - PO #12345678",
        body: "Your purchase order PO: 87654321 has been processed.",
        bodyPreview: "Your purchase order",
        from: {
          emailAddress: {
            name: "TD SYNNEX",
            address: "orders@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T10:00:00Z",
        isRead: false,
        categories: [],
      };

      // Mock the generate response for categorization
      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Order Management"],
            priority: "High",
            intent: "Update",
            urgency: "24 Hours",
          },
          priority: "High",
          confidence: 0.9,
        }),
      );

      // Mock the summary generation
      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Order confirmation for two purchase orders",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.entities.poNumbers).toContain("12345678");
      expect(analysis.entities.poNumbers).toContain("87654321");
      expect(analysis.entities.poNumbers).toHaveLength(2);
    });

    it("should extract quote numbers correctly", async () => {
      const email = {
        id: "test-email-2",
        subject: "Quote CAS123456 Ready",
        body: "Your quotes TS789012 and WQ345678 are ready for review.",
        bodyPreview: "Your quotes",
        from: {
          emailAddress: {
            name: "Sales Team",
            address: "sales@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T11:00:00Z",
        isRead: true,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Quote Processing"],
            priority: "Medium",
            intent: "Action Required",
            urgency: "72 Hours",
          },
          priority: "Medium",
          confidence: 0.85,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Multiple quotes ready for review",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.entities.quoteNumbers).toContain("123456");
      expect(analysis.entities.quoteNumbers).toContain("789012");
      expect(analysis.entities.quoteNumbers).toContain("345678");
      expect(analysis.entities.quoteNumbers).toHaveLength(3);
    });

    it("should extract tracking numbers correctly", async () => {
      const email = {
        id: "test-email-3",
        subject: "Shipment Update",
        body: "Your package has been shipped. Tracking: 1Z999AA10123456784 and FEDEX1234567890123",
        bodyPreview: "Your package has been shipped",
        from: {
          emailAddress: {
            name: "Shipping",
            address: "shipping@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T12:00:00Z",
        isRead: false,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Shipping/Logistics"],
            priority: "Medium",
            intent: "Update",
            urgency: "No Rush",
          },
          priority: "Medium",
          confidence: 0.95,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Shipment notification with tracking numbers",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.entities.trackingNumbers).toContain("1Z999AA10123456784");
      expect(analysis.entities.trackingNumbers).toContain("FEDEX1234567890123");
      expect(analysis.entities.trackingNumbers).toHaveLength(2);
    });

    it("should extract amounts correctly", async () => {
      const email = {
        id: "test-email-4",
        subject: "Invoice #INV-2025-001",
        body: "Total amount due: $1,234.56 USD. Additional charges: 500.00 EUR",
        bodyPreview: "Total amount due",
        from: {
          emailAddress: {
            name: "Billing",
            address: "billing@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T13:00:00Z",
        isRead: false,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Order Management"],
            priority: "High",
            intent: "Action Required",
            urgency: "24 Hours",
          },
          priority: "High",
          confidence: 0.88,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Invoice with payment due",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.entities.amounts).toHaveLength(2);
      expect(analysis.entities.amounts[0]).toEqual({
        value: 1234.56,
        currency: "USD",
      });
      expect(analysis.entities.amounts[1]).toEqual({
        value: 500,
        currency: "EUR",
      });
    });
  });

  describe("Workflow State Determination", () => {
    it("should set state to New for unread emails", async () => {
      const email = {
        id: "test-email-5",
        subject: "New Order Request",
        body: "Please process this order",
        bodyPreview: "Please process this order",
        from: {
          emailAddress: {
            name: "Customer",
            address: "customer@example.com",
          },
        },
        receivedDateTime: "2025-01-18T14:00:00Z",
        isRead: false,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Order Management"],
            priority: "Medium",
            intent: "Request",
            urgency: "72 Hours",
          },
          priority: "Medium",
          confidence: 0.8,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "New order request from customer",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.workflowState).toBe("New");
    });

    it("should set state to Pending External for emails with tracking numbers", async () => {
      const email = {
        id: "test-email-6",
        subject: "Shipment Sent",
        body: "Tracking: 1Z999AA10123456784",
        bodyPreview: "Tracking: 1Z999AA10123456784",
        from: {
          emailAddress: {
            name: "Shipping",
            address: "shipping@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T15:00:00Z",
        isRead: true,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Shipping/Logistics"],
            priority: "Low",
            intent: "FYI",
            urgency: "No Rush",
          },
          priority: "Low",
          confidence: 0.92,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Shipment tracking information",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.workflowState).toBe("Pending External");
    });
  });

  describe("Categorization", () => {
    it("should categorize order-related emails correctly", async () => {
      const email = {
        id: "test-email-7",
        subject: "Order #ORD123456 Confirmation",
        body: "Your order has been confirmed",
        bodyPreview: "Your order has been confirmed",
        from: {
          emailAddress: {
            name: "Orders",
            address: "orders@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T16:00:00Z",
        isRead: false,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Order Management"],
            priority: "Medium",
            intent: "Update",
            urgency: "No Rush",
          },
          priority: "Medium",
          confidence: 0.9,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Order confirmation notification",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.categories.workflow).toContain("Order Management");
      expect(analysis.priority).toBe("Medium");
      expect(analysis.confidence).toBeGreaterThan(0.8);
    });

    it("should handle urgent emails with high priority", async () => {
      const email = {
        id: "test-email-8",
        subject: "URGENT: System Down - Action Required",
        body: "Critical system failure needs immediate attention",
        bodyPreview: "Critical system failure",
        from: {
          emailAddress: {
            name: "IT Support",
            address: "it@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T17:00:00Z",
        isRead: false,
        categories: [],
      };

      mockOllamaProvider.generate.mockResolvedValueOnce(
        JSON.stringify({
          categories: {
            workflow: ["Customer Support"],
            priority: "Critical",
            intent: "Action Required",
            urgency: "Immediate",
          },
          priority: "Critical",
          confidence: 0.98,
        }),
      );

      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Critical system failure requiring immediate action",
      );

      const analysis = await agent.analyzeEmail(email);

      expect(analysis.priority).toBe("Critical");
      expect(analysis.categories.urgency).toBe("Immediate");
      expect(analysis.categories.intent).toBe("Action Required");
    });
  });

  describe("Fallback Handling", () => {
    it("should use fallback categorization when LLM fails", async () => {
      const email = {
        id: "test-email-9",
        subject: "Order Update",
        body: "Your order is being processed",
        bodyPreview: "Your order is being processed",
        from: {
          emailAddress: {
            name: "Orders",
            address: "orders@tdsynnex.com",
          },
        },
        receivedDateTime: "2025-01-18T18:00:00Z",
        isRead: false,
        categories: [],
      };

      // Mock LLM failure
      mockOllamaProvider.generate.mockRejectedValueOnce(
        new Error("LLM unavailable"),
      );
      mockOllamaProvider.generate.mockResolvedValueOnce(
        "Order processing update",
      );

      const analysis = await agent.analyzeEmail(email);

      // Should still provide analysis using fallback
      expect(analysis.categories.workflow).toContain("Order Management");
      expect(analysis.confidence).toBeLessThan(0.8); // Lower confidence for fallback
      expect(analysis.priority).toBeDefined();
    });
  });
});
