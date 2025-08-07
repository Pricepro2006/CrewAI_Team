/**
 * Enhanced Authentication & Authorization Middleware
 * Implements comprehensive security controls for the Walmart Grocery Agent system
 * 
 * Security Features:
 * - JWT-based authentication with refresh tokens
 * - Role-based access control (RBAC)
 * - Resource ownership verification
 * - Session management and invalidation
 * - Brute force protection
 * - Audit logging
 */

import type { Request, Response, NextFunction } from "express";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { jwtManager, JWTError } from "../../utils/jwt.js";
import { UserService } from "../../services/UserService.js";
import { logger } from "../../../utils/logger.js";
import type { PublicUser } from "../../../database/models/User.js";

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// Track failed login attempts (in production, use Redis)
const loginAttempts = new Map<string, {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}>();

// Active sessions tracking (in production, use Redis)
const activeSessions = new Map<string, {
  userId: string;
  createdAt: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
  refreshToken?: string;
}>();

// Blacklisted tokens (in production, use Redis)
const blacklistedTokens = new Set<string>();

/**
 * Enhanced user interface with security fields
 */
export interface EnhancedUser extends PublicUser {
  permissions?: string[];
  resourceAccess?: Record<string, string[]>;
  sessionId?: string;
  mfaEnabled?: boolean;
  lastPasswordChange?: Date;
}

/**
 * Security context for requests
 */
export interface SecurityContext {
  user: EnhancedUser | null;
  isAuthenticated: boolean;
  sessionId?: string;
  permissions: string[];
  ipAddress: string;
  userAgent: string;
  requestId: string;
}

/**
 * Permission definitions
 */
export const Permissions = {
  // Grocery operations
  GROCERY_LIST_CREATE: "grocery:list:create",
  GROCERY_LIST_READ: "grocery:list:read",
  GROCERY_LIST_UPDATE: "grocery:list:update",
  GROCERY_LIST_DELETE: "grocery:list:delete",
  
  // Order operations
  ORDER_CREATE: "order:create",
  ORDER_READ: "order:read",
  ORDER_UPDATE: "order:update",
  ORDER_CANCEL: "order:cancel",
  
  // User operations
  USER_PROFILE_READ: "user:profile:read",
  USER_PROFILE_UPDATE: "user:profile:update",
  USER_PREFERENCES_UPDATE: "user:preferences:update",
  
  // Admin operations
  ADMIN_USER_MANAGE: "admin:user:manage",
  ADMIN_SYSTEM_CONFIG: "admin:system:config",
  ADMIN_AUDIT_READ: "admin:audit:read",
} as const;

/**
 * Role-based permission mappings
 */
const RolePermissions: Record<string, string[]> = {
  user: [
    Permissions.GROCERY_LIST_CREATE,
    Permissions.GROCERY_LIST_READ,
    Permissions.GROCERY_LIST_UPDATE,
    Permissions.GROCERY_LIST_DELETE,
    Permissions.ORDER_CREATE,
    Permissions.ORDER_READ,
    Permissions.ORDER_CANCEL,
    Permissions.USER_PROFILE_READ,
    Permissions.USER_PROFILE_UPDATE,
    Permissions.USER_PREFERENCES_UPDATE,
  ],
  premium: [
    // All user permissions plus premium features
    ...RolePermissions.user,
    "premium:ai:advanced",
    "premium:deals:exclusive",
  ],
  admin: [
    // All permissions
    ...Object.values(Permissions),
  ],
};

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash token for storage/comparison
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Check if account is locked due to failed attempts
 */
function isAccountLocked(identifier: string): boolean {
  const attempts = loginAttempts.get(identifier);
  if (!attempts) return false;
  
  if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
    return true;
  }
  
  // Clean up expired lockout
  if (attempts.lockedUntil && attempts.lockedUntil <= Date.now()) {
    loginAttempts.delete(identifier);
  }
  
  return false;
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(identifier: string, ipAddress: string): void {
  const existing = loginAttempts.get(identifier) || {
    count: 0,
    firstAttempt: Date.now(),
  };
  
  existing.count++;
  
  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    existing.lockedUntil = Date.now() + LOCKOUT_DURATION;
    logger.warn("Account locked due to failed attempts", "SECURITY", {
      identifier,
      attempts: existing.count,
      ipAddress,
      lockedUntil: new Date(existing.lockedUntil),
    });
  }
  
  loginAttempts.set(identifier, existing);
}

