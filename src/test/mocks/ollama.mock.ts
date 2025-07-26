import { vi } from 'vitest';

export function createMockOllamaProvider() {
  return {
    generate: vi.fn().mockResolvedValue('Mock LLM response for testing purposes'),
    generateCompletion: vi.fn().mockResolvedValue({
      content: 'Mock completion response',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    }),
    isAvailable: vi.fn().mockResolvedValue(true),
    initialize: vi.fn().mockResolvedValue(undefined)
  };
}

export const mockOllamaProvider = createMockOllamaProvider();