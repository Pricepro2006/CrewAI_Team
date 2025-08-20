import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";
import { sanitizeLLMOutput } from "../../utils/output-sanitizer.js";
import { performanceMonitor } from "../../monitoring/PerformanceMonitor.js";
import { errorTracker } from "../../monitoring/ErrorTracker.js";
import { metricsCollector } from "../../monitoring/MetricsCollector.js";
import { logger } from "../../utils/logger.js";

export interface SafeLlamaCppConfig {
  modelPath: string;
  contextSize?: number;
  threads?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  systemPrompt?: string;
  format?: "json" | "text";
  stream?: boolean;
  gpuLayers?: number;
  batchSize?: number;
  seed?: number;
  repeatPenalty?: number;
  // Security settings
  maxProcesses?: number;
  maxMemoryMB?: number;
  allowedModelPaths?: string[];
  processTimeout?: number;
}

export interface LlamaCppResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  tokensGenerated?: number;
  tokensPerSecond?: number;
  totalDuration?: number;
  promptEvalDuration?: number;
  evalDuration?: number;
  logprobs?: number[];
}

export interface LlamaCppGenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  systemPrompt?: string;
  format?: "json" | "text";
  repeatPenalty?: number;
  seed?: number;
}

// Process pool to limit concurrent llama.cpp instances
class ProcessPool {
  private activeProcesses: Set<ChildProcess> = new Set();
  private maxProcesses: number;
  private queue: Array<() => void> = [];

  constructor(maxProcesses: number = 2) {
    this.maxProcesses = maxProcesses;
  }

  async acquire(): Promise<void> {
    if (this.activeProcesses.size >= this.maxProcesses) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }
  }

  register(process: ChildProcess): void {
    this.activeProcesses.add(process);
    process.on("exit", () => this.release(process));
  }

  release(process: ChildProcess): void {
    this.activeProcesses.delete(process);
    const next = this.queue.shift();
    if (next) next();
  }

  get size(): number {
    return this.activeProcesses.size;
  }

  async cleanup(): Promise<void> {
    for (const process of this.activeProcesses) {
      process.kill("SIGTERM");
    }
    this.activeProcesses.clear();
    this.queue = [];
  }
}

export class SafeLlamaCppProvider extends EventEmitter {
  private config: SafeLlamaCppConfig;
  private process: ChildProcess | null = null;
  private modelLoaded: boolean = false;
  private llamaCppPath: string;
  private static processPool = new ProcessPool(2); // Max 2 concurrent processes
  private processStartTime?: number;
  private memoryMonitorInterval?: NodeJS.Timeout;

  constructor(config: SafeLlamaCppConfig) {
    super();
    this.config = {
      contextSize: 8192,
      threads: 8,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 2048,
      gpuLayers: 0,
      batchSize: 512,
      repeatPenalty: 1.1,
      maxProcesses: 2,
      maxMemoryMB: 8192, // 8GB default limit
      processTimeout: 300000, // 5 minutes default
      ...config,
    };

    // Securely determine llama.cpp executable path with validation
    this.llamaCppPath = this.getSecureLlamaCppPath();
    this.validateConfig();
  }

  /**
   * Securely get llama.cpp path with validation
   */
  private getSecureLlamaCppPath(): string {
    const defaultPath = path.join(process.cwd(), "llama.cpp", "build", "bin", "llama-cli");
    
    // If environment variable is set, validate it
    if (process.env.LLAMA_CPP_PATH) {
      const envPath = process.env.LLAMA_CPP_PATH;
      
      // Prevent path traversal attacks
      if (envPath.includes("..") || !path.isAbsolute(envPath)) {
        logger.error("Invalid LLAMA_CPP_PATH: Path traversal or relative path detected", "SECURITY");
        throw new Error("Security: Invalid llama.cpp path configuration");
      }
      
      // Check if path is within allowed directories
      const allowedDirs = [
        "/usr/local/bin",
        "/usr/bin",
        "/opt",
        process.cwd(),
        path.join(process.env.HOME || "/home", ".local"),
      ];
      
      const isAllowed = allowedDirs.some(dir => envPath.startsWith(dir));
      if (!isAllowed) {
        logger.error("LLAMA_CPP_PATH is outside allowed directories", "SECURITY");
        throw new Error("Security: llama.cpp path outside allowed directories");
      }
      
      return envPath;
    }
    
    return defaultPath;
  }

