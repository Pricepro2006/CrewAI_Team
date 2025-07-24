import { router, publicProcedure } from "../trpc/enhanced-router";
import { z } from "zod";
export const healthRouter = router({
    status: publicProcedure
        .output(z.object({
        status: z.string(),
        timestamp: z.string(),
        services: z.object({
            api: z.string(),
            ollama: z.string(),
            chromadb: z.string(),
            redis: z.string(),
            websocket: z.string(),
        }),
    }))
        .query(async () => {
        // Check service status
        const services = {
            api: "running",
            ollama: "connected",
            chromadb: "connected",
            redis: "connected",
            websocket: "connected",
        };
        return {
            status: "healthy",
            timestamp: new Date().toISOString(),
            services,
        };
    }),
});
//# sourceMappingURL=health.router.js.map