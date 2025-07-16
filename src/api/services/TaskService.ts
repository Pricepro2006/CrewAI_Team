import { MaestroFramework } from '../../core/maestro/MaestroFramework';
import type { Task, TaskResult } from '../../core/maestro/types';
import { v4 as uuidv4 } from 'uuid';

export class TaskService {
  private activeTasks: Map<string, TaskStatus>;

  constructor(private maestro: MaestroFramework) {
    this.activeTasks = new Map();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.maestro.on('task:submitted', ({ taskId, task }) => {
      this.activeTasks.set(taskId, {
        id: taskId,
        status: 'queued',
        task,
        submittedAt: new Date(),
        progress: 0
      });
    });

    this.maestro.on('task:started', ({ taskId }) => {
      const status = this.activeTasks.get(taskId);
      if (status) {
        status.status = 'running';
        status.startedAt = new Date();
        status.progress = 10;
      }
    });

    this.maestro.on('task:completed', ({ taskId, result }) => {
      const status = this.activeTasks.get(taskId);
      if (status) {
        status.status = 'completed';
        status.completedAt = new Date();
        status.progress = 100;
        status.result = result;
      }
    });

    this.maestro.on('task:failed', ({ taskId, error }) => {
      const status = this.activeTasks.get(taskId);
      if (status) {
        status.status = 'failed';
        status.completedAt = new Date();
        status.error = error;
      }
    });
  }

  async submitTask(task: Omit<Task, 'id'>): Promise<string> {
    const fullTask: Task = {
      ...task,
      id: uuidv4()
    };

    return await this.maestro.submitTask(fullTask);
  }

  getTaskStatus(taskId: string): TaskStatus | null {
    return this.activeTasks.get(taskId) || null;
  }

  getAllTasks(): TaskStatus[] {
    return Array.from(this.activeTasks.values())
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  getActiveTasks(): TaskStatus[] {
    return this.getAllTasks().filter(
      task => task.status === 'running' || task.status === 'queued'
    );
  }

  getCompletedTasks(): TaskStatus[] {
    return this.getAllTasks().filter(
      task => task.status === 'completed' || task.status === 'failed'
    );
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const status = this.activeTasks.get(taskId);
    if (!status || status.status !== 'queued') {
      return false;
    }

    // TODO: Implement cancellation in MaestroFramework
    status.status = 'cancelled';
    status.completedAt = new Date();
    return true;
  }

  clearCompletedTasks(): void {
    for (const [taskId, status] of this.activeTasks.entries()) {
      if (status.status === 'completed' || status.status === 'failed') {
        this.activeTasks.delete(taskId);
      }
    }
  }

  getQueueStatus(): QueueStatus {
    const tasks = this.getAllTasks();
    return {
      total: tasks.length,
      queued: tasks.filter(t => t.status === 'queued').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
  }
}

interface TaskStatus {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
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
