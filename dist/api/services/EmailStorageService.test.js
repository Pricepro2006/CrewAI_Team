import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EmailStorageService } from "./EmailStorageService";
import { wsService } from "./WebSocketService";
import { logger } from "../../utils/logger";
import Database from "better-sqlite3";
// Mock dependencies
vi.mock("better-sqlite3");
vi.mock("./WebSocketService", () => ({
    wsService: {
        broadcastEmailAnalyzed: vi.fn(),
        broadcastEmailStateChanged: vi.fn(),
        broadcastEmailSLAAlert: vi.fn(),
        broadcastEmailAnalyticsUpdated: vi.fn(),
    },
}));
vi.mock("../../utils/logger", () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));
vi.mock("../../config/app.config", () => ({
    default: {
        database: {
            path: ":memory:",
        },
    },
}));
describe("EmailStorageService", () => {
    let emailStorageService;
    let mockDb;
    let mockStmt;
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        // Create mock database and statements
        mockStmt = {
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn(),
            prepare: vi.fn(),
        };
        mockDb = {
            prepare: vi.fn().mockReturnValue(mockStmt),
            exec: vi.fn(),
            transaction: vi.fn().mockImplementation((fn) => () => fn()),
            close: vi.fn(),
        };
        Database.mockImplementation(() => mockDb);
        emailStorageService = new EmailStorageService();
    });
    afterEach(() => {
        if (emailStorageService) {
            emailStorageService.close();
        }
    });
    describe("Database Initialization", () => {
        it("should initialize database with correct schema", () => {
            expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS emails"));
            expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS email_analysis"));
            expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS workflow_patterns"));
            expect(logger.info).toHaveBeenCalledWith("Email storage database initialized successfully", "EMAIL_STORAGE");
        });
        it("should create proper indexes for performance", () => {
            expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE INDEX IF NOT EXISTS idx_emails_graph_id"));
            expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE INDEX IF NOT EXISTS idx_emails_received_at"));
            expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining("CREATE INDEX IF NOT EXISTS idx_workflow_primary"));
        });
    });
    describe("Email Storage", () => {
        it("should store email with analysis and broadcast WebSocket update", async () => {
            const mockEmail = {
                id: "test-email-1",
                graphId: "graph-id-1",
                subject: "Test Email",
                from: {
                    emailAddress: {
                        address: "test@example.com",
                        name: "Test User",
                    },
                },
                to: [
                    {
                        emailAddress: {
                            address: "recipient@example.com",
                            name: "Recipient",
                        },
                    },
                ],
                receivedDateTime: "2025-01-18T10:00:00Z",
                isRead: false,
                hasAttachments: false,
                bodyPreview: "Test email preview",
                body: "Test email body",
                importance: "Normal",
                categories: [],
            };
            const mockAnalysis = {
                quick: {
                    workflow: {
                        primary: "Order Management",
                        secondary: ["Customer Support"],
                    },
                    priority: "High",
                    intent: "Update",
                    urgency: "24 Hours",
                    confidence: 0.9,
                    suggestedState: "In Progress",
                },
                deep: {
                    detailedWorkflow: {
                        primary: "Order Management",
                        secondary: ["Customer Support"],
                        relatedCategories: ["Shipping"],
                        confidence: 0.85,
                    },
                    entities: {
                        poNumbers: [
                            { value: "PO-12345", format: "PO-XXXXX", confidence: 0.95 },
                        ],
                        quoteNumbers: [
                            { value: "Q-98765", type: "standard", confidence: 0.88 },
                        ],
                        caseNumbers: [
                            { value: "C-11111", type: "support", confidence: 0.92 },
                        ],
                        partNumbers: [{ value: "P-99999", confidence: 0.9 }],
                        orderReferences: [{ value: "ORD-55555", confidence: 0.87 }],
                        contacts: [
                            {
                                name: "John Doe",
                                email: "john@example.com",
                                type: "internal",
                            },
                        ],
                    },
                    actionItems: [
                        {
                            type: "follow_up",
                            description: "Review order status",
                            priority: "High",
                            slaHours: 24,
                            slaStatus: "on-track",
                            estimatedCompletion: "2025-01-19T10:00:00Z",
                        },
                    ],
                    workflowState: {
                        current: "In Progress",
                        suggestedNext: "Pending Review",
                        blockers: [],
                    },
                    businessImpact: {
                        revenue: 50000,
                        customerSatisfaction: "high",
                        urgencyReason: "High-value customer order",
                    },
                    contextualSummary: "Order management workflow for high-value customer",
                    suggestedResponse: "Acknowledge receipt and provide timeline",
                    relatedEmails: [],
                },
                actionSummary: "Review and process high-priority order",
                processingMetadata: {
                    models: {
                        stage1: "qwen3:0.6b",
                        stage2: "granite3.3:2b",
                    },
                    stage1Time: 150,
                    stage2Time: 850,
                    totalTime: 1000,
                },
            };
            await emailStorageService.storeEmail(mockEmail, mockAnalysis);
            // Verify database operations
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE INTO emails"));
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE INTO email_analysis"));
            expect(mockStmt.run).toHaveBeenCalledTimes(2);
            // Verify WebSocket broadcast
            expect(wsService.broadcastEmailAnalyzed).toHaveBeenCalledWith("test-email-1", "Order Management", "High", "Review and process high-priority order", 0.85, "on-track", "In Progress");
            // Verify logging
            expect(logger.info).toHaveBeenCalledWith("Email analysis stored successfully: test-email-1", "EMAIL_STORAGE");
        });
        it("should handle WebSocket broadcast failures gracefully", async () => {
            const mockEmail = {
                id: "test-email-2",
                graphId: "graph-id-2",
                subject: "Test Email 2",
                from: {
                    emailAddress: { address: "test@example.com", name: "Test User" },
                },
                to: [],
                receivedDateTime: "2025-01-18T10:00:00Z",
                isRead: false,
                hasAttachments: false,
                bodyPreview: "Test",
                body: "Test",
                importance: "Normal",
                categories: [],
            };
            const mockAnalysis = {
                quick: {
                    workflow: { primary: "General" },
                    priority: "Low",
                    intent: "Info",
                    urgency: "Normal",
                    confidence: 0.7,
                    suggestedState: "New",
                },
                deep: {
                    detailedWorkflow: { primary: "General", confidence: 0.7 },
                    entities: {
                        poNumbers: [],
                        quoteNumbers: [],
                        caseNumbers: [],
                        partNumbers: [],
                        orderReferences: [],
                        contacts: [],
                    },
                    actionItems: [],
                    workflowState: {
                        current: "New",
                        suggestedNext: "In Review",
                        blockers: [],
                    },
                    businessImpact: {
                        revenue: 0,
                        customerSatisfaction: "medium",
                        urgencyReason: "Standard inquiry",
                    },
                    contextualSummary: "General inquiry",
                    suggestedResponse: "Standard response",
                    relatedEmails: [],
                },
                actionSummary: "Handle general inquiry",
                processingMetadata: {
                    models: { stage1: "qwen3:0.6b", stage2: "granite3.3:2b" },
                    stage1Time: 100,
                    stage2Time: 500,
                    totalTime: 600,
                },
            };
            // Mock WebSocket broadcast failure
            wsService.broadcastEmailAnalyzed.mockRejectedValueOnce(new Error("WebSocket error"));
            await emailStorageService.storeEmail(mockEmail, mockAnalysis);
            // Verify error was logged but doesn't break the flow
            expect(logger.error).toHaveBeenCalledWith("Failed to broadcast email analysis update: Error: WebSocket error", "EMAIL_STORAGE");
        });
    });
    describe("Workflow State Updates", () => {
        it("should update workflow state and broadcast changes", async () => {
            const emailId = "test-email-1";
            const newState = "Completed";
            const changedBy = "user@example.com";
            // Mock current state query
            mockStmt.get.mockReturnValueOnce({ workflow_state: "In Progress" });
            await emailStorageService.updateWorkflowState(emailId, newState, changedBy);
            // Verify database update
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE email_analysis"));
            expect(mockStmt.run).toHaveBeenCalledWith(newState, expect.any(String), expect.any(String), emailId);
            // Verify WebSocket broadcast
            expect(wsService.broadcastEmailStateChanged).toHaveBeenCalledWith(emailId, "In Progress", "Completed", changedBy);
            // Verify logging
            expect(logger.info).toHaveBeenCalledWith(`Workflow state updated: ${emailId} -> ${newState}`, "EMAIL_STORAGE");
        });
        it("should handle missing current state gracefully", async () => {
            const emailId = "test-email-2";
            const newState = "Archived";
            // Mock empty current state query
            mockStmt.get.mockReturnValueOnce(undefined);
            await emailStorageService.updateWorkflowState(emailId, newState);
            // Verify WebSocket broadcast with 'unknown' as old state
            expect(wsService.broadcastEmailStateChanged).toHaveBeenCalledWith(emailId, "unknown", "Archived", undefined);
        });
    });
    describe("SLA Monitoring", () => {
        it("should check SLA status and broadcast alerts", async () => {
            const mockViolations = [
                {
                    id: "email-1",
                    subject: "Critical Order",
                    received_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
                    deep_workflow_primary: "Order Management",
                    quick_priority: "Critical",
                    action_sla_status: "on-track",
                    workflow_state: "In Progress",
                },
                {
                    id: "email-2",
                    subject: "High Priority Request",
                    received_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), // 30 hours ago
                    deep_workflow_primary: "Customer Support",
                    quick_priority: "High",
                    action_sla_status: "on-track",
                    workflow_state: "New",
                },
            ];
            mockStmt.all.mockReturnValueOnce(mockViolations);
            await emailStorageService.checkSLAStatus();
            // Verify SLA status updates
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE email_analysis"));
            expect(mockStmt.run).toHaveBeenCalledWith("overdue", "email-1");
            expect(mockStmt.run).toHaveBeenCalledWith("overdue", "email-2");
            // Verify WebSocket broadcasts
            expect(wsService.broadcastEmailSLAAlert).toHaveBeenCalledWith("email-1", "Order Management", "Critical", "overdue", undefined, expect.any(Number));
            expect(wsService.broadcastEmailSLAAlert).toHaveBeenCalledWith("email-2", "Customer Support", "High", "overdue", undefined, expect.any(Number));
            // Verify logging
            expect(logger.info).toHaveBeenCalledWith("SLA alert broadcast for email email-1: overdue", "EMAIL_STORAGE");
            expect(logger.info).toHaveBeenCalledWith("SLA alert broadcast for email email-2: overdue", "EMAIL_STORAGE");
        });
        it("should handle at-risk emails correctly", async () => {
            const mockViolations = [
                {
                    id: "email-3",
                    subject: "Medium Priority Task",
                    received_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
                    deep_workflow_primary: "General",
                    quick_priority: "Medium",
                    action_sla_status: "on-track",
                    workflow_state: "In Progress",
                },
            ];
            mockStmt.all.mockReturnValueOnce(mockViolations);
            await emailStorageService.checkSLAStatus();
            // Should not trigger SLA alert for medium priority at 1 hour (SLA is 72 hours)
            expect(wsService.broadcastEmailSLAAlert).not.toHaveBeenCalled();
        });
    });
    describe("Analytics", () => {
        it("should calculate workflow analytics correctly", async () => {
            const mockAnalytics = {
                totalEmails: 150,
                workflowDistribution: {
                    "Order Management": 75,
                    "Customer Support": 45,
                    General: 30,
                },
                slaCompliance: {
                    "on-track": 120,
                    "at-risk": 20,
                    overdue: 10,
                },
                averageProcessingTime: 1500,
            };
            // Mock database queries
            mockStmt.get
                .mockReturnValueOnce({ total: 150 })
                .mockReturnValueOnce({ avg_time: 1500 });
            mockStmt.all
                .mockReturnValueOnce([
                { workflow: "Order Management", count: 75 },
                { workflow: "Customer Support", count: 45 },
                { workflow: "General", count: 30 },
            ])
                .mockReturnValueOnce([
                { sla_status: "on-track", count: 120 },
                { sla_status: "at-risk", count: 20 },
                { sla_status: "overdue", count: 10 },
            ]);
            const result = await emailStorageService.getWorkflowAnalytics();
            expect(result).toEqual({
                totalEmails: 150,
                workflowDistribution: {
                    "Order Management": 75,
                    "Customer Support": 45,
                    General: 30,
                },
                slaCompliance: {
                    "on-track": 120,
                    "at-risk": 20,
                    overdue: 10,
                },
                averageProcessingTime: 1500,
            });
            // Verify correct SQL queries were prepared
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT COUNT(*) as total FROM emails"));
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT deep_workflow_primary as workflow, COUNT(*) as count"));
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT action_sla_status as sla_status, COUNT(*) as count"));
        });
    });
    describe("SLA Monitoring Lifecycle", () => {
        it("should start and stop SLA monitoring", () => {
            const setIntervalSpy = vi.spyOn(global, "setInterval");
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");
            // Start monitoring
            emailStorageService.startSLAMonitoring(60000); // 1 minute
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
            expect(logger.info).toHaveBeenCalledWith("SLA monitoring started", "EMAIL_STORAGE");
            // Stop monitoring
            emailStorageService.stopSLAMonitoring();
            expect(clearIntervalSpy).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith("SLA monitoring stopped", "EMAIL_STORAGE");
        });
        it("should handle SLA monitoring errors gracefully", async () => {
            const consoleSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => { });
            // Mock SLA check to throw error
            mockStmt.all.mockImplementationOnce(() => {
                throw new Error("Database error");
            });
            await emailStorageService.checkSLAStatus();
            expect(logger.error).toHaveBeenCalledWith("Failed to broadcast SLA alert for email undefined: Error: Database error", "EMAIL_STORAGE");
            consoleSpy.mockRestore();
        });
    });
    describe("Resource Cleanup", () => {
        it("should close database and stop monitoring on close", () => {
            const clearIntervalSpy = vi.spyOn(global, "clearInterval");
            // Start monitoring first
            emailStorageService.startSLAMonitoring();
            // Then close
            emailStorageService.close();
            expect(clearIntervalSpy).toHaveBeenCalled();
            expect(mockDb.close).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=EmailStorageService.test.js.map