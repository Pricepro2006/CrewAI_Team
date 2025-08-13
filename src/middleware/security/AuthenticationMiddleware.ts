/**
 * Authentication Middleware for Walmart Grocery Agent
 * Provides JWT-based authentication and user context management
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  permissions: string[];
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  sessionId: string;
}

export class AuthenticationMiddleware {
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecretKey();
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not set, using generated key. This should not be used in production!', 'AUTH');
    }
  }

  /**
   * Generate a secure JWT secret key if not provided
   */
  private generateSecretKey(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Middleware to authenticate JWT tokens
   */
  authenticate = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'No valid authentication token provided'
        });
        return;
      }

      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Validate required fields
      if (!decoded.sub || !decoded.email || !decoded.role) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Token missing required user information'
        });
        return;
      }

      // Create authenticated user object
      const user: AuthenticatedUser = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || 'user',
        permissions: decoded.permissions || [],
        sessionId: decoded.sessionId || this.generateSessionId()
      };

      // Attach user to request
      (req as AuthenticatedRequest).user = user;
      (req as AuthenticatedRequest).sessionId = user.sessionId;

      logger.info(`User authenticated: ${user.id}`, 'AUTH', {
        userId: user.id,
        sessionId: user.sessionId,
        role: user.role
      });

      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          error: 'Token expired',
          message: 'Authentication token has expired'
        });
      } else if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          error: 'Invalid token',
          message: 'Authentication token is invalid'
        });
      } else {
        logger.error('Authentication error', 'AUTH', { error });
        res.status(500).json({
          error: 'Authentication failed',
          message: 'Internal authentication error'
        });
      }
    }
  };

  /**
   * Middleware for optional authentication (user context if available)
   */
  optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        
        if (decoded.sub && decoded.email) {
          const user: AuthenticatedUser = {
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role || 'user',
            permissions: decoded.permissions || [],
            sessionId: decoded.sessionId || this.generateSessionId()
          };

          (req as AuthenticatedRequest).user = user;
          (req as AuthenticatedRequest).sessionId = user.sessionId;
        }
      }

      next();
    } catch (error) {
      // For optional auth, continue without user context
      next();
    }
  };

  /**
   * Middleware to require specific roles
   */
  requireRole = (roles: string | string[]) => {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    
    return (req: Request, res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Must be authenticated to access this resource'
        });
        return;
      }

      if (!roleArray.includes(authReq.user.role)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          message: `Required role: ${roleArray.join(' or ')}`
        });
        return;
      }

      next();
    };
  };

  /**
   * Generate JWT token for user
   */
  generateToken(user: Partial<AuthenticatedUser>): string {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role || 'user',
      permissions: user.permissions || [],
      sessionId: user.sessionId || this.generateSessionId(),
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'walmart-grocery-agent',
      audience: 'walmart-grocery-users'
    });
  }

  /**
   * Extract token from request headers
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter as fallback (for WebSocket handshake)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token;
    }
    
    return null;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate user permissions
   */
  hasPermission(user: AuthenticatedUser, permission: string): boolean {
    return user.permissions.includes(permission) || user.role === 'admin';
  }

  /**
   * Create a test user token (development only)
   */
  createTestToken(userId: string = 'test-user'): string {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test tokens cannot be created in production');
    }

    const testUser: Partial<AuthenticatedUser> = {
      id: userId,
      email: `${userId}@test.local`,
      name: 'Test User',
      role: 'user',
      permissions: ['walmart:read', 'walmart:write'],
      sessionId: this.generateSessionId()
    };

    return this.generateToken(testUser);
  }
}

// Export singleton instance
export const authMiddleware = new AuthenticationMiddleware();