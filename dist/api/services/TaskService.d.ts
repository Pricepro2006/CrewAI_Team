import type { MaestroFramework } from "../../core/maestro/MaestroFramework";
import type { Task, TaskResult } from "../../core/maestro/types";
export declare class TaskService {
    private maestro;
    private activeTasks;
    constructor(maestro: MaestroFramework);
    private setupEventListeners;
    submitTask(task: Omit<Task, "id">): Promise<string>;
    getTaskStatus(taskId: string): TaskStatus | null;
    getAllTasks(): TaskStatus[];
    getActiveTasks(): TaskStatus[];
    getCompletedTasks(): TaskStatus[];
    cancelTask(taskId: string): Promise<boolean>;
    clearCompletedTasks(): void;
    getQueueStatus(): QueueStatus;
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
export {};
//# sourceMappingURL=TaskService.d.ts.map