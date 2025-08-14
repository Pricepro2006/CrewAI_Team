/**
 * Security Headers Middleware for Walmart Grocery Agent
 * Implements CORS, CSP, and other security headers
 */

import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '../../utils/logger.js';

export interface SecurityConfig {
  cors: {
    origins: string[];
    credentials: boolean;
  };
  csp: {
    directives: Record<string, string[]>;
  };
  rateLimiting: {
    windowMs: number;
    max: number;
  };
}

export class SecurityHeaders {
  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = this.mergeConfig(config);
  }

  private mergeConfig(userConfig?: Partial<SecurityConfig>): SecurityConfig {
    const defaultConfig: SecurityConfig = {
      cors: {
        origins: [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://localhost:3000',
          'https://localhost:5173',
          ...(process.env.ALLOWED_ORIGINS?.split(',') || [])
        ],
        credentials: true
      },
      csp: {
        directives: {
          'default-src': ["'self'"],
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.jsdelivr.net',
            'https://unpkg.com'
          ],
          'style-src': [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://fonts.googleapis.com'
          ],
          'font-src': [
            "'self'",
            'https://fonts.gstatic.com',
            'https://cdn.jsdelivr.net'
          ],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https:',
            'http:'
          ],
          'connect-src': [
            "'self'",
            'ws://localhost:*',
            'wss://localhost:*',
            'https://api.walmart.com',
            'https://*.brightdata.com'
          ],
          'worker-src': ["'self'", 'blob:'],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"]
        }
      },
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      }
    };

    return {
      cors: { ...defaultConfig.cors, ...userConfig?.cors },
      csp: { 
        directives: { 
          ...defaultConfig.csp.directives, 
          ...userConfig?.csp?.directives 
        } 
      },
      rateLimiting: { ...defaultConfig.rateLimiting, ...userConfig?.rateLimiting }
    };
  }

  /**
   * Get CORS middleware
   */
  getCorsMiddleware() {
    const corsOptions = {
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (this.config.cors.origins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`, 'SECURITY');
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: this.config.cors.credentials,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-File-Name'
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset'
      ],
      maxAge: 86400 // 24 hours
    };

    return cors(corsOptions);
  }

  /**
   * Get Helmet middleware for security headers
   */
  getHelmetMiddleware() {
    return helmet({
      contentSecurityPolicy: {
        directives: this.config.csp.directives,
        reportOnly: process.env.NODE_ENV === 'development'
      },
      crossOriginEmbedderPolicy: false, // Allow external resources
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      noSniff: true,
      frameguard: { action: 'deny' },
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
  }

  /**
   * Custom security headers middleware
   */
  customSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Remove sensitive headers that might reveal server info
    res.removeHeader('X-Powered-By');
    
    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Add API version and security flags
    res.setHeader('X-API-Version', '2.3.0');
    res.setHeader('X-Security-Headers', 'enabled');
    
    // Add cache control for sensitive endpoints
    if (req.path.includes('/api/') && !req.path.includes('/public/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
    }

    next();
  };

  /**
   * Request logging middleware
   */
  requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const originalSend = res.send;

    // Override send to capture response time
    res.send = function(body: any) {
      const duration = Date.now() - start;
      
      // Log request (without sensitive data)
      logger.info('HTTP Request', 'SECURITY', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('User-Agent')?.substring(0, 200), // Truncate long UA strings
        userId: (req as any).user?.id,
        sessionId: (req as any).sessionId
      });

      return originalSend.call(this, body);
    };

    next();
  };

  /**
   * Block suspicious requests
   */
  suspiciousRequestFilter = (req: Request, res: Response, next: NextFunction): void => {
    const suspiciousPatterns = [
      /\.\./,  // Path traversal
      /<script/i, // XSS attempts
      /union.*select/i, // SQL injection attempts
      /exec\(/i, // Code execution attempts
      /eval\(/i, // Code evaluation attempts
      /document\.cookie/i, // Cookie theft attempts
    ];

    const fullUrl = req.originalUrl || req.url;
    const body = JSON.stringify(req.body);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fullUrl) || pattern.test(body)) {
        logger.warn('Suspicious request blocked', 'SECURITY', {
          ip: req.ip,
          method: req.method,
          url: fullUrl,
          userAgent: req.get('User-Agent'),
          pattern: pattern.toString()
        });
        
        res.status(400).json({
          error: 'Bad Request',
          message: 'Request contains suspicious content'
        });
        return;
      }
    }

    next();
  };

  /**
   * IP whitelist middleware (for admin endpoints)
   */
  ipWhitelist = (allowedIPs: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const clientIP = req.ip || req.connection.remoteAddress || '';
      
      // Allow local development IPs
      const developmentIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
      const allAllowedIPs = [...allowedIPs, ...developmentIPs];
      
      if (!allAllowedIPs.some(ip => clientIP.includes(ip))) {
        logger.warn('IP access denied', 'SECURITY', {
          clientIP,
          path: req.path,
          method: req.method
        });
        
        res.status(403).json({
          error: 'Access Denied',
          message: 'Your IP address is not authorized to access this resource'
        });
        return;
      }

      next();
    };
  };
}

// Export configured instance
const securityHeaders = new SecurityHeaders();

export { securityHeaders };
export default SecurityHeaders;