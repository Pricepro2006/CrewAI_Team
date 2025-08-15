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
 * Generate a JWT token
 */
export function generateToken(payload: JWTPayload, secret: string = process.env.JWT_SECRET || '', expiresIn: string = '7d'): string {
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string, secret: string = process.env.JWT_SECRET || ''): Promise<JWTPayload> {
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
        return;
      }

      try {
        const payload = JWTPayloadSchema.parse(decoded);
        resolve(payload);
      } catch (parseError) {
        reject(new Error('Invalid token payload structure'));
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