export class TaskQueue {
    queue = [];
    processing = new Set();
    config;
    constructor(config) {
        this.config = config;
    }
    enqueue(item) {
        // Ensure task has an ID
        if (!item.id) {
            item.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        if (this.queue.length >= this.config.maxSize) {
            throw new Error("Queue is full");
        }
        switch (this.config.strategy) {
            case "fifo":
                this.queue.push(item);
                break;
            case "lifo":
                this.queue.unshift(item);
                break;
            case "priority":
                this.insertByPriority(item);
                break;
        }
    }
    dequeue() {
        const item = this.queue.shift();
        if (item && item.id) {
            this.processing.add(item.id);
        }
        return item || null;
    }
    markComplete(taskId) {
        this.processing.delete(taskId);
    }
    getStatus() {
        return {
            queued: this.queue.length,
            processing: this.processing.size,
            capacity: this.config.maxSize,
        };
    }
    clear() {
        this.queue = [];
        this.processing.clear();
    }
    size() {
        return this.queue.length;
    }
    insertByPriority(item) {
        // Higher priority values come first
        let insertIndex = 0;
        for (let i = 0; i < this.queue.length; i++) {
            const queueItem = this.queue[i];
            if (queueItem && (item.priority || 0) > (queueItem.priority || 0)) {
                break;
            }
            insertIndex = i + 1;
        }
        this.queue.splice(insertIndex, 0, item);
    }
    getItems() {
        return [...this.queue];
    }
    hasTask(taskId) {
        return (this.queue.some((item) => item.id === taskId) ||
            this.processing.has(taskId));
    }
    removeTask(taskId) {
        const index = this.queue.findIndex((item) => item.id === taskId);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }
    // Alias for removeTask to match test expectations
    removeById(taskId) {
        return this.removeTask(taskId);
    }
    // Alias for removeTask to match MaestroFramework expectations
    remove(taskId) {
        return this.removeTask(taskId);
    }
    peek() {
        return this.queue[0] || null;
    }
    isEmpty() {
        return this.queue.length === 0;
    }
    toArray() {
        return [...this.queue];
    }
    findById(taskId) {
        return this.queue.find((item) => item.id === taskId) || null;
    }
}
// Simple priority queue implementation
export class PriorityQueue {
    _compareFn;
    items = [];
    constructor(_compareFn) {
        this._compareFn = _compareFn;
    }
    enqueue(item, priority = 0) {
        const queueItem = { item, priority };
        let added = false;
        for (let i = 0; i < this.items.length; i++) {
            if (priority > (this.items[i]?.priority || 0)) {
                this.items.splice(i, 0, queueItem);
                added = true;
                break;
            }
        }
        if (!added) {
            this.items.push(queueItem);
        }
    }
    dequeue() {
        const item = this.items.shift();
        return item?.item;
    }
    peek() {
        return this.items[0]?.item;
    }
    size() {
        return this.items.length;
    }
    isEmpty() {
        return this.items.length === 0;
    }
    clear() {
        this.items = [];
    }
}
//# sourceMappingURL=TaskQueue.js.map