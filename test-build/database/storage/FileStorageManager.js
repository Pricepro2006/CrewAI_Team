/**
 * File Storage Manager - Production-ready file storage with versioning and metadata
 * Handles email attachments, documents, and other file assets with proper organization
 */
import { promises as fs } from "fs";
import { join, dirname, extname } from "path";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
export class FileStorageManager {
    basePath;
    quarantinePath;
    maxFileSize;
    allowedExtensions;
    versioning;
    compression;
    constructor(config) {
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
    async ensureDirectories() {
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
            logger.info(`File storage directories initialized at ${this.basePath}`, "FILE_STORAGE");
        }
        catch (error) {
            logger.error(`Failed to create storage directories: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Store a file with metadata and versioning
     */
    async storeFile(fileBuffer, metadata) {
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
                logger.info(`File with checksum ${checksum} already exists, reusing`, "FILE_STORAGE");
                return existingFile;
            }
            // Store file
            await fs.writeFile(fullPath, fileBuffer);
            // Create file record
            const storedFile = {
                id: fileId,
                original_name: metadata.originalName,
                storage_path: storagePath,
                size: fileBuffer?.length || 0,
                content_type: metadata.contentType || this.detectContentType(metadata.originalName),
                checksum,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                metadata: this.sanitizeMetadata(metadata),
                version: 1,
                parent_file_id: existingFile?.id,
            };
            logger.info(`File stored: ${fileId} (${storedFile.size} bytes)`, "FILE_STORAGE");
            return storedFile;
        }
        catch (error) {
            logger.error(`Failed to store file: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Retrieve a file by ID
     */
    async getFile(fileId) {
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
                    logger.error(`File integrity check failed for ${fileId}`, "FILE_STORAGE");
                    throw new Error("File integrity compromised");
                }
                return { file: fileRecord, buffer };
            }
            catch (readError) {
                logger.error(`Failed to read file ${fileId}: ${readError}`, "FILE_STORAGE");
                return { file: fileRecord, buffer: null };
            }
        }
        catch (error) {
            logger.error(`Failed to get file ${fileId}: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Create a new version of an existing file
     */
    async createVersion(originalFileId, fileBuffer, metadata) {
        try {
            const originalFile = await this.findFileById(originalFileId);
            if (!originalFile) {
                throw new Error(`Original file ${originalFileId} not found`);
            }
            // Merge metadata
            const versionMetadata = {
                ...originalFile.metadata,
                ...metadata,
                originalName: metadata.originalName || originalFile.original_name,
            };
            // Create new version
            const newVersion = await this.storeFile(fileBuffer, versionMetadata);
            newVersion.version = originalFile.version + 1;
            newVersion.parent_file_id = originalFileId;
            logger.info(`Created version ${newVersion.version} of file ${originalFileId}`, "FILE_STORAGE");
            return newVersion;
        }
        catch (error) {
            logger.error(`Failed to create version: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Delete a file (move to quarantine for safety)
     */
    async deleteFile(fileId, permanent = false) {
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
            }
            else {
                // Move to quarantine
                const quarantinePath = join(this.quarantinePath, `${fileId}_${Date.now()}`);
                await fs.rename(sourcePath, quarantinePath);
                logger.info(`Moved file ${fileId} to quarantine`, "FILE_STORAGE");
            }
            // In a real implementation, update database record
            return true;
        }
        catch (error) {
            logger.error(`Failed to delete file ${fileId}: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Get file versions
     */
    async getFileVersions(fileId) {
        try {
            // In a real implementation, this would query the database
            // For now, return mock data
            const baseFile = await this.findFileById(fileId);
            if (!baseFile) {
                return [];
            }
            return [baseFile]; // Would include all versions in real implementation
        }
        catch (error) {
            logger.error(`Failed to get file versions for ${fileId}: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Search files by metadata
     */
    async searchFiles(criteria) {
        try {
            // In a real implementation, this would use database queries
            // For now, return empty array
            logger.info(`Searching files with criteria: ${JSON.stringify(criteria)}`, "FILE_STORAGE");
            return [];
        }
        catch (error) {
            logger.error(`File search failed: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            // Calculate directory sizes
            const categories = [
                "documents",
                "attachments",
                "images",
                "exports",
                "backups",
            ];
            const categorySizes = {};
            let totalSize = 0;
            let totalFiles = 0;
            for (const category of categories) {
                const categoryPath = join(this.basePath, category);
                try {
                    const stats = await this.getDirectoryStats(categoryPath);
                    categorySizes[category] = stats.size;
                    totalSize += stats.size;
                    totalFiles += stats.files;
                }
                catch (error) {
                    categorySizes[category] = 0;
                }
            }
            // Get disk space info (simplified)
            let availableSpace = 0;
            try {
                const stats = await fs.stat(this.basePath);
                // This is a simplified calculation - in production, use statvfs or similar
                availableSpace = 1024 * 1024 * 1024 * 10; // 10GB placeholder
            }
            catch (error) {
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
        }
        catch (error) {
            logger.error(`Failed to get storage stats: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Clean up old files and empty directories
     */
    async cleanup(options = {}) {
        try {
            let filesDeleted = 0;
            let directoriesDeleted = 0;
            let spaceFreed = 0;
            const { olderThanDays = 30, emptyDirectories = true, quarantine = true, } = options;
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
            logger.info(`Cleanup completed: ${filesDeleted} files, ${directoriesDeleted} directories, ${spaceFreed} bytes freed`, "FILE_STORAGE");
            return { filesDeleted, directoriesDeleted, spaceFreed };
        }
        catch (error) {
            logger.error(`Cleanup failed: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Create a backup of the storage system
     */
    async createBackup(backupPath) {
        try {
            const backupId = uuidv4();
            const backupDir = join(backupPath, `backup_${backupId}_${Date.now()}`);
            await fs.mkdir(backupDir, { recursive: true });
            // Copy files (simplified - in production, use streaming and compression)
            await this.copyDirectory(this.basePath, backupDir);
            logger.info(`Storage backup created at ${backupDir}`, "FILE_STORAGE");
            return backupDir;
        }
        catch (error) {
            logger.error(`Backup creation failed: ${error}`, "FILE_STORAGE");
            throw error;
        }
    }
    /**
     * Validate file before storage
     */
    async validateFile(fileBuffer, metadata) {
        // Size validation
        if (fileBuffer?.length || 0 > this.maxFileSize) {
            throw new Error(`File size ${fileBuffer?.length || 0} exceeds maximum ${this.maxFileSize}`);
        }
        // Extension validation
        if (this?.allowedExtensions?.size > 0) {
            const extension = this.getFileExtension(metadata.originalName).toLowerCase();
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
    async isFileSuspicious(fileBuffer) {
        // Placeholder for actual virus scanning
        // In production, integrate with ClamAV or similar
        const suspicious = [
            Buffer.from("virus"),
            Buffer.from("malware"),
            Buffer.from("trojan"),
        ];
        return suspicious.some((pattern) => fileBuffer.includes(pattern));
    }
    /**
     * Calculate file checksum
     */
    calculateChecksum(buffer) {
        return createHash("sha256").update(buffer).digest("hex");
    }
    /**
     * Get file extension
     */
    getFileExtension(filename) {
        return extname(filename).toLowerCase();
    }
    /**
     * Detect content type from filename
     */
    detectContentType(filename) {
        const extension = this.getFileExtension(filename);
        const mimeTypes = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument?.wordprocessingml?.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument?.spreadsheetml?.sheet",
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
    getDatePath() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return join(year.toString(), month, day);
    }
    /**
     * Sanitize metadata
     */
    sanitizeMetadata(metadata) {
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
    async findFileById(fileId) {
        // This would be a database query in real implementation
        return null;
    }
    async findFileByChecksum(checksum) {
        // This would be a database query in real implementation
        return null;
    }
    /**
     * Get directory statistics
     */
    async getDirectoryStats(dirPath) {
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
                }
                else {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                    totalFiles++;
                }
            }
        }
        catch (error) {
            // Directory might not exist
        }
        return { size: totalSize, files: totalFiles };
    }
    /**
     * Check if date is older than specified days
     */
    isOlderThan(date, days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return date < cutoff;
    }
    /**
     * Remove empty directories recursively
     */
    async removeEmptyDirectories(dirPath) {
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
        }
        catch (error) {
            // Directory might have been removed already
        }
        return removed;
    }
    /**
     * Copy directory recursively
     */
    async copyDirectory(source, destination) {
        await fs.mkdir(destination, { recursive: true });
        const entries = await fs.readdir(source, { withFileTypes: true });
        for (const entry of entries) {
            const sourcePath = join(source, entry.name);
            const destPath = join(destination, entry.name);
            if (entry.isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            }
            else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }
}
