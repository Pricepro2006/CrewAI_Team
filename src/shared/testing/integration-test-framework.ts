/**
 * Integration Testing Framework
 * Comprehensive testing utilities for real end-to-end API tests
 */

import type {
  ApiResponse,
  Timestamp,
  BaseEntity,
  WebSocketMessage,
} from "../types/index.js";

// =====================================================
// Test Configuration and Setup
// =====================================================

export interface TestConfig {
  baseUrl: string;
  websocketUrl: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  cleanup: boolean;
  database: DatabaseTestConfig;
  services: ServiceTestConfig;
  authentication: AuthTestConfig;
  monitoring: MonitoringTestConfig;
}

export interface DatabaseTestConfig {
  resetBetweenTests: boolean;
  seedData: boolean;
  useTransactions: boolean;
  isolationLevel:
    | "READ_UNCOMMITTED"
    | "READ_COMMITTED"
    | "REPEATABLE_READ"
    | "SERIALIZABLE";
}

export interface ServiceTestConfig {
  ollama: {
    enabled: boolean;
    mockResponses: boolean;
    baseUrl?: string;
  };
  chromadb: {
    enabled: boolean;
    mockResponses: boolean;
    baseUrl?: string;
  };
  websocket: {
    enabled: boolean;
    autoConnect: boolean;
    timeout: number;
  };
}

export interface AuthTestConfig {
  defaultUser: TestUser;
  adminUser: TestUser;
  guestUser: TestUser;
  tokenExpiration: number;
}

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  role: string;
  permissions: string[];
}

export interface MonitoringTestConfig {
  metricsEnabled: boolean;
  tracingEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  collectCoverage: boolean;
}

// =====================================================
// Test Context and State Management
// =====================================================

export interface TestContext {
  config: TestConfig;
  session: TestSession;
  database: TestDatabase;
  services: TestServices;
  fixtures: TestFixtures;
  metrics: TestMetrics;
}

export interface TestSession {
  id: string;
  startedAt: Timestamp;
  user?: TestUser;
  authToken?: string;
  websocketConnection?: TestWebSocketConnection;
  cleanup: CleanupTask[];
}

export interface TestDatabase {
  connection: unknown; // Database connection
  transaction?: unknown; // Current transaction
  seedData: Map<string, unknown[]>;
  createdEntities: Map<string, string[]>; // table -> ids
}

export interface TestServices {
  ollama: TestServiceClient;
  chromadb: TestServiceClient;
  websocket: TestWebSocketClient;
  http: TestHttpClient;
}

export interface TestServiceClient {
  baseUrl: string;
  connected: boolean;
  mockMode: boolean;
  requestHistory: ServiceRequest[];
  responseHistory: ServiceResponse[];
}

export interface ServiceRequest {
  timestamp: Timestamp;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface ServiceResponse {
  timestamp: Timestamp;
  status: number;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
}

export interface TestFixtures {
  users: TestUser[];
  conversations: TestConversation[];
  messages: TestMessage[];
  tasks: TestTask[];
  documents: TestDocument[];
  emails: TestEmail[];
}

export interface TestMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalDuration: number;
  coverage: CoverageReport;
  performance: PerformanceReport;
}

// =====================================================
// HTTP Client for API Testing
// =====================================================

export interface TestHttpClient {
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  timeout: number;
  retries: number;
  interceptors: RequestInterceptor[];

  // HTTP methods
  request<T = unknown>(config: RequestConfig): Promise<TestResponse<T>>;
  get<T = unknown>(
    url: string,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>>;
  post<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>>;
  put<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>>;
  patch<T = unknown>(
    url: string,
    body?: unknown,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>>;
  delete<T = unknown>(
    url: string,
    config?: Partial<RequestConfig>,
  ): Promise<TestResponse<T>>;

  // Auth methods
  setAuthToken(token: string): void;
  clearAuthToken(): void;
}

export interface RequestInterceptor {
  request?: (config: RequestConfig) => Promise<RequestConfig>;
  response?: (response: TestResponse) => Promise<TestResponse>;
  error?: (error: TestError) => Promise<TestError>;
}

export interface RequestConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  params?: Record<string, unknown>;
  body?: unknown;
  timeout?: number;
  retries?: number;
  validateStatus?: (status: number) => boolean;
}

export interface TestResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  duration: number;
  requestId?: string;
}

