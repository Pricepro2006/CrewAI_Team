export interface Task {
  id?: string;
  type: 'agent' | 'tool' | 'composite';
  priority?: number;
  data: any;
  timeout?: number;
  retries?: number;
  dependencies?: string[];
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: Error;
  duration: number;
  metadata?: Record<string, any>;
}

export interface MaestroConfig {
  queueConfig: QueueConfig;
  maxConcurrentTasks: number;
  taskTimeout?: number;
}

export interface QueueConfig {
  maxSize: number;
  strategy: 'fifo' | 'lifo' | 'priority';
}

export interface QueueItem {
  id: string;
  priority: number;
  task: Task;
  context: ExecutionContext;
}

export interface QueueStatus {
  queued: number;
  processing: number;
  capacity: number;
}

export interface ExecutionContext {
  taskId: string;
  task: Task;
  startTime?: Date;
  timeout?: number;
  retryCount?: number;
  metadata?: Record<string, any>;
}
