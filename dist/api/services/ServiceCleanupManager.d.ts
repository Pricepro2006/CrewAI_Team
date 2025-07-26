export interface CleanupTask {
    name: string;
    cleanup: () => Promise<void> | void;
    priority?: number;
}
export declare class ServiceCleanupManager {
    private cleanupTasks;
    private isShuttingDown;
    /**
     * Register a cleanup task
     */
    registerCleanupTask(task: CleanupTask): void;
    /**
     * Register a cleanup task (alias for registerCleanupTask)
     */
    register(task: CleanupTask): void;
    /**
     * Execute all cleanup tasks
     */
    cleanup(): Promise<void>;
    /**
     * Get registered cleanup tasks
     */
    getCleanupTasks(): ReadonlyArray<CleanupTask>;
    /**
     * Clear all tasks (useful for testing)
     */
    clearTasks(): void;
}
export declare const cleanupManager: ServiceCleanupManager;
export declare function registerDefaultCleanupTasks(): void;
//# sourceMappingURL=ServiceCleanupManager.d.ts.map