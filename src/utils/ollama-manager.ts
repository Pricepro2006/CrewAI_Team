/**
 * Ollama Manager - Handles automatic startup and health checks
 */

import { exec, spawn } from "child_process";
import { promisify } from "util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

export class OllamaManager {
  private static readonly OLLAMA_URL = "http://localhost:11434";
  private static readonly STARTUP_TIMEOUT = 30000; // 30 seconds
  private static readonly HEALTH_CHECK_INTERVAL = 1000; // 1 second

  /**
   * Check if Ollama is running
   */
  static async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.OLLAMA_URL}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if Ollama is installed
   */
  static async isInstalled(): Promise<boolean> {
    try {
      // Check standard installation
      const { stdout } = await execAsync("which ollama");
      if (stdout.trim()) return true;
    } catch {
      // Continue to check snap
    }

    try {
      // Check snap installation
      const { stdout } = await execAsync("snap list ollama 2>/dev/null");
      return stdout.includes("ollama");
    } catch {
      return false;
    }
  }

  /**
   * Check if Ollama systemd service exists
   */
  static async hasSystemdService(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        "systemctl status ollama.service 2>/dev/null",
      );
      return !stdout.includes("could not be found");
    } catch {
      // systemctl returns non-zero exit code if service doesn't exist
      return false;
    }
  }

  /**
   * Start Ollama using the appropriate method
   */
  static async start(): Promise<boolean> {
    logger.info("Starting Ollama...", "OLLAMA");

    // Check if already running
    if (await this.isRunning()) {
      logger.info("Ollama is already running", "OLLAMA");
      return true;
    }

    // Check if installed
    if (!(await this.isInstalled())) {
      logger.error(
        "Ollama is not installed. Please install it first:",
        "OLLAMA",
      );
      logger.error("curl -fsSL https://ollama.com/install.sh | sh", "OLLAMA");
      return false;
    }

    // Check if snap is having issues
    try {
      const { stdout: snapList } = await execAsync(
        "snap list ollama 2>/dev/null",
      );
      if (snapList.includes("ollama")) {
        logger.warn(
          "Ollama is installed via snap but snap daemon may not be running",
          "OLLAMA",
        );
        logger.info(
          "Please start Ollama manually in a separate terminal:",
          "OLLAMA",
        );
        logger.info("1. Try: sudo snap start snapd", "OLLAMA");
        logger.info("2. Then: ollama serve", "OLLAMA");
        logger.info("Or reinstall Ollama without snap:", "OLLAMA");
        logger.info("curl -fsSL https://ollama.com/install.sh | sh", "OLLAMA");
        return false;
      }
    } catch {
      // Not a snap issue, continue
    }

    // Try to start via systemd first (preferred method)
    if (await this.hasSystemdService()) {
      try {
        logger.info("Starting Ollama via systemd...", "OLLAMA");
        await execAsync("sudo systemctl start ollama");

        // Wait for startup
        if (await this.waitForStartup()) {
          logger.info("Ollama started successfully via systemd", "OLLAMA");
          return true;
        }
      } catch (error) {
        logger.warn(
          "Failed to start via systemd, trying alternative method",
          "OLLAMA",
        );
      }
    }

    // Try snap command if available
    try {
      const { stdout: snapCheck } = await execAsync(
        "snap list ollama 2>/dev/null",
      );
      if (snapCheck.includes("ollama")) {
        logger.info("Starting Ollama via snap...", "OLLAMA");

        // For snap, we need to use the full command
        const ollamaProcess = spawn("snap", ["run", "ollama", "serve"], {
          detached: true,
          stdio: "ignore",
        });

        ollamaProcess.unref();

        if (await this.waitForStartup()) {
          logger.info("Ollama started successfully via snap", "OLLAMA");
          return true;
        }
      }
    } catch {
      // Not a snap installation, continue to regular method
    }

    // Fallback: Start Ollama directly in background
    try {
      logger.info("Starting Ollama serve in background...", "OLLAMA");

      // Use spawn to run in background
      const ollamaProcess = spawn("ollama", ["serve"], {
        detached: true,
        stdio: "ignore",
      });

      // Unref the process so it can run independently
      ollamaProcess.unref();

      // Wait for startup
      if (await this.waitForStartup()) {
        logger.info("Ollama started successfully in background", "OLLAMA");
        return true;
      }
    } catch (error) {
      logger.error(`Failed to start Ollama: ${error}`, "OLLAMA");
      return false;
    }

    return false;
  }

  /**
   * Wait for Ollama to become available
   */
  private static async waitForStartup(): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      if (await this.isRunning()) {
        return true;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, this.HEALTH_CHECK_INTERVAL),
      );
    }

    return false;
  }

  /**
   * Ensure required models are available
   */
  static async ensureModels(requiredModels: string[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.OLLAMA_URL}/api/tags`);
      const data = await response.json();
      const availableModels = (data.models || []).map((m: any) => m.name);

      for (const model of requiredModels) {
        if (!availableModels.includes(model)) {
          logger.warn(`Model ${model} not found. Pulling it now...`, "OLLAMA");

          try {
            // Pull the model
            await execAsync(`ollama pull ${model}`);
            logger.info(`Successfully pulled ${model}`, "OLLAMA");
          } catch (error) {
            logger.error(`Failed to pull ${model}: ${error}`, "OLLAMA");
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      logger.error(`Failed to check models: ${error}`, "OLLAMA");
      return false;
    }
  }

  /**
   * Comprehensive startup check and initialization
   */
  static async initialize(
    requiredModels: string[] = ["llama3.2:3b"],
  ): Promise<boolean> {
    // Step 1: Check if running
    if (!(await this.isRunning())) {
      // Step 2: Try to start
      if (!(await this.start())) {
        return false;
      }
    }

    // Step 3: Ensure required models
    if (!(await this.ensureModels(requiredModels))) {
      return false;
    }

    logger.info("Ollama is ready with all required models", "OLLAMA");
    return true;
  }
}
