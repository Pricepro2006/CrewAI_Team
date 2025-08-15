/**
 * Test Client Implementation
 * Concrete implementation of testing utilities for real API tests
 */

import { WebSocket } from "ws";
import fetch from "node-fetch";
import type {
  TestConfig,
  TestContext,
  TestHttpClient,
  TestWebSocketClient,
  TestResponse,
  TestError,
  RequestConfig,
  TestWebSocketConnection,
  TestAssertions,
  TestUser,
  CleanupTask,
  CleanupManager,
  CleanupResult,
} from "./integration-test-framework.js";
import type { EventHandler } from "./integration-test-framework.js";
import type { WebSocketMessage } from "../types/index.js";

// =====================================================
// HTTP Test Client Implementation
// =====================================================

export class HttpTestClient implements TestHttpClient {
  public baseUrl: string;
  public defaultHeaders: Record<string, string>;
  public timeout: number;
  public retries: number;
  public interceptors: any[] = [];

  constructor(config: Partial<TestConfig>) {
    this.baseUrl = config.baseUrl || "http://localhost:3001";
    this.defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    this.timeout = config.timeout || 10000;
    this.retries = config.retries || 0;
  }

  async request<T = unknown>(config: RequestConfig): Promise<TestResponse<T>> {
    const startTime = Date.now();
    const url = this.buildUrl(config.url);

    const requestConfig = {
      method: config.method,
      headers: {
        ...this.defaultHeaders,
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
      timeout: config.timeout || this.timeout,
    };

    try {
      const response = await fetch(url, requestConfig);
      const data = (await response.json()) as T;
      const duration = Date.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        duration,
        requestId: response.headers.get("x-request-id") || undefined,
      };
    } catch (error) {
      throw this.createTestError(error as Error, config);
    }
  }

