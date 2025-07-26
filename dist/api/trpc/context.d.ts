import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator";
import { ConversationService } from "../services/ConversationService";
import { TaskService } from "../services/TaskService";
import { MaestroFramework } from "../../core/maestro/MaestroFramework";
import { UserService, type User as DBUser } from "../services/UserService";
import { DealDataService } from "../services/DealDataService";
import { EmailStorageService } from "../services/EmailStorageService";
import { WalmartGroceryService } from "../services/WalmartGroceryService";
export interface User extends Omit<DBUser, "passwordHash"> {
    permissions: string[];
    lastActivity: Date;
}
type TRPCContext = {
    req: Request;
    res: Response;
    user: User;
    requestId: string;
    timestamp: Date;
    batchId: string | undefined;
    validatedInput: unknown;
    masterOrchestrator: MasterOrchestrator;
    conversationService: ConversationService;
    taskService: TaskService;
    maestroFramework: MaestroFramework;
    userService: UserService;
    dealDataService: DealDataService;
    emailStorageService: EmailStorageService;
    walmartGroceryService: WalmartGroceryService;
    agentRegistry: any;
    ragSystem: any;
    mcpTools: any;
};
export declare function createContext({ req, res, }: CreateExpressContextOptions): Promise<TRPCContext>;
export type Context = inferAsyncReturnType<typeof createContext>;
export {};
//# sourceMappingURL=context.d.ts.map