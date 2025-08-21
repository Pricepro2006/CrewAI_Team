/**
 * Centralized Logger Mock for Unit Tests
 * This ensures consistent logger mocking across all test files
 * Supports both constructor pattern and singleton pattern
 */

import { vi } from "vitest";

// Create the mock logger instance with all methods
export const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  agentActivity: vi.fn(),
  systemHealth: vi.fn(),
  llmCall: vi.fn(),
  ragQuery: vi.fn(),
  toolExecution: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  setPIIRedaction: vi.fn(),
  containsPII: vi.fn().mockReturnValue(false),
  getPIIRedactor: vi.fn().mockReturnValue({
    redact: vi.fn((text: any) => text),
    redactObject: vi.fn((obj: any) => obj),
    containsPII: vi.fn().mockReturnValue(false),
  }),
};

// Create Logger constructor that supports both patterns:
// new Logger("component") and Logger.getInstance()
export const MockLogger = vi.fn().mockImplementation((component?: string) => {
  // Return a new instance with the component stored but same interface
  return {
    ...mockLoggerInstance,
    component: component || "default",
    // Override methods to include component context if needed
    info: vi.fn((message: string, comp?: string, metadata?: any) => {
      mockLoggerInstance.info(message, comp || component, metadata);
    }),
    error: vi.fn((message: string, comp?: string, metadata?: any, error?: Error) => {
      mockLoggerInstance.error(message, comp || component, metadata, error);
    }),
    warn: vi.fn((message: string, comp?: string, metadata?: any) => {
      mockLoggerInstance.warn(message, comp || component, metadata);
    }),
    debug: vi.fn((message: string, comp?: string, metadata?: any) => {
      mockLoggerInstance.debug(message, comp || component, metadata);
    }),
    fatal: vi.fn((message: string, comp?: string, metadata?: any, error?: Error) => {
      mockLoggerInstance.fatal(message, comp || component, metadata, error);
    }),
  };
});

// Add static methods for singleton pattern
(MockLogger as any).getInstance = vi.fn().mockReturnValue(mockLoggerInstance);

// LogLevel enum mock
export const MockLogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

// Create the complete logger module mock
export const loggerMockModule = {
  // Default export structure
  default: {
    Logger: MockLogger,
    logger: mockLoggerInstance,
    LogLevel: MockLogLevel,
    createErrorHandler: vi.fn(() => vi.fn()),
    createPerformanceMonitor: vi.fn(() => ({
      start: vi.fn(() => ({ end: vi.fn() })),
    })),
    withErrorHandling: vi.fn((fn: any) => fn),
  },
  // Named exports
  Logger: MockLogger,
  logger: mockLoggerInstance,
  LogLevel: MockLogLevel,
  createErrorHandler: vi.fn(() => vi.fn()),
  createPerformanceMonitor: vi.fn(() => ({
    start: vi.fn(() => ({ end: vi.fn() })),
  })),
  withErrorHandling: vi.fn((fn: any) => fn),
};

// Export everything that might be imported
export { MockLogger as Logger };
export { mockLoggerInstance as logger };
export { MockLogLevel as LogLevel };
export const createErrorHandler = vi.fn(() => vi.fn());
export const createPerformanceMonitor = vi.fn(() => ({
  start: vi.fn(() => ({ end: vi.fn() })),
}));
export const withErrorHandling = vi.fn((fn: any) => fn);