/**
 * Centralized Database Mock for Unit Tests
 * Provides consistent database mocking across all test files
 */

import { vi } from "vitest";

// Create a shared mock database instance that can be used across tests
export const mockDb = {
  prepare: vi.fn().mockReturnValue({
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
    get: vi.fn().mockReturnValue({
      id: 1,
      subject: "Test Email",
      sender: "test@example.com",
      status: "pending",
      created_at: new Date().toISOString(),
      internet_message_id: "test-message-id",
      sender_email: "test@example.com",
      recipient_emails: "recipient@example.com",
      received_date_time: new Date().toISOString(),
      body_content: "Test email body content",
      conversation_id: "test-conversation-id",
    }),
    all: vi.fn().mockReturnValue([
      {
        id: 1,
        subject: "Test Email",
        sender: "test@example.com",
        status: "pending",
        created_at: new Date().toISOString(),
        internet_message_id: "test-message-id",
        sender_email: "test@example.com",
        recipient_emails: "recipient@example.com",
        received_date_time: new Date().toISOString(),
        body_content: "Test email body content",
        conversation_id: "test-conversation-id",
      },
    ]),
    iterate: vi.fn().mockReturnValue({
      [Symbol.iterator]: function* () {
        yield {
          id: 1,
          subject: "Test Email",
          sender: "test@example.com",
          status: "pending",
          created_at: new Date().toISOString(),
          internet_message_id: "test-message-id",
          sender_email: "test@example.com",
          recipient_emails: "recipient@example.com",
          received_date_time: new Date().toISOString(),
          body_content: "Test email body content",
          conversation_id: "test-conversation-id",
        };
      },
    }),
  }),
  exec: vi.fn(),
  close: vi.fn(),
  pragma: vi.fn(),
  transaction: vi.fn((fn: any) => fn()),
  inTransaction: false,
  function: vi.fn(),
  aggregate: vi.fn(),
  backup: vi.fn(),
  serialize: vi.fn(),
  loadExtension: vi.fn(),
  defaultSafeIntegers: vi.fn(),
  unsafeMode: vi.fn(),
};

// Create factory function for database instances
export const createMockDatabase = () => {
  return vi.fn(() => mockDb);
};

// Export the database constructor mock
export const databaseMockModule = {
  default: createMockDatabase(),
};

// Connection pool mock functions that use the shared mockDb
export const mockConnectionPool = {
  getDatabaseConnection: vi.fn(),
  executeQuery: vi.fn((callback: any) => callback(mockDb)),
  executeTransaction: vi.fn((callback: any) => callback(mockDb)),
};

// Helper to reset all database mocks
export const resetDatabaseMocks = () => {
  // Reset the shared mockDb
  Object.values(mockDb).forEach((mock: any) => {
    if (typeof mock === "function" && "mockClear" in mock) {
      mock.mockClear();
    }
  });
  
  // Reset connection pool mocks
  Object.values(mockConnectionPool).forEach((mock: any) => {
    if (typeof mock === "function" && "mockClear" in mock) {
      mock.mockClear();
    }
  });
};

// Export the mockDb for use in individual test files
export { mockDb as default };