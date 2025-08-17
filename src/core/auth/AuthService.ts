import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import crypto from "crypto";
import { logger } from "../../utils/logger.js";
import { TRPCError } from "@trpc/server";

interface User {
  id: number;
  email: string;
  password_hash: string;
  role: "admin" | "user" | "viewer";
  created_at: string;
  last_login?: string;
}

interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  sessionId: string;
}

interface AuthResponse {
  user: Omit<User, "password_hash">;
  token: string;
  expiresIn: number;
}

export class AuthService {
  private db: Database.Database;
  private jwtSecret: string;
  private tokenExpiry: string = "24h";
  private refreshTokenExpiry: string = "7d";
  
  // Rate limiting for authentication attempts
  private loginAttempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(databasePath: string = "./data/app.db") {
    this.db = new Database(databasePath);
    
    // JWT_SECRET is required in all environments for security
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "YOUR_JWT_SECRET_HERE") {
      logger.error("JWT_SECRET environment variable is not set or using placeholder!", "AUTH");
      throw new Error("JWT_SECRET must be set in environment variables. Generate one using: openssl rand -base64 64");
    }
    
    this.jwtSecret = process.env.JWT_SECRET;
    
    // Additional validation for production
    if (process.env.NODE_ENV === "production") {
      // Ensure JWT secret is strong enough
      if (this.jwtSecret.length < 32) {
        logger.error("JWT_SECRET is too weak for production!", "AUTH");
        throw new Error("JWT_SECRET must be at least 32 characters in production");
      }
    }

    this.initializeUserTable();
  }

  private initializeUserTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);
  }

  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    role: "admin" | "user" | "viewer" = "user",
  ): Promise<AuthResponse> {
    try {
      // Validate email
      if (!this.isValidEmail(email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid email format",
        });
      }

      // Validate password strength
      if (!this.isStrongPassword(password)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
        });
      }

      // Check if user already exists
      const existingUser = this.db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists",
        });
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Insert user
      const stmt = this.db.prepare(`
        INSERT INTO users (email, password_hash, role)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(email, passwordHash, role);
      const userId = result.lastInsertRowid as number;

      logger.info("New user registered", "AUTH", { userId, email, role });

      // Generate token
      const token = this.generateToken({
        userId,
        email,
        role,
        sessionId: this.generateSessionId(),
      });

      return {
        user: {
          id: userId,
          email,
          role,
          created_at: new Date().toISOString(),
        },
        token,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
      };
    } catch (error) {
      logger.error("Registration failed", "AUTH", { error, email });
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Check rate limiting
      const attempts = this.loginAttempts.get(email);
      if (attempts) {
        const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
        
        // Check if account is locked out
        if (attempts.count >= this.MAX_LOGIN_ATTEMPTS && 
            timeSinceLastAttempt < this.LOCKOUT_DURATION) {
          const remainingLockout = Math.ceil((this.LOCKOUT_DURATION - timeSinceLastAttempt) / 60000);
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Account locked due to too many failed attempts. Try again in ${remainingLockout} minutes.`,
          });
        }
        
        // Reset attempts if lockout period has expired
        if (timeSinceLastAttempt >= this.LOCKOUT_DURATION) {
          this.loginAttempts.delete(email);
        }
      }
      
      // Get user
      const user = this.db
        .prepare("SELECT * FROM users WHERE email = ? AND is_active = 1")
        .get(email) as User | undefined;

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        // Record failed attempt
        const currentAttempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: 0 };
        this.loginAttempts.set(email, {
          count: currentAttempts.count + 1,
          lastAttempt: Date.now()
        });
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      }
      
      // Clear login attempts on successful login
      this.loginAttempts.delete(email);

      // Update last login
      this.db
        .prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?")
        .run(user.id);

      logger.info("User logged in", "AUTH", { userId: user.id, email });

      // Generate token
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: this.generateSessionId(),
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          last_login: new Date().toISOString(),
        },
        token,
        expiresIn: 24 * 60 * 60,
      };
    } catch (error) {
      logger.error("Login failed", "AUTH", { error, email });
      throw error;
    }
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error("Token verification failed", "AUTH", { error });
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry,
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, type: "refresh" }, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiry,
    } as jwt.SignOptions);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string,
  ): Promise<{ token: string; expiresIn: number }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        this.jwtSecret,
      ) as TokenPayload & { type: string };

      if (decoded.type !== "refresh") {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid refresh token",
        });
      }

      // Check if user still exists and is active
      const user = this.db
        .prepare("SELECT * FROM users WHERE id = ? AND is_active = 1")
        .get(decoded.userId) as User | undefined;

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found or inactive",
        });
      }

      // Generate new access token
      const newToken = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: decoded.sessionId,
      });

      logger.info("Token refreshed", "AUTH", { userId: user.id });

      return {
        token: newToken,
        expiresIn: 24 * 60 * 60,
      };
    } catch (error) {
      logger.error("Token refresh failed", "AUTH", { error });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  getUserById(userId: number): Omit<User, "password_hash"> | null {
    const user = this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId) as User | undefined;

    if (!user) {
      return null;
    }

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(userId) as User | undefined;

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Current password is incorrect",
      });
    }

    // Validate new password
    if (!this.isStrongPassword(newPassword)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "New password does not meet requirements",
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    this.db
      .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .run(passwordHash, userId);

    logger.info("Password updated", "AUTH", { userId });
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  private isStrongPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  /**
   * Generate cryptographically secure session ID
   */
  private generateSessionId(): string {
    // Use crypto.randomBytes for cryptographically secure random values
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `session_${Date.now()}_${randomBytes}`;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db?.close();
  }
}

// Export singleton instance
export const authService = new AuthService();
