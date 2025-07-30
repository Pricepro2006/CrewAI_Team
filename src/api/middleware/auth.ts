import type { Request, Response, NextFunction } from 'express';
import { TRPCError } from '@trpc/server';
import { jwtManager, JWTError } from '../utils/jwt.js';
import { UserService } from '../services/UserService.js';
import type { PublicUser } from '../../database/models/User.js';

/**
 * Authentication Middleware
 * Provides JWT-based authentication for Express routes and TRPC procedures
 */

export interface AuthenticatedRequest extends Request {
  user?: PublicUser;
  token?: string;
}

export interface AuthContext {
  user: PublicUser | null;
  isAuthenticated: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Express middleware for JWT authentication
 */
export function authenticateJWT(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Response | void {
  try {
    const token = jwtManager.extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    const decoded = jwtManager.verifyAccessToken(token);
    const userService = new UserService();
    
    try {
      const user = userService.getUserById(decoded.sub);
      
      if (!user) {
        return res.status(401).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!user.is_active) {
        return res.status(401).json({ 
          error: 'Account deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Remove sensitive data
      const { password_hash, ...publicUser } = user;
      req.user = publicUser;
      req.token = token;
      
      return next();
    } finally {
      userService.close();
    }
  } catch (error) {
    if (error instanceof JWTError) {
      return res.status(401).json({ 
        error: error.message,
        code: error.code
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Express middleware for optional JWT authentication
 * Continues even if no token is provided, but validates if present
 */
export function optionalAuthenticateJWT(
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): void {
  try {
    const token = jwtManager.extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      req.user = undefined;
      return next();
    }

    const decoded = jwtManager.verifyAccessToken(token);
    const userService = new UserService();
    
    try {
      const user = userService.getUserById(decoded.sub);
      
      if (user && user.is_active) {
        const { password_hash, ...publicUser } = user;
        req.user = publicUser;
        req.token = token;
      }
      
      return next();
    } finally {
      userService.close();
    }
  } catch (error) {
    // For optional auth, continue even if token is invalid
    req.user = undefined;
    return next();
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(...roles: ('user' | 'admin' | 'moderator')[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    return next();
  };
}

/**
 * TRPC authentication middleware
 */
export async function createAuthContext(token?: string): Promise<AuthContext> {
  if (!token) {
    return { user: null, isAuthenticated: false };
  }

  try {
    const decoded = jwtManager.verifyAccessToken(token);
    const userService = new UserService();
    
    try {
      const user = userService.getUserById(decoded.sub);
      
      if (!user || !user.is_active) {
        return { user: null, isAuthenticated: false };
      }

      const { password_hash, ...publicUser } = user;
      return { user: publicUser, isAuthenticated: true };
    } finally {
      userService.close();
    }
  } catch (error) {
    if (error instanceof JWTError) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: error.message,
        cause: error.code
      });
    }
    
    console.error('TRPC auth context error:', error);
    return { user: null, isAuthenticated: false };
  }
}

/**
 * TRPC middleware for protected procedures
 */
export function createTRPCAuthMiddleware() {
  return async function isAuthenticated(opts: any) {
    const { ctx, next } = opts;
    
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user // user is already validated
      }
    });
  };
}

/**
 * TRPC middleware for role-based authorization
 */
export function createTRPCRoleMiddleware(...roles: ('user' | 'admin' | 'moderator')[]) {
  return async function requireRole(opts: any) {
    const { ctx, next } = opts;
    
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
        cause: {
          required: roles,
          current: ctx.user.role
        }
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  };
}

/**
 * Utility function to extract user ID from context
 */
export function getUserIdFromContext(ctx: any): string {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User ID not found in context'
    });
  }
  return ctx.user.id;
}

/**
 * Utility function to check if user has admin privileges
 */
export function isAdmin(user?: PublicUser): boolean {
  return user?.role === 'admin';
}

/**
 * Utility function to check if user has moderator or admin privileges
 */
export function isModerator(user?: PublicUser): boolean {
  return user?.role === 'moderator' || user?.role === 'admin';
}

/**
 * Rate limiting for authentication endpoints
 */
export function createAuthRateLimit() {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const maxAttempts = 5;
  const windowMs = 15 * 60 * 1000; // 15 minutes

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    const current = attempts.get(key);
    
    if (current && now < current.resetAt) {
      if (current.count >= maxAttempts) {
        return res.status(429).json({
          error: 'Too many authentication attempts',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((current.resetAt - now) / 1000)
        });
      }
      current.count++;
    } else {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
    }
    
    return next();
  };
}

/**
 * Verify JWT token for testing
 */
export function verifyJWT(token: string): AuthUser {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  try {
    const decoded = jwtManager.verifyAccessToken(token);
    
    if (!decoded.sub || !decoded.email) {
      throw new Error('Invalid token payload');
    }

    return {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user'
    };
  } catch (error) {
    if (error instanceof JWTError) {
      if (error.code === 'TOKEN_EXPIRED') {
        throw new Error('Token has expired');
      } else if (error.code === 'INVALID_SIGNATURE') {
        throw new Error('Invalid token signature');
      }
    }
    throw error;
  }
}