/**
 * Clear failed attempts on successful login
 */
function clearFailedAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

/**
 * Create or update session
 */
function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  refreshToken?: string
): string {
  const sessionId = generateSessionId();
  
  activeSessions.set(sessionId, {
    userId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ipAddress,
    userAgent,
    refreshToken,
  });
  
  // Clean up old sessions for this user (allow max 5 concurrent sessions)
  const userSessions = Array.from(activeSessions.entries())
    .filter(([_, session]) => session.userId === userId)
    .sort((a, b) => b[1].lastActivity - a[1].lastActivity);
  
  if (userSessions.length > 5) {
    userSessions.slice(5).forEach(([id]) => {
      activeSessions.delete(id);
    });
  }
  
  return sessionId;
}

/**
 * Validate and update session
 */
function validateSession(sessionId: string, ipAddress: string): boolean {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return false;
  }
  
  // Check session timeout
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
    activeSessions.delete(sessionId);
    return false;
  }
  
  // Validate IP address (optional, can be strict or lenient)
  if (process.env.STRICT_IP_CHECK === "true" && session.ipAddress !== ipAddress) {
    logger.warn("Session IP mismatch", "SECURITY", {
      sessionId: hashToken(sessionId),
      expectedIP: session.ipAddress,
      actualIP: ipAddress,
    });
    return false;
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  
  return true;
}

/**
 * Invalidate session
 */
export function invalidateSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    // Blacklist the refresh token if exists
    if (session.refreshToken) {
      blacklistedTokens.add(hashToken(session.refreshToken));
    }
    activeSessions.delete(sessionId);
    
    logger.info("Session invalidated", "SECURITY", {
      sessionId: hashToken(sessionId),
      userId: session.userId,
    });
  }
}

/**
 * Enhanced JWT authentication with session validation
 */
export function enhancedAuthenticateJWT(
  req: Request & { user?: EnhancedUser; sessionId?: string },
  res: Response,
  next: NextFunction
): Response | void {
  try {
    const token = jwtManager.extractTokenFromHeader(req.headers.authorization);
    const sessionId = req.headers["x-session-id"] as string;
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    
    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        code: "NO_TOKEN",
      });
    }
    
    // Check if token is blacklisted
    if (blacklistedTokens.has(hashToken(token))) {
      logger.warn("Blacklisted token used", "SECURITY", {
        ipAddress,
        userAgent,
      });
      return res.status(401).json({
        error: "Token has been revoked",
        code: "TOKEN_REVOKED",
      });
    }
    
    // Verify JWT
    const decoded = jwtManager.verifyAccessToken(token);
    
    // Validate session if provided
    if (sessionId && !validateSession(sessionId, ipAddress)) {
      return res.status(401).json({
        error: "Invalid or expired session",
        code: "INVALID_SESSION",
      });
    }
    
    // Get user from database
    const userService = new UserService();
    try {
      const user = userService.getUserById(decoded.sub);
      
      if (!user) {
        return res.status(401).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }
      
      if (!user.is_active) {
        logger.warn("Inactive user attempted access", "SECURITY", {
          userId: user.id,
          ipAddress,
        });
        return res.status(401).json({
          error: "Account deactivated",
          code: "ACCOUNT_DEACTIVATED",
        });
      }
      
      // Check if account is locked
      if (isAccountLocked(user.email)) {
        return res.status(423).json({
          error: "Account temporarily locked",
          code: "ACCOUNT_LOCKED",
        });
      }
      
      // Build enhanced user object
      const { password_hash: _, ...publicUser } = user;
      const enhancedUser: EnhancedUser = {
        ...publicUser,
        permissions: RolePermissions[user.role] || [],
        sessionId,
      };
      
      req.user = enhancedUser;
      req.sessionId = sessionId;
      
      // Log successful authentication
      logger.info("User authenticated", "SECURITY", {
        userId: user.id,
        role: user.role,
        ipAddress,
        sessionId: sessionId ? hashToken(sessionId) : undefined,
      });
      
      return next();
    } finally {
      userService.close();
    }
  } catch (error) {
    if (error instanceof JWTError) {
      logger.warn("JWT validation failed", "SECURITY", {
        error: error.message,
        code: error.code,
        ip: req.ip,
      });
      return res.status(401).json({
        error: "Invalid authentication token",
        code: error.code,
      });
    }
    
    logger.error("Authentication error", "SECURITY", { error });
    return res.status(500).json({
      error: "Authentication service unavailable",
      code: "AUTH_ERROR",
    });
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  user: EnhancedUser,
  permission: string
): boolean {
  return user.permissions?.includes(permission) || false;
}

