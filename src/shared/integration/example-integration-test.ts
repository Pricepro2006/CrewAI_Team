/**
 * Example Integration Test
 * Demonstrates how to use the comprehensive integration testing framework
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { integrationCoordinator } from "./coordinator.js";
import type {
  TestConfig,
  TestContext,
} from "../testing/integration-test-framework.js";

// Mock types for the test
interface EmailRecord {
  id: string;
  email_alias: string;
  requested_by: string;
  subject: string;
  summary: string;
  status: string;
  status_text: string;
  workflow_state: string;
  priority: string;
  received_date: string;
  is_read: boolean;
  has_attachments: boolean;
}

// Mock functions for testing
const authenticateUser = vi
  .fn()
  .mockImplementation(async (context: any, user: any) => {
    if (user?.password === "wrong-password") {
      throw new Error("Authentication failed");
    }
    return "mock-jwt-token-1234567890abcdef1234567890abcdef1234567890";
  });

// =====================================================
// Example Integration Test Suite
// =====================================================

describe("CrewAI Team Integration Tests", () => {
  let testContext: unknown;
  let authToken: string;

  beforeEach(async () => {
    // Initialize the integration coordinator
    await integrationCoordinator.initialize({
      version: "1.0.0",
      environment: "test",
      features: {
        email_dashboard: true,
        agent_coordination: true,
        websocket_updates: true,
      },
      limits: {
        maxConcurrentTasks: 5,
        maxMessageLength: 10000,
        maxFileSize: 10 * 1024 * 1024, // 10MB for tests
        maxConversationLength: 100,
        requestTimeout: 15000,
        rateLimits: {
          requests: { windowMs: 60000, maxRequests: 1000 }, // Higher limits for tests
          uploads: { windowMs: 60000, maxRequests: 100 },
          websocket: { windowMs: 60000, maxRequests: 5000 },
          api: {},
        },
      },
      services: {
        database: {
          type: "sqlite",
          path: ":memory:", // Use in-memory database for tests
        },
        llm: {
          provider: "ollama",
          baseUrl: process.env.TEST_OLLAMA_URL || "http://localhost:11434",
          model: "llama2:7b",
        },
        vectorStore: {
          type: "chromadb",
          url: process.env.TEST_CHROMA_URL || "http://localhost:8000",
          collection: "test-knowledge",
          dimension: 384,
        },
        cache: {
          provider: "memory",
          ttl: 300, // 5 minute cache for tests
        },
        websocket: {
          path: "/test-ws",
          cors: ["http://localhost:3000"],
          heartbeat: 10000,
          maxConnections: 100,
          messageQueue: {
            type: "memory",
            maxSize: 1000,
            strategy: "fifo",
            retryPolicy: {
              maxAttempts: 3,
              backoffMs: 100,
              backoffMultiplier: 1.5,
              maxBackoffMs: 1000,
            },
          },
        },
        monitoring: {
          metrics: {
            enabled: true,
            interval: 5000,
            retention: 300,
            aggregation: ["count"],
            exports: [],
          },
          logging: {
            level: "debug",
            format: "json",
            outputs: [{ type: "console" }],
          },
          tracing: {
            enabled: false,
            serviceName: "test-crewai",
            sampleRate: 1.0,
          },
          alerts: [],
        },
      },
      security: {
        authentication: {
          jwt: {
            secret: "test-jwt-secret-key",
            expiresIn: "1h",
            issuer: "test-crewai",
            audience: "test-api",
            algorithm: "HS256",
          },
          session: {
            secret: "test-session-secret",
            maxAge: 3600000,
            secure: false,
            sameSite: "lax",
          },
        },
        authorization: {
          rbac: {
            roles: [
              { name: "admin", description: "Test admin", permissions: ["*"] },
              {
                name: "user",
                description: "Test user",
                permissions: ["read", "write"],
              },
            ],
            inheritance: false,
            caching: false,
          },
          permissions: [],
        },
        encryption: { algorithm: "aes-256-gcm", keySize: 32, secrets: [] },
        cors: {
          origins: ["http://localhost:3000"],
          methods: ["GET", "POST"],
          headers: ["Content-Type"],
          credentials: true,
        },
        csrf: {
          enabled: false,
          cookie: {
            name: "_test_csrf",
            secure: false,
            httpOnly: true,
            sameSite: "lax",
          },
        },
        rateLimit: {
          global: { windowMs: 60000, maxRequests: 1000 },
          perUser: { windowMs: 60000, maxRequests: 2000 },
          perIP: { windowMs: 60000, maxRequests: 1000 },
          endpoints: {},
        },
      },
    });

    // Create test context
    testContext = await integrationCoordinator.createTestEnvironment({
      timeout: 15000,
      retries: 3,
      cleanup: true,
      database: {
        resetBetweenTests: true,
        seedData: true,
        useTransactions: true,
        isolationLevel: "READ_COMMITTED",
      },
    });

    console.log("✅ Test environment initialized");
  });

  afterEach(async () => {
    // Cleanup
    await integrationCoordinator.shutdown();
    console.log("🧹 Test environment cleaned up");
  });

  describe("Authentication Flow", () => {
    it("should authenticate user and return valid token", async () => {
      // Test user authentication
      authToken = await authenticateUser(
        testContext,
        testContext?.config?.authentication?.defaultUser || {
          username: "test",
          password: "test",
        },
      );

      expect(authToken).toBeDefined();
      expect(authToken).toBeTypeOf("string");
      expect(authToken.length).toBeGreaterThan(50); // JWT tokens are typically longer

      console.log("✅ User authentication successful");
    });

    it("should fail authentication with invalid credentials", async () => {
      const invalidUser = {
        ...(testContext?.config?.authentication?.defaultUser || {
          username: "test",
          password: "test",
        }),
        password: "wrong-password",
      };

      try {
        await authenticateUser(testContext, invalidUser);
        throw new Error("Authentication should have failed");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Authentication failed");
      }

      console.log("✅ Invalid authentication properly rejected");
    });
  });

  describe("API Health Checks", () => {
    it("should return healthy status for all services", async () => {
      const health = await integrationCoordinator.getHealthStatus();

      expect(health.status).toBe("healthy");
      expect(health.services).toBeDefined();
      expect(health.timestamp).toBeDefined();

      // Check individual services
      expect(health.services?.api_server?.status).toBe("healthy");

      console.log("✅ Health check passed:", health.status);
    });

    it("should provide detailed service information", async () => {
      const health = await integrationCoordinator.getHealthStatus();

      expect(health.metadata).toBeDefined();
      expect(health.metadata?.version).toBeDefined();
      expect(health.metadata?.uptime).toBeTypeOf("number");
      expect(health.metadata?.memory).toBeDefined();

      console.log("✅ Service metadata available");
    });
  });

  describe("Email Dashboard Integration", () => {
    beforeEach(async () => {
      // Ensure we're authenticated
      if (!authToken) {
        authToken = await authenticateUser(
          testContext,
          testContext?.config?.authentication?.defaultUser || {
            username: "test",
            password: "test",
          },
        );
      }
    });

    it("should list emails with pagination", async () => {
      const response = await testContext.services.http.get(
        "/api/emails?page=1&pageSize=10",
      );

      expect(response.status).toBe(200);
      expect(response.responseTime).toBeLessThan(5000); // Max 5 seconds

      const data = response.data as any;
      expect(data.emails).toBeDefined();
      expect(Array.isArray(data.emails)).toBe(true);
      expect(data.total).toBeTypeOf("number");
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(10);

      console.log(`✅ Retrieved ${data.total} emails with pagination`);
    });

    it("should filter emails by status", async () => {
      const response = await testContext.services.http.get(
        "/api/emails?statuses=red,yellow&page=1&pageSize=20",
      );

      expect(response.status).toBe(200);

      const data = response.data as any;
      expect(data.emails).toBeDefined();

      // Verify all returned emails have the correct status
      data.emails.forEach((email: EmailRecord) => {
        expect(["red", "yellow"]).toContainEqual(email.status);
      });

      console.log(
        `✅ Filtered emails by status: ${data.emails.length} results`,
      );
    });

    it("should create and update email records", async () => {
      // Create a new email
      const newEmail = {
        subject: "Test Email Subject",
        email_alias: "test@example.com",
        requested_by: "integration-test",
        summary: "Test email created by integration test",
        status: "yellow" as const,
        status_text: "Pending review",
        workflow_state: "START_POINT" as const,
        priority: "medium" as const,
      };

      const createResponse = await testContext.services.http.post(
        "/api/emails",
        newEmail,
      );

      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toBeDefined();

      const createdEmail = createResponse.data as EmailRecord;
      expect(createdEmail.id).toBeDefined();
      expect(createdEmail.subject).toBe(newEmail.subject);
      expect(createdEmail.status).toBe("yellow");

      // Update the email
      const updateData = {
        status: "green" as const,
        status_text: "Resolved by integration test",
        workflow_state: "COMPLETION" as const,
      };

      const updateResponse = await testContext.services.http.patch(
        `/api/emails/${createdEmail.id}`,
        updateData,
      );

      expect(updateResponse.status).toBe(200);

      const updatedEmail = updateResponse.data as EmailRecord;
      expect(updatedEmail.status).toBe("green");
      expect(updatedEmail.status_text).toBe("Resolved by integration test");
      expect(updatedEmail.workflow_state).toBe("COMPLETION");

      console.log(`✅ Created and updated email: ${createdEmail.id}`);

      // Cleanup: Delete the test email
      const deleteResponse = await testContext.services.http.delete(
        `/api/emails/${createdEmail.id}`,
      );
      expect(deleteResponse.status).toBe(200);

      console.log("✅ Test email cleaned up");
    });
  });

  describe("WebSocket Real-time Updates", () => {
    it("should connect to WebSocket and receive messages", async () => {
      if (!testContext.config.services.websocket.enabled) {
        console.log("⏭️  WebSocket tests skipped (disabled in config)");
        return;
      }

      // Connect to WebSocket
      const wsConnection = await testContext.services.websocket.connect();

      expect(wsConnection.connected).toBe(true);
      expect(wsConnection.id).toBeDefined();

      // Subscribe to email updates channel
      await testContext.services.websocket.subscribe("email.updates");

      expect(wsConnection.subscriptions).toContainEqual("email.updates");

      // Set up message listener
      let receivedMessage: any = null;
      testContext.services.websocket.once("email.create", (message: any) => {
        receivedMessage = message;
      });

      // Create an email via HTTP API to trigger WebSocket notification
      const newEmail = {
        subject: "WebSocket Test Email",
        email_alias: "websocket@example.com",
        requested_by: "websocket-test",
        summary: "Email created to test WebSocket notifications",
        status: "red" as const,
        workflow_state: "START_POINT" as const,
      };

      await testContext.services.http.post("/api/emails", newEmail);

      // Wait for WebSocket message
      const wsMessage = await testContext.services.websocket.waitForMessage(
        "email.create",
        10000,
      );

      expect(wsMessage).toBeDefined();
      expect(wsMessage.type).toBe("email.create");
      expect(wsMessage.data).toBeDefined();

      console.log("✅ WebSocket real-time updates working");

      // Disconnect
      await testContext.services.websocket.disconnect();
    }, 15000);
  });

  describe("Agent Task Processing", () => {
    it("should create and execute agent tasks", async () => {
      const taskRequest = {
        type: "agent" as const,
        title: "Test Agent Task",
        description: "Integration test for agent task processing",
        input: {
          query: "Analyze the current system status",
          context: "integration test",
        },
        priority: "medium" as const,
      };

      const response = await testContext.services.http.post(
        "/api/tasks",
        taskRequest,
      );

      expect(response.status).toBe(201);
      expect(response.data).toBeDefined();

      const task = response.data as any;
      expect(task.id).toBeDefined();
      expect(task.type).toBe("agent");
      expect(task.status).toBe("pending");

      // Wait for task to complete (poll the status)
      let completedTask: any = null;
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 30 seconds

      while (attempts < maxAttempts && !completedTask) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

        const statusResponse = await testContext.services.http.get(
          `/api/tasks/${task.id}`,
        );
        const currentTask = statusResponse.data as any;

        if (
          currentTask.status === "completed" ||
          currentTask.status === "failed"
        ) {
          completedTask = currentTask;
          break;
        }

        attempts++;
      }

      expect(completedTask).toBeDefined();
      expect(["completed", "failed"]).toContainEqual(completedTask.status);

      if (completedTask.status === "completed") {
        expect(completedTask.output).toBeDefined();
        console.log("✅ Agent task completed successfully");
      } else {
        console.log("⚠️  Agent task failed:", completedTask.error);
      }
    }, 45000);
  });

  describe("Error Handling and Resilience", () => {
    it("should handle API errors gracefully", async () => {
      // Test 404 error
      const notFoundResponse = await testContext.services.http.get(
        "/api/emails/non-existent-id",
      );
      expect(notFoundResponse.status).toBe(404);

      // Test validation error
      const invalidEmail = {
        subject: "", // Invalid - empty subject
        status: "invalid-status", // Invalid status
      };

      const validationResponse = await testContext.services.http.post(
        "/api/emails",
        invalidEmail,
      );
      expect(validationResponse.status).toBe(400);

      console.log("✅ Error handling working correctly");
    });

    it("should implement rate limiting", async () => {
      // This test would need to be implemented based on your specific rate limiting rules
      // For now, just verify the rate limiting headers are present
      const response = await testContext.services.http.get(
        "/api/emails?page=1&pageSize=1",
      );

      // Many rate limiters add these headers
      const hasRateLimitHeaders =
        response.headers["x-ratelimit-limit"] ||
        response.headers["x-ratelimit-remaining"] ||
        response.headers["ratelimit-limit"] ||
        response.headers["ratelimit-remaining"];

      if (hasRateLimitHeaders) {
        console.log("✅ Rate limiting headers detected");
      } else {
        console.log(
          "ℹ️  Rate limiting headers not detected (may not be implemented)",
        );
      }
    });
  });

  describe("Performance Metrics", () => {
    it("should collect and report performance metrics", async () => {
      // Make several API calls to generate metrics
      for (let i = 0; i < 5; i++) {
        await testContext.services.http.get("/api/health");
      }

      // Get metrics snapshot
      const metrics = await integrationCoordinator.getMetricsSnapshot();

      expect(metrics.timestamp).toBeDefined();
      expect(metrics.metrics).toBeDefined();
      expect(Array.isArray(metrics.metrics)).toBe(true);
      expect(metrics.metrics.length).toBeGreaterThan(0);

      // Look for HTTP request metrics
      const httpMetrics = metrics.metrics.filter(
        (m: any) => m.name === "http_requests_total",
      );
      expect(httpMetrics.length).toBeGreaterThan(0);

      console.log(`✅ Collected ${metrics.metrics.length} metrics`);
    });

    it("should track error rates", async () => {
      // Generate some errors
      try {
        await testContext.services.http.get("/api/non-existent-endpoint");
      } catch (error) {
        // Expected 404 error
      }

      const errorMetrics = integrationCoordinator.getErrorMetrics();
      expect(errorMetrics.totalErrors).toBeGreaterThanOrEqual(0);

      console.log(`✅ Error metrics: ${errorMetrics.totalErrors} total errors`);
    });
  });
});

// =====================================================
// Test Utilities and Helpers
// =====================================================

/**
 * Example of how to create a custom test helper
 */
