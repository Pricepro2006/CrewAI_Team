/**
 * Mock llama-server for testing without actual server
 * Provides realistic responses for CI/CD environments
 */

import { EventEmitter } from 'events';

export interface MockServerConfig {
  port: number;
  responseDelay?: number;
  errorRate?: number;
  streaming?: boolean;
}

export class MockLlamaServer extends EventEmitter {
  private config: MockServerConfig;
  private isRunning: boolean = false;
  private requestCount: number = 0;
  private mockResponses: Map<string, any> = new Map();

  constructor(config: MockServerConfig) {
    super();
    this.config = config;
    this.setupMockResponses();
  }

  private setupMockResponses() {
    // Pre-defined responses for common prompts
    this.mockResponses.set('default', {
      id: 'mock-completion-001',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama-3.2-3b',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a mock response from the simulated llama server.'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25,
        total_duration: 500
      }
    });

    this.mockResponses.set('email_analysis', {
      id: 'mock-email-analysis',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama-3.2-3b',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            intent: 'inquiry',
            entities: {
              dealId: '45791720',
              customer: 'ACME Corp',
              products: ['ABC123', 'XYZ789']
            },
            sentiment: 'neutral',
            urgency: 'medium',
            recommendations: [
              'Follow up within 24 hours',
              'Provide pricing information'
            ]
          })
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 80,
        total_tokens: 130,
        total_duration: 1200
      }
    });

    this.mockResponses.set('code_generation', {
      id: 'mock-code-gen',
      object: 'chat.completion',
      created: Date.now(),
      model: 'llama-3.2-3b',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `\`\`\`typescript
function processEmail(email: Email): ProcessedEmail {
  return {
    id: email.id,
    processed: true,
    timestamp: new Date().toISOString()
  };
}
\`\`\``
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 30,
        completion_tokens: 50,
        total_tokens: 80,
        total_duration: 800
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server already running');
    }

    // Simulate server startup delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.isRunning = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Server not running');
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  async handleRequest(endpoint: string, data: any): Promise<any> {
    if (!this.isRunning) {
      throw new Error('Server not running');
    }

    this.requestCount++;

    // Simulate network delay
    if (this.config.responseDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.responseDelay));
    }

    // Simulate random errors
    if (this.config.errorRate && Math.random() < this.config.errorRate) {
      throw new Error('Mock server error');
    }

    switch (endpoint) {
      case '/health':
        return { status: 'ok', model_loaded: true };

      case '/v1/models':
        return {
          data: [
            { id: 'llama-3.2-3b', object: 'model', created: Date.now() },
            { id: 'codellama-7b', object: 'model', created: Date.now() }
          ]
        };

      case '/v1/chat/completions':
        return this.handleCompletion(data);

      case '/v1/embeddings':
        return this.handleEmbeddings(data);

      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
  }

  private handleCompletion(data: any): any {
    const prompt = data.messages?.[data.messages.length - 1]?.content || '';
    
    // Determine response based on prompt content
    let response = this.mockResponses.get('default');
    
    if (prompt.toLowerCase().includes('email')) {
      response = this.mockResponses.get('email_analysis');
    } else if (prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('function')) {
      response = this.mockResponses.get('code_generation');
    }

    // Clone response to avoid mutations
    response = JSON.parse(JSON.stringify(response));
    
    // Update timestamps
    response.created = Date.now();
    response.id = `mock-${this.requestCount}`;
    
    // Apply temperature variation
    if (data.temperature && data.temperature > 0.8) {
      response.choices[0].message.content += ' [High temperature response variation]';
    }

    // Handle streaming
    if (data.stream && this.config.streaming) {
      return this.createStreamResponse(response);
    }

    return response;
  }

  private handleEmbeddings(data: any): any {
    const input = Array.isArray(data.input) ? data.input : [data.input];
    
    return {
      object: 'list',
      data: input.map((text: string, index: number) => ({
        object: 'embedding',
        index,
        embedding: this.generateMockEmbedding(768) // 768-dimensional embedding
      })),
      model: 'llama-3.2-3b',
      usage: {
        prompt_tokens: input.join(' ').split(' ').length * 2,
        total_tokens: input.join(' ').split(' ').length * 2
      }
    };
  }

  private generateMockEmbedding(dimensions: number): number[] {
    // Generate deterministic mock embeddings
    return Array(dimensions).fill(0).map((_, i) => 
      Math.sin(i * 0.1) * 0.5 + Math.cos(i * 0.2) * 0.5
    );
  }

  private createStreamResponse(response: any): string {
    const chunks = [];
    const content = response.choices[0].message.content;
    const words = content.split(' ');
    
    // Create SSE chunks
    words.forEach((word: string, index: number) => {
      chunks.push(`data: ${JSON.stringify({
        choices: [{
          delta: { content: word + (index < words.length - 1 ? ' ' : '') }
        }]
      })}\n\n`);
    });
    
    chunks.push('data: [DONE]\n\n');
    
    return chunks.join('');
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() : 0
    };
  }
}

// Mock HTTP client for testing
export class MockLlamaHttpClient {
  private server: MockLlamaServer;

  constructor(server: MockLlamaServer) {
    this.server = server;
  }

  async get(url: string): Promise<{ data: any; status: number }> {
    const endpoint = new URL(url).pathname;
    const data = await this.server.handleRequest(endpoint, {});
    return { data, status: 200 };
  }

  async post(url: string, body: any): Promise<{ data: any; status: number }> {
    const endpoint = new URL(url).pathname;
    const data = await this.server.handleRequest(endpoint, body);
    return { data, status: 200 };
  }
}

// Factory function for creating mock server
export function createMockLlamaServer(config?: Partial<MockServerConfig>): MockLlamaServer {
  return new MockLlamaServer({
    port: 8081,
    responseDelay: 50,
    errorRate: 0,
    streaming: true,
    ...config
  });
}

// Test fixtures
export const testFixtures = {
  emails: [
    {
      id: 'test-001',
      subject: 'Deal inquiry #45791720',
      body: 'Please provide pricing for products ABC123 and XYZ789 for ACME Corp.'
    },
    {
      id: 'test-002',
      subject: 'Urgent: Contract renewal',
      body: 'Our contract expires next month. Need renewal terms ASAP.'
    },
    {
      id: 'test-003',
      subject: 'Technical support request',
      body: 'Having issues with the API integration. Error code: E_TIMEOUT'
    }
  ],
  
  prompts: {
    simple: 'Hello, how are you?',
    analysis: 'Analyze this email for intent and entities',
    code: 'Write a TypeScript function to process emails',
    complex: 'Explain quantum computing in simple terms, then provide a Python example'
  },
  
  expectedResponses: {
    simple: 'I am functioning well, thank you for asking.',
    analysis: { intent: 'inquiry', entities: ['email', 'intent'] },
    code: 'function processEmail(email: Email)',
    complex: 'Quantum computing uses quantum bits'
  }
};