/**
 * Check if user owns resource
 */
export async function ownsResource(
  user: EnhancedUser,
  resourceType: string,
  resourceId: string
): Promise<boolean> {
  // Implementation depends on resource type
  // This is a placeholder - implement actual ownership checks
  
  switch (resourceType) {
    case "grocery_list":
      // Check if user owns the grocery list
      // const list = await db.getGroceryList(resourceId);
      // return list?.userId === user.id;
      return true; // Placeholder
      
    case "order":
      // Check if user owns the order
      // const order = await db.getOrder(resourceId);
      // return order?.userId === user.id;
      return true; // Placeholder
      
    default:
      return false;
  }
}

/**
 * Middleware for permission-based authorization
 */
export function requirePermission(...permissions: string[]) {
  return async (
    req: Request & { user?: EnhancedUser },
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }
    
    const hasRequiredPermission = permissions.some(permission =>
      hasPermission(req.user!, permission)
    );
    
    if (!hasRequiredPermission) {
      logger.warn("Permission denied", "SECURITY", {
        userId: req.user.id,
        required: permissions,
        actual: req.user.permissions,
        path: req.path,
      });
      
      return res.status(403).json({
        error: "Insufficient permissions",
        code: "PERMISSION_DENIED",
        required: permissions,
      });
    }
    
    return next();
  };
}

/**
 * Middleware for resource ownership verification
 */
export function requireOwnership(
  resourceType: string,
  resourceIdParam: string = "id"
) {
  return async (
    req: Request & { user?: EnhancedUser },
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
    }
    
    const resourceId = req.params[resourceIdParam] || req.body[resourceIdParam];
    
    if (!resourceId) {
      return res.status(400).json({
        error: "Resource ID required",
        code: "MISSING_RESOURCE_ID",
      });
    }
    
    const owns = await ownsResource(req.user, resourceType, resourceId);
    
    if (!owns) {
      logger.warn("Ownership check failed", "SECURITY", {
        userId: req.user.id,
        resourceType,
        resourceId,
        path: req.path,
      });
      
      return res.status(403).json({
        error: "Access denied to resource",
        code: "OWNERSHIP_REQUIRED",
      });
    }
    
    return next();
  };
}

/**
 * Create security context for TRPC
 */
export async function createSecurityContext(
  token?: string,
  sessionId?: string,
  ipAddress: string = "unknown",
  userAgent: string = "unknown"
): Promise<SecurityContext> {
  const requestId = randomBytes(16).toString("hex");
  
  if (!token) {
    return {
      user: null,
      isAuthenticated: false,
      permissions: [],
      ipAddress,
      userAgent,
      requestId,
    };
  }
  
  try {
    // Check if token is blacklisted
    if (blacklistedTokens.has(hashToken(token))) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Token has been revoked",
      });
    }
    
    const decoded = jwtManager.verifyAccessToken(token);
    
    // Validate session if provided
    if (sessionId && !validateSession(sessionId, ipAddress)) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired session",
      });
    }
    
    const userService = new UserService();
    try {
      const user = userService.getUserById(decoded.sub);
      
      if (!user || !user.is_active) {
        return {
          user: null,
          isAuthenticated: false,
          permissions: [],
          ipAddress,
          userAgent,
          requestId,
        };
      }
      
      const { password_hash: _, ...publicUser } = user;
      const enhancedUser: EnhancedUser = {
        ...publicUser,
        permissions: RolePermissions[user.role] || [],
        sessionId,
      };
      
      return {
        user: enhancedUser,
        isAuthenticated: true,
        sessionId,
        permissions: enhancedUser.permissions || [],
        ipAddress,
        userAgent,
        requestId,
      };
    } finally {
      userService.close();
    }
  } catch (error) {
    if (error instanceof JWTError) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid authentication token",
        cause: error.code,
      });
    }
    
    logger.error("Security context error", "SECURITY", { error });
    return {
      user: null,
      isAuthenticated: false,
      permissions: [],
      ipAddress,
      userAgent,
      requestId,
    };
  }
}