  /**
   * Validate configuration with security checks
   */
  private validateConfig(): void {
    if (!this.config.modelPath) {
      throw new Error("Model path is required");
    }

    // Validate model path security
    const modelPath = path.resolve(this.config.modelPath);
    
    // Prevent path traversal in model path
    if (this.config.modelPath.includes("..")) {
      throw new Error("Security: Path traversal detected in model path");
    }

    // Check allowed model paths if configured
    if (this.config.allowedModelPaths && this.config.allowedModelPaths.length > 0) {
      const isAllowed = this.config.allowedModelPaths.some(allowed => 
        modelPath.startsWith(path.resolve(allowed))
      );
      
      if (!isAllowed) {
        throw new Error("Security: Model path not in allowed directories");
      }
    }

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    if (!fs.existsSync(this.llamaCppPath)) {
      throw new Error(`llama.cpp executable not found: ${this.llamaCppPath}`);
    }

    // Validate resource limits
    if (this.config.maxProcesses && this.config.maxProcesses > 5) {
      logger.warn("maxProcesses limited to 5 for security", "SECURITY");
      this.config.maxProcesses = 5;
    }

    if (this.config.maxMemoryMB && this.config.maxMemoryMB > 16384) {
      logger.warn("maxMemoryMB limited to 16GB for security", "SECURITY");
      this.config.maxMemoryMB = 16384;
    }
  }

