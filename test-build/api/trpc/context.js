import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator.js";
import { ConversationService } from "../services/ConversationService.js";
import { TaskService } from "../services/TaskService.js";
import { MaestroFramework } from "../../core/maestro/MaestroFramework.js";
import { UserService } from "../services/UserService.js";
import { jwtManager, JWTError } from "../utils/jwt.js";
import ollamaConfig from "../../config/ollama.config.js";
import { logger } from "../../utils/logger.js";
import { mcpToolsService } from "../services/MCPToolsService.js";
import { DealDataService } from "../services/DealDataService.js";
import { realEmailStorageService } from "../services/RealEmailStorageService.js";
import { WalmartGroceryService } from "../services/WalmartGroceryService.js";
import { getStoredCSRFToken } from "../middleware/security/csrf.js";
import { EventEmitter } from "events";
// Initialize services (singleton pattern)
let masterOrchestrator;
let conversationService;
let maestroFramework;
let taskService;
let userService;
let dealDataService;
let emailStorageService;
let walmartGroceryService;
// let emailIngestionService: EmailIngestionServiceImpl;
let eventEmitter;
async function initializeServices() {
    if (!masterOrchestrator) {
        masterOrchestrator = new MasterOrchestrator({
            ollamaUrl: ollamaConfig.baseUrl,
            rag: {
                vectorStore: {
                    type: "chromadb",
                    path: "./data/chroma",
                    collectionName: "crewai-knowledge",
                    dimension: 384,
                },
                chunking: {
                    size: 500,
                    overlap: 50,
                    method: "sentence",
                },
                retrieval: {
                    topK: 5,
                    minScore: 0.5,
                    reranking: true,
                },
            },
        });
        await masterOrchestrator.initialize();
    }
    if (!conversationService) {
        conversationService = new ConversationService();
    }
    if (!maestroFramework) {
        maestroFramework = new MaestroFramework({
            maxConcurrentTasks: 5,
            taskTimeout: 300000, // 5 minutes
            queueConfig: {
                maxSize: 100,
                strategy: "fifo",
            },
        });
        await maestroFramework.initialize();
    }
    if (!taskService) {
        taskService = new TaskService(maestroFramework);
    }
    if (!userService) {
        userService = new UserService();
    }
    if (!dealDataService) {
        dealDataService = new DealDataService();
    }
    if (!emailStorageService) {
        emailStorageService = realEmailStorageService; // Use the enhanced email storage service
    }
    if (!walmartGroceryService) {
        walmartGroceryService = WalmartGroceryService.getInstance();
    }
    // if (!emailIngestionService) {
    //   emailIngestionService = new EmailIngestionServiceImpl();
    // }
    if (!eventEmitter) {
        eventEmitter = new EventEmitter();
    }
    return {
        masterOrchestrator,
        conversationService,
        taskService,
        maestroFramework,
        userService,
        dealDataService,
        emailStorageService,
        walmartGroceryService,
        // emailIngestionService,
        eventEmitter,
        agentRegistry: masterOrchestrator.agentRegistry,
        ragSystem: masterOrchestrator.ragSystem,
        mcpTools: mcpToolsService.getAvailableTools(),
    };
}
// JWT verification utility
async function verifyJWT(token, userService) {
    try {
        // Verify token using JWT manager
        const payload = jwtManager.verifyAccessToken(token);
        // Get full user data from database
        const dbUser = userService.getUserById(payload.sub);
        if (!dbUser || !dbUser.is_active) {
            logger.warn("User not found or inactive", "AUTH", {
                userId: payload.sub,
            });
            return null;
        }
        // Map role-based permissions
        const permissions = getPermissionsForRole(dbUser.role);
        const user = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            first_name: dbUser.first_name,
            last_name: dbUser.last_name,
            avatar_url: dbUser.avatar_url,
            role: dbUser.role,
            is_active: dbUser.is_active,
            is_verified: dbUser.is_verified,
            last_login_at: dbUser.last_login_at,
            created_at: dbUser.created_at,
            updated_at: dbUser.updated_at,
            permissions,
            lastActivity: new Date(),
        };
        logger.debug("JWT verification successful", "AUTH", {
            userId: user.id,
            role: user.role,
        });
        return user;
    }
    catch (error) {
        if (error instanceof JWTError) {
            logger.warn("JWT verification failed", "AUTH", {
                error: error.message,
                code: error.code,
            });
        }
        else {
            logger.warn("JWT verification failed", "AUTH", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
        return null;
    }
}
// Helper to get permissions based on role
function getPermissionsForRole(role) {
    switch (role) {
        case "admin":
            return ["read", "write", "delete", "admin"];
        case "moderator":
            return ["read", "write", "moderate"];
        case "user":
            return ["read", "write"];
        default:
            return ["read"];
    }
}
// Security headers and request validation
function validateRequest(req) {
    const ip = req.ip || req?.connection?.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    // Log security-relevant request info
    logger.debug("Processing tRPC request", "SECURITY", {
        ip,
        userAgent,
        method: req.method,
        path: req.path,
        hasAuth: !!req?.headers?.authorization,
    });
    // Basic security checks
    if (userAgent.includes("bot") && !userAgent.includes("GoogleBot")) {
        logger.warn("Potential bot detected", "SECURITY", { ip, userAgent });
    }
    return { ip, userAgent };
}
export async function createContext({ req, res, }) {
    // Validate request and extract security info
    const { ip, userAgent } = validateRequest(req);
    // Get services
    const services = await initializeServices();
    // Extract and verify JWT if present
    const token = req?.headers?.authorization?.replace("Bearer ", "");
    let user = null;
    if (token) {
        user = await verifyJWT(token, services.userService);
    }
    // Set default guest user if no authentication
    if (!user) {
        user = {
            id: `guest-${ip.replace(/\./g, "-")}-${Date.now()}`,
            email: "",
            username: "guest",
            role: "user",
            is_active: true,
            is_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            permissions: ["read"],
            lastActivity: new Date(),
        };
    }
    // Extract CSRF token from cookies/session for tRPC context
    // This is crucial for CSRF validation in tRPC procedures
    const csrfToken = getStoredCSRFToken(req);
    if (!csrfToken && req.method !== "GET") {
        logger.debug("No CSRF token found in request context", "TRPC_CONTEXT", {
            method: req.method,
            path: req.path,
            hasCookies: !!req.cookies,
            cookieNames: req.cookies ? Object.keys(req.cookies) : [],
        });
    }
    // Set security headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    return {
        req,
        res,
        user,
        requestId: Math.random().toString(36).substring(7),
        timestamp: new Date(),
        batchId: undefined, // Will be set by batch middleware when needed
        validatedInput: undefined, // Will be set by input validation middleware when needed
        csrfToken, // Properly extracted CSRF token from cookies
        ...services,
    };
}