export interface TestError extends Error {
  code: string;
  status?: number;
  response?: TestResponse;
  request?: RequestConfig;
  isTimeout: boolean;
  isNetworkError: boolean;
}

// =====================================================
// WebSocket Testing Client
// =====================================================

export interface TestWebSocketClient {
  url: string;
  connection?: TestWebSocketConnection;
  autoReconnect: boolean;
  reconnectAttempts: number;
  messageQueue: QueuedMessage[];
  eventHandlers: Map<string, EventHandler[]>;
}

export interface TestWebSocketConnection {
  id: string;
  connected: boolean;
  connectedAt: Timestamp;
  lastActivity: Timestamp;
  sentMessages: WebSocketMessage[];
  receivedMessages: WebSocketMessage[];
  subscriptions: string[];
  metadata: Record<string, unknown>;
}

export interface QueuedMessage {
  message: WebSocketMessage;
  queuedAt: Timestamp;
  attempts: number;
  maxAttempts: number;
}

export interface EventHandler {
  handler: (message: WebSocketMessage) => Promise<void>;
  once: boolean;
  timeout?: number;
}

// =====================================================
// Test Assertions and Matchers
// =====================================================

export interface TestAssertions<T = unknown> {
  // Value assertions
  toBe(expected: T): TestAssertions<T>;
  toEqual(expected: T): TestAssertions<T>;
  toStrictEqual(expected: T): TestAssertions<T>;
  toBeNull(): TestAssertions<T>;
  toBeUndefined(): TestAssertions<T>;
  toBeDefined(): TestAssertions<T>;
  toBeTruthy(): TestAssertions<T>;
  toBeFalsy(): TestAssertions<T>;

  // Type assertions
  toBeInstanceOf(constructor: new (...args: any[]) => any): TestAssertions<T>;
  toBeTypeOf(type: string): TestAssertions<T>;

  // Number assertions
  toBeGreaterThan(expected: number): TestAssertions<T>;
  toBeGreaterThanOrEqual(expected: number): TestAssertions<T>;
  toBeLessThan(expected: number): TestAssertions<T>;
  toBeLessThanOrEqual(expected: number): TestAssertions<T>;
  toBeCloseTo(expected: number, precision?: number): TestAssertions<T>;
  toBeNaN(): TestAssertions<T>;

  // String assertions
  toContain(expected: string): TestAssertions<T>;
  toStartWith(expected: string): TestAssertions<T>;
  toEndWith(expected: string): TestAssertions<T>;
  toMatch(regexp: RegExp): TestAssertions<T>;
  toHaveLength(length: number): TestAssertions<T>;

  // Array/Object assertions
  toContainEqual(expected: unknown): TestAssertions<T>;
  toHaveProperty(path: string, value?: unknown): TestAssertions<T>;

  // API-specific assertions
  toHaveStatus(status: number): TestAssertions<TestResponse>;
  toHaveHeader(name: string, value?: string): TestAssertions<TestResponse>;
  toHaveResponseTime(maxTime: number): TestAssertions<TestResponse>;
  toMatchSchema(schema: unknown): TestAssertions<T>;

  // WebSocket assertions
  toHaveReceivedMessage(
    eventType: string,
  ): TestAssertions<TestWebSocketConnection>;
  toHaveSubscription(channel: string): TestAssertions<TestWebSocketConnection>;

  // Database assertions
  toExistInDatabase(
    table: string,
    conditions: Record<string, unknown>,
  ): TestAssertions<T>;
  toHaveCount(table: string, count: number): TestAssertions<T>;

  // Negation
  not: TestAssertions<T>;
}

// =====================================================
// Test Fixtures and Data Generation
// =====================================================

export interface TestDataGenerator<T = unknown> {
  generate(): T;
  generateMany(count: number): T[];
  generateWith(overrides: Partial<T>): T;
  generateSequence(
    count: number,
    sequencer: (index: number) => Partial<T>,
  ): T[];
}

