import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator.js";
import { ConversationService } from "../services/ConversationService.js";
import { TaskService } from "../services/TaskService.js";
import { MaestroFramework } from "../../core/maestro/MaestroFramework.js";
import { UserService } from "../services/UserService.js";
import type { PublicUser } from "../../database/models/User.js";
import { jwtManager, JWTError } from "../utils/jwt.js";
import ollamaConfig from "../../config/ollama.config.js";
import { logger } from "../../utils/logger.js";
import { mcpToolsService } from "../services/MCPToolsService.js";
import { DealDataService } from "../services/DealDataService.js";
import { EmailStorageService } from "../services/EmailStorageService.js";
import { WalmartGroceryService } from "../services/WalmartGroceryService.js";

// Context User interface (extends PublicUser with runtime properties)
export interface User extends PublicUser {
  permissions: string[];
  lastActivity: Date;
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

    const user: User = {
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
  } catch (error) {
    if (error instanceof JWTError) {
      logger.warn("JWT verification failed", "AUTH", {
        error: error.message,
        code: error.code,
      });
    } else {
      logger.warn("JWT verification failed", "AUTH", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
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

  // Basic security checks
  if (userAgent.includes("bot") && !userAgent.includes("GoogleBot")) {
    logger.warn("Potential bot detected", "SECURITY", { ip, userAgent });
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
  csrfToken?: string;
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
    csrfToken: undefined as string | undefined, // Will be set by CSRF middleware when needed
    ...services,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
