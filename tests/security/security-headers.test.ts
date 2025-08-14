/**
 * Security Headers Tests
 * Tests for required security headers (CSP, HSTS, X-Frame-Options)
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import { getSecurityTestConfig } from './config/security-test-config.js';

const config = getSecurityTestConfig();

describe('Security Headers Tests', () => {
  let app: express.Application;
  let server: any;
  let secureApp: express.Application;
  let secureServer: any;

  beforeAll(async () => {
    // Create app WITHOUT security headers (for testing missing headers)
    app = express();
    app.use(express.json());
    
    app.get('/api/test', (req, res) => {
      res.json({ message: 'Test endpoint without security headers' });
    });

    app.get('/api/sensitive', (req, res) => {
      res.json({ 
        message: 'Sensitive data endpoint',
        userToken: 'secret_token_123',
        adminData: 'confidential_information'
      });
    });

    // Create app WITH security headers (for testing proper headers)
    secureApp = express();
    secureApp.use(express.json());
    
    // Apply security headers with helmet
    secureApp.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permissionsPolicy: {
        features: {
          camera: ['none'],
          microphone: ['none'],
          geolocation: ['none'],
          payment: ['none']
        }
      }
    }));

    // Remove X-Powered-By header
    secureApp.disable('x-powered-by');

    secureApp.get('/api/secure', (req, res) => {
      res.json({ message: 'Secure endpoint with proper headers' });
    });

    secureApp.get('/api/admin', (req, res) => {
      res.json({ 
        message: 'Admin endpoint',
        adminLevel: 'high'
      });
    });

    // Custom security headers for testing
    secureApp.use('/api/custom', (req, res, next) => {
      res.setHeader('X-Custom-Security', 'enabled');
      res.setHeader('X-API-Version', 'v1.0');
      next();
    });

    secureApp.get('/api/custom/endpoint', (req, res) => {
      res.json({ message: 'Custom headers endpoint' });
    });

    server = app.listen(0);
    secureServer = secureApp.listen(0);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
    if (secureServer) {
      secureServer.close();
    }
  });

  describe('Required Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    });

    it('should include X-XSS-Protection header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('x-xss-protection', '0');
    });

    it('should include Strict-Transport-Security header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
      expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
    });

    it('should include Content-Security-Policy header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      const csp = response.headers['content-security-policy'];
      
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-src 'none'");
    });

    it('should include Referrer-Policy header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('referrer-policy');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include Permissions-Policy header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).toHaveProperty('permissions-policy');
      const permissionsPolicy = response.headers['permissions-policy'];
      
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
    });
  });

  describe('Forbidden Security Headers', () => {
    it('should not expose Server header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).not.toHaveProperty('server');
    });

    it('should not expose X-Powered-By header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).not.toHaveProperty('x-powered-by');
    });

    it('should not expose X-AspNet-Version header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).not.toHaveProperty('x-aspnet-version');
    });

    it('should not expose X-Runtime header', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers).not.toHaveProperty('x-runtime');
    });
  });

  describe('Missing Security Headers Detection', () => {
    it('should detect missing X-Frame-Options in unsecure app', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers).not.toHaveProperty('x-frame-options');
    });

    it('should detect missing CSP in unsecure app', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers).not.toHaveProperty('content-security-policy');
    });

    it('should detect missing HSTS in unsecure app', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      expect(response.headers).not.toHaveProperty('strict-transport-security');
    });

    it('should detect exposed X-Powered-By in unsecure app', async () => {
      const response = await request(app)
        .get('/api/test')
        .expect(200);

      // Express exposes this by default
      expect(response.headers).toHaveProperty('x-powered-by');
      expect(response.headers['x-powered-by']).toContain('Express');
    });
  });

  describe('Content Security Policy Validation', () => {
    it('should have restrictive default-src directive', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/default-src[^;]*'self'/);
    });

    it('should block object and embed elements', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("object-src 'none'");
    });

    it('should restrict frame sources', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("frame-src 'none'");
    });

    it('should allow necessary script sources', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toMatch(/script-src[^;]*'self'/);
    });
  });

  describe('HSTS Configuration', () => {
    it('should have adequate max-age value', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const hsts = response.headers['strict-transport-security'];
      const maxAgeMatch = hsts.match(/max-age=(\d+)/);
      
      expect(maxAgeMatch).toBeTruthy();
      const maxAge = parseInt(maxAgeMatch![1]);
      
      // Should be at least 1 year (31536000 seconds)
      expect(maxAge).toBeGreaterThanOrEqual(31536000);
    });

    it('should include subdomains in HSTS', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('includeSubDomains');
    });

    it('should include preload directive in HSTS', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const hsts = response.headers['strict-transport-security'];
      expect(hsts).toContain('preload');
    });
  });

  describe('Headers Consistency', () => {
    it('should apply security headers consistently across endpoints', async () => {
      const endpoints = ['/api/secure', '/api/admin'];
      
      for (const endpoint of endpoints) {
        const response = await request(secureApp)
          .get(endpoint)
          .expect(200);

        // Check all required headers are present
        config.securityHeaders.required.forEach(header => {
          expect(response.headers).toHaveProperty(header.toLowerCase());
        });

        // Check forbidden headers are not present
        config.securityHeaders.forbidden.forEach(header => {
          expect(response.headers).not.toHaveProperty(header.toLowerCase());
        });
      }
    });

    it('should maintain custom headers alongside security headers', async () => {
      const response = await request(secureApp)
        .get('/api/custom/endpoint')
        .expect(200);

      // Custom headers should be present
      expect(response.headers).toHaveProperty('x-custom-security', 'enabled');
      expect(response.headers).toHaveProperty('x-api-version', 'v1.0');

      // Security headers should still be present
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
    });
  });

  describe('Header Values Validation', () => {
    it('should have secure values for X-Frame-Options', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const frameOptions = response.headers['x-frame-options'];
      expect(['DENY', 'SAMEORIGIN']).toContain(frameOptions);
    });

    it('should have secure Content-Type-Options', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should have appropriate Referrer-Policy', async () => {
      const response = await request(secureApp)
        .get('/api/secure')
        .expect(200);

      const referrerPolicy = response.headers['referrer-policy'];
      const secureValues = [
        'strict-origin',
        'strict-origin-when-cross-origin',
        'same-origin',
        'no-referrer'
      ];
      
      expect(secureValues).toContain(referrerPolicy);
    });
  });

  describe('Headers for Different Content Types', () => {
    beforeAll(() => {
      secureApp.get('/api/json', (req, res) => {
        res.json({ data: 'json response' });
      });

      secureApp.get('/api/html', (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.send('<html><body>HTML response</body></html>');
      });

      secureApp.get('/api/text', (req, res) => {
        res.setHeader('Content-Type', 'text/plain');
        res.send('Plain text response');
      });
    });

    it('should apply security headers to JSON responses', async () => {
      const response = await request(secureApp)
        .get('/api/json')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should apply security headers to HTML responses', async () => {
      const response = await request(secureApp)
        .get('/api/html')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should apply security headers to text responses', async () => {
      const response = await request(secureApp)
        .get('/api/text')
        .expect(200);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });

  describe('Error Response Headers', () => {
    beforeAll(() => {
      secureApp.get('/api/error', (req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      secureApp.get('/api/notfound', (req, res) => {
        res.status(404).json({ error: 'Not found' });
      });
    });

    it('should include security headers in error responses', async () => {
      const response = await request(secureApp)
        .get('/api/error')
        .expect(500);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });

    it('should include security headers in 404 responses', async () => {
      const response = await request(secureApp)
        .get('/api/notfound')
        .expect(404);

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });
  });
});