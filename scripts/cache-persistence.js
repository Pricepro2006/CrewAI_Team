#!/usr/bin/env node

/**
 * Cache Persistence Manager
 * Handles persistent storage of cache data to prevent data loss during memory cleanup
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

class CachePersistenceManager {
  constructor(options = {}) {
    this.config = {
      dataDir: options.dataDir || path.join(process.cwd(), 'data', 'cache-storage'),
      compressionLevel: options.compressionLevel || 6,
      maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
      indexFile: options.indexFile || 'cache-index.json',
      segmentPrefix: options.segmentPrefix || 'cache-segment-',
      encryptionKey: options.encryptionKey || null,
      checksumValidation: options.checksumValidation || true,
      rotationSize: options.rotationSize || 100 * 1024 * 1024, // 100MB
      maxSegments: options.maxSegments || 10
    };
    
    this.index = new Map();
    this.currentSegment = 0;
    this.segmentSizes = new Map();
    
    this.init();
  }
  
  init() {
    this.ensureDataDirectory();
    this.loadIndex();
    this.validateSegments();
  }
  
  ensureDataDirectory() {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
      console.log(`📁 Created cache storage directory: ${this.config.dataDir}`);
    }
  }
  
  loadIndex() {
    const indexPath = path.join(this.config.dataDir, this.config.indexFile);
    
    try {
      if (fs.existsSync(indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        
        for (const [key, metadata] of Object.entries(indexData.entries || {})) {
          this.index.set(key, metadata);
        }
        
        this.currentSegment = indexData.currentSegment || 0;
        
        for (const [segment, size] of Object.entries(indexData.segmentSizes || {})) {
          this.segmentSizes.set(parseInt(segment), size);
        }
        
        console.log(`📋 Loaded cache index with ${this.index.size} entries`);
      }
    } catch (error) {
      console.error('❌ Error loading cache index:', error.message);
      this.rebuildIndex();
    }
  }
  
  saveIndex() {
    const indexPath = path.join(this.config.dataDir, this.config.indexFile);
    
    try {
      const indexData = {
        version: '1.0.0',
        timestamp: Date.now(),
        currentSegment: this.currentSegment,
        entries: Object.fromEntries(this.index),
        segmentSizes: Object.fromEntries(this.segmentSizes)
      };
      
      fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      console.error('❌ Error saving cache index:', error.message);
    }
  }
  
  validateSegments() {
    const segmentFiles = this.getSegmentFiles();
    let validated = 0;
    let corrupted = 0;
    
    for (const file of segmentFiles) {
      try {
        const segmentPath = path.join(this.config.dataDir, file);
        const stats = fs.statSync(segmentPath);
        
        if (this.config.checksumValidation) {
          const isValid = this.validateSegmentChecksum(segmentPath);
          if (!isValid) {
            console.warn(`⚠️  Corrupted segment detected: ${file}`);
            corrupted++;
            continue;
          }
        }
        
        validated++;
      } catch (error) {
        console.warn(`⚠️  Error validating segment ${file}:`, error.message);
        corrupted++;
      }
    }
    
    if (validated > 0) {
      console.log(`✅ Validated ${validated} cache segments`);
    }
    if (corrupted > 0) {
      console.warn(`⚠️  Found ${corrupted} corrupted segments`);
    }
  }
  
  getSegmentFiles() {
    try {
      return fs.readdirSync(this.config.dataDir)
        .filter(f => f.startsWith(this.config.segmentPrefix) && f.endsWith('.gz'))
        .sort();
    } catch (error) {
      console.error('❌ Error reading segment files:', error.message);
      return [];
    }
  }
  
  validateSegmentChecksum(segmentPath) {
    try {
      const data = fs.readFileSync(segmentPath);
      const checksumPath = segmentPath + '.checksum';
      
      if (!fs.existsSync(checksumPath)) {
        return false; // No checksum file
      }
      
      const expectedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
      const actualChecksum = crypto.createHash('sha256').update(data).digest('hex');
      
      return expectedChecksum === actualChecksum;
    } catch (error) {
      return false;
    }
  }
  
  createSegmentChecksum(segmentPath) {
    try {
      const data = fs.readFileSync(segmentPath);
      const checksum = crypto.createHash('sha256').update(data).digest('hex');
      const checksumPath = segmentPath + '.checksum';
      
      fs.writeFileSync(checksumPath, checksum);
    } catch (error) {
      console.error('❌ Error creating segment checksum:', error.message);
    }
  }
  
  getNextSegmentPath() {
    const segmentFile = `${this.config.segmentPrefix}${this.currentSegment}.gz`;
    return path.join(this.config.dataDir, segmentFile);
  }
  
  rotateSegment() {
    this.currentSegment++;
    
    // Clean up old segments if we exceed the maximum
    if (this.currentSegment >= this.config.maxSegments) {
      this.cleanupOldSegments();
    }
    
    console.log(`🔄 Rotated to segment ${this.currentSegment}`);
  }
  
  cleanupOldSegments() {
    const segmentFiles = this.getSegmentFiles();
    
    if (segmentFiles.length > this.config.maxSegments) {
      const oldestSegments = segmentFiles.slice(0, segmentFiles.length - this.config.maxSegments);
      
      for (const segmentFile of oldestSegments) {
        try {
          const segmentPath = path.join(this.config.dataDir, segmentFile);
          const checksumPath = segmentPath + '.checksum';
          
          fs.unlinkSync(segmentPath);
          if (fs.existsSync(checksumPath)) {
            fs.unlinkSync(checksumPath);
          }
          
          // Remove entries from index
          const segmentNumber = this.extractSegmentNumber(segmentFile);
          const keysToRemove = [];
          
          for (const [key, metadata] of this.index.entries()) {
            if (metadata.segment === segmentNumber) {
              keysToRemove.push(key);
            }
          }
          
          keysToRemove.forEach(key => this.index.delete(key));
          this.segmentSizes.delete(segmentNumber);
          
        } catch (error) {
          console.error(`❌ Error cleaning up segment ${segmentFile}:`, error.message);
        }
      }
      
      console.log(`🗑️  Cleaned up ${oldestSegments.length} old segments`);
    }
  }
  
  extractSegmentNumber(segmentFile) {
    const match = segmentFile.match(/cache-segment-(\d+)\.gz/);
    return match ? parseInt(match[1]) : 0;
  }
  
  async persistData(data, options = {}) {
    try {
      const key = options.key || crypto.randomUUID();
      const timestamp = Date.now();
      
      // Prepare data for storage
      const storageData = {
        key,
        data,
        timestamp,
        metadata: options.metadata || {},
        version: '1.0.0'
      };
      
      // Serialize and compress
      let serialized = JSON.stringify(storageData);
      
      // Encrypt if key is provided
      if (this.config.encryptionKey) {
        serialized = this.encrypt(serialized);
      }
      
      const compressed = zlib.gzipSync(Buffer.from(serialized), {
        level: this.config.compressionLevel
      });
      
      // Check if current segment needs rotation
      const currentSegmentPath = this.getNextSegmentPath();
      const currentSize = this.segmentSizes.get(this.currentSegment) || 0;
      
      if (currentSize + compressed.length > this.config.rotationSize) {
        this.rotateSegment();
      }
      
      // Write to current segment
      const segmentPath = this.getNextSegmentPath();
      const segmentData = this.loadSegmentData(segmentPath);
      segmentData[key] = compressed.toString('base64');
      
      // Write segment file
      const segmentContent = zlib.gzipSync(JSON.stringify(segmentData));
      fs.writeFileSync(segmentPath, segmentContent);
      
      // Create checksum
      if (this.config.checksumValidation) {
        this.createSegmentChecksum(segmentPath);
      }
      
      // Update index
      this.index.set(key, {
        segment: this.currentSegment,
        size: compressed.length,
        timestamp,
        checksum: crypto.createHash('md5').update(compressed).digest('hex')
      });
      
      // Update segment size
      const newSize = fs.statSync(segmentPath).size;
      this.segmentSizes.set(this.currentSegment, newSize);
      
      // Save index
      this.saveIndex();
      
      return key;
      
    } catch (error) {
      console.error('❌ Error persisting data:', error.message);
      throw error;
    }
  }
  
  async retrieveData(key) {
    try {
      const metadata = this.index.get(key);
      if (!metadata) {
        return null; // Key not found
      }
      
      const segmentPath = path.join(
        this.config.dataDir,
        `${this.config.segmentPrefix}${metadata.segment}.gz`
      );
      
      if (!fs.existsSync(segmentPath)) {
        console.warn(`⚠️  Segment file not found: ${segmentPath}`);
        this.index.delete(key);
        return null;
      }
      
      // Load segment data
      const segmentData = this.loadSegmentData(segmentPath);
      const compressedData = segmentData[key];
      
      if (!compressedData) {
        console.warn(`⚠️  Key not found in segment: ${key}`);
        this.index.delete(key);
        return null;
      }
      
      // Decompress and deserialize
      const compressed = Buffer.from(compressedData, 'base64');
      
      // Validate checksum
      const actualChecksum = crypto.createHash('md5').update(compressed).digest('hex');
      if (actualChecksum !== metadata.checksum) {
        console.warn(`⚠️  Checksum mismatch for key: ${key}`);
        return null;
      }
      
      let decompressed = zlib.gunzipSync(compressed);
      let serialized = decompressed.toString();
      
      // Decrypt if needed
      if (this.config.encryptionKey) {
        serialized = this.decrypt(serialized);
      }
      
      const storageData = JSON.parse(serialized);
      return storageData.data;
      
    } catch (error) {
      console.error('❌ Error retrieving data:', error.message);
      return null;
    }
  }
  
  loadSegmentData(segmentPath) {
    try {
      if (!fs.existsSync(segmentPath)) {
        return {};
      }
      
      const compressed = fs.readFileSync(segmentPath);
      const decompressed = zlib.gunzipSync(compressed);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.warn(`⚠️  Error loading segment data: ${error.message}`);
      return {};
    }
  }
  
  encrypt(data) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.config.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }
  
  decrypt(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipher(algorithm, this.config.encryptionKey);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  rebuildIndex() {
    console.log('🔧 Rebuilding cache index...');
    
    this.index.clear();
    this.segmentSizes.clear();
    
    const segmentFiles = this.getSegmentFiles();
    
    for (const segmentFile of segmentFiles) {
      try {
        const segmentNumber = this.extractSegmentNumber(segmentFile);
        const segmentPath = path.join(this.config.dataDir, segmentFile);
        const segmentData = this.loadSegmentData(segmentPath);
        
        for (const key of Object.keys(segmentData)) {
          this.index.set(key, {
            segment: segmentNumber,
            timestamp: Date.now(),
            size: Buffer.from(segmentData[key], 'base64').length
          });
        }
        
        const stats = fs.statSync(segmentPath);
        this.segmentSizes.set(segmentNumber, stats.size);
        
      } catch (error) {
        console.error(`❌ Error processing segment ${segmentFile}:`, error.message);
      }
    }
    
    this.currentSegment = Math.max(...Array.from(this.segmentSizes.keys()), -1) + 1;
    this.saveIndex();
    
    console.log(`✅ Rebuilt index with ${this.index.size} entries`);
  }
  
  getStats() {
    const totalSize = Array.from(this.segmentSizes.values()).reduce((sum, size) => sum + size, 0);
    const segmentCount = this.segmentSizes.size;
    
    return {
      totalEntries: this.index.size,
      segmentCount,
      currentSegment: this.currentSegment,
      totalStorageSize: totalSize,
      averageSegmentSize: segmentCount > 0 ? Math.round(totalSize / segmentCount) : 0,
      dataDirectory: this.config.dataDir
    };
  }
  
  cleanup() {
    this.saveIndex();
    console.log('💾 Cache persistence cleanup completed');
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const persistence = new CachePersistenceManager();
  
  switch (command) {
    case 'stats':
      console.log('📊 Cache Persistence Stats:');
      console.table(persistence.getStats());
      break;
      
    case 'rebuild':
      persistence.rebuildIndex();
      break;
      
    case 'cleanup':
      persistence.cleanupOldSegments();
      break;
      
    default:
      console.log('Usage: node cache-persistence.js [stats|rebuild|cleanup]');
  }
}

module.exports = CachePersistenceManager;