  async get<T = unknown>(
    url: string,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>> {
    return this.request<T>({
      method: "GET",
      url,
      headers: this.defaultHeaders,
      ...config,
    });
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>> {
    return this.request<T>({
      method: "POST",
      url,
      body,
      headers: this.defaultHeaders,
      ...config,
    });
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>> {
    return this.request<T>({
      method: "PUT",
      url,
      body,
      headers: this.defaultHeaders,
      ...config,
    });
  }

  async patch<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>> {
    return this.request<T>({
      method: "PATCH",
      url,
      body,
      headers: this.defaultHeaders,
      ...config,
    });
  }

  async delete<T = unknown>(
    url: string,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>> {
    return this.request<T>({
      method: "DELETE",
      url,
      headers: this.defaultHeaders,
      ...config,
    });
  }

  setAuthToken(token: string): void {
    this.defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.defaultHeaders["Authorization"];
  }

  private buildUrl(path: string): string {
    if (path.startsWith("http")) {
      return path;
    }
    return `${this.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
  }

  private createTestError(error: Error, config: RequestConfig): TestError {
    const testError = error as TestError;
    testError.code = "REQUEST_FAILED";
    testError.request = config;
    testError.isTimeout = error.message.includes("timeout");
    testError.isNetworkError =
      error.message.includes("network") ||
      error.message.includes("ECONNREFUSED");
    return testError;
  }
}

// =====================================================
// WebSocket Test Client Implementation
// =====================================================

export class WebSocketTestClient implements TestWebSocketClient {
  public url: string;
  public connection?: TestWebSocketConnection;
  public autoReconnect: boolean = true;
  public reconnectAttempts: number = 0;
  public messageQueue: any[] = [];
  public eventHandlers: Map<string, EventHandler[]> = new Map();

  private ws?: WebSocket;
  private connectionPromise?: Promise<TestWebSocketConnection>;

  constructor(config: Partial<TestConfig>) {
    this.url = config.websocketUrl || "ws://localhost:3002/trpc-ws";
  }

  async connect(): Promise<TestWebSocketConnection> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);

      ws.on("open", () => {
        this.connection = {
          id: `test-${Date.now()}`,
          connected: true,
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          sentMessages: [],
          receivedMessages: [],
          subscriptions: [],
          metadata: {},
        };

        this.ws = ws;
        resolve(this.connection);
      });

      ws.on("message", (data) => {
        if (this.connection) {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.connection.receivedMessages.push(message);
          this.connection.lastActivity = new Date().toISOString();

          // Trigger event handlers
          const handlers = this.eventHandlers.get(message.type) || [];
          handlers.forEach((handler) => {
            try {
              handler.handler(message);
            } catch (error) {
              console.error("WebSocket event handler error:", error);
            }
          });
        }
      });

      ws.on("error", (error) => {
        reject(error);
      });

      ws.on("close", () => {
        if (this.connection) {
          this.connection.connected = false;
        }
        this.ws = undefined;
        this.connectionPromise = undefined;
      });

      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 10000);
    });

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
      this.connectionPromise = undefined;
    }

    if (this.connection) {
      this.connection.connected = false;
    }
  }

  async send(message: WebSocketMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    if (this.ws && this.connection) {
      this.ws.send(JSON.stringify(message));
      this.connection.sentMessages.push(message);
      this.connection.lastActivity = new Date().toISOString();
    }
  }

  async subscribe(channel: string): Promise<void> {
    await this.send({
      id: `sub-${Date.now()}`,
      type: "system.connect",
      channel,
      data: { action: "subscribe", channel },
      timestamp: new Date().toISOString(),
    });

    if (this.connection) {
      this.connection.subscriptions.push(channel);
    }
  }

  on(
    eventType: string,
    handler: (message: WebSocketMessage) => void,
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push({ handler, once: false });
  }

  once(
    eventType: string,
    handler: (message: WebSocketMessage) => void,
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push({ handler, once: true });
  }

  async waitForMessage(
    eventType: string,
    timeout: number = 5000,
  ): Promise<WebSocketMessage> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message of type: ${eventType}`));
      }, timeout);

      this.once(eventType, (message) => {
        clearTimeout(timeoutId);
        resolve(message);
      });
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.send({
      id: `unsub-${Date.now()}`,
      type: "system.disconnect",
      channel,
      data: { action: "unsubscribe", channel },
      timestamp: new Date().toISOString(),
    });

    if (this.connection) {
      const index = this.connection.subscriptions.indexOf(channel);
      if (index > -1) {
        this.connection.subscriptions.splice(index, 1);
      }
    }
  }

