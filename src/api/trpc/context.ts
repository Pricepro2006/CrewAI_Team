import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator";
import { ConversationService } from "../services/ConversationService";
import { TaskService } from "../services/TaskService";
import { MaestroFramework } from "../../core/maestro/MaestroFramework";
import {
  UserService,
  UserRole,
  type User as DBUser,
  type JWTPayload,
} from "../services/UserService";
import ollamaConfig from "../../config/ollama.config";
import { logger } from "../../utils/logger";
import { mcpToolsService } from "../services/MCPToolsService";
import { DealDataService } from "../services/DealDataService";
import { EmailStorageService } from "../services/EmailStorageService";
import { WalmartGroceryService } from "../services/WalmartGroceryService";
import { guestUserService } from "../services/GuestUserService";

// Context User interface (extends DB user with runtime properties)
export interface User extends Omit<DBUser, "passwordHash"> {
  permissions: string[];
  lastActivity: Date;
  metadata?: {
    isGuest?: boolean;
    ip?: string;
    userAgent?: string;
    sessionStart?: string;
  };
}

// Initialize services (singleton pattern)
let masterOrchestrator: MasterOrchestrator;
let conversationService: ConversationService;
let maestroFramework: MaestroFramework;
let taskService: TaskService;
let userService: UserService;
let dealDataService: DealDataService;
let emailStorageService: EmailStorageService;
let walmartGroceryService: WalmartGroceryService;

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
    emailStorageService = new EmailStorageService();
  }

  if (!walmartGroceryService) {
    walmartGroceryService = WalmartGroceryService.getInstance();
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
    agentRegistry: masterOrchestrator.agentRegistry,
    ragSystem: masterOrchestrator.ragSystem,
    mcpTools: mcpToolsService.getAvailableTools(),
  };
}

// JWT verification utility
async function verifyJWT(
  token: string,
  userService: UserService,
): Promise<User | null> {
  try {
    // Verify token using UserService
    const payload = await userService.verifyToken(token);

    // Get full user data from database
    const dbUser = await userService.getById(payload.userId);
    if (!dbUser || !dbUser.isActive) {
      logger.warn("User not found or inactive", "AUTH", {
        userId: payload.userId,
      });
      return null;
    }

    // Map role-based permissions
    const permissions = getPermissionsForRole(dbUser.role);

    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      role: dbUser.role,
      isActive: dbUser.isActive,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      lastLoginAt: dbUser.lastLoginAt,
      permissions,
      lastActivity: new Date(),
    };

    logger.debug("JWT verification successful", "AUTH", {
      userId: user.id,
      role: user.role,
    });

    return user;
  } catch (error) {
    logger.warn("JWT verification failed", "AUTH", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

// Helper to get permissions based on role
function getPermissionsForRole(role: string): string[] {
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
function validateRequest(req: any) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const userAgent = req.headers["user-agent"] || "unknown";

  // Log security-relevant request info
  logger.debug("Processing tRPC request", "SECURITY", {
    ip,
    userAgent,
    method: req.method,
    path: req.path,
    hasAuth: !!req.headers.authorization,
  });

  // Enhanced security checks
  if (userAgent.includes("bot") && !userAgent.includes("GoogleBot")) {
    logger.warn("Potential bot detected", "SECURITY", { ip, userAgent });
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /sql.*inject/i,
    /union.*select/i,
    /<script>/i,
    /javascript:/i,
    /onerror=/i,
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(userAgent) || pattern.test(req.url || '') || 
    pattern.test(JSON.stringify(req.query || {}))
  );
  
  if (isSuspicious) {
    logger.error("Suspicious request detected", "SECURITY_ALERT", {
      ip,
      userAgent,
      url: req.url,
      method: req.method,
    });
  }

  return { ip, userAgent };
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

export async function createContext({
  req,
  res,
}: CreateExpressContextOptions): Promise<TRPCContext> {
  // Validate request and extract security info
  const { ip, userAgent } = validateRequest(req);

  // Get services
  const services = await initializeServices();

  // Extract and verify JWT if present
  const token = req.headers.authorization?.replace("Bearer ", "");
  let user: User | null = null;

  if (token) {
    user = await verifyJWT(token, services.userService);
  }

  // Create secure guest user if no authentication
  if (!user) {
    // Use secure guest user service
    const guestUser = await guestUserService.createGuestUser(ip, userAgent);
    
    if (!guestUser) {
      // Guest user creation failed (likely rate limited)
      logger.error("Failed to create guest user", "SECURITY", {
        ip,
        userAgent,
        reason: "Rate limit or validation failure",
      });
      
      // Return a minimal error response
      throw new Error("Unable to process request. Please try again later.");
    }
    
    user = guestUser;
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
    batchId: undefined as string | undefined, // Will be set by batch middleware when needed
    validatedInput: undefined as unknown, // Will be set by input validation middleware when needed
    ...services,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
