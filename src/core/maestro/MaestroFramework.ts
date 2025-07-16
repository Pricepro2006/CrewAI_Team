import { EventEmitter } from 'events';
import { TaskQueue } from './TaskQueue';
import { ExecutionContext } from './ExecutionContext';
import { Task, TaskResult, MaestroConfig } from './types';
import { v4 as uuidv4 } from 'uuid';

export class MaestroFramework extends EventEmitter {
  private taskQueue: TaskQueue;
  private executionContexts: Map<string, ExecutionContext>;
  private config: MaestroConfig;
  private isProcessing: boolean = false;
  private activeTaskCount: number = 0;

  constructor(config: MaestroConfig) {
    super();
    this.config = config;
    this.taskQueue = new TaskQueue(config.queueConfig);
    this.executionContexts = new Map();
  }

  async submitTask(task: Task): Promise<string> {
    const taskId = task.id || this.generateTaskId();
    
    // Create execution context
    const context = new ExecutionContext({
      taskId,
      task,
      timeout: task.timeout || this.config.taskTimeout,
      config: this.config
    });
    
    this.executionContexts.set(taskId, context);
    
    // Queue task
    await this.taskQueue.enqueue({
      id: taskId,
      priority: task.priority || 0,
      task,
      context
    });

    this.emit('task:submitted', { taskId, task });
    
    // Start processing if not already running
    this.startProcessing();
    
    return taskId;
  }

  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.isProcessing) {
      // Check if we can process more tasks
      if (this.activeTaskCount >= this.config.maxConcurrentTasks) {
        await this.delay(100);
        continue;
      }
      
      // Get next task from queue
      const queueItem = await this.taskQueue.dequeue();
      if (!queueItem) {
        // No more tasks, wait a bit
        await this.delay(100);
        continue;
      }
      
      // Process task asynchronously
      this.processTask(queueItem).catch(error => {
        console.error('Task processing error:', error);
      });
    }
  }

  private async processTask(queueItem: any): Promise<void> {
    const { id, task, context } = queueItem;
    this.activeTaskCount++;
    
    try {
      this.emit('task:started', { taskId: id });
      
      // Execute task with context
      const result = await this.executeTask(task, context);
      
      this.emit('task:completed', { taskId: id, result });
      
      // Clean up
      this.executionContexts.delete(id);
    } catch (error) {
      this.emit('task:failed', { taskId: id, error });
      
      // Check if we should retry
      if (task.retries && context.retryCount < task.retries) {
        context.retryCount++;
        await this.taskQueue.enqueue(queueItem);
      } else {
        this.executionContexts.delete(id);
      }
    } finally {
      this.activeTaskCount--;
    }
  }

  private async executeTask(
    task: Task, 
    context: ExecutionContext
  ): Promise<TaskResult> {
    const startTime = Date.now();
    
    // Set up execution environment
    context.initialize();
    
    try {
      let result: any;
      
      // Execute based on task type
      switch (task.type) {
        case 'agent':
          result = await this.executeAgentTask(task, context);
          break;
        case 'tool':
          result = await this.executeToolTask(task, context);
          break;
        case 'composite':
          result = await this.executeCompositeTask(task, context);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      const duration = Date.now() - startTime;
      
      return {
        taskId: context.taskId,
        success: true,
        result,
        duration,
        metadata: context.metadata
      };
    } finally {
      context.cleanup();
    }
  }

  private async executeAgentTask(task: Task, context: ExecutionContext): Promise<any> {
    // This would integrate with the AgentRegistry
    // For now, return a placeholder
    return {
      type: 'agent',
      agentType: task.data.agentType,
      result: 'Agent task completed'
    };
  }

  private async executeToolTask(task: Task, context: ExecutionContext): Promise<any> {
    // This would integrate with the Tool system
    return {
      type: 'tool',
      toolName: task.data.toolName,
      result: 'Tool task completed'
    };
  }

  private async executeCompositeTask(task: Task, context: ExecutionContext): Promise<any> {
    // Execute multiple sub-tasks
    const subResults = [];
    
    for (const subTask of task.data.subTasks || []) {
      const subTaskId = await this.submitTask(subTask);
      // Wait for completion (simplified - in reality would track separately)
      subResults.push({ subTaskId });
    }
    
    return {
      type: 'composite',
      subResults
    };
  }

  private generateTaskId(): string {
    return `task-${uuidv4()}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown(): Promise<void> {
    this.isProcessing = false;
    
    // Wait for active tasks to complete
    while (this.activeTaskCount > 0) {
      await this.delay(100);
    }
    
    // Clear queue
    this.taskQueue.clear();
    this.executionContexts.clear();
  }

  getQueueStatus(): any {
    return {
      ...this.taskQueue.getStatus(),
      activeTasks: this.activeTaskCount
    };
  }

  getTaskContext(taskId: string): ExecutionContext | undefined {
    return this.executionContexts.get(taskId);
  }
}
