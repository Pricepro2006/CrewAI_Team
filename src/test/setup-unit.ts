/**
 * Unit Test Setup - Enhanced with Timeout Fixes
 * 
 * This setup file provides comprehensive mocking for external services
 * to prevent timeout issues in unit tests.
 */

import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Global timeout configuration
vi.setConfig({ 
  testTimeout: 15000, // 15 seconds for complex unit tests
  hookTimeout: 8000   // 8 seconds for setup/teardown
});

// Mock external services globally to prevent network calls
vi.mock('axios', () => {
  const mockAxiosInstance = {
    post: vi.fn().mockResolvedValue({
      status: 200,
      data: { response: 'Mocked response' }
    }),
    get: vi.fn().mockResolvedValue({
      status: 200,
      data: { data: 'Mocked data' }
    }),
    put: vi.fn().mockResolvedValue({
      status: 200,
      data: { success: true }
    }),
    delete: vi.fn().mockResolvedValue({
      status: 200,
      data: { deleted: true }
    }),
    patch: vi.fn().mockResolvedValue({
      status: 200,
      data: { updated: true }
    }),
    request: vi.fn().mockResolvedValue({
      status: 200,
      data: { result: 'success' }
    })
  };

  return {
    default: {
      ...mockAxiosInstance,
      create: vi.fn().mockReturnValue(mockAxiosInstance),
      isAxiosError: vi.fn().mockReturnValue(false)
    },
    // Named exports
    create: vi.fn().mockReturnValue(mockAxiosInstance),
    isAxiosError: vi.fn().mockReturnValue(false)
  };
});

// Mock Ollama client to prevent real LLM calls
vi.mock('ollama', () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({
      response: 'Mocked Ollama response',
      done: true,
      context: [],
      total_duration: 1000000,
      load_duration: 500000,
      prompt_eval_count: 10,
      prompt_eval_duration: 300000,
      eval_count: 20,
      eval_duration: 200000
    }),
    chat: vi.fn().mockResolvedValue({
      message: {
        role: 'assistant',
        content: 'Mocked chat response'
      },
      done: true
    }),
    list: vi.fn().mockResolvedValue({
      models: [
        {
          name: 'llama3.2:3b',
          model: 'llama3.2:3b',
          size: 2000000000,
          digest: 'mock-digest'
        }
      ]
    }),
    show: vi.fn().mockResolvedValue({
      license: 'Mock license',
      modelfile: 'Mock modelfile',
      parameters: {},
      template: 'Mock template'
    })
  }))
}));

// Mock Redis to prevent real Redis connections
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(0),
    flushall: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(), 
    emit: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    // Connection status
    status: 'ready',
    readyState: 'ready'
  })),
  Redis: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(0),
    flushall: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    // Event emitter methods
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    // Connection status  
    status: 'ready',
    readyState: 'ready'
  }))
}));

// Mock BullMQ to prevent real queue operations
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    getWaiting: vi.fn().mockResolvedValue([]),
    getActive: vi.fn().mockResolvedValue([]),
    getCompleted: vi.fn().mockResolvedValue([]),
    getFailed: vi.fn().mockResolvedValue([]),
    isPaused: vi.fn().mockResolvedValue(false),
    close: vi.fn().mockResolvedValue(undefined)
  })),
  Worker: vi.fn().mockImplementation(() => ({
    run: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined)
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

// Mock ChromaDB to prevent real vector database calls
vi.mock('chromadb', async () => {
  // Create a mock Collection with all required methods
  const createMockCollection = (name: string = 'mock-collection') => ({
    name,
    metadata: {
      description: 'Mock collection',
      created_at: new Date().toISOString(),
    },
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue({
      ids: [['mock-id-1', 'mock-id-2']],
      documents: [['Mock document content 1', 'Mock document content 2']],
      metadatas: [[{ source: 'mock', type: 'test' }, { source: 'mock', type: 'test' }]],
      distances: [[0.3, 0.7]],
      embeddings: null
    }),
    get: vi.fn().mockResolvedValue({
      ids: ['mock-id-1', 'mock-id-2'],
      documents: ['Mock document content 1', 'Mock document content 2'],
      metadatas: [{ source: 'mock', type: 'test' }, { source: 'mock', type: 'test' }],
      embeddings: null
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    count: vi.fn().mockResolvedValue(2),
    peek: vi.fn().mockResolvedValue({
      ids: ['mock-id-1'],
      documents: ['Mock document content'],
      metadatas: [{ source: 'mock' }]
    }),
    modify: vi.fn().mockResolvedValue(undefined)
  });

  // Mock ChromaClient class
  class MockChromaClient {
    constructor(config = {}) {
      // Store config if needed
      this.config = config;
    }

    // Connection methods
    async version() {
      return '0.4.0';
    }

    async heartbeat() {
      return Date.now();
    }

    // Collection management methods
    async createCollection({ name, metadata } = {}) {
      return createMockCollection(name);
    }

    async getCollection({ name } = {}) {
      return createMockCollection(name);
    }

    async getOrCreateCollection({ name, metadata } = {}) {
      return createMockCollection(name);
    }

    async listCollections() {
      return [
        { name: 'knowledge_base', metadata: {} },
        { name: 'email_content', metadata: {} }
      ];
    }

    async deleteCollection({ name } = {}) {
      return undefined;
    }

    // Database/tenant methods
    async reset() {
      return undefined;
    }
  }

  return {
    // Main ChromaClient export
    ChromaClient: MockChromaClient,
    
    // Type exports (these are just for TypeScript, will be undefined at runtime but that's ok)
    Collection: undefined,
    
    // Legacy API support
    ChromaApi: MockChromaClient,
    
    // Default export for compatibility
    default: MockChromaClient
  };
});

// Mock WebSocket to prevent real WebSocket connections
vi.mock('ws', () => ({
  WebSocket: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    readyState: 1 // OPEN
  })),
  default: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    readyState: 1
  }))
}));

