import { EventEmitter } from "events";
import { ExecutionContext } from "./ExecutionContext";
import type { Task, MaestroConfig } from "./types";
export declare class MaestroFramework extends EventEmitter {
    private taskQueue;
    private executionContexts;
    private config;
    private isProcessing;
    private activeTaskCount;
    private cancelledTasks;
    constructor(config: MaestroConfig);
    submitTask(task: Task): Promise<string>;
    private startProcessing;
    private processTask;
    private executeTask;
    private executeAgentTask;
    private executeToolTask;
    private executeCompositeTask;
    private generateTaskId;
    private delay;
    shutdown(): Promise<void>;
    getQueueStatus(): any;
    getTaskContext(taskId: string): ExecutionContext | undefined;
    cancelTask(taskId: string): Promise<boolean>;
    initialize(): Promise<void>;
}
//# sourceMappingURL=MaestroFramework.d.ts.map