/**
 * Comprehensive Security Headers Middleware
 * Implements CORS, CSP, and other security headers for web application protection
 */

import type { Request, Response, NextFunction } from "express";
import * as cors from "cors";
import { logger } from "../../../utils/logger.js";

/**
 * Security headers configuration interface
 */
interface SecurityHeadersConfig {
  // CORS configuration
  cors: {
    origins: string[];
    credentials: boolean;
    maxAge?: number;
  };

  // Content Security Policy
  csp: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    fontSrc: string[];
    connectSrc: string[];
    frameSrc?: string[];
    workerSrc?: string[];
    objectSrc?: string[];
    reportUri?: string;
  };

  // Other security headers
  frameOptions: "DENY" | "SAMEORIGIN";
  xssProtection: boolean;
  noSniff: boolean;
  hsts: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  referrerPolicy: string;
  permissionsPolicy: string;
}

/**
 * Get security headers configuration based on environment
 */
export function getSecurityHeadersConfig(): SecurityHeadersConfig {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  // Get allowed origins from environment or use defaults
  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()).filter(Boolean) || []),
    ...(process.env.CORS_ORIGIN?.split(",").map(o => o.trim()).filter(Boolean) || []),
  ];
  
  // Add default development origins if no origins specified
  if (allowedOrigins.length === 0 && !isProduction) {
    allowedOrigins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://localhost:5178",
      "http://localhost:5179",
      "http://localhost:5180"
    );
  }

  // Add production origins if configured
  if (isProduction && process.env.PRODUCTION_ORIGINS) {
    allowedOrigins.push(...process.env.PRODUCTION_ORIGINS.split(",").map(o => o.trim()).filter(Boolean));
  }
  
  // Remove duplicates
  const uniqueOrigins = Array.from(new Set(allowedOrigins));

  return {
    cors: {
      origins: uniqueOrigins,
      credentials: true,
      maxAge: isDevelopment ? 3600 : 86400, // 1 hour in dev, 24 hours in prod
    },

    csp: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
        "https://cdn.jsdelivr?.net", // For any CDN scripts
        "https://unpkg.com",
        // Add nonce support for production builds
        ...(isProduction ? ["'nonce-{NONCE}'"] : []),
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for React and many UI libraries
        "https://fonts?.googleapis?.com",
        "https://cdn.jsdelivr?.net",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
        "http://localhost:*", // For development
      ],
      fontSrc: ["'self'", "https://fonts?.gstatic?.com", "data:"],
      connectSrc: [
        "'self'",
        ...(isDevelopment ? [
          "ws://localhost:*",
          "wss://localhost:*",
          "http://localhost:*",
          "https://localhost:*",
          "ws://127.0.0.1:*",
          "http://127.0.0.1:*"
        ] : []),
        ...(isProduction ? [
          "wss://*.crewai-team.com",
          "https://*.crewai-team.com",
          process.env.PRODUCTION_WS_URL || "",
          process.env.PRODUCTION_API_URL || ""
        ].filter(Boolean) : []),
        process.env.LLAMA_CPP_URL || process.env.OLLAMA_URL || "http://localhost:8081",
        process.env.CHROMA_BASE_URL || process.env.CHROMA_URL || "http://localhost:8000",
        // Add any external APIs the frontend needs
        ...(process.env.EXTERNAL_API_URLS?.split(",").map(u => u.trim()).filter(Boolean) || []),
      ].filter(Boolean),
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"], // Block plugins like Flash
      reportUri: process.env.CSP_REPORT_URI,
    },

    frameOptions: "DENY",
    xssProtection: true,
    noSniff: true,

    hsts: {
      maxAge: isProduction ? 31536000 : 0, // 1 year in production, disabled in dev
      includeSubDomains: true,
      preload: isProduction,
    },

    referrerPolicy: "strict-origin-when-cross-origin",

    permissionsPolicy: [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
    ].join(", "),
  };
}

/**
 * Create CORS middleware with secure configuration
 */
