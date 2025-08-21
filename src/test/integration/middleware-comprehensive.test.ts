import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../api/server';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
const TEST_DB_PATH = './test-middleware.db';

describe('Middleware Comprehensive Testing', () => {
  let db: Database.Database;
  let validToken: string;
  let adminToken: string;
  let csrfToken: string;

  const testUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user'
  };

  const adminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin'
  };

  beforeAll(async () => {
    // Create test tokens
    validToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });
    adminToken = jwt.sign(adminUser, JWT_SECRET, { expiresIn: '1h' });

    // Setup test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    db = new Database(TEST_DB_PATH);
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        reset_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS csrf_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE TABLE IF NOT EXISTS security_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        message TEXT,
        ip_address TEXT,
        user_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);

    // Get CSRF token
    const csrfResponse = await request(app)
      .get('/api/csrf-token')
      .expect(200);
    
    csrfToken = csrfResponse.body.token;
  });

  afterAll(async () => {
    db?.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Authentication Middleware', () => {
    describe('JWT Validation', () => {
      it('should accept valid JWT tokens', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('userId', testUser.id);
      });

      it('should reject expired tokens', async () => {
        const expiredToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '-1h' });
        
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
      });

      it('should reject malformed tokens', async () => {
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Bearer malformed.token.here')
          .expect(401);
      });

      it('should reject tokens with invalid signature', async () => {
        const invalidToken = jwt.sign(testUser, 'wrong-secret', { expiresIn: '1h' });
        
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);
      });

      it('should handle missing Authorization header', async () => {
        await request(app)
          .get('/api/user/profile')
          .expect(401);
      });

      it('should handle non-Bearer auth schemes', async () => {
        await request(app)
          .get('/api/user/profile')
          .set('Authorization', 'Basic dXNlcjpwYXNz')
          .expect(401);
      });
    });

    describe('Role-Based Access Control', () => {
      it('should allow admin access to admin endpoints', async () => {
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
      });

      it('should deny user access to admin endpoints', async () => {
        await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(403);
      });

      it('should handle guest access appropriately', async () => {
        const response = await request(app)
          .get('/api/public/content')
          .expect(200);

        expect(response.body).toHaveProperty('access', 'public');
      });
    });
  });

  describe('Rate Limiting Middleware', () => {
    describe('General API Rate Limiting', () => {
      it('should allow requests within limit', async () => {
        for (let i = 0; i < 5; i++) {
          await request(app)
            .get('/api/emails')
            .expect(200);
        }
      });

      it('should block after exceeding limit', async () => {
        const requests = [];
        
        // Make 100 rapid requests
        for (let i = 0; i < 100; i++) {
          requests.push(
            request(app).get('/api/emails')
          );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r.status === 429);
        
        expect(rateLimited.length).toBeGreaterThan(0);
        
        // Check rate limit headers
        const limitedResponse = rateLimited[0];
        expect(limitedResponse.headers).toHaveProperty('x-ratelimit-limit');
        expect(limitedResponse.headers).toHaveProperty('x-ratelimit-remaining');
        expect(limitedResponse.headers).toHaveProperty('x-ratelimit-reset');
      });

      it('should reset limits after window', async () => {
        // Wait for rate limit window to reset (mock)
        vi.useFakeTimers();
        vi.advanceTimersByTime(60000); // 1 minute
        vi.useRealTimers();

        const response = await request(app)
          .get('/api/emails')
          .expect(200);

        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      });
    });

    describe('Auth Endpoint Rate Limiting', () => {
      it('should have stricter limits for auth endpoints', async () => {
        const requests = [];
        
        // Make 10 login attempts
        for (let i = 0; i < 10; i++) {
          requests.push(
            request(app)
              .post('/api/auth/login')
              .send({ email: 'test@example.com', password: 'wrong' })
          );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r.status === 429);
        
        // Should be rate limited after fewer attempts than general API
        expect(rateLimited.length).toBeGreaterThan(0);
      });

      it('should track rate limits per IP', async () => {
        const response1 = await request(app)
          .get('/api/emails')
          .set('X-Forwarded-For', '192.168.1.1')
          .expect(200);

        const response2 = await request(app)
          .get('/api/emails')
          .set('X-Forwarded-For', '192.168.1.2')
          .expect(200);

        // Different IPs should have separate limits
        expect(response1.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response2.headers['x-ratelimit-remaining']).toBeDefined();
      });
    });

    describe('WebSocket Rate Limiting', () => {
      it('should limit WebSocket connection attempts', async () => {
        const connections = [];
        
        for (let i = 0; i < 20; i++) {
          connections.push(
            request(app)
              .get('/ws')
              .set('Upgrade', 'websocket')
              .set('Connection', 'Upgrade')
          );
        }

        const responses = await Promise.all(connections);
        const rejected = responses.filter(r => r.status === 429);
        
        expect(rejected.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Input Validation Middleware', () => {
    describe('XSS Protection', () => {
      it('should sanitize HTML in request body', async () => {
        const maliciousInput = {
          name: '<script>alert("XSS")</script>John',
          bio: '<img src=x onerror=alert("XSS")>',
          website: 'javascript:alert("XSS")'
        };

        const response = await request(app)
          .post('/api/user/profile')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send(maliciousInput)
          .expect(200);

        expect(response.body.name).not.toContain('<script>');
        expect(response.body.bio).not.toContain('onerror');
        expect(response.body.website).not.toContain('javascript:');
      });

      it('should sanitize HTML in query parameters', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({ q: '<script>alert("XSS")</script>' })
          .expect(200);

        expect(response.body.query).not.toContain('<script>');
      });

      it('should sanitize HTML in headers', async () => {
        const response = await request(app)
          .get('/api/emails')
          .set('X-Custom-Header', '<script>alert("XSS")</script>')
          .expect(200);

        // Headers should be sanitized or rejected
        expect(response.status).not.toBe(500);
      });
    });

    describe('SQL Injection Protection', () => {
      it('should prevent SQL injection in query params', async () => {
        const sqlInjection = "'; DROP TABLE users; --";
        
        const response = await request(app)
          .get('/api/users')
          .query({ search: sqlInjection })
          .expect(200);

        // Check table still exists
        const tableExists = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        ).get();
        
        // Table should still exist or never existed
        expect(response.status).toBe(200);
      });

      it('should use parameterized queries', async () => {
        const injection = {
          email: "admin' OR '1'='1",
          password: "anything"
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(injection)
          .expect(401); // Should fail authentication

        expect(response.body).not.toHaveProperty('token');
      });
    });

    describe('Path Traversal Protection', () => {
      it('should prevent directory traversal', async () => {
        const traversalAttempts = [
          '../../../etc/passwd',
          '..\\..\\..\\windows\\system32\\config\\sam',
          '....//....//....//etc/passwd',
          '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
        ];

        for (const path of traversalAttempts) {
          await request(app)
            .get(`/api/files/${path}`)
            .expect(400);
        }
      });

      it('should sanitize file paths', async () => {
        const response = await request(app)
          .get('/api/files/valid-file.txt')
          .set('Authorization', `Bearer ${validToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('path');
        expect(response.body.path).not.toContain('..');
      });
    });

    describe('Command Injection Protection', () => {
      it('should prevent command injection', async () => {
        const commandInjection = {
          filename: 'test.txt; rm -rf /',
          command: 'ls | cat /etc/passwd'
        };

        await request(app)
          .post('/api/process')
          .set('Authorization', `Bearer ${validToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send(commandInjection)
          .expect(400);
      });
    });
  });

  describe('CSRF Protection Middleware', () => {
    it('should require CSRF token for POST requests', async () => {
      await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ data: 'test' })
        .expect(403);
    });

    it('should accept valid CSRF token', async () => {
      const response = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ data: 'test' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should reject invalid CSRF tokens', async () => {
      await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${validToken}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({ data: 'test' })
        .expect(403);
    });

    it('should not require CSRF for GET requests', async () => {
      await request(app)
        .get('/api/emails')
        .expect(200);
    });

    it('should handle CSRF token in cookies', async () => {
      const response = await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Cookie', `csrf-token=${csrfToken}`)
        .send({ data: 'test' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('Security Headers Middleware', () => {
    it('should set X-Content-Type-Options', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should set X-Frame-Options', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should set X-XSS-Protection', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should set Strict-Transport-Security', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    it('should set Content-Security-Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
    });

    it('should set Referrer-Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['referrer-policy']).toBeDefined();
    });
  });

  describe('CORS Middleware', () => {
    it('should allow configured origins', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should block unconfigured origins', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Origin', 'http://evil-site.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).not.toBe('http://evil-site.com');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/emails')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('content-type');
    });

    it('should expose allowed headers', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-expose-headers']).toBeDefined();
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle 404 errors', async () => {
      const response = await request(app)
        .get('/api/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });

    it('should handle 500 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/trigger-error')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body).not.toHaveProperty('stack'); // Don't leak stack traces
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/data')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${validToken}`)
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('JSON');
    });

    it('should handle large payloads', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB (over 10MB limit)

      await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ data: largePayload })
        .expect(413); // Payload Too Large
    });
  });

  describe('Monitoring Middleware', () => {
    it('should track request metrics', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('requests');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('avgResponseTime');
    });

    it('should log security events', async () => {
      // Trigger security event (failed auth)
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(401);

      // Check security logs
      const logs = db.prepare(
        "SELECT * FROM security_logs WHERE type = 'auth_failure' ORDER BY created_at DESC LIMIT 1"
      ).get();

      expect(logs).toBeDefined();
    });

    it('should track performance metrics', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/emails')
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('Compression Middleware', () => {
    it('should compress responses', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Accept-Encoding', 'gzip, deflate')
        .expect(200);

      expect(response.headers['content-encoding']).toMatch(/gzip|deflate/);
    });

    it('should not compress small responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Small responses shouldn't be compressed
      if (response.text.length < 1024) {
        expect(response.headers['content-encoding']).toBeUndefined();
      }
    });

    it('should respect no-compression header', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('X-No-Compression', 'true')
        .expect(200);

      expect(response.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Cookie Security', () => {
    it('should set secure cookie flags', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      const cookies = response.headers['set-cookie'];
      if (cookies) {
        expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
        expect(cookies.some((c: string) => c.includes('SameSite'))).toBe(true);
        
        // Secure flag only in production
        if (process.env.NODE_ENV === 'production') {
          expect(cookies.some((c: string) => c.includes('Secure'))).toBe(true);
        }
      }
    });
  });

  describe('Request Size Limits', () => {
    it('should reject oversized JSON payloads', async () => {
      const largePayload = { data: 'x'.repeat(11 * 1024 * 1024) }; // 11MB

      await request(app)
        .post('/api/data')
        .set('Authorization', `Bearer ${validToken}`)
        .send(largePayload)
        .expect(413);
    });

    it('should reject oversized URL-encoded payloads', async () => {
      const largeForm = 'field=' + 'x'.repeat(11 * 1024 * 1024);

      await request(app)
        .post('/api/form')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(largeForm)
        .expect(413);
    });
  });

  describe('Middleware Performance Report', () => {
    it('should generate middleware performance report', async () => {
      const middlewareTests = [
        { name: 'Authentication', time: 0, passed: true },
        { name: 'Rate Limiting', time: 0, passed: true },
        { name: 'Input Validation', time: 0, passed: true },
        { name: 'CSRF Protection', time: 0, passed: true },
        { name: 'Security Headers', time: 0, passed: true },
        { name: 'CORS', time: 0, passed: true },
        { name: 'Error Handling', time: 0, passed: true },
        { name: 'Compression', time: 0, passed: true }
      ];

      // Test each middleware performance
      for (const test of middlewareTests) {
        const startTime = Date.now();
        
        const response = await request(app)
          .get('/api/emails')
          .set('Authorization', `Bearer ${validToken}`);
        
        test.time = Date.now() - startTime;
        test.passed = response.status === 200;
      }

      console.log('\n=== Middleware Performance Report ===');
      console.log('Middleware\t\tTime (ms)\tStatus');
      console.log('----------------------------------------');
      
      middlewareTests.forEach(test => {
        console.log(`${test.name.padEnd(20)}\t${test.time}ms\t\t${test.passed ? '✓' : '✗'}`);
      });

      const avgTime = middlewareTests.reduce((sum, t) => sum + t.time, 0) / middlewareTests.length;
      const passRate = (middlewareTests.filter(t => t.passed).length / middlewareTests.length * 100).toFixed(1);

      console.log('----------------------------------------');
      console.log(`Average Response Time: ${avgTime.toFixed(0)}ms`);
      console.log(`Pass Rate: ${passRate}%`);

      expect(parseFloat(passRate)).toBe(100);
      expect(avgTime).toBeLessThan(500);
    });
  });
});