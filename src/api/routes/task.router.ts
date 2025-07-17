import { z } from "zod";
import { router, publicProcedure } from "../trpc/router";
import type { Router } from "@trpc/server";
import { logger } from "../../utils/logger";

export const taskRouter: Router<any> = router({
  // Submit a new task
  submit: publicProcedure
    .input(
      z.object({
        type: z.enum(["agent", "tool", "composite"]),
        priority: z.number().optional(),
        data: z.any(),
        timeout: z.number().optional(),
        retries: z.number().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Submitting new task", "TASK", { type: input.type });

        // Submit task through TaskService
        const taskId = await ctx.taskService.submitTask({
          type: input.type,
          priority: input.priority || 5,
          data: input.data,
          timeout: input.timeout,
          retries: input.retries || 3,
        });

        logger.info("Task submitted successfully", "TASK", { taskId });
        return { taskId };
      } catch (error) {
        logger.error("Failed to submit task", "TASK", { error });
        throw new Error("Failed to submit task");
      }
    }),

  // Get task status
  status: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const status = ctx.taskService.getTaskStatus(input.taskId);

      if (!status) {
        throw new Error(`Task ${input.taskId} not found`);
      }

      return {
        id: status.id,
        status: status.status,
        progress: status.progress,
        startTime:
          status.startedAt?.toISOString() || status.submittedAt.toISOString(),
        completedTime: status.completedAt?.toISOString(),
        estimatedCompletion: null,
        result: status.result,
        error: status.error?.message,
      };
    }),

  // List all tasks
  list: publicProcedure
    .input(
      z.object({
        filter: z.enum(["all", "active", "completed"]).default("all"),
      }),
    )
    .query(async ({ input, ctx }) => {
      let tasks = ctx.taskService.getAllTasks();

      // Apply filter
      if (input.filter === "active") {
        tasks = ctx.taskService.getActiveTasks();
      } else if (input.filter === "completed") {
        tasks = ctx.taskService.getCompletedTasks();
      }

      // Transform to API format
      return tasks.map((task) => ({
        id: task.id,
        type: task.task.type,
        status: task.status,
        progress: task.progress,
        priority: task.task.priority,
        submittedAt: task.submittedAt.toISOString(),
        startedAt: task.startedAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        result: task.result,
        error: task.error?.message,
      }));
    }),

  // Cancel a task
  cancel: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      logger.info("Cancelling task", "TASK", { taskId: input.taskId });

      const success = await ctx.taskService.cancelTask(input.taskId);

      if (!success) {
        logger.warn("Failed to cancel task", "TASK", { taskId: input.taskId });
        throw new Error(
          "Task cannot be cancelled (not found or already running)",
        );
      }

      logger.info("Task cancelled successfully", "TASK", {
        taskId: input.taskId,
      });
      return { success };
    }),

  // Get queue status
  queueStatus: publicProcedure.query(async ({ ctx }) => {
    const status = ctx.taskService.getQueueStatus();

    return {
      total: status.total,
      active: status.running,
      pending: status.queued,
      running: status.running,
      completed: status.completed,
      failed: status.failed,
      cancelled: status.cancelled,
    };
  }),

  // Clear completed tasks
  clearCompleted: publicProcedure.mutation(async ({ ctx }) => {
    logger.info("Clearing completed tasks", "TASK");

    ctx.taskService.clearCompletedTasks();

    logger.info("Completed tasks cleared", "TASK");
    return {
      success: true,
      message: "Completed and failed tasks have been cleared",
    };
  }),
});
