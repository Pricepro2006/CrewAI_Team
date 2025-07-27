/**
 * Integration Test Helpers
 * Utilities for running tests with real Ollama instances
 */

import { expect } from 'vitest';
import {
  isOllamaRunning,
  generateWithTimeout,
  createTestOllamaConfig,
} from './ollama-test-helper';

export interface TestAssertionOptions {
  timeout?: number;
  skipOnNoOllama?: boolean;
  expectPartialMatch?: boolean;
}

/**
 * Ensure Ollama is available for test or skip/fail appropriately
 */
export async function requireOllama(shouldThrow = true): Promise<boolean> {
  const isAvailable = await isOllamaRunning();
  if (!isAvailable && shouldThrow) {
    throw new Error("Ollama service is required for this integration test but is not available");
  }
  return isAvailable;
}

/**
 * Test wrapper that handles Ollama availability gracefully
 */
export async function withOllama<T>(
  testFn: () => Promise<T>,
  options: TestAssertionOptions = {}
): Promise<T | void> {
  const { skipOnNoOllama = false } = options;
  
  const isAvailable = await requireOllama(!skipOnNoOllama);
  if (!isAvailable) {
    console.log("Skipping test: Ollama not available");
    return;
  }
  
  return await testFn();
}

/**
 * Assert that an LLM response contains expected content with flexible matching
 */
export function assertLLMResponse(
  response: unknown,
  expectedPatterns: string[],
  options: TestAssertionOptions = {}
): void {
  const { expectPartialMatch = true } = options;
  
  expect(response).toBeDefined();
  expect(typeof response).toBe("string");
  
  const responseText = (response as string).toLowerCase();
  
  if (expectPartialMatch) {
    // For real LLM responses, check if ANY of the expected patterns are present
    const hasMatch = expectedPatterns.some(pattern => 
      responseText.includes(pattern.toLowerCase())
    );
    expect(hasMatch).toBe(true);
  } else {
    // Strict matching - all patterns must be present
    expectedPatterns.forEach(pattern => {
      expect(responseText).toContain(pattern.toLowerCase());
    });
  }
}

/**
 * Assert that a plan has the expected structure and content
 */
export function assertPlanStructure(plan: any, expectedStepCount?: number): void {
  expect(plan).toBeDefined();
  expect(plan.id).toMatch(/^plan-/);
  expect(plan.steps).toBeInstanceOf(Array);
  expect(plan.steps.length).toBeGreaterThan(0);
  
  if (expectedStepCount) {
    expect(plan.steps.length).toBeGreaterThanOrEqual(expectedStepCount);
  }
  
  // Verify first task has required structure
  const firstTask = plan.steps[0];
  expect(firstTask).toHaveProperty("id");
  expect(firstTask).toHaveProperty("task");
  expect(firstTask).toHaveProperty("description");
}

/**
 * Assert that a response has the expected success structure
 */
export function assertSuccessResponse(response: any): void {
  expect(response).toBeDefined();
  expect(response.success).toBe(true);
  expect(response.summary).toBeDefined();
  expect(typeof response.summary).toBe("string");
  expect(response.summary.length).toBeGreaterThan(0);
}

/**
 * Test LLM generation with timeout and error handling
 */
export async function testLLMGeneration(
  llmProvider: any,
  prompt: string,
  expectedPatterns: string[],
  options: TestAssertionOptions = {}
): Promise<void> {
  const { timeout = 30000 } = options;
  
  const response = await generateWithTimeout(
    llmProvider.generate(prompt),
    timeout
  );
  
  assertLLMResponse(response, expectedPatterns, options);
}

/**
 * Create a simple test prompt for verification
 */
export function createTestPrompt(testType: 'simple' | 'math' | 'creative' = 'simple'): {
  prompt: string;
  expectedPatterns: string[];
} {
  switch (testType) {
    case 'math':
      return {
        prompt: 'Calculate 2 + 2 and respond with just the number.',
        expectedPatterns: ['4']
      };
    case 'creative':
      return {
        prompt: 'Write a single sentence about the color blue.',
        expectedPatterns: ['blue']
      };
    case 'simple':
    default:
      return {
        prompt: 'Respond with exactly: "test successful"',
        expectedPatterns: ['test', 'successful']
      };
  }
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 10000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Mock replacement indicator - helps identify tests that need mock removal
 */
export function hasRemovedMocks(): boolean {
  return true; // This helper indicates mocks have been removed
}

/**
 * Get test configuration for consistent test setup
 */
export function getTestConfiguration() {
  const ollamaConfig = createTestOllamaConfig();
  
  return {
    ollama: ollamaConfig,
    timeouts: {
      llmGeneration: 30000,
      planCreation: 45000,
      planExecution: 60000,
      initialization: 15000,
    },
    expectations: {
      minResponseLength: 10,
      maxRetries: 2,
    }
  };
}