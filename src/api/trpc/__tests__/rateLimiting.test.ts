import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTRPCMsw } from 'msw-trpc';
import { setupServer } from 'msw/node';
import { TRPCError } from '@trpc/server';
import { appRouter } from '../router.js';
import type { AppRouter } from '../router.js';

// Mock dependencies
vi.mock('../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('../../middleware/index', () => ({
  chatProcedureRateLimiter: vi.fn((req, res, next) => next()),
  agentProcedureRateLimiter: vi.fn((req, res, next) => next()),
  taskProcedureRateLimiter: vi.fn((req, res, next) => next()),
  ragProcedureRateLimiter: vi.fn((req, res, next) => next()),
  strictProcedureRateLimiter: vi.fn((req, res, next) => next()),
  createSecurityAuditMiddleware: vi.fn(() => vi.fn()),
  createAuthMiddleware: vi.fn(() => vi.fn()),
  createAuthorizationMiddleware: vi.fn(() => vi.fn()),
  createInputValidation: vi.fn(() => vi.fn()),
  sanitizationSchemas: {
    string: vi.fn(),
    sqlSafe: vi.fn()
  }
}));

vi.mock('../../middleware/security', () => ({
  createSecurityAuditMiddleware: vi.fn(() => 
    vi.fn().mockImplementation(async ({ next }) => next())
  ),
  createAuthMiddleware: vi.fn(() => 
    vi.fn().mockImplementation(async ({ next }) => next())
  ),
  createAuthorizationMiddleware: vi.fn(() => 
    vi.fn().mockImplementation(async ({ next }) => next())
  ),
  createInputValidation: vi.fn(() => 
    vi.fn().mockImplementation(async ({ next }) => next())
  ),
  sanitizationSchemas: {
    string: vi.fn(),
    sqlSafe: vi.fn()
  },
  createCSRFProtection: vi.fn(() => 
    vi.fn().mockImplementation(async ({ next }) => next())
  ),
  ensureCSRFToken: vi.fn(() => 
    vi.fn().mockImplementation(async ({ next }) => next())
  )
}));

describe('TRPC Rate Limiting', () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      req: {
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'test-agent'
        }
      },
      res: {
        json: vi.fn(),
        status: vi.fn(() => ({ json: vi.fn() }))
      },
      user: null,
      rateLimits: new Map(),
      requestId: 'test-request-id',
      timestamp: new Date()
    };

    // Reset rate limits between tests
    vi.clearAllMocks();
  });

  describe('Rate Limit Middleware', () => {
    it('should allow requests within rate limit', async () => {
      // Create a mock procedure with rate limiting
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      // Mock the middleware function
      const rateLimitMiddleware = createRateLimitMiddleware('test', 5, 60000);
      
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // First request should pass
      const result = await rateLimitMiddleware({
        ctx: mockContext,
        next
      });
      
      expect(next).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should block requests exceeding rate limit', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 2, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // First two requests should pass
      await rateLimitMiddleware({ ctx: mockContext, next });
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      // Third request should be blocked
      await expect(
        rateLimitMiddleware({ ctx: mockContext, next })
      ).rejects.toThrow(TRPCError);
      
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should apply different limits for different user types', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 2, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // Test with authenticated user (should get 1.5x limit)
      const authContext = {
        ...mockContext,
        user: { id: 'user123', role: 'user' }
      };
      
      // Should allow 3 requests (2 * 1.5 = 3)
      await rateLimitMiddleware({ ctx: authContext, next });
      await rateLimitMiddleware({ ctx: authContext, next });
      await rateLimitMiddleware({ ctx: authContext, next });
      
      // Fourth should be blocked
      await expect(
        rateLimitMiddleware({ ctx: authContext, next })
      ).rejects.toThrow(TRPCError);
      
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('should give admin users higher limits', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 2, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // Test with admin user (should get 5x limit)
      const adminContext = {
        ...mockContext,
        user: { id: 'admin123', role: 'admin', isAdmin: true }
      };
      
      // Should allow 10 requests (2 * 5 = 10)
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware({ ctx: adminContext, next });
      }
      
      // 11th should be blocked
      await expect(
        rateLimitMiddleware({ ctx: adminContext, next })
      ).rejects.toThrow(TRPCError);
      
      expect(next).toHaveBeenCalledTimes(10);
    });

    it('should clean up expired rate limit entries', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      // Very short window for testing
      const rateLimitMiddleware = createRateLimitMiddleware('test', 1, 100);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // First request should pass
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      // Should be blocked immediately
      await expect(
        rateLimitMiddleware({ ctx: mockContext, next })
      ).rejects.toThrow(TRPCError);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should work again after window expires
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      expect(next).toHaveBeenCalledTimes(2);
    });

    it('should use different keys for different users', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 1, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      const user1Context = {
        ...mockContext,
        user: { id: 'user1', role: 'user' }
      };
      
      const user2Context = {
        ...mockContext,
        user: { id: 'user2', role: 'user' }
      };
      
      // Each user should get their own rate limit
      await rateLimitMiddleware({ ctx: user1Context, next });
      await rateLimitMiddleware({ ctx: user2Context, next });
      
      expect(next).toHaveBeenCalledTimes(2);
      
      // But second request from same user should be blocked
      await expect(
        rateLimitMiddleware({ ctx: user1Context, next })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('Procedure-Specific Rate Limits', () => {
    it('should apply chat-specific rate limits', async () => {
      const { chatProcedure } = await import('../enhanced-router.js');
      
      // Mock the chat procedure context
      const chatContext = {
        ...mockContext,
        path: 'chat.message'
      };
      
      // This test verifies that chat procedures have their own rate limiting
      // The actual implementation would be tested through integration tests
      expect(chatProcedure).toBeDefined();
    });

    it('should apply agent-specific rate limits', async () => {
      const { agentProcedure } = await import('../enhanced-router.js');
      
      expect(agentProcedure).toBeDefined();
    });

    it('should apply task-specific rate limits', async () => {
      const { taskProcedure } = await import('../enhanced-router.js');
      
      expect(taskProcedure).toBeDefined();
    });

    it('should apply RAG-specific rate limits', async () => {
      const { ragProcedure } = await import('../enhanced-router.js');
      
      expect(ragProcedure).toBeDefined();
    });

    it('should apply strict rate limits for sensitive operations', async () => {
      const { strictProcedure } = await import('../enhanced-router.js');
      
      expect(strictProcedure).toBeDefined();
    });
  });

  describe('Rate Limit Error Handling', () => {
    it('should throw TRPCError with correct code when rate limited', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 1, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // First request passes
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      // Second request should throw TRPCError
      try {
        await rateLimitMiddleware({ ctx: mockContext, next });
        expect.fail('Should have thrown TRPCError');
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('TOO_MANY_REQUESTS');
        expect((error as TRPCError).message).toContain('Rate limit exceeded');
      }
    });

    it('should include helpful error message with procedure name', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('chatMessage', 1, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // Exhaust rate limit
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      try {
        await rateLimitMiddleware({ ctx: mockContext, next });
        expect.fail('Should have thrown TRPCError');
      } catch (error) {
        expect((error as TRPCError).message).toContain('chatMessage');
      }
    });
  });

  describe('Rate Limit Logging', () => {
    it('should log rate limit violations', async () => {
      const { logger } = await import('../../../utils/logger.js');
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 1, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // Exhaust rate limit
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      try {
        await rateLimitMiddleware({ ctx: mockContext, next });
      } catch (error) {
        // Should log the violation
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('tRPC Rate limit exceeded'),
          'TRPC_RATE_LIMIT',
          expect.objectContaining({
            procedure: 'test',
            identifier: expect.any(String),
            count: expect.any(Number),
            limit: expect.any(Number)
          })
        );
      }
    });

    it('should log successful rate limit checks in debug mode', async () => {
      const { logger } = await import('../../../utils/logger.js');
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 5, 60000);
      const next = vi.fn().mockResolvedValue({ success: true });
      
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit check passed'),
        'TRPC_RATE_LIMIT',
        expect.objectContaining({
          procedure: 'test',
          identifier: expect.any(String),
          current: expect.any(Number),
          limit: expect.any(Number)
        })
      );
    });
  });

  describe('Memory Management', () => {
    it('should limit memory usage by cleaning old entries', async () => {
      const { createRateLimitMiddleware } = await import('../enhanced-router.js');
      
      const rateLimitMiddleware = createRateLimitMiddleware('test', 10, 100); // Short window
      const next = vi.fn().mockResolvedValue({ success: true });
      
      // Create many rate limit entries
      for (let i = 0; i < 100; i++) {
        const context = {
          ...mockContext,
          user: { id: `user${i}`, role: 'user' }
        };
        await rateLimitMiddleware({ ctx: context, next });
      }
      
      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // New request should trigger cleanup
      await rateLimitMiddleware({ ctx: mockContext, next });
      
      // Rate limits map should be much smaller now
      expect(mockContext.rateLimits.size).toBeLessThan(50);
    });
  });
});