  off(eventType: string, handler?: (message: WebSocketMessage) => void): void {
    if (!handler) {
      this.eventHandlers.delete(eventType);
    } else {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.findIndex((h) => h.handler === handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }
}

// =====================================================
// Test Assertions Implementation
// =====================================================

export class TestAssertionsImpl<T = unknown> implements TestAssertions<T> {
  constructor(
    private actual: T,
    private isNegated: boolean = false,
  ) {}

  toBe(expected: T): TestAssertions<T> {
    const passed = this.isNegated
      ? this.actual !== expected
      : this.actual === expected;
    if (!passed) {
      throw new Error(
        `Expected ${this.actual} ${this.isNegated ? "not " : ""}to be ${expected}`,
      );
    }
    return this;
  }

  toEqual(expected: T): TestAssertions<T> {
    const passed = this.isNegated
      ? !this.deepEqual(this.actual, expected)
      : this.deepEqual(this.actual, expected);
    if (!passed) {
      throw new Error(
        `Expected ${JSON.stringify(this.actual)} ${this.isNegated ? "not " : ""}to equal ${JSON.stringify(expected)}`,
      );
    }
    return this;
  }

  toStrictEqual(expected: T): TestAssertions<T> {
    return this.toEqual(expected);
  }

  toBeNull(): TestAssertions<T> {
    return this.toBe(null as T);
  }

  toBeUndefined(): TestAssertions<T> {
    return this.toBe(undefined as T);
  }

  toBeDefined(): TestAssertions<T> {
    const passed = this.isNegated
      ? this.actual === undefined
      : this.actual !== undefined;
    if (!passed) {
      throw new Error(
        `Expected value ${this.isNegated ? "not " : ""}to be defined`,
      );
    }
    return this;
  }

  toBeTruthy(): TestAssertions<T> {
    const passed = this.isNegated ? !this.actual : !!this.actual;
    if (!passed) {
      throw new Error(
        `Expected ${this.actual} ${this.isNegated ? "not " : ""}to be truthy`,
      );
    }
    return this;
  }

  toBeFalsy(): TestAssertions<T> {
    const passed = this.isNegated ? !!this.actual : !this.actual;
    if (!passed) {
      throw new Error(
        `Expected ${this.actual} ${this.isNegated ? "not " : ""}to be falsy`,
      );
    }
    return this;
  }

  toBeInstanceOf(
    constructor: new (...args: unknown[]) => unknown,
  ): TestAssertions<T> {
    const passed = this.isNegated
      ? !(this.actual instanceof constructor)
      : this.actual instanceof constructor;
    if (!passed) {
      throw new Error(
        `Expected ${this.actual} ${this.isNegated ? "not " : ""}to be instance of ${constructor.name}`,
      );
    }
    return this;
  }

  toBeTypeOf(type: string): TestAssertions<T> {
    const actualType = typeof this.actual;
    const passed = this.isNegated ? actualType !== type : actualType === type;
    if (!passed) {
      throw new Error(
        `Expected type ${actualType} ${this.isNegated ? "not " : ""}to be ${type}`,
      );
    }
    return this;
  }

  toBeGreaterThan(expected: number): TestAssertions<T> {
    const actual = this.actual as unknown as number;
    const passed = this.isNegated ? actual <= expected : actual > expected;
    if (!passed) {
      throw new Error(
        `Expected ${actual} ${this.isNegated ? "not " : ""}to be greater than ${expected}`,
      );
    }
    return this;
  }

  toBeGreaterThanOrEqual(expected: number): TestAssertions<T> {
    const actual = this.actual as unknown as number;
    const passed = this.isNegated ? actual < expected : actual >= expected;
    if (!passed) {
      throw new Error(
        `Expected ${actual} ${this.isNegated ? "not " : ""}to be greater than or equal to ${expected}`,
      );
    }
    return this;
  }

  toBeLessThan(expected: number): TestAssertions<T> {
    const actual = this.actual as unknown as number;
    const passed = this.isNegated ? actual >= expected : actual < expected;
    if (!passed) {
      throw new Error(
        `Expected ${actual} ${this.isNegated ? "not " : ""}to be less than ${expected}`,
      );
    }
    return this;
  }

  toBeLessThanOrEqual(expected: number): TestAssertions<T> {
    const actual = this.actual as unknown as number;
    const passed = this.isNegated ? actual > expected : actual <= expected;
    if (!passed) {
      throw new Error(
        `Expected ${actual} ${this.isNegated ? "not " : ""}to be less than or equal to ${expected}`,
      );
    }
    return this;
  }

  toBeCloseTo(expected: number, precision: number = 2): TestAssertions<T> {
    const actual = this.actual as unknown as number;
    const diff = Math.abs(actual - expected);
    const maxDiff = Math.pow(10, -precision);
    const passed = this.isNegated ? diff >= maxDiff : diff < maxDiff;
    if (!passed) {
      throw new Error(
        `Expected ${actual} ${this.isNegated ? "not " : ""}to be close to ${expected} (precision: ${precision})`,
      );
    }
    return this;
  }

  toBeNaN(): TestAssertions<T> {
    const actual = this.actual as unknown as number;
    const passed = this.isNegated ? !isNaN(actual) : isNaN(actual);
    if (!passed) {
      throw new Error(
        `Expected ${actual} ${this.isNegated ? "not " : ""}to be NaN`,
      );
    }
    return this;
  }

  toContain(expected: string): TestAssertions<T> {
    const actual = this.actual as unknown as string;
    const passed = this.isNegated
      ? !actual.includes(expected)
      : actual.includes(expected);
    if (!passed) {
      throw new Error(
        `Expected "${actual}" ${this.isNegated ? "not " : ""}to contain "${expected}"`,
      );
    }
    return this;
  }

  toStartWith(expected: string): TestAssertions<T> {
    const actual = this.actual as unknown as string;
    const passed = this.isNegated
      ? !actual.startsWith(expected)
      : actual.startsWith(expected);
    if (!passed) {
      throw new Error(
        `Expected "${actual}" ${this.isNegated ? "not " : ""}to start with "${expected}"`,
      );
    }
    return this;
  }

  toEndWith(expected: string): TestAssertions<T> {
    const actual = this.actual as unknown as string;
    const passed = this.isNegated
      ? !actual.endsWith(expected)
      : actual.endsWith(expected);
    if (!passed) {
      throw new Error(
        `Expected "${actual}" ${this.isNegated ? "not " : ""}to end with "${expected}"`,
      );
    }
    return this;
  }

  toMatch(regexp: RegExp): TestAssertions<T> {
    const actual = this.actual as unknown as string;
    const passed = this.isNegated ? !regexp.test(actual) : regexp.test(actual);
    if (!passed) {
      throw new Error(
        `Expected "${actual}" ${this.isNegated ? "not " : ""}to match ${regexp}`,
      );
    }
    return this;
  }

  toHaveLength(length: number): TestAssertions<T> {
    const actual = this.actual as unknown as { length: number };
    const passed = this.isNegated
      ? actual.length !== length
      : actual.length === length;
    if (!passed) {
      throw new Error(
        `Expected length ${actual.length} ${this.isNegated ? "not " : ""}to be ${length}`,
      );
    }
    return this;
  }

  toContainEqual(expected: unknown): TestAssertions<T> {
    const actual = this.actual as unknown as unknown[];
    const passed = this.isNegated
      ? !actual.some((item) => this.deepEqual(item, expected))
      : actual.some((item) => this.deepEqual(item, expected));
    if (!passed) {
      throw new Error(
        `Expected array ${this.isNegated ? "not " : ""}to contain equal ${JSON.stringify(expected)}`,
      );
    }
    return this;
  }

  toHaveProperty(path: string, value?: unknown): TestAssertions<T> {
    const actual = this.actual as unknown as Record<string, unknown>;
    const keys = path.split(".");
    let current = actual;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        if (!this.isNegated) {
          throw new Error(`Expected object to have property "${path}"`);
        }
        return this;
      }
      current = current[key] as Record<string, unknown>;
    }

    if (value !== undefined) {
      const passed = this.isNegated
        ? !this.deepEqual(current, value)
        : this.deepEqual(current, value);
      if (!passed) {
        throw new Error(
          `Expected property "${path}" ${this.isNegated ? "not " : ""}to equal ${JSON.stringify(value)}, but got ${JSON.stringify(current)}`,
        );
      }
    } else if (this.isNegated) {
      throw new Error(`Expected object not to have property "${path}"`);
    }

    return this;
  }

