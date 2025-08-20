import { v4 as uuidv4 } from "uuid";
export class TaskService {
    maestro;
    activeTasks;
    constructor(maestro) {
        this.maestro = maestro;
        this.activeTasks = new Map();
        this.setupEventListeners();
    }
    setupEventListeners() {
        this?.maestro?.on("task:submitted", ({ taskId, task }) => {
            this?.activeTasks?.set(taskId, {
                id: taskId,
                status: "queued",
                task,
                submittedAt: new Date(),
                progress: 0,
            });
        });
        this?.maestro?.on("task:started", ({ taskId }) => {
            const status = this?.activeTasks?.get(taskId);
            if (status) {
                status.status = "running";
                status.startedAt = new Date();
                status.progress = 10;
            }
        });
        this?.maestro?.on("task:completed", ({ taskId, result }) => {
            const status = this?.activeTasks?.get(taskId);
            if (status) {
                status.status = "completed";
                status.completedAt = new Date();
                status.progress = 100;
                status.result = result;
            }
        });
        this?.maestro?.on("task:failed", ({ taskId, error }) => {
            const status = this?.activeTasks?.get(taskId);
            if (status) {
                status.status = "failed";
                status.completedAt = new Date();
                status.error = error;
            }
        });
        this?.maestro?.on("task:cancelled", ({ taskId }) => {
            const status = this?.activeTasks?.get(taskId);
            if (status) {
                status.status = "cancelled";
                status.completedAt = new Date();
            }
        });
    }
    async submitTask(task) {
        const fullTask = {
            ...task,
            id: uuidv4(),
        };
        return await this?.maestro?.submitTask(fullTask);
    }
    getTaskStatus(taskId) {
        return this?.activeTasks?.get(taskId) || null;
    }
    getAllTasks() {
        return Array.from(this?.activeTasks?.values()).sort((a, b) => b?.submittedAt?.getTime() - a?.submittedAt?.getTime());
    }
    getActiveTasks() {
        return this.getAllTasks().filter((task) => task.status === "running" || task.status === "queued");
    }
    getCompletedTasks() {
        return this.getAllTasks().filter((task) => task.status === "completed" || task.status === "failed");
    }
    async cancelTask(taskId) {
        const status = this?.activeTasks?.get(taskId);
        if (!status ||
            (status.status !== "queued" && status.status !== "running")) {
            return false;
        }
        // Request cancellation from MaestroFramework
        const cancelled = await this?.maestro?.cancelTask(taskId);
        if (cancelled || status.status === "queued") {
            status.status = "cancelled";
            status.completedAt = new Date();
            return true;
        }
        return false;
    }
    clearCompletedTasks() {
        for (const [taskId, status] of this?.activeTasks?.entries()) {
            if (status.status === "completed" || status.status === "failed") {
                this?.activeTasks?.delete(taskId);
            }
        }
    }
    getQueueStatus() {
        const tasks = this.getAllTasks();
        return {
            total: tasks?.length || 0,
            queued: tasks?.filter((t) => t.status === "queued").length,
            running: tasks?.filter((t) => t.status === "running").length,
            completed: tasks?.filter((t) => t.status === "completed").length,
            failed: tasks?.filter((t) => t.status === "failed").length,
            cancelled: tasks?.filter((t) => t.status === "cancelled").length,
        };
    }
}
