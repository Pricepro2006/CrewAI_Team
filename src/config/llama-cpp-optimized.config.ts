/**
 * Optimized llama.cpp Configuration for AMD Ryzen 7 PRO (64GB RAM)
 * Based on performance research and best practices
 * Replaces Ollama with direct llama.cpp integration
 */

import { exec, spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { join, resolve, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, statSync } from 'fs';
import { z } from 'zod';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface LlamaCppOptimizedConfig {
  // Paths
  executablePath: string;
  serverPath: string;
  modelsPath: string;
  
  // AMD Ryzen Optimization
  cpuThreads: number;           // Physical cores only (16 for Ryzen 7 PRO)
  cpuAffinity: string;          // CPU mask for core pinning
  numaMode: 'distribute' | 'isolate' | 'none';
  
  // Memory Management
  useMlock: boolean;            // Lock model in RAM
  useMmap: boolean;             // Memory mapping for large models
  
  // Performance Tuning
  contextSize: number;          // Context window size
  batchSize: number;            // Logical batch size
  ubatchSize: number;           // Physical batch size
  
  // Inference Parameters
  temperature: number;
  topK: number;
  topP: number;
  repeatPenalty: number;
  maxTokens: number;
  seed: number;
  
  // Model configurations
  models: {
    [key: string]: ModelConfig;
  };
}

export interface ModelConfig {
  filename: string;
  name: string;
  description: string;
  contextWindow: number;
  temperature: number;
  quantization: string;
  threads?: number;             // Model-specific thread count
  gpuLayers?: number;           // For future GPU support
}

// Performance profiles for different use cases
export enum PerformanceProfile {
  FAST = 'fast',           // Low latency, smaller context
  BALANCED = 'balanced',   // Good mix of speed and quality
  QUALITY = 'quality',     // Higher quality, larger context
  MEMORY = 'memory',       // Optimized for large models
  BATCH = 'batch'          // Optimized for batch processing
}

// Profile configurations optimized for AMD Ryzen 7 PRO
export const performanceProfiles: Record<PerformanceProfile, Partial<LlamaCppOptimizedConfig>> = {
  [PerformanceProfile.FAST]: {
    cpuThreads: 8,           // Half cores for lower latency
    contextSize: 2048,
    batchSize: 256,
    ubatchSize: 128,
    useMlock: true,
    temperature: 0.1
  },
  [PerformanceProfile.BALANCED]: {
    cpuThreads: 12,          // 75% cores for balance
    contextSize: 4096,
    batchSize: 512,
    ubatchSize: 256,
    useMlock: true,
    temperature: 0.3
  },
  [PerformanceProfile.QUALITY]: {
    cpuThreads: 14,          // Most cores for quality
    contextSize: 8192,
    batchSize: 1024,
    ubatchSize: 512,
    useMlock: true,
    temperature: 0.5
  },
  [PerformanceProfile.MEMORY]: {
    cpuThreads: 10,          // Fewer threads for memory-bound
    contextSize: 16384,
    batchSize: 2048,
    ubatchSize: 512,
    useMlock: true,
    useMmap: true,
    temperature: 0.3
  },
  [PerformanceProfile.BATCH]: {
    cpuThreads: 16,          // All cores for throughput
    contextSize: 4096,
    batchSize: 2048,
    ubatchSize: 1024,
    useMlock: true,
    temperature: 0.2
  }
};

// Dynamic tuning based on model size
export function getDynamicThreadCount(modelSizeGB: number, totalMemoryGB: number = 64): number {
  // AMD Ryzen 7 PRO specific tuning
  if (modelSizeGB < 1) {
    return 6;  // Small models: fewer threads for lower latency
  } else if (modelSizeGB < 4) {
    return 10; // Medium models: balanced thread count
  } else if (modelSizeGB < 8) {
    return 12; // Large models: more threads but leave headroom
  } else {
    return 14; // Very large models: most threads but keep system responsive
  }
}

// Get optimal batch size based on model and memory
export function getOptimalBatchSize(modelSizeGB: number, contextSize: number): { batch: number; ubatch: number } {
  const memoryFactorGB = 64; // Your system RAM
  
  // Calculate based on available memory and model size
  const availableMemoryGB = memoryFactorGB - (modelSizeGB * 2); // Reserve 2x model size
  
  if (availableMemoryGB > 40) {
    // Plenty of memory: maximize batch sizes
    return { batch: 2048, ubatch: 1024 };
  } else if (availableMemoryGB > 20) {
    // Good memory: balanced batch sizes
    return { batch: 1024, ubatch: 512 };
  } else if (availableMemoryGB > 10) {
    // Moderate memory: conservative batch sizes
    return { batch: 512, ubatch: 256 };
  } else {
    // Limited memory: minimal batch sizes
    return { batch: 256, ubatch: 128 };
  }
}

// Detect system capabilities
async function detectSystemCapabilities() {
  try {
    // Get CPU info (SECURITY: Use execFile for safer execution)
    const { stdout: cpuInfo } = await execFileAsync('lscpu', []);
    const physicalCores = parseInt(cpuInfo.match(/Core\(s\) per socket:\s+(\d+)/)?.[1] || '8') * 
                         parseInt(cpuInfo.match(/Socket\(s\):\s+(\d+)/)?.[1] || '1');
    
    // Check for AVX support (SECURITY: Read file directly)
    const fs = await import('fs/promises');
    const cpuInfoContent = await fs.readFile('/proc/cpuinfo', 'utf-8');
    const cpuFlags = cpuInfoContent.split('\n').find(line => line.startsWith('flags')) || '';
    const hasAVX2 = cpuFlags.includes('avx2');
    const hasFMA = cpuFlags.includes('fma');
    const hasF16C = cpuFlags.includes('f16c');
    
    // Get memory info (SECURITY: Use execFile)
    const { stdout: freeOutput } = await execFileAsync('free', ['-b']);
    const memInfo = freeOutput.split('\n').find(line => line.startsWith('Mem:')) || '';
    const totalMemory = parseInt(memInfo.split(/\s+/)[1] || '0');
    
    return {
      physicalCores,
      hasAVX2,
      hasFMA,
      hasF16C,
      totalMemoryGB: Math.floor(totalMemory / (1024 * 1024 * 1024))
    };
  } catch (error) {
    console.warn('Could not detect system capabilities, using defaults', error);
    return {
      physicalCores: 16,
      hasAVX2: true,
      hasFMA: true,
      hasF16C: true,
      totalMemoryGB: 64
    };
  }
}

// Create optimized configuration
export async function createOptimizedConfig(profile: PerformanceProfile = PerformanceProfile.BALANCED): Promise<LlamaCppOptimizedConfig> {
  const capabilities = await detectSystemCapabilities();
  
  // Get profile settings
  const profileSettings = performanceProfiles[profile] || performanceProfiles[PerformanceProfile.BALANCED];
  
  // Calculate optimal thread count (AMD Ryzen specific: avoid hyperthreading for compute)
  const optimalThreads = Math.min(capabilities.physicalCores, 16);
  
  // AMD Ryzen 7 PRO specific: Use CCX-aware thread allocation
  // Ryzen 7 has 2 CCX with 8 cores each, optimize for cache locality
  const ccxAwareThreads = profileSettings.cpuThreads || optimalThreads;
  const cpuAffinity = ccxAwareThreads <= 8 
    ? `0-${ccxAwareThreads - 1}`  // Single CCX for small workloads
    : `0-${ccxAwareThreads - 1}`; // Both CCX for large workloads
  
  return {
    // Paths
    executablePath: process.env.LLAMA_CPP_PATH || join(__dirname, '../../llama.cpp/build/bin/llama-cli'),
    serverPath: process.env.LLAMA_SERVER_PATH || join(__dirname, '../../llama.cpp/build/bin/llama-server'),
    modelsPath: process.env.LLAMA_MODELS_PATH || join(__dirname, '../../models'),
    
    // AMD Ryzen Optimization with profile override
    cpuThreads: parseInt(process.env.LLAMA_CPU_THREADS || String(profileSettings.cpuThreads || ccxAwareThreads)),
    cpuAffinity: process.env.LLAMA_CPU_AFFINITY || cpuAffinity,
    numaMode: (process.env.LLAMA_NUMA_MODE as any) || 'distribute',
    
    // Memory Management (optimized for 64GB RAM)
    useMlock: process.env.LLAMA_USE_MLOCK === 'true' || profileSettings.useMlock !== false,
    useMmap: process.env.LLAMA_USE_MMAP !== 'false' && profileSettings.useMmap !== false,
    
    // Performance Tuning with profile settings
    contextSize: parseInt(process.env.LLAMA_CONTEXT_SIZE || String(profileSettings.contextSize || 4096)),
    batchSize: parseInt(process.env.LLAMA_BATCH_SIZE || String(profileSettings.batchSize || 512)),
    ubatchSize: parseInt(process.env.LLAMA_UBATCH_SIZE || String(profileSettings.ubatchSize || 256)),
    
    // Inference Parameters
    temperature: parseFloat(process.env.LLAMA_TEMPERATURE || '0.3'),
    topK: parseInt(process.env.LLAMA_TOP_K || '40'),
    topP: parseFloat(process.env.LLAMA_TOP_P || '0.9'),
    repeatPenalty: parseFloat(process.env.LLAMA_REPEAT_PENALTY || '1.1'),
    maxTokens: parseInt(process.env.LLAMA_MAX_TOKENS || '2048'),
    seed: parseInt(process.env.LLAMA_SEED || '-1'),
    
    // Model configurations optimized for AMD Ryzen with dynamic tuning
    models: {
      // Stage 2: Primary analysis model (~1.5GB)
      'llama-3.2-3b': {
        filename: 'llama-3.2-3b-instruct?.Q4_K_M?.gguf',
        name: 'Llama 3.2 3B Instruct',
        description: 'Primary model for Stage 2 email analysis',
        contextWindow: profileSettings.contextSize || 8192,
        temperature: 0.3,
        quantization: 'Q4_K_M',
        threads: getDynamicThreadCount(1.5, capabilities.totalMemoryGB)
      },
      
      // Stage 3: Critical analysis model (~7GB)
      'phi-4-14b': {
        filename: 'phi-4-14b-tools?.Q3_K_S?.gguf',
        name: 'Phi-4 14B Tools',
        description: 'Critical analysis for Stage 3',
        contextWindow: profileSettings.contextSize || 16384,
        temperature: 0.3,
        quantization: 'Q3_K_S',
        threads: getDynamicThreadCount(7, capabilities.totalMemoryGB)
      },
      
      // Walmart NLP model (~0.5GB)
      'qwen3-0.6b': {
        filename: 'qwen3-0.6b-instruct?.Q8_0?.gguf',
        name: 'Qwen3 0.6B',
        description: 'Fast NLP for Walmart agent',
        contextWindow: Math.min(profileSettings.contextSize || 8192, 8192),
        temperature: 0.5,
        quantization: 'Q8_0',
        threads: getDynamicThreadCount(0.5, capabilities.totalMemoryGB)
      },
      
      // Testing model (~0.7GB)
      'tinyllama-1.1b': {
        filename: 'tinyllama-1.1b-chat?.Q4_K_M?.gguf',
        name: 'TinyLlama 1.1B',
        description: 'Fast testing and development',
        contextWindow: Math.min(profileSettings.contextSize || 2048, 2048),
        temperature: 0.7,
        quantization: 'Q4_K_M',
        threads: getDynamicThreadCount(0.7, capabilities.totalMemoryGB)
      }
    }
  };
}

/**
 * Build optimized llama.cpp command with AMD Ryzen tuning
 */
export function buildOptimizedCommand(
  config: LlamaCppOptimizedConfig,
  modelName: string,
  prompt: string,
  options?: Partial<LlamaCppOptimizedConfig>
): string[] {
  const mergedConfig = { ...config, ...options };
  const model = mergedConfig.models[modelName];
  
  if (!model) {
    throw new Error(`Model ${modelName} not found in configuration`);
  }
  
  // SECURITY: Validate and sanitize model path to prevent path traversal
  const validateModelPath = (basePath: string, filename: string): string => {
    // First check for any dangerous patterns
    const dangerousPatterns = [
      /\.\.\//g,     // Unix path traversal
      /\.\.\\/g,     // Windows path traversal
      /\.\.%2f/gi,   // URL encoded traversal
      /\.\.%5c/gi,   // URL encoded Windows traversal
      /\x00/g,       // Null bytes
      /[;&|`$()<>]/g // Shell metacharacters
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(filename)) {
        throw new Error('Security: Path traversal or command injection attempt detected');
      }
    }
    
    // Remove any remaining suspicious characters
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._?-]/g, '_');
    const fullPath = normalize(join(basePath, sanitizedFilename));
    const resolvedBase = resolve(basePath);
    const resolvedPath = resolve(fullPath);
    
    // Ensure the resolved path is within the models directory
    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error('Security: Path traversal detected - path escapes base directory');
    }
    
    // Check if path exists and validate it's a regular file (not symlink)
    if (existsSync(resolvedPath)) {
      const stats = statSync(resolvedPath, { throwIfNoEntry: false });
      if (stats?.isSymbolicLink()) {
        throw new Error('Security: Symbolic links are not allowed for model files');
      }
      if (!stats?.isFile()) {
        throw new Error('Security: Model path must be a regular file');
      }
    }
    
    return resolvedPath;
  };
  
  const modelPath = validateModelPath(mergedConfig.modelsPath, model.filename);
  
  // SECURITY: Validate prompt to prevent command injection
  const sanitizePrompt = (input: string): string => {
    // Remove shell metacharacters and control characters
    return input
      .replace(/[;&|`$()<>\n\r]/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .substring(0, 10000); // Limit prompt length
  };
  
  const sanitizedPrompt = sanitizePrompt(prompt);
  
  // Build command arguments (using array form prevents shell injection)
  const args: string[] = [
    '-m', modelPath,
    '-p', sanitizedPrompt,
    '-n', mergedConfig?.maxTokens?.toString(),
    '-c', model?.contextWindow?.toString(),
    '-t', (model.threads || mergedConfig.cpuThreads).toString(),
    '-b', mergedConfig?.batchSize?.toString(),
    '--ubatch-size', mergedConfig?.ubatchSize?.toString(),
    '--temp', model?.temperature?.toString(),
    '--top-k', mergedConfig?.topK?.toString(),
    '--top-p', mergedConfig?.topP?.toString(),
    '--repeat-penalty', mergedConfig?.repeatPenalty?.toString(),
    '--log-disable'
  ];
  
  // Add memory management flags
  if (mergedConfig.useMlock) {
    args.push('--mlock');
  }
  
  if (!mergedConfig.useMmap) {
    args.push('--no-mmap');
  }
  
  // Add NUMA optimization
  if (mergedConfig.numaMode !== 'none') {
    args.push('--numa', mergedConfig.numaMode);
  }
  
  // AMD Ryzen specific: Add cache-aware optimizations
  args.push('--threads-batch', Math.min(4, model.threads || 4).toString()); // Batch thread pool
  
  // Add CPU affinity (commented out as it may need sudo)
  // if (mergedConfig.cpuAffinity) {
  //   args.push('--cpu-mask', mergedConfig.cpuAffinity);
  // }
  
  // Add seed if specified
  if (mergedConfig.seed >= 0) {
    args.push('--seed', mergedConfig?.seed?.toString());
  }
  
  return args;
}

/**
 * Execute llama.cpp inference with optimized settings
 */
export async function runOptimizedInference(
  modelName: string,
  prompt: string,
  options?: Partial<LlamaCppOptimizedConfig>
): Promise<string> {
  const config = await createOptimizedConfig();
  const command = buildOptimizedCommand(config, modelName, prompt, options);
  
  // Set environment variables for optimal AMD Ryzen performance
  const env = {
    ...process.env,
    OMP_NUM_THREADS: config.cpuThreads.toString(),
    OMP_PROC_BIND: 'spread',           // Distribute threads across cores
    OMP_PLACES: 'threads',             // Thread placement strategy
    GOMP_CPU_AFFINITY: config.cpuAffinity,
    MKL_NUM_THREADS: config.cpuThreads.toString(),
    OPENBLAS_NUM_THREADS: config.cpuThreads.toString(),
    MALLOC_ARENA_MAX: '2',             // Reduce memory fragmentation
    MALLOC_MMAP_THRESHOLD_: '131072',  // 128KB threshold for mmap
    MALLOC_TRIM_THRESHOLD_: '131072',  // Trim threshold
    TOKENIZERS_PARALLELISM: 'false',
    // AMD specific
    GGML_CUDA_NO_PINNED: '1',         // Disable pinned memory if no GPU
    LLAMA_NO_ACCELERATE: '1'          // Disable accelerate on CPU-only
  };
  
  try {
    // SECURITY: Use execFile to prevent shell injection
    const { stdout, stderr } = await execFileAsync(config.executablePath, args, {
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      env
    });
    
    if (stderr && !stderr.includes('llama_') && !stderr.includes('ggml_')) {
      console.warn('llama.cpp warning:', stderr);
    }
    
    return stdout.trim();
  } catch (error: any) {
    console.error('llama.cpp execution error:', error);
    throw new Error(`Failed to run llama.cpp: ${error.message}`);
  }
}

/**
 * Start llama.cpp server with optimized settings
 */
export async function startOptimizedServer(
  modelName: string,
  port: number = 8081
): Promise<any> {
  const config = await createOptimizedConfig();
  const model = config.models[modelName];
  
  if (!model) {
    throw new Error(`Model ${modelName} not found`);
  }
  
  const modelPath = join(config.modelsPath, model.filename);
  
  // SECURITY: Validate port number
  if (port < 1024 || port > 65535) {
    throw new Error('Security: Invalid port number');
  }
  
  const args = [
    '-m', modelPath,
    '--host', '127.0.0.1', // SECURITY: Bind to localhost only
    '--port', port.toString(),
    '-c', model?.contextWindow?.toString(),
    '-t', (model.threads || config.cpuThreads).toString(),
    '-b', config?.batchSize?.toString(),
    '--ubatch-size', config?.ubatchSize?.toString(),
    '--parallel', '4',
    '--threads-http', '4',
    '--log-disable'
  ];
  
  if (config.useMlock) {
    args.push('--mlock');
  }
  
  if (config.numaMode !== 'none') {
    args.push('--numa', config.numaMode);
  }
  
  const env = {
    ...process.env,
    OMP_NUM_THREADS: config.cpuThreads.toString(),
    OMP_PROC_BIND: 'spread',
    OMP_PLACES: 'threads',
    GOMP_CPU_AFFINITY: config.cpuAffinity,
    OPENBLAS_NUM_THREADS: config.cpuThreads.toString(),
    MALLOC_ARENA_MAX: '2',
    MALLOC_MMAP_THRESHOLD_: '131072',
    MALLOC_TRIM_THRESHOLD_: '131072',
    TOKENIZERS_PARALLELISM: 'false',
    GGML_CUDA_NO_PINNED: '1',
    LLAMA_NO_ACCELERATE: '1'
  };
  
  const server = spawn(config.serverPath, args, { env });
  
  server?.stdout?.on('data', (data: any) => {
    console.log(`[llama.cpp server]: ${data}`);
  });
  
  server?.stderr?.on('data', (data: any) => {
    if (!data.toString().includes('llama_') && !data.toString().includes('ggml_')) {
      console.error(`[llama.cpp server error]: ${data}`);
    }
  });
  
  server.on('close', (code: any) => {
    console.log(`[llama.cpp server] exited with code ${code}`);
  });
  
  // Wait for server to be ready
  await new Promise((resolve: any) => setTimeout(resolve, 3000));
  
  return server;
}

/**
 * Benchmark model performance
 */
export async function benchmarkModel(
  modelName: string,
  testPrompt: string = "The capital of France is"
): Promise<{ tokensPerSecond: number; totalTime: number }> {
  const startTime = Date.now();
  const config = await createOptimizedConfig();
  
  // SECURITY: Sanitize test prompt
  const sanitizedPrompt = testPrompt
    .replace(/[;&|`$()<>\n\r]/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .substring(0, 1000);
  
  // Run with timing
  const command = buildOptimizedCommand(config, modelName, sanitizedPrompt);
  command.push('--timings');
  
  // SECURITY: Use execFile instead of exec
  const { stdout } = await execFileAsync(config.executablePath, command, {
    maxBuffer: 1024 * 1024 * 10,
    env: {
      ...process.env,
      OMP_NUM_THREADS: config.cpuThreads.toString(),
      OMP_PROC_BIND: 'spread',
      OMP_PLACES: 'threads',
      GOMP_CPU_AFFINITY: config.cpuAffinity,
      OPENBLAS_NUM_THREADS: config.cpuThreads.toString(),
      MALLOC_ARENA_MAX: '2',
      TOKENIZERS_PARALLELISM: 'false'
    }
  });
  
  const totalTime = (Date.now() - startTime) / 1000;
  
  // Parse timing info from output
  const timingMatch = stdout.match(/eval time.*\(([0-9.]+) tokens per second\)/);
  const tokensPerSecond = timingMatch ? parseFloat(timingMatch[1] || '0') : 0;
  
  return { tokensPerSecond, totalTime };
}

// Export singleton instance
let configInstance: LlamaCppOptimizedConfig | null = null;

export async function getOptimizedConfig(): Promise<LlamaCppOptimizedConfig> {
  if (!configInstance) {
    configInstance = await createOptimizedConfig();
  }
  return configInstance;
}

export default {
  createOptimizedConfig,
  buildOptimizedCommand,
  runOptimizedInference,
  startOptimizedServer,
  benchmarkModel,
  getOptimizedConfig,
  // Performance utilities
  PerformanceProfile,
  performanceProfiles,
  getDynamicThreadCount,
  getOptimalBatchSize
};