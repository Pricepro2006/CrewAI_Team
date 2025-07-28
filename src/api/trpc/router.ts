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
} from "./enhanced-router.js";

// Import routers
import { agentRouter } from "../routes/agent.router.js";
import { taskRouter } from "../routes/task.router.js";
import { ragRouter } from "../routes/rag.router.js";
import { chatRouter } from "../routes/chat.router.js";
import { websocketRouter } from "../routes/websocket.router.js";
import { healthRouter } from "../routes/health.router.js";
import { dataCollectionRouter } from "../routes/data-collection.router.js";
import { authRouter } from "../routes/auth.router.js";
import { emailRouter } from "../routes/email.router.js";
import { metricsRouter } from "../routes/metrics.router.js";
import { emailAssignmentRouter } from "./routers/emailAssignment.router.js";
import { iemsEmailRouter } from "../routes/iems-email.router.js";
import { dealsRouter } from "../routes/deals.router.js";
import { walmartGroceryRouter } from "../routes/walmart-grocery.router.js";
import { securityRouter } from "./routers/security.router.js";
import { monitoringRouter } from "./routers/monitoring.router.js";

// Import the router function from enhanced-router
import { router as createRouter } from "./enhanced-router.js";
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
  metrics: metricsRouter, // Performance and rate limit metrics
  iemsEmails: iemsEmailRouter, // IEMS email dashboard endpoints
  deals: dealsRouter, // Deal data management
  walmartGrocery: walmartGroceryRouter, // Walmart grocery agent endpoints
  security: securityRouter, // Security endpoints (CSRF token management)
  monitoring: monitoringRouter, // System monitoring and observability
});

export type AppRouter = typeof appRouter;
