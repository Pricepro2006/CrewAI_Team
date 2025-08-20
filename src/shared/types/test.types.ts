// Shared TypeScript test type definitions
// This file provides proper type definitions to replace all 'any' usage in tests

import { Request, Response } from 'express';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';

// Generic test utilities
export type TestCallback = () => void | Promise<void>;
export type TestAssertion<T> = (result: T) => void;
export type MockFunction<T extends (...args: unknown[]) => unknown> = jest.MockedFunction<T>;

// Mock HTTP types
export interface MockRequest extends Partial<Request> {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  user?: Record<string, unknown>;
  session?: Record<string, unknown>;
}

export interface MockResponse extends Partial<Response> {
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(body?: Record<string, unknown>) => MockResponse>;
  send: jest.MockedFunction<(body?: unknown) => MockResponse>;
  end: jest.MockedFunction<() => MockResponse>;
  setHeader: jest.MockedFunction<(name: string, value: string) => MockResponse>;
}

// WebSocket test types
export interface MockWebSocket extends Partial<WebSocket> {
  send: jest.MockedFunction<(data: string | Buffer) => void>;
  close: jest.MockedFunction<(code?: number, reason?: string) => void>;
  ping: jest.MockedFunction<(data?: Buffer) => void>;
  pong: jest.MockedFunction<(data?: Buffer) => void>;
  readyState: number;
  url?: string;
}

export interface WebSocketTestMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

// Database test types
export interface MockDatabaseResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  command: string;
}

export interface DatabaseTestFixture {
  id: string | number;
  [key: string]: unknown;
}

// Redis/Queue test types
export interface MockRedisClient {
  get: jest.MockedFunction<(key: string) => Promise<string | null>>;
  set: jest.MockedFunction<(key: string, value: string, ...args: unknown[]) => Promise<string>>;
  del: jest.MockedFunction<(key: string | string[]) => Promise<number>>;
  exists: jest.MockedFunction<(key: string) => Promise<number>>;
  expire: jest.MockedFunction<(key: string, seconds: number) => Promise<number>>;
  flushall: jest.MockedFunction<() => Promise<string>>;
  quit: jest.MockedFunction<() => Promise<string>>;
}

export interface QueueTestJob<T = Record<string, unknown>> {
  id: string | number;
  data: T;
  opts: {
    delay?: number;
    attempts?: number;
    priority?: number;
  };
}

// Email processing test types
export interface EmailTestData {
  id: string;
  subject: string;
  body: string;
  from: string;
  to: string[];
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface EmailProcessingResult {
  emailId: string;
  phase1Results?: Record<string, unknown>;
  phase2Results?: Record<string, unknown>;
  phase3Results?: Record<string, unknown>;
  chainId?: string;
  isCompleteChain: boolean;
}

// Agent system test types
export interface AgentTestConfig {
  id: string;
  name: string;
  capabilities: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export interface AgentTaskResult {
  taskId: string;
  agentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: Error;
}

// Monitoring and metrics test types
export interface PerformanceTestMetrics {
  duration: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  metadata: Record<string, unknown>;
}

// Walmart/Grocery test types
export interface GroceryProductTestData {
  id: string;
  name: string;
  price: number;
  category: string;
  availability: boolean;
  metadata: Record<string, unknown>;
}

export interface OrderTestData {
  id: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  timestamp: Date;
}

// JWT and authentication test types
export interface JWTTestPayload {
  sub: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export interface AuthTestUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

// tRPC test types
export interface TRPCTestContext {
  user?: AuthTestUser;
  session?: Record<string, unknown>;
  req?: MockRequest;
  res?: MockResponse;
}

export type TRPCTestInput<T = Record<string, unknown>> = T;
export type TRPCTestOutput<T = Record<string, unknown>> = T;

// Error handling test types
export interface TestError extends Error {
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// Utility test types
export type TestTimeout = NodeJS.Timeout;
export type TestPromise<T = unknown> = Promise<T>;
export type TestEventHandler<T = unknown> = (data: T) => void;

// Generic mock factory types
export type MockFactory<T> = () => T;
export type PartialMock<T> = Partial<T> & Record<string, unknown>;

// Common test data generators
export interface TestDataGenerator<T> {
  single: () => T;
  multiple: (count: number) => T[];
  withOverrides: (overrides: Partial<T>) => T;
}

// Integration test types
export interface IntegrationTestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  cleanup: boolean;
}

// Performance test types
export interface PerformanceTestConfig {
  iterations: number;
  warmupRuns: number;
  maxExecutionTime: number;
  memoryThreshold: number;
}

// Validation helpers
export function isValidTestData<T>(data: unknown): data is T {
  return data !== null && data !== undefined && typeof data === 'object';
}

export function assertTestResult<T>(result: unknown): asserts result is T {
  if (!isValidTestData(result)) {
    throw new Error('Invalid test result');
  }
}