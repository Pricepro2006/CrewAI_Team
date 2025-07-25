/**
 * User Repository - Handles all user-related database operations
 */

import Database from 'better-sqlite3';
import { BaseRepository } from './BaseRepository';
import type { BaseEntity } from './BaseRepository';
import { logger } from '../../utils/logger';

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  department?: string;
  status: 'active' | 'inactive' | 'suspended';
  permissions?: string; // JSON string
  last_login_at?: string;
  password_hash?: string;
  salt?: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  role?: User['role'];
  department?: string;
  status?: User['status'];
  permissions?: string[];
  password_hash?: string;
  salt?: string;
}

export class UserRepository extends BaseRepository<User> {
  constructor(db: Database.Database) {
    super(db, 'users');
  }

  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }

  /**
   * Find users by role
   */
  async findByRole(role: User['role']): Promise<User[]> {
    return this.findAll({ where: { role } });
  }

  /**
   * Find users by department
   */
  async findByDepartment(department: string): Promise<User[]> {
    return this.findAll({ where: { department } });
  }

  /**
   * Find active users
   */
  async findActiveUsers(): Promise<User[]> {
    return this.findAll({ where: { status: 'active' } });
  }

  /**
   * Create a new user with validation
   */
  async createUser(userData: CreateUserData): Promise<User> {
    // Validate email uniqueness
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error(`User with email ${userData.email} already exists`);
    }

    // Prepare user data
    const userToCreate = {
      ...userData,
      role: userData.role || 'user' as User['role'],
      status: userData.status || 'active' as User['status'],
      permissions: userData.permissions ? JSON.stringify(userData.permissions) : null
    };

    return this.create(userToCreate as Omit<User, 'id' | 'created_at' | 'updated_at'>);
  }

  /**
   * Update user with validation
   */
  async updateUser(id: string, userData: Partial<CreateUserData>): Promise<User | null> {
    // If updating email, check uniqueness
    if (userData.email) {
      const existingUser = await this.findByEmail(userData.email);
      if (existingUser && existingUser.id !== id) {
        throw new Error(`User with email ${userData.email} already exists`);
      }
    }

    const updateData = {
      ...userData,
      permissions: userData.permissions ? JSON.stringify(userData.permissions) : undefined
    };

    return this.update(id, updateData);
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.update(id, { last_login_at: now });
  }

  /**
   * Change user status
   */
  async changeUserStatus(id: string, status: User['status']): Promise<User | null> {
    return this.update(id, { status });
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(id: string): Promise<string[]> {
    const user = await this.findById(id);
    if (!user || !user.permissions) {
      return [];
    }

    try {
      return JSON.parse(user.permissions);
    } catch (error) {
      logger.error(`Failed to parse permissions for user ${id}: ${error}`, 'USER_REPO');
      return [];
    }
  }

  /**
   * Update user permissions
   */
  async updatePermissions(id: string, permissions: string[]): Promise<User | null> {
    return this.update(id, { permissions: JSON.stringify(permissions) });
  }

  /**
   * Search users by name or email
   */
  async searchUsers(searchTerm: string, options: { limit?: number; offset?: number } = {}): Promise<User[]> {
    return this.search(searchTerm, ['name', 'email'], options);
  }

  /**
   * Get user statistics by role
   */
  async getUserStatsByRole(): Promise<Record<string, number>> {
    const query = `
      SELECT role, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = 'active'
      GROUP BY role
    `;

    const results = this.executeQuery<Array<{ role: string; count: number }>>(query);
    const stats: Record<string, number> = {};

    for (const result of results) {
      stats[result.role] = result.count;
    }

    return stats;
  }

  /**
   * Get user statistics by department
   */
  async getUserStatsByDepartment(): Promise<Record<string, number>> {
    const query = `
      SELECT department, COUNT(*) as count
      FROM ${this.tableName}
      WHERE status = 'active' AND department IS NOT NULL
      GROUP BY department
    `;

    const results = this.executeQuery<Array<{ department: string; count: number }>>(query);
    const stats: Record<string, number> = {};

    for (const result of results) {
      stats[result.department] = result.count;
    }

    return stats;
  }

  /**
   * Find users who haven't logged in for a specified number of days
   */
  async findInactiveUsers(daysSinceLastLogin: number): Promise<User[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'active'
        AND (last_login_at IS NULL OR date(last_login_at) < date('now', '-${daysSinceLastLogin} days'))
      ORDER BY last_login_at ASC
    `;

    return this.executeQuery<User[]>(query);
  }

  /**
   * Get users assigned to emails
   */
  async getUsersWithEmailAssignments(): Promise<Array<User & { email_count: number }>> {
    const query = `
      SELECT u.*, COUNT(e.id) as email_count
      FROM ${this.tableName} u
      LEFT JOIN emails_enhanced e ON u.id = e.assigned_to
      WHERE u.status = 'active'
      GROUP BY u.id
      ORDER BY email_count DESC
    `;

    return this.executeQuery<Array<User & { email_count: number }>>(query);
  }

  /**
   * Soft delete user (change status to inactive)
   */
  async softDeleteUser(id: string): Promise<boolean> {
    const result = await this.update(id, { status: 'inactive' });
    return result !== null;
  }
}