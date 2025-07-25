import type { Task, MaestroConfig } from "./types";

export interface ExecutionContextConfig {
  taskId: string;
  task: Task;
  timeout?: number;
  config: MaestroConfig;
}

export class ExecutionContext {
  taskId: string;
  task: Task;
  startTime?: Date;
  timeout?: number;
  retryCount: number = 0;
  metadata: Record<string, any> = {};
  private cleanupCallbacks: Array<() => void> = [];
  private timeoutHandle?: NodeJS.Timeout;

  constructor(config: ExecutionContextConfig) {
    this.taskId = config.taskId;
    this.task = config.task;
    this.timeout = config.timeout;
  }

  initialize(): void {
    this.startTime = new Date();

    // Set up timeout if specified
    if (this.timeout) {
      this.timeoutHandle = setTimeout(() => {
        throw new Error(
          `Task ${this.taskId} timed out after ${this.timeout}ms`,
        );
      }, this.timeout);
    }

    // Initialize metadata
    this.metadata = {
      startTime: this.startTime.toISOString(),
      taskType: this.task.type,
      priority: this.task.priority || 0,
    };
  }

  cleanup(): void {
    // Clear timeout
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }

    // Run cleanup callbacks
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Cleanup callback error:", error);
      }
    });

    this.cleanupCallbacks = [];
  }

  addCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }

  updateMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  getElapsedTime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  isTimedOut(): boolean {
    if (!this.timeout || !this.startTime) return false;
    return this.getElapsedTime() > this.timeout;
  }

  setProgress(progress: number): void {
    this.metadata["progress"] = Math.min(100, Math.max(0, progress));
  }

  getProgress(): number {
    return this.metadata["progress"] || 0;
  }

  addLog(message: string, level: "info" | "warn" | "error" = "info"): void {
    if (!this.metadata["logs"]) {
      this.metadata["logs"] = [];
    }

    this.metadata["logs"].push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });
  }

  getState(): ExecutionState {
    return {
      taskId: this.taskId,
      taskType: this.task.type,
      ...(this.startTime && { startTime: this.startTime }),
      elapsedTime: this.getElapsedTime(),
      progress: this.getProgress(),
      retryCount: this.retryCount,
      metadata: { ...this.metadata },
    };
  }
}

export interface ExecutionState {
  taskId: string;
  taskType: string;
  startTime?: Date;
  elapsedTime: number;
  progress: number;
  retryCount: number;
  metadata: Record<string, any>;
}
