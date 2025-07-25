import { v4 as uuidv4 } from "uuid";
import Database from 'better-sqlite3';
import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import appConfig from "../../config/app.config";
import { logger } from "../../utils/logger";
export var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
    UserRole["MODERATOR"] = "moderator";
})(UserRole || (UserRole = {}));
export class UserService {
    db;
    saltRounds = 10;
    jwtSecret;
    jwtExpiresIn = "1h";
    refreshTokenExpiresIn = "7d";
    constructor() {
        this.db = new Database(appConfig.database.path);
        this.jwtSecret =
            process.env["JWT_SECRET"] || "dev-secret-key-change-in-production";
        if (this.jwtSecret === "dev-secret-key-change-in-production" &&
            process.env["NODE_ENV"] === "production") {
            throw new Error("JWT_SECRET must be set in production environment");
        }
        this.initializeDatabase();
    }
    initializeDatabase() {
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
    async create(input) {
        // Validate input
        if (!input.email || !input.username || !input.password) {
            throw new Error("Email, username, and password are required");
        }
        // Check if user already exists
        const existingUser = this.db
            .prepare(`
      SELECT id FROM users WHERE email = ? OR username = ?
    `)
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
    async login(input) {
        // Find user by email or username
        const user = this.db
            .prepare(`
      SELECT * FROM users 
      WHERE (email = ? OR username = ?) AND is_active = 1
    `)
            .get(input.emailOrUsername, input.emailOrUsername);
        if (!user) {
            throw new Error("Invalid credentials");
        }
        // Verify password
        const passwordValid = await bcrypt.compare(input.password, user.password_hash);
        if (!passwordValid) {
            throw new Error("Invalid credentials");
        }
        // Update last login
        const now = new Date().toISOString();
        this.db
            .prepare(`
      UPDATE users SET last_login_at = ? WHERE id = ?
    `)
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
    async verifyToken(token) {
        try {
            const payload = jwt.verify(token, this.jwtSecret);
            return payload;
        }
        catch (error) {
            throw new Error("Invalid or expired token");
        }
    }
    async refreshTokens(refreshToken) {
        // Verify refresh token
        let payload;
        try {
            payload = jwt.verify(refreshToken, this.jwtSecret);
        }
        catch (error) {
            throw new Error("Invalid or expired refresh token");
        }
        // Check if refresh token exists and is valid
        const tokenHash = await bcrypt.hash(refreshToken, 5);
        const storedToken = this.db
            .prepare(`
      SELECT * FROM refresh_tokens 
      WHERE user_id = ? AND expires_at > datetime('now') AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `)
            .get(payload.userId);
        if (!storedToken) {
            throw new Error("Invalid refresh token");
        }
        // Get user
        const user = await this.getById(payload.userId);
        if (!user || !user.isActive) {
            throw new Error("User not found or inactive");
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
        // Revoke old refresh token
        this.db
            .prepare(`
      UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?
    `)
            .run(new Date().toISOString(), storedToken.id);
        return newTokens;
    }
    async logout(userId, refreshToken) {
        if (refreshToken) {
            // Revoke specific refresh token
            const tokenHash = await bcrypt.hash(refreshToken, 5);
            this.db
                .prepare(`
        UPDATE refresh_tokens 
        SET revoked_at = ? 
        WHERE user_id = ? AND token_hash = ?
      `)
                .run(new Date().toISOString(), userId, tokenHash);
        }
        else {
            // Revoke all refresh tokens for user
            this.db
                .prepare(`
        UPDATE refresh_tokens 
        SET revoked_at = ? 
        WHERE user_id = ? AND revoked_at IS NULL
      `)
                .run(new Date().toISOString(), userId);
        }
        logger.info("User logged out", "AUTH", { userId });
    }
    async getById(id) {
        const user = this.db
            .prepare(`
      SELECT * FROM users WHERE id = ?
    `)
            .get(id);
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
    async getByEmail(email) {
        const user = this.db
            .prepare(`
      SELECT * FROM users WHERE email = ?
    `)
            .get(email);
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
    async updateRole(userId, role) {
        const result = this.db
            .prepare(`
      UPDATE users SET role = ?, updated_at = ? WHERE id = ?
    `)
            .run(role, new Date().toISOString(), userId);
        if (result.changes === 0) {
            throw new Error("User not found");
        }
        logger.info("User role updated", "AUTH", { userId, role });
    }
    async deactivate(userId) {
        const result = this.db
            .prepare(`
      UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?
    `)
            .run(new Date().toISOString(), userId);
        if (result.changes === 0) {
            throw new Error("User not found");
        }
        // Revoke all refresh tokens
        await this.logout(userId);
        logger.info("User deactivated", "AUTH", { userId });
    }
    async reactivate(userId) {
        const result = this.db
            .prepare(`
      UPDATE users SET is_active = 1, updated_at = ? WHERE id = ?
    `)
            .run(new Date().toISOString(), userId);
        if (result.changes === 0) {
            throw new Error("User not found");
        }
        logger.info("User reactivated", "AUTH", { userId });
    }
    async list(limit = 20, offset = 0) {
        const users = this.db
            .prepare(`
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `)
            .all(limit, offset);
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
    async getUserStats() {
        const totalUsers = this.db
            .prepare(`
      SELECT COUNT(*) as count FROM users
    `)
            .get().count;
        const activeUsers = this.db
            .prepare(`
      SELECT COUNT(*) as count FROM users WHERE is_active = 1
    `)
            .get().count;
        const roleStats = this.db
            .prepare(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `)
            .all();
        const usersByRole = {};
        roleStats.forEach((stat) => {
            usersByRole[stat.role] = stat.count;
        });
        const recentSignups = this.db
            .prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= datetime('now', '-7 days')
    `)
            .get().count;
        return {
            totalUsers,
            activeUsers,
            usersByRole,
            recentSignups,
        };
    }
    generateTokens(payload) {
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
    async storeRefreshToken(userId, refreshToken) {
        const tokenHash = await bcrypt.hash(refreshToken, 5);
        const id = uuidv4();
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        this.db
            .prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
            .run(id, userId, tokenHash, expiresAt, now);
    }
    async cleanupExpiredTokens() {
        const result = this.db
            .prepare(`
      DELETE FROM refresh_tokens 
      WHERE expires_at < datetime('now') OR revoked_at IS NOT NULL
    `)
            .run();
        if (result.changes > 0) {
            logger.info("Cleaned up expired tokens", "AUTH", {
                count: result.changes,
            });
        }
    }
}
//# sourceMappingURL=UserService.js.map