import type { WebSocket } from "ws";
import type { UserService } from "../services/UserService";
export interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    userRole?: string;
    clientId?: string;
    isAuthenticated?: boolean;
    permissions?: string[];
    lastActivity?: Date;
}
interface AuthResult {
    success: boolean;
    userId?: string;
    userRole?: string;
    permissions?: string[];
    error?: string;
}
export declare class WebSocketAuthManager {
    private userService;
    private authenticatedClients;
    private cleanupInterval;
    constructor(userService: UserService);
    /**
     * Authenticate a WebSocket connection
     */
    authenticate(ws: AuthenticatedWebSocket, token: string): Promise<AuthResult>;
    /**
     * Handle authentication message from client
     */
    handleAuthMessage(ws: AuthenticatedWebSocket, message: any): Promise<boolean>;
    /**
     * Check if a WebSocket is authenticated
     */
    isAuthenticated(ws: AuthenticatedWebSocket): boolean;
    /**
     * Check if a WebSocket has specific permission
     */
    hasPermission(ws: AuthenticatedWebSocket, permission: string): boolean;
    /**
     * Check if a WebSocket has any of the specified roles
     */
    hasRole(ws: AuthenticatedWebSocket, roles: string[]): boolean;
    /**
     * Update last activity timestamp
     */
    updateActivity(ws: AuthenticatedWebSocket): void;
    /**
     * Remove authenticated client
     */
    removeClient(ws: AuthenticatedWebSocket): void;
    /**
     * Get all authenticated clients for a user
     */
    getClientsByUserId(userId: string): string[];
    /**
     * Force disconnect all clients for a user
     */
    disconnectUser(userId: string, wsService: any): void;
    /**
     * Get permissions based on role
     */
    private getPermissionsForRole;
    /**
     * Start cleanup interval for expired sessions
     */
    private startCleanupInterval;
    /**
     * Stop cleanup interval
     */
    stopCleanup(): void;
    /**
     * Get authentication statistics
     */
    getStats(): {
        totalAuthenticated: number;
        byRole: Record<string, number>;
        byUser: Record<string, number>;
    };
}
export declare function createWebSocketAuthMiddleware(authManager: WebSocketAuthManager): (ws: AuthenticatedWebSocket, req: any) => Promise<void>;
export declare function authenticateWebSocket(ws: AuthenticatedWebSocket, token: string): Promise<boolean>;
export {};
//# sourceMappingURL=websocketAuth.d.ts.map