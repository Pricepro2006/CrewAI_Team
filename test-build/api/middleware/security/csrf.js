import { randomBytes, createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { logger } from "../../../utils/logger.js";
/**
 * CSRF Token configuration
 *
 * IMPORTANT: __Host- prefix requires HTTPS. Using environment-specific names to prevent
 * 500 errors in development. See CSRF_FIX_DOCUMENTATION.md for details.
 */
const CSRF_TOKEN_LENGTH = 32; // 256 bits
const CSRF_TOKEN_HEADER = "x-csrf-token";
// FIX: Use __Host- prefix only in production with HTTPS, regular name in development
// Dynamic function to support testing environment changes
const getCSRFCookieName = () => process.env.NODE_ENV === 'production'
    ? "__Host-csrf-token" // Requires HTTPS, secure: true, path: /, no domain
    : "csrf-token"; // Works with HTTP in development
const CSRF_SESSION_KEY = "csrfToken";
const CSRF_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const CSRF_TOKEN_ROTATION_INTERVAL = 60 * 60 * 1000; // 1 hour
// Store for token metadata (in production, use Redis or similar)
const tokenMetadata = new Map();
/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken() {
    return randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}
/**
 * Set CSRF token in secure httpOnly cookie
 * FIX: Properly handle secure flag based on environment and __Host- requirements
 */
export function setCSRFCookie(res, token, isSecure = true) {
    // __Host- prefix requires secure: true, so only use in production with HTTPS
    const useSecure = process.env.NODE_ENV === "production" ? true : false;
    res.cookie(getCSRFCookieName(), token, {
        httpOnly: true,
        secure: useSecure, // Must be true for __Host- prefix, false for development
        sameSite: "strict",
        path: "/",
        maxAge: CSRF_TOKEN_MAX_AGE,
        // domain is intentionally omitted (required for __Host- prefix)
    });
    logger.debug("CSRF cookie set", "CSRF", {
        tokenHash: hashToken(token),
        secure: isSecure,
        maxAge: CSRF_TOKEN_MAX_AGE,
    });
}
/**
 * Get CSRF token from request (cookie or session)
 */
export function getStoredCSRFToken(req) {
    // First check cookie (preferred)
    const cookieToken = req.cookies?.[getCSRFCookieName()];
    if (cookieToken) {
        return cookieToken;
    }
    // Fallback to session if available
    const sessionToken = req.session?.[CSRF_SESSION_KEY];
    return sessionToken;
}
/**
 * Get CSRF token from request header
 */
export function getRequestCSRFToken(req) {
    // Check header (preferred for API calls)
    const headerToken = req.headers[CSRF_TOKEN_HEADER];
    if (headerToken) {
        return headerToken;
    }
    // Check body for form submissions
    const bodyToken = req.body?._csrf || req.body?.csrfToken;
    if (bodyToken) {
        return bodyToken;
    }
    // Check query params (least preferred)
    const queryToken = req.query?._csrf || req.query?.csrfToken;
    return queryToken;
}
/**
 * Hash token for logging (never log raw tokens)
 */
function hashToken(token) {
    return createHash("sha256").update(token).digest("hex").substring(0, 8);
}
/**
 * Validate CSRF token timing and rotation needs
 */
export function shouldRotateToken(token) {
    const metadata = tokenMetadata.get(token);
    if (!metadata) {
        return true; // Unknown token should be rotated
    }
    const now = Date.now();
    const age = now - metadata.createdAt;
    const timeSinceLastUse = now - metadata.lastUsedAt;
    // Rotate if token is old or hasn't been used recently
    return (age > CSRF_TOKEN_ROTATION_INTERVAL || timeSinceLastUse > CSRF_TOKEN_MAX_AGE);
}
/**
 * Update token metadata
 */
export function updateTokenMetadata(token, userId) {
    const existing = tokenMetadata.get(token);
    if (existing) {
        existing.lastUsedAt = Date.now();
        if (userId) {
            existing.userId = userId;
        }
    }
    else {
        tokenMetadata.set(token, {
            createdAt: Date.now(),
            lastUsedAt: Date.now(),
            rotationCount: 0,
            userId,
        });
    }
    // Clean up old tokens periodically
    if (Math.random() < 0.01) {
        // 1% chance
        cleanupOldTokens();
    }
}
/**
 * Clean up expired token metadata
 */
function cleanupOldTokens() {
    const now = Date.now();
    const expiredTokens = [];
    for (const [token, metadata] of tokenMetadata.entries()) {
        if (now - metadata.lastUsedAt > CSRF_TOKEN_MAX_AGE) {
            expiredTokens.push(token);
        }
    }
    for (const token of expiredTokens) {
        tokenMetadata.delete(token);
    }
    if (expiredTokens?.length || 0 > 0) {
        logger.debug("Cleaned up expired CSRF tokens", "CSRF", {
            count: expiredTokens?.length || 0,
        });
    }
}
/**
 * Enhanced CSRF validation with detailed error reporting
 */
export function validateCSRFToken(requestToken, storedToken, options = {}) {
    // Both tokens must exist
    if (!requestToken || !storedToken) {
        return {
            valid: false,
            reason: !requestToken ? "Missing request token" : "Missing stored token",
        };
    }
    // Tokens must match exactly
    if (requestToken !== storedToken) {
        logger.warn("CSRF token mismatch", "SECURITY", {
            requestTokenHash: hashToken(requestToken),
            storedTokenHash: hashToken(storedToken),
            ...options,
        });
        return {
            valid: false,
            reason: "Token mismatch",
        };
    }
    // Update metadata and check rotation
    updateTokenMetadata(storedToken, options.userId);
    const shouldRotate = shouldRotateToken(storedToken);
    return {
        valid: true,
        shouldRotate,
    };
}
/**
 * Create enhanced CSRF protection middleware
 */
export function createEnhancedCSRFProtection(options = {}) {
    const { skipPaths = [], customHeader = CSRF_TOKEN_HEADER, enableAutoRotation = true, } = options;
    return async (opts) => {
        const { ctx, next, type, path } = opts;
        // Skip CSRF check for safe methods
        if (type && ["query", "subscription"].includes(type)) {
            return next();
        }
        // Skip specific paths if configured
        if (path && skipPaths.includes(path)) {
            logger.debug("Skipping CSRF check for path", "CSRF", { path });
            return next();
        }
        // Get tokens
        const requestToken = getRequestCSRFToken(ctx.req);
        const storedToken = getStoredCSRFToken(ctx.req);
        // Validate tokens
        const validation = validateCSRFToken(requestToken, storedToken, {
            userId: ctx.user?.id,
            requestId: ctx.requestId,
            path,
        });
        if (!validation.valid) {
            logger.warn("CSRF validation failed", "SECURITY", {
                reason: validation.reason,
                userId: ctx.user?.id,
                requestId: ctx.requestId,
                path,
                ip: ctx?.req?.ip,
                userAgent: ctx?.req?.headers["user-agent"],
            });
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Invalid CSRF token",
                cause: validation.reason,
            });
        }
        // Handle token rotation if needed
        if (enableAutoRotation && validation.shouldRotate) {
            const newToken = generateCSRFToken();
            setCSRFCookie(ctx.res, newToken, true);
            // Store in session if available
            if (ctx.req.session) {
                ctx.req.session[CSRF_SESSION_KEY] = newToken;
            }
            // Update metadata for new token
            const metadata = tokenMetadata.get(storedToken);
            if (metadata) {
                tokenMetadata.set(newToken, {
                    ...metadata,
                    createdAt: Date.now(),
                    rotationCount: metadata.rotationCount + 1,
                });
                tokenMetadata.delete(storedToken);
            }
            logger.info("CSRF token rotated", "SECURITY", {
                oldTokenHash: hashToken(storedToken),
                newTokenHash: hashToken(newToken),
                rotationCount: metadata?.rotationCount || 0,
                userId: ctx.user?.id,
            });
            // Add new token to context for client response
            ctx.csrfToken = newToken;
        }
        // Add current token to context
        if (!ctx.csrfToken) {
            ctx.csrfToken = storedToken;
        }
        return next();
    };
}
/**
 * Middleware to ensure CSRF token exists (for queries that need to return it)
 */
