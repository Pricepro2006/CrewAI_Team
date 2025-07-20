# TypeScript Best Practices for AI Systems and LLM Applications

## Overview

TypeScript provides a robust foundation for building AI systems and LLM applications through its strong type system, compile-time error checking, and excellent developer tooling. This guide covers best practices for leveraging TypeScript in AI/ML projects, focusing on type safety, performance, and maintainability.

## Type Safety Fundamentals

### 1. Compile-Time Type Checking

TypeScript's compile-time type checking is invaluable for AI systems where complex data flows and transformations are common.

```typescript
// Bad: Runtime errors waiting to happen
function processLLMResponse(response: any): any {
  return response.choices[0].message.content;
}

// Good: Type-safe LLM response handling
interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function processLLMResponse(response: LLMResponse): string {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('Invalid LLM response: no choices available');
  }
  
  return response.choices[0].message.content;
}
```

### 2. Strict Type Definitions for AI Models

```typescript
// Model configuration types
interface ModelConfig {
  readonly name: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly topP: number;
  readonly stopSequences?: readonly string[];
}

// Tool definition types
interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JSONSchema;
  readonly function: (...args: any[]) => Promise<any>;
}

// Agent state types
interface AgentState {
  readonly conversationId: string;
  readonly messages: readonly Message[];
  readonly tools: readonly ToolDefinition[];
  readonly context: Readonly<Record<string, unknown>>;
}

// Use discriminated unions for different response types
type LLMOutputType = 
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; arguments: Record<string, unknown> }
  | { type: 'error'; message: string; code: string };
```

### 3. Template Literal Types for Prompts

```typescript
// Type-safe prompt templates
type PromptTemplate<T extends string> = {
  template: T;
  variables: ExtractVariables<T>;
};

type ExtractVariables<T extends string> = 
  T extends `${infer _Start}{{${infer Variable}}}${infer Rest}`
    ? Variable | ExtractVariables<Rest>
    : never;

// Usage example
const questionAnswerTemplate = {
  template: "Based on the following context: {{context}}\n\nQuestion: {{question}}\n\nAnswer:",
  variables: ['context', 'question'] as const
} satisfies PromptTemplate<string>;

function renderTemplate<T extends string>(
  template: PromptTemplate<T>,
  variables: Record<ExtractVariables<T>, string>
): string {
  let result = template.template;
  
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  
  return result;
}
```

## Performance Patterns

### 1. Efficient Memory Management

```typescript
class TokenizedTextCache {
  private cache = new Map<string, readonly number[]>();
  private maxSize = 1000;
  
  get(text: string): readonly number[] | undefined {
    return this.cache.get(text);
  }
  
  set(text: string, tokens: readonly number[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(text, tokens);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  get size(): number {
    return this.cache.size;
  }
}
```

### 2. Lazy Loading and Initialization

```typescript
class LazyModel<T> {
  private model: T | null = null;
  private initialized = false;
  private initializationPromise: Promise<T> | null = null;
  
  constructor(private initializer: () => Promise<T>) {}
  
  async getInstance(): Promise<T> {
    if (this.initialized && this.model) {
      return this.model;
    }
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this.initializer();
    this.model = await this.initializationPromise;
    this.initialized = true;
    
    return this.model;
  }
}

// Usage
const embeddingModel = new LazyModel(async () => {
  const { HuggingFaceEmbeddings } = await import('langchain/embeddings/hf');
  return new HuggingFaceEmbeddings({
    model: 'sentence-transformers/all-MiniLM-L6-v2',
  });
});
```

### 3. Batching and Concurrency Control

```typescript
class BatchProcessor<T, R> {
  private queue: Array<{
    item: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
  }> = [];
  
  private processing = false;
  
  constructor(
    private batchSize: number,
    private maxConcurrency: number,
    private processor: (batch: readonly T[]) => Promise<readonly R[]>
  ) {}
  
  async process(item: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      this.processBatch();
    });
  }
  
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    try {
      const batch = this.queue.splice(0, this.batchSize);
      const items = batch.map(b => b.item);
      
      const results = await this.processor(items);
      
      batch.forEach((b, index) => {
        b.resolve(results[index]);
      });
    } catch (error) {
      const batch = this.queue.splice(0, this.batchSize);
      batch.forEach(b => b.reject(error as Error));
    } finally {
      this.processing = false;
      
      if (this.queue.length > 0) {
        setTimeout(() => this.processBatch(), 0);
      }
    }
  }
}
```

## Modular Architecture Patterns

### 1. Plugin-based Agent System

