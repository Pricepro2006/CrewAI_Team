/**
 * Secure WebSocket Authentication Middleware
 * Implements JWT-based authentication with proper validation and security checks
 */

import jwt from 'jsonwebtoken';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { WS_SECURITY_CONFIG } from '../../config/websocket-security.config.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';

// JWT Payload Schema
const JWTPayloadSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
  permissions: z.array(z.string()).default(['read']),
  exp: z.number(),
  iat: z.number(),
  sessionId: z.string().optional(),
});

type JWTPayload = z.infer<typeof JWTPayloadSchema>;

// Extended WebSocket with auth properties
export interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated: boolean;
  userId?: string;
  userRole?: 'admin' | 'user' | 'guest';
  permissions?: string[];
  sessionId?: string;
  connectionTime?: number;
  lastActivity?: number;
  ipAddress?: string;
}

// Session storage (in production, use Redis)
const activeSessions = new Map<string, {
  userId: string;
  createdAt: number;
  lastActivity: number;
  rotationCount: number;
}>();

/**
 * Extract JWT token from WebSocket request
 */
function extractToken(request: IncomingMessage): string | null {
  try {
    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameters
    const { query } = parse(request.url || '', true);
    if (query.token && typeof query.token === 'string') {
      return query.token;
    }

    // Check cookie
    const cookies = request.headers.cookie?.split(';') || [];
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'ws_token') {
        return value || null;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error extracting token', 'WS_AUTH', { error });
    return null;
  }
}

/**
 * Verify and decode JWT token
 */
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET not configured', 'WS_AUTH');
      return null;
    }

    // Verify token with strict options
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: WS_SECURITY_CONFIG.AUTH.JWT_ALGORITHMS as any,
      maxAge: `${WS_SECURITY_CONFIG.AUTH.TOKEN_EXPIRY_MS}ms`,
    }) as any;

    // Validate payload schema
    const validated = JWTPayloadSchema.parse(decoded);

    // Check if token is expired
    if (validated.exp * 1000 < Date.now()) {
      logger.warn('Token expired', 'WS_AUTH', { userId: validated.userId });
      return null;
    }

    return validated;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', 'WS_AUTH', { error: error.message });
    } else if (error instanceof z.ZodError) {
      logger.warn('Invalid JWT payload structure', 'WS_AUTH', { errors: error.errors });
    } else {
      logger.error('Token verification error', 'WS_AUTH', { error });
    }
    return null;
  }
}

/**
 * Validate origin header for CORS protection
 */
function validateOrigin(request: IncomingMessage): boolean {
  if (!WS_SECURITY_CONFIG.CORS.STRICT_ORIGIN) {
    return true; // Skip in development
  }

  const origin = request.headers.origin;
  if (!origin) {
    logger.warn('Missing origin header', 'WS_AUTH');
    return false;
  }

  const isAllowed = WS_SECURITY_CONFIG.CORS.ALLOWED_ORIGINS.includes(origin);
  if (!isAllowed) {
    logger.warn('Rejected connection from unauthorized origin', 'WS_AUTH', { origin });
  }

  return isAllowed;
}

/**
 * Get client IP address from request
 */
function getClientIP(request: IncomingMessage): string {
  const xForwardedFor = request.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const forwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
    return forwarded ? forwarded.split(',')[0]?.trim() || 'unknown' : 'unknown';
  }
  
  const xRealIP = request.headers['x-real-ip'];
  if (xRealIP) {
    const realIP = Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
    return realIP || 'unknown';
  }

  return request.socket.remoteAddress || 'unknown';
}

/**
 * Create or rotate session
 */
