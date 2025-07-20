import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator";
import { ConversationService } from "../services/ConversationService";
import { TaskService } from "../services/TaskService";
import { MaestroFramework } from "../../core/maestro/MaestroFramework";
import { UserService, type User as DBUser } from "../services/UserService";
export interface User extends Omit<DBUser, "passwordHash"> {
    permissions: string[];
    lastActivity: Date;
}
export declare function createContext({ req, res }: CreateExpressContextOptions): Promise<{
    masterOrchestrator: MasterOrchestrator;
    conversationService: ConversationService;
    taskService: TaskService;
    maestroFramework: MaestroFramework;
    userService: UserService;
    agentRegistry: import("../../core/agents/registry/AgentRegistry").AgentRegistry;
    ragSystem: import("../../core/rag/RAGSystem").RAGSystem;
    req: import("express").Request<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
    res: import("express").Response<any, Record<string, any>>;
    user: User;
    requestId: string;
    timestamp: Date;
    batchId: string | undefined;
    validatedInput: unknown;
}>;
export type Context = inferAsyncReturnType<typeof createContext>;
//# sourceMappingURL=context.d.ts.map