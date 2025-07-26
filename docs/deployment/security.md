# Security Deployment Guide

## Overview

This guide covers comprehensive security measures for deploying CrewAI Team in production, including infrastructure security, application security, data protection, and compliance considerations.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Infrastructure Security](#infrastructure-security)
3. [Application Security](#application-security)
4. [Authentication & Authorization](#authentication--authorization)
5. [Data Security](#data-security)
6. [Network Security](#network-security)
7. [Secrets Management](#secrets-management)
8. [Security Monitoring](#security-monitoring)
9. [Incident Response](#incident-response)
10. [Compliance](#compliance)
11. [Security Checklist](#security-checklist)

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    WAF (Web Application Firewall)            │
│                 • OWASP Core Rule Set                        │
│                 • Rate Limiting                              │
│                 • DDoS Protection                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Load Balancer                             │
│                 • SSL/TLS Termination                        │
│                 • Health Checks                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    API Gateway                               │
│                 • Authentication                             │
│                 • Authorization                              │
│                 • Request Validation                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 Application Layer                            │
│              ┌──────────┴──────────┐                        │
│              │   API Servers        │                        │
│              │ • Input Validation   │                        │
│              │ • CSRF Protection    │                        │
│              │ • XSS Prevention     │                        │
│              └──────────┬──────────┘                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Data Layer                                │
│         ┌───────────┴────────────┬──────────────┐          │
│         │     Database           │    Cache      │          │
│         │ • Encryption at Rest   │ • Redis ACL  │          │
│         │ • Access Control       │ • TLS        │          │
│         └────────────────────────┴──────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Infrastructure Security

### Kubernetes Security

```yaml
# k8s/security-policies.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crewai
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: crewai
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: crewai
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    limits.cpu: "200"
    limits.memory: 400Gi
    persistentvolumeclaims: "10"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: limit-range
  namespace: crewai
spec:
  limits:
  - max:
      cpu: "2"
      memory: "4Gi"
    min:
      cpu: "100m"
      memory: "128Mi"
    default:
      cpu: "500m"
      memory: "1Gi"
    defaultRequest:
      cpu: "250m"
      memory: "512Mi"
    type: Container
```

### Container Security

```dockerfile
# Dockerfile with security best practices
FROM node:18-alpine AS builder

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache \
    ca-certificates \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy and install dependencies as root for permissions
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Remove shell access
RUN rm /bin/sh

# Use distroless base image for production
FROM gcr.io/distroless/nodejs18-debian11

COPY --from=builder --chown=1001:1001 /app /app

WORKDIR /app
USER 1001

EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
```

### Security Scanning

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  dependency-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run npm audit
        run: npm audit --production
        
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
          
  code-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, typescript
          
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp
            
  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build image
        run: docker build -t crewai:scan .
        
      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'crewai:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
          
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

## Application Security

### Input Validation

```typescript
// src/security/validation.ts
import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';
import sqlstring from 'sqlstring';

export class SecurityValidator {
  // Email validation rules
  static emailValidation = [
    body('from').isEmail().normalizeEmail(),
    body('to').isArray(),
    body('to.*').isEmail().normalizeEmail(),
    body('subject').trim().escape().isLength({ max: 200 }),
    body('body').customSanitizer(value => DOMPurify.sanitize(value)),
    body('attachments').optional().isArray(),
    body('attachments.*.filename').matches(/^[a-zA-Z0-9-_\.]+$/),
    body('attachments.*.size').isInt({ max: 10485760 }), // 10MB
  ];

  // Query validation
  static searchValidation = [
    query('q').trim().escape().isLength({ min: 1, max: 100 }),
    query('workflow').optional().isIn(['technical_support', 'sales', 'general']),
    query('priority').optional().isIn(['high', 'medium', 'low']),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ];

  // SQL injection prevention
  static sanitizeSQL(input: string): string {
    return sqlstring.escape(input);
  }

  // XSS prevention
  static sanitizeHTML(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href'],
    });
  }

  // Path traversal prevention
  static sanitizePath(input: string): string {
    return input.replace(/\.\./g, '').replace(/[^a-zA-Z0-9-_\/]/g, '');
  }

  // Command injection prevention
  static sanitizeCommand(input: string): string {
    const dangerous = [';', '&', '|', '>', '<', '`', '$', '(', ')', '{', '}'];
    let sanitized = input;
    dangerous.forEach(char => {
      sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), '');
    });
    return sanitized;
  }

  // Validation middleware
  static validate(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation failed', { 
        errors: errors.array(),
        ip: req.ip,
        path: req.path
      });
      
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array() 
      });
    }
    next();
  }
}

// Content Security Policy
export const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "wss://", "https://api.crewai.com"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'none'"],
    frameSrc: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: [],
  },
};
```

### CSRF Protection

```typescript
// src/security/csrf.ts
import csrf from 'csurf';
import { Request, Response, NextFunction } from 'express';

