import jwt from 'jsonwebtoken';
import { z } from 'zod';

// JWT payload schema
const JWTPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email().optional(),
  roles: z.array(z.string()).optional(),
  iat: z.number().optional(),
  exp: z.number().optional()
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

/**
 * Custom JWT Error class
 */
export class JWTError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'JWTError';
  }
}

/**
 * JWT Manager class for token operations
 */
export class JWTManager {
  private secret: string;

  constructor(secret?: string) {
    this.secret = secret || process.env.JWT_SECRET || '';
    if (!this.secret) {
      throw new JWTError('JWT_SECRET is not configured');
    }
  }

  /**
   * Generate a JWT token
   */
  generateToken(payload: JWTPayload, expiresIn: string = '7d'): string {
    return jwt.sign(payload, this.secret, { expiresIn });
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.secret, (err, decoded) => {
        if (err) {
          reject(new JWTError(err.message, err.name));
          return;
        }

        try {
          const payload = JWTPayloadSchema.parse(decoded);
          resolve(payload);
        } catch (parseError) {
          reject(new JWTError('Invalid token payload structure'));
        }
      });
    });
  }

  /**
   * Validate a JWT token for WebSocket authentication
   */
  async validateWebSocketToken(token: string): Promise<boolean> {
    try {
      await this.verifyToken(token);
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  /**
   * Extract user ID from JWT token without full verification
   */
  extractUserId(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded?.userId || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1] || null;
  }

  /**
   * Verify access token (alias for verifyToken)
   */
  verifyAccessToken(token: string): { sub: string; email?: string; role?: string } {
    try {
      const decoded = jwt.verify(token, this.secret) as any;
      return {
        sub: decoded.userId || decoded.sub,
        email: decoded.email,
        role: decoded.role || decoded.roles?.[0]
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new JWTError('Token has expired', 'TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new JWTError('Invalid token signature', 'INVALID_SIGNATURE');
      }
      throw new JWTError('Token verification failed', 'VERIFICATION_FAILED');
    }
  }
}

// Create a singleton instance
export const jwtManager = new JWTManager();

// Export standalone functions for backward compatibility
/**
 * Generate a JWT token
 */
export function generateToken(payload: JWTPayload, secret: string = process.env.JWT_SECRET || '', expiresIn: string = '7d'): string {
  if (!secret) {
    throw new JWTError('JWT_SECRET is not configured');
  }
  
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, secret: string = process.env.JWT_SECRET || ''): Promise<JWTPayload> {
  if (!secret) {
    throw new JWTError('JWT_SECRET is not configured');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(new JWTError(err.message, err.name));
        return;
      }

      try {
        const payload = JWTPayloadSchema.parse(decoded);
        resolve(payload);
      } catch (parseError) {
        reject(new JWTError('Invalid token payload structure'));
      }
    });
  });
}

/**
 * Validate a JWT token for WebSocket authentication
 * This is the function that should be passed to WebSocketGateway config
 */
export async function validateWebSocketToken(token: string): Promise<boolean> {
  try {
    await verifyToken(token);
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}

/**
 * Extract user ID from JWT token without full verification
 * Used for quick user identification (still verify token separately)
 */
export function extractUserId(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded?.userId || null;
  } catch {
    return null;
  }
}