export function ensureCSRFToken() {
    return async (opts) => {
        const { ctx, next } = opts;
        let token = getStoredCSRFToken(ctx.req);
        // Generate new token if none exists
        if (!token) {
            token = generateCSRFToken();
            setCSRFCookie(ctx.res, token, true);
            // Store in session if available
            if (ctx.req.session) {
                ctx.req.session[CSRF_SESSION_KEY] = token;
            }
            logger.info("Generated new CSRF token", "SECURITY", {
                tokenHash: hashToken(token),
                userId: ctx.user?.id,
                requestId: ctx.requestId,
            });
        }
        // Add token to context
        ctx.csrfToken = token;
        return next();
    };
}
/**
 * Get CSRF token stats for monitoring
 */
export function getCSRFStats() {
    const now = Date.now();
    const stats = {
        totalTokens: tokenMetadata.size,
        activeTokens: 0,
        expiredTokens: 0,
        averageRotationCount: 0,
        tokensByUser: new Map(),
    };
    let totalRotations = 0;
    for (const [token, metadata] of tokenMetadata.entries()) {
        if (now - metadata.lastUsedAt <= CSRF_TOKEN_MAX_AGE) {
            stats.activeTokens++;
        }
        else {
            stats.expiredTokens++;
        }
        totalRotations += metadata.rotationCount;
        if (metadata.userId) {
            const count = stats?.tokensByUser?.get(metadata.userId) || 0;
            stats?.tokensByUser?.set(metadata.userId, count + 1);
        }
    }
    stats.averageRotationCount =
        stats.totalTokens > 0 ? totalRotations / stats.totalTokens : 0;
    return stats;
}