export function createCorsMiddleware(config: SecurityHeadersConfig) {
  // Cache allowed origins in a Set for O(1) lookup
  const allowedOriginsSet = new Set(config?.cors?.origins || []);
  
  return cors.default({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, curl, server-to-server, etc.)
      if (!origin) {
        // In production, be more strict about no-origin requests
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_NO_ORIGIN) {
          logger.warn(
            "CORS: Blocked request with no origin in production",
            "SECURITY",
            { }
          );
          return callback(new Error("Origin required in production"));
        }
        return callback(null, true);
      }

      // Check if origin is in allowlist (O(1) lookup with Set)
      if (allowedOriginsSet.has(origin)) {
        callback(null, true);
      } else {
        // In development, log but allow for easier testing
        if (process.env.NODE_ENV === 'development') {
          logger.debug(
            "CORS: Allowing unregistered origin in development",
            "SECURITY",
            { origin }
          );
          callback(null, true);
        } else {
          logger.warn(
            "CORS: Blocked request from unauthorized origin",
            "SECURITY",
            {
              origin,
              allowedOrigins: Array.from(allowedOriginsSet),
            },
          );
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: config?.cors?.credentials,
    maxAge: config?.cors?.maxAge,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-CSRF-Token",
      "X-Request-ID",
    ],
    exposedHeaders: [
      "X-Request-ID",
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
    ],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  });
}

/**
 * Create Content-Security-Policy header
 */
