// Re-export enhanced router components
export { router, publicProcedure, protectedProcedure, adminProcedure, userProcedure, chatProcedure, agentProcedure, taskProcedure, ragProcedure, strictProcedure, enhancedProcedure, monitoredProcedure, middleware, commonSchemas, createFeatureRouter, createSecureRouter, } from "./enhanced-router";
// Import routers
import { agentRouter } from "../routes/agent.router";
import { taskRouter } from "../routes/task.router";
import { ragRouter } from "../routes/rag.router";
import { chatRouter } from "../routes/chat.router";
import { websocketRouter } from "../routes/websocket.router";
import { healthRouter } from "../routes/health.router";
import { dataCollectionRouter } from "../routes/data-collection.router";
import { authRouter } from "../routes/auth.router";
// Import the router function from enhanced-router
import { router as createRouter } from "./enhanced-router";
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
});
//# sourceMappingURL=router.js.map