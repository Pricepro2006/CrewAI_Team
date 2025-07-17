import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { MasterOrchestrator } from "../../core/master-orchestrator/MasterOrchestrator";
import { ConversationService } from "../services/ConversationService";
import ollamaConfig from "../../config/ollama.config";
import { logger } from "../../utils/logger";
import jwt from "jsonwebtoken";

// User interface for type safety
export interface User {
  id: string;
  email?: string;
  role: "admin" | "user" | "guest";
  permissions: string[];
  lastActivity: Date;
}

// Initialize services (singleton pattern)
let masterOrchestrator: MasterOrchestrator;
let conversationService: ConversationService;

async function initializeServices() {
  if (!masterOrchestrator) {
    masterOrchestrator = new MasterOrchestrator({
      ollamaUrl: ollamaConfig.main.baseUrl!,
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

  return {
    masterOrchestrator,
    conversationService,
    agentRegistry: masterOrchestrator.agentRegistry,
    ragSystem: masterOrchestrator.ragSystem,
  };
}

// JWT verification utility
async function verifyJWT(token: string): Promise<User | null> {
  try {
    const secret =
      process.env.JWT_SECRET || "dev-secret-key-change-in-production";
    const decoded = jwt.verify(token, secret) as any;

    // In production, validate against database
    const user: User = {
      id: decoded.sub || decoded.userId || "guest",
      email: decoded.email,
      role: decoded.role || "guest",
      permissions: decoded.permissions || [],
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

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Validate request and extract security info
  const { ip, userAgent } = validateRequest(req);

  // Get services
  const services = await initializeServices();

  // Extract and verify JWT if present
  const token = req.headers.authorization?.replace("Bearer ", "");
  let user: User | null = null;

  if (token) {
    user = await verifyJWT(token);
  }

  // Set default guest user if no authentication
  if (!user) {
    user = {
      id: `guest-${ip.replace(/\./g, "-")}-${Date.now()}`,
      role: "guest",
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
    ...services,
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
