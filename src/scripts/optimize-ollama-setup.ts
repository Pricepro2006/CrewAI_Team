#!/usr/bin/env node
/**
 * Ollama Setup Optimization Script
 * Configures Ollama for high-throughput email processing
 */

import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

interface OllamaStatus {
  running: boolean;
  version?: string;
  models?: string[];
  gpu?: boolean;
}

class OllamaSetupOptimizer {
  private ollamaUrl = "http://localhost:11434";

  async run(): Promise<void> {
    logger.info("Starting Ollama optimization setup...");

    try {
      // 1. Check Ollama status
      const status = await this.checkOllamaStatus();
      if (!status.running) {
        logger.error("Ollama is not running. Please start Ollama first.");
        process.exit(1);
      }

      logger.info("Ollama status:", status);

      // 2. Install required models
      await this.installOptimizedModels();

      // 3. Configure Ollama settings
      await this.configureOllama();

      // 4. Preload models
      await this.preloadModels();

      // 5. Run performance test
      await this.runPerformanceTest();

      logger.info("Ollama optimization complete!");
      
      // 6. Print recommendations
      this.printRecommendations();

    } catch (error) {
      logger.error("Optimization failed:", error);
      process.exit(1);
    }
  }

  private async checkOllamaStatus(): Promise<OllamaStatus> {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`);
      const models = response.data.models?.map((m: any) => m.name) || [];
      
      // Check GPU availability
      let gpu = false;
      try {
        const { stdout } = await execAsync("nvidia-smi --query-gpu=name --format=csv,noheader");
        gpu = stdout.trim().length > 0;
      } catch {
        // No NVIDIA GPU
      }

      return {
        running: true,
        version: response.data.version,
        models,
        gpu
      };
    } catch (error) {
      return { running: false };
    }
  }

  private async installOptimizedModels(): Promise<void> {
    const requiredModels = [
      { name: "llama3.2:3b", description: "Primary Phase 2 model" },
      { name: "doomgrave/phi-4:14b-tools-Q3_K_S", description: "Phase 3 strategic analysis" },
      { name: "qwen3:0.6b", description: "Fallback fast model" }
    ];

    for (const model of requiredModels) {
      logger.info(`Installing ${model.name} - ${model.description}`);
      
      try {
        await axios.post(`${this.ollamaUrl}/api/pull`, {
          name: model.name,
          stream: false
        });
        logger.info(`✓ ${model.name} installed successfully`);
      } catch (error) {
        logger.error(`Failed to install ${model.name}:`, error);
      }
    }
  }

  private async configureOllama(): Promise<void> {
    logger.info("Configuring Ollama for optimal performance...");

    // Create optimized modelfile for llama3.2
    const llamaModelfile = `FROM llama3.2:3b

# Optimize for speed
PARAMETER num_ctx 2048
PARAMETER num_batch 512
PARAMETER num_gpu 35
PARAMETER num_thread 8
PARAMETER f16_kv true
PARAMETER use_mlock true
PARAMETER use_mmap true

# Set consistent generation parameters
PARAMETER temperature 0.1
PARAMETER top_k 10
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER stop "\\n\\n"
PARAMETER stop "\`\`\`"
PARAMETER stop "</"

SYSTEM "You are a concise email analyzer. Respond only with JSON."`;

    // Create the optimized model
    try {
      await axios.post(`${this.ollamaUrl}/api/create`, {
        name: "llama3.2:3b-optimized",
        modelfile: llamaModelfile,
        stream: false
      });
      logger.info("✓ Created optimized llama3.2 model");
    } catch (error) {
      logger.warn("Could not create optimized model:", error);
    }

    // Create optimized modelfile for phi-4
    const phiModelfile = `FROM doomgrave/phi-4:14b-tools-Q3_K_S

# Optimize for quality with reasonable speed
PARAMETER num_ctx 4096
PARAMETER num_batch 512
PARAMETER num_gpu 35
PARAMETER num_thread 8
PARAMETER f16_kv true
PARAMETER use_mlock true
PARAMETER use_mmap true

# Strategic analysis parameters
PARAMETER temperature 0.2
PARAMETER top_k 20
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

SYSTEM "You are a strategic business analyst. Provide concise JSON analysis."`;

    try {
      await axios.post(`${this.ollamaUrl}/api/create`, {
        name: "phi-4:14b-optimized",
        modelfile: phiModelfile,
        stream: false
      });
      logger.info("✓ Created optimized phi-4 model");
    } catch (error) {
      logger.warn("Could not create optimized phi-4 model:", error);
    }
  }

  private async preloadModels(): Promise<void> {
    logger.info("Preloading models into memory...");

    const modelsToPreload = [
      "llama3.2:3b",
      "llama3.2:3b-optimized",
      "qwen3:0.6b"
    ];

    for (const model of modelsToPreload) {
      try {
        logger.info(`Preloading ${model}...`);
        const start = Date.now();
        
        await axios.post(`${this.ollamaUrl}/api/generate`, {
          model,
          prompt: "Hello",
          stream: false,
          options: {
            num_predict: 1,
            temperature: 0
          },
          keep_alive: 300 // Keep in memory for 5 minutes
        });

        const loadTime = Date.now() - start;
        logger.info(`✓ ${model} loaded in ${loadTime}ms`);
      } catch (error) {
        logger.error(`Failed to preload ${model}:`, error);
      }
    }
  }

  private async runPerformanceTest(): Promise<void> {
    logger.info("Running performance test...");

    const testPrompt = `Analyze this email and provide a JSON response:

Subject: Urgent: Quote needed for HP servers
Body: We need pricing for 10x HP ProLiant DL380 Gen11 servers with expedited shipping.

Extract: workflow_state, priority, entities`;

    const models = ["llama3.2:3b", "llama3.2:3b-optimized", "qwen3:0.6b"];
    const results: any[] = [];

    for (const model of models) {
      logger.info(`Testing ${model}...`);
      const times: number[] = [];

      // Run 5 tests
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        
        try {
          await axios.post(`${this.ollamaUrl}/api/generate`, {
            model,
            prompt: testPrompt,
            stream: false,
            format: "json",
            options: {
              num_predict: 200,
              temperature: 0.1
            }
          });

          const elapsed = Date.now() - start;
          times.push(elapsed);
        } catch (error) {
          logger.error(`Test failed for ${model}:`, error);
        }
      }

      if (times.length > 0) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const throughput = (1000 / avg) * 60; // emails per minute
        
        results.push({
          model,
          avgLatency: Math.round(avg),
          throughput: Math.round(throughput)
        });
      }
    }

    logger.info("\nPerformance Test Results:");
    logger.info("========================");
    results.forEach(r => {
      logger.info(`${r.model}:`);
      logger.info(`  Average latency: ${r.avgLatency}ms`);
      logger.info(`  Estimated throughput: ${r.throughput} emails/minute`);
    });
  }

  private printRecommendations(): void {
    logger.info("\n🚀 Optimization Recommendations:");
    logger.info("================================");
    logger.info("1. System Configuration:");
    logger.info("   - Ensure Ollama has access to GPU if available");
    logger.info("   - Allocate at least 16GB RAM for models");
    logger.info("   - Use SSD storage for model files");
    logger.info("");
    logger.info("2. Model Usage:");
    logger.info("   - Use llama3.2:3b-optimized for Phase 2 analysis");
    logger.info("   - Use qwen3:0.6b for speed-critical processing");
    logger.info("   - Reserve phi-4 for only critical emails");
    logger.info("");
    logger.info("3. Processing Strategy:");
    logger.info("   - Enable batching for similar emails");
    logger.info("   - Use caching aggressively");
    logger.info("   - Skip Phase 3 for low-priority emails");
    logger.info("");
    logger.info("4. Environment Variables:");
    logger.info("   export OLLAMA_NUM_PARALLEL=4");
    logger.info("   export OLLAMA_MAX_LOADED_MODELS=3");
    logger.info("   export OLLAMA_KEEP_ALIVE=5m");
    logger.info("");
    logger.info("5. Start Processing:");
    logger.info("   npm run process-emails-optimized");
  }
}

// Run the optimizer
if (require.main === module) {
  const optimizer = new OllamaSetupOptimizer();
  optimizer.run().catch(console.error);
}

export { OllamaSetupOptimizer };