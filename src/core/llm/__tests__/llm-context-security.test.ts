/**
 * Tests for LLM Context Security Improvements
 * Verifies proper client identification and input sanitization order
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider.js';
import { SecurityValidator } from '../../../config/llama-cpp-security.config.js';
import type { LlamaCppRequestContext } from '../LlamaCppHttpProvider.js';

// Mock the security modules
vi.mock('../../../config/llama-cpp-security.config.js', () => {
  const mockGenerateOptionsSchema = {
    parse: vi.fn((options) => options)
  };
  const mockSecurityAuditLogger = {
    log: vi.fn()
  };
  return {
  SecurityValidator: {
    sanitizeText: vi.fn((text, maxLength) => {
      if (text.length > maxLength) {
        return text.substring(0, maxLength);
      }
      return text.replace(/<[^>]*>/g, ''); // Simple HTML stripping
    }),
    checkRateLimit: vi.fn()
  },
  ResourceLimiter: {
    checkResources: vi.fn(() => Promise.resolve(true)),
    acquireResources: vi.fn(),
    releaseResources: vi.fn()
  },
  SecurityAuditLogger: mockSecurityAuditLogger,
  GenerateOptionsSchema: mockGenerateOptionsSchema,
  SECURITY_LIMITS: {
    MAX_PROMPT_LENGTH: 10000
  }
};
});

// Mock the llama-cpp service
vi.mock('../../../services/llama-cpp.service.js', () => ({
  llamaCppService: {
    startServer: vi.fn(),
    stopServer: vi.fn()
  }
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({ data: { status: 'ok' } })),
      post: vi.fn(() => Promise.resolve({
        data: {
          choices: [{
            message: { content: 'Test response' }
          }],
          usage: {
            completion_tokens: 10,
            total_tokens: 20
          }
        }
      }))
    }))
  }
}));

describe('LLM Context Security', () => {
  let provider: LlamaCppHttpProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new LlamaCppHttpProvider('http://localhost:8081');
  });

  describe('Client Identification', () => {
    it('should use userId for rate limiting when available', async () => {
      const context: LlamaCppRequestContext = {
        userId: 'user123',
        sessionId: 'session456',
        ip: '192.168.1.1'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      await provider.generate('Test prompt', { context });

      // Verify rate limit was called with user-specific ID
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('user:user123');
    });

    it('should fall back to sessionId when userId not available', async () => {
      const context: LlamaCppRequestContext = {
        sessionId: 'session456',
        ip: '192.168.1.1'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      await provider.generate('Test prompt', { context });

      // Verify rate limit was called with session-specific ID
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('session:session456');
    });

    it('should fall back to IP when neither userId nor sessionId available', async () => {
      const context: LlamaCppRequestContext = {
        ip: '192.168.1.1'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      await provider.generate('Test prompt', { context });

      // Verify rate limit was called with IP-specific ID
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('ip:192.168.1.1');
    });

    it('should use anonymous when no identification available', async () => {
      const context: LlamaCppRequestContext = {};

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      await provider.generate('Test prompt', { context });

      // Verify rate limit was called with anonymous ID
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('anonymous');
    });

    it('should normalize IPv6 localhost to IPv4', async () => {
      const context: LlamaCppRequestContext = {
        ip: '::1'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      await provider.generate('Test prompt', { context });

      // Verify rate limit was called with normalized IP
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('ip:127.0.0.1');
    });

    it('should handle IPv4-mapped IPv6 addresses', async () => {
      const context: LlamaCppRequestContext = {
        ip: '::ffff:192.168.1.1'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      await provider.generate('Test prompt', { context });

      // Verify rate limit was called with extracted IPv4
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('ip:192.168.1.1');
    });
  });

  describe('Input Sanitization Order', () => {
    it('should sanitize input BEFORE rate limiting check', async () => {
      const maliciousPrompt = '<script>alert("xss")</script>Test prompt';
      const context: LlamaCppRequestContext = {
        userId: 'user123'
      };

      let sanitizeCallOrder = 0;
      let rateLimitCallOrder = 0;
      let callCounter = 0;

      (SecurityValidator.sanitizeText as any).mockImplementation(() => {
        callCounter++;
        sanitizeCallOrder = callCounter;
        return 'Test prompt'; // Sanitized version
      });

      (SecurityValidator.checkRateLimit as any).mockImplementation(() => {
        callCounter++;
        rateLimitCallOrder = callCounter;
        return true;
      });

      await provider.initialize();
      await provider.generate(maliciousPrompt, { context });

      // Verify sanitization happened before rate limiting
      expect(sanitizeCallOrder).toBeLessThan(rateLimitCallOrder);
      expect(sanitizeCallOrder).toBe(1);
      expect(rateLimitCallOrder).toBe(2);
    });

    it('should validate options BEFORE rate limiting check', async () => {
      const context: LlamaCppRequestContext = {
        userId: 'user123'  
      };

      let sanitizeCallOrder = 0;
      let validateCallOrder = 0;
      let rateLimitCallOrder = 0;
      let callCounter = 0;

      // Track sanitization call order
      (SecurityValidator.sanitizeText as any).mockImplementation((text: string) => {
        callCounter++;
        sanitizeCallOrder = callCounter;
        return text;
      });

      // Access the mocked module
      const { GenerateOptionsSchema } = await import('../../../config/llama-cpp-security.config.js');
      
      (GenerateOptionsSchema.parse as any).mockImplementation((options: any) => {
        callCounter++;
        validateCallOrder = callCounter;
        return options;
      });

      (SecurityValidator.checkRateLimit as any).mockImplementation(() => {
        callCounter++;
        rateLimitCallOrder = callCounter;
        return true;
      });

      await provider.initialize();
      await provider.generate('Test prompt', { 
        temperature: 0.7,
        context 
      });

      // Verify order: sanitize -> validate -> rate limit
      expect(sanitizeCallOrder).toBe(1);
      expect(validateCallOrder).toBe(2);
      expect(rateLimitCallOrder).toBe(3);
      expect(sanitizeCallOrder).toBeLessThan(validateCallOrder);
      expect(validateCallOrder).toBeLessThan(rateLimitCallOrder);
    });

    it('should not call rate limit if input validation fails', async () => {
      const context: LlamaCppRequestContext = {
        userId: 'user123'
      };

      // Access the mocked module
      const { GenerateOptionsSchema } = await import('../../../config/llama-cpp-security.config.js');
      
      (GenerateOptionsSchema.parse as any).mockImplementation(() => {
        throw new Error('Invalid options');
      });

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      
      await expect(
        provider.generate('Test prompt', { 
          temperature: -1, // Invalid
          context 
        })
      ).rejects.toThrow('Invalid generation options');

      // Verify rate limit was NOT called due to early validation failure
      expect(SecurityValidator.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should handle rate limit rejection with proper context logging', async () => {
      const context: LlamaCppRequestContext = {
        userId: 'user123',
        sessionId: 'session456',
        ip: '192.168.1.1'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(false);

      // Access the mocked module
      const { SecurityAuditLogger } = await import('../../../config/llama-cpp-security.config.js');

      await provider.initialize();
      
      await expect(
        provider.generate('Test prompt', { context })
      ).rejects.toThrow('Rate limit exceeded');

      // Verify proper logging with all context details
      expect(SecurityAuditLogger.log).toHaveBeenCalledWith(
        'warn',
        'Rate limit exceeded',
        expect.objectContaining({
          clientId: 'user:user123',
          userId: 'user123',
          sessionId: 'session456',
          ip: '192.168.1.1'
        })
      );
    });
  });

  describe('Streaming with Context', () => {
    it('should apply rate limiting with context in streaming mode', async () => {
      const context: LlamaCppRequestContext = {
        userId: 'user123'
      };

      (SecurityValidator.checkRateLimit as any).mockReturnValue(true);

      await provider.initialize();
      
      const stream = provider.generateStream('Test prompt', { context });
      
      // Consume stream to trigger rate limit check
      const chunks: string[] = [];
      try {
        for await (const chunk of stream) {
          chunks.push(chunk);
          break; // Just test first chunk
        }
      } catch (error) {
        // Expected as we're mocking
      }

      // Verify rate limit was called with proper client ID
      expect(SecurityValidator.checkRateLimit).toHaveBeenCalledWith('user:user123');
    });

    it('should sanitize input before rate limiting in streaming mode', async () => {
      const maliciousPrompt = '<script>alert("xss")</script>Test prompt';
      const context: LlamaCppRequestContext = {
        userId: 'user123'
      };

      let sanitizeCallOrder = 0;
      let rateLimitCallOrder = 0;
      let callCounter = 0;

      (SecurityValidator.sanitizeText as any).mockImplementation(() => {
        callCounter++;
        sanitizeCallOrder = callCounter;
        return 'Test prompt';
      });

      (SecurityValidator.checkRateLimit as any).mockImplementation(() => {
        callCounter++;
        rateLimitCallOrder = callCounter;
        return true;
      });

      await provider.initialize();
      
      const stream = provider.generateStream(maliciousPrompt, { context });
      
      // Consume stream to trigger checks
      try {
        for await (const _chunk of stream) {
          break;
        }
      } catch (error) {
        // Expected as we're mocking
      }

      // Verify order
      expect(sanitizeCallOrder).toBeLessThan(rateLimitCallOrder);
    });
  });
});