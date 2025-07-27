/**
 * Integration tests for security headers in the actual server
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, server } from '../../../server';

describe('Security Headers Integration', () => {
  beforeAll(() => {
    // Ensure server is not listening during tests
    if (server.listening) {
      server.close();
    }
  });

  afterAll(() => {
    // Close server after tests
    if (server.listening) {
      server.close();
    }
  });

  test('should apply security headers to API responses', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    // Check security headers
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['permissions-policy']).toBeDefined();
    
    // Check removed headers
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['server']).toBeUndefined();
  });

  test('should handle CORS preflight requests', async () => {
    const response = await request(app)
      .options('/api/test')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type')
      .expect(200);

    // Check CORS headers
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    
    // Check preflight cache headers
    expect(response.headers['cache-control']).toBeDefined();
    expect(response.headers['vary']).toContain('Origin');
  });

  test('should reject requests from unauthorized origins', async () => {
    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'https://malicious-site.com')
      .expect(500); // CORS middleware will throw an error

    // The request should be rejected by CORS
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('should allow requests without origin header', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    // Request without origin should be allowed (for tools like curl, Postman)
    expect(response.status).toBe(200);
  });

  test('should apply CSP directives correctly', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    const csp = response.headers['content-security-policy'];
    
    // Verify CSP directives
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  test('should not set HSTS header in non-production', async () => {
    process.env.NODE_ENV = 'test';
    
    const response = await request(app)
      .get('/health')
      .expect(200);

    // HSTS should not be set in test/development
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  test('should handle WebSocket upgrade headers correctly', async () => {
    const response = await request(app)
      .get('/trpc-ws')
      .set('Upgrade', 'websocket')
      .set('Connection', 'Upgrade')
      .set('Sec-WebSocket-Version', '13')
      .set('Sec-WebSocket-Key', 'dGhlIHNhbXBsZSBub25jZQ==')
      .expect(426); // Upgrade Required (since we're not actually upgrading)

    // Security headers should still be applied
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  test('should expose necessary headers for frontend', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    // Check exposed headers for frontend access
    const exposedHeaders = response.headers['access-control-expose-headers'];
    expect(exposedHeaders).toContain('X-Request-ID');
    expect(exposedHeaders).toContain('X-RateLimit-Limit');
    expect(exposedHeaders).toContain('X-RateLimit-Remaining');
  });

  test('should handle CORS with credentials correctly', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', 'test=value')
      .send({ username: 'test', password: 'test' });

    // Credentials should be allowed
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    
    // Should not use wildcard with credentials
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  test('should set additional security headers', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    // Check additional security headers
    expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    expect(response.headers['x-download-options']).toBe('noopen');
    expect(response.headers['x-dns-prefetch-control']).toBe('off');
  });
});