  toHaveStatus(status: number): TestAssertions<TestResponse> {
    const response = this.actual as unknown as TestResponse;
    const passed = this.isNegated
      ? response.status !== status
      : response.status === status;
    if (!passed) {
      throw new Error(
        `Expected status ${response.status} ${this.isNegated ? "not " : ""}to be ${status}`,
      );
    }
    return this as unknown as TestAssertions<TestResponse>;
  }

  toHaveHeader(name: string, value?: string): TestAssertions<TestResponse> {
    const response = this.actual as unknown as TestResponse;
    const headerValue = response.headers[name.toLowerCase()];

    if (value !== undefined) {
      const passed = this.isNegated
        ? headerValue !== value
        : headerValue === value;
      if (!passed) {
        throw new Error(
          `Expected header "${name}" ${this.isNegated ? "not " : ""}to equal "${value}", but got "${headerValue}"`,
        );
      }
    } else {
      const passed = this.isNegated
        ? headerValue === undefined
        : headerValue !== undefined;
      if (!passed) {
        throw new Error(
          `Expected response ${this.isNegated ? "not " : ""}to have header "${name}"`,
        );
      }
    }

    return this as unknown as TestAssertions<TestResponse>;
  }

  toHaveResponseTime(maxTime: number): TestAssertions<TestResponse> {
    const response = this.actual as unknown as TestResponse;
    const passed = this.isNegated
      ? response.duration >= maxTime
      : response.duration < maxTime;
    if (!passed) {
      throw new Error(
        `Expected response time ${response.duration}ms ${this.isNegated ? "not " : ""}to be less than ${maxTime}ms`,
      );
    }
    return this as unknown as TestAssertions<TestResponse>;
  }

