/**
 * Ollama Test Helper Functions
 */

export async function setupOllamaForTesting(): Promise<void> {
  // Setup logic for Ollama testing
  // Add any necessary setup here
}

export async function cleanupOllamaTests(): Promise<void> {
  // Cleanup logic for Ollama testing
  // Add any necessary cleanup here
}

export async function isOllamaRunning(url?: string): Promise<boolean> {
  try {
    const ollamaUrl = url || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/tags`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function generateWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 15000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    )
  ]);
}

export function skipIfNoOllama() {
  return {
    skip: async (): Promise<boolean> => {
      // Check if Ollama is available
      try {
        return !(await isOllamaRunning());
      } catch (error) {
        return true;
      }
    },
    reason: 'Ollama service not available'
  };
}