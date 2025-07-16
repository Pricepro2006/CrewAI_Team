import { beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs/promises";

// Database helpers
export function createTestDatabase(): Database.Database {
  const db = new Database(":memory:");

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
    
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      input TEXT,
      output TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  `);

  return db;
}

// Mock data generators
export function createMockConversation(overrides = {}) {
  return {
    id: "test-conversation-1",
    user_id: "test-user-1",
    title: "Test Conversation",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockMessage(overrides = {}) {
  return {
    id: "test-message-1",
    conversation_id: "test-conversation-1",
    role: "user",
    content: "Test message content",
    metadata: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockAgent(overrides = {}) {
  return {
    id: "test-agent-1",
    name: "TestAgent",
    type: "research",
    status: "idle",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTask(overrides = {}) {
  return {
    id: "test-task-1",
    agent_id: "test-agent-1",
    type: "research",
    status: "pending",
    input: JSON.stringify({ query: "test query" }),
    output: null,
    error: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

// Test fixtures
export async function createTestFixtures(dir: string) {
  const fixturesDir = path.join(dir, "fixtures");
  await fs.mkdir(fixturesDir, { recursive: true });

  // Create sample files
  await fs.writeFile(
    path.join(fixturesDir, "sample.txt"),
    "This is a sample test file.",
  );

  await fs.writeFile(
    path.join(fixturesDir, "data.json"),
    JSON.stringify({ test: true, data: [1, 2, 3] }, null, 2),
  );

  return fixturesDir;
}

// Cleanup helper
export async function cleanupTestFixtures(dir: string) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Mock timers helper
export function useFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers(),
    runPending: () => vi.runOnlyPendingTimers(),
  };
}

// API request helpers
export function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

export function createMockResponse() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

// Wait helper for async operations
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
