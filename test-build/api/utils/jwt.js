import jwt from "jsonwebtoken";
import crypto from "crypto";
import appConfig from "../../config/app.config.js";
/**
 * JWT Utilities for Authentication
 * Provides functions for creating, verifying, and managing JWT tokens
 */
export class JWTError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "JWTError";
    }
}
export class JWTManager {
    secret;
    accessTokenExpiry;
    refreshTokenExpiry;
    constructor() {
        const jwtSecret = appConfig?.security?.jwtSecret;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET must be configured");
        }
        this.secret = jwtSecret;
        this.accessTokenExpiry =
            process.env.JWT_ACCESS_EXPIRY || "15m";
        this.refreshTokenExpiry =
            process.env.JWT_REFRESH_EXPIRY || "7d";
        if (this.secret === "dev-secret-key-change-in-production") {
            if (process.env.NODE_ENV === "production") {
                throw new Error("JWT_SECRET must be set in production environment");
            }
            console.warn("⚠️  Using default JWT secret. Set JWT_SECRET in production!");
        }
    }
    /**
     * Generate a secure access token for a user
     */
    generateAccessToken(payload) {
        // Don't include exp field when using expiresIn option
        const jwtPayload = {
            sub: payload.userId,
            email: payload.email,
            username: payload.username,
            role: payload.role,
            iat: Math.floor(Date.now() / 1000),
            jti: this.generateJTI(),
        };
        const signOptions = {
            expiresIn: this.accessTokenExpiry,
            issuer: "crewai-team",
            audience: "crewai-team-client",
        };
        return jwt.sign(jwtPayload, this.secret, signOptions);
    }
    /**
     * Generate a refresh token
     */
    generateRefreshToken(userId, tokenId) {
        // Don't include exp field when using expiresIn option
        const payload = {
            sub: userId,
            tokenId,
            iat: Math.floor(Date.now() / 1000),
        };
        const signOptions = {
            expiresIn: this.refreshTokenExpiry,
            issuer: "crewai-team",
            audience: "crewai-team-refresh",
        };
        return jwt.sign(payload, this.secret, signOptions);
    }
    /**
     * Generate both access and refresh tokens
     */
    generateTokenPair(user, refreshTokenId) {
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user.userId, refreshTokenId);
        // Calculate expiry in seconds
        const decoded = jwt.decode(accessToken);
        const expiresIn = decoded.exp - decoded.iat;
        return {
            accessToken,
            refreshToken,
            expiresIn,
        };
    }
    /**
     * Verify and decode an access token
     */
    verifyAccessToken(token) {
        try {
            const decoded = jwt.verify(token, this.secret, {
                issuer: "crewai-team",
                audience: "crewai-team-client",
            });
            // Validate required fields
            if (!decoded.sub ||
                !decoded.email ||
                !decoded.username ||
                !decoded.role) {
                throw new JWTError("Invalid token payload", "INVALID_PAYLOAD");
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                if (error instanceof jwt.TokenExpiredError) {
                    throw new JWTError("Token has expired", "TOKEN_EXPIRED");
                }
                if (error instanceof jwt.NotBeforeError) {
                    throw new JWTError("Token not active yet", "TOKEN_NOT_ACTIVE");
                }
                throw new JWTError("Invalid token", "INVALID_TOKEN");
            }
            throw error;
        }
    }
    /**
     * Verify and decode a refresh token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.secret, {
                issuer: "crewai-team",
                audience: "crewai-team-refresh",
            });
            // Validate required fields
            if (!decoded.sub || !decoded.tokenId) {
                throw new JWTError("Invalid refresh token payload", "INVALID_PAYLOAD");
            }
            return decoded;
        }
        catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                if (error instanceof jwt.TokenExpiredError) {
                    throw new JWTError("Refresh token has expired", "REFRESH_TOKEN_EXPIRED");
                }
                throw new JWTError("Invalid refresh token", "INVALID_REFRESH_TOKEN");
            }
            throw error;
        }
    }
    /**
     * Decode token without verification (for debugging)
     */
    decodeToken(token) {
        return jwt.decode(token);
    }
    /**
     * Extract token from Authorization header
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader)
            return null;
        const parts = authHeader.split(" ");
        if (parts?.length || 0 !== 2 || parts[0] !== "Bearer") {
            return null;
        }
        return parts[1] || null;
    }
    /**
     * Check if token is expired (without verification)
     */
    isTokenExpired(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp)
                return true;
            return Date.now() >= decoded.exp * 1000;
        }
        catch {
            return true;
        }
    }
    /**
     * Get token expiration time
     */
    getTokenExpiration(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp)
                return null;
            return new Date(decoded.exp * 1000);
        }
        catch {
            return null;
        }
    }
    /**
     * Generate a unique JWT ID
     */
    generateJTI() {
        return crypto.randomBytes(16).toString("hex");
    }
    /**
     * Generate a secure random token (for password reset, email verification, etc.)
     */
    generateSecureToken() {
        return crypto.randomBytes(32).toString("hex");
    }
    /**
     * Hash a token for secure storage
     */
    hashToken(token) {
        return crypto.createHash("sha256").update(token).digest("hex");
    }
    /**
     * Verify a hashed token
     */
    verifyHashedToken(token, hash) {
        const tokenHash = this.hashToken(token);
        return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
    }
}
// Export singleton instance
export const jwtManager = new JWTManager();
