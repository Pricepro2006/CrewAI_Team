import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app, server } from '../../api/server';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Test configuration
const TEST_PORT = 3002;
const WS_PORT = 8081;
const TEST_DB_PATH = './test-db.sqlite';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Test data
const testUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  role: 'admin'
};

const testToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '1h' });

describe('API Endpoints Comprehensive Testing', () => {
  let db: Database.Database;
  let wsServer: WebSocketServer;
  let wsClient: WebSocket;

  beforeAll(async () => {
    // Setup test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    db = new Database(TEST_DB_PATH);
    
    // Create required tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        body TEXT,
        sender TEXT,
        recipients TEXT,
        date TEXT,
        phase_1_results TEXT,
        phase_2_results TEXT,
        phase_3_results TEXT,
        chain_id TEXT,
        is_complete_chain BOOLEAN,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER,
        reset_at INTEGER
      );
    `);

    // Insert test data
    db.prepare(`
      INSERT INTO emails (id, subject, body, sender, recipients, date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'test-email-1',
      'Test Email Subject',
      'Test email body content',
      'sender@example.com',
      JSON.stringify(['recipient@example.com']),
      new Date().toISOString()
    );

    // Setup WebSocket server
    wsServer = new WebSocketServer({ port: WS_PORT });
  });

  afterAll(async () => {
    // Cleanup
    db?.close();
    wsServer?.close();
    wsClient?.close();
    
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Close the main server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('Core Endpoints', () => {
    describe('GET /health', () => {
      it('should return server health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('responseTime');
        expect(response.body).toHaveProperty('services');
        expect(response.body.services).toHaveProperty('api', 'running');
        expect(response.body.services).toHaveProperty('database');
        expect(response.body.services).toHaveProperty('ollama');
        expect(response.body.services).toHaveProperty('chromadb');
      });

      it('should handle service failures gracefully', async () => {
        // Mock service failures
        const originalEnv = process.env.CHROMA_BASE_URL;
        process.env.CHROMA_BASE_URL = 'http://invalid-host:9999';

        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body.status).toMatch(/degraded|healthy/);
        
        // Restore env
        process.env.CHROMA_BASE_URL = originalEnv;
      });
    });

    describe('GET /api/rate-limit-status', () => {
      it('should require admin authentication', async () => {
        await request(app)
          .get('/api/rate-limit-status')
          .expect(403);
      });

      it('should return rate limit status for admin', async () => {
        const response = await request(app)
          .get('/api/rate-limit-status')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('requests');
        expect(response.body).toHaveProperty('remaining');
        expect(response.body).toHaveProperty('reset');
      });
    });
  });

  describe('Email Endpoints', () => {
    describe('GET /api/emails', () => {
      it('should return list of emails', async () => {
        const response = await request(app)
          .get('/api/emails')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        if (response.body.length > 0) {
          expect(response.body[0]).toHaveProperty('id');
          expect(response.body[0]).toHaveProperty('subject');
        }
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/emails?limit=10&offset=0')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeLessThanOrEqual(10);
      });
    });

    describe('GET /api/email-stats', () => {
      it('should return email statistics', async () => {
        const response = await request(app)
          .get('/api/email-stats')
          .expect(200);

        expect(response.body).toHaveProperty('total');
        expect(response.body).toHaveProperty('analyzed');
        expect(response.body).toHaveProperty('pending');
        expect(response.body).toHaveProperty('failed');
      });
    });

    describe('GET /api/analyzed-emails', () => {
      it('should return analyzed emails', async () => {
        const response = await request(app)
          .get('/api/analyzed-emails')
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/process-email', () => {
      it('should process email with valid data', async () => {
        const emailData = {
          id: 'test-email-' + Date.now(),
          subject: 'Test Email for Processing',
          body: 'This is a test email body',
          sender: 'test@example.com',
          recipients: ['recipient@example.com'],
          date: new Date().toISOString()
        };

        const response = await request(app)
          .post('/api/process-email')
          .set('Authorization', `Bearer ${testToken}`)
          .send(emailData)
          .expect(200);

        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('emailId');
      });

      it('should reject invalid email data', async () => {
        const invalidEmail = {
          // Missing required fields
          subject: 'Incomplete Email'
        };

        await request(app)
          .post('/api/process-email')
          .set('Authorization', `Bearer ${testToken}`)
          .send(invalidEmail)
          .expect(400);
      });
    });
  });

  describe('WebSocket Endpoints', () => {
    describe('WebSocket /ws', () => {
      it('should establish WebSocket connection', (done) => {
        wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);

        wsClient.on('open', () => {
          expect(wsClient.readyState).toBe(WebSocket.OPEN);
          done();
        });

        wsClient.on('error', (error) => {
          done(error);
        });
      });

      it('should receive welcome message', (done) => {
        wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('welcome');
          expect(message).toHaveProperty('connectionId');
          expect(message).toHaveProperty('serverTime');
          done();
        });
      });

      it('should handle subscription requests', (done) => {
        wsClient = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);

        wsClient.on('open', () => {
          wsClient.send(JSON.stringify({
            type: 'subscribe',
            topics: ['email.update', 'system.health']
          }));
        });

        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'subscription_confirmed') {
            expect(message.topics).toEqual(['email.update', 'system.health']);
            done();
          }
        });
      });
    });
  });

  describe('Middleware Testing', () => {
    describe('Authentication Middleware', () => {
      it('should allow public endpoints without auth', async () => {
        await request(app)
          .get('/health')
          .expect(200);
      });

      it('should validate JWT tokens', async () => {
        const response = await request(app)
          .get('/api/rate-limit-status')
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(response.body).toBeDefined();
      });

      it('should reject invalid tokens', async () => {
        await request(app)
          .get('/api/rate-limit-status')
          .set('Authorization', 'Bearer invalid-token')
          .expect(403);
      });

      it('should reject expired tokens', async () => {
        const expiredToken = jwt.sign(testUser, JWT_SECRET, { expiresIn: '-1h' });
        
        await request(app)
          .get('/api/rate-limit-status')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(403);
      });
    });

    describe('Rate Limiting', () => {
      it('should enforce rate limits on API endpoints', async () => {
        const requests = [];
        
        // Make 100 rapid requests
        for (let i = 0; i < 100; i++) {
          requests.push(
            request(app).get('/api/emails')
          );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.status === 429);
        
        expect(rateLimited).toBe(true);
      });

      it('should have stricter limits for auth endpoints', async () => {
        const requests = [];
        
        // Make 10 rapid auth requests
        for (let i = 0; i < 10; i++) {
          requests.push(
            request(app).post('/api/auth/login').send({
              email: 'test@example.com',
              password: 'password'
            })
          );
        }

        const responses = await Promise.all(requests);
        const rateLimited = responses.some(r => r.status === 429);
        
        expect(rateLimited).toBe(true);
      });
    });

    describe('Input Validation', () => {
      it('should sanitize HTML in input', async () => {
        const maliciousData = {
          id: 'test-email-xss',
          subject: '<script>alert("XSS")</script>Test',
          body: '<img src=x onerror=alert("XSS")>',
          sender: 'test@example.com',
          recipients: ['test@example.com'],
          date: new Date().toISOString()
        };

        const response = await request(app)
          .post('/api/process-email')
          .set('Authorization', `Bearer ${testToken}`)
          .send(maliciousData)
          .expect(200);

        // Check that malicious content was sanitized
        expect(response.body.subject).not.toContain('<script>');
        expect(response.body.body).not.toContain('onerror');
      });

      it('should prevent SQL injection', async () => {
        const sqlInjection = {
          search: "'; DROP TABLE emails; --"
        };

        const response = await request(app)
          .get('/api/emails')
          .query(sqlInjection)
          .expect(200);

        // Verify table still exists
        const tableExists = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='emails'"
        ).get();
        
        expect(tableExists).toBeDefined();
      });

      it('should validate email format', async () => {
        const invalidEmail = {
          email: 'not-an-email',
          password: 'password123'
        };

        await request(app)
          .post('/api/auth/register')
          .send(invalidEmail)
          .expect(400);
      });
    });

    describe('CORS Headers', () => {
      it('should include proper CORS headers', async () => {
        const response = await request(app)
          .get('/health')
          .set('Origin', 'http://localhost:3000')
          .expect(200);

        expect(response.headers['access-control-allow-origin']).toBeDefined();
        expect(response.headers['access-control-allow-credentials']).toBe('true');
      });

      it('should reject requests from unauthorized origins', async () => {
        const response = await request(app)
          .get('/api/emails')
          .set('Origin', 'http://malicious-site.com')
          .expect(200); // CORS doesn't block server-side, browser enforces

        // Check that CORS headers are not set for unauthorized origin
        expect(response.headers['access-control-allow-origin']).not.toBe('http://malicious-site.com');
      });
    });

    describe('Security Headers', () => {
      it('should include security headers', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-xss-protection']).toBe('1; mode=block');
        expect(response.headers['strict-transport-security']).toBeDefined();
      });
    });

    describe('CSRF Protection', () => {
      it('should require CSRF token for state-changing operations', async () => {
        await request(app)
          .post('/api/process-email')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ test: 'data' })
          .expect(403); // Without CSRF token
      });

      it('should accept valid CSRF token', async () => {
        // Get CSRF token
        const tokenResponse = await request(app)
          .get('/api/csrf-token')
          .expect(200);

        const csrfToken = tokenResponse.body.token;

        // Use CSRF token in request
        await request(app)
          .post('/api/process-email')
          .set('Authorization', `Bearer ${testToken}`)
          .set('X-CSRF-Token', csrfToken)
          .send({
            id: 'test-email-csrf',
            subject: 'Test',
            body: 'Test',
            sender: 'test@example.com',
            recipients: ['test@example.com'],
            date: new Date().toISOString()
          })
          .expect(200);
      });
    });

    describe('Error Handling', () => {
      it('should handle 404 errors gracefully', async () => {
        const response = await request(app)
          .get('/non-existent-endpoint')
          .expect(404);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('not found');
      });

      it('should handle database connection errors', async () => {
        // Temporarily close database
        db.close();

        const response = await request(app)
          .get('/api/emails')
          .expect(500);

        expect(response.body).toHaveProperty('error');
        
        // Reopen database
        db = new Database(TEST_DB_PATH);
      });

      it('should handle malformed JSON', async () => {
        await request(app)
          .post('/api/process-email')
          .set('Content-Type', 'application/json')
          .set('Authorization', `Bearer ${testToken}`)
          .send('{ invalid json }')
          .expect(400);
      });
    });
  });

  describe('Performance Testing', () => {
    it('should handle concurrent requests', async () => {
      const startTime = Date.now();
      const requests = [];

      // Send 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        requests.push(
          request(app).get('/health')
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed
      responses.forEach(r => {
        expect(r.status).toBe(200);
      });

      // Should complete within reasonable time (5 seconds for 50 requests)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle large payloads', async () => {
      const largeBody = 'x'.repeat(1024 * 1024); // 1MB payload

      const response = await request(app)
        .post('/api/process-email')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          id: 'large-email',
          subject: 'Large Email',
          body: largeBody,
          sender: 'test@example.com',
          recipients: ['test@example.com'],
          date: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should compress responses', async () => {
      const response = await request(app)
        .get('/api/emails')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      expect(response.headers['content-encoding']).toContain('gzip');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle authentication flow', async () => {
      // 1. Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User'
        });

      if (registerResponse.status === 200) {
        expect(registerResponse.body).toHaveProperty('token');
        
        const token = registerResponse.body.token;

        // 2. Use token to access protected endpoint
        const protectedResponse = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(protectedResponse.body).toHaveProperty('email', 'newuser@example.com');
      }
    });

    it('should handle email processing pipeline', async () => {
      const emailId = 'pipeline-test-' + Date.now();

      // 1. Submit email for processing
      const submitResponse = await request(app)
        .post('/api/process-email')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          id: emailId,
          subject: 'Important Business Email',
          body: 'This email contains important business information.',
          sender: 'ceo@company.com',
          recipients: ['team@company.com'],
          date: new Date().toISOString()
        })
        .expect(200);

      expect(submitResponse.body.success).toBe(true);

      // 2. Check processing status
      const statusResponse = await request(app)
        .get(`/api/email-status/${emailId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('status');
      expect(['processing', 'completed', 'failed']).toContain(statusResponse.body.status);

      // 3. Retrieve analysis results
      if (statusResponse.body.status === 'completed') {
        const resultsResponse = await request(app)
          .get(`/api/email-analysis/${emailId}`)
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200);

        expect(resultsResponse.body).toHaveProperty('analysis');
      }
    });

    it('should handle WebSocket real-time updates', (done) => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`);
      const messages: any[] = [];

      ws.on('open', () => {
        // Subscribe to email updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          topics: ['email.processing']
        }));

        // Trigger email processing
        request(app)
          .post('/api/process-email')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            id: 'ws-test-' + Date.now(),
            subject: 'WebSocket Test Email',
            body: 'Testing real-time updates',
            sender: 'test@example.com',
            recipients: ['test@example.com'],
            date: new Date().toISOString()
          })
          .end();
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messages.push(message);

        // Look for processing updates
        if (message.type === 'email.processing') {
          expect(message).toHaveProperty('emailId');
          expect(message).toHaveProperty('status');
          ws.close();
          done();
        }

        // Timeout after 5 seconds
        setTimeout(() => {
          ws.close();
          done();
        }, 5000);
      });
    });

    it('should handle database connection recovery', async () => {
      // Simulate database disconnection
      db.close();

      // First request should fail
      await request(app)
        .get('/api/emails')
        .expect(500);

      // Reopen database
      db = new Database(TEST_DB_PATH);

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should recover
      const response = await request(app)
        .get('/api/emails')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Endpoint Coverage Report', () => {
    it('should generate coverage report', async () => {
      const endpoints = [
        { method: 'GET', path: '/health', tested: true },
        { method: 'GET', path: '/api/emails', tested: true },
        { method: 'GET', path: '/api/email-stats', tested: true },
        { method: 'GET', path: '/api/analyzed-emails', tested: true },
        { method: 'POST', path: '/api/process-email', tested: true },
        { method: 'GET', path: '/api/rate-limit-status', tested: true },
        { method: 'GET', path: '/api/csrf-token', tested: true },
        { method: 'POST', path: '/api/auth/login', tested: true },
        { method: 'POST', path: '/api/auth/register', tested: true },
        { method: 'WS', path: '/ws', tested: true },
        { method: 'WS', path: '/trpc-ws', tested: false },
        { method: 'WS', path: '/ws/walmart', tested: false },
        { method: 'GET', path: '/api/monitoring/*', tested: false },
        { method: 'GET', path: '/api/circuit-breaker/*', tested: false },
        { method: 'GET', path: '/api/health/*', tested: false },
        { method: 'GET', path: '/api/database/*', tested: false },
        { method: 'POST', path: '/api/webhooks/*', tested: false },
        { method: 'GET', path: '/api/nlp/*', tested: false }
      ];

      const testedCount = endpoints.filter(e => e.tested).length;
      const totalCount = endpoints.length;
      const coverage = (testedCount / totalCount * 100).toFixed(1);

      console.log('\n=== API Endpoint Test Coverage ===');
      console.log(`Total Endpoints: ${totalCount}`);
      console.log(`Tested: ${testedCount}`);
      console.log(`Untested: ${totalCount - testedCount}`);
      console.log(`Coverage: ${coverage}%`);
      console.log('\nUntested Endpoints:');
      endpoints.filter(e => !e.tested).forEach(e => {
        console.log(`  - ${e.method} ${e.path}`);
      });

      expect(parseFloat(coverage)).toBeGreaterThan(50);
    });
  });

  describe('Security Vulnerability Testing', () => {
    it('should detect path traversal attempts', async () => {
      const maliciousPath = '../../../etc/passwd';
      
      await request(app)
        .get(`/api/files/${maliciousPath}`)
        .expect(400);
    });

    it('should prevent XXE attacks', async () => {
      const xxePayload = `<?xml version="1.0"?>
        <!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
        <data>&xxe;</data>`;

      await request(app)
        .post('/api/xml-endpoint')
        .set('Content-Type', 'application/xml')
        .send(xxePayload)
        .expect(400);
    });

    it('should enforce Content Security Policy', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Load Testing Results', () => {
    it('should handle sustained load', async () => {
      const results = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity
      };

      const responseTimes: number[] = [];
      const concurrency = 10;
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const batch = [];
        
        for (let j = 0; j < concurrency; j++) {
          const startTime = Date.now();
          
          batch.push(
            request(app)
              .get('/health')
              .then(res => {
                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);
                
                results.totalRequests++;
                if (res.status === 200) {
                  results.successfulRequests++;
                } else {
                  results.failedRequests++;
                }
                
                results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
                results.minResponseTime = Math.min(results.minResponseTime, responseTime);
              })
              .catch(() => {
                results.failedRequests++;
                results.totalRequests++;
              })
          );
        }

        await Promise.all(batch);
      }

      results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;

      console.log('\n=== Load Testing Results ===');
      console.log(`Total Requests: ${results.totalRequests}`);
      console.log(`Successful: ${results.successfulRequests}`);
      console.log(`Failed: ${results.failedRequests}`);
      console.log(`Success Rate: ${(results.successfulRequests / results.totalRequests * 100).toFixed(1)}%`);
      console.log(`Avg Response Time: ${results.avgResponseTime.toFixed(0)}ms`);
      console.log(`Min Response Time: ${results.minResponseTime}ms`);
      console.log(`Max Response Time: ${results.maxResponseTime}ms`);

      expect(results.successfulRequests / results.totalRequests).toBeGreaterThan(0.95);
      expect(results.avgResponseTime).toBeLessThan(500);
    });
  });
});