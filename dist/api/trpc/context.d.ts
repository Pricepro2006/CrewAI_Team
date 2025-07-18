import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { type User as DBUser } from "../services/UserService";
export interface User extends Omit<DBUser, "passwordHash"> {
    permissions: string[];
    lastActivity: Date;
}
export declare function createContext({ req, res }: CreateExpressContextOptions): Promise<Context>;
export type Context = inferAsyncReturnType<typeof createContext>;
//# sourceMappingURL=context.d.ts.map