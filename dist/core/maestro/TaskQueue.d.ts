import type { QueueConfig, QueueStatus, Task } from "./types";
export declare class TaskQueue {
    private queue;
    private processing;
    private config;
    constructor(config: QueueConfig);
    enqueue(item: Task): void;
    dequeue(): Task | null;
    markComplete(taskId: string): void;
    getStatus(): QueueStatus;
    clear(): void;
    size(): number;
    private insertByPriority;
    getItems(): Task[];
    hasTask(taskId: string): boolean;
    removeTask(taskId: string): boolean;
    removeById(taskId: string): boolean;
    remove(taskId: string): boolean;
    peek(): Task | null;
    isEmpty(): boolean;
    toArray(): Task[];
    findById(taskId: string): Task | null;
}
export declare class PriorityQueue<T> {
    private _compareFn?;
    private items;
    constructor(_compareFn?: ((a: T, b: T) => number) | undefined);
    enqueue(item: T, priority?: number): void;
    dequeue(): T | undefined;
    peek(): T | undefined;
    size(): number;
    isEmpty(): boolean;
    clear(): void;
}
//# sourceMappingURL=TaskQueue.d.ts.map