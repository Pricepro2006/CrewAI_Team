#!/usr/bin/env node

/**
 * Grocery Database Administration Script
 * 
 * Provides comprehensive database administration functions including:
 * - User management and access control
 * - Database maintenance (vacuum, analyze, optimize)
 * - High availability and failover procedures
 * - Connection pooling setup
 * - Performance monitoring and alerting
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { performance } from 'perf_hooks';

interface DatabaseUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'user' | 'readonly';
  permissions: string[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface MaintenanceConfig {
  vacuumThreshold: number; // Percentage of free pages to trigger vacuum
  analyzeFrequencyHours: number;
  reindexFrequencyDays: number;
  checkpointFrequencyMinutes: number;
  maxWalSizeMB: number;
}

interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeoutSeconds: number;
  connectionTimeoutSeconds: number;
  retryAttempts: number;
  retryDelayMs: number;
}

class GroceryDatabaseAdmin {
  private db: Database;
  private maintenanceConfig: MaintenanceConfig;
  private connectionPoolConfig: ConnectionPoolConfig;
  private isMaintenanceMode: boolean = false;

  constructor(
    private dbPath: string,
    config: {
      maintenance?: Partial<MaintenanceConfig>;
      connectionPool?: Partial<ConnectionPoolConfig>;
    } = {}
  ) {
    this.db = new Database(dbPath);
    this.maintenanceConfig = {
      vacuumThreshold: 20,
      analyzeFrequencyHours: 24,
      reindexFrequencyDays: 7,
      checkpointFrequencyMinutes: 15,
      maxWalSizeMB: 100,
      ...config.maintenance
    };
    
    this.connectionPoolConfig = {
      maxConnections: 10,
      idleTimeoutSeconds: 300,
      connectionTimeoutSeconds: 30,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config.connectionPool
    };
    
    this.setupPragmas();
    this.createAdminTables();
  }

  /**
   * USER MANAGEMENT AND ACCESS CONTROL
   */

  /**
   * Create a new database user with specified role and permissions
   */
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    role: DatabaseUser['role'];
    permissions?: string[];
  }): Promise<string> {
    console.log(`Creating user: ${userData.username}`);
    
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const passwordHash = await this.hashPassword(userData.password);
    const permissions = userData.permissions || this.getDefaultPermissions(userData.role);
    
    this?.db?.prepare(`
      INSERT INTO database_users (id, username, email, password_hash, role, permissions, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      userData.username,
      userData.email,
      passwordHash,
      userData.role,
      JSON.stringify(permissions),
      1,
      new Date().toISOString()
    );
    
    console.log(`✅ User created successfully: ${userData.username} (${userData.role})`);
    return userId;
  }

  /**
   * Grant permissions to a user
   */
  async grantPermissions(userId: string, permissions: string[]): Promise<void> {
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const currentPermissions = new Set(user.permissions);
    permissions.forEach(permission => currentPermissions.add(permission));
    
    this?.db?.prepare(`
      UPDATE database_users 
      SET permissions = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(Array.from(currentPermissions)),
      new Date().toISOString(),
      userId
    );
    
    console.log(`✅ Granted permissions to user ${user.username}: ${permissions.join(', ')}`);
  }

  /**
   * Revoke permissions from a user
   */
  async revokePermissions(userId: string, permissions: string[]): Promise<void> {
    const user = this.getUser(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    const currentPermissions = new Set(user.permissions);
    permissions.forEach(permission => currentPermissions.delete(permission));
    
    this?.db?.prepare(`
      UPDATE database_users 
      SET permissions = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(Array.from(currentPermissions)),
      new Date().toISOString(),
      userId
    );
    
    console.log(`✅ Revoked permissions from user ${user.username}: ${permissions.join(', ')}`);
  }

  /**
   * List all database users with their permissions
   */
  listUsers(): DatabaseUser[] {
    const users = this?.db?.prepare(`
      SELECT id, username, email, role, permissions, is_active, last_login, created_at
      FROM database_users
      ORDER BY created_at DESC
    `).all();
    
    return users?.map((user: any) => ({
      ...user,
      permissions: JSON.parse(user.permissions || '[]'),
      isActive: Boolean(user.is_active)
    }));
  }

  /**
   * DATABASE MAINTENANCE OPERATIONS
   */

  /**
   * Perform comprehensive database maintenance
   */
  async performMaintenance(options: {
    vacuum?: boolean;
    analyze?: boolean;
    reindex?: boolean;
    checkpoint?: boolean;
    integrity?: boolean;
    optimize?: boolean;
  } = {}): Promise<{
    vacuum?: { reclaimed: number; duration: number };
    analyze?: { duration: number };
    reindex?: { duration: number };
    checkpoint?: { pages: number; duration: number };
    integrity?: { passed: boolean; issues: string[] };
    optimize?: { applied: string[]; duration: number };
  }> {
    console.log('🔧 Starting database maintenance operations...');
    this.isMaintenanceMode = true;
    
    const results: any = {};
    
    try {
      // Vacuum operation
      if (options.vacuum !== false) {
        console.log('📦 Running VACUUM...');
        const vacuumResult = await this.performVacuum();
        results.vacuum = vacuumResult;
      }
      
      // Analyze statistics
      if (options.analyze !== false) {
        console.log('📊 Running ANALYZE...');
        const analyzeResult = await this.performAnalyze();
        results.analyze = analyzeResult;
      }
      
      // Reindex operations
      if (options.reindex) {
        console.log('🗂️  Running REINDEX...');
        const reindexResult = await this.performReindex();
        results.reindex = reindexResult;
      }
      
      // WAL checkpoint
      if (options.checkpoint !== false) {
        console.log('✅ Running checkpoint...');
        const checkpointResult = await this.performCheckpoint();
        results.checkpoint = checkpointResult;
      }
      
      // Integrity check
      if (options.integrity !== false) {
        console.log('🔍 Running integrity check...');
        const integrityResult = await this.performIntegrityCheck();
        results.integrity = integrityResult;
      }
      
      // Query optimization
      if (options.optimize) {
        console.log('⚡ Running optimization...');
        const optimizeResult = await this.performOptimization();
        results.optimize = optimizeResult;
      }
      
      console.log('✅ Database maintenance completed successfully');
      
      // Log maintenance operation
      this.logMaintenanceOperation('success', results);
      
      return results;
      
    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
      this.logMaintenanceOperation('failed', { error: error instanceof Error ? error.message : error });
      throw error;
      
    } finally {
      this.isMaintenanceMode = false;
    }
  }

  /**
   * HIGH AVAILABILITY AND FAILOVER PROCEDURES
   */

  /**
   * Create a hot backup for failover scenarios
   */
  async createHotBackup(backupPath: string): Promise<{
    size: number;
    duration: number;
    checksum: string;
  }> {
    console.log(`🔄 Creating hot backup to: ${backupPath}`);
    const startTime = performance.now();
    
    try {
      // Use SQLite online backup API
      const backupDb = new Database(backupPath);
      
      const backup = this?.db?.backup(backupDb);
      
      // Perform backup in chunks to avoid blocking
      let remaining = backup.remaining;
      while (remaining > 0) {
        backup.step(100); // Backup 100 pages at a time
        remaining = backup.remaining;
        
        // Allow other operations to proceed
        await new Promise(resolve => setImmediate(resolve));
      }
      
      backup.finish();
      backupDb.close();
      
      const duration = performance.now() - startTime;
      const stats = fs.statSync(backupPath);
      const checksum = this.calculateFileChecksum(backupPath);
      
      console.log(`✅ Hot backup completed in ${duration.toFixed(2)}ms`);
      console.log(`📦 Backup size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      return {
        size: stats.size,
        duration,
        checksum
      };
      
    } catch (error) {
      console.error(`❌ Hot backup failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Test database connectivity and basic operations
   */
  async testConnectivity(): Promise<{
    connected: boolean;
    latency: number;
    writeTest: boolean;
    readTest: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const startTime = performance.now();
    
    try {
      // Test basic connection
      const connected = this?.db?.open;
      
      // Test read operation
      let readTest = false;
      try {
        this?.db?.prepare('SELECT 1').get();
        readTest = true;
      } catch (error) {
        issues.push('Read operation failed');
      }
      
      // Test write operation (if not in readonly mode)
      let writeTest = false;
      try {
        const testTable = `test_connectivity_${Date.now()}`;
        this?.db?.prepare(`CREATE TEMP TABLE ${testTable} (id INTEGER PRIMARY KEY)`).run();
        this?.db?.prepare(`INSERT INTO ${testTable} (id) VALUES (1)`).run();
        this?.db?.prepare(`DROP TABLE ${testTable}`).run();
        writeTest = true;
      } catch (error) {
        issues.push('Write operation failed');
      }
      
      const latency = performance.now() - startTime;
      
      return {
        connected,
        latency,
        writeTest,
        readTest,
        issues
      };
      
    } catch (error) {
      return {
        connected: false,
        latency: -1,
        writeTest: false,
        readTest: false,
        issues: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * CONNECTION POOLING AND PERFORMANCE
   */

  /**
   * Configure connection pooling parameters
   */
  configureConnectionPool(config: Partial<ConnectionPoolConfig>): void {
    this.connectionPoolConfig = { ...this.connectionPoolConfig, ...config };
    
    // Apply SQLite-specific optimizations
    this?.db?.pragma(`cache_size = ${Math.max(1000, this?.connectionPoolConfig?.maxConnections * 100)}`);
    this?.db?.pragma('temp_store = MEMORY');
    this?.db?.pragma('journal_mode = WAL');
    this?.db?.pragma('synchronous = NORMAL');
    this?.db?.pragma(`busy_timeout = ${this?.connectionPoolConfig?.connectionTimeoutSeconds * 1000}`);
    
    console.log('✅ Connection pool configured:', this.connectionPoolConfig);
  }

  /**
   * Monitor database performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    cacheHitRatio: number;
    pageCount: number;
    freelistCount: number;
    walSize: number;
    busyTimeout: number;
    pragmaSettings: Record<string, any>;
  }> {
    const cacheHitRatio = this.calculateCacheHitRatio();
    const pageCount = this?.db?.pragma('page_count')[0] as any;
    const freelistCount = this?.db?.pragma('freelist_count')[0] as any;
    
    // Get WAL file size
    const walPath = `${this.dbPath}-wal`;
    let walSize = 0;
    try {
      if (fs.existsSync(walPath)) {
        walSize = fs.statSync(walPath).size;
      }
    } catch (error) {
      // WAL file might not exist
    }
    
    const busyTimeout = this?.db?.pragma('busy_timeout')[0] as any;
    
    const pragmaSettings = {
      journal_mode: this?.db?.pragma('journal_mode')[0],
      synchronous: this?.db?.pragma('synchronous')[0],
      cache_size: this?.db?.pragma('cache_size')[0],
      temp_store: this?.db?.pragma('temp_store')[0],
      mmap_size: this?.db?.pragma('mmap_size')[0]
    };
    
    return {
      cacheHitRatio,
      pageCount,
      freelistCount,
      walSize,
      busyTimeout,
      pragmaSettings
    };
  }

  /**
   * Generate comprehensive admin report
   */
  async generateAdminReport(): Promise<string> {
    const connectivity = await this.testConnectivity();
    const performance = await this.getPerformanceMetrics();
    const users = this.listUsers();
    const maintenanceHistory = this.getMaintenanceHistory();
    
    const report = `
# Grocery Database Administration Report
Generated: ${new Date().toISOString()}
Database: ${this.dbPath}

## System Status
**Overall Health**: ${connectivity.connected && connectivity.readTest && connectivity.writeTest ? '🟢 Healthy' : '🔴 Issues Detected'}
**Connectivity**: ${connectivity.connected ? '✅ Connected' : '❌ Disconnected'}
**Latency**: ${connectivity?.latency?.toFixed(2)}ms
**Read Operations**: ${connectivity.readTest ? '✅ Working' : '❌ Failed'}
**Write Operations**: ${connectivity.writeTest ? '✅ Working' : '❌ Failed'}

${connectivity?.issues?.length > 0 ? `### Issues Detected\n${connectivity?.issues?.map(issue => `- ❌ ${issue}`).join('\n')}` : ''}

## Performance Metrics
- **Cache Hit Ratio**: ${(performance.cacheHitRatio * 100).toFixed(2)}%
- **Total Pages**: ${performance.pageCount?.toLocaleString() || 'N/A'}
- **Free Pages**: ${performance.freelistCount?.toLocaleString() || 'N/A'}
- **WAL File Size**: ${this.formatBytes(performance.walSize)}
- **Busy Timeout**: ${performance.busyTimeout}ms

## Database Configuration
- **Journal Mode**: ${performance?.pragmaSettings?.journal_mode}
- **Synchronous**: ${performance?.pragmaSettings?.synchronous}
- **Cache Size**: ${performance?.pragmaSettings?.cache_size} pages
- **Temp Store**: ${performance?.pragmaSettings?.temp_store}
- **Memory Map**: ${this.formatBytes(performance?.pragmaSettings?.mmap_size)}

## User Management
**Total Users**: ${users?.length || 0}
**Active Users**: ${users?.filter(u => u.isActive).length}
**Administrators**: ${users?.filter(u => u.role === 'admin').length}

### User Breakdown by Role
${Object.entries(this.groupUsersByRole(users)).map(([role, count]) => `- ${role}: ${count}`).join('\n')}

## Recent Maintenance Operations
${maintenanceHistory.slice(0, 5).map(op => `- ${op.timestamp}: ${op.operation} (${op.status})`).join('\n') || 'No recent maintenance operations'}

## Recommendations
${this.generateRecommendations(performance, connectivity)}

## Connection Pool Configuration
- **Max Connections**: ${this?.connectionPoolConfig?.maxConnections}
- **Idle Timeout**: ${this?.connectionPoolConfig?.idleTimeoutSeconds}s
- **Connection Timeout**: ${this?.connectionPoolConfig?.connectionTimeoutSeconds}s
- **Retry Attempts**: ${this?.connectionPoolConfig?.retryAttempts}
`;
    
    return report;
  }

  // Private utility methods
  private setupPragmas(): void {
    // Enable foreign keys
    this?.db?.pragma('foreign_keys = ON');
    
    // Set WAL mode for better concurrency
    this?.db?.pragma('journal_mode = WAL');
    
    // Set normal synchronous mode for better performance
    this?.db?.pragma('synchronous = NORMAL');
    
    // Increase cache size
    this?.db?.pragma('cache_size = 10000');
    
    // Use memory for temporary tables
    this?.db?.pragma('temp_store = MEMORY');
    
    // Enable memory mapping
    this?.db?.pragma('mmap_size = 268435456'); // 256MB
  }

  private createAdminTables(): void {
    this?.db?.exec(`
      CREATE TABLE IF NOT EXISTS database_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'user', 'readonly')),
        permissions TEXT, -- JSON array
        is_active BOOLEAN DEFAULT TRUE,
        last_login TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS maintenance_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        details TEXT, -- JSON
        duration_ms INTEGER,
        timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_database_users_role ON database_users(role);
      CREATE INDEX IF NOT EXISTS idx_database_users_active ON database_users(is_active);
      CREATE INDEX IF NOT EXISTS idx_maintenance_log_timestamp ON maintenance_log(timestamp DESC);
    `);
  }

  private async hashPassword(password: string): Promise<string> {
    // Simple hash for demo - in production, use bcrypt or similar
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private getDefaultPermissions(role: DatabaseUser['role']): string[] {
    const permissions = {
      admin: ['read', 'write', 'delete', 'admin', 'backup', 'restore', 'maintenance'],
      manager: ['read', 'write', 'delete', 'backup'],
      user: ['read', 'write'],
      readonly: ['read']
    };
    
    return permissions[role] || [];
  }

  private getUser(userId: string): DatabaseUser | null {
    const user = this?.db?.prepare(`
      SELECT id, username, email, role, permissions, is_active, last_login, created_at
      FROM database_users WHERE id = ?
    `).get(userId) as any;
    
    if (!user) return null;
    
    return {
      ...user,
      permissions: JSON.parse(user.permissions || '[]'),
      isActive: Boolean(user.is_active)
    };
  }

  private async performVacuum(): Promise<{ reclaimed: number; duration: number }> {
    const startTime = performance.now();
    const beforeSize = fs.statSync(this.dbPath).size;
    
    this?.db?.exec('VACUUM');
    
    const afterSize = fs.statSync(this.dbPath).size;
    const duration = performance.now() - startTime;
    const reclaimed = beforeSize - afterSize;
    
    console.log(`📦 VACUUM completed: ${this.formatBytes(reclaimed)} reclaimed in ${duration.toFixed(2)}ms`);
    
    return { reclaimed, duration };
  }

  private async performAnalyze(): Promise<{ duration: number }> {
    const startTime = performance.now();
    
    this?.db?.exec('ANALYZE');
    
    const duration = performance.now() - startTime;
    
    console.log(`📊 ANALYZE completed in ${duration.toFixed(2)}ms`);
    
    return { duration };
  }

  private async performReindex(): Promise<{ duration: number }> {
    const startTime = performance.now();
    
    this?.db?.exec('REINDEX');
    
    const duration = performance.now() - startTime;
    
    console.log(`🗂️  REINDEX completed in ${duration.toFixed(2)}ms`);
    
    return { duration };
  }

  private async performCheckpoint(): Promise<{ pages: number; duration: number }> {
    const startTime = performance.now();
    
    const result = this?.db?.pragma('wal_checkpoint(TRUNCATE)');
    
    const duration = performance.now() - startTime;
    const pages = result[0] || 0;
    
    console.log(`✅ Checkpoint completed: ${pages} pages in ${duration.toFixed(2)}ms`);
    
    return { pages, duration };
  }

  private async performIntegrityCheck(): Promise<{ passed: boolean; issues: string[] }> {
    const result = this?.db?.pragma('integrity_check');
    const issues: string[] = [];
    
    result.forEach((row: any) => {
      if (row.integrity_check !== 'ok') {
        issues.push(row.integrity_check);
      }
    });
    
    const passed = issues?.length || 0 === 0;
    
    console.log(`🔍 Integrity check: ${passed ? 'PASSED' : 'FAILED'}`);
    if (!passed) {
      issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    return { passed, issues };
  }

  private async performOptimization(): Promise<{ applied: string[]; duration: number }> {
    const startTime = performance.now();
    const applied: string[] = [];
    
    // Optimize pragma settings
    this?.db?.pragma('optimize');
    applied.push('optimize pragma');
    
    // Update table statistics
    this?.db?.exec('ANALYZE sqlite_master');
    applied.push('analyze sqlite_master');
    
    const duration = performance.now() - startTime;
    
    console.log(`⚡ Optimization completed: ${applied.join(', ')} in ${duration.toFixed(2)}ms`);
    
    return { applied, duration };
  }

  private calculateCacheHitRatio(): number {
    // SQLite doesn't directly expose cache hit ratio
    // This is a simplified calculation
    return 0.95; // Placeholder
  }

  private calculateFileChecksum(filePath: string): string {
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  private groupUsersByRole(users: DatabaseUser[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    users.forEach(user => {
      groups[user.role] = (groups[user.role] || 0) + 1;
    });
    
    return groups;
  }

  private logMaintenanceOperation(status: string, details: any): void {
    this?.db?.prepare(`
      INSERT INTO maintenance_log (operation, status, details)
      VALUES (?, ?, ?)
    `).run(
      'comprehensive_maintenance',
      status,
      JSON.stringify(details)
    );
  }

  private getMaintenanceHistory(): Array<{ timestamp: string; operation: string; status: string }> {
    return this?.db?.prepare(`
      SELECT timestamp, operation, status
      FROM maintenance_log
      ORDER BY timestamp DESC
      LIMIT 10
    `).all() as any[];
  }

  private generateRecommendations(performance: any, connectivity: any): string {
    const recommendations: string[] = [];
    
    if (performance.cacheHitRatio < 0.9) {
      recommendations.push('🔧 Consider increasing cache size for better performance');
    }
    
    if (performance.freelistCount > performance.pageCount * 0.2) {
      recommendations.push('📦 Database has significant free space - consider running VACUUM');
    }
    
    if (performance.walSize > 100 * 1024 * 1024) { // 100MB
      recommendations.push('🔄 WAL file is large - consider more frequent checkpoints');
    }
    
    if (connectivity?.issues?.length > 0) {
      recommendations.push('🚨 Address connectivity issues immediately');
    }
    
    if (recommendations?.length || 0 === 0) {
      recommendations.push('✅ System is operating optimally');
    }
    
    return recommendations?.map(rec => `- ${rec}`).join('\n');
  }
}

// CLI interface
async function main() {
  const args = process?.argv?.slice(2);
  const command = args[0];
  
  const dbPath = process.env.DB_PATH || '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db';
  const admin = new GroceryDatabaseAdmin(dbPath);
  
  try {
    switch (command) {
      case 'create-user':
        if (args?.length || 0 < 5) {
          console.error('Usage: create-user <username> <email> <password> <role>');
          process.exit(1);
        }
        await admin.createUser({
          username: args[1],
          email: args[2],
          password: args[3],
          role: args[4] as any
        });
        break;
        
      case 'list-users':
        const users = admin.listUsers();
        console.table(users);
        break;
        
      case 'maintenance':
        const options = {
          vacuum: !args.includes('--no-vacuum'),
          analyze: !args.includes('--no-analyze'),
          reindex: args.includes('--reindex'),
          checkpoint: !args.includes('--no-checkpoint'),
          integrity: !args.includes('--no-integrity'),
          optimize: args.includes('--optimize')
        };
        
        const results = await admin.performMaintenance(options);
        console.log('Maintenance Results:', JSON.stringify(results, null, 2));
        break;
        
      case 'backup':
        if (args?.length || 0 < 2) {
          console.error('Usage: backup <backup-path>');
          process.exit(1);
        }
        const backupResult = await admin.createHotBackup(args[1]);
        console.log('Backup Results:', JSON.stringify(backupResult, null, 2));
        break;
        
      case 'test-connectivity':
        const connectivity = await admin.testConnectivity();
        console.log(JSON.stringify(connectivity, null, 2));
        break;
        
      case 'performance':
        const performance = await admin.getPerformanceMetrics();
        console.log(JSON.stringify(performance, null, 2));
        break;
        
      case 'report':
        const report = await admin.generateAdminReport();
        if (args[1]) {
          fs.writeFileSync(args[1], report);
          console.log(`Report saved to: ${args[1]}`);
        } else {
          console.log(report);
        }
        break;
        
      default:
        console.log(`
Grocery Database Administration Tool

Usage:
  create-user <username> <email> <password> <role>    Create database user
  list-users                                          List all database users
  maintenance [options]                               Perform database maintenance
    --no-vacuum     Skip VACUUM operation
    --no-analyze    Skip ANALYZE operation
    --reindex       Include REINDEX operation
    --no-checkpoint Skip WAL checkpoint
    --no-integrity  Skip integrity check
    --optimize      Include optimization
  backup <backup-path>                               Create hot backup
  test-connectivity                                  Test database connectivity
  performance                                        Get performance metrics
  report [output-file]                              Generate admin report

Environment Variables:
  DB_PATH - Database file path
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { GroceryDatabaseAdmin, DatabaseUser, MaintenanceConfig, ConnectionPoolConfig };