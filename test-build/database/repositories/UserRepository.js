/**
 * User Repository - Handles all user-related database operations
 */
import { BaseRepository } from "./BaseRepository.js";
import { logger } from "../../utils/logger.js";
export class UserRepository extends BaseRepository {
    constructor(db) {
        super(db, "users");
    }
    /**
     * Find user by email address
     */
    async findByEmail(email) {
        return this.findOne({ email });
    }
    /**
     * Find users by role
     */
    async findByRole(role) {
        return this.findAll({ where: { role } });
    }
    /**
     * Find users by department
     */
    async findByDepartment(department) {
        return this.findAll({ where: { department } });
    }
    /**
     * Find active users
     */
    async findActiveUsers() {
        return this.findAll({ where: { status: "active" } });
    }
    /**
     * Create a new user with validation
     */
    async createUser(userData) {
        // Validate email uniqueness
        const existingUser = await this.findByEmail(userData.email);
        if (existingUser) {
            throw new Error(`User with email ${userData.email} already exists`);
        }
        // Prepare user data
        const userToCreate = {
            ...userData,
            role: userData.role || "user",
            status: userData.status || "active",
            permissions: userData.permissions
                ? JSON.stringify(userData.permissions)
                : null,
        };
        return this.create(userToCreate);
    }
    /**
     * Update user with validation
     */
    async updateUser(id, userData) {
        // If updating email, check uniqueness
        if (userData.email) {
            const existingUser = await this.findByEmail(userData.email);
            if (existingUser && existingUser.id !== id) {
                throw new Error(`User with email ${userData.email} already exists`);
            }
        }
        const updateData = {
            ...userData,
            permissions: userData.permissions
                ? JSON.stringify(userData.permissions)
                : undefined,
        };
        return this.update(id, updateData);
    }
    /**
     * Update user's last login timestamp
     */
    async updateLastLogin(id) {
        const now = new Date().toISOString();
        await this.update(id, { last_login_at: now });
    }
    /**
     * Change user status
     */
    async changeUserStatus(id, status) {
        return this.update(id, { status });
    }
    /**
     * Get user permissions
     */
    async getUserPermissions(id) {
        const user = await this.findById(id);
        if (!user || !user.permissions) {
            return [];
        }
        try {
            return JSON.parse(user.permissions);
        }
        catch (error) {
            logger.error(`Failed to parse permissions for user ${id}: ${error}`, "USER_REPO");
            return [];
        }
    }
    /**
     * Update user permissions
     */
    async updatePermissions(id, permissions) {
        return this.update(id, { permissions: JSON.stringify(permissions) });
    }
    /**
     * Search users by name or email
     */
    async searchUsers(searchTerm, options = {}) {
        return this.search(searchTerm, ["name", "email"], options);
    }
    /**
     * Get user statistics by role
     */
    async getUserStatsByRole() {
        const query = `
      SELECT role, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = 'active'
      GROUP BY role
    `;
        const results = this.executeQuery(query);
        const stats = {};
        for (const result of results) {
            stats[result.role] = result.count;
        }
        return stats;
    }
    /**
     * Get user statistics by department
     */
    async getUserStatsByDepartment() {
        const query = `
      SELECT department, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = 'active' AND department IS NOT NULL
      GROUP BY department
    `;
        const results = this.executeQuery(query);
        const stats = {};
        for (const result of results) {
            stats[result.department] = result.count;
        }
        return stats;
    }
    /**
     * Find users who haven't logged in for a specified number of days
     */
    async findInactiveUsers(daysSinceLastLogin) {
        // Validate input to ensure it's a positive integer
        if (!Number.isInteger(daysSinceLastLogin) || daysSinceLastLogin < 0) {
            throw new Error("daysSinceLastLogin must be a non-negative integer");
        }
        const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'active'
        AND (last_login_at IS NULL OR date(last_login_at) < date('now', ? || ' days'))
      ORDER BY last_login_at ASC
    `;
        return this.executeQuery(query, [`-${daysSinceLastLogin}`]);
    }
    /**
     * Get users assigned to emails
     */
    async getUsersWithEmailAssignments() {
        const query = `
      SELECT u.*, COUNT(e.id) as email_count
      FROM ${this.tableName} u
      LEFT JOIN emails_enhanced e ON u.id = e.assigned_to
      WHERE u.status = 'active'
      GROUP BY u.id
      ORDER BY email_count DESC
    `;
        return this.executeQuery(query);
    }
    /**
     * Soft delete user (change status to inactive)
     */
    async softDeleteUser(id) {
        const result = await this.update(id, { status: "inactive" });
        return result !== null;
    }
}