// CSRF middleware configuration
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
});

// CSRF token endpoint
export function csrfToken(req: Request, res: Response) {
  res.json({ csrfToken: req.csrfToken() });
}

// Double submit cookie pattern for APIs
export class DoubleSubmitCSRF {
  private static readonly COOKIE_NAME = 'csrf-token';
  private static readonly HEADER_NAME = 'x-csrf-token';
  
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
  
  static middleware(req: Request, res: Response, next: NextFunction) {
    // Skip for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const cookieToken = req.cookies[DoubleSubmitCSRF.COOKIE_NAME];
    const headerToken = req.headers[DoubleSubmitCSRF.HEADER_NAME];
    
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      logger.warn('CSRF token mismatch', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    
    next();
  }
  
  static setToken(res: Response) {
    const token = DoubleSubmitCSRF.generateToken();
    
    res.cookie(DoubleSubmitCSRF.COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });
    
    return token;
  }
}
```

## Authentication & Authorization

### JWT Security

```typescript
// src/security/auth.ts
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import crypto from 'crypto';

export class SecureAuth {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly TOKEN_ALGORITHM = 'RS256';
  
  // Key rotation support
  private static keys = new Map<string, { privateKey: string; publicKey: string }>();
  private static currentKeyId: string;
  
  static async initialize() {
    // Load keys from secure storage
    const keys = await this.loadKeys();
    keys.forEach((key, id) => this.keys.set(id, key));
    this.currentKeyId = await this.getCurrentKeyId();
    
    // Schedule key rotation
    setInterval(() => this.rotateKeys(), 24 * 60 * 60 * 1000); // Daily
  }
  
  static async generateTokenPair(userId: string, permissions: string[]) {
    const keyId = this.currentKeyId;
    const key = this.keys.get(keyId)!;
    
    const accessToken = jwt.sign(
      {
        sub: userId,
        permissions,
        type: 'access',
      },
      key.privateKey,
      {
        algorithm: this.TOKEN_ALGORITHM,
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        keyid: keyId,
        issuer: 'crewai',
        audience: 'crewai-api',
      }
    );
    
    const refreshToken = jwt.sign(
      {
        sub: userId,
        type: 'refresh',
        tokenFamily: crypto.randomBytes(16).toString('hex'),
      },
      key.privateKey,
      {
        algorithm: this.TOKEN_ALGORITHM,
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        keyid: keyId,
        issuer: 'crewai',
        audience: 'crewai-api',
      }
    );
    
    // Store refresh token family for rotation detection
    await this.storeRefreshToken(userId, refreshToken);
    
    return { accessToken, refreshToken };
  }
  
  static async verifyToken(token: string, type: 'access' | 'refresh') {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) throw new Error('Invalid token');
    
    const keyId = decoded.header.kid;
    const key = this.keys.get(keyId);
    if (!key) throw new Error('Unknown key');
    
    const payload = jwt.verify(token, key.publicKey, {
      algorithms: [this.TOKEN_ALGORITHM],
      issuer: 'crewai',
      audience: 'crewai-api',
    });
    
    if (payload.type !== type) {
      throw new Error('Invalid token type');
    }
    
    // Check for token reuse (refresh tokens only)
    if (type === 'refresh') {
      await this.checkRefreshTokenReuse(payload.sub, token);
    }
    
