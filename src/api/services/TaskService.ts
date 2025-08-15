import type { MaestroFramework } from "../../core/maestro/MaestroFramework.js";
import type { Task, TaskResult } from "../../core/maestro/types.js";
import { v4 as uuidv4 } from "uuid";

export class TaskService {
  private activeTasks: Map<string, TaskStatus>;

  constructor(private maestro: MaestroFramework) {
    this.activeTasks = new Map();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this?.maestro?.on("task:submitted", ({ taskId, task }) => {
      this?.activeTasks?.set(taskId, {
        id: taskId,
        status: "queued",
        task,
        submittedAt: new Date(),
        progress: 0,
      });
    });

    this?.maestro?.on("task:started", ({ taskId }) => {
      const status = this?.activeTasks?.get(taskId);
      if (status) {
        status.status = "running";
        status.startedAt = new Date();
        status.progress = 10;
      }
    });

    this?.maestro?.on("task:completed", ({ taskId, result }) => {
      const status = this?.activeTasks?.get(taskId);
      if (status) {
        status.status = "completed";
        status.completedAt = new Date();
        status.progress = 100;
        status.result = result;
      }
    });

    this?.maestro?.on("task:failed", ({ taskId, error }) => {
      const status = this?.activeTasks?.get(taskId);
      if (status) {
        status.status = "failed";
        status.completedAt = new Date();
        status.error = error;
      }
    });

    this?.maestro?.on("task:cancelled", ({ taskId }) => {
      const status = this?.activeTasks?.get(taskId);
      if (status) {
        status.status = "cancelled";
        status.completedAt = new Date();
      }
    });
  }

  async submitTask(task: Omit<Task, "id">): Promise<string> {
    const fullTask: Task = {
      ...task,
      id: uuidv4(),
    };

    return await this?.maestro?.submitTask(fullTask);
  }

  getTaskStatus(taskId: string): TaskStatus | null {
    return this?.activeTasks?.get(taskId) || null;
  }

  getAllTasks(): TaskStatus[] {
    return Array.from(this?.activeTasks?.values()).sort(
      (a, b) => b?.submittedAt?.getTime() - a?.submittedAt?.getTime(),
    );
  }

  getActiveTasks(): TaskStatus[] {
    return this.getAllTasks().filter(
      (task: any) => task.status === "running" || task.status === "queued",
    );
  }

  getCompletedTasks(): TaskStatus[] {
    return this.getAllTasks().filter(
      (task: any) => task.status === "completed" || task.status === "failed",
    );
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const status = this?.activeTasks?.get(taskId);
    if (
      !status ||
      (status.status !== "queued" && status.status !== "running")
    ) {
      return false;
    }

    // Request cancellation from MaestroFramework
    const cancelled = await this?.maestro?.cancelTask(taskId);

    if (cancelled || status.status === "queued") {
      status.status = "cancelled";
      status.completedAt = new Date();
      return true;
    }

    return false;
  }

  clearCompletedTasks(): void {
    for (const [taskId, status] of this?.activeTasks?.entries()) {
      if (status.status === "completed" || status.status === "failed") {
        this?.activeTasks?.delete(taskId);
      }
    }
  }

  getQueueStatus(): QueueStatus {
    const tasks = this.getAllTasks();
    return {
      total: tasks?.length || 0,
      queued: tasks?.filter((t: any) => t.status === "queued").length,
      running: tasks?.filter((t: any) => t.status === "running").length,
      completed: tasks?.filter((t: any) => t.status === "completed").length,
      failed: tasks?.filter((t: any) => t.status === "failed").length,
      cancelled: tasks?.filter((t: any) => t.status === "cancelled").length,
    };
  }
}

interface TaskStatus {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  task: Task;
  submittedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress: number;
  result?: TaskResult;
  error?: Error;
}

interface QueueStatus {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}