// Mock file system operations for faster tests
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises') as any;
  return {
    default: {
      readFile: vi.fn().mockResolvedValue('Mock file content'),
      writeFile: vi.fn().mockResolvedValue(undefined),  
      unlink: vi.fn().mockResolvedValue(undefined),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue(['mock-file.txt']),
      stat: vi.fn().mockResolvedValue({
        isFile: () => true,
        isDirectory: () => false,
        size: 1024
      }),
      access: vi.fn().mockResolvedValue(undefined),
      copyFile: vi.fn().mockResolvedValue(undefined),
      rmdir: vi.fn().mockResolvedValue(undefined)
    },
    // Named exports
    readFile: vi.fn().mockResolvedValue('Mock file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(['mock-file.txt']),
    stat: vi.fn().mockResolvedValue({
      isFile: () => true,
      isDirectory: () => false,
      size: 1024
    }),
    access: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined)
  };
});

// Mock express-rate-limit to prevent rate limiting in tests
vi.mock('express-rate-limit', () => ({
  default: vi.fn().mockImplementation(() => (req: any, res: any, next: any) => next()),
  rateLimit: vi.fn().mockImplementation(() => (req: any, res: any, next: any) => next())
}));

// Mock database connections
vi.mock('better-sqlite3', () => ({
  default: vi.fn().mockImplementation(() => ({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: vi.fn().mockReturnValue(null),
      all: vi.fn().mockReturnValue([])
    }),
    exec: vi.fn(),
    close: vi.fn(),
    pragma: vi.fn().mockReturnValue([])
  }))
}));

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset any global state
  process.env.NODE_ENV = 'test';
  process.env.DISABLE_EXTERNAL_APIS = 'true';
});

afterEach(() => {
  // Clean up after each test
  vi.clearAllTimers();
  vi.restoreAllMocks();
});

// Mock DOM methods not available in jsdom
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Add helpful test utilities
global.createMockResponse = (data: any, status = 200) => ({
  status,
  data,
  headers: {},
  config: {},
  statusText: 'OK'
});

global.createMockPromise = <T>(value: T, delay = 0) => {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(value), delay);
  });
};

// Mock setTimeout and setInterval for faster tests
global.fastTimeout = (callback: () => void, delay: number) => {
  // Reduce delays to speed up tests
  const fastDelay = Math.min(delay, 100);
  return setTimeout(callback, fastDelay);
};

global.fastInterval = (callback: () => void, delay: number) => {
  // Reduce intervals to speed up tests
  const fastDelay = Math.min(delay, 100);
  return setInterval(callback, fastDelay);
};

// Console log filtering for cleaner test output
const originalConsole = { ...console };
console.log = (...args) => {
  // Filter out noisy logs during tests
  const message = args.join(' ');
  if (
    !message.includes('Redis not available') &&
    !message.includes('Ollama not available') &&
    !message.includes('Skipping test')
  ) {
    originalConsole.log(...args);
  }
};

export {};