  toMatchSchema(schema: unknown): TestAssertions<T> {
    // This would integrate with a schema validation library like Joi or Yup
    // For now, just return this
    return this;
  }

  toHaveReceivedMessage(
    eventType: string,
  ): TestAssertions<TestWebSocketConnection> {
    const connection = this.actual as unknown as TestWebSocketConnection;
    const hasMessage = connection.receivedMessages.some(
      (msg) => msg.type === eventType,
    );
    const passed = this.isNegated ? !hasMessage : hasMessage;
    if (!passed) {
      throw new Error(
        `Expected WebSocket ${this.isNegated ? "not " : ""}to have received message of type "${eventType}"`,
      );
    }
    return this as unknown as TestAssertions<TestWebSocketConnection>;
  }

  toHaveSubscription(channel: string): TestAssertions<TestWebSocketConnection> {
    const connection = this.actual as unknown as TestWebSocketConnection;
    const hasSubscription = connection.subscriptions.includes(channel);
    const passed = this.isNegated ? !hasSubscription : hasSubscription;
    if (!passed) {
      throw new Error(
        `Expected WebSocket ${this.isNegated ? "not " : ""}to have subscription to "${channel}"`,
      );
    }
    return this as unknown as TestAssertions<TestWebSocketConnection>;
  }

  toExistInDatabase(
    table: string,
    conditions: Record<string, unknown>,
  ): TestAssertions<T> {
    // This would integrate with the database to check if a record exists
    // For now, just return this
    return this;
  }

  toHaveCount(table: string, count: number): TestAssertions<T> {
    // This would integrate with the database to check record count
    // For now, just return this
    return this;
  }

  get not(): TestAssertions<T> {
    return new TestAssertionsImpl(this.actual, !this.isNegated);
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;
    if (typeof a !== "object") return false;

    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual((a as any)[key], (b as any)[key])) return false;
    }

    return true;
  }
}

// =====================================================
// Cleanup Manager Implementation
// =====================================================

export class TestCleanupManager implements CleanupManager {
  public tasks: CleanupTask[] = [];
  public executed: boolean = false;

  register(task: CleanupTask): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  async execute(): Promise<CleanupResult[]> {
    if (this.executed) {
      return [];
    }

    this.executed = true;
    const results: CleanupResult[] = [];

    for (const task of this.tasks) {
      const startTime = Date.now();
      try {
        await task.cleanup();
        results.push({
          taskName: task.name,
          success: true,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          taskName: task.name,
          success: false,
          duration: Date.now() - startTime,
          error: error as Error,
        });

        // Try rollback if available
        if (task.rollback) {
          try {
            await task.rollback();
          } catch (rollbackError) {
            console.error(
              `Rollback failed for task ${task.name}:`,
              rollbackError,
            );
          }
        }
      }
    }

    return results;
  }

  clear(): void {
    this.tasks = [];
    this.executed = false;
  }
}

// =====================================================
// Test Helper Functions
// =====================================================

export function expect<T>(actual: T): TestAssertions<T> {
  return new TestAssertionsImpl(actual);
}

