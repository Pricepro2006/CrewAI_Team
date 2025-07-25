import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export function verifyJWT(token: string): AuthUser {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as any;
    
    // Validate required fields
    if (!payload.sub || !payload.email) {
      throw new Error('Invalid token payload');
    }
    
    // Check for empty fields
    if (payload.sub === '' || payload.email === '') {
      throw new Error('Invalid token payload');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role || 'user'
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token signature');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired');
    }
    throw error;
  }
}
