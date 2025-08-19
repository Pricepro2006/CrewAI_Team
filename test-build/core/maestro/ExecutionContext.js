export class ExecutionContext {
    taskId;
    task;
    startTime;
    timeout;
    retryCount = 0;
    metadata = {};
    cleanupCallbacks = [];
    timeoutHandle;
    constructor(config) {
        this.taskId = config.taskId;
        this.task = config.task;
        this.timeout = config.timeout;
    }
    initialize() {
        this.startTime = new Date();
        // Set up timeout if specified
        if (this.timeout) {
            this.timeoutHandle = setTimeout(() => {
                throw new Error(`Task ${this.taskId} timed out after ${this.timeout}ms`);
            }, this.timeout);
        }
        // Initialize metadata
        this.metadata = {
            startTime: this?.startTime?.toISOString(),
            taskType: this?.task?.type,
            priority: this?.task?.priority || 0,
        };
    }
    cleanup() {
        // Clear timeout
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
        }
        // Run cleanup callbacks
        this?.cleanupCallbacks?.forEach((callback) => {
            try {
                callback();
            }
            catch (error) {
                console.error("Cleanup callback error:", error);
            }
        });
        this.cleanupCallbacks = [];
    }
    addCleanupCallback(callback) {
        this?.cleanupCallbacks?.push(callback);
    }
    updateMetadata(key, value) {
        this.metadata[key] = value;
    }
    getElapsedTime() {
        if (!this.startTime)
            return 0;
        return Date.now() - this?.startTime?.getTime();
    }
    isTimedOut() {
        if (!this.timeout || !this.startTime)
            return false;
        return this.getElapsedTime() > this.timeout;
    }
    setProgress(progress) {
        this.metadata["progress"] = Math.min(100, Math.max(0, progress));
    }
    getProgress() {
        return this.metadata["progress"] || 0;
    }
    addLog(message, level = "info") {
        if (!this.metadata["logs"]) {
            this.metadata["logs"] = [];
        }
        this.metadata["logs"].push({
            timestamp: new Date().toISOString(),
            level,
            message,
        });
    }
    getState() {
        return {
            taskId: this.taskId,
            taskType: this?.task?.type,
            ...(this.startTime && { startTime: this.startTime }),
            elapsedTime: this.getElapsedTime(),
            progress: this.getProgress(),
            retryCount: this.retryCount,
            metadata: { ...this.metadata },
        };
    }
}
