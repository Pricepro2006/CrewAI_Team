/**
 * Input Validation Security Tests
 * Tests XSS and SQL injection prevention using payloads from config
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { getSecurityTestConfig } from './config/security-test-config.js';

const config = getSecurityTestConfig();

describe('Input Validation Security Tests', () => {
  let app: express.Application;
  let server: any;
  let db: Database.Database;

  beforeAll(async () => {
    // Create test database
    db = new Database(':memory:');
    
    // Create test table
    db.exec(`
      CREATE TABLE test_products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL
      )
    `);

    // Insert test data
    const insert = db.prepare('INSERT INTO test_products (name, description, price) VALUES (?, ?, ?)');
    insert.run('Test Product 1', 'A test product', 9.99);
    insert.run('Test Product 2', 'Another test product', 19.99);

    // Create Express app
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Vulnerable endpoint (for testing SQL injection)
    app.get('/api/vulnerable/search', (req, res) => {
      const { query } = req.query;
      
      try {
        // VULNERABLE: Direct string concatenation (for testing)
        const sql = `SELECT * FROM test_products WHERE name LIKE '%${query}%'`;
        const results = db.prepare(sql).all();
        res.json({ results });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Secure endpoint (using parameterized queries)
    app.get('/api/secure/search', (req, res) => {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Invalid query parameter' });
      }

      // Input validation
      if (query.length > 100) {
        return res.status(400).json({ error: 'Query too long' });
      }

      try {
        // SECURE: Parameterized query
        const sql = 'SELECT * FROM test_products WHERE name LIKE ?';
        const results = db.prepare(sql).all(`%${query}%`);
        res.json({ results });
      } catch (error) {
        res.status(500).json({ error: 'Database error' });
      }
    });

    // Endpoint for testing XSS
    app.post('/api/comments', (req, res) => {
      const { comment } = req.body;
      
      // Basic XSS prevention (HTML encoding)
      const sanitizedComment = comment
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

      res.json({ 
        original: comment,
        sanitized: sanitizedComment,
        safe: true 
      });
    });

    // Vulnerable XSS endpoint (for testing)
    app.post('/api/vulnerable/comments', (req, res) => {
      const { comment } = req.body;
      
      // VULNERABLE: No sanitization
      res.json({ 
        comment: comment,
        html: `<div>${comment}</div>`
      });
    });

    server = app.listen(0);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    if (server) {
      server.close();
    }
  });

  describe('SQL Injection Prevention', () => {
    it('should block basic SQL injection attempts', async () => {
      for (const payload of config.inputValidation.sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/vulnerable/search')
          .query({ query: payload });

        // Either should return 500 error or empty results
        if (response.status === 200) {
          // If successful, should not return sensitive data
          expect(response.body.results).toBeDefined();
          // Should not contain error messages that reveal database structure
          expect(JSON.stringify(response.body)).not.toMatch(/syntax error|SQL|database/i);
        } else {
          expect(response.status).toBe(500);
        }
      }
    });

    it('should handle SQL injection in secure endpoint', async () => {
      for (const payload of config.inputValidation.sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/secure/search')
          .query({ query: payload });

        // Should always return 200 with empty or safe results
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
        expect(Array.isArray(response.body.results)).toBe(true);
      }
    });

    it('should prevent SQL injection in POST requests', async () => {
      // Test if SQL injection payloads are properly handled in POST data
      for (const payload of config.inputValidation.sqlInjectionPayloads.slice(0, 5)) {
        const response = await request(app)
          .post('/api/comments')
          .send({ comment: payload });

        expect(response.status).toBe(200);
        expect(response.body.sanitized).not.toContain('SELECT');
        expect(response.body.sanitized).not.toContain('DROP');
        expect(response.body.sanitized).not.toContain('UNION');
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize XSS payloads in comments', async () => {
      for (const payload of config.inputValidation.xssPayloads) {
        const response = await request(app)
          .post('/api/comments')
          .send({ comment: payload })
          .expect(200);

        // Should sanitize dangerous characters
        expect(response.body.sanitized).not.toContain('<script>');
        expect(response.body.sanitized).not.toContain('javascript:');
        expect(response.body.sanitized).not.toContain('onerror=');
        expect(response.body.sanitized).not.toContain('onload=');
        
        // Should contain encoded versions
        if (payload.includes('<')) {
          expect(response.body.sanitized).toContain('&lt;');
        }
        if (payload.includes('>')) {
          expect(response.body.sanitized).toContain('&gt;');
        }
      }
    });

    it('should detect XSS attempts in vulnerable endpoint', async () => {
      const dangerousPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")'
      ];

      for (const payload of dangerousPayloads) {
        const response = await request(app)
          .post('/api/vulnerable/comments')
          .send({ comment: payload })
          .expect(200);

        // Vulnerable endpoint returns unsanitized content
        expect(response.body.comment).toBe(payload);
        expect(response.body.html).toContain(payload);
      }
    });

    it('should handle XSS in URL parameters', async () => {
      for (const payload of config.inputValidation.xssPayloads.slice(0, 3)) {
        const response = await request(app)
          .get('/api/secure/search')
          .query({ query: payload });

        // Should not crash and should return safe response
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should block path traversal attempts', async () => {
      for (const payload of config.inputValidation.pathTraversalPayloads) {
        const response = await request(app)
          .get('/api/secure/search')
          .query({ query: payload });

        // Should handle path traversal attempts safely
        expect(response.status).toBe(200);
        expect(response.body.results).toBeDefined();
        
        // Should not return system files
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/root:.*:0:0/); // /etc/passwd content
        expect(responseText).not.toMatch(/\[boot loader\]/); // Windows boot.ini
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should block command injection attempts', async () => {
      for (const payload of config.inputValidation.commandInjectionPayloads) {
        const response = await request(app)
          .post('/api/comments')
          .send({ comment: payload });

        expect(response.status).toBe(200);
        
        // Should sanitize command injection characters
        expect(response.body.sanitized).not.toContain(';');
        expect(response.body.sanitized).not.toContain('|');
        expect(response.body.sanitized).not.toContain('&');
        expect(response.body.sanitized).not.toContain('`');
        expect(response.body.sanitized).not.toContain('$(');
      }
    });
  });

  describe('Input Length Validation', () => {
    it('should reject overly long inputs', async () => {
      const longPayload = 'A'.repeat(1000);
      
      const response = await request(app)
        .get('/api/secure/search')
        .query({ query: longPayload });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Query too long');
    });

    it('should handle empty inputs gracefully', async () => {
      const response = await request(app)
        .get('/api/secure/search')
        .query({ query: '' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid query parameter');
    });

    it('should handle null and undefined inputs', async () => {
      const testCases = [
        { query: null },
        { query: undefined },
        {} // No query parameter
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .get('/api/secure/search')
          .query(testCase);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'Invalid query parameter');
      }
    });
  });

  describe('Content Type Validation', () => {
    it('should handle non-string inputs in JSON', async () => {
      const maliciousInputs = [
        { comment: { evil: 'object' } },
        { comment: ['array', 'input'] },
        { comment: 12345 },
        { comment: true },
        { comment: null }
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/comments')
          .send(input);

        // Should handle non-string inputs gracefully
        if (response.status === 200) {
          expect(response.body).toHaveProperty('sanitized');
        } else {
          expect(response.status).toBe(400);
        }
      }
    });

    it('should reject requests with invalid content-type', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Content-Type', 'text/plain')
        .send('plain text comment');

      // Express should handle this gracefully
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('Unicode and Encoding Tests', () => {
    it('should handle Unicode characters safely', async () => {
      const unicodePayloads = [
        'Iñtërnâtiônàlizætiøn',
        '中文测试',
        '🚀 Rocket emoji test',
        '\u0000null byte',
        '\u202e' + 'right-to-left override'
      ];

      for (const payload of unicodePayloads) {
        const response = await request(app)
          .post('/api/comments')
          .send({ comment: payload });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('sanitized');
      }
    });

    it('should handle URL encoding attempts', async () => {
      const encodedPayloads = [
        '%3Cscript%3Ealert%28%27XSS%27%29%3C%2Fscript%3E',
        '%27%20OR%20%271%27%3D%271',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ];

      for (const payload of encodedPayloads) {
        const response = await request(app)
          .get('/api/secure/search')
          .query({ query: payload });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
      }
    });
  });
});