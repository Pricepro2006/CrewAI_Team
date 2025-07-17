import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TaskQueue } from "./TaskQueue";
import type { Task } from "./types";

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
    queue = new TaskQueue({
      maxSize: 100,
      strategy: "fifo",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("enqueue", () => {
    it("should add tasks to the queue", () => {
      const task1: Task = {
        id: "task-1",
        type: "test",
        data: { value: 1 },
        createdAt: new Date(),
      };

      const task2: Task = {
        id: "task-2",
        type: "test",
        data: { value: 2 },
        createdAt: new Date(),
      };

      queue.enqueue(task1);
      queue.enqueue(task2);

      expect(queue.size()).toBe(2);
    });

    it("should order tasks by priority", () => {
      // Create a priority queue for this test
      const priorityQueue = new TaskQueue({
        maxSize: 100,
        strategy: "priority",
      });
      const lowPriority: Task = {
        id: "low",
        type: "test",
        priority: 1,
        data: {},
        createdAt: new Date(),
      };

      const highPriority: Task = {
        id: "high",
        type: "test",
        priority: 10,
        data: {},
        createdAt: new Date(),
      };

      const mediumPriority: Task = {
        id: "medium",
        type: "test",
        priority: 5,
        data: {},
        createdAt: new Date(),
      };

      priorityQueue.enqueue(lowPriority);
      priorityQueue.enqueue(highPriority);
      priorityQueue.enqueue(mediumPriority);

      expect(priorityQueue.dequeue()?.id).toBe("high");
      expect(priorityQueue.dequeue()?.id).toBe("medium");
      expect(priorityQueue.dequeue()?.id).toBe("low");
    });

    it("should handle tasks without priority", () => {
      // Create a priority queue for this test
      const priorityQueue = new TaskQueue({
        maxSize: 100,
        strategy: "priority",
      });
      const task1: Task = {
        id: "task-1",
        type: "test",
        data: {},
        createdAt: new Date(),
      };

      const task2: Task = {
        id: "task-2",
        type: "test",
        priority: 5,
        data: {},
        createdAt: new Date(),
      };

      priorityQueue.enqueue(task1);
      priorityQueue.enqueue(task2);

      expect(priorityQueue.dequeue()?.id).toBe("task-2");
      expect(priorityQueue.dequeue()?.id).toBe("task-1");
    });
  });

  describe("dequeue", () => {
    it("should return null for empty queue", () => {
      expect(queue.dequeue()).toBeNull();
    });

    it("should remove and return the highest priority task", () => {
      // Create a priority queue for this test
      const priorityQueue = new TaskQueue({
        maxSize: 100,
        strategy: "priority",
      });
      const tasks: Task[] = [
        { id: "1", type: "test", priority: 3, data: {}, createdAt: new Date() },
        { id: "2", type: "test", priority: 7, data: {}, createdAt: new Date() },
        { id: "3", type: "test", priority: 5, data: {}, createdAt: new Date() },
      ];

      tasks.forEach((task) => priorityQueue.enqueue(task));

      const dequeued = priorityQueue.dequeue();
      expect(dequeued?.id).toBe("2");
      expect(priorityQueue.size()).toBe(2);
    });

    it("should maintain FIFO order for same priority", () => {
      // Create a priority queue for this test
      const priorityQueue = new TaskQueue({
        maxSize: 100,
        strategy: "priority",
      });
      const task1: Task = {
        id: "first",
        type: "test",
        priority: 5,
        data: {},
        createdAt: new Date(),
      };

      const task2: Task = {
        id: "second",
        type: "test",
        priority: 5,
        data: {},
        createdAt: new Date(),
      };

      priorityQueue.enqueue(task1);
      priorityQueue.enqueue(task2);

      expect(priorityQueue.dequeue()?.id).toBe("first");
      expect(priorityQueue.dequeue()?.id).toBe("second");
    });
  });

  describe("peek", () => {
    it("should return the next task without removing it", () => {
      const task: Task = {
        id: "task-1",
        type: "test",
        data: {},
        createdAt: new Date(),
      };

      queue.enqueue(task);

      const peeked = queue.peek();
      expect(peeked?.id).toBe("task-1");
      expect(queue.size()).toBe(1);

      const dequeued = queue.dequeue();
      expect(dequeued?.id).toBe("task-1");
      expect(queue.size()).toBe(0);
    });

    it("should return null for empty queue", () => {
      expect(queue.peek()).toBeNull();
    });
  });

  describe("clear", () => {
    it("should remove all tasks from the queue", () => {
      const tasks: Task[] = [
        { id: "1", type: "test", data: {}, createdAt: new Date() },
        { id: "2", type: "test", data: {}, createdAt: new Date() },
        { id: "3", type: "test", data: {}, createdAt: new Date() },
      ];

      tasks.forEach((task) => queue.enqueue(task));
      expect(queue.size()).toBe(3);

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe("isEmpty", () => {
    it("should return true for empty queue", () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it("should return false for non-empty queue", () => {
      queue.enqueue({
        id: "task-1",
        type: "test",
        data: {},
        createdAt: new Date(),
      });

      expect(queue.isEmpty()).toBe(false);
    });
  });

  describe("size", () => {
    it("should return the correct number of tasks", () => {
      expect(queue.size()).toBe(0);

      queue.enqueue({ id: "1", type: "test", data: {}, createdAt: new Date() });
      expect(queue.size()).toBe(1);

      queue.enqueue({ id: "2", type: "test", data: {}, createdAt: new Date() });
      expect(queue.size()).toBe(2);

      queue.dequeue();
      expect(queue.size()).toBe(1);

      queue.clear();
      expect(queue.size()).toBe(0);
    });
  });

  describe("toArray", () => {
    it("should return all tasks in priority order", () => {
      // Create a priority queue for this test
      const priorityQueue = new TaskQueue({
        maxSize: 100,
        strategy: "priority",
      });
      const tasks: Task[] = [
        {
          id: "low",
          type: "test",
          priority: 1,
          data: {},
          createdAt: new Date(),
        },
        {
          id: "high",
          type: "test",
          priority: 10,
          data: {},
          createdAt: new Date(),
        },
        {
          id: "medium",
          type: "test",
          priority: 5,
          data: {},
          createdAt: new Date(),
        },
      ];

      tasks.forEach((task) => priorityQueue.enqueue(task));

      const array = priorityQueue.toArray();
      expect(array).toHaveLength(3);
      expect(array[0].id).toBe("high");
      expect(array[1].id).toBe("medium");
      expect(array[2].id).toBe("low");
    });

    it("should not modify the original queue", () => {
      queue.enqueue({ id: "1", type: "test", data: {}, createdAt: new Date() });

      const array = queue.toArray();
      expect(array).toHaveLength(1);
      expect(queue.size()).toBe(1);
    });
  });

  describe("findById", () => {
    it("should find a task by ID", () => {
      const task: Task = {
        id: "unique-id",
        type: "test",
        data: { value: 42 },
        createdAt: new Date(),
      };

      queue.enqueue(task);
      queue.enqueue({
        id: "other",
        type: "test",
        data: {},
        createdAt: new Date(),
      });

      const found = queue.findById("unique-id");
      expect(found?.id).toBe("unique-id");
      expect(found?.data.value).toBe(42);
    });

    it("should return null if task not found", () => {
      queue.enqueue({
        id: "task-1",
        type: "test",
        data: {},
        createdAt: new Date(),
      });

      const found = queue.findById("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("removeById", () => {
    it("should remove a task by ID", () => {
      queue.enqueue({
        id: "remove-me",
        type: "test",
        data: {},
        createdAt: new Date(),
      });
      queue.enqueue({
        id: "keep-me",
        type: "test",
        data: {},
        createdAt: new Date(),
      });

      expect(queue.size()).toBe(2);

      const removed = queue.removeById("remove-me");
      expect(removed).toBe(true);
      expect(queue.size()).toBe(1);
      expect(queue.peek()?.id).toBe("keep-me");
    });

    it("should return false if task not found", () => {
      queue.enqueue({
        id: "task-1",
        type: "test",
        data: {},
        createdAt: new Date(),
      });

      const removed = queue.removeById("non-existent");
      expect(removed).toBe(false);
      expect(queue.size()).toBe(1);
    });
  });

  describe("concurrent operations", () => {
    it("should handle multiple operations safely", () => {
      const operations = [
        () =>
          queue.enqueue({
            id: "1",
            type: "test",
            priority: 5,
            data: {},
            createdAt: new Date(),
          }),
        () =>
          queue.enqueue({
            id: "2",
            type: "test",
            priority: 3,
            data: {},
            createdAt: new Date(),
          }),
        () => queue.dequeue(),
        () =>
          queue.enqueue({
            id: "3",
            type: "test",
            priority: 7,
            data: {},
            createdAt: new Date(),
          }),
        () => queue.peek(),
        () => queue.removeById("2"),
      ];

      // Execute all operations
      operations.forEach((op) => op());

      // Verify final state
      expect(queue.size()).toBe(1);
      expect(queue.peek()?.id).toBe("3");
    });
  });

  describe("performance", () => {
    it("should handle large queues efficiently", () => {
      // Create a queue with larger capacity for performance test
      const largeQueue = new TaskQueue({
        maxSize: 20000,
        strategy: "priority",
      });

      const start = Date.now();
      const taskCount = 10000;

      // Enqueue many tasks
      for (let i = 0; i < taskCount; i++) {
        largeQueue.enqueue({
          id: `task-${i}`,
          type: "test",
          priority: Math.random() * 100,
          data: { index: i },
          createdAt: new Date(),
        });
      }

      expect(largeQueue.size()).toBe(taskCount);

      // Dequeue all tasks and verify they come out in priority order
      let lastPriority = Infinity;
      while (!largeQueue.isEmpty()) {
        const task = largeQueue.dequeue();
        expect(task?.priority || 0).toBeLessThanOrEqual(lastPriority);
        lastPriority = task?.priority || 0;
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
    });
  });
});