    return payload;
  }
  
  // Permission-based access control
  static authorize(requiredPermissions: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = req.user;
      
      if (!user || !user.permissions) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const hasPermission = requiredPermissions.every(perm => 
        user.permissions.includes(perm) || user.permissions.includes('admin')
      );
      
      if (!hasPermission) {
        logger.warn('Authorization failed', {
          userId: user.id,
          required: requiredPermissions,
          actual: user.permissions,
          path: req.path,
        });
        
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      next();
    };
  }
}

// OAuth2 integration
export class OAuth2Security {
  static providers = {
    google: {
      authURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://oauth2.googleapis.com/token',
      userInfoURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
      scope: 'openid email profile',
    },
    github: {
      authURL: 'https://github.com/login/oauth/authorize',
      tokenURL: 'https://github.com/login/oauth/access_token',
      userInfoURL: 'https://api.github.com/user',
      scope: 'read:user user:email',
    },
  };
  
  static generateAuthURL(provider: string, state: string) {
    const config = this.providers[provider];
    const params = new URLSearchParams({
      client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`]!,
      redirect_uri: `${process.env.APP_URL}/auth/callback/${provider}`,
      response_type: 'code',
      scope: config.scope,
      state,
    });
    
    return `${config.authURL}?${params}`;
  }
  
  static async validateCallback(provider: string, code: string, state: string) {
    // Validate state to prevent CSRF
    const validState = await this.validateState(state);
    if (!validState) {
      throw new Error('Invalid state parameter');
    }
    
    // Exchange code for token
    const config = this.providers[provider];
    const tokenResponse = await fetch(config.tokenURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`]!,
        client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]!,
        redirect_uri: `${process.env.APP_URL}/auth/callback/${provider}`,
        grant_type: 'authorization_code',
      }),
    });
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch(config.userInfoURL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    
    return userResponse.json();
  }
}
```

## Data Security

### Encryption at Rest

```typescript
// src/security/encryption.ts
import crypto from 'crypto';
import { promisify } from 'util';

export class DataEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32;
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly SALT_LENGTH = 64;
  private static readonly ITERATIONS = 100000;
  
  // Derive key from password
  static async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    const pbkdf2 = promisify(crypto.pbkdf2);
    return pbkdf2(password, salt, this.ITERATIONS, this.KEY_LENGTH, 'sha256');
  }
  
  // Encrypt sensitive data
  static async encrypt(data: string, masterKey: string): Promise<string> {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const key = await this.deriveKey(masterKey, salt);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    return combined.toString('base64');
  }
  
  // Decrypt sensitive data
  static async decrypt(encryptedData: string, masterKey: string): Promise<string> {
    const combined = Buffer.from(encryptedData, 'base64');
    
    const salt = combined.slice(0, this.SALT_LENGTH);
    const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const tag = combined.slice(
      this.SALT_LENGTH + this.IV_LENGTH,
      this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
    );
    const encrypted = combined.slice(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
    
    const key = await this.deriveKey(masterKey, salt);
    
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  }
  
  // Field-level encryption for database
  static encryptField(value: any, fieldKey: string): string {
    const key = crypto.createHash('sha256').update(fieldKey).digest();
    const iv = crypto.randomBytes(this.IV_LENGTH);
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
  
  static decryptField(encrypted: string, fieldKey: string): any {
    const [ivHex, encryptedHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedHex, 'hex');
    
    const key = crypto.createHash('sha256').update(fieldKey).digest();
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  }
}

// Personal data anonymization
export class DataAnonymization {
  static anonymizeEmail(email: string): string {
    const [local, domain] = email.split('@');
    const anonymized = local.substring(0, 2) + '***' + local.slice(-1);
    return `${anonymized}@${domain}`;
  }
  
  static anonymizeName(name: string): string {
    const parts = name.split(' ');
    return parts.map(part => 
      part.charAt(0) + '*'.repeat(part.length - 1)
    ).join(' ');
  }
  
  static anonymizeIP(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // IPv4
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    } else {
      // IPv6
      const segments = ip.split(':');
      return segments.slice(0, 4).join(':') + ':xxxx:xxxx:xxxx:xxxx';
    }
  }
  
  static hashPII(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data + process.env.PII_SALT)
      .digest('hex');
  }
}
```

## Network Security

### TLS Configuration

```typescript
// src/security/tls.ts
import tls from 'tls';
import https from 'https';
import fs from 'fs';

