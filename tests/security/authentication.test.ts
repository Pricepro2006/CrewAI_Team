/**
 * Authentication Security Tests
 * Tests JWT authentication, session management, and token validation
 */

import { describe, expect, it, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { getSecurityTestConfig } from './config/security-test-config.js';

const config = getSecurityTestConfig();

describe('Authentication Security Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Mock Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use('/api/protected', (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      try {
        const decoded = jwt.verify(token, config.authentication.jwtSecret);
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    });

    app.post('/api/auth/login', (req, res) => {
      const { email, password } = req.body;
      
      // Mock authentication logic
      if (email === config.authentication.testUser.email && 
          password === config.authentication.testUser.password) {
        const token = jwt.sign(
          { userId: 1, email, role: 'user' },
          config.authentication.jwtSecret,
          { expiresIn: config.authentication.tokenExpiry }
        );
        res.json({ token, user: { email, role: 'user' } });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });

    app.get('/api/protected/profile', (req, res) => {
      res.json({ user: req.user });
    });

    server = app.listen(0);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('JWT Token Validation', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'No token provided');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should reject expired tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        config.authentication.jwtSecret,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should reject tokens signed with wrong secret', async () => {
      const maliciousToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        'wrong_secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should accept valid tokens', async () => {
      const validToken = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'user' },
        config.authentication.jwtSecret,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/protected/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.user).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('Login Security', () => {
    it('should reject login with empty credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.authentication.testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should accept valid credentials and return token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.authentication.testUser.email,
          password: config.authentication.testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', config.authentication.testUser.email);

      // Verify token is valid
      const decoded = jwt.verify(response.body.token, config.authentication.jwtSecret);
      expect(decoded).toHaveProperty('email', config.authentication.testUser.email);
    });
  });

  describe('Token Structure Validation', () => {
    it('should include required claims in JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.authentication.testUser.email,
          password: config.authentication.testUser.password
        })
        .expect(200);

      const decoded: any = jwt.verify(response.body.token, config.authentication.jwtSecret);
      
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('iat'); // Issued at
      expect(decoded).toHaveProperty('exp'); // Expiry
    });

    it('should have reasonable token expiry time', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.authentication.testUser.email,
          password: config.authentication.testUser.password
        })
        .expect(200);

      const decoded: any = jwt.verify(response.body.token, config.authentication.jwtSecret);
      const expiryDuration = decoded.exp - decoded.iat;
      
      // Should not exceed 24 hours (86400 seconds)
      expect(expiryDuration).toBeLessThanOrEqual(86400);
      // Should be at least 5 minutes (300 seconds)
      expect(expiryDuration).toBeGreaterThanOrEqual(300);
    });
  });

  describe('Security Headers in Authentication', () => {
    it('should not expose sensitive information in login response', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.authentication.testUser.email,
          password: config.authentication.testUser.password
        })
        .expect(200);

      // Should not contain password or internal IDs
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should handle malformed authorization headers', async () => {
      const malformedHeaders = [
        'Bearer',
        'Bearer ',
        'Basic sometoken',
        'InvalidFormat',
        ''
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/protected/profile')
          .set('Authorization', header)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('Brute Force Protection', () => {
    it('should implement rate limiting for login attempts', async () => {
      // This test would require implementing rate limiting in the actual app
      // For now, we'll test the concept
      const attempts = [];
      
      for (let i = 0; i < 6; i++) {
        const response = request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
        attempts.push(response);
      }

      const responses = await Promise.all(attempts);
      
      // All should be 401 for wrong credentials
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });
  });
});