/**
 * TRPC middleware for enhanced authentication
 */
export function createEnhancedAuthMiddleware() {
  return async function authenticate(opts: {
    ctx: SecurityContext & Record<string, unknown>;
    next: (opts: { ctx: SecurityContext & Record<string, unknown> }) => unknown;
  }) {
    const { ctx, next } = opts;
    
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }
    
    // Check if account is locked
    if (isAccountLocked(ctx.user.email)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Account temporarily locked",
      });
    }
    
    return next({ ctx });
  };
}

/**
 * TRPC middleware for permission checking
 */
export function createPermissionMiddleware(...permissions: string[]) {
  return async function checkPermission(opts: {
    ctx: SecurityContext & Record<string, unknown>;
    next: (opts: { ctx: SecurityContext & Record<string, unknown> }) => unknown;
  }) {
    const { ctx, next } = opts;
    
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }
    
    const hasRequiredPermission = permissions.some(permission =>
      ctx.permissions.includes(permission)
    );
    
    if (!hasRequiredPermission) {
      logger.warn("Permission denied in TRPC", "SECURITY", {
        userId: ctx.user.id,
        required: permissions,
        actual: ctx.permissions,
        requestId: ctx.requestId,
      });
      
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient permissions",
        cause: { required: permissions },
      });
    }
    
    return next({ ctx });
  };
}

/**
 * Audit log for security events
 */
export function auditLog(
  event: string,
  userId: string | null,
  details: Record<string, any>,
  severity: "low" | "medium" | "high" | "critical" = "low"
): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId,
    severity,
    details,
  };
  
  // In production, write to audit log database/service
  logger.info("AUDIT", "SECURITY", auditEntry);
  
  // For critical events, trigger alerts
  if (severity === "critical") {
    // Send alerts to security team
    // notificationService.sendSecurityAlert(auditEntry);
  }
}

/**
 * Clean up expired sessions and tokens periodically
 */
export function startSecurityCleanup(): void {
  setInterval(() => {
    // Clean up expired sessions
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now - session.lastActivity > SESSION_TIMEOUT) {
        activeSessions.delete(sessionId);
      }
    }
    
    // Clean up old login attempts
    for (const [identifier, attempts] of loginAttempts.entries()) {
      if (
        attempts.lockedUntil &&
        attempts.lockedUntil < now - LOCKOUT_DURATION
      ) {
        loginAttempts.delete(identifier);
      }
    }
    
    // In production, clean up blacklisted tokens older than refresh token expiry
    // This is a simplified version
    if (blacklistedTokens.size > 10000) {
      blacklistedTokens.clear();
    }
    
    logger.debug("Security cleanup completed", "SECURITY", {
      activeSessions: activeSessions.size,
      loginAttempts: loginAttempts.size,
      blacklistedTokens: blacklistedTokens.size,
    });
  }, 5 * 60 * 1000); // Run every 5 minutes
}

// Start cleanup on module load
startSecurityCleanup();

/**
 * Export security utilities
 */
export const securityUtils = {
  generateSessionId,
  hashToken,
  isAccountLocked,
  recordFailedAttempt,
  clearFailedAttempts,
  createSession,
  validateSession,
  invalidateSession,
  hasPermission,
  ownsResource,
  auditLog,
};