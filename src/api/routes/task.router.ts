import { z } from 'zod';
import { router, publicProcedure } from '../trpc/router';

export const taskRouter = router({
  // Submit a new task
  submit: publicProcedure
    .input(z.object({
      type: z.enum(['agent', 'tool', 'composite']),
      priority: z.number().optional(),
      data: z.any(),
      timeout: z.number().optional(),
      retries: z.number().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const taskId = await ctx.taskService.submitTask(input);
      return { taskId };
    }),

  // Get task status
  status: publicProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const status = ctx.taskService.getTaskStatus(input.taskId);
      if (!status) {
        throw new Error('Task not found');
      }
      return status;
    }),

  // List all tasks
  list: publicProcedure
    .input(z.object({
      filter: z.enum(['all', 'active', 'completed']).default('all')
    }))
    .query(async ({ input, ctx }) => {
      switch (input.filter) {
        case 'active':
          return ctx.taskService.getActiveTasks();
        case 'completed':
          return ctx.taskService.getCompletedTasks();
        default:
          return ctx.taskService.getAllTasks();
      }
    }),

  // Cancel a task
  cancel: publicProcedure
    .input(z.object({
      taskId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const success = await ctx.taskService.cancelTask(input.taskId);
      return { success };
    }),

  // Get queue status
  queueStatus: publicProcedure.query(async ({ ctx }) => {
    return ctx.taskService.getQueueStatus();
  }),

  // Clear completed tasks
  clearCompleted: publicProcedure.mutation(async ({ ctx }) => {
    ctx.taskService.clearCompletedTasks();
    return { success: true };
  })
});
