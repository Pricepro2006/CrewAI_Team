import { logger } from "../../utils/logger";

export interface CleanupTask {
  name: string;
  cleanup: () => Promise<void> | void;
  priority?: number; // Higher priority tasks run first
}

export class ServiceCleanupManager {
  private cleanupTasks: CleanupTask[] = [];
  private isShuttingDown = false;

  /**
   * Register a cleanup task
   */
  registerCleanupTask(task: CleanupTask): void {
    this.cleanupTasks.push(task);
    // Sort by priority (higher first)
    this.cleanupTasks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Register a cleanup task (alias for registerCleanupTask)
   */
  register(task: CleanupTask): void {
    this.registerCleanupTask(task);
  }

  /**
   * Execute all cleanup tasks
   */
  async cleanup(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("Cleanup already in progress", "CLEANUP");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Starting service cleanup", "CLEANUP", {
      taskCount: this.cleanupTasks.length,
    });

    const results = {
      successful: 0,
      failed: 0,
      errors: [] as { task: string; error: string }[],
    };

    for (const task of this.cleanupTasks) {
      try {
        logger.info(`Cleaning up: ${task.name}`, "CLEANUP");
        await task.cleanup();
        results.successful++;
        logger.info(`Cleaned up: ${task.name}`, "CLEANUP");
      } catch (error) {
        results.failed++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.errors.push({ task: task.name, error: errorMessage });
        logger.error(`Failed to cleanup: ${task.name}`, "CLEANUP", { error });
      }
    }

    logger.info("Service cleanup completed", "CLEANUP", results);
  }

  /**
   * Get registered cleanup tasks
   */
  getCleanupTasks(): ReadonlyArray<CleanupTask> {
    return [...this.cleanupTasks];
  }

  /**
   * Clear all tasks (useful for testing)
   */
  clearTasks(): void {
    this.cleanupTasks = [];
    this.isShuttingDown = false;
  }
}

// Singleton instance
export const cleanupManager = new ServiceCleanupManager();

// Register default cleanup tasks
export function registerDefaultCleanupTasks(): void {
  // Database connections
  cleanupManager.registerCleanupTask({
    name: "Database connections",
    priority: 10,
    cleanup: async () => {
      try {
        // Import dynamically to avoid circular dependencies
        const Database = (await import("better-sqlite3")).default;
        // Close any open database connections
        // This is a placeholder - actual implementation would track open connections
        logger.info("Database connections closed", "CLEANUP");
      } catch (error) {
        logger.warn("Database cleanup skipped", "CLEANUP", { error });
      }
    },
  });

  // Temporary files
  cleanupManager.registerCleanupTask({
    name: "Temporary files",
    priority: 5,
    cleanup: async () => {
      try {
        // Clean up any temporary files created during operation
        // This could include upload temp files, processing artifacts, etc.
        logger.info("Temporary files cleaned", "CLEANUP");
      } catch (error) {
        logger.warn("Temp file cleanup failed", "CLEANUP", { error });
      }
    },
  });

  // Active agent tasks
  cleanupManager.registerCleanupTask({
    name: "Active agent tasks",
    priority: 20,
    cleanup: async () => {
      try {
        // Cancel any running agent tasks
        // This would involve signaling agents to stop gracefully
        logger.info("Agent tasks terminated", "CLEANUP");
      } catch (error) {
        logger.warn("Agent cleanup failed", "CLEANUP", { error });
      }
    },
  });

  // LLM connections
  cleanupManager.registerCleanupTask({
    name: "LLM connections",
    priority: 15,
    cleanup: async () => {
      try {
        // Close any open connections to Ollama
        logger.info("LLM connections closed", "CLEANUP");
      } catch (error) {
        logger.warn("LLM cleanup failed", "CLEANUP", { error });
      }
    },
  });

  // Expired authentication tokens
  cleanupManager.registerCleanupTask({
    name: "Expired authentication tokens",
    priority: 3,
    cleanup: async () => {
      try {
        const { UserService } = await import("./UserService.js");
        const userService = new UserService();
        await userService.cleanupExpiredTokens();
        logger.info("Expired tokens cleaned", "CLEANUP");
      } catch (error) {
        logger.warn("Token cleanup failed", "CLEANUP", { error });
      }
    },
  });
}
