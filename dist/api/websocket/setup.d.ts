import { WebSocketServer } from "ws";
import { WebSocketAuthManager } from "../middleware/websocketAuth";
import type { UserService } from "../services/UserService";
/**
 * Setup authenticated WebSocket server
 */
export declare function setupAuthenticatedWebSocketServer(wss: WebSocketServer, userService: UserService): WebSocketAuthManager;
/**
 * Create a standalone WebSocket server with authentication
 */
export declare function createAuthenticatedWebSocketServer(port: number, userService: UserService): {
    wss: WebSocketServer;
    authManager: WebSocketAuthManager;
};
//# sourceMappingURL=setup.d.ts.map