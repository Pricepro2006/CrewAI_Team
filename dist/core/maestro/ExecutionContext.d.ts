import type { Task, MaestroConfig } from "./types";
export interface ExecutionContextConfig {
    taskId: string;
    task: Task;
    timeout?: number;
    config: MaestroConfig;
}
export declare class ExecutionContext {
    taskId: string;
    task: Task;
    startTime?: Date;
    timeout?: number;
    retryCount: number;
    metadata: Record<string, any>;
    private cleanupCallbacks;
    private timeoutHandle?;
    constructor(config: ExecutionContextConfig);
    initialize(): void;
    cleanup(): void;
    addCleanupCallback(callback: () => void): void;
    updateMetadata(key: string, value: any): void;
    getElapsedTime(): number;
    isTimedOut(): boolean;
    setProgress(progress: number): void;
    getProgress(): number;
    addLog(message: string, level?: "info" | "warn" | "error"): void;
    getState(): ExecutionState;
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
//# sourceMappingURL=ExecutionContext.d.ts.map