export class TLSConfig {
  static getSecureContext() {
    return {
      key: fs.readFileSync('/certs/private-key.pem'),
      cert: fs.readFileSync('/certs/certificate.pem'),
      ca: fs.readFileSync('/certs/ca-certificate.pem'),
      
      // Secure TLS configuration
      secureProtocol: 'TLSv1_2_method',
      honorCipherOrder: true,
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384',
      ].join(':'),
      
      // Disable insecure protocols
      secureOptions: 
        tls.constants.SSL_OP_NO_SSLv2 |
        tls.constants.SSL_OP_NO_SSLv3 |
        tls.constants.SSL_OP_NO_TLSv1 |
        tls.constants.SSL_OP_NO_TLSv1_1,
    };
  }
  
  static createSecureServer(app: Express) {
    return https.createServer(this.getSecureContext(), app);
  }
  
  // Certificate pinning for external APIs
  static createPinnedAgent(fingerprint: string) {
    return new https.Agent({
      checkServerIdentity: (host, cert) => {
        const certFingerprint = cert.fingerprint256;
        
        if (certFingerprint !== fingerprint) {
          throw new Error('Certificate fingerprint mismatch');
        }
        
        return undefined;
      },
    });
  }
}

// Rate limiting configuration
export class RateLimitConfig {
  static readonly limits = {
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,
    },
    
    auth: {
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      message: 'Too many authentication attempts',
    },
    
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60,
      keyGenerator: (req: Request) => {
        return req.user?.id || req.ip;
      },
    },
    
    websocket: {
      windowMs: 1 * 60 * 1000,
      max: 100,
      message: 'Too many WebSocket messages',
    },
  };
  
  static slowDown = {
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500,
    maxDelayMs: 20000,
  };
}
```

## Secrets Management

### HashiCorp Vault Integration

```typescript
// src/security/vault.ts
import vault from 'node-vault';

export class SecretManager {
  private static client: vault.client;
  
  static async initialize() {
    this.client = vault({
      endpoint: process.env.VAULT_ADDR,
      token: process.env.VAULT_TOKEN,
    });
    
    // Enable app role authentication
    await this.authenticateAppRole();
    
    // Schedule token renewal
    setInterval(() => this.renewToken(), 30 * 60 * 1000); // 30 minutes
  }
  
  private static async authenticateAppRole() {
    const result = await this.client.write('auth/approle/login', {
      role_id: process.env.VAULT_ROLE_ID,
      secret_id: process.env.VAULT_SECRET_ID,
    });
    
    this.client.token = result.auth.client_token;
  }
  
  static async getSecret(path: string): Promise<any> {
    try {
      const result = await this.client.read(`secret/data/${path}`);
      return result.data.data;
    } catch (error) {
      logger.error('Failed to retrieve secret', { path, error });
      throw error;
    }
  }
  
  static async rotateSecret(path: string, generator: () => string) {
    const newSecret = generator();
    
    await this.client.write(`secret/data/${path}`, {
      data: { value: newSecret },
      options: { cas: 0 },
    });
    
    logger.info('Secret rotated', { path });
    
    return newSecret;
  }
  
  // Dynamic database credentials
  static async getDatabaseCredentials() {
    const result = await this.client.read('database/creds/crewai-role');
    
    return {
      username: result.data.username,
      password: result.data.password,
      ttl: result.lease_duration,
    };
  }
}

// Environment-based secrets (for development)
export class EnvSecrets {
  private static secrets = new Map<string, string>();
  
