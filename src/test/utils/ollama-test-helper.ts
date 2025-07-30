/**
 * Ollama Test Helper Functions
 * Enhanced for real Ollama instance testing
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from '../../utils/logger.js';

let ollamaProcess: ChildProcess | null = null;
let isSetupComplete = false;

// Test model configuration - using lightweight models for faster tests
const TEST_MODELS = {
  primary: process.env.OLLAMA_TEST_MODEL || 'qwen2.5:0.5b', // Fastest model for tests
  embedding: 'nomic-embed-text:latest'
};

export async function setupOllamaForTesting(): Promise<void> {
  if (isSetupComplete) {
    logger.info('Ollama test setup already complete');
    return;
  }

  logger.info('Setting up Ollama for integration testing...');
  
  try {
    // Check if Ollama is already running
    const isRunning = await isOllamaRunning();
    
    if (!isRunning) {
      logger.info('Starting Ollama service for testing...');
      await startOllamaService();
      
      // Wait for service to be ready
      await waitForOllamaReady();
    }
    
    // Ensure test models are available
    await ensureTestModelsAvailable();
    
    isSetupComplete = true;
    logger.info('Ollama test setup completed successfully');
    
  } catch (error) {
    logger.error('Failed to setup Ollama for testing:', error instanceof Error ? error.message : String(error));
    throw new Error(`Ollama setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function cleanupOllamaTests(): Promise<void> {
  logger.info('Cleaning up Ollama test environment...');
  
  // Stop Ollama process if we started it
  if (ollamaProcess) {
    try {
      ollamaProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for graceful shutdown
      
      if (!ollamaProcess.killed) {
        ollamaProcess.kill('SIGKILL');
      }
      
      ollamaProcess = null;
      logger.info('Ollama process stopped');
    } catch (error) {
      logger.warn('Error stopping Ollama process:', error instanceof Error ? error.message : String(error));
    }
  }
  
  isSetupComplete = false;
}

export async function isOllamaRunning(url?: string): Promise<boolean> {
  try {
    const ollamaUrl = url || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
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
        const isRunning = await isOllamaRunning();
        if (!isRunning) {
          logger.warn('Ollama service not available - tests will be skipped');
        }
        return !isRunning;
      } catch (error) {
        logger.error('Error checking Ollama availability:', error instanceof Error ? error.message : String(error));
        return true;
      }
    },
    reason: 'Ollama service not available'
  };
}

/**
 * Start Ollama service as a child process
 */
async function startOllamaService(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      ollamaProcess = spawn('ollama', ['serve'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      let isResolved = false;

      ollamaProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        logger.debug('Ollama stdout:', output);
        
        // Check for ready indicators
        if (output.includes('Listening on') || output.includes('server starting')) {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        }
      });

      ollamaProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        logger.debug('Ollama stderr:', error);
        
        // Don't treat all stderr as errors, some are just info logs
        if (error.includes('error') || error.includes('failed')) {
          logger.warn('Ollama error output:', error);
        }
      });

      ollamaProcess.on('error', (error) => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Failed to start Ollama: ${error.message}`));
        }
      });

      ollamaProcess.on('exit', (code) => {
        if (!isResolved && code !== 0) {
          isResolved = true;
          reject(new Error(`Ollama exited with code ${code}`));
        }
      });

      // Timeout if service doesn't start in 10 seconds
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          resolve(); // Continue anyway, will be checked in waitForOllamaReady
        }
      }, 10000);
      
    } catch (error) {
      reject(new Error(`Failed to spawn Ollama process: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Wait for Ollama to be ready to accept requests
 */
async function waitForOllamaReady(): Promise<void> {
  const maxAttempts = 30; // 30 seconds
  const delayMs = 1000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const isReady = await isOllamaRunning();
      if (isReady) {
        logger.info(`Ollama is ready (attempt ${attempt})`);
        return;
      }
    } catch (error) {
      // Ignore connection errors during startup
    }
    
    logger.debug(`Waiting for Ollama to be ready (attempt ${attempt}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Ollama failed to become ready within timeout period');
}

/**
 * Ensure required test models are available
 */
async function ensureTestModelsAvailable(): Promise<void> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  try {
    // Check available models
    const response = await fetch(`${ollamaUrl}/api/tags`);
    const data = await response.json() as { models?: Array<{ name: string }> };
    const availableModels = data.models?.map((m) => m.name) || [];
    
    logger.info('Available models:', availableModels);
    
    // Check if primary test model is available
    const primaryModelAvailable = availableModels.some((name: string) => 
      name.includes(TEST_MODELS.primary.split(':')[0])
    );
    
    if (!primaryModelAvailable) {
      logger.warn(`Primary test model ${TEST_MODELS.primary} not available`);
      
      // Try to find an alternative small model
      const alternativeModels = [
        'qwen2.5:0.5b',
        'phi3:mini',
        'qwen2:0.5b',
        'llama3.2:1b'
      ];
      
      let foundModel = null;
      for (const model of alternativeModels) {
        if (availableModels.some((name: string) => name.includes(model.split(':')[0]))) {
          foundModel = model;
          break;
        }
      }
      
      if (foundModel) {
        logger.info(`Using alternative test model: ${foundModel}`);
        TEST_MODELS.primary = foundModel;
      } else {
        logger.warn('No suitable test model found. Tests may need to pull models on demand.');
      }
    }
    
  } catch (error) {
    logger.warn('Could not check available models:', error instanceof Error ? error.message : String(error));
    // Continue anyway - tests will handle model availability individually
  }
}

/**
 * Pull a model if not available
 */
export async function ensureModelAvailable(modelName: string): Promise<boolean> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  try {
    // Check if model is already available
    const response = await fetch(`${ollamaUrl}/api/tags`);
    const data = await response.json() as { models?: Array<{ name: string }> };
    const availableModels = data.models?.map((m) => m.name) || [];
    
    const isAvailable = availableModels.some((name: string) => 
      name === modelName || name.startsWith((modelName || '').split(':')[0])
    );
    
    if (isAvailable) {
      return true;
    }
    
    logger.info(`Pulling model ${modelName} for testing...`);
    
    // Pull the model
    const pullResponse = await fetch(`${ollamaUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });
    
    if (!pullResponse.ok) {
      logger.error(`Failed to pull model ${modelName}: ${pullResponse.statusText}`);
      return false;
    }
    
    // Wait for pull to complete (this is a streaming response)
    const reader = pullResponse.body?.getReader();
    if (reader) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        try {
          const lines = chunk.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const data = JSON.parse(line);
            if (data.status === 'success') {
              logger.info(`Model ${modelName} pulled successfully`);
              return true;
            }
            if (data.error) {
              logger.error(`Error pulling model ${modelName}: ${data.error}`);
              return false;
            }
          }
        } catch (e) {
          // Ignore JSON parse errors from partial chunks
        }
      }
    }
    
    return true;
    
  } catch (error) {
    logger.error(`Error ensuring model ${modelName} is available:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Get the recommended test model
 */
export function getTestModel(): string {
  return TEST_MODELS.primary;
}

/**
 * Create a test-safe Ollama configuration
 */
export function createTestOllamaConfig() {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: getTestModel(),
    timeout: 30000, // 30 seconds for tests
    maxRetries: 2,
  };
}