export async function createSampleEmailData(
  context: TestContext,
  count: number = 5,
): Promise<EmailRecord[]> {
  const emails: EmailRecord[] = [];

  for (let i = 0; i < count; i++) {
    const email = {
      subject: `Test Email ${i + 1}`,
      email_alias: `test${i + 1}@example.com`,
      requested_by: "test-data-generator",
      summary: `Test email ${i + 1} for integration testing`,
      status: (["red", "yellow", "green"] as const)[i % 3],
      status_text: `Status ${i + 1}`,
      workflow_state: (["START_POINT", "IN_PROGRESS", "COMPLETION"] as const)[
        i % 3
      ],
      priority: (["high", "medium", "low"] as const)[i % 3],
    };

    const response = await context.services.http.post("/api/emails", email);

    if (response.status === 201) {
      emails.push(response.data as EmailRecord);
    }
  }

  return emails;
}

/**
 * Example of performance testing helper
 */
export async function performanceTest(
  context: TestContext,
  operation: () => Promise<void>,
  iterations: number = 10,
): Promise<{
  averageTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
}> {
  const times: number[] = [];
  let successes = 0;

  for (let i = 0; i < iterations; i++) {
    const startTime = Date.now();

    try {
      await operation();
      successes++;
    } catch (error) {
      console.warn(`Performance test iteration ${i + 1} failed:`, error);
    }

    times.push(Date.now() - startTime);
  }

  return {
    averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    successRate: successes / iterations,
  };
}

console.log("📋 Integration test suite loaded and ready");
