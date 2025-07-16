import { vi } from "vitest";

export const mockOllamaResponse = {
  model: "qwen3:14b",
  created_at: new Date().toISOString(),
  response: "Mock response from Ollama",
  done: true,
};

export const mockOllamaEmbedding = {
  embedding: Array(768).fill(0.1),
};

export const createMockOllamaProvider = () => ({
  chat: vi.fn().mockResolvedValue(mockOllamaResponse),
  embeddings: vi.fn().mockResolvedValue(mockOllamaEmbedding),
  generate: vi.fn().mockResolvedValue(mockOllamaResponse),
  pull: vi.fn().mockResolvedValue({ status: "success" }),
  list: vi.fn().mockResolvedValue({
    models: [
      { name: "qwen3:14b", size: 14000000000 },
      { name: "qwen3:8b", size: 8000000000 },
      { name: "nomic-embed-text", size: 274000000 },
    ],
  }),
});
