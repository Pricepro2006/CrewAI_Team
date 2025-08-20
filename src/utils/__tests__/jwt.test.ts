import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as jwt from 'jsonwebtoken';
import { 
  JWTManager, 
  JWTError,
  generateToken, 
  verifyToken,
  validateWebSocketToken,
  extractUserId,
  jwtManager
} from '../jwt';

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
  decode: vi.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TokenExpiredError';
    }
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'JsonWebTokenError';
    }
  }
}));

describe('JWT Utilities', () => {
  const mockSecret = 'test-secret-key';
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, JWT_SECRET: mockSecret };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('JWTManager', () => {
    describe('constructor', () => {
      it('should create instance with provided secret', () => {
        const manager = new JWTManager('custom-secret');
        expect(manager).toBeDefined();
      });

      it('should use JWT_SECRET from environment', () => {
        const manager = new JWTManager();
        expect(manager).toBeDefined();
      });

      it('should throw error when no secret is available', () => {
        delete process.env.JWT_SECRET;
        expect(() => new JWTManager()).toThrow(JWTError);
        expect(() => new JWTManager()).toThrow('JWT_SECRET is not configured');
      });
    });

    describe('generateToken', () => {
      it('should generate a token with default expiry', () => {
        const manager = new JWTManager(mockSecret);
        const mockToken = 'mock.jwt.token';
        vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

        const payload = {
          userId: 'user123',
          email: 'test@example.com',
          roles: ['user']
        };

        const token = manager.generateToken(payload);

        expect(jwt.sign).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'user123',
            email: 'test@example.com',
            roles: ['user']
          }),
          mockSecret,
          expect.objectContaining({
            expiresIn: '7d'
          })
        );
        expect(token).toBe(mockToken);
      });

      it('should generate a token with custom expiry', () => {
        const manager = new JWTManager(mockSecret);
        const mockToken = 'mock.jwt.token';
        vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

        const payload = { userId: 'user123' };
        const token = manager.generateToken(payload, '30d');

        expect(jwt.sign).toHaveBeenCalledWith(
          expect.anything(),
          mockSecret,
          expect.objectContaining({
            expiresIn: '30d'
          })
        );
        expect(token).toBe(mockToken);
      });

      it('should handle optional fields correctly', () => {
        const manager = new JWTManager(mockSecret);
        vi.mocked(jwt.sign).mockReturnValue('token' as any);

        const payload = { userId: 'user123' };
        manager.generateToken(payload);

        const signCall = vi.mocked(jwt.sign).mock.calls[0];
        expect(signCall[0]).not.toHaveProperty('email');
        expect(signCall[0]).not.toHaveProperty('roles');
      });
    });

    describe('verifyToken', () => {
      it('should verify and return valid token payload', async () => {
        const manager = new JWTManager(mockSecret);
        const mockPayload = {
          userId: 'user123',
          email: 'test@example.com',
          iat: 1234567890,
          exp: 1234567890
        };

        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(null, mockPayload);
        });

        const result = await manager.verifyToken('valid.token');
        expect(result).toEqual(mockPayload);
      });

      it('should reject invalid token', async () => {
        const manager = new JWTManager(mockSecret);
        
        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(new Error('Invalid token'), undefined);
        });

        await expect(manager.verifyToken('invalid.token')).rejects.toThrow(JWTError);
      });

      it('should reject malformed payload', async () => {
        const manager = new JWTManager(mockSecret);
        const invalidPayload = { notUserId: 'test' };

        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(null, invalidPayload);
        });

        await expect(manager.verifyToken('token')).rejects.toThrow('Invalid token payload structure');
      });
    });

    describe('validateWebSocketToken', () => {
      it('should return true for valid token', async () => {
        const manager = new JWTManager(mockSecret);
        const mockPayload = { userId: 'user123' };

        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(null, mockPayload);
        });

        const result = await manager.validateWebSocketToken('valid.token');
        expect(result).toBe(true);
      });

      it('should return false for invalid token', async () => {
        const manager = new JWTManager(mockSecret);
        
        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(new Error('Invalid'), undefined);
        });

        const result = await manager.validateWebSocketToken('invalid.token');
        expect(result).toBe(false);
      });
    });

    describe('extractUserId', () => {
      it('should extract userId from token without verification', () => {
        const manager = new JWTManager(mockSecret);
        const mockDecoded = { userId: 'user123' };

        vi.mocked(jwt.decode).mockReturnValue(mockDecoded as any);

        const userId = manager.extractUserId('some.token');
        expect(userId).toBe('user123');
        expect(jwt.decode).toHaveBeenCalledWith('some.token');
      });

      it('should return null if token cannot be decoded', () => {
        const manager = new JWTManager(mockSecret);
        vi.mocked(jwt.decode).mockReturnValue(null);

        const userId = manager.extractUserId('invalid.token');
        expect(userId).toBeNull();
      });

      it('should return null if userId is not present', () => {
        const manager = new JWTManager(mockSecret);
        vi.mocked(jwt.decode).mockReturnValue({} as any);

        const userId = manager.extractUserId('token');
        expect(userId).toBeNull();
      });
    });

    describe('extractTokenFromHeader', () => {
      it('should extract token from Bearer header', () => {
        const manager = new JWTManager(mockSecret);
        const token = manager.extractTokenFromHeader('Bearer abc123');
        expect(token).toBe('abc123');
      });

      it('should return null for invalid header format', () => {
        const manager = new JWTManager(mockSecret);
        
        expect(manager.extractTokenFromHeader('Token abc123')).toBeNull();
        expect(manager.extractTokenFromHeader('Bearer')).toBeNull();
        expect(manager.extractTokenFromHeader('abc123')).toBeNull();
        expect(manager.extractTokenFromHeader()).toBeNull();
        expect(manager.extractTokenFromHeader('')).toBeNull();
      });
    });

    describe('verifyAccessToken', () => {
      it('should verify and return token claims', () => {
        const manager = new JWTManager(mockSecret);
        const mockDecoded = {
          userId: 'user123',
          email: 'test@example.com',
          role: 'admin'
        };

        vi.mocked(jwt.verify).mockReturnValue(mockDecoded as any);

        const result = manager.verifyAccessToken('token');
        expect(result).toEqual({
          sub: 'user123',
          email: 'test@example.com',
          role: 'admin'
        });
      });

      it('should handle alternative claim names', () => {
        const manager = new JWTManager(mockSecret);
        const mockDecoded = {
          sub: 'user456',
          email: 'test@example.com',
          roles: ['user', 'admin']
        };

        vi.mocked(jwt.verify).mockReturnValue(mockDecoded as any);

        const result = manager.verifyAccessToken('token');
        expect(result).toEqual({
          sub: 'user456',
          email: 'test@example.com',
          role: 'user'
        });
      });

      it('should throw JWTError for expired token', () => {
        const manager = new JWTManager(mockSecret);
        const ExpiredError = jwt.TokenExpiredError as any;
        
        vi.mocked(jwt.verify).mockImplementation(() => {
          throw new ExpiredError('Token expired');
        });

        expect(() => manager.verifyAccessToken('expired.token'))
          .toThrow(JWTError);
        expect(() => manager.verifyAccessToken('expired.token'))
          .toThrow('Token has expired');
      });

      it('should throw JWTError for invalid signature', () => {
        const manager = new JWTManager(mockSecret);
        const JWTError = jwt.JsonWebTokenError as any;
        
        vi.mocked(jwt.verify).mockImplementation(() => {
          throw new JWTError('Invalid signature');
        });

        expect(() => manager.verifyAccessToken('invalid.token'))
          .toThrow('Invalid token signature');
      });
    });
  });

  describe('Standalone Functions', () => {
    describe('generateToken', () => {
      it('should generate token with provided secret', () => {
        const mockToken = 'standalone.token';
        vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

        const payload = { userId: 'user123' };
        const token = generateToken(payload, 'custom-secret');

        expect(jwt.sign).toHaveBeenCalledWith(
          payload,
          'custom-secret',
          expect.objectContaining({ expiresIn: '7d' })
        );
        expect(token).toBe(mockToken);
      });

      it('should use environment secret if not provided', () => {
        vi.mocked(jwt.sign).mockReturnValue('token' as any);

        const payload = { userId: 'user123' };
        generateToken(payload);

        expect(jwt.sign).toHaveBeenCalledWith(
          payload,
          mockSecret,
          expect.anything()
        );
      });

      it('should throw error when no secret available', () => {
        delete process.env.JWT_SECRET;
        const payload = { userId: 'user123' };
        
        expect(() => generateToken(payload, '')).toThrow('JWT_SECRET is not configured');
      });
    });

    describe('verifyToken', () => {
      it('should verify token with callback', async () => {
        const mockPayload = { userId: 'user123' };
        
        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(null, mockPayload);
        });

        const result = await verifyToken('token', 'secret');
        expect(result).toEqual(mockPayload);
      });

      it('should use environment secret if not provided', async () => {
        const mockPayload = { userId: 'user123' };
        
        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(null, mockPayload);
        });

        await verifyToken('token');
        
        expect(jwt.verify).toHaveBeenCalledWith(
          'token',
          mockSecret,
          expect.any(Function)
        );
      });
    });

    describe('validateWebSocketToken', () => {
      it('should validate WebSocket token', async () => {
        const mockPayload = { userId: 'user123' };
        
        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(null, mockPayload);
        });

        const result = await validateWebSocketToken('token');
        expect(result).toBe(true);
      });

      it('should return false for invalid token', async () => {
        vi.mocked(jwt.verify).mockImplementation((token, secret, callback: any) => {
          callback(new Error('Invalid'), undefined);
        });

        const result = await validateWebSocketToken('invalid');
        expect(result).toBe(false);
      });
    });

    describe('extractUserId', () => {
      it('should extract userId from token', () => {
        vi.mocked(jwt.decode).mockReturnValue({ userId: 'user789' } as any);
        
        const userId = extractUserId('token');
        expect(userId).toBe('user789');
      });

      it('should return null for invalid token', () => {
        vi.mocked(jwt.decode).mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const userId = extractUserId('invalid');
        expect(userId).toBeNull();
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should export jwtManager singleton', () => {
      expect(jwtManager).toBeDefined();
      expect(jwtManager).toBeInstanceOf(JWTManager);
    });
  });
});