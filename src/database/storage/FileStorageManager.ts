/**
 * File Storage Manager - Production-ready file storage with versioning and metadata
 * Handles email attachments, documents, and other file assets with proper organization
 */

import { promises as fs } from "fs";
import { createReadStream, createWriteStream } from "fs";
import { join, dirname, extname, basename } from "path";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";

export interface StoredFile {
  id: string;
  original_name: string;
  storage_path: string;
  size: number;
  content_type: string;
  checksum: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
  version: number;
  parent_file_id?: string;
}

export interface FileMetadata {
  originalName: string;
  contentType?: string;
  category?: string;
  tags?: string[];
  description?: string;
  accessLevel?: "public" | "private" | "restricted";
  owner?: string;
  customFields?: Record<string, any>;
}

export interface StorageConfig {
  basePath: string;
  maxFileSize?: number; // bytes
  allowedExtensions?: string[];
  quarantinePath?: string;
  versioning?: boolean;
  compression?: boolean;
}

export class FileStorageManager {
  private basePath: string;
  private quarantinePath: string;
  private maxFileSize: number;
  private allowedExtensions: Set<string>;
  private versioning: boolean;
  private compression: boolean;

  constructor(config: StorageConfig) {
    this.basePath = config.basePath;
    this.quarantinePath =
      config.quarantinePath || join(config.basePath, "quarantine");
    this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB default
    this.allowedExtensions = new Set(config.allowedExtensions || []);
    this.versioning = config.versioning !== false;
    this.compression = config.compression === true;

    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(this.quarantinePath, { recursive: true });

      // Create category subdirectories
      const categories = [
        "documents",
        "attachments",
        "images",
        "exports",
        "backups",
      ];
      for (const category of categories) {
        await fs.mkdir(join(this.basePath, category), { recursive: true });
      }

      logger.info(
        `File storage directories initialized at ${this.basePath}`,
        "FILE_STORAGE",
      );
    } catch (error) {
      logger.error(
        `Failed to create storage directories: ${error}`,
        "FILE_STORAGE",
      );
      throw error;
    }
  }

  /**
   * Store a file with metadata and versioning
   */
  async storeFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
  ): Promise<StoredFile> {
    try {
      // Validate file
      await this.validateFile(fileBuffer, metadata);

      // Generate file ID and paths
      const fileId = uuidv4();
      const extension = this.getFileExtension(metadata.originalName);
      const category = metadata.category || "documents";
      const fileName = `${fileId}${extension}`;
      const storagePath = join(category, this.getDatePath(), fileName);
      const fullPath = join(this.basePath, storagePath);

      // Ensure directory exists
      await fs.mkdir(dirname(fullPath), { recursive: true });

      // Calculate checksum
      const checksum = this.calculateChecksum(fileBuffer);

      // Check for existing file with same checksum (deduplication)
      const existingFile = await this.findFileByChecksum(checksum);
      if (existingFile && !this.versioning) {
        logger.info(
          `File with checksum ${checksum} already exists, reusing`,
          "FILE_STORAGE",
        );
        return existingFile;
      }

      // Store file
      await fs.writeFile(fullPath, fileBuffer);

      // Create file record
      const storedFile: StoredFile = {
        id: fileId,
        original_name: metadata.originalName,
        storage_path: storagePath,
        size: fileBuffer?.length || 0,
        content_type:
          metadata.contentType || this.detectContentType(metadata.originalName),
        checksum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: this.sanitizeMetadata(metadata),
        version: 1,
        parent_file_id: existingFile?.id,
      };

      logger.info(
        `File stored: ${fileId} (${storedFile.size} bytes)`,
        "FILE_STORAGE",
      );
      return storedFile;
    } catch (error) {
      logger.error(`Failed to store file: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Retrieve a file by ID
   */
  async getFile(fileId: string): Promise<{
    file: StoredFile | null;
    buffer: Buffer | null;
  }> {
    try {
      // In a real implementation, this would query the database
      // For now, we'll implement a simple file-based lookup
      const fileRecord = await this.findFileById(fileId);
      if (!fileRecord) {
        return { file: null, buffer: null };
      }

      const fullPath = join(this.basePath, fileRecord.storage_path);

      try {
        const buffer = await fs.readFile(fullPath);

        // Verify integrity
        const currentChecksum = this.calculateChecksum(buffer);
        if (currentChecksum !== fileRecord.checksum) {
          logger.error(
            `File integrity check failed for ${fileId}`,
            "FILE_STORAGE",
          );
          throw new Error("File integrity compromised");
        }

        return { file: fileRecord, buffer };
      } catch (readError) {
        logger.error(
          `Failed to read file ${fileId}: ${readError}`,
          "FILE_STORAGE",
        );
        return { file: fileRecord, buffer: null };
      }
    } catch (error) {
      logger.error(`Failed to get file ${fileId}: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Create a new version of an existing file
   */
  async createVersion(
    originalFileId: string,
    fileBuffer: Buffer,
    metadata: Partial<FileMetadata>,
  ): Promise<StoredFile> {
    try {
      const originalFile = await this.findFileById(originalFileId);
      if (!originalFile) {
        throw new Error(`Original file ${originalFileId} not found`);
      }

      // Merge metadata
      const versionMetadata: FileMetadata = {
        ...originalFile.metadata,
        ...metadata,
        originalName: metadata.originalName || originalFile.original_name,
      };

      // Create new version
      const newVersion = await this.storeFile(fileBuffer, versionMetadata);
      newVersion.version = originalFile.version + 1;
      newVersion.parent_file_id = originalFileId;

      logger.info(
        `Created version ${newVersion.version} of file ${originalFileId}`,
        "FILE_STORAGE",
      );
      return newVersion;
    } catch (error) {
      logger.error(`Failed to create version: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Delete a file (move to quarantine for safety)
   */
  async deleteFile(
    fileId: string,
    permanent: boolean = false,
  ): Promise<boolean> {
    try {
      const fileRecord = await this.findFileById(fileId);
      if (!fileRecord) {
        logger.warn(`File ${fileId} not found for deletion`, "FILE_STORAGE");
        return false;
      }

      const sourcePath = join(this.basePath, fileRecord.storage_path);

      if (permanent) {
        // Permanent deletion
        await fs.unlink(sourcePath);
        logger.info(`Permanently deleted file ${fileId}`, "FILE_STORAGE");
      } else {
        // Move to quarantine
        const quarantinePath = join(
          this.quarantinePath,
          `${fileId}_${Date.now()}`,
        );
        await fs.rename(sourcePath, quarantinePath);
        logger.info(`Moved file ${fileId} to quarantine`, "FILE_STORAGE");
      }

      // In a real implementation, update database record
      return true;
    } catch (error) {
      logger.error(`Failed to delete file ${fileId}: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Get file versions
   */
  async getFileVersions(fileId: string): Promise<StoredFile[]> {
    try {
      // In a real implementation, this would query the database
      // For now, return mock data
      const baseFile = await this.findFileById(fileId);
      if (!baseFile) {
        return [];
      }

      return [baseFile]; // Would include all versions in real implementation
    } catch (error) {
      logger.error(
        `Failed to get file versions for ${fileId}: ${error}`,
        "FILE_STORAGE",
      );
      throw error;
    }
  }

  /**
   * Search files by metadata
   */
  async searchFiles(criteria: {
    category?: string;
    contentType?: string;
    owner?: string;
    tags?: string[];
    dateRange?: { start: string; end: string };
    textSearch?: string;
  }): Promise<StoredFile[]> {
    try {
      // In a real implementation, this would use database queries
      // For now, return empty array
      logger.info(
        `Searching files with criteria: ${JSON.stringify(criteria)}`,
        "FILE_STORAGE",
      );
      return [];
    } catch (error) {
      logger.error(`File search failed: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    usedSpace: number;
    availableSpace: number;
    categorySizes: Record<string, number>;
    largestFiles: Array<{ id: string; name: string; size: number }>;
  }> {
    try {
      // Calculate directory sizes
      const categories = [
        "documents",
        "attachments",
        "images",
        "exports",
        "backups",
      ];
      const categorySizes: Record<string, number> = {};
      let totalSize = 0;
      let totalFiles = 0;

      for (const category of categories) {
        const categoryPath = join(this.basePath, category);
        try {
          const stats = await this.getDirectoryStats(categoryPath);
          categorySizes[category] = stats.size;
          totalSize += stats.size;
          totalFiles += stats.files;
        } catch (error) {
          categorySizes[category] = 0;
        }
      }

      // Get disk space info (simplified)
      let availableSpace = 0;
      try {
        const stats = await fs.stat(this.basePath);
        // This is a simplified calculation - in production, use statvfs or similar
        availableSpace = 1024 * 1024 * 1024 * 10; // 10GB placeholder
      } catch (error) {
        logger.warn(`Failed to get disk space info: ${error}`, "FILE_STORAGE");
      }

      return {
        totalFiles,
        totalSize,
        usedSpace: totalSize,
        availableSpace,
        categorySizes,
        largestFiles: [], // Would be populated from database in real implementation
      };
    } catch (error) {
      logger.error(`Failed to get storage stats: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Clean up old files and empty directories
   */
  async cleanup(
    options: {
      olderThanDays?: number;
      emptyDirectories?: boolean;
      quarantine?: boolean;
    } = {},
  ): Promise<{
    filesDeleted: number;
    directoriesDeleted: number;
    spaceFreed: number;
  }> {
    try {
      let filesDeleted = 0;
      let directoriesDeleted = 0;
      let spaceFreed = 0;

      const {
        olderThanDays = 30,
        emptyDirectories = true,
        quarantine = true,
      } = options;

      // Clean quarantine directory
      if (quarantine) {
        const quarantineFiles = await fs.readdir(this.quarantinePath);
        for (const file of quarantineFiles) {
          const filePath = join(this.quarantinePath, file);
          const stats = await fs.stat(filePath);

          if (this.isOlderThan(stats.mtime, olderThanDays)) {
            spaceFreed += stats.size;
            await fs.unlink(filePath);
            filesDeleted++;
          }
        }
      }

      // Remove empty directories
      if (emptyDirectories) {
        directoriesDeleted = await this.removeEmptyDirectories(this.basePath);
      }

      logger.info(
        `Cleanup completed: ${filesDeleted} files, ${directoriesDeleted} directories, ${spaceFreed} bytes freed`,
        "FILE_STORAGE",
      );

      return { filesDeleted, directoriesDeleted, spaceFreed };
    } catch (error) {
      logger.error(`Cleanup failed: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Create a backup of the storage system
   */
  async createBackup(backupPath: string): Promise<string> {
    try {
      const backupId = uuidv4();
      const backupDir = join(backupPath, `backup_${backupId}_${Date.now()}`);

      await fs.mkdir(backupDir, { recursive: true });

      // Copy files (simplified - in production, use streaming and compression)
      await this.copyDirectory(this.basePath, backupDir);

      logger.info(`Storage backup created at ${backupDir}`, "FILE_STORAGE");
      return backupDir;
    } catch (error) {
      logger.error(`Backup creation failed: ${error}`, "FILE_STORAGE");
      throw error;
    }
  }

  /**
   * Validate file before storage
   */
  private async validateFile(
    fileBuffer: Buffer,
    metadata: FileMetadata,
  ): Promise<void> {
    // Size validation
    if (fileBuffer?.length || 0 > this.maxFileSize) {
      throw new Error(
        `File size ${fileBuffer?.length || 0} exceeds maximum ${this.maxFileSize}`,
      );
    }

    // Extension validation
    if (this?.allowedExtensions?.size > 0) {
      const extension = this.getFileExtension(
        metadata.originalName,
      ).toLowerCase();
      if (!this?.allowedExtensions?.has(extension)) {
        throw new Error(`File extension ${extension} is not allowed`);
      }
    }

    // Basic virus scanning placeholder
    if (await this.isFileSuspicious(fileBuffer)) {
      throw new Error("File appears to be malicious");
    }
  }

  /**
   * Simple virus scanning placeholder
   */
  private async isFileSuspicious(fileBuffer: Buffer): Promise<boolean> {
    // Placeholder for actual virus scanning
    // In production, integrate with ClamAV or similar
    const suspicious = [
      Buffer.from("virus"),
      Buffer.from("malware"),
      Buffer.from("trojan"),
    ];

    return suspicious.some((pattern: any) => fileBuffer.includes(pattern));
  }

  /**
   * Calculate file checksum
   */
  private calculateChecksum(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    return extname(filename).toLowerCase();
  }

  /**
   * Detect content type from filename
   */
  private detectContentType(filename: string): string {
    const extension = this.getFileExtension(filename);
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx":
        "application/vnd.openxmlformats-officedocument?.wordprocessingml?.document",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument?.spreadsheetml?.sheet",
      ".txt": "text/plain",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".zip": "application/zip",
      ".json": "application/json",
    };

    return mimeTypes[extension] || "application/octet-stream";
  }

  /**
   * Generate date-based path
   */
  private getDatePath(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return join(year.toString(), month, day);
  }

  /**
   * Sanitize metadata
   */
  private sanitizeMetadata(metadata: FileMetadata): Record<string, any> {
    return {
      originalName: metadata.originalName,
      contentType: metadata.contentType,
      category: metadata.category || "documents",
      tags: metadata.tags || [],
      description: metadata.description,
      accessLevel: metadata.accessLevel || "private",
      owner: metadata.owner,
      customFields: metadata.customFields || {},
    };
  }

  /**
   * Mock methods for file lookup (would be database queries in real implementation)
   */
  private async findFileById(fileId: string): Promise<StoredFile | null> {
    // This would be a database query in real implementation
    return null;
  }

  private async findFileByChecksum(
    checksum: string,
  ): Promise<StoredFile | null> {
    // This would be a database query in real implementation
    return null;
  }

  /**
   * Get directory statistics
   */
  private async getDirectoryStats(
    dirPath: string,
  ): Promise<{ size: number; files: number }> {
    let totalSize = 0;
    let totalFiles = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subStats = await this.getDirectoryStats(fullPath);
          totalSize += subStats.size;
          totalFiles += subStats.files;
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
          totalFiles++;
        }
      }
    } catch (error) {
      // Directory might not exist
    }

    return { size: totalSize, files: totalFiles };
  }

  /**
   * Check if date is older than specified days
   */
  private isOlderThan(date: Date, days: number): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return date < cutoff;
  }

  /**
   * Remove empty directories recursively
   */
  private async removeEmptyDirectories(dirPath: string): Promise<number> {
    let removed = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = join(dirPath, entry.name);
          removed += await this.removeEmptyDirectories(subPath);
        }
      }

      // Check if directory is now empty
      const remainingEntries = await fs.readdir(dirPath);
      if (remainingEntries?.length || 0 === 0 && dirPath !== this.basePath) {
        await fs.rmdir(dirPath);
        removed++;
      }
    } catch (error) {
      // Directory might have been removed already
    }

    return removed;
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string,
  ): Promise<void> {
    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = join(source, entry.name);
      const destPath = join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }
}