  static load() {
    // Load from environment
    const envSecrets = {
      'database/password': process.env.DATABASE_PASSWORD,
      'jwt/secret': process.env.JWT_SECRET,
      'api/websearch': process.env.WEBSEARCH_API_KEY,
      'api/openai': process.env.OPENAI_API_KEY,
    };
    
    Object.entries(envSecrets).forEach(([key, value]) => {
      if (value) this.secrets.set(key, value);
    });
  }
  
  static get(path: string): string | undefined {
    return this.secrets.get(path);
  }
}
```

## Security Monitoring

### Intrusion Detection

```typescript
// src/security/ids.ts
export class IntrusionDetection {
  private static patterns = {
    sqlInjection: /(\b(union|select|insert|update|delete|drop|create)\b.*\b(from|into|where|table)\b)|(-{2})|(\||;)/i,
    xss: /<script|javascript:|onerror=|onload=|<iframe|<object|<embed/i,
    pathTraversal: /\.\.[\/\\]|\.\.%2[fF]|\.\.%5[cC]/,
    commandInjection: /[;&|`$(){}[\]<>]/,
    xxe: /<!DOCTYPE|<!ENTITY|SYSTEM|PUBLIC/i,
    ldapInjection: /[)(|&*=]/,
  };
  
  static detect(input: string, context: string): boolean {
    for (const [attack, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(input)) {
        logger.warn('Potential attack detected', {
          type: attack,
          context,
          input: input.substring(0, 100), // Log partial input
          timestamp: new Date().toISOString(),
        });
        
        // Increment metrics
        attacksDetected.labels(attack).inc();
        
        // Send alert if threshold exceeded
        this.checkAlertThreshold(attack);
        
        return true;
      }
    }
    
    return false;
  }
  
  private static alertThresholds = {
    sqlInjection: 5,
    xss: 10,
    pathTraversal: 3,
    commandInjection: 3,
    xxe: 1,
    ldapInjection: 5,
  };
  
  private static attackCounts = new Map<string, number>();
  
  private static checkAlertThreshold(attackType: string) {
    const count = (this.attackCounts.get(attackType) || 0) + 1;
    this.attackCounts.set(attackType, count);
    
    if (count >= this.alertThresholds[attackType]) {
      this.sendSecurityAlert(attackType, count);
      this.attackCounts.set(attackType, 0); // Reset count
    }
    
    // Reset counts every hour
    setTimeout(() => {
      this.attackCounts.set(attackType, 0);
    }, 3600000);
  }
  
  private static sendSecurityAlert(attackType: string, count: number) {
    // Send to security team
    alertManager.sendAlert({
      severity: 'critical',
      type: 'security',
      attack: attackType,
      count,
      message: `${count} ${attackType} attempts detected in the last hour`,
    });
  }
}

// Anomaly detection
export class AnomalyDetection {
  private static userBehavior = new Map<string, UserBehavior>();
  
  static async checkAnomaly(userId: string, action: string, metadata: any) {
    const behavior = this.userBehavior.get(userId) || {
      actions: [],
      loginTimes: [],
      ipAddresses: new Set(),
    };
    
    // Check for unusual patterns
    const anomalies = [];
    
    // Unusual login time
    const hour = new Date().getHours();
    if (behavior.loginTimes.length > 10) {
      const avgHour = behavior.loginTimes.reduce((a, b) => a + b) / behavior.loginTimes.length;
      if (Math.abs(hour - avgHour) > 6) {
        anomalies.push('unusual_login_time');
      }
    }
    
    // New IP address
    if (metadata.ip && !behavior.ipAddresses.has(metadata.ip)) {
      if (behavior.ipAddresses.size > 0) {
        anomalies.push('new_ip_address');
      }
      behavior.ipAddresses.add(metadata.ip);
    }
    
    // Unusual action frequency
    const recentActions = behavior.actions.filter(a => 
      Date.now() - a.timestamp < 300000 // 5 minutes
    );
    if (recentActions.length > 50) {
      anomalies.push('high_action_frequency');
    }
    
    // Update behavior
    behavior.actions.push({ action, timestamp: Date.now(), metadata });
    if (action === 'login') {
      behavior.loginTimes.push(hour);
    }
    
    this.userBehavior.set(userId, behavior);
    
    // Log anomalies
    if (anomalies.length > 0) {
      logger.warn('User behavior anomalies detected', {
        userId,
        anomalies,
        action,
        metadata,
      });
      
      // Take action based on severity
      if (anomalies.includes('new_ip_address') && anomalies.includes('unusual_login_time')) {
        // Require additional authentication
        return { requireMFA: true };
      }
    }
    
    return { anomalies };
  }
}
```

## Incident Response

### Incident Response Plan

```typescript
// src/security/incident-response.ts
export class IncidentResponse {
  static async handleIncident(type: string, severity: string, details: any) {
    const incident = {
      id: crypto.randomUUID(),
      type,
      severity,
      details,
      timestamp: new Date().toISOString(),
      status: 'active',
    };
    
    // Log incident
    logger.error('Security incident', incident);
    
    // Execute response based on type
    switch (type) {
      case 'data_breach':
        await this.handleDataBreach(incident);
        break;
        
      case 'unauthorized_access':
        await this.handleUnauthorizedAccess(incident);
        break;
        
      case 'ddos_attack':
        await this.handleDDoSAttack(incident);
        break;
        
      case 'malware_detected':
        await this.handleMalware(incident);
        break;
        
      default:
        await this.handleGenericIncident(incident);
    }
    
    // Notify stakeholders
    await this.notifyStakeholders(incident);
    
    // Create incident report
    await this.createIncidentReport(incident);
    
    return incident;
  }
  
  private static async handleDataBreach(incident: any) {
    // 1. Contain the breach
    await this.isolateAffectedSystems(incident.details.systems);
    
    // 2. Assess the damage
    const assessment = await this.assessDataExposure(incident.details);
    
    // 3. Notify affected users
    if (assessment.affectedUsers.length > 0) {
      await this.notifyAffectedUsers(assessment.affectedUsers);
    }
    
    // 4. Reset credentials
    await this.forcePasswordReset(assessment.affectedUsers);
    
    // 5. Enhance monitoring
    await this.enhanceMonitoring(incident.details.systems);
  }
  
  private static async handleUnauthorizedAccess(incident: any) {
    const { userId, ip, actions } = incident.details;
    
    // 1. Block user access
    await this.blockUser(userId);
    
    // 2. Block IP address
    await this.blockIP(ip);
    
    // 3. Audit user actions
    const audit = await this.auditUserActions(userId, actions);
    
    // 4. Revert unauthorized changes
    if (audit.unauthorizedChanges.length > 0) {
      await this.revertChanges(audit.unauthorizedChanges);
    }
  }
  
  private static async handleDDoSAttack(incident: any) {
    // 1. Enable DDoS protection
    await this.enableDDoSProtection();
    
    // 2. Scale infrastructure
    await this.autoScale(incident.details.targetService);
    
    // 3. Enable rate limiting
    await this.enforceStrictRateLimiting();
    
    // 4. Contact ISP/CDN
    await this.notifyUpstreamProviders(incident);
  }
}

// Automated response actions
export class AutomatedResponse {
  static async blockIP(ip: string, duration = 3600) {
    // Add to firewall blacklist
    await firewall.addRule({
      action: 'deny',
      source: ip,
      duration,
    });
    
    // Add to application blacklist
    await redis.setex(`blocked:ip:${ip}`, duration, 'blocked');
    
    logger.info('IP blocked', { ip, duration });
  }
  
  static async blockUser(userId: string, reason: string) {
    // Disable user account
    await db.query(
      'UPDATE users SET status = ?, blocked_at = ?, blocked_reason = ? WHERE id = ?',
      ['blocked', new Date(), reason, userId]
    );
    
    // Invalidate all sessions
    await this.invalidateUserSessions(userId);
    
    // Close WebSocket connections
    await this.closeUserConnections(userId);
    
    logger.info('User blocked', { userId, reason });
  }
  
  static async isolateSystem(systemId: string) {
    // Remove from load balancer
    await loadBalancer.removeTarget(systemId);
    
    // Block network access
    await firewall.isolate(systemId);
    
    // Snapshot for forensics
    await this.createForensicSnapshot(systemId);
    
    logger.info('System isolated', { systemId });
  }
}
```

## Compliance

### GDPR Compliance

```typescript
// src/security/gdpr.ts
export class GDPRCompliance {
  // Right to access
  static async exportUserData(userId: string) {
    const data = {
      profile: await db.query('SELECT * FROM users WHERE id = ?', [userId]),
      emails: await db.query('SELECT * FROM emails WHERE user_id = ?', [userId]),
      activities: await db.query('SELECT * FROM activity_log WHERE user_id = ?', [userId]),
      consents: await db.query('SELECT * FROM user_consents WHERE user_id = ?', [userId]),
    };
    
    // Anonymize other users' data
    data.emails = data.emails.map(email => ({
      ...email,
      from: DataAnonymization.anonymizeEmail(email.from),
      to: email.to.map(DataAnonymization.anonymizeEmail),
    }));
    
    return data;
  }
  
  // Right to erasure
  static async deleteUserData(userId: string) {
    const timestamp = new Date();
    
    // Soft delete with anonymization
    await db.transaction(async (trx) => {
      // Anonymize user data
      await trx.query(
        'UPDATE users SET email = ?, name = ?, deleted_at = ? WHERE id = ?',
        [
          DataAnonymization.hashPII(userId),
          'Deleted User',
          timestamp,
          userId
        ]
      );
      
      // Delete or anonymize related data
      await trx.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
      await trx.query('DELETE FROM user_tokens WHERE user_id = ?', [userId]);
      
      // Anonymize activity logs
      await trx.query(
        'UPDATE activity_log SET user_id = ?, ip_address = ? WHERE user_id = ?',
        [DataAnonymization.hashPII(userId), '0.0.0.0', userId]
      );
    });
    
    logger.info('User data deleted', { userId, timestamp });
  }
  
  // Consent management
  static async updateConsent(userId: string, consents: Consent[]) {
    for (const consent of consents) {
      await db.query(
        `INSERT INTO user_consents (user_id, purpose, granted, timestamp)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE granted = ?, timestamp = ?`,
        [userId, consent.purpose, consent.granted, new Date(),
         consent.granted, new Date()]
      );
    }
    
    logger.info('User consent updated', { userId, consents });
  }
}
```

## Security Checklist

### Pre-Deployment

- [ ] All dependencies updated and vulnerability-free
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Input validation on all endpoints
- [ ] Authentication and authorization implemented
- [ ] Encryption at rest and in transit
- [ ] Secrets managed securely
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] SQL injection prevention
- [ ] XSS prevention measures

### Infrastructure

- [ ] Firewall rules configured
- [ ] Network segmentation implemented
- [ ] VPN/Bastion host for admin access
- [ ] DDoS protection enabled
- [ ] WAF configured
- [ ] Container security scanning
- [ ] Kubernetes security policies
- [ ] Regular security updates scheduled

### Monitoring

- [ ] Security event logging
- [ ] Intrusion detection system
- [ ] Anomaly detection configured
- [ ] Alert rules for security events
- [ ] Incident response plan documented
- [ ] Regular security audits scheduled
- [ ] Penetration testing planned

### Compliance

- [ ] GDPR compliance measures
- [ ] Data retention policies
- [ ] Privacy policy updated
- [ ] Terms of service reviewed
- [ ] Audit trail implementation
- [ ] Compliance documentation

## Best Practices

1. **Defense in depth**: Multiple layers of security
2. **Least privilege**: Minimal permissions needed
3. **Fail securely**: Secure defaults on errors
4. **Zero trust**: Verify everything
5. **Regular updates**: Patch management process
6. **Security training**: Team awareness
7. **Incident practice**: Regular drills
8. **Documentation**: Keep security docs updated
9. **Third-party audits**: External validation
10. **Continuous improvement**: Learn from incidents

## Next Steps

1. Conduct security assessment
2. Implement missing controls
3. Set up security monitoring
4. Create incident response team
5. Schedule security training
6. Plan penetration testing
7. Review compliance requirements