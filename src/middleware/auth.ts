import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import appConfig from '../config/app.config';

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  isAdmin: boolean;
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// JWT verification middleware
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(); // Continue without user - rate limiting will handle anonymous users
  }

  try {
    const decoded = jwt.verify(token, appConfig.security.jwtSecret) as any;
    
    // Construct user object from JWT payload
    req.user = {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      role: decoded.role || 'user',
      isAdmin: decoded.role === 'admin' || decoded.isAdmin || false,
      permissions: decoded.permissions || [],
      createdAt: new Date(decoded.createdAt || Date.now()),
      lastLogin: decoded.lastLogin ? new Date(decoded.lastLogin) : undefined
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.warn('Invalid JWT token:', error.message);
      // Continue without user but log the attempt
    } else if (error instanceof jwt.TokenExpiredError) {
      console.warn('Expired JWT token');
      // Continue without user
    } else {
      console.error('JWT verification error:', error);
    }
    
    // Don't fail the request, just continue without authentication
    // Rate limiting will still apply based on IP
    next();
  }
};

// Require authentication middleware
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid authentication token'
    });
  }
  
  next();
};

// Require admin role middleware
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please provide a valid authentication token'
    });
  }

  if (!req.user.isAdmin && req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Admin access required'
    });
  }

  next();
};

// Check specific permission middleware
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid authentication token'
      });
    }

    if (!req.user.isAdmin && !req.user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `Permission '${permission}' required`
      });
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (user: Partial<User>): string => {
  const payload = {
    id: user.id,
    sub: user.id, // Standard JWT subject claim
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    permissions: user.permissions,
    createdAt: user.createdAt?.toISOString(),
    lastLogin: user.lastLogin?.toISOString(),
    iat: Math.floor(Date.now() / 1000), // Issued at
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // Expires in 24 hours
  };

  return jwt.sign(payload, appConfig.security.jwtSecret, {
    algorithm: 'HS256'
  });
};

// Verify and refresh token
export const refreshToken = (token: string): string | null => {
  try {
    const decoded = jwt.verify(token, appConfig.security.jwtSecret, {
      ignoreExpiration: true // We'll check expiration manually
    }) as any;

    // Check if token is close to expiring (within 2 hours)
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    const twoHours = 2 * 60 * 60;

    if (timeUntilExpiry > twoHours) {
      return null; // Token doesn't need refresh yet
    }

    // Generate new token with same payload but new timestamps
    const newPayload = {
      ...decoded,
      iat: now,
      exp: now + (24 * 60 * 60),
      lastLogin: new Date().toISOString()
    };

    return jwt.sign(newPayload, appConfig.security.jwtSecret, {
      algorithm: 'HS256'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
};

// Extract user ID from request (for rate limiting)
export const extractUserId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.id || null;
};

// Check if user is admin (for rate limiting bypass)
export const isAdminUser = (req: Request): boolean => {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.isAdmin || authReq.user?.role === 'admin' || false;
};