export interface TestConversation extends BaseEntity {
  title: string;
  participantIds: string[];
  messageCount: number;
  status: "active" | "archived";
}

export interface TestMessage extends BaseEntity {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  userId: string;
}

export interface TestTask extends BaseEntity {
  type: "agent" | "tool" | "composite";
  title: string;
  status: "pending" | "running" | "completed" | "failed";
  priority: "low" | "medium" | "high";
  assignedTo?: string;
}

export interface TestDocument extends BaseEntity {
  title: string;
  content: string;
  sourceId: string;
  author: string;
  chunkCount: number;
}

export interface TestEmail extends BaseEntity {
  subject: string;
  sender: string;
  recipient: string;
  status: "red" | "yellow" | "green";
  priority: "high" | "medium" | "low";
}

// =====================================================
// Performance Testing
// =====================================================

export interface PerformanceTest {
  name: string;
  description: string;
  setup: () => Promise<void>;
  execute: (context: TestContext) => Promise<PerformanceResult>;
  teardown: () => Promise<void>;
  thresholds: PerformanceThresholds;
}

export interface PerformanceThresholds {
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  throughput: {
    minimum: number; // requests per second
    target: number;
  };
  errorRate: {
    maximum: number; // percentage
  };
  resourceUsage: {
    memory: number; // MB
    cpu: number; // percentage
  };
}

export interface PerformanceResult {
  duration: number;
  requestCount: number;
  errorCount: number;
  throughput: number;
  responseTimeStats: ResponseTimeStats;
  resourceUsage: ResourceUsage;
  errors: PerformanceError[];
}

export interface ResponseTimeStats {
  min: number;
  max: number;
  average: number;
  median: number;
  p95: number;
  p99: number;
  distribution: number[];
}

export interface ResourceUsage {
  memory: MemoryUsage;
  cpu: CpuUsage;
  network: NetworkUsage;
  disk: DiskUsage;
}

export interface MemoryUsage {
  used: number;
  peak: number;
  average: number;
  timeline: MemorySnapshot[];
}

export interface MemorySnapshot {
  timestamp: Timestamp;
  used: number;
  free: number;
  buffers: number;
  cached: number;
}

export interface CpuUsage {
  average: number;
  peak: number;
  timeline: CpuSnapshot[];
}

export interface CpuSnapshot {
  timestamp: Timestamp;
  usage: number;
  load: number[];
}

export interface NetworkUsage {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
  connections: number;
}

export interface DiskUsage {
  reads: number;
  writes: number;
  bytesRead: number;
  bytesWritten: number;
  iops: number;
}

export interface PerformanceError {
  timestamp: Timestamp;
  type: string;
  message: string;
  responseTime?: number;
  statusCode?: number;
}

// =====================================================
// Load Testing
// =====================================================

export interface LoadTest extends PerformanceTest {
  scenarios: LoadScenario[];
  rampUp: RampUpStrategy;
  duration: number;
  virtualUsers: number;
}

export interface LoadScenario {
  name: string;
  weight: number;
  steps: LoadTestStep[];
  thinkTime: number;
  iterations?: number;
  dataSet?: unknown[];
}

export interface LoadTestStep {
  name: string;
  request: RequestConfig;
  validation?: ValidationRule[];
  extraction?: ExtractionRule[];
  thinkTime?: number;
}

export interface ValidationRule {
  type: "status" | "header" | "body" | "response_time" | "custom";
  condition: string;
  expected: unknown;
  message?: string;
}

export interface ExtractionRule {
  name: string;
  type: "json" | "regex" | "header" | "cookie";
  expression: string;
  scope: "user" | "test";
}

export interface RampUpStrategy {
  type: "linear" | "exponential" | "step" | "instant";
  stages: RampUpStage[];
}

export interface RampUpStage {
  duration: number;
  target: number;
  name?: string;
}

// =====================================================
// Coverage and Quality Metrics
// =====================================================

export interface CoverageReport {
  overall: CoverageStats;
  files: FileCoverage[];
  functions: FunctionCoverage[];
  lines: LineCoverage[];
  branches: BranchCoverage[];
}

export interface CoverageStats {
  total: number;
  covered: number;
  percentage: number;
  threshold: number;
  passed: boolean;
}

