#!/usr/bin/env tsx

/**
 * Ollama Server Management Utilities
 */

import { exec } from "child_process";
import { promisify } from "util";
import chalk from "chalk";
import { Logger } from "../src/utils/logger.js";

const execAsync = promisify(exec);
const logger = new Logger("OllamaManager");

export class OllamaServerManager {
  private maxRetries = 3;
  private retryDelay = 2000;

  async killAllOllamaProcesses(): Promise<void> {
    console.log(chalk.yellow("🔪 Killing all Ollama processes..."));

    try {
      // Kill all ollama processes
      await execAsync('pkill -f "ollama" || true');

      // Also kill any processes on the default Ollama port
      await execAsync("lsof -ti:11434 | xargs kill -9 || true");

      // Wait a moment for processes to die
      await this.sleep(1000);

      // Verify no ollama processes remain
      const { stdout } = await execAsync('pgrep -f "ollama" || echo "none"');
      if (stdout.trim() === "none") {
        console.log(chalk.green("✓ All Ollama processes killed successfully"));
      } else {
        console.log(
          chalk.yellow("⚠️  Some Ollama processes may still be running"),
        );
      }
    } catch (error) {
      logger.error("Error killing Ollama processes:", error);
    }
  }

  async startOllamaServer(): Promise<boolean> {
    console.log(chalk.cyan("🚀 Starting fresh Ollama server..."));

    try {
      // Start Ollama in background
      exec("ollama serve > /tmp/ollama.log 2>&1 &");

      // Wait for server to start
      await this.sleep(3000);

      // Verify server is running
      for (let i = 0; i < this.maxRetries; i++) {
        if (await this.checkOllamaHealth()) {
          console.log(chalk.green("✓ Ollama server started successfully"));
          return true;
        }
        console.log(chalk.yellow(`  Retry ${i + 1}/${this.maxRetries}...`));
        await this.sleep(this.retryDelay);
      }

      return false;
    } catch (error) {
      logger.error("Error starting Ollama server:", error);
      return false;
    }
  }

  async checkOllamaHealth(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        "curl -s http://localhost:11434/api/tags",
      );
      const data = JSON.parse(stdout);
      return data.models && Array.isArray(data.models);
    } catch {
      return false;
    }
  }

  async ensureModelLoaded(modelName: string): Promise<boolean> {
    console.log(chalk.cyan(`📦 Ensuring model ${modelName} is loaded...`));

    try {
      // Check if model exists
      const { stdout } = await execAsync(
        "curl -s http://localhost:11434/api/tags",
      );
      const data = JSON.parse(stdout);
      const models = data.models || [];

      const modelExists = models.some((m: any) => m.name.includes(modelName));

      if (!modelExists) {
        console.log(chalk.yellow(`  Model ${modelName} not found, pulling...`));
        await execAsync(`ollama pull ${modelName}`);
        console.log(chalk.green(`✓ Model ${modelName} pulled successfully`));
      } else {
        console.log(chalk.green(`✓ Model ${modelName} already available`));
      }

      // Load model into memory
      console.log(chalk.cyan("  Loading model into memory..."));
      await execAsync(
        `curl -s -X POST http://localhost:11434/api/generate -d '{"model": "${modelName}", "prompt": "test", "stream": false}'`,
      );
      console.log(chalk.green("✓ Model loaded into memory"));

      return true;
    } catch (error) {
      logger.error(`Error loading model ${modelName}:`, error);
      return false;
    }
  }

  async restartOllamaWithModel(modelName: string): Promise<boolean> {
    console.log(chalk.cyan("\n🔄 Restarting Ollama with fresh server...\n"));

    // Kill all existing processes
    await this.killAllOllamaProcesses();

    // Start fresh server
    const serverStarted = await this.startOllamaServer();
    if (!serverStarted) {
      console.error(chalk.red("❌ Failed to start Ollama server"));
      return false;
    }

    // Ensure model is loaded
    const modelLoaded = await this.ensureModelLoaded(modelName);
    if (!modelLoaded) {
      console.error(chalk.red(`❌ Failed to load model ${modelName}`));
      return false;
    }

    // Test the model
    const testPassed = await this.testModel(modelName);
    if (!testPassed) {
      console.error(chalk.red("❌ Model test failed"));
      return false;
    }

    console.log(chalk.green("\n✅ Ollama server ready with model loaded!\n"));
    return true;
  }

  async testModel(modelName: string): Promise<boolean> {
    console.log(chalk.cyan("🧪 Testing model..."));

    try {
      const testPrompt = 'Respond with just the word "ready" in JSON format';
      const { stdout } = await execAsync(
        `curl -s -X POST http://localhost:11434/api/generate -d '{"model": "${modelName}", "prompt": "${testPrompt}", "stream": false, "format": "json"}'`,
      );

      const response = JSON.parse(stdout);
      if (response.response) {
        console.log(chalk.green("✓ Model test passed"));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Model test failed:", error);
      return false;
    }
  }

  async getSystemInfo(): Promise<void> {
    console.log(chalk.cyan("\n📊 System Information:"));

    try {
      // Check Ollama version
      const { stdout: version } = await execAsync(
        'ollama --version || echo "Not installed"',
      );
      console.log(`  Ollama version: ${version.trim()}`);

      // Check available models
      const { stdout: modelsRaw } = await execAsync(
        'curl -s http://localhost:11434/api/tags || echo "{}"',
      );
      const models = JSON.parse(modelsRaw).models || [];
      console.log(`  Available models: ${models.length}`);
      models.forEach((m: any) => {
        console.log(`    - ${m.name} (${(m.size / 1e9).toFixed(1)}GB)`);
      });

      // Check system resources
      const { stdout: memory } = await execAsync(
        'free -h | grep Mem | awk \'{print $2" total, "$3" used, "$4" free"}\'',
      );
      console.log(`  Memory: ${memory.trim()}`);

      // Check GPU if available
      const { stdout: gpu } = await execAsync(
        'nvidia-smi --query-gpu=name,memory.free --format=csv,noheader || echo "No NVIDIA GPU"',
      );
      console.log(`  GPU: ${gpu.trim()}`);
    } catch (error) {
      logger.error("Error getting system info:", error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export for use in other scripts
export default OllamaServerManager;
