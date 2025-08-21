/**
 * Mock Factory for Common Test Patterns
 * Provides consistent mock objects across tests
 */

import { vi } from "vitest";

export const mockFactory = {
  // Create mock LLM service
  createMockLLMService: (overrides?: Partial<any>) => ({
    generate: vi.fn().mockResolvedValue({
      response: "Mock LLM response",
      model: "test-model",
    }),
    generateStream: vi.fn().mockImplementation(async function* () {
      yield { chunk: "Mock " };
      yield { chunk: "streaming " };
      yield { chunk: "response" };
    }),
    isAvailable: vi.fn().mockResolvedValue(true),
    getModels: vi.fn().mockResolvedValue(["test-model"]),
    ...overrides,
  }),

  // Create mock database service
  createMockDatabaseService: (overrides?: Partial<any>) => ({
    query: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({ changes: 1 }),
    delete: vi.fn().mockResolvedValue({ changes: 1 }),
    transaction: vi.fn((fn: any) => fn()),
    ...overrides,
  }),

  // Create mock email
  createMockEmail: (overrides?: Partial<any>) => ({
    id: 1,
    subject: "Test Email",
    sender: "test@example.com",
    recipients: ["recipient@example.com"],
    body: "Test email body",
    status: "pending",
    priority: "medium",
    created_at: new Date().toISOString(),
    ...overrides,
  }),

  // Create mock analysis result
  createMockAnalysisResult: (overrides?: Partial<any>) => ({
    workflow_state: "PENDING",
    business_process: "Order Management",
    intent: "Request",
    urgency_level: "Medium",
    entities: {
      po_numbers: [],
      quote_numbers: [],
      case_numbers: [],
      part_numbers: [],
      companies: [],
    },
    contextual_summary: "Mock analysis summary",
    action_items: [],
    suggested_response: "Mock suggested response",
    quality_score: 7.5,
    ...overrides,
  }),

  // Create mock agent result
  createMockAgentResult: (success = true, data?: any) => ({
    success,
    data: data || "Mock agent result",
    error: success ? undefined : "Mock error",
    metadata: {
      duration: 100,
      model: "test-model",
      tokens: { input: 50, output: 30 },
    },
  }),

  // Create mock WebSocket
  createMockWebSocket: () => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    
    return {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
      }),
      emit: vi.fn((event: string, ...args: any[]) => {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach((handler: any) => handler(...args));
        }
      }),
      disconnect: vi.fn(),
      connect: vi.fn(),
      connected: true,
    };
  },

  // Create mock Redis client
  createMockRedisClient: (overrides?: Partial<any>) => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    keys: vi.fn().mockResolvedValue([]),
    flushall: vi.fn().mockResolvedValue("OK"),
    ping: vi.fn().mockResolvedValue("PONG"),
    quit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }),
};