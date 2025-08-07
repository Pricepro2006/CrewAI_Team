// Re-export enhanced router components
export {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  userProcedure,
  chatProcedure,
  agentProcedure,
  taskProcedure,
  ragProcedure,
  strictProcedure,
  enhancedProcedure,
  monitoredProcedure,
  middleware,
  commonSchemas,
  createFeatureRouter,
  createSecureRouter,
} from "./enhanced-router.ts";

// Import routers
import { agentRouter } from "../routes/agent.router.ts";
import { taskRouter } from "../routes/task.router.ts";
import { ragRouter } from "../routes/rag.router.ts";
import { chatRouter } from "../routes/chat.router.ts";
import { websocketRouter } from "../routes/websocket.router.ts";
import { healthRouter } from "../routes/health.router.ts";
import { dataCollectionRouter } from "../routes/data-collection.router.ts";
import { authRouter } from "../routes/auth.router.ts";
import { emailRouter } from "../routes/email.router.ts";
import { metricsRouter } from "../routes/metrics.router.trpc.ts";
import { emailAssignmentRouter } from "./routers/emailAssignment.router.ts";
import { iemsEmailRouter } from "../routes/iems-email.router.ts";
import { dealsRouter } from "../routes/deals.router.ts";
import { walmartGroceryRouter } from "../routes/walmart-grocery.router.ts";
import { walmartPriceRouter } from "../routes/walmart-price.router.ts";
import { workflowRouter } from "../routes/workflow.router.ts";
import { securityRouter } from "./routers/security.router.ts";
import { monitoringRouter } from "./routers/monitoring.router.ts";
import { groceryNLPQueueRouter } from "./routers/grocery-nlp-queue.router.ts";
import { pollingRouter } from "./routers/polling.router.ts";

// Import the router function from enhanced-router
import { router as createRouter } from "./enhanced-router.ts";
import type { AnyRouter } from "@trpc/server";

// Create the main app router with enhanced security
export const appRouter = createRouter({
  auth: authRouter, // Authentication endpoints
  agent: agentRouter,
  task: taskRouter,
  rag: ragRouter,
  chat: chatRouter,
  ws: websocketRouter, // Use 'ws' for frontend compatibility
  health: healthRouter, // Health monitoring endpoints
  dataCollection: dataCollectionRouter, // Bright Data integration
  emails: emailRouter, // Email analytics and management
  emailAssignment: emailAssignmentRouter, // Email assignment functionality
  metrics: metricsRouter, // Performance and rate limit metrics (tRPC)
  iemsEmails: iemsEmailRouter, // IEMS email dashboard endpoints
  deals: dealsRouter, // Deal data management
  walmartGrocery: walmartGroceryRouter, // Walmart grocery agent endpoints
  walmartPrice: walmartPriceRouter, // Live Walmart pricing endpoints
  workflow: workflowRouter, // Workflow intelligence task management
  security: securityRouter, // Security endpoints (CSRF token management)
  monitoring: monitoringRouter, // System monitoring and observability
  groceryNLPQueue: groceryNLPQueueRouter, // Grocery NLP Queue management
  polling: pollingRouter, // HTTP polling fallback endpoints
});

export type AppRouter = typeof appRouter;
