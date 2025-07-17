/**
 * Test helpers for integration testing with real Ollama
 * These helpers ensure Ollama is running and models are available
 */

import { OllamaProvider } from "../../core/llm/OllamaProvider";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface OllamaTestConfig {
  url?: string;
  testModel?: string;
  testEmbeddingModel?: string;
  timeout?: number;
}

const DEFAULT_CONFIG: Required<OllamaTestConfig> = {
  url: "http://localhost:11434",
  testModel: "qwen2.5:0.5b", // Small model for faster tests
  testEmbeddingModel: "nomic-embed-text",
  timeout: 30000, // 30 seconds
};

/**
 * Check if Ollama service is running
 */
export async function isOllamaRunning(
  url: string = DEFAULT_CONFIG.url,
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start Ollama service if not running
 */
export async function ensureOllamaRunning(): Promise<void> {
  if (await isOllamaRunning()) {
    return;
  }

  console.log("Starting Ollama service...");
  try {
    // Try to start Ollama in the background
    await execAsync("ollama serve > /dev/null 2>&1 &");

    // Wait for service to be ready
    let attempts = 0;
    while (attempts < 10) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (await isOllamaRunning()) {
        console.log("Ollama service started successfully");
        return;
      }
      attempts++;
    }

    throw new Error("Ollama service failed to start after 10 seconds");
  } catch (error) {
    throw new Error(`Failed to start Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a model is available locally
 */
export async function isModelAvailable(
  model: string,
  url: string = DEFAULT_CONFIG.url,
): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/tags`);
    const data = await response.json();
    return data.models?.some(
      (m: any) => m.name === model || m.name.startsWith(`${model}:`),
    );
  } catch {
    return false;
  }
}

/**
 * Pull a model if not available
 */
export async function ensureModelAvailable(
  model: string,
  url: string = DEFAULT_CONFIG.url,
): Promise<void> {
  if (await isModelAvailable(model, url)) {
    return;
  }

  console.log(`Pulling model ${model}...`);
  // Use direct API call instead of OllamaProvider.pull
  try {
    const response = await fetch(`${url}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: model }),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log(`\nModel ${model} pulled successfully`);
  } catch (error) {
    throw new Error(`Failed to pull model ${model}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Setup Ollama for testing with specified models
 */
export async function setupOllamaForTesting(
  config: OllamaTestConfig = {},
): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Ensure Ollama is running
  await ensureOllamaRunning();

  // Ensure test models are available
  await ensureModelAvailable(finalConfig.testModel, finalConfig.url);

  if (finalConfig.testEmbeddingModel !== finalConfig.testModel) {
    await ensureModelAvailable(finalConfig.testEmbeddingModel, finalConfig.url);
  }
}

/**
 * Create a test Ollama provider with small models for faster tests
 */
export function createTestOllamaProvider(
  config: OllamaTestConfig = {},
): OllamaProvider {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return new OllamaProvider({
    model: finalConfig.testModel,
    baseUrl: finalConfig.url,
    temperature: 0, // Deterministic responses for testing
    maxTokens: 1000, // Reasonable limit for tests
  });
}

/**
 * Test helper to generate a response with timeout
 */
export async function generateWithTimeout(
  provider: OllamaProvider,
  prompt: string,
  timeout: number = DEFAULT_CONFIG.timeout,
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Generation timed out after ${timeout}ms`)),
      timeout,
    );
  });

  try {
    const response = await Promise.race([
      provider.generate(prompt),
      timeoutPromise,
    ]);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      throw new Error(
        `Ollama generation timed out. Is the service running and model loaded?`,
      );
    }
    throw error;
  }
}

/**
 * Test helper to chat with timeout
 */
export async function chatWithTimeout(
  provider: OllamaProvider,
  messages: Array<{ role: string; content: string }>,
  timeout: number = DEFAULT_CONFIG.timeout,
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Chat timed out after ${timeout}ms`)),
      timeout,
    );
  });

  try {
    // Note: OllamaProvider doesn't have chat method yet, using generate
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const response = await Promise.race([
      provider.generate(prompt),
      timeoutPromise,
    ]);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      throw new Error(
        `Ollama chat timed out. Is the service running and model loaded?`,
      );
    }
    throw error;
  }
}

/**
 * Skip test if Ollama is not available
 */
export function skipIfNoOllama() {
  return {
    skip: async () => {
      const running = await isOllamaRunning();
      return !running;
    },
    reason: "Ollama service is not running",
  };
}

/**
 * Clean up test resources
 */
export async function cleanupOllamaTests(): Promise<void> {
  // Currently no cleanup needed, but placeholder for future needs
  // Could include clearing conversation history, unloading models, etc.
}
