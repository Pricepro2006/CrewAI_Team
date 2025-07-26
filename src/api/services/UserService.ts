import { v4 as uuidv4 } from "uuid";
import Database from 'better-sqlite3';
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import * as crypto from "crypto";
import appConfig from "../../config/app.config";
import { logger } from "../../utils/logger";

export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash?: string; // Never expose this
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  MODERATOR = "moderator",
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  role?: UserRole;
}

export interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class UserService {
  private db: Database.Database;
  private readonly saltRounds = 10;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn = "1h";
  private readonly refreshTokenExpiresIn = "7d";

  constructor() {
    this.db = new Database(appConfig.database.path);
    
    // Initialize JWT secret with enhanced security validation
    this.jwtSecret = this.initializeJwtSecret();
    
    this.initializeDatabase();
  }

  private initializeJwtSecret(): string {
    const nodeEnv = process.env["NODE_ENV"] || "development";
    const envJwtSecret = process.env["JWT_SECRET"];
    
    // Define insecure patterns that should never be used
    const insecurePatterns = [
      "dev-secret-key-change-in-production",
      "secret",
      "password",
      "123456",
      "default",
      "changeme",
      "your-jwt-secret-here"
    ];
    
    // Check if JWT_SECRET is set
    if (!envJwtSecret) {
      const errorMsg = "JWT_SECRET environment variable is not set";
      
      if (nodeEnv === "production") {
        // In production, fail immediately
        logger.error(errorMsg, "SECURITY", { 
          severity: "CRITICAL",
          recommendation: "Set JWT_SECRET to a secure random string of at least 32 characters"
        });
        throw new Error(`${errorMsg}. Application cannot start in production without a secure JWT secret.`);
      } else {
        // In development, generate a temporary secure secret and warn
        const tempSecret = crypto.randomBytes(32).toString('hex');
        logger.warn(
          `${errorMsg}. Using temporary generated secret for development ONLY.`,
          "SECURITY",
          {
            environment: nodeEnv,
            recommendation: "Set JWT_SECRET in your .env file for consistent development"
          }
        );
        return tempSecret;
      }
    }
    
    // Validate JWT secret strength
    const jwtSecretLower = envJwtSecret.toLowerCase();
    
    // Check against insecure patterns
    const hasInsecurePattern = insecurePatterns.some(pattern => 
      jwtSecretLower.includes(pattern.toLowerCase())
    );
    
    if (hasInsecurePattern) {
      const errorMsg = "JWT_SECRET contains insecure or default values";
      logger.error(errorMsg, "SECURITY", {
        severity: "CRITICAL",
        environment: nodeEnv,
        recommendation: "Replace with a cryptographically secure random string"
      });
      
      if (nodeEnv === "production") {
        throw new Error(`${errorMsg}. Application cannot start with an insecure JWT secret.`);
      }
    }
    
    // Check minimum length requirement
    if (envJwtSecret.length < 32) {
      const errorMsg = `JWT_SECRET is too short (${envJwtSecret.length} characters). Minimum 32 characters required.`;
      logger.error(errorMsg, "SECURITY", {
        severity: "HIGH",
        environment: nodeEnv,
        currentLength: envJwtSecret.length,
        requiredLength: 32
      });
      
      if (nodeEnv === "production") {
        throw new Error(errorMsg);
      }
    }
    
    // Check for sufficient entropy (basic check)
    const uniqueChars = new Set(envJwtSecret).size;
    if (uniqueChars < 10) {
      const errorMsg = "JWT_SECRET has insufficient character diversity";
      logger.warn(errorMsg, "SECURITY", {
        severity: "MEDIUM",
        environment: nodeEnv,
        uniqueCharacters: uniqueChars,
        recommendation: "Use a mix of uppercase, lowercase, numbers, and special characters"
      });
      
      if (nodeEnv === "production" && uniqueChars < 8) {
        throw new Error(`${errorMsg}. Production requires higher entropy.`);
      }
    }
    
    // Log successful initialization (without exposing the secret)
    logger.info("JWT secret initialized successfully", "SECURITY", {
      environment: nodeEnv,
      secretLength: envJwtSecret.length,
      entropyCheck: uniqueChars >= 10 ? "PASS" : "WARN"
    });
    
    return envJwtSecret;
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `);
  }

  async create(input: CreateUserInput): Promise<User> {
    // Validate input
    if (!input.email || !input.username || !input.password) {
      throw new Error("Email, username, and password are required");
    }

    // Check if user already exists
    const existingUser = this.db
      .prepare(
        `
      SELECT id FROM users WHERE email = ? OR username = ?
    `,
      )
      .get(input.email, input.username);

    if (existingUser) {
      throw new Error("User with this email or username already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(input.password, this.saltRounds);

    // Create user
    const id = uuidv4();
    const now = new Date().toISOString();
    const role = input.role || UserRole.USER;

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, input.email, input.username, passwordHash, role, now, now);

    logger.info("User created", "AUTH", {
      userId: id,
      email: input.email,
      username: input.username,
    });

    return {
      id,
      email: input.email,
      username: input.username,
      role,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  async login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }> {
    // Find user by email or username
    const user = this.db
      .prepare(
        `
      SELECT * FROM users 
      WHERE (email = ? OR username = ?) AND is_active = 1
    `,
      )
      .get(input.emailOrUsername, input.emailOrUsername) as any;

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const passwordValid = await bcrypt.compare(
      input.password,
      user.password_hash,
    );
    if (!passwordValid) {
      throw new Error("Invalid credentials");
    }

    // Update last login
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE users SET last_login_at = ? WHERE id = ?
    `,
      )
      .run(now, user.id);

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    logger.info("User logged in", "AUTH", {
      userId: user.id,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        lastLoginAt: now,
      },
      tokens,
    };
  }

  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return payload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token JWT structure and signature
    let payload: JWTPayload;
    try {
      payload = jwt.verify(refreshToken, this.jwtSecret) as JWTPayload;
    } catch (error) {
      logger.warn("Invalid refresh token JWT verification failed", "SECURITY", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Invalid or expired refresh token");
    }

    // Get all valid refresh tokens for the user
    const storedTokens = this.db
      .prepare(
        `
      SELECT * FROM refresh_tokens 
      WHERE user_id = ? AND expires_at > datetime('now') AND revoked_at IS NULL
    `,
      )
      .all(payload.userId) as Array<{ 
        id: string; 
        user_id: string; 
        token_hash: string; 
        expires_at: string; 
        created_at: string; 
        revoked_at: string | null 
      }>;

    if (!storedTokens || storedTokens.length === 0) {
      logger.warn("No valid refresh tokens found for user", "SECURITY", {
        userId: payload.userId,
      });
      throw new Error("Invalid refresh token");
    }

    // CRITICAL FIX: Actually verify the token hash matches a stored token
    let matchingToken: typeof storedTokens[0] | null = null;
    for (const storedToken of storedTokens) {
      const isMatch = await bcrypt.compare(refreshToken, storedToken.token_hash);
      if (isMatch) {
        matchingToken = storedToken;
        break;
      }
    }

    if (!matchingToken) {
      logger.error("Refresh token hash verification failed", "SECURITY", {
        userId: payload.userId,
        severity: "HIGH",
        message: "Attempted token refresh with invalid token hash",
      });
      throw new Error("Invalid refresh token");
    }

    // Get user
    const user = await this.getById(payload.userId);
    if (!user || !user.isActive) {
      logger.warn("Refresh token used for inactive or non-existent user", "SECURITY", {
        userId: payload.userId,
      });
      throw new Error("User not found or inactive");
    }

    // CRITICAL: Immediately revoke the used refresh token to ensure one-time use
    const revokeResult = this.db
      .prepare(
        `
      UPDATE refresh_tokens 
      SET revoked_at = ? 
      WHERE id = ? AND revoked_at IS NULL
    `,
      )
      .run(new Date().toISOString(), matchingToken.id);

    // Verify the token was actually revoked (prevent race conditions)
    if (revokeResult.changes === 0) {
      logger.error("Refresh token already used - possible replay attack", "SECURITY", {
        userId: payload.userId,
        tokenId: matchingToken.id,
        severity: "CRITICAL",
      });
      throw new Error("Invalid refresh token");
    }

    // Generate new tokens
    const newTokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Store new refresh token
    await this.storeRefreshToken(user.id, newTokens.refreshToken);

    logger.info("Tokens refreshed successfully", "AUTH", {
      userId: user.id,
      oldTokenId: matchingToken.id,
    });

    return newTokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Get all valid refresh tokens for the user
      const storedTokens = this.db
        .prepare(
          `
        SELECT id, token_hash FROM refresh_tokens 
        WHERE user_id = ? AND revoked_at IS NULL
      `,
        )
        .all(userId) as Array<{ id: string; token_hash: string }>;

      // Find matching token by comparing hashes
      let tokenToRevoke: string | null = null;
      for (const storedToken of storedTokens) {
        const isMatch = await bcrypt.compare(refreshToken, storedToken.token_hash);
        if (isMatch) {
          tokenToRevoke = storedToken.id;
          break;
        }
      }

      if (tokenToRevoke) {
        // Revoke the specific refresh token
        this.db
          .prepare(
            `
          UPDATE refresh_tokens 
          SET revoked_at = ? 
          WHERE id = ? AND revoked_at IS NULL
        `,
          )
          .run(new Date().toISOString(), tokenToRevoke);
        
        logger.info("Specific refresh token revoked", "AUTH", { 
          userId, 
          tokenId: tokenToRevoke 
        });
      } else {
        logger.warn("Logout attempted with invalid refresh token", "SECURITY", {
          userId,
          message: "Token not found or already revoked",
        });
      }
    } else {
      // Revoke all refresh tokens for user
      const result = this.db
        .prepare(
          `
        UPDATE refresh_tokens 
        SET revoked_at = ? 
        WHERE user_id = ? AND revoked_at IS NULL
      `,
        )
        .run(new Date().toISOString(), userId);

      logger.info("All refresh tokens revoked for user", "AUTH", { 
        userId,
        tokensRevoked: result.changes,
      });
    }
  }

  async getById(id: string): Promise<User | null> {
    const user = this.db
      .prepare(
        `
      SELECT * FROM users WHERE id = ?
    `,
      )
      .get(id) as any;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.is_active === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };
  }

  async getByEmail(email: string): Promise<User | null> {
    const user = this.db
      .prepare(
        `
      SELECT * FROM users WHERE email = ?
    `,
      )
      .get(email) as any;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.is_active === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    };
  }

  async updateRole(userId: string, role: UserRole): Promise<void> {
    const result = this.db
      .prepare(
        `
      UPDATE users SET role = ?, updated_at = ? WHERE id = ?
    `,
      )
      .run(role, new Date().toISOString(), userId);

    if (result.changes === 0) {
      throw new Error("User not found");
    }

    logger.info("User role updated", "AUTH", { userId, role });
  }

  async deactivate(userId: string): Promise<void> {
    const result = this.db
      .prepare(
        `
      UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?
    `,
      )
      .run(new Date().toISOString(), userId);

    if (result.changes === 0) {
      throw new Error("User not found");
    }

    // Revoke all refresh tokens
    await this.logout(userId);

    logger.info("User deactivated", "AUTH", { userId });
  }

  async reactivate(userId: string): Promise<void> {
    const result = this.db
      .prepare(
        `
      UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?
    `,
      )
      .run(new Date().toISOString(), userId);

    if (result.changes === 0) {
      throw new Error("User not found");
    }

    logger.info("User reactivated", "AUTH", { userId });
  }

  async list(limit: number = 20, offset: number = 0): Promise<User[]> {
    const users = this.db
      .prepare(
        `
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `,
      )
      .all(limit, offset) as any[];

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.is_active === 1,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastLoginAt: user.last_login_at,
    }));
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<string, number>;
    recentSignups: number;
  }> {
    const totalUsers = (
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count FROM users
    `,
        )
        .get() as any
    ).count;

    const activeUsers = (
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count FROM users WHERE is_active = 1
    `,
        )
        .get() as any
    ).count;

    const roleStats = this.db
      .prepare(
        `
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `,
      )
      .all() as any[];

    const usersByRole: Record<string, number> = {};
    roleStats.forEach((stat) => {
      usersByRole[stat.role] = stat.count;
    });

    const recentSignups = (
      this.db
        .prepare(
          `
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= datetime('now', '-7 days')
    `,
        )
        .get() as any
    ).count;

    return {
      totalUsers,
      activeUsers,
      usersByRole,
      recentSignups,
    };
  }

  private generateTokens(payload: JWTPayload): AuthTokens {
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour in seconds
    };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    // Use higher bcrypt cost factor (10) for refresh tokens for better security
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const id = uuidv4();
    const now = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(); // 7 days

    try {
      this.db
        .prepare(
          `
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        )
        .run(id, userId, tokenHash, expiresAt, now);
      
      logger.debug("Refresh token stored", "AUTH", {
        userId,
        tokenId: id,
        expiresAt,
      });
    } catch (error) {
      logger.error("Failed to store refresh token", "SECURITY", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to store refresh token");
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    const result = this.db
      .prepare(
        `
      DELETE FROM refresh_tokens 
      WHERE expires_at < datetime('now') OR revoked_at IS NOT NULL
    `,
      )
      .run();

    if (result.changes > 0) {
      logger.info("Cleaned up expired tokens", "AUTH", {
        count: result.changes,
      });
    }
  }
}