function createCSPHeader(config: SecurityHeadersConfig): string {
  const directives: string[] = [];

  // Add each CSP directive
  directives.push(`default-src ${config?.csp?.defaultSrc.join(" ")}`);
  directives.push(`script-src ${config?.csp?.scriptSrc.join(" ")}`);
  directives.push(`style-src ${config?.csp?.styleSrc.join(" ")}`);
  directives.push(`img-src ${config?.csp?.imgSrc.join(" ")}`);
  directives.push(`font-src ${config?.csp?.fontSrc.join(" ")}`);
  directives.push(`connect-src ${config?.csp?.connectSrc.join(" ")}`);

  if (config?.csp?.frameSrc) {
    directives.push(`frame-src ${config?.csp?.frameSrc.join(" ")}`);
  }

  if (config?.csp?.workerSrc) {
    directives.push(`worker-src ${config?.csp?.workerSrc.join(" ")}`);
  }

  if (config?.csp?.objectSrc) {
    directives.push(`object-src ${config?.csp?.objectSrc.join(" ")}`);
  }

  // Add security enhancements
  directives.push("base-uri 'self'");
  directives.push("form-action 'self'");
  directives.push("frame-ancestors 'none'");
  directives.push("block-all-mixed-content");

  // Add report URI if configured
  if (config?.csp?.reportUri) {
    directives.push(`report-uri ${config?.csp?.reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Create comprehensive security headers middleware
 */
export function createSecurityHeadersMiddleware(
  customConfig?: Partial<SecurityHeadersConfig>,
) {
  const config = { ...getSecurityHeadersConfig(), ...customConfig };

  return (req: Request, res: Response, next: NextFunction) => {
    // Content-Security-Policy
    const cspHeader = createCSPHeader(config);
    res.setHeader("Content-Security-Policy", cspHeader);

    // Also set the legacy X-WebKit-CSP header for older browsers
    res.setHeader("X-WebKit-CSP", cspHeader);

    // X-Frame-Options
    res.setHeader("X-Frame-Options", config.frameOptions);

    // X-Content-Type-Options
    if (config.noSniff) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }

    // X-XSS-Protection (legacy but still useful for older browsers)
    if (config.xssProtection) {
      res.setHeader("X-XSS-Protection", "1; mode=block");
    }

    // Strict-Transport-Security (HSTS)
    if (config?.hsts?.maxAge > 0) {
      let hstsValue = `max-age=${config?.hsts?.maxAge}`;
      if (config?.hsts?.includeSubDomains) {
        hstsValue += "; includeSubDomains";
      }
      if (config?.hsts?.preload) {
        hstsValue += "; preload";
      }
      res.setHeader("Strict-Transport-Security", hstsValue);
    }

    // Referrer-Policy
    res.setHeader("Referrer-Policy", config.referrerPolicy);

    // Permissions-Policy (replaces Feature-Policy)
    res.setHeader("Permissions-Policy", config.permissionsPolicy);

    // Additional security headers
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("X-DNS-Prefetch-Control", "off");

    // Remove potentially dangerous headers
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");

    // Log security headers application in development
    if (process.env.NODE_ENV === "development") {
      logger.debug("Security headers applied", "SECURITY", {
        path: req.path,
        method: req.method,
        origin: req?.headers?.origin,
        ip: req.ip,
      });
    }

    next();
  };
}

/**
 * Create a middleware to validate Origin header for additional security
 */
export function createOriginValidationMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req?.headers?.origin;

    // Skip validation for same-origin requests or requests without origin
    if (!origin || req?.headers?.host === new URL(origin).host) {
      return next();
    }

    // Validate origin for cross-origin requests
    if (!allowedOrigins.includes(origin)) {
      logger.warn("Origin validation failed", "SECURITY", {
        origin,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      return res.status(403).json({
        error: "Forbidden: Invalid origin",
      });
    }

    next();
  };
}

/**
 * Create preflight cache middleware for better CORS performance
 */
export function createPreflightCacheMiddleware(maxAge: number = 86400) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS") {
      // Set cache headers for preflight requests
      res.setHeader("Cache-Control", `public, max-age=${maxAge}`);
      res.setHeader("Vary", "Origin, Access-Control-Request-Headers");
    }
    next();
  };
}

/**
 * Export convenience function to apply all security headers
 */
export function applySecurityHeaders(
  app: any,
  customConfig?: Partial<SecurityHeadersConfig>,
) {
  const config = { ...getSecurityHeadersConfig(), ...customConfig };

  // Apply preflight caching first
  app.use(createPreflightCacheMiddleware());

  // Apply CORS middleware
  app.use(createCorsMiddleware(config));

  // Apply security headers middleware
  app.use(createSecurityHeadersMiddleware(config));

  // Optional: Apply origin validation for extra security
  if (process.env.STRICT_ORIGIN_CHECK === "true") {
    app.use(createOriginValidationMiddleware(config?.cors?.origins));
  }

  logger.info("Security headers middleware initialized", "SECURITY", {
    corsOrigins: config?.cors?.origins?.length || 0,
    environment: process.env.NODE_ENV,
    strictOriginCheck: process.env.STRICT_ORIGIN_CHECK === "true",
  });
}

/**
 * Utility function to test security headers
 */
export function testSecurityHeaders(headers: Record<string, string>): {
  passed: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for required security headers
  const requiredHeaders = [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "X-XSS-Protection",
    "Referrer-Policy",
    "Permissions-Policy",
  ];

  for (const header of requiredHeaders) {
    if (!headers[header.toLowerCase()]) {
      issues.push(`Missing required header: ${header}`);
    }
  }

  // Check for headers that should be removed
  const dangerousHeaders = ["X-Powered-By", "Server"];
  for (const header of dangerousHeaders) {
    if (headers[header.toLowerCase()]) {
      issues.push(`Dangerous header present: ${header}`);
    }
  }

  // Validate CSP
  const csp = headers["content-security-policy"];
  if (csp) {
    if (!csp.includes("default-src")) {
      issues.push("CSP missing default-src directive");
    }
    if (
      csp.includes("'unsafe-inline'") &&
      process.env.NODE_ENV === "production"
    ) {
      issues.push("CSP contains 'unsafe-inline' in production");
    }
    if (
      csp.includes("'unsafe-eval'") &&
      process.env.NODE_ENV === "production"
    ) {
      issues.push("CSP contains 'unsafe-eval' in production");
    }
  }

  // Validate HSTS in production
  if (process.env.NODE_ENV === "production") {
    const hsts = headers["strict-transport-security"];
    if (!hsts) {
      issues.push("Missing HSTS header in production");
    } else if (!hsts.includes("max-age=31536000")) {
      issues.push("HSTS max-age should be at least 1 year in production");
    }
  }

  return {
    passed: (issues?.length || 0) === 0,
    issues,
  };
}
