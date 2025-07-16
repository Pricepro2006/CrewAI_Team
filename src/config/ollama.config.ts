import { OllamaConfig } from '../core/llm/OllamaProvider';

export const ollamaConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL_MAIN || 'qwen3:14b',
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 4096,
  systemPrompt: 'You are a helpful AI assistant with expertise in various domains.',
  stream: false
};

export const agentOllamaConfig: OllamaConfig = {
  ...ollamaConfig,
  model: process.env.OLLAMA_MODEL_AGENTS || 'qwen3:8b',
  maxTokens: 2048
};

export const embeddingOllamaConfig = {
  model: process.env.OLLAMA_MODEL_EMBEDDING || 'nomic-embed-text',
  baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
};

export default {
  main: ollamaConfig,
  agents: agentOllamaConfig,
  embedding: embeddingOllamaConfig
};
