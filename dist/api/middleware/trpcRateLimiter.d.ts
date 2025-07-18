import { middleware } from "../trpc/enhanced-router";
interface RateLimitOptions {
    windowMs: number;
    max: number;
    message?: string;
}
export declare function createTRPCRateLimiter(options: RateLimitOptions): ReturnType<typeof middleware>;
export declare const chatProcedureRateLimiter: ReturnType<typeof createTRPCRateLimiter>;
export declare const agentProcedureRateLimiter: ReturnType<typeof createTRPCRateLimiter>;
export declare const taskProcedureRateLimiter: ReturnType<typeof createTRPCRateLimiter>;
export declare const ragProcedureRateLimiter: ReturnType<typeof createTRPCRateLimiter>;
export declare const strictProcedureRateLimiter: ReturnType<typeof createTRPCRateLimiter>;
export declare class DynamicTRPCRateLimiter {
    private windowMs;
    private baseMax;
    private currentMax;
    private systemLoad;
    constructor(windowMs?: number, baseMax?: number);
    private updateSystemLoad;
    createLimiter(): ReturnType<typeof createTRPCRateLimiter>;
}
export declare const dynamicTRPCRateLimiter: DynamicTRPCRateLimiter;
export {};
//# sourceMappingURL=trpcRateLimiter.d.ts.map