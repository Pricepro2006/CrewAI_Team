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
import { orchestratorRouter } from "../routes/orchestrator.router.js";
import { websocketRouter } from "../routes/websocket.router.js";
import { healthRouter } from "../routes/health.router.js";
import { dataCollectionRouter } from "../routes/data-collection.router.js";
import { authRouter } from "../routes/auth.router.js";
import { emailRouter } from "../routes/email.router.js";
import { metricsRouter } from "../routes/metrics.router.trpc.js";
import { emailAssignmentRouter } from "./routers/emailAssignment.router.js";
import { iemsEmailRouter } from "../routes/iems-email.router.js";
import { dealsRouter } from "../routes/deals.router.js";
import { walmartGrocerySimpleRouter as walmartGroceryRouter } from "../routes/walmart-grocery-simple.router.js";
import { walmartPriceRouter } from "../routes/walmart-price.router.js";
import { workflowRouter } from "../routes/workflow.router.js";
import { securityRouter } from "./routers/security.router.js";
import { monitoringRouter } from "./routers/monitoring.router.js";
import { groceryNLPQueueRouter } from "./routers/grocery-nlp-queue.router.js";
import { pollingRouter } from "./routers/polling.router.js";
import { priceAlertsRouter } from "./price-alerts.router.js";
import { cartRouter } from "./cart.router.js";
import { healthCheckRouter } from "./health-check.router.js";
import { walmartGroceryRouter as walmartGroceryTRPCRouter } from "./walmart-grocery.router.js";
import { walmartRealTimeRouter } from "../routes/walmart-realtime.router.js";

// Import the router function from enhanced-router
import { router } from "./enhanced-router.js";
import type { AnyRouter } from "@trpc/server";

// Create the main app router with enhanced security
export const appRouter = router({
  auth: authRouter, // Authentication endpoints
  agent: agentRouter,
  task: taskRouter,
  rag: ragRouter,
  chat: chatRouter,
  orchestrator: orchestratorRouter, // MasterOrchestrator direct access
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
  priceAlerts: priceAlertsRouter, // Price alert system
  cart: cartRouter, // Shopping cart management
  healthCheck: healthCheckRouter, // Health monitoring endpoints
  walmartGroceryTRPC: walmartGroceryTRPCRouter, // Enhanced Walmart grocery endpoints
  walmartRealTime: walmartRealTimeRouter, // Real-time Walmart product data and live prices
});

export type AppRouter = typeof appRouter;
export default appRouter;