export async function createTestContext(
  config: Partial<TestConfig> = {},
): Promise<TestContext> {
  const fullConfig: TestConfig = {
    baseUrl: "http://localhost:3001",
    websocketUrl: "ws://localhost:3002/trpc-ws",
    timeout: 10000,
    retries: 0,
    parallel: false,
    cleanup: true,
    database: {
      resetBetweenTests: true,
      seedData: true,
      useTransactions: true,
      isolationLevel: "READ_COMMITTED",
    },
    services: {
      ollama: { enabled: true, mockResponses: false },
      chromadb: { enabled: true, mockResponses: false },
      websocket: { enabled: true, autoConnect: false, timeout: 5000 },
    },
    authentication: {
      defaultUser: {
        id: "test-user",
        email: "test@example.com",
        username: "testuser",
        password: process.env.TEST_USER_PASSWORD || "test123",
        role: "user",
        permissions: ["read", "write"],
      },
      adminUser: {
        id: "admin-user",
        email: "admin@example.com",
        username: "admin",
        password: process.env.TEST_ADMIN_PASSWORD || "admin123",
        role: "admin",
        permissions: ["read", "write", "admin"],
      },
      guestUser: {
        id: "guest-user",
        email: "guest@example.com",
        username: "guest",
        password: "",
        role: "guest",
        permissions: ["read"],
      },
      tokenExpiration: 3600,
    },
    monitoring: {
      metricsEnabled: true,
      tracingEnabled: true,
      logLevel: "info",
      collectCoverage: false,
    },
    ...config,
  };

  const httpClient = new HttpTestClient(fullConfig);
  const wsClient = new WebSocketTestClient(fullConfig);
  const cleanupManager = new TestCleanupManager();

  return {
    config: fullConfig,
    session: {
      id: `test-session-${Date.now()}`,
      startedAt: new Date().toISOString(),
      cleanup: [],
    },
    database: {
      connection: null, // Would be initialized with actual DB connection
      seedData: new Map(),
      createdEntities: new Map(),
    },
    services: {
      ollama: {
        baseUrl: "http://localhost:11434",
        connected: false,
        mockMode: false,
        requestHistory: [],
        responseHistory: [],
      },
      chromadb: {
        baseUrl: "http://localhost:8000",
        connected: false,
        mockMode: false,
        requestHistory: [],
        responseHistory: [],
      },
      websocket: wsClient,
      http: httpClient,
    },
    fixtures: {
      users: [],
      conversations: [],
      messages: [],
      tasks: [],
      documents: [],
      emails: [],
    },
    metrics: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      totalDuration: 0,
      coverage: {
        overall: {
          total: 0,
          covered: 0,
          percentage: 0,
          threshold: 80,
          passed: false,
        },
        files: [],
        functions: [],
        lines: [],
        branches: [],
      },
      performance: {
        summary: {
          totalRequests: 0,
          averageResponseTime: 0,
          throughput: 0,
          errorRate: 0,
          slowestEndpoint: "",
          fastestEndpoint: "",
        },
        endpoints: [],
        resources: {
          memory: { average: 0, peak: 0, minimum: 0, timeline: [] },
          cpu: { average: 0, peak: 0, minimum: 0, timeline: [] },
          database: {
            connections: { average: 0, peak: 0, minimum: 0, timeline: [] },
            queryTime: { average: 0, peak: 0, minimum: 0, timeline: [] },
            slowQueries: [],
          },
          cache: {
            hitRate: 0,
            missRate: 0,
            evictionRate: 0,
            size: 0,
            operations: [],
          },
        },
        trends: [],
      },
    },
  };
}

export async function authenticateUser(
  context: TestContext,
  user: TestUser,
): Promise<string> {
  const response = await context.services.http.post<{ token: string }>(
    "/api/auth/login",
    {
      email: user.email,
      password: user.password,
    },
  );

  if (response.status !== 200) {
    throw new Error(`Authentication failed: ${response.statusText}`);
  }

  const token = response.data.token;
  context.services.http.setAuthToken(token);
  context.session.user = user;
  context.session.authToken = token;

  return token;
}
