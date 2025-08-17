import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import * as fs from "fs";
import { sanitizeLLMOutput } from "../../utils/output-sanitizer.js";
import { performanceMonitor } from "../../monitoring/PerformanceMonitor.js";
import { errorTracker } from "../../monitoring/ErrorTracker.js";
import { metricsCollector } from "../../monitoring/MetricsCollector.js";

export interface LlamaCppConfig {
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
  stopWords?: string[];
}

export class LlamaCppProvider extends EventEmitter {
  private config: LlamaCppConfig;
  private process: ChildProcess | null = null;
  private modelLoaded: boolean = false;
  private requestQueue: Array<{
    prompt: string;
    options: LlamaCppGenerateOptions;
    resolve: (value: LlamaCppResponse) => void;
    reject: (reason: any) => void;
  }> = [];
  private isProcessing: boolean = false;
  private llamaCppPath: string;

  constructor(config: LlamaCppConfig) {
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
      ...config,
    };

    // Determine llama.cpp executable path
    this.llamaCppPath = process.env.LLAMA_CPP_PATH || 
      path.join(process.cwd(), "llama.cpp", "build", "bin", "llama-cli");

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this?.config?.modelPath) {
      throw new Error("Model path is required");
    }

    if (!fs.existsSync(this?.config?.modelPath)) {
      throw new Error(`Model file not found: ${this?.config?.modelPath}`);
    }

    if (!fs.existsSync(this.llamaCppPath)) {
      throw new Error(`llama.cpp executable not found: ${this.llamaCppPath}`);
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): LlamaCppConfig {
    return { ...this.config };
  }

  /**
   * Initialize the llama.cpp process
   */
  private async initializeProcess(): Promise<void> {
    if (this.process && this.modelLoaded) {
      return;
    }

    return new Promise((resolve, reject) => {
      const args = [
        "-m", this?.config?.modelPath,
        "-c", String(this?.config?.contextSize),
        "-t", String(this?.config?.threads),
        "--temp", String(this?.config?.temperature),
        "--top-p", String(this?.config?.topP),
        "--top-k", String(this?.config?.topK),
        "-n", String(this?.config?.maxTokens),
        "--repeat-penalty", String(this?.config?.repeatPenalty),
      ];

      if (this?.config?.gpuLayers && this?.config?.gpuLayers > 0) {
        args.push("-ngl", String(this?.config?.gpuLayers));
      }

      if (this?.config?.batchSize) {
        args.push("-b", String(this?.config?.batchSize));
      }

      if (this?.config?.seed !== undefined) {
        args.push("--seed", String(this?.config?.seed));
      }

      // Add interactive mode for continuous processing
      args.push("-i", "--interactive-first");

      this.process = spawn(this.llamaCppPath, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let initOutput = "";
      let errorOutput = "";

      const initTimeout = setTimeout(() => {
        reject(new Error("Model initialization timeout"));
      }, 60000); // 60 second timeout

      this?.process?.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        initOutput += output;

        // Check if model is loaded
        if (output.includes("llama_model_load") || output.includes("system_info")) {
          clearTimeout(initTimeout);
          this.modelLoaded = true;
          this.emit("model-loaded", { model: this?.config?.modelPath });
          resolve();
        }
      });

      this?.process?.stderr?.on("data", (data: Buffer) => {
        errorOutput += data.toString();
        console.error("llama.cpp error:", data.toString());
      });

      this?.process?.on("error", (error: any) => {
        clearTimeout(initTimeout);
        this.modelLoaded = false;
        reject(error);
      });

      this?.process?.on("exit", (code: any) => {
        this.modelLoaded = false;
        this.process = null;
        if (code !== 0) {
          console.error("llama.cpp process exited with code:", code);
        }
      });
    });
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
      // Track metrics
      metricsCollector.increment("llama_cpp?.requests?.total");

      // Ensure process is initialized
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

      // Generate response
      const response = await this.processPrompt(fullPrompt, mergedOptions);

      // Track performance
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric("llama_cpp_generation_time", duration);
      metricsCollector.recordHistogram("llama_cpp?.generation?.duration", duration);

      // Sanitize output
      response.response = sanitizeLLMOutput(response.response);

      return response;
    } catch (error) {
      // Track errors
      errorTracker.captureError(error as Error, {
        context: "llama_cpp_generation",
        prompt: prompt.substring(0, 100),
      });
      metricsCollector.increment("llama_cpp?.requests?.failed");
      throw error;
    }
  }

  /**
   * Process a prompt through llama.cpp
   */
  private processPrompt(
    prompt: string,
    options: LlamaCppGenerateOptions
  ): Promise<LlamaCppResponse> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.modelLoaded) {
        reject(new Error("llama.cpp process not initialized"));
        return;
      }

      let responseText = "";
      let isGenerating = false;
      const startTime = Date.now();

      const responseHandler = (data: Buffer) => {
        const output = data.toString();
        
        // Check if generation has started
        if (!isGenerating && output.includes(">")) {
          isGenerating = true;
        }

        if (isGenerating) {
          responseText += output;

          // Check for completion markers
          if (output.includes("\n>") || output.includes("[end of text]")) {
            // Remove completion markers and clean up
            responseText = responseText
              .replace(/\n>/g, "")
              .replace(/\[end of text\]/g, "")
              .replace(/>/g, "")
              .trim();

            // Remove handler
            this.process?.stdout?.removeListener("data", responseHandler);

            // Calculate metrics
            const endTime = Date.now();
            const duration = endTime - startTime;
            const tokensGenerated = responseText.split(/\s+/).length;
            const tokensPerSecond = tokensGenerated / (duration / 1000);

            resolve({
              model: path.basename(this?.config?.modelPath),
              created_at: new Date().toISOString(),
              response: responseText,
              done: true,
              tokensGenerated,
              tokensPerSecond,
              totalDuration: duration,
              evalDuration: duration,
            });
          }
        }
      };

      const errorHandler = (data: Buffer) => {
        const error = data.toString();
        console.error("llama.cpp generation error:", error);
        this.process?.stdout?.removeListener("data", responseHandler);
        this.process?.stderr?.removeListener("data", errorHandler);
        reject(new Error(`llama.cpp error: ${error}`));
      };

      // Attach handlers
      this?.process?.stdout?.on("data", responseHandler);
      this?.process?.stderr?.once("data", errorHandler);

      // Send the prompt
      this?.process?.stdin?.write(prompt + "\n");
    });
  }

  /**
   * Stream generate text using llama.cpp
   */
  public async *streamGenerate(
    prompt: string,
    options: LlamaCppGenerateOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();

    try {
      // Ensure process is initialized
      if (!this.modelLoaded) {
        await this.initializeProcess();
      }

      // Build the full prompt
      let fullPrompt = prompt;
      if (options.systemPrompt || this?.config?.systemPrompt) {
        const systemPrompt = options.systemPrompt || this?.config?.systemPrompt;
        fullPrompt = `System: ${systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;
      }

      // Stream the response
      yield* this.streamProcess(fullPrompt, options);

      // Track metrics
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric("llama_cpp_stream_time", duration);
    } catch (error) {
      errorTracker.captureError(error as Error, {
        context: "llama_cpp_stream",
        prompt: prompt.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Stream process implementation
   */
  private async *streamProcess(
    prompt: string,
    options: LlamaCppGenerateOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!this.process || !this.modelLoaded) {
      throw new Error("llama.cpp process not initialized");
    }

    const chunks: string[] = [];
    let isGenerating = false;

    const processChunk = (data: Buffer): string => {
      const output = data.toString();
      
      if (!isGenerating && output.includes(">")) {
        isGenerating = true;
      }

      if (isGenerating) {
        // Clean up the output
        const cleaned = output
          .replace(/\n>/g, "")
          .replace(/\[end of text\]/g, "")
          .replace(/>/g, "");
        
        return cleaned;
      }

      return "";
    };

    // Send the prompt
    this?.process?.stdin?.write(prompt + "\n");

    // Create async iterator for stdout
    const stdout = this?.process?.stdout;
    if (!stdout) {
      throw new Error("Process stdout not available");
    }

    for await (const chunk of stdout) {
      const text = processChunk(chunk);
      if (text) {
        yield text;
        chunks.push(text);

        // Check for completion
        if (text.includes("[end of text]") || chunk.toString().includes("\n>")) {
          break;
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.process) {
      this?.process?.stdin?.write("exit\n");
      this?.process?.kill("SIGTERM");
      
      // Wait for process to exit
      await new Promise<void>((resolve: any) => {
        if (!this.process) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          this.process?.kill("SIGKILL");
          resolve();
        }, 5000);

        this?.process?.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
      this.modelLoaded = false;
    }
  }

  /**
   * Get model information
   */
  public getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
  } {
    return {
      model: path.basename(this?.config?.modelPath),
      contextSize: this?.config?.contextSize || 8192,
      loaded: this.modelLoaded,
    };
  }

  /**
   * Check if the provider is ready
   */
  public isReady(): boolean {
    return this.modelLoaded && this.process !== null;
  }
}

// Export singleton instance with default configuration
export const llamaCppProvider = new LlamaCppProvider({
  modelPath: process.env.LLAMA_MODEL_PATH || "./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
  contextSize: 8192,
  threads: 8,
  temperature: 0.7,
  gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0"),
});

export default LlamaCppProvider;