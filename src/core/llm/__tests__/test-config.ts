/**
 * Test Configuration for LLM Integration Tests
 * Provides environment-specific settings for different test scenarios
 */

export interface TestEnvironment {
  name: string;
  useMockServer: boolean;
  serverUrl: string;
  serverPort: number;
  modelPath?: string;
  timeout: number;
  retryAttempts: number;
}

export const TEST_ENVIRONMENTS: Record<string, TestEnvironment> = {
  // CI/CD environment - uses mock server
  ci: {
    name: 'CI/CD',
    useMockServer: true,
    serverUrl: 'http://localhost',
    serverPort: 8081,
    timeout: 5000,
    retryAttempts: 2
  },
  
  // Local development - uses real llama server
  local: {
    name: 'Local Development',
    useMockServer: false,
    serverUrl: 'http://localhost',
    serverPort: 8081,
    modelPath: process.env.LLAMA_MODEL_PATH || '/models/llama-3.2-3b.gguf',
    timeout: 30000,
    retryAttempts: 3
  },
  
  // Docker environment
  docker: {
    name: 'Docker',
    useMockServer: false,
    serverUrl: 'http://llama-server',
    serverPort: 8081,
    modelPath: '/models/llama-3.2-3b.gguf',
    timeout: 20000,
    retryAttempts: 3
  },
  
  // Integration testing
  integration: {
    name: 'Integration',
    useMockServer: false,
    serverUrl: process.env.LLAMA_SERVER_URL || 'http://localhost',
    serverPort: parseInt(process.env.LLAMA_SERVER_PORT || '8081'),
    modelPath: process.env.LLAMA_MODEL_PATH,
    timeout: 15000,
    retryAttempts: 2
  }
};

// Get current test environment
export function getTestEnvironment(): TestEnvironment {
  const envName = process.env.TEST_ENV || (process.env.CI ? 'ci' : 'local');
  return TEST_ENVIRONMENTS[envName as keyof typeof TEST_ENVIRONMENTS] || TEST_ENVIRONMENTS.local;
}

// Test data fixtures
export const TEST_DATA = {
  prompts: {
    simple: 'What is 2 + 2?',
    medium: 'Explain the concept of machine learning in one paragraph.',
    complex: `Analyze the following business email and extract key information:
      
      Subject: Urgent - Deal #45791720 Update Required
      
      Dear Team,
      
      We need to update the pricing for deal #45791720 for customer ACME Corporation.
      The following products need price adjustments:
      - Product ABC123: Increase by 5%
      - Product XYZ789: Decrease by 3%
      
      Please process this by end of day.
      
      Best regards,
      Sales Team`,
    
    streaming: 'Count from 1 to 10 slowly.',
    
    codeGeneration: 'Write a TypeScript function to validate email addresses.',
    
    embedding: 'Machine learning is a subset of artificial intelligence.'
  },
  
  expectedPatterns: {
    simple: /4|four/i,
    medium: /machine learning|ML|artificial intelligence|AI/i,
    complex: /45791720|ACME|ABC123|XYZ789|pricing/i,
    streaming: /1.*2.*3.*4.*5/s,
    codeGeneration: /function|email|validate|RegExp|@/i,
    embedding: Array.isArray
  },
  
  emails: [
    {
      id: 'test-email-001',
      subject: 'New order from customer',
      body: 'Please process order #12345 for 100 units of product ABC.',
      expectedEntities: {
        orderId: '12345',
        quantity: 100,
        product: 'ABC'
      }
    },
    {
      id: 'test-email-002',
      subject: 'Support ticket #67890',
      body: 'Customer experiencing login issues. Error code: AUTH_FAILED',
      expectedEntities: {
        ticketId: '67890',
        issue: 'login',
        errorCode: 'AUTH_FAILED'
      }
    },
    {
      id: 'test-email-003',
      subject: 'Contract renewal reminder',
      body: 'Contract #ABC-2024-001 expires on 2024-12-31. Please renew.',
      expectedEntities: {
        contractId: 'ABC-2024-001',
        expiryDate: '2024-12-31',
        action: 'renew'
      }
    }
  ],
  
  performance: {
    acceptableLatency: {
      simple: 1000,    // 1 second for simple prompts
      medium: 3000,    // 3 seconds for medium prompts
      complex: 5000,   // 5 seconds for complex prompts
      streaming: 500   // 500ms to first token
    },
    
    minThroughput: {
      tokensPerSecond: 10,
      requestsPerMinute: 30
    },
    
    maxMemoryUsage: {
      perRequest: 50 * 1024 * 1024,  // 50MB per request
      baseline: 200 * 1024 * 1024     // 200MB baseline
    }
  },
  
  concurrency: {
    levels: [1, 5, 10, 20],
    duration: 30000, // 30 seconds per level
    expectedSuccessRate: 0.95 // 95% success rate
  }
};

