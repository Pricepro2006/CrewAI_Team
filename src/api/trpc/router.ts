import { initTRPC } from '@trpc/server';
import { createContext } from './context';
import { agentRouter } from '../routes/agent.router';
import { taskRouter } from '../routes/task.router';
import { ragRouter } from '../routes/rag.router';
import { chatRouter } from '../routes/chat.router';

const t = initTRPC.context<typeof createContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error && error.cause.name === 'ZodError'
            ? error.cause
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

// Auth middleware
const isAuthenticated = middleware(async ({ ctx, next }) => {
  // Add authentication logic here if needed
  return next({
    ctx: {
      ...ctx,
      user: null // Replace with actual user from JWT/session
    }
  });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);

// Create the main app router
export const appRouter = router({
  agent: agentRouter,
  task: taskRouter,
  rag: ragRouter,
  chat: chatRouter
});

export type AppRouter = typeof appRouter;
