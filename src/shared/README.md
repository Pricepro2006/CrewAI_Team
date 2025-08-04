# CrewAI Team Integration Framework

## 🚀 Overview

This comprehensive integration framework provides a unified architecture for the CrewAI Team application, featuring type-safe APIs, real-time WebSocket communication, robust error handling, comprehensive monitoring, and production-ready testing infrastructure.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Type System](#type-system)
- [Testing Framework](#testing-framework)
- [Error Handling](#error-handling)
- [Monitoring & Observability](#monitoring--observability)
- [WebSocket Integration](#websocket-integration)
- [API Documentation](#api-documentation)
- [Best Practices](#best-practices)
- [Examples](#examples)

## ✨ Features

### 🎯 Core Features

- **Comprehensive Type System**: End-to-end TypeScript types for all system components
- **Integration Testing Framework**: Production-ready test suite with real API testing
- **Unified Error Handling**: Circuit breakers, retries, and comprehensive error reporting
- **Real-time WebSocket Architecture**: Type-safe WebSocket events and communication
- **Monitoring & Observability**: Metrics collection, health checks, and performance monitoring
- **API Documentation**: Auto-generated documentation with validation schemas

### 🔧 Technical Features

- **Circuit Breaker Pattern**: Automatic service failure handling
- **Retry Mechanisms**: Configurable retry strategies with exponential backoff
- **Rate Limiting**: Per-endpoint and global rate limiting
- **Health Monitoring**: Comprehensive service health checks
- **Performance Metrics**: Real-time performance and usage metrics
- **Security Integration**: Authentication, authorization, and input validation

## 🏗️ Architecture

```
src/shared/
├── types/              # Comprehensive type system
│   ├── index.ts       # Main type exports
│   ├── core.ts        # Core business types
│   ├── api.ts         # API and endpoint types
│   ├── websocket.ts   # WebSocket event types
│   ├── agents.ts      # Agent and task types
│   ├── email.ts       # Email system types
│   ├── database.ts    # Database and persistence types
│   ├── errors.ts      # Error handling types
│   └── monitoring.ts  # Monitoring types
├── testing/           # Integration testing framework
│   ├── integration-test-framework.ts
│   └── test-client.ts
├── errors/            # Error handling system
│   └── error-handler.ts
├── monitoring/        # Monitoring and observability
│   └── monitoring-system.ts
└── integration/       # Central coordination
    ├── coordinator.ts
    └── example-integration-test.ts
```

## 🚦 Quick Start

### 1. Initialize the Integration System

```typescript
import {
  initializeIntegration,
  getCoordinator,
} from "@/shared/integration/coordinator";

// Initialize with default configuration
await initializeIntegration();

// Or with custom configuration
await initializeIntegration({
  environment: "production",
  features: {
    email_dashboard: true,
    agent_coordination: true,
    websocket_updates: true,
  },
  // ... more config options
});

// Check system health
const health = await getCoordinator().getHealthStatus();
console.log(`System status: ${health.status}`);
```

### 2. Set Up Testing Environment

```typescript
import {
  createTestContext,
  authenticateUser,
} from "@/shared/integration/coordinator";

// Create test environment
const testContext = await createTestContext({
  baseUrl: "http://localhost:3001",
  timeout: 15000,
  cleanup: true,
});

// Authenticate test user
const token = await authenticateUser(testContext, {
  id: "test-user",
  email: "test@example.com",
  username: "testuser",
  password: "testpass",
  role: "user",
  permissions: ["read", "write"],
});

// Make API calls
const response = await testContext.services.http.get("/api/emails");
console.log(`Retrieved ${response.data.total} emails`);
```

### 3. Handle Errors with Circuit Breaker

```typescript
import { getCoordinator } from "@/shared/integration/coordinator";

const coordinator = getCoordinator();

// Execute operation with circuit breaker protection
const result = await coordinator.executeWithResilience("database", async () => {
  return await database.query("SELECT * FROM emails WHERE status = ?", ["red"]);
});
```

### 4. Record Metrics

```typescript
import { recordMetric } from "@/shared/integration/coordinator";

// Record HTTP request metrics
recordMetric("http", {
  method: "GET",
  route: "/api/emails",
  status: 200,
  duration: 150,
});

// Record agent task metrics
recordMetric("agent", {
  agentType: "EmailAnalysisAgent",
  status: "completed",
  duration: 5000,
});
```

## 📝 Type System

### Core Types

```typescript
import type {
  // Core business types
  Document,
  Message,
  Conversation,
  Task,

  // Email types
  EmailRecord,
  EmailStatus,
  EmailAssignment,

  // Agent types
  Agent,
  AgentTask,
  AgentPlan,

  // API types
  ApiResponse,
  PaginationResponse,

  // WebSocket types
  WebSocketMessage,
  WebSocketEventType,

  // Error types
  BaseError,
  ApiError,
  ValidationError,
} from "@/shared/types";
```

### Email System Example

```typescript
import type { EmailRecord, EmailFilter } from "@/shared/types/email";

// Create email filter
const filter: EmailFilter = {
  statuses: ["red", "yellow"],
  priorities: ["high", "critical"],
  dateRange: {
    start: "2024-01-01T00:00:00Z",
    end: "2024-12-31T23:59:59Z",
  },
  hasAttachments: true,
};

// Type-safe email record
const email: EmailRecord = {
  id: "email-123",
  subject: "Critical System Alert",
  email_alias: "alerts@company.com",
  status: "red",
  priority: "critical",
  // ... all other required fields are type-checked
};
```

### Agent Task Example

```typescript
import type {
  AgentTask,
  AgentTaskInput,
  TaskPriority,
} from "@/shared/types/agents";

const task: AgentTask = {
  id: "task-456",
  title: "Analyze Email Sentiment",
  type: "analysis",
  agentId: "agent-789",
  agentType: "EmailAnalysisAgent",
  status: "pending",
  priority: "high" as TaskPriority,
  input: {
    query: "Analyze sentiment of incoming emails",
    parameters: {
      emailIds: ["email-123", "email-124"],
      includeReasons: true,
    },
  },
  // ... TypeScript ensures all required fields are present
};
```

## 🧪 Testing Framework

### Integration Test Example

```typescript
import { expect, createTestContext } from "@/shared/integration/coordinator";

describe("Email API Integration", () => {
  let testContext: TestContext;

  beforeAll(async () => {
    testContext = await createTestContext({
      baseUrl: process.env.TEST_API_URL,
      timeout: 10000,
      cleanup: true,
    });
  });

  it("should create and retrieve emails", async () => {
    // Create email
    const newEmail = {
      subject: "Test Email",
      email_alias: "test@example.com",
      status: "yellow" as const,
      priority: "medium" as const,
    };

    const createResponse = await testContext.services.http.post(
      "/api/emails",
      newEmail,
    );

    // Assertions with custom matchers
    expect(createResponse).toHaveStatus(201);
    expect(createResponse).toHaveResponseTime(5000);
    expect(createResponse.data.subject).toBe("Test Email");

    // Retrieve and verify
    const getResponse = await testContext.services.http.get(
      `/api/emails/${createResponse.data.id}`,
    );
    expect(getResponse).toHaveStatus(200);
    expect(getResponse.data).toEqual(expect.objectContaining(newEmail));
  });

  it("should handle validation errors", async () => {
    const invalidEmail = { subject: "" }; // Invalid - missing required fields

    const response = await testContext.services.http.post(
      "/api/emails",
      invalidEmail,
    );
    expect(response).toHaveStatus(400);
    expect(response.data.error.code).toContain("VALIDATION");
  });
});
```

### Performance Testing

```typescript
import { performanceTest } from "@/shared/integration/example-integration-test";

const results = await performanceTest(
  testContext,
  () => testContext.services.http.get("/api/emails?page=1&pageSize=50"),
  100, // 100 iterations
);

console.log(`Average response time: ${results.averageTime}ms`);
console.log(`Success rate: ${results.successRate * 100}%`);
```

### WebSocket Testing

```typescript
it("should receive real-time email updates", async () => {
  const wsConnection = await testContext.services.websocket.connect();
  await testContext.services.websocket.subscribe("email.updates");

  // Create email via HTTP
  await testContext.services.http.post("/api/emails", newEmail);

  // Wait for WebSocket notification
  const message = await testContext.services.websocket.waitForMessage(
    "email.create",
    5000,
  );

  expect(message.type).toBe("email.create");
  expect(message.data).toMatchObject(newEmail);
});
```

## 🚨 Error Handling

### Built-in Error Types

```typescript
import {
  CrewAIError,
  CrewAIApiError,
  CrewAIValidationError,
  CrewAIBusinessError,
  CrewAISystemError,
  ERROR_CODES,
} from "@/shared/errors/error-handler";

// Create specific error types
const apiError = new CrewAIApiError(
  ERROR_CODES.INVALID_INPUT,
  "Invalid email format",
  400,
  { field: "email", value: "invalid-email" },
);

const businessError = new CrewAIBusinessError(
  ERROR_CODES.BUSINESS_RULE_VIOLATION,
  "Cannot assign email to inactive user",
  "email_management",
  "assign_email",
  true, // recoverable
  { userId: "user-123", emailId: "email-456" },
);
```

### Error Handler Registration

```typescript
import { globalErrorHandler } from "@/shared/errors/error-handler";

// Register custom error handler
globalErrorHandler.registerHandler({
  name: "custom-business-handler",
  priority: 95,
  canHandle: (error) => error.code.startsWith("BUSINESS_"),
  handle: async (error, context) => {
    // Custom handling logic
    await notifyBusinessTeam(error, context);

    return {
      handled: true,
      escalate: error.code.includes("CRITICAL"),
      notify: true,
      log: true,
    };
  },
});
```

### Circuit Breaker Usage

```typescript
import {
  CircuitBreaker,
  defaultCircuitBreakerConfig,
} from "@/shared/errors/error-handler";

const circuitBreaker = new CircuitBreaker({
  ...defaultCircuitBreakerConfig,
  failureThreshold: 3,
  resetTimeoutMs: 30000,
});

const result = await circuitBreaker.execute(async () => {
  return await externalApiCall();
});
```

## 📊 Monitoring & Observability

### Health Checks

```typescript
import { globalHealthMonitor } from "@/shared/monitoring/monitoring-system";

// Register custom health check
globalHealthMonitor.registerCheck({
  name: "email_service",
  description: "Email processing service health",
  timeout: 5000,
  interval: 30000,
  critical: true,
  check: async () => {
    const isHealthy = await checkEmailServiceHealth();
    return {
      status: isHealthy ? "healthy" : "unhealthy",
      responseTime: Date.now() - startTime,
      message: isHealthy ? "Service operational" : "Service down",
    };
  },
});

// Get overall health status
const health = await globalHealthMonitor.getOverallHealth();
```

### Metrics Collection

```typescript
import { globalMetricsCollector } from "@/shared/monitoring/monitoring-system";

// Register custom metric
globalMetricsCollector.registerMetric({
  name: "email_processing_duration",
  type: "histogram",
  description: "Time taken to process emails",
  labels: ["status", "category"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Record metric values
globalMetricsCollector.histogram("email_processing_duration", 2.5, {
  status: "success",
  category: "high_priority",
});

// Get metrics snapshot
const snapshot = await globalMetricsCollector.collectAll();
```

## 🔌 WebSocket Integration

### Event Types

```typescript
import type {
  WebSocketMessage,
  EmailEvent,
  TaskEvent,
  SystemEvent,
} from "@/shared/types/websocket";

// Email events
const emailCreateEvent: WebSocketMessage<EmailEvent> = {
  id: "msg-123",
  type: "email.create",
  channel: "email.updates",
  data: {
    emailId: "email-456",
    email: {
      /* email data */
    },
    action: "create",
    userId: "user-789",
  },
  timestamp: new Date().toISOString(),
};

// Task events
const taskProgressEvent: WebSocketMessage<TaskProgressEvent> = {
  id: "msg-124",
  type: "task.progress",
  channel: "task.updates",
  data: {
    taskId: "task-789",
    progress: {
      percentage: 75,
      currentStep: "Processing emails",
      totalSteps: 4,
      estimatedCompletion: "2024-01-01T12:30:00Z",
    },
  },
  timestamp: new Date().toISOString(),
};
```

### Server-Side WebSocket Setup

```typescript
import { WebSocketServer } from "ws";
import { createWebSocketHandler } from "@/shared/integration/websocket-handler";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
  const handler = createWebSocketHandler(ws, {
    authentication: true,
    authorization: ["user", "admin"],
    rateLimiting: {
      messagesPerMinute: 60,
      subscriptionsPerConnection: 10,
    },
  });

  // Handle client messages
  ws.on("message", async (data) => {
    const message = JSON.parse(data.toString()) as WebSocketMessage;
    await handler.handleMessage(message);
  });
});
```

### Client-Side WebSocket Usage

```typescript
import { WebSocketTestClient } from "@/shared/testing/test-client";

const wsClient = new WebSocketTestClient({ url: "ws://localhost:8080" });

// Connect and subscribe
await wsClient.connect();
await wsClient.subscribe("email.updates");

// Listen for events
wsClient.on("email.create", (message) => {
  console.log("New email created:", message.data.email);
  updateUI(message.data.email);
});

wsClient.on("email.update", (message) => {
  console.log("Email updated:", message.data.email);
  updateUI(message.data.email);
});
```

## 📚 API Documentation

### Endpoint Definition

```typescript
import type { EndpointDefinition } from "@/shared/types/api";
import { z } from "zod";

const listEmailsEndpoint: EndpointDefinition = {
  method: "GET",
  path: "/api/emails",
  summary: "List emails with filtering and pagination",
  description: "Retrieve a paginated list of emails with optional filtering",
  tags: ["emails"],
  schema: {
    query: z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      statuses: z.array(z.enum(["red", "yellow", "green"])).optional(),
      search: z.string().optional(),
    }),
    output: z.object({
      emails: z.array(EmailRecordSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  },
  responses: {
    200: {
      description: "Successfully retrieved emails",
      schema: EmailListResponseSchema,
    },
    400: {
      description: "Invalid query parameters",
      schema: ErrorResponseSchema,
    },
  },
  rateLimit: {
    requests: 100,
    windowMs: 60000,
  },
  cache: {
    ttl: 300, // 5 minutes
    tags: ["emails", "list"],
  },
};
```

### Auto-Generated Documentation

```typescript
import { generateApiDocs } from "@/shared/integration/api-docs-generator";

// Generate OpenAPI documentation
const apiDocs = await generateApiDocs({
  title: "CrewAI Team API",
  version: "1.0.0",
  description: "Comprehensive API for CrewAI Team management",
  baseUrl: "https://api.crewai-team.com",
  endpoints: [
    listEmailsEndpoint,
    createEmailEndpoint,
    updateEmailEndpoint,
    // ... more endpoints
  ],
  security: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
});

// Export to various formats
await apiDocs.exportToFile("./docs/api.json", "openapi");
await apiDocs.exportToFile("./docs/api.html", "redoc");
await apiDocs.exportToFile("./docs/postman.json", "postman");
```

## 🎯 Best Practices

### 1. Type Safety

```typescript
// ✅ Good: Use proper types
import type { EmailRecord, EmailFilter } from "@/shared/types/email";

async function searchEmails(filter: EmailFilter): Promise<EmailRecord[]> {
  // TypeScript ensures type safety
  return await api.get("/api/emails", { params: filter });
}

// ❌ Bad: Using any types
async function searchEmails(filter: any): Promise<any> {
  return await api.get("/api/emails", { params: filter });
}
```

### 2. Error Handling

```typescript
// ✅ Good: Proper error handling with types
import { CrewAIApiError, ERROR_CODES } from "@/shared/errors/error-handler";

try {
  const result = await processEmail(emailId);
  return result;
} catch (error) {
  if (error instanceof CrewAIApiError) {
    if (error.code === ERROR_CODES.RESOURCE_NOT_FOUND) {
      return { error: "Email not found", recoverable: false };
    }
  }

  throw error; // Re-throw unexpected errors
}

// ❌ Bad: Generic error handling
try {
  const result = await processEmail(emailId);
  return result;
} catch (error) {
  console.error("Something went wrong:", error);
  return null;
}
```

### 3. Testing

```typescript
// ✅ Good: Comprehensive integration test
describe("Email Management", () => {
  let testContext: TestContext;
  let testEmails: EmailRecord[] = [];

  beforeAll(async () => {
    testContext = await createTestContext();
    testEmails = await createSampleEmailData(testContext, 5);
  });

  afterAll(async () => {
    await cleanupTestData(testContext, testEmails);
  });

  it("should handle email lifecycle", async () => {
    // Test creation
    const newEmail = await createTestEmail(testContext);
    expect(newEmail.id).toBeDefined();

    // Test retrieval
    const retrieved = await getEmail(testContext, newEmail.id);
    expect(retrieved).toEqual(newEmail);

    // Test update
    const updated = await updateEmail(testContext, newEmail.id, {
      status: "green",
    });
    expect(updated.status).toBe("green");

    // Test deletion
    await deleteEmail(testContext, newEmail.id);

    // Verify deletion
    const getDeletedResponse = await testContext.services.http.get(
      `/api/emails/${newEmail.id}`,
    );
    expect(getDeletedResponse).toHaveStatus(404);
  });
});

// ❌ Bad: Incomplete test
it("should work", async () => {
  const response = await fetch("/api/emails");
  expect(response.ok).toBe(true);
});
```

### 4. Monitoring Integration

```typescript
// ✅ Good: Proper monitoring integration
import { recordMetric, getCoordinator } from "@/shared/integration/coordinator";

async function processEmailBatch(emails: EmailRecord[]) {
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const email of emails) {
      try {
        await processEmail(email);
        successCount++;
      } catch (error) {
        errorCount++;
        await getCoordinator().handleError(error, { emailId: email.id });
      }
    }

    // Record metrics
    recordMetric("email", {
      operation: "batch_process",
      duration: Date.now() - startTime,
      successCount,
      errorCount,
      batchSize: emails.length,
    });
  } catch (error) {
    recordMetric("email", {
      operation: "batch_process",
      duration: Date.now() - startTime,
      error: true,
    });
    throw error;
  }
}
```

## 📖 Examples

See the `src/shared/integration/example-integration-test.ts` file for a complete example that demonstrates:

- Full integration test setup
- Authentication flow testing
- API endpoint testing with real data
- WebSocket real-time communication testing
- Agent task processing testing
- Error handling verification
- Performance testing utilities
- Cleanup and teardown procedures

## 🔧 Configuration

### Environment Variables

```bash
# API Configuration
API_BASE_URL=http://localhost:3001
WEBSOCKET_URL=ws://localhost:3002/trpc-ws

# Database Configuration
DATABASE_URL=sqlite:./data/app.db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# LLM Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Vector Store Configuration (using llama3.2:3b for embeddings)
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=crewai-knowledge

# Security Configuration
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Monitoring Configuration
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
LOG_LEVEL=info

# Testing Configuration
TEST_BASE_URL=http://localhost:3001
TEST_WEBSOCKET_URL=ws://localhost:3002/trpc-ws
TEST_DATABASE_URL=sqlite::memory:
```

### Configuration File

```typescript
// config/integration.config.ts
import type { SystemConfig } from "@/shared/types";

export const integrationConfig: SystemConfig = {
  version: "1.0.0",
  environment: (process.env.NODE_ENV as any) || "development",

  features: {
    email_dashboard: true,
    agent_coordination: true,
    websocket_updates: true,
    performance_monitoring: true,
    error_reporting: true,
  },

  limits: {
    maxConcurrentTasks: 10,
    maxMessageLength: 50000,
    maxFileSize: 50 * 1024 * 1024,
    maxConversationLength: 1000,
    requestTimeout: 30000,

    rateLimits: {
      requests: { windowMs: 60000, maxRequests: 100 },
      uploads: { windowMs: 60000, maxRequests: 10 },
      websocket: { windowMs: 60000, maxRequests: 1000 },
      api: {},
    },
  },

  services: {
    database: {
      type: "sqlite",
      path: process.env.DATABASE_PATH || "./data/app.db",
    },

    llm: {
      provider: "ollama",
      baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.2:3b",
    },

    vectorStore: {
      type: "chromadb",
      url: process.env.CHROMA_URL || "http://localhost:8000",
      collection: "crewai-knowledge",
      dimension: 384,
    },

    websocket: {
      path: "/trpc-ws",
      cors: process.env.CORS_ORIGINS?.split(",") || ["http://localhost:3000"],
      heartbeat: 30000,
      maxConnections: 1000,

      messageQueue: {
        type: "memory",
        maxSize: 10000,
        strategy: "fifo",
        retryPolicy: {
          maxAttempts: 3,
          backoffMs: 1000,
          backoffMultiplier: 2,
          maxBackoffMs: 10000,
        },
      },
    },

    monitoring: {
      metrics: {
        enabled: process.env.METRICS_ENABLED === "true",
        interval: 30000,
        retention: 86400,
        aggregation: ["avg", "sum", "count"],
        exports: [],
      },

      logging: {
        level: (process.env.LOG_LEVEL as any) || "info",
        format: "json",
        outputs: [{ type: "console" }],
      },

      alerts: [],
    },
  },
};
```

## 🤝 Contributing

1. **Follow TypeScript Best Practices**: Use proper types, avoid `any`
2. **Write Comprehensive Tests**: Include unit, integration, and performance tests
3. **Document Your Changes**: Update README and inline documentation
4. **Use Error Handling**: Implement proper error handling with circuit breakers
5. **Add Monitoring**: Include metrics and health checks for new features
6. **Security First**: Validate inputs, sanitize outputs, follow security guidelines

## 📄 License

This integration framework is part of the CrewAI Team project and follows the same licensing terms.

---

## 🆘 Support

For questions, issues, or contributions:

1. **Documentation**: Check this README and inline code documentation
2. **Examples**: Review the example integration test for usage patterns
3. **Types**: Explore the comprehensive type definitions in `src/shared/types/`
4. **Tests**: Run the integration test suite to verify functionality
5. **Monitoring**: Check health endpoints and metrics for system status

---

**Built with ❤️ for production-ready, type-safe, and maintainable applications.**