// Mock responses for CI/CD testing
export const MOCK_RESPONSES = {
  health: {
    status: 'ok',
    model_loaded: true,
    version: '0.1.0-mock'
  },
  
  models: {
    data: [
      { id: 'llama-3.2-3b', object: 'model', created: Date.now() },
      { id: 'codellama-7b', object: 'model', created: Date.now() },
      { id: 'mistral-7b', object: 'model', created: Date.now() }
    ]
  },
  
  completion: {
    id: 'mock-completion',
    object: 'chat.completion',
    created: Date.now(),
    model: 'llama-3.2-3b',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Mock response for testing'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15
    }
  },
  
  embedding: {
    object: 'list',
    data: [{
      object: 'embedding',
      index: 0,
      embedding: new Array(768).fill(0).map(() => Math.random() - 0.5)
    }],
    model: 'llama-3.2-3b',
    usage: {
      prompt_tokens: 10,
      total_tokens: 10
    }
  }
};

// Test utilities
export class TestUtils {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  static generateTestPrompt(length: 'short' | 'medium' | 'long'): string {
    const templates = {
      short: 'Test prompt',
      medium: 'This is a medium length test prompt that contains multiple sentences. It should trigger a reasonable response from the model.',
      long: `This is a long test prompt that contains multiple paragraphs and complex content.
        
        It includes various types of information:
        1. Numbered lists
        2. Multiple paragraphs
        3. Technical terms like API, JSON, and HTTP
        
        The prompt is designed to test the model's ability to handle longer inputs and generate appropriate responses. It should stress test the token limits and processing capabilities of the system.
        
        Additionally, it contains specific entities that should be extracted:
        - Customer: ACME Corporation
        - Deal ID: 45791720
        - Products: ABC123, XYZ789
        - Date: 2024-12-31`
    };
    
    return templates[length];
  }
  
  static validateResponse(response: any, type: string): boolean {
    switch (type) {
      case 'completion':
        return (
          response &&
          response.choices &&
          Array.isArray(response.choices) &&
          response.choices.length > 0 &&
          response.choices[0].message &&
          typeof response.choices[0].message.content === 'string'
        );
      
      case 'embedding':
        return (
          response &&
          response.data &&
          Array.isArray(response.data) &&
          response.data.length > 0 &&
          Array.isArray(response.data[0].embedding)
        );
      
      case 'stream':
        return (
          response &&
          typeof response === 'string' &&
          response.includes('data:')
        );
      
      default:
        return false;
    }
  }
  
  static extractMetrics(response: any): {
    tokens: number;
    duration: number;
    tokensPerSecond: number;
  } {
    const usage = response.usage || {};
    const duration = usage.total_duration || 1000; // Default 1 second
    const tokens = usage.completion_tokens || usage.total_tokens || 0;
    
    return {
      tokens,
      duration,
      tokensPerSecond: tokens / (duration / 1000)
    };
  }
  
  static async measureLatency<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; latency: number }> {
    const start = performance.now();
    const result = await fn();
    const latency = performance.now() - start;
    
    return { result, latency };
  }
  
  static createMockEmailBatch(count: number): any[] {
    return Array(count).fill(null).map((_, i) => ({
      id: `batch-email-${i}`,
      subject: `Test email ${i}`,
      body: `This is test email ${i} containing deal #${45791720 + i}`,
      from: `sender${i}@test.com`,
      to: 'recipient@test.com',
      received_date: new Date(Date.now() - i * 3600000).toISOString()
    }));
  }
}

// Performance tracking
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  record(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);
  }
  
  getStats(metric: string): {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      count,
      min: sorted[0] || 0,
      max: sorted[count - 1] || 0,
      mean: sorted.reduce((a, b) => a + b, 0) / count,
      median: sorted[Math.floor(count / 2)] || 0,
      p95: sorted[Math.floor(count * 0.95)] || 0,
      p99: sorted[Math.floor(count * 0.99)] || 0
    };
  }
  
  clear(): void {
    this.metrics.clear();
  }
  
  getAllMetrics(): string {
    let report = '\nPerformance Metrics:\n';
    
    for (const [metric, _] of this.metrics) {
      const stats = this.getStats(metric);
      if (stats) {
        report += `\n${metric}:\n`;
        report += `  Count: ${stats.count}\n`;
        report += `  Min: ${stats.min.toFixed(2)}ms\n`;
        report += `  Max: ${stats.max.toFixed(2)}ms\n`;
        report += `  Mean: ${stats.mean.toFixed(2)}ms\n`;
        report += `  Median: ${stats.median.toFixed(2)}ms\n`;
        report += `  P95: ${stats.p95.toFixed(2)}ms\n`;
        report += `  P99: ${stats.p99.toFixed(2)}ms\n`;
      }
    }
    
    return report;
  }
}

// Export test configuration based on environment
export const currentTestConfig = getTestEnvironment();
export const isCI = process.env.CI === 'true';
export const isDebug = process.env.DEBUG === 'true';
export const testTimeout = parseInt(process.env.TEST_TIMEOUT || '30000');