export interface FileCoverage {
  path: string;
  lines: CoverageStats;
  functions: CoverageStats;
  branches: CoverageStats;
  statements: CoverageStats;
}

export interface FunctionCoverage {
  name: string;
  file: string;
  line: number;
  covered: boolean;
  hitCount: number;
}

export interface LineCoverage {
  line: number;
  file: string;
  covered: boolean;
  hitCount: number;
}

export interface BranchCoverage {
  line: number;
  file: string;
  total: number;
  covered: number;
  branches: boolean[];
}

export interface PerformanceReport {
  summary: PerformanceSummary;
  endpoints: EndpointPerformance[];
  resources: ResourcePerformance;
  trends: PerformanceTrend[];
}

export interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  throughput: number;
  errorRate: number;
  slowestEndpoint: string;
  fastestEndpoint: string;
}

export interface EndpointPerformance {
  path: string;
  method: string;
  requestCount: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number;
}

export interface ResourcePerformance {
  memory: ResourceStats;
  cpu: ResourceStats;
  database: DatabaseStats;
  cache: CacheStats;
}

export interface ResourceStats {
  average: number;
  peak: number;
  minimum: number;
  timeline: number[];
}

export interface DatabaseStats {
  connections: ResourceStats;
  queryTime: ResourceStats;
  slowQueries: SlowQuery[];
}

export interface SlowQuery {
  query: string;
  executionTime: number;
  timestamp: Timestamp;
  parameters?: unknown[];
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  size: number;
  operations: CacheOperation[];
}

export interface CacheOperation {
  operation: "get" | "set" | "delete" | "clear";
  key: string;
  hit: boolean;
  responseTime: number;
  timestamp: Timestamp;
}

export interface PerformanceTrend {
  metric: string;
  period: string;
  values: number[];
  trend: "improving" | "degrading" | "stable";
  changePercentage: number;
}

// =====================================================
// Test Execution and Reporting
// =====================================================

export interface TestSuite {
  name: string;
  description: string;
  tags: string[];
  timeout: number;
  parallel: boolean;
  retries: number;
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
  beforeEach?: (context: TestContext) => Promise<void>;
  afterEach?: (context: TestContext) => Promise<void>;
  tests: TestCase[];
}

export interface TestCase {
  name: string;
  description: string;
  tags: string[];
  timeout: number;
  retries: number;
  skip: boolean;
  only: boolean;
  execute: (context: TestContext) => Promise<void>;
}

export interface TestResult {
  suite: string;
  test: string;
  status: "passed" | "failed" | "skipped" | "timeout";
  duration: number;
  error?: TestError;
  assertions: AssertionResult[];
  logs: TestLog[];
  screenshots: string[];
  metadata: Record<string, unknown>;
}

export interface AssertionResult {
  description: string;
  passed: boolean;
  actual: unknown;
  expected: unknown;
  operator: string;
  stack?: string;
}

export interface TestLog {
  timestamp: Timestamp;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface TestReport {
  summary: TestSummary;
  results: TestResult[];
  coverage: CoverageReport;
  performance: PerformanceReport;
  environment: TestEnvironment;
  metadata: TestReportMetadata;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  successRate: number;
  flakyTests: string[];
  slowestTests: string[];
}

export interface TestEnvironment {
  platform: string;
  version: string;
  nodeVersion: string;
  dependencies: Record<string, string>;
  configuration: Record<string, unknown>;
}

export interface TestReportMetadata {
  generatedAt: Timestamp;
  generatedBy: string;
  version: string;
  branch: string;
  commit: string;
  buildNumber?: string;
  tags: string[];
}

// =====================================================
// Cleanup and Teardown
// =====================================================

export interface CleanupTask {
  name: string;
  priority: number;
  cleanup: () => Promise<void>;
  rollback?: () => Promise<void>;
}

export interface CleanupManager {
  tasks: CleanupTask[];
  executed: boolean;
  execute(): Promise<CleanupResult[]>;
  register(task: CleanupTask): void;
  clear(): void;
}

export interface CleanupResult {
  taskName: string;
  success: boolean;
  duration: number;
  error?: Error;
}
