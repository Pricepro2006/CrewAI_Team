/**
 * llama.cpp Configuration
 * Replaces Ollama with direct llama.cpp integration
 * Aligned with three-stage pipeline architecture
 */

export interface LlamaCppConfig {
  executablePath: string;
  modelsPath: string;
  defaultModel: string;
  cpuThreads: number;
  contextSize: number;
  batchSize: number;
  temperature: number;
  topK: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  models: {
    [key: string]: {
      path: string;
      name: string;
      description: string;
      contextWindow: number;
      temperature: number;
      quantization: string;
    };
  };
}

const llamaCppConfig: LlamaCppConfig = {
  // Path to llama.cpp executable
  executablePath: process.env.LLAMA_CPP_PATH || "./llama.cpp/build/bin/llama-cli",
  
  // Directory containing GGUF models
  modelsPath: process.env.LLAMA_MODELS_PATH || "./models",
  
  // Default model for Stage 2 analysis
  defaultModel: process.env.LLAMA_DEFAULT_MODEL || "llama-3.2-3b-instruct?.Q4_K_M?.gguf",
  
  // CPU optimization settings
  cpuThreads: parseInt(process.env.LLAMA_CPU_THREADS || "16"), // AMD Ryzen 7 PRO has 16 cores
  contextSize: parseInt(process.env.LLAMA_CONTEXT_SIZE || "8192"),
  batchSize: parseInt(process.env.LLAMA_BATCH_SIZE || "512"),
  
  // Inference parameters
  temperature: parseFloat(process.env.LLAMA_TEMPERATURE || "0.3"),
  topK: parseInt(process.env.LLAMA_TOP_K || "40"),
  topP: parseFloat(process.env.LLAMA_TOP_P || "0.9"),
  repeatPenalty: parseFloat(process.env.LLAMA_REPEAT_PENALTY || "1.1"),
  maxTokens: parseInt(process.env.LLAMA_MAX_TOKENS || "2048"),
  
  models: {
    // Stage 2: Primary analysis model (llama.cpp GGUF format)
    "llama-3.2-3b-instruct?.Q4_K_M?.gguf": {
      path: "llama-3.2-3b-instruct?.Q4_K_M?.gguf",
      name: "Llama 3.2 3B Instruct",
      description: "Meta Llama 3.2 3B - Primary model for Stage 2 analysis",
      contextWindow: 8192,
      temperature: 0.3,
      quantization: "Q4_K_M"
    },
    
    // Stage 3: Critical analysis model
    "phi-4-14b-tools?.Q3_K_S?.gguf": {
      path: "phi-4-14b-tools?.Q3_K_S?.gguf",
      name: "Phi-4 14B Tools",
      description: "Microsoft Phi-4 14B - Critical analysis for Stage 3",
      contextWindow: 16384,
      temperature: 0.3,
      quantization: "Q3_K_S"
    },
    
    // Walmart NLP model
    "qwen3-0.6b-instruct?.Q8_0?.gguf": {
      path: "qwen3-0.6b-instruct?.Q8_0?.gguf",
      name: "Qwen3 0.6B",
      description: "Qwen 3 0.6B - Fast NLP for Walmart agent",
      contextWindow: 8192,
      temperature: 0.5,
      quantization: "Q8_0"
    },
    
    // Alternative models for testing
    "tinyllama-1.1b-chat?.Q4_K_M?.gguf": {
      path: "tinyllama-1.1b-chat?.Q4_K_M?.gguf",
      name: "TinyLlama 1.1B",
      description: "TinyLlama 1.1B - Fast testing model",
      contextWindow: 2048,
      temperature: 0.7,
      quantization: "Q4_K_M"
    }
  }
};

/**
 * Build llama.cpp command with parameters
 */
export function buildLlamaCppCommand(
  modelName: string,
  prompt: string,
  options?: Partial<LlamaCppConfig>
): string {
  const config = { ...llamaCppConfig, ...options };
  const model = config.models[modelName] || config.models[config.defaultModel];
  
  const args = [
    config.executablePath,
    '-m', `${config.modelsPath}/${model?.path}`,
    '-p', `"${prompt}"`,
    '-n', config?.maxTokens?.toString(),
    '-t', config?.cpuThreads?.toString(),
    '-c', model?.contextWindow?.toString(),
    '-b', config?.batchSize?.toString(),
    '--temp', model?.temperature?.toString(),
    '--top-k', config?.topK?.toString(),
    '--top-p', config?.topP?.toString(),
    '--repeat-penalty', config?.repeatPenalty?.toString(),
    '--log-disable'
  ];
  
  return args.join(' ');
}

/**
 * Execute llama.cpp inference
 */
export async function runLlamaCppInference(
  modelName: string,
  prompt: string
): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  const command = buildLlamaCppCommand(modelName, prompt);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stderr) {
      console.warn('llama.cpp stderr:', stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    console.error('llama.cpp execution error:', error);
    throw new Error(`Failed to run llama.cpp: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default llamaCppConfig;