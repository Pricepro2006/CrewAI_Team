#!/usr/bin/env node

/**
 * Grocery Database Backup and Recovery System
 * 
 * This script provides comprehensive backup and recovery capabilities for the grocery system
 * with automated scheduling, compression, and integrity verification.
 */

import BetterSqlite3 from 'better-sqlite3';
import type { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BackupConfig {
  sourceDbPath: string;
  backupDir: string;
  retentionDays: number;
  compressionLevel?: number;
  encryptionKey?: string;
  s3Bucket?: string;
  notificationEmail?: string;
}

interface BackupMetadata {
  timestamp: string;
  filename: string;
  size: number;
  checksum: string;
  tableCount: number;
  recordCount: number;
  compressionRatio?: number;
  encrypted: boolean;
}

class GroceryDatabaseBackup {
  private config: BackupConfig;
  private logger: Console;

  constructor(config: BackupConfig) {
    this.config = {
      compressionLevel: 6,
      ...config,
      retentionDays: config.retentionDays || 30
    };
    this.logger = console;
    this.ensureBackupDirectory();
  }

  /**
   * Create a full database backup with optional compression and encryption
   */
  async createBackup(options: { 
    compress?: boolean; 
    encrypt?: boolean; 
    uploadToS3?: boolean;
    includeAnalytics?: boolean;
  } = {}): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `grocery_backup_${timestamp}`;
    const backupPath = path.join(this?.config?.backupDir, `${backupName}.db`);
    
    this?.logger?.log(`Starting backup: ${backupName}`);
    
    try {
      // Create database backup using SQLite backup API
      const sourceDb = new BetterSqlite3(this?.config?.sourceDbPath, { readonly: true });
      const backupDb = new BetterSqlite3(backupPath);
      
      await this.performBackup(sourceDb, backupDb);
      
      // Get metadata before closing connections
      const metadata = await this.collectBackupMetadata(sourceDb, backupPath);
      
      sourceDb.close();
      backupDb.close();
      
      // Optional post-processing
      let finalPath = backupPath;
      let compressionRatio: number | undefined;
      
      if (options.compress) {
        finalPath = await this.compressBackup(backupPath);
        compressionRatio = this.calculateCompressionRatio(backupPath, finalPath);
        fs.unlinkSync(backupPath); // Remove uncompressed version
      }
      
      if (options.encrypt && this?.config?.encryptionKey) {
        finalPath = await this.encryptBackup(finalPath);
        if (finalPath !== backupPath) {
          fs.unlinkSync(options.compress ? backupPath.replace('.db', '.db.gz') : backupPath);
        }
      }
      
      if (options.uploadToS3 && this?.config?.s3Bucket) {
        await this.uploadToS3(finalPath);
      }
      
      // Update metadata with final information
      const finalMetadata: BackupMetadata = {
        ...metadata,
        filename: path.basename(finalPath),
        size: fs.statSync(finalPath).size,
        checksum: this.calculateChecksum(finalPath),
        compressionRatio,
        encrypted: options.encrypt || false
      };
      
      // Save metadata
      await this.saveBackupMetadata(finalMetadata);
      
      this?.logger?.log(`Backup completed successfully: ${finalMetadata.filename}`);
      this?.logger?.log(`Size: ${(finalMetadata.size / 1024 / 1024).toFixed(2)} MB`);
      if (compressionRatio) {
        this?.logger?.log(`Compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
      }
      
      return finalMetadata;
      
    } catch (error) {
      this?.logger?.error(`Backup failed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Restore database from backup with integrity verification
   */
  async restoreFromBackup(backupPath: string, targetPath: string, options: {
    verifyIntegrity?: boolean;
    createPreRestoreBackup?: boolean;
    testRestore?: boolean;
  } = {}): Promise<boolean> {
    this?.logger?.log(`Starting restore from: ${backupPath}`);
    
    try {
      // Create pre-restore backup if requested
      if (options.createPreRestoreBackup && fs.existsSync(targetPath)) {
        const preRestoreBackup = `${targetPath}.pre-restore.${Date.now()}.db`;
        fs.copyFileSync(targetPath, preRestoreBackup);
        this?.logger?.log(`Pre-restore backup created: ${preRestoreBackup}`);
      }
      
      let workingBackupPath = backupPath;
      
      // Decrypt if necessary
      if (backupPath.endsWith('.enc')) {
        workingBackupPath = await this.decryptBackup(backupPath);
      }
      
      // Decompress if necessary
      if (workingBackupPath.endsWith('.gz')) {
        workingBackupPath = await this.decompressBackup(workingBackupPath);
      }
      
      // Verify backup integrity
      if (options.verifyIntegrity) {
        const isValid = await this.verifyBackupIntegrity(workingBackupPath);
        if (!isValid) {
          throw new Error('Backup integrity check failed');
        }
      }
      
      // Perform the restore
      if (options.testRestore) {
        // Test restore to temporary location
        const testPath = `${targetPath}.test.${Date.now()}`;
        fs.copyFileSync(workingBackupPath, testPath);
        
        // Test database connection and basic queries
        const testDb = new BetterSqlite3(testPath, { readonly: true });
        await this.performRestoreTests(testDb);
        testDb.close();
        
        fs.unlinkSync(testPath);
        this?.logger?.log('Test restore completed successfully');
      } else {
        // Actual restore
        fs.copyFileSync(workingBackupPath, targetPath);
        
        // Verify the restored database
        const restoredDb = new BetterSqlite3(targetPath, { readonly: true });
        await this.performRestoreTests(restoredDb);
        restoredDb.close();
      }
      
      // Cleanup temporary files
      if (workingBackupPath !== backupPath) {
        fs.unlinkSync(workingBackupPath);
      }
      
      this?.logger?.log('Restore completed successfully');
      return true;
      
    } catch (error) {
      this?.logger?.error(`Restore failed: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this?.config?.retentionDays);
    
    const files = fs.readdirSync(this?.config?.backupDir);
    let deletedCount = 0;
    
    for (const file of files) {
      if (!file.startsWith('grocery_backup_')) continue;
      
      const filePath = path.join(this?.config?.backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;
        this?.logger?.log(`Deleted old backup: ${file}`);
      }
    }
    
    this?.logger?.log(`Cleanup completed. Deleted ${deletedCount} old backups.`);
    return deletedCount;
  }

  /**
   * Monitor database health and recommend backup timing
   */
  async analyzeDatabaseHealth(): Promise<{
    size: number;
    lastModified: Date;
    tableStats: Array<{ table: string; rows: number; size: number }>;
    integrityCheck: boolean;
    recommendations: string[];
  }> {
    const db = new BetterSqlite3(this?.config?.sourceDbPath, { readonly: true });
    
    try {
      const stats = fs.statSync(this?.config?.sourceDbPath);
      const recommendations: string[] = [];
      
      // Get table statistics
      const tableStats = await this.getTableStatistics(db);
      
      // Perform integrity check
      const integrityResult = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      const integrityCheck = integrityResult[0]?.integrity_check === 'ok';
      
      // Generate recommendations
      if (stats.size > 100 * 1024 * 1024) { // > 100MB
        recommendations.push('Database is large (>100MB). Consider more frequent backups.');
      }
      
      const lastBackup = this.getLastBackupTime();
      if (lastBackup && (Date.now() - lastBackup.getTime()) > 24 * 60 * 60 * 1000) {
        recommendations.push('Last backup is over 24 hours old. Consider creating a new backup.');
      }
      
      if (!integrityCheck) {
        recommendations.push('CRITICAL: Database integrity check failed. Immediate backup and investigation required.');
      }
      
      const result = {
        size: stats.size,
        lastModified: stats.mtime,
        tableStats,
        integrityCheck,
        recommendations
      };
      
      db.close();
      return result;
      
    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Generate database performance and backup reports
   */
  async generateReport(outputPath?: string): Promise<string> {
    const health = await this.analyzeDatabaseHealth();
    const backupHistory = await this.getBackupHistory();
    
    const report = `
# Grocery Database Backup Report
Generated: ${new Date().toISOString()}

## Database Health
- Size: ${(health.size / 1024 / 1024).toFixed(2)} MB
- Last Modified: ${health?.lastModified?.toISOString()}
- Integrity Check: ${health.integrityCheck ? '✅ PASSED' : '❌ FAILED'}

## Table Statistics
${health?.tableStats?.map(table => 
  `- ${table.table}: ${table?.rows?.toLocaleString()} rows, ${(table.size / 1024).toFixed(2)} KB`
).join('\n')}

## Recent Backups
${backupHistory.slice(0, 10).map(backup => 
  `- ${backup.timestamp}: ${backup.filename} (${(backup.size / 1024 / 1024).toFixed(2)} MB)`
).join('\n')}

## Recommendations
${health?.recommendations?.map(rec => `- ${rec}`).join('\n')}

## Backup Configuration
- Retention Days: ${this?.config?.retentionDays}
- Compression: ${this?.config?.compressionLevel ? 'Enabled' : 'Disabled'}
- Encryption: ${this?.config?.encryptionKey ? 'Enabled' : 'Disabled'}
- S3 Upload: ${this?.config?.s3Bucket ? 'Enabled' : 'Disabled'}
`;

    if (outputPath) {
      fs.writeFileSync(outputPath, report);
      this?.logger?.log(`Report saved to: ${outputPath}`);
    }
    
    return report;
  }

  // Private helper methods
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this?.config?.backupDir)) {
      fs.mkdirSync(this?.config?.backupDir, { recursive: true });
    }
  }

  private async performBackup(sourceDb: Database, backupDb: Database): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const backup = sourceDb.backup(backupDb as any);
        (backup as any).step(-1);
        resolve();
      } catch (error) {
        reject(new Error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  private async collectBackupMetadata(sourceDb: Database, backupPath: string): Promise<Omit<BackupMetadata, 'filename' | 'compressionRatio' | 'encrypted'>> {
    const stats = fs.statSync(backupPath);
    const checksum = this.calculateChecksum(backupPath);
    
    // Get table and record counts
    const tables = sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableCount = tables?.length || 0;
    
    let recordCount = 0;
    for (const table of tables) {
      const count = sourceDb.prepare(`SELECT COUNT(*) as count FROM ${(table as any).name}`).get() as any;
      recordCount += count.count;
    }
    
    return {
      timestamp: new Date().toISOString(),
      size: stats.size,
      checksum,
      tableCount,
      recordCount
    };
  }

  private calculateChecksum(filePath: string): string {
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  private async compressBackup(backupPath: string): Promise<string> {
    const compressedPath = `${backupPath}.gz`;
    await execAsync(`gzip -${this?.config?.compressionLevel} -c "${backupPath}" > "${compressedPath}"`);
    return compressedPath;
  }

  private async decompressBackup(compressedPath: string): Promise<string> {
    const decompressedPath = compressedPath.replace('.gz', '');
    await execAsync(`gunzip -c "${compressedPath}" > "${decompressedPath}"`);
    return decompressedPath;
  }

  private calculateCompressionRatio(originalPath: string, compressedPath: string): number {
    const originalSize = fs.statSync(originalPath).size;
    const compressedSize = fs.statSync(compressedPath).size;
    return compressedSize / originalSize;
  }

  private async encryptBackup(backupPath: string): Promise<string> {
    if (!this?.config?.encryptionKey) {
      throw new Error('Encryption key not provided');
    }
    
    const encryptedPath = `${backupPath}.enc`;
    const cipher = crypto.createCipher('aes-256-cbc', this?.config?.encryptionKey);
    const input = fs.createReadStream(backupPath);
    const output = fs.createWriteStream(encryptedPath);
    
    return new Promise((resolve, reject) => {
      input.pipe(cipher).pipe(output)
        .on('finish', () => resolve(encryptedPath))
        .on('error', reject);
    });
  }

  private async decryptBackup(encryptedPath: string): Promise<string> {
    if (!this?.config?.encryptionKey) {
      throw new Error('Encryption key not provided');
    }
    
    const decryptedPath = encryptedPath.replace('.enc', '');
    const decipher = crypto.createDecipher('aes-256-cbc', this?.config?.encryptionKey);
    const input = fs.createReadStream(encryptedPath);
    const output = fs.createWriteStream(decryptedPath);
    
    return new Promise((resolve, reject) => {
      input.pipe(decipher).pipe(output)
        .on('finish', () => resolve(decryptedPath))
        .on('error', reject);
    });
  }

  private async uploadToS3(backupPath: string): Promise<void> {
    // Implementation would require AWS SDK
    this?.logger?.log('S3 upload not implemented - would require AWS SDK integration');
  }

  private async verifyBackupIntegrity(backupPath: string): Promise<boolean> {
    try {
      const db = new BetterSqlite3(backupPath, { readonly: true });
      const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
      db.close();
      return result[0]?.integrity_check === 'ok';
    } catch {
      return false;
    }
  }

  private async performRestoreTests(db: Database): Promise<void> {
    // Test basic table access
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    if (tables?.length || 0 === 0) {
      throw new Error('No tables found in restored database');
    }
    
    // Test grocery-specific tables
    const groceryTables = ['users', 'grocery_lists', 'grocery_items', 'purchase_history', 'user_preferences', 'deal_alerts'];
    for (const tableName of groceryTables) {
      try {
        db.prepare(`SELECT COUNT(*) FROM ${tableName}`).get();
      } catch (error) {
        this?.logger?.warn(`Table ${tableName} not accessible: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  private async getTableStatistics(db: Database): Promise<Array<{ table: string; rows: number; size: number }>> {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    const stats = [];
    
    for (const table of tables) {
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any;
        const size = db.prepare(`SELECT SUM(length(sql)) as size FROM sqlite_master WHERE name = ?`).get(table.name) as any;
        
        stats.push({
          table: table.name,
          rows: count.count,
          size: size.size || 0
        });
      } catch (error) {
        this?.logger?.warn(`Could not get stats for table ${table.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
    
    return stats;
  }

  private getLastBackupTime(): Date | null {
    try {
      const files = fs.readdirSync(this?.config?.backupDir)
        .filter(f => f.startsWith('grocery_backup_'))
        .map(f => ({ name: f, mtime: fs.statSync(path.join(this?.config?.backupDir, f)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      return files.length > 0 && files[0] ? files[0].mtime : null;
    } catch {
      return null;
    }
  }

  private async getBackupHistory(): Promise<BackupMetadata[]> {
    const metadataPath = path.join(this?.config?.backupDir, 'backup_metadata.json');
    
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this?.logger?.warn(`Could not load backup metadata: ${error instanceof Error ? error.message : error}`);
    }
    
    return [];
  }

  private async saveBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const metadataPath = path.join(this?.config?.backupDir, 'backup_metadata.json');
    
    try {
      const history = await this.getBackupHistory();
      history.unshift(metadata);
      
      // Keep only last 100 entries
      const trimmedHistory = history.slice(0, 100);
      
      fs.writeFileSync(metadataPath, JSON.stringify(trimmedHistory, null, 2));
    } catch (error) {
      this?.logger?.warn(`Could not save backup metadata: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// CLI interface
async function main() {
  const args = process?.argv?.slice(2);
  const command = args[0];
  
  const config: BackupConfig = {
    sourceDbPath: process.env.DB_PATH || '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db',
    backupDir: process.env.BACKUP_DIR || '/home/pricepro2006/CrewAI_Team/data/backups',
    retentionDays: parseInt(process.env.RETENTION_DAYS || '30'),
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6'),
    encryptionKey: process.env.ENCRYPTION_KEY,
    s3Bucket: process.env.S3_BUCKET,
    notificationEmail: process.env.NOTIFICATION_EMAIL
  };
  
  const backup = new GroceryDatabaseBackup(config);
  
  try {
    switch (command) {
      case 'backup':
        await backup.createBackup({
          compress: args.includes('--compress'),
          encrypt: args.includes('--encrypt'),
          uploadToS3: args.includes('--s3'),
          includeAnalytics: args.includes('--analytics')
        });
        break;
        
      case 'restore':
        if (!args || args.length < 3) {
          console.error('Usage: restore <backup-path> <target-path>');
          process.exit(1);
        }
        await backup.restoreFromBackup(args[1] || '', args[2] || '', {
          verifyIntegrity: args.includes('--verify'),
          createPreRestoreBackup: args.includes('--pre-backup'),
          testRestore: args.includes('--test')
        });
        break;
        
      case 'cleanup':
        await backup.cleanupOldBackups();
        break;
        
      case 'health':
        const health = await backup.analyzeDatabaseHealth();
        console.log(JSON.stringify(health, null, 2));
        break;
        
      case 'report':
        const reportPath = args[1] || path.join(config.backupDir, `backup_report_${Date.now()}.md`);
        await backup.generateReport(reportPath);
        break;
        
      default:
        console.log(`
Grocery Database Backup Tool

Usage:
  backup [--compress] [--encrypt] [--s3] [--analytics]    Create a new backup
  restore <backup-path> <target-path> [--verify] [--pre-backup] [--test]  Restore from backup
  cleanup                                                 Clean up old backups
  health                                                  Check database health
  report [output-path]                                    Generate backup report

Environment Variables:
  DB_PATH - Source database path
  BACKUP_DIR - Backup directory
  RETENTION_DAYS - Days to keep backups (default: 30)
  COMPRESSION_LEVEL - gzip compression level (default: 6)
  ENCRYPTION_KEY - Key for backup encryption
  S3_BUCKET - S3 bucket for backup upload
  NOTIFICATION_EMAIL - Email for backup notifications
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

export { GroceryDatabaseBackup };
export type { BackupConfig, BackupMetadata };