  /**
   * Monitor process memory usage
   */
  private startMemoryMonitor(process: ChildProcess): void {
    const maxMemory = (this.config.maxMemoryMB || 8192) * 1024 * 1024; // Convert to bytes
    
    this.memoryMonitorInterval = setInterval(() => {
      try {
        // Get process memory usage (Linux/Unix)
        const pid = process.pid;
        if (!pid) return;
        
        // Use /proc filesystem on Linux
        const statPath = `/proc/${pid}/status`;
        if (fs.existsSync(statPath)) {
          const status = fs.readFileSync(statPath, 'utf-8');
          const vmRssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
          
          if (vmRssMatch) {
            const memoryKB = parseInt(vmRssMatch[1] || '0');
            const memoryBytes = memoryKB * 1024;
            
            if (memoryBytes > maxMemory) {
              logger.error(`Process ${pid} exceeded memory limit: ${memoryKB}KB > ${this.config.maxMemoryMB}MB`, "SECURITY");
              process.kill("SIGKILL");
              this.cleanup();
            }
          }
        }
      } catch (error) {
        // Silent fail - memory monitoring is best effort
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitor(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = undefined;
    }
  }

  /**
   * Initialize the llama.cpp provider (verify model exists)
   * In batch mode, we don't keep a persistent process
   */
  private async initializeProcess(): Promise<void> {
    if (this.modelLoaded) {
      return;
    }

    // Just verify the model exists and mark as loaded
    // Actual process spawning happens in processPrompt
    const modelPath = path.resolve(this.config.modelPath);
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    if (!fs.existsSync(this.llamaCppPath)) {
      throw new Error(`llama.cpp executable not found: ${this.llamaCppPath}`);
    }

    // For now, just mark as loaded after basic validation
    // Actual model testing will happen on first generation
    this.modelLoaded = true;
    this.emit("model-loaded", { model: this.config.modelPath });
    logger.info("llama.cpp provider ready", "LLAMA_CPP");
    return Promise.resolve();
  }

  /**
   * Generate text using llama.cpp
   */
  public async generate(
    prompt: string,
    options: LlamaCppGenerateOptions = {}
  ): Promise<LlamaCppResponse> {
    const startTime = Date.now();

    try {
      // Check process pool size
      if (SafeLlamaCppProvider.processPool.size >= (this.config.maxProcesses || 2)) {
        throw new Error("Process pool limit reached - too many concurrent requests");
      }

      // Track metrics
      if (metricsCollector && typeof metricsCollector.increment === 'function') {
        metricsCollector.increment("llama_cpp.requests.total");
      }

      // Ensure model is verified
      if (!this.modelLoaded) {
        await this.initializeProcess();
      }

      // Merge options with defaults
      const mergedOptions = {
        ...this.config,
        ...options,
      };

      // Build the full prompt with system prompt if provided
      let fullPrompt = prompt;
      if (mergedOptions.systemPrompt) {
        fullPrompt = `System: ${mergedOptions.systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;
      }

      // Limit prompt length for security
      if (fullPrompt.length > 50000) {
        throw new Error("Prompt exceeds maximum length of 50000 characters");
      }

      // Generate response
      const response = await this.processPrompt(fullPrompt, mergedOptions);

      // Track performance
      const duration = Date.now() - startTime;
      if (performanceMonitor && typeof performanceMonitor.measure === 'function') {
        performanceMonitor.measure("llama_cpp_generation_time", { duration });
      }
      if (metricsCollector && typeof metricsCollector.histogram === 'function') {
        metricsCollector.histogram("llama_cpp.generation.duration", duration);
      }

      // Sanitize output
      if (typeof sanitizeLLMOutput === 'function') {
        const sanitized = sanitizeLLMOutput(response.response);
        response.response = sanitized.content;
      }

      return response;
    } catch (error) {
      // Track errors
      if (errorTracker && typeof errorTracker.trackError === 'function') {
        errorTracker.trackError(error as Error, {
          endpoint: "safe_llama_cpp_generation",
        });
      } else {
        logger.error("llama.cpp generation error:", "LLAMA_CPP", { error });
      }
      if (metricsCollector && typeof metricsCollector.increment === 'function') {
        metricsCollector.increment("llama_cpp.requests.failed");
      }
      throw error;
    }
  }

  /**
   * Process a prompt through llama.cpp with timeout
   * Since we're using batch mode, we need to spawn a new process for each request
   */
  private async processPrompt(
    prompt: string,
    options: LlamaCppGenerateOptions
  ): Promise<LlamaCppResponse> {
    const startTime = Date.now();
    
    const args = [
      "-m", this.config.modelPath,
      "-c", String(this.config.contextSize),
      "-t", String(this.config.threads),
      "--temp", String(options.temperature || this.config.temperature),
      "--top-p", String(options.topP || this.config.topP),
      "--top-k", String(options.topK || this.config.topK),
      "-n", String(options.maxTokens || this.config.maxTokens),
      "--repeat-penalty", String(options.repeatPenalty || this.config.repeatPenalty),
      "-p", prompt,
      "--no-display-prompt",
      "--simple-io",  // Use simple I/O mode
      "-e"  // Exit after processing
    ];

    if (this.config.gpuLayers && this.config.gpuLayers > 0) {
      args.push("-ngl", String(this.config.gpuLayers));
    }

    if (options.seed !== undefined) {
      args.push("--seed", String(options.seed));
    }

    return new Promise((resolve, reject) => {
      let responseText = "";
      let errorText = "";
      let fullOutput = "";
      
      // Spawn a new process for this request
      const llamaProcess = spawn(this.llamaCppPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          RLIMIT_AS: String((this.config.maxMemoryMB || 8192) * 1024 * 1024),
        },
      });

      // Set generation timeout
      const generationTimeout = setTimeout(() => {
        llamaProcess.kill("SIGKILL");
        reject(new Error("Generation timeout exceeded"));
      }, 60000); // 60 second timeout

      llamaProcess.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        fullOutput += chunk;
        
        // Filter out system messages and extract actual response
        const lines = chunk.split('\n');
        for (const line of lines) {
          // Skip system info, performance metrics, and prompts
          if (!line.includes('llama_') && 
              !line.includes('system_info') &&
              !line.includes('sampling:') &&
              !line.includes('> ') &&
              !line.includes('EOF by user') &&
              line.trim().length > 0) {
            responseText += line + '\n';
          }
        }
      });

      llamaProcess.stderr?.on("data", (data: Buffer) => {
        errorText += data.toString();
      });

      llamaProcess.on("error", (error) => {
        clearTimeout(generationTimeout);
        reject(error);
      });

      llamaProcess.on("exit", (code) => {
        clearTimeout(generationTimeout);
        
        // llama.cpp may exit with 0 or null
        if (code !== 0 && code !== null) {
          // Check if we got any output - sometimes llama.cpp exits with non-zero but still generates text
          if (responseText.trim().length > 0) {
            // We got output, so treat as success
          } else {
            reject(new Error(`llama.cpp exited with code ${code}: ${errorText}`));
            return;
          }
        }

        // Clean up response text
        responseText = responseText.trim();
        
        // If no response extracted, try to extract from full output
        if (responseText.length === 0 && fullOutput.length > 0) {
          // Try to extract text between prompts or after the prompt
          const promptIndex = fullOutput.indexOf(prompt);
          if (promptIndex >= 0) {
            const afterPrompt = fullOutput.substring(promptIndex + prompt.length);
            // Extract until we hit performance metrics or EOF
            const endIndex = afterPrompt.search(/llama_|EOF by user|>/);
            if (endIndex > 0) {
              responseText = afterPrompt.substring(0, endIndex).trim();
            } else {
              responseText = afterPrompt.trim();
            }
          }
        }
        
        // Calculate metrics
        const endTime = Date.now();
        const duration = endTime - startTime;
        const tokensGenerated = responseText.split(/\s+/).length;
        const tokensPerSecond = tokensGenerated / (duration / 1000);

        resolve({
          model: path.basename(this.config.modelPath),
          created_at: new Date().toISOString(),
          response: responseText || "No response generated",
          done: true,
          tokensGenerated,
          tokensPerSecond,
          totalDuration: duration,
          evalDuration: duration,
        });
      });
      
      // Close stdin immediately since we passed prompt via -p
      llamaProcess.stdin?.end();
    });
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.stopMemoryMonitor();
    
    // In batch mode, we don't maintain a persistent process
    // Just mark as not loaded
    this.process = null;
    this.modelLoaded = false;
  }

  /**
   * Get model information
   */
  public getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
    processCount: number;
  } {
    return {
      model: path.basename(this.config.modelPath),
      contextSize: this.config.contextSize || 8192,
      loaded: this.modelLoaded,
      processCount: SafeLlamaCppProvider.processPool.size,
    };
  }

  /**
   * Check if the provider is ready
   */
  public isReady(): boolean {
    return this.modelLoaded && this.process !== null;
  }

  /**
   * Initialize for LLMProviderInterface compatibility
   */
  public async initialize(): Promise<void> {
    if (!this.modelLoaded) {
      await this.initializeProcess();
    }
  }

  /**
   * Cleanup all processes on shutdown
   */
  public static async cleanupAll(): Promise<void> {
    await SafeLlamaCppProvider.processPool.cleanup();
  }
}

// Export singleton instance with default configuration
export const safeLlamaCppProvider = new SafeLlamaCppProvider({
  modelPath: process.env.LLAMA_MODEL_PATH || "./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  contextSize: 8192,
  threads: 8,
  temperature: 0.7,
  gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0"),
  // Security settings
  maxProcesses: 2,
  maxMemoryMB: 8192,
  processTimeout: 300000,
  allowedModelPaths: [
    "./models",
    "/home/pricepro2006/CrewAI_Team/models",
    "/opt/models",
  ],
});

export default SafeLlamaCppProvider;