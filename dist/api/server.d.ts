import type { Express } from "express";
declare const app: Express;
declare const server: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
declare const wss: import("ws").Server<typeof import("ws"), typeof import("http").IncomingMessage>;
export { app, server, wss };
//# sourceMappingURL=server.d.ts.map