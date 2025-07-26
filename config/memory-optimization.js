/**
 * Memory Optimization Configuration
 * Comprehensive solution for fixing memory threshold errors
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Memory thresholds and limits
const MEMORY_CONFIG = {
  // Node.js heap settings
  maxOldSpaceSize: 2048, // 2GB max heap
  maxSemiSpaceSize: 128,  // 128MB for young generation
  
  // Application memory thresholds
  thresholds: {
    warning: 512 * 1024 * 1024,    // 512MB warning
    critical: 768 * 1024 * 1024,   // 768MB critical
    emergency: 900 * 1024 * 1024,  // 900MB emergency cleanup
    restart: 1024 * 1024 * 1024     // 1GB restart threshold
  },
  
  // Cache management
  cache: {
    maxSize: 256 * 1024 * 1024,     // 256MB max cache size
    maxEntries: 10000,              // Max 10k cache entries
    ttl: 1800000,                   // 30 minutes TTL
    cleanupInterval: 300000,        // 5 minutes cleanup
    compressionThreshold: 1024      // Compress entries > 1KB
  },
  
  // Garbage collection
  gc: {
    interval: 60000,                // 1 minute GC interval
    forceInterval: 300000,          // 5 minutes force GC
    thresholdMultiplier: 1.5        // Trigger GC at 1.5x threshold
  },
  
  // Data persistence
  persistence: {
    enabled: true,
    batchSize: 1000,                // Persist in batches
    compressionLevel: 6,            // Compression level
    backupInterval: 1800000,        // 30 minutes backup
    maxBackups: 5                   // Keep 5 backups
  }
};

class MemoryManager {
  constructor(config = MEMORY_CONFIG) {
    this.config = config;
    this.cache = new Map();
    this.accessTimes = new Map();
    this.compressionCache = new Map();
    this.persistenceQueue = [];
    this.isCleaningUp = false;
    
    this.init();
  }
  
  init() {
    this.setupMemoryMonitoring();
    this.setupGarbageCollection();
    this.setupCacheCleanup();
    this.setupPersistence();
    this.setupProcessHandlers();
  }
  
  setupMemoryMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsed = usage.heapUsed;
      
      console.log(`📊 Memory Usage: ${Math.round(heapUsed / 1024 / 1024)}MB heap used`);
      
      if (heapUsed > this.config.thresholds.emergency) {
        this.emergencyCleanup();
      } else if (heapUsed > this.config.thresholds.critical) {
        this.criticalCleanup();
      } else if (heapUsed > this.config.thresholds.warning) {
        this.warningCleanup();
      }
    }, 10000); // Check every 10 seconds
  }
  
  setupGarbageCollection() {
    if (global.gc) {
      setInterval(() => {
        const usage = process.memoryUsage();
        if (usage.heapUsed > this.config.thresholds.warning) {
          global.gc();
          console.log('🗑️  Manual garbage collection triggered');
        }
      }, this.config.gc.interval);
      
      // Force GC periodically
      setInterval(() => {
        global.gc();
        console.log('🔄 Scheduled garbage collection completed');
      }, this.config.gc.forceInterval);
    }
  }
  
  setupCacheCleanup() {
    setInterval(() => {
      this.cleanupExpiredEntries();
      this.enforceSizeLimits();
    }, this.config.cache.cleanupInterval);
  }
  
  setupPersistence() {
    if (this.config.persistence.enabled) {
      setInterval(() => {
        this.persistCacheData();
      }, this.config.persistence.backupInterval);
      
      // Load existing cache data on startup
      this.loadPersistedData();
    }
  }
  
  setupProcessHandlers() {
    process.on('SIGINT', () => {
      console.log('🛑 Gracefully shutting down...');
      this.persistCacheData();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('🛑 Termination signal received...');
      this.persistCacheData();
      process.exit(0);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      this.emergencyCleanup();
      this.persistCacheData();
    });
  }
  
  warningCleanup() {
    const removed = this.removeOldEntries(0.1); // Remove 10% oldest
    console.log(`⚠️  Warning cleanup: removed ${removed} entries`);
  }
  
  criticalCleanup() {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;
    
    const removed = this.removeOldEntries(0.3); // Remove 30% oldest
    this.compressLargeEntries();
    this.clearCompressionCache();
    
    console.log(`🚨 Critical cleanup: removed ${removed} entries`);
    
    setTimeout(() => {
      this.isCleaningUp = false;
    }, 5000);
  }
  
  emergencyCleanup() {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;
    
    // Persist critical data before cleanup
    this.persistCacheData();
    
    // Aggressive cleanup
    const removed = this.removeOldEntries(0.7); // Remove 70% oldest
    this.clearCompressionCache();
    this.compressionCache.clear();
    
    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
    
    console.log(`🆘 Emergency cleanup: removed ${removed} entries`);
    
    setTimeout(() => {
      this.isCleaningUp = false;
    }, 10000);
  }
  
  removeOldEntries(percentage) {
    const entries = Array.from(this.accessTimes.entries());
    entries.sort((a, b) => a[1] - b[1]); // Sort by access time
    
    const toRemove = Math.floor(entries.length * percentage);
    let removed = 0;
    
    for (let i = 0; i < toRemove; i++) {
      const key = entries[i][0];
      this.cache.delete(key);
      this.accessTimes.delete(key);
      removed++;
    }
    
    return removed;
  }
  
  cleanupExpiredEntries() {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, accessTime] of this.accessTimes.entries()) {
      if (now - accessTime > this.config.cache.ttl) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`🗑️  Evicted ${removed} old cache entries`);
    }
    
    return removed;
  }
  
  enforceSizeLimits() {
    let removed = 0;
    
    // Check entry count limit
    if (this.cache.size > this.config.cache.maxEntries) {
      const excess = this.cache.size - this.config.cache.maxEntries;
      removed += this.removeOldEntries(excess / this.cache.size);
    }
    
    // Check memory size limit (approximate)
    const estimatedSize = this.getEstimatedCacheSize();
    if (estimatedSize > this.config.cache.maxSize) {
      const reduction = 0.3; // Remove 30% when over size limit
      removed += this.removeOldEntries(reduction);
    }
    
    if (removed > 0) {
      console.log(`🗑️  Enforced size limits, evicted ${removed} entries`);
    }
    
    return removed;
  }
  
  getEstimatedCacheSize() {
    let size = 0;
    for (const [key, value] of this.cache.entries()) {
      size += JSON.stringify(key).length * 2; // UTF-16
      size += JSON.stringify(value).length * 2;
    }
    return size;
  }
  
  compressLargeEntries() {
    const zlib = require('zlib');
    let compressed = 0;
    
    for (const [key, value] of this.cache.entries()) {
      const serialized = JSON.stringify(value);
      if (serialized.length > this.config.cache.compressionThreshold) {
        try {
          const compressed_data = zlib.gzipSync(serialized);
          this.compressionCache.set(key, compressed_data);
          compressed++;
        } catch (error) {
          console.error('Compression error:', error.message);
        }
      }
    }
    
    if (compressed > 0) {
      console.log(`🗜️  Compressed ${compressed} large cache entries`);
    }
  }
  
  clearCompressionCache() {
    this.compressionCache.clear();
    console.log('🧹 Cleared compression cache');
  }
  
  persistCacheData() {
    if (!this.config.persistence.enabled) return;
    
    try {
      const dataDir = path.join(process.cwd(), 'data', 'cache-backups');
      
      // Ensure directory exists
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(dataDir, `cache-backup-${timestamp}.json.gz`);
      
      // Prepare data for persistence
      const cacheData = {};
      const accessData = {};
      
      for (const [key, value] of this.cache.entries()) {
        cacheData[key] = value;
        accessData[key] = this.accessTimes.get(key);
      }
      
      const backupData = {
        cache: cacheData,
        accessTimes: accessData,
        timestamp: Date.now(),
        version: '1.0.0'
      };
      
      // Compress and save
      const zlib = require('zlib');
      const compressed = zlib.gzipSync(JSON.stringify(backupData));
      fs.writeFileSync(backupFile, compressed);
      
      console.log(`💾 Cache data persisted to ${backupFile}`);
      
      // Clean up old backups
      this.cleanupOldBackups(dataDir);
      
    } catch (error) {
      console.error('❌ Error persisting cache data:', error.message);
    }
  }
  
  loadPersistedData() {
    try {
      const dataDir = path.join(process.cwd(), 'data', 'cache-backups');
      
      if (!fs.existsSync(dataDir)) return;
      
      const backupFiles = fs.readdirSync(dataDir)
        .filter(f => f.startsWith('cache-backup-') && f.endsWith('.json.gz'))
        .sort()
        .reverse(); // Most recent first
      
      if (backupFiles.length === 0) return;
      
      const latestBackup = path.join(dataDir, backupFiles[0]);
      const zlib = require('zlib');
      const compressed = fs.readFileSync(latestBackup);
      const decompressed = zlib.gunzipSync(compressed);
      const backupData = JSON.parse(decompressed.toString());
      
      // Restore cache data
      for (const [key, value] of Object.entries(backupData.cache)) {
        this.cache.set(key, value);
        this.accessTimes.set(key, backupData.accessTimes[key] || Date.now());
      }
      
      console.log(`📥 Loaded ${this.cache.size} cache entries from backup`);
      
    } catch (error) {
      console.error('❌ Error loading persisted data:', error.message);
    }
  }
  
  cleanupOldBackups(dataDir) {
    try {
      const backupFiles = fs.readdirSync(dataDir)
        .filter(f => f.startsWith('cache-backup-') && f.endsWith('.json.gz'))
        .map(f => ({
          name: f,
          path: path.join(dataDir, f),
          mtime: fs.statSync(path.join(dataDir, f)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      // Keep only the latest N backups
      if (backupFiles.length > this.config.persistence.maxBackups) {
        const toDelete = backupFiles.slice(this.config.persistence.maxBackups);
        
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
        }
        
        console.log(`🗑️  Cleaned up ${toDelete.length} old backups`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old backups:', error.message);
    }
  }
  
  // Public API methods
  set(key, value) {
    this.cache.set(key, value);
    this.accessTimes.set(key, Date.now());
  }
  
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.accessTimes.set(key, Date.now());
    }
    return value;
  }
  
  has(key) {
    return this.cache.has(key);
  }
  
  delete(key) {
    this.cache.delete(key);
    this.accessTimes.delete(key);
  }
  
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.compressionCache.clear();
  }
  
  getStats() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      cacheSize: this.cache.size,
      compressionCacheSize: this.compressionCache.size,
      estimatedCacheMemory: this.getEstimatedCacheSize()
    };
  }
}

module.exports = {
  MEMORY_CONFIG,
  MemoryManager
};