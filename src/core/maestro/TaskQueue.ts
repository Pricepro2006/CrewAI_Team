import { QueueConfig, QueueItem, QueueStatus } from './types';

export class TaskQueue {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    this.config = config;
  }

  async enqueue(item: QueueItem): Promise<void> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error('Queue is full');
    }

    switch (this.config.strategy) {
      case 'fifo':
        this.queue.push(item);
        break;
      case 'lifo':
        this.queue.unshift(item);
        break;
      case 'priority':
        this.insertByPriority(item);
        break;
    }
  }

  async dequeue(): Promise<QueueItem | null> {
    const item = this.queue.shift();
    if (item) {
      this.processing.add(item.id);
    }
    return item || null;
  }

  markComplete(taskId: string): void {
    this.processing.delete(taskId);
  }

  getStatus(): QueueStatus {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      capacity: this.config.maxSize
    };
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
  }

  size(): number {
    return this.queue.length;
  }

  private insertByPriority(item: QueueItem): void {
    // Higher priority values come first
    let insertIndex = 0;
    
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority > this.queue[i].priority) {
        break;
      }
      insertIndex = i + 1;
    }
    
    this.queue.splice(insertIndex, 0, item);
  }

  getItems(): QueueItem[] {
    return [...this.queue];
  }

  hasTask(taskId: string): boolean {
    return this.queue.some(item => item.id === taskId) || 
           this.processing.has(taskId);
  }

  removeTask(taskId: string): boolean {
    const index = this.queue.findIndex(item => item.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Simple priority queue implementation
export class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  constructor(private compareFn?: (a: T, b: T) => number) {}

  enqueue(item: T, priority: number = 0): void {
    const queueItem = { item, priority };
    
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (priority > this.items[i].priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }
    
    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.item;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }
}