function manageSession(userId: string, sessionId?: string): string {
  const now = Date.now();
  
  if (sessionId && activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId)!;
    
    // Check if rotation is needed
    if (now - session.createdAt > WS_SECURITY_CONFIG.AUTH.SESSION_ROTATION_MS) {
      // Rotate session
      const newSessionId = `ws_session_${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
      activeSessions.delete(sessionId);
      activeSessions.set(newSessionId, {
        userId,
        createdAt: now,
        lastActivity: now,
        rotationCount: session.rotationCount + 1,
      });
      
      logger.info('Session rotated', 'WS_AUTH', { 
        userId, 
        oldSessionId: sessionId, 
        newSessionId,
        rotationCount: session.rotationCount + 1
      });
      
      return newSessionId;
    }
    
    // Update activity
    session.lastActivity = now;
    return sessionId;
  }
  
  // Create new session
  const newSessionId = `ws_session_${userId}_${now}_${Math.random().toString(36).substr(2, 9)}`;
  activeSessions.set(newSessionId, {
    userId,
    createdAt: now,
    lastActivity: now,
    rotationCount: 0,
  });
  
  return newSessionId;
}

/**
 * Main authentication middleware for WebSocket connections
 */
export async function authenticateWebSocket(
  ws: AuthenticatedWebSocket,
  request: IncomingMessage
): Promise<boolean> {
  try {
    // Validate origin first
    if (!validateOrigin(request)) {
      ws.close(1008, 'Invalid origin');
      return false;
    }

    // Get client IP
    const clientIP = getClientIP(request);
    ws.ipAddress = clientIP;

    // Extract and verify token
    const token = extractToken(request);
    
    if (!token) {
      if (WS_SECURITY_CONFIG.AUTH.REQUIRE_AUTH) {
        logger.warn('Connection rejected - no token provided', 'WS_AUTH', { ip: clientIP });
        ws.close(1008, 'Authentication required');
        return false;
      }
      
      // Allow unauthenticated in development only
      ws.isAuthenticated = false;
      ws.userRole = 'guest';
      ws.permissions = ['read'];
      return true;
    }

    // Verify token
    const payload = await verifyToken(token);
    
    if (!payload) {
      logger.warn('Connection rejected - invalid token', 'WS_AUTH', { ip: clientIP });
      ws.close(1008, 'Invalid authentication token');
      return false;
    }

    // Set authentication properties
    ws.isAuthenticated = true;
    ws.userId = payload.userId;
    ws.userRole = payload.role;
    ws.permissions = payload.permissions;
    ws.connectionTime = Date.now();
    ws.lastActivity = Date.now();

    // Manage session
    ws.sessionId = manageSession(payload.userId, payload.sessionId);

    logger.info('WebSocket authenticated', 'WS_AUTH', {
      userId: payload.userId,
      role: payload.role,
      sessionId: ws.sessionId,
      ip: clientIP,
    });

    return true;
  } catch (error) {
    logger.error('Authentication error', 'WS_AUTH', { error });
    ws.close(1011, 'Authentication error');
    return false;
  }
}

/**
 * Check if user has required permission
 */
export function hasPermission(
  ws: AuthenticatedWebSocket,
  requiredPermission: string
): boolean {
  if (!ws.isAuthenticated) {
    return false;
  }

  // Admins have all permissions
  if (ws.userRole === 'admin') {
    return true;
  }

  return ws.permissions?.includes(requiredPermission) || false;
}

/**
 * Update last activity timestamp
 */
export function updateActivity(ws: AuthenticatedWebSocket): void {
  ws.lastActivity = Date.now();
  
  if (ws.sessionId && activeSessions.has(ws.sessionId)) {
    const session = activeSessions.get(ws.sessionId)!;
    session.lastActivity = Date.now();
  }
}

/**
 * Clean up session on disconnect
 */
export function cleanupSession(ws: AuthenticatedWebSocket): void {
  if (ws.sessionId) {
    // Don't delete immediately - keep for potential reconnection
    setTimeout(() => {
      const session = activeSessions.get(ws.sessionId!);
      if (session && Date.now() - session.lastActivity > WS_SECURITY_CONFIG.CONNECTION.IDLE_TIMEOUT_MS) {
        activeSessions.delete(ws.sessionId!);
        logger.info('Session cleaned up', 'WS_AUTH', { sessionId: ws.sessionId });
      }
    }, WS_SECURITY_CONFIG.CONNECTION.IDLE_TIMEOUT_MS);
  }
}

/**
 * Generate new JWT token for WebSocket authentication
 */
export function generateWSToken(userId: string, role: 'admin' | 'user' = 'user'): string {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload: Omit<JWTPayload, 'exp' | 'iat'> = {
    userId,
    role,
    permissions: role === 'admin' ? ['read', 'write', 'admin'] : ['read', 'write'],
    sessionId: `ws_session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: WS_SECURITY_CONFIG.AUTH.TOKEN_EXPIRY_MS / 1000,
  });
}

// Cleanup inactive sessions periodically
setInterval(() => {
  const now = Date.now();
  const timeout = WS_SECURITY_CONFIG.CONNECTION.IDLE_TIMEOUT_MS;
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > timeout) {
      activeSessions.delete(sessionId);
      logger.debug('Inactive session removed', 'WS_AUTH', { sessionId });
    }
  }
}, 60000); // Check every minute