```typescript
interface AgentPlugin {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  
  initialize(config: Record<string, unknown>): Promise<void>;
  execute(input: unknown): Promise<unknown>;
  cleanup(): Promise<void>;
}

class PluginManager {
  private plugins = new Map<string, AgentPlugin>();
  
  async registerPlugin(plugin: AgentPlugin): Promise<void> {
    await plugin.initialize({});
    this.plugins.set(plugin.name, plugin);
  }
  
  async unregisterPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
      await plugin.cleanup();
      this.plugins.delete(name);
    }
  }
  
  getPlugin(name: string): AgentPlugin | undefined {
    return this.plugins.get(name);
  }
  
  listPlugins(): readonly string[] {
    return Array.from(this.plugins.keys());
  }
}
```

### 2. Composable Tool System

```typescript
interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: JSONSchema;
  execute(input: TInput): Promise<TOutput>;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();
  
  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool);
  }
  
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  list(): readonly Tool[] {
    return Array.from(this.tools.values());
  }
  
  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
    
    return tool.execute(input);
  }
}

// Example tool implementation
class WebSearchTool implements Tool<{ query: string }, { results: string[] }> {
  readonly name = 'web_search';
  readonly description = 'Search the web for information';
  readonly schema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    },
    required: ['query']
  };
  
  async execute(input: { query: string }): Promise<{ results: string[] }> {
    // Implementation
    return { results: [] };
  }
}
```

### 3. Event-Driven Architecture

```typescript
type EventMap = {
  'agent:started': { agentId: string; timestamp: Date };
  'agent:completed': { agentId: string; result: unknown; timestamp: Date };
  'agent:error': { agentId: string; error: Error; timestamp: Date };
  'tool:called': { toolName: string; input: unknown; timestamp: Date };
  'tool:result': { toolName: string; output: unknown; timestamp: Date };
};

class TypedEventEmitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Array<(data: T[keyof T]) => void>>();
  
  on<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    const eventListeners = this.listeners.get(event) || [];
    eventListeners.push(listener as any);
    this.listeners.set(event, eventListeners);
  }
  
  off<K extends keyof T>(event: K, listener: (data: T[K]) => void): void {
    const eventListeners = this.listeners.get(event) || [];
    const index = eventListeners.indexOf(listener as any);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  }
  
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const eventListeners = this.listeners.get(event) || [];
    eventListeners.forEach(listener => listener(data));
  }
}

const eventBus = new TypedEventEmitter<EventMap>();
```

## Error Handling and Validation

### 1. Robust Error Types

```typescript
abstract class AIError extends Error {
  abstract readonly code: string;
  abstract readonly category: 'model' | 'tool' | 'validation' | 'network';
  
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ModelError extends AIError {
  readonly code = 'MODEL_ERROR';
  readonly category = 'model' as const;
}

class ToolError extends AIError {
  readonly code = 'TOOL_ERROR';
  readonly category = 'tool' as const;
}

class ValidationError extends AIError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = 'validation' as const;
}

// Error handling utility
function handleAIError(error: unknown): never {
  if (error instanceof AIError) {
    console.error(`AI Error [${error.code}]:`, error.message, error.context);
    throw error;
  }
  
  if (error instanceof Error) {
    console.error('Unexpected error:', error.message);
    throw new AIError(error.message, { originalError: error.name });
  }
  
  console.error('Unknown error:', error);
  throw new AIError('An unknown error occurred', { originalError: error });
}
```

### 2. Input Validation with Zod

```typescript
import { z } from 'zod';

const AgentConfigSchema = z.object({
  model: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().positive(),
  tools: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});

type AgentConfig = z.infer<typeof AgentConfigSchema>;

class ConfigValidator {
  static validateAgentConfig(config: unknown): AgentConfig {
    try {
      return AgentConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          'Invalid agent configuration',
          { validationErrors: error.errors }
        );
      }
      throw error;
    }
  }
}
```

## Testing Patterns

### 1. Mock LLM Responses

```typescript
interface MockLLMProvider {
  setResponse(response: LLMResponse): void;
  setError(error: Error): void;
  getCallHistory(): Array<{ prompt: string; config: ModelConfig }>;
  clearHistory(): void;
}

class TestLLMProvider implements MockLLMProvider {
  private responses: LLMResponse[] = [];
  private errors: Error[] = [];
  private callHistory: Array<{ prompt: string; config: ModelConfig }> = [];
  
  setResponse(response: LLMResponse): void {
    this.responses.push(response);
  }
  
  setError(error: Error): void {
    this.errors.push(error);
  }
  
  async generate(prompt: string, config: ModelConfig): Promise<LLMResponse> {
    this.callHistory.push({ prompt, config });
    
    if (this.errors.length > 0) {
      throw this.errors.shift();
    }
    
    if (this.responses.length > 0) {
      return this.responses.shift()!;
    }
    
    throw new Error('No mock response configured');
  }
  
  getCallHistory(): Array<{ prompt: string; config: ModelConfig }> {
    return [...this.callHistory];
  }
  
  clearHistory(): void {
    this.callHistory = [];
  }
}
```

### 2. Test Utilities

```typescript
class TestUtils {
  static createMockAgent(overrides?: Partial<AgentConfig>): Agent {
    const config: AgentConfig = {
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 1000,
      ...overrides,
    };
    
    return new Agent(config, new TestLLMProvider());
  }
  
  static async expectAsync<T>(
    promise: Promise<T>,
    assertion: (result: T) => void
  ): Promise<void> {
    try {
      const result = await promise;
      assertion(result);
    } catch (error) {
      throw new Error(`Async expectation failed: ${error}`);
    }
  }
  
  static createMockTool(name: string, result: unknown): Tool {
    return {
      name,
      description: `Mock tool: ${name}`,
      schema: { type: 'object', properties: {} },
      execute: async () => result,
    };
  }
}
```

## Performance Monitoring

### 1. Metrics Collection

```typescript
interface Metrics {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: {
    modelInference: number;
    toolExecution: number;
    totalRequest: number;
  };
  errors: {
    modelErrors: number;
    toolErrors: number;
    validationErrors: number;
  };
}

class MetricsCollector {
  private metrics: Metrics = {
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    latency: { modelInference: 0, toolExecution: 0, totalRequest: 0 },
    errors: { modelErrors: 0, toolErrors: 0, validationErrors: 0 },
  };
  
  recordTokenUsage(usage: Metrics['tokenUsage']): void {
    this.metrics.tokenUsage.promptTokens += usage.promptTokens;
    this.metrics.tokenUsage.completionTokens += usage.completionTokens;
    this.metrics.tokenUsage.totalTokens += usage.totalTokens;
  }
  
  recordLatency(type: keyof Metrics['latency'], time: number): void {
    this.metrics.latency[type] += time;
  }
  
  recordError(type: keyof Metrics['errors']): void {
    this.metrics.errors[type]++;
  }
  
  getMetrics(): Readonly<Metrics> {
    return { ...this.metrics };
  }
  
  reset(): void {
    this.metrics = {
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latency: { modelInference: 0, toolExecution: 0, totalRequest: 0 },
      errors: { modelErrors: 0, toolErrors: 0, validationErrors: 0 },
    };
  }
}
```

### 2. Performance Decorators

```typescript
function measurePerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]): Promise<any> {
    const start = performance.now();
    
    try {
      const result = await originalMethod.apply(this, args);
      const end = performance.now();
      
      console.log(`${propertyKey} took ${end - start} milliseconds`);
      return result;
    } catch (error) {
      const end = performance.now();
      console.error(`${propertyKey} failed after ${end - start} milliseconds`);
      throw error;
    }
  };
}

class Agent {
  @measurePerformance
  async processQuery(query: string): Promise<string> {
    // Implementation
    return 'response';
  }
}
```

## Configuration Management

### 1. Environment-based Configuration

```typescript
const ConfigSchema = z.object({
  model: z.object({
    name: z.string(),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().positive(),
  }),
  vectorDb: z.object({
    url: z.string().url(),
    collection: z.string(),
    dimensions: z.number().positive(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'text']),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;
  
  private constructor() {
    this.config = this.loadConfig();
  }
  
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }
  
  private loadConfig(): Config {
    const config = {
      model: {
        name: process.env.MODEL_NAME || 'gpt-3.5-turbo',
        temperature: parseFloat(process.env.MODEL_TEMPERATURE || '0.7'),
        maxTokens: parseInt(process.env.MODEL_MAX_TOKENS || '1000'),
      },
      vectorDb: {
        url: process.env.VECTOR_DB_URL || 'http://localhost:8000',
        collection: process.env.VECTOR_DB_COLLECTION || 'default',
        dimensions: parseInt(process.env.VECTOR_DB_DIMENSIONS || '384'),
      },
      logging: {
        level: (process.env.LOG_LEVEL as any) || 'info',
        format: (process.env.LOG_FORMAT as any) || 'json',
      },
    };
    
    return ConfigSchema.parse(config);
  }
  
  getConfig(): Readonly<Config> {
    return { ...this.config };
  }
}
```

## Best Practices Summary

### 1. Type Safety
- Use strict TypeScript configuration
- Define explicit types for all AI/ML interfaces
- Leverage discriminated unions for different response types
- Use template literal types for compile-time prompt validation

### 2. Performance
- Implement lazy loading for heavy resources
- Use batching for API calls
- Cache frequently accessed data
- Monitor and measure performance consistently

### 3. Architecture
- Design modular, composable systems
- Use event-driven patterns for loose coupling
- Implement proper error handling and recovery
- Create testable components with clear interfaces

### 4. Development
- Follow established TypeScript conventions
- Use proper tooling (Prettier, ESLint)
- Write comprehensive tests with mocks
- Document types and interfaces thoroughly

### 5. Security
- Validate all inputs and outputs
- Implement proper error handling
- Use environment-based configuration
- Monitor for security vulnerabilities

This comprehensive guide provides the foundation for building robust, maintainable, and performant AI systems using TypeScript's powerful type system and modern development practices.