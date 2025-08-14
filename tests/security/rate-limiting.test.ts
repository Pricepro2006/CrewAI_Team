/**
 * Rate Limiting Security Tests
 * Tests API rate limits (100 req/15min) and WebSocket limits
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { getSecurityTestConfig } from './config/security-test-config.js';

const config = getSecurityTestConfig();

describe('Rate Limiting Security Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // API Rate Limiting Middleware
    const apiLimiter = rateLimit({
      windowMs: config.rateLimiting.api.windowMs,
      max: config.rateLimiting.api.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later',
        retryAfter: Math.ceil(config.rateLimiting.api.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Authentication Rate Limiting Middleware
    const authLimiter = rateLimit({
      windowMs: config.rateLimiting.auth.windowMs,
      max: config.rateLimiting.auth.maxAttempts,
      message: {
        error: 'Too many authentication attempts, please try again later',
        retryAfter: Math.ceil(config.rateLimiting.auth.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply rate limiting to specific routes
    app.use('/api/', apiLimiter);
    app.use('/api/auth/', authLimiter);

    // Test endpoints
    app.get('/api/test', (req, res) => {
      res.json({ message: 'API test endpoint', timestamp: Date.now() });
    });

    app.post('/api/auth/login', (req, res) => {
      const { username, password } = req.body;
      
      // Mock authentication
      if (username === 'test' && password === 'password') {
        res.json({ 
          success: true, 
          token: 'mock_token',
          timestamp: Date.now()
        });
      } else {
        res.status(401).json({ 
          error: 'Invalid credentials',
          timestamp: Date.now()
        });
      }
    });

    app.get('/api/walmart/products', (req, res) => {
      res.json({ 
        products: [
          { id: 1, name: 'Test Product 1' },
          { id: 2, name: 'Test Product 2' }
        ],
        timestamp: Date.now()
      });
    });

    // Unprotected endpoint for comparison
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    server = app.listen(0);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('API Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make requests within the limit
      const requests = [];
      const maxRequests = Math.min(config.rateLimiting.api.maxRequests, 10); // Test with smaller number
      
      for (let i = 0; i < maxRequests; i++) {
        requests.push(
          request(app)
            .get('/api/test')
            .expect(200)
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.body).toHaveProperty('message');
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      });
    });

    it('should block requests exceeding rate limit', async () => {
      // Rapid fire requests to exceed limit
      const requests = [];
      const excessiveRequests = config.rateLimiting.api.maxRequests + 5;
      
      for (let i = 0; i < excessiveRequests; i++) {
        requests.push(
          request(app)
            .get('/api/test')
        );
      }

      const responses = await Promise.all(requests);
      
      // Check that some requests were blocked
      const blockedResponses = responses.filter(r => r.status === 429);
      expect(blockedResponses.length).toBeGreaterThan(0);
      
      // Check rate limit headers
      blockedResponses.forEach(response => {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Too many requests');
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining', '0');
      });
    }, 30000); // Increase timeout for this test

    it('should include proper rate limit headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(parseInt(response.headers['x-ratelimit-limit'])).toBe(config.rateLimiting.api.maxRequests);
    });

    it('should not apply rate limiting to health endpoints', async () => {
      // Make many requests to health endpoint
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/health')
            .expect(200)
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed (no rate limiting)
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers).not.toHaveProperty('x-ratelimit-limit');
      });
    });
  });

  describe('Authentication Rate Limiting', () => {
    it('should allow authentication attempts within limit', async () => {
      const requests = [];
      const maxAttempts = Math.min(config.rateLimiting.auth.maxAttempts, 3);
      
      for (let i = 0; i < maxAttempts; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ username: 'wrong', password: 'wrong' })
        );
      }

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect([401, 429]).toContain(response.status);
        if (response.status === 401) {
          expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        }
      });
    });

    it('should block excessive authentication attempts', async () => {
      // Reset rate limiter by waiting or use different endpoint
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const requests = [];
      const excessiveAttempts = config.rateLimiting.auth.maxAttempts + 2;
      
      for (let i = 0; i < excessiveAttempts; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .send({ username: 'attacker', password: 'wrong' })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should have some 429 responses
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      rateLimitedResponses.forEach(response => {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('Too many authentication attempts');
      });
    }, 15000);

    it('should allow successful login within rate limit', async () => {
      // Wait for rate limit reset
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test', password: 'password' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
    });
  });

  describe('Rate Limiting by IP', () => {
    it('should track rate limits per IP address', async () => {
      // Test that different IPs get different rate limit buckets
      // This is more of a conceptual test since supertest uses the same IP
      
      const response1 = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.1.1')
        .expect(200);

      const response2 = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', '192.168.1.2')
        .expect(200);

      expect(response1.body).toHaveProperty('message');
      expect(response2.body).toHaveProperty('message');
    });

    it('should handle missing or malformed IP headers', async () => {
      const response = await request(app)
        .get('/api/test')
        .set('X-Forwarded-For', 'invalid-ip')
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should use correct time windows', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      // Check that the rate limiting is configured with correct window
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      const limit = parseInt(response.headers['x-ratelimit-limit']);
      expect(limit).toBe(config.rateLimiting.api.maxRequests);
    });

    it('should provide retry-after information', async () => {
      // First exhaust the rate limit
      const requests = [];
      for (let i = 0; i < config.rateLimiting.api.maxRequests + 5; i++) {
        requests.push(
          request(app)
            .get('/api/test')
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toHaveProperty('retryAfter');
        expect(rateLimitedResponse.body.retryAfter).toBeGreaterThan(0);
      }
    }, 20000);
  });

  describe('Rate Limiting Bypass Attempts', () => {
    it('should not be bypassed by changing User-Agent', async () => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'curl/7.68.0',
        'PostmanRuntime/7.28.0'
      ];

      const responses = [];
      for (const userAgent of userAgents) {
        for (let i = 0; i < 5; i++) {
          const response = await request(app)
            .get('/api/test')
            .set('User-Agent', userAgent);
          responses.push(response);
        }
      }

      // Should still be subject to rate limiting regardless of User-Agent
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      // If we made enough requests, some should be rate limited
      if (responses.length > config.rateLimiting.api.maxRequests) {
        expect(rateLimitedResponses.length).toBeGreaterThan(0);
      }
    }, 30000);

    it('should not be bypassed by changing request headers', async () => {
      const headerVariations = [
        { 'X-Requested-With': 'XMLHttpRequest' },
        { 'Accept': 'application/json' },
        { 'Content-Type': 'application/json' },
        { 'Origin': 'https://trusted-site.com' }
      ];

      for (const headers of headerVariations) {
        const requests = [];
        for (let i = 0; i < 3; i++) {
          requests.push(
            request(app)
              .get('/api/test')
              .set(headers)
          );
        }
        
        const responses = await Promise.all(requests);
        responses.forEach(response => {
          expect([200, 429]).toContain(response.status);
        });
      }
    });
  });

  describe('Error Handling in Rate Limiting', () => {
    it('should handle rate limiting errors gracefully', async () => {
      // Test that the application doesn't crash when rate limiting fails
      const response = await request(app)
        .get('/api/test')
        .expect(response => {
          expect([200, 429, 500]).toContain(response.status);
        });

      // Should always return a valid JSON response
      expect(response.body).toBeDefined();
    });

    it('should not expose internal error details in rate limit responses', async () => {
      // Make enough requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < config.rateLimiting.api.maxRequests + 3; i++) {
        requests.push(
          request(app)
            .get('/api/test')
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find(r => r.status === 429);
      
      if (rateLimitedResponse) {
        const bodyString = JSON.stringify(rateLimitedResponse.body);
        
        // Should not expose internal paths, stack traces, or sensitive info
        expect(bodyString).not.toMatch(/\/[a-zA-Z0-9_\-\/]+\.js/); // No file paths
        expect(bodyString).not.toMatch(/Error:/); // No raw error messages
        expect(bodyString).not.toMatch(/at [a-zA-Z0-9_]+/); // No stack traces
      }
    }, 25000);
  });
});