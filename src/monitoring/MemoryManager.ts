/**
 * MemoryManager - Comprehensive memory management and garbage collection system
 * 
 * Features:
 * - Real-time memory monitoring with configurable thresholds
 * - Automatic garbage collection triggering
 * - Memory leak detection and alerting
 * - Heap snapshot generation for debugging
 * - Object pooling and weak reference management
 * - Graceful degradation under memory pressure
 * - Service-specific memory limits and policies
 * 
 * @module MemoryManager
 */

import v8 from 'v8';
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';

export interface MemoryConfiguration {
  service: string;
  maxHeapSize: number; // in MB
  warningThreshold: number; // percentage (0-1)
  criticalThreshold: number; // percentage (0-1)
  gcInterval: number; // milliseconds
  heapSnapshotOnCritical: boolean;
  enableAutoGC: boolean;
  enableMemoryProfiling: boolean;
  snapshotDir: string;
  restartOnOOM: boolean;
  maxRestarts: number;
  restartCooldown: number; // milliseconds
}

export interface MemoryMetrics {
  timestamp: number;
  service: string;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  heapUsedPercent: number;
  isWarning: boolean;
  isCritical: boolean;
  gcCount: number;
  gcDuration: number;
  leakSuspected: boolean;
}

export interface LeakDetectionResult {
  suspected: boolean;
  growthRate: number; // MB per minute
  samples: number;
  confidence: number; // 0-1
  message: string;
}

export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

class MemoryManager extends EventEmitter {
  private static instances = new Map<string, MemoryManager>();
  
  private config: MemoryConfiguration;
  private metrics: MemoryMetrics[] = [];
  private gcCount = 0;
  private gcTotalDuration = 0;
  private monitoringInterval?: NodeJS.Timeout;
  private gcInterval?: NodeJS.Timeout;
  private restartCount = 0;
  private lastRestartTime = 0;
  private isShuttingDown = false;
  private objectPools = new Map<string, ObjectPool<any>>();
  private weakRefs = new Map<string, WeakRef<any>>();
  private finalizationRegistry: FinalizationRegistry<string>;
  
  // Memory growth tracking for leak detection
  private memoryGrowthSamples: number[] = [];
  private readonly LEAK_DETECTION_SAMPLES = 10;
  private readonly LEAK_GROWTH_THRESHOLD = 5; // MB per minute
  
  private constructor(config: MemoryConfiguration) {
    super();
    
    this.config = {
      warningThreshold: 0.7,
      criticalThreshold: 0.85,
      gcInterval: 60000,
      heapSnapshotOnCritical: true,
      enableAutoGC: true,
      enableMemoryProfiling: false,
      snapshotDir: './memory-snapshots',
      restartOnOOM: true,
      maxRestarts: 3,
      restartCooldown: 300000, // 5 minutes
      ...config
    };
    
    // Create snapshot directory if it doesn't exist
    if (!existsSync(this?.config?.snapshotDir)) {
      mkdirSync(this?.config?.snapshotDir, { recursive: true });
    }
    
    // Setup finalization registry for weak reference cleanup
    this.finalizationRegistry = new FinalizationRegistry((key: string) => {
      this?.weakRefs?.delete(key);
      logger.debug(`Weak reference cleaned up: ${key}`, 'MEMORY_MANAGER');
    });
    
    this.initialize();
  }
  
  /**
   * Get or create a MemoryManager instance for a service
   */
  static getInstance(config: MemoryConfiguration): MemoryManager {
    if (!MemoryManager?.instances?.has(config.service)) {
      MemoryManager?.instances?.set(config.service, new MemoryManager(config));
    }
    return MemoryManager?.instances?.get(config.service)!;
  }
  
  /**
   * Initialize memory monitoring and management
   */
  private initialize(): void {
    // Set max heap size if specified
    if (this?.config?.maxHeapSize) {
      const maxHeapBytes = this?.config?.maxHeapSize * 1024 * 1024;
      try {
        v8.setFlagsFromString(`--max-old-space-size=${this?.config?.maxHeapSize}`);
        logger.info(`Max heap size set to ${this?.config?.maxHeapSize}MB`, 'MEMORY_MANAGER', {
          service: this?.config?.service
        });
      } catch (error) {
        logger.error('Failed to set max heap size', 'MEMORY_MANAGER', { error });
      }
    }
    
    // Start monitoring
    this.startMonitoring();
    
    // Start automatic GC if enabled
    if (this?.config?.enableAutoGC) {
      this.startAutoGC();
    }
    
    // Setup process event handlers
    this.setupProcessHandlers();
    
    logger.info('Memory manager initialized', 'MEMORY_MANAGER', {
      service: this?.config?.service,
      maxHeapSize: this?.config?.maxHeapSize,
      warningThreshold: this?.config?.warningThreshold * 100 + '%',
      criticalThreshold: this?.config?.criticalThreshold * 100 + '%'
    });
  }
  
  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    const monitorInterval = 10000; // Check every 10 seconds
    
    this.monitoringInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this?.metrics?.push(metrics);
      
      // Keep only last hour of metrics
      const oneHourAgo = Date.now() - 3600000;
      this.metrics = this?.metrics?.filter(m => m.timestamp > oneHourAgo);
      
      // Check for memory leaks
      this.checkForLeaks(metrics);
      
      // Handle memory pressure
      this.handleMemoryPressure(metrics);
      
      // Emit metrics event
      this.emit('metrics', metrics);
      
    }, monitorInterval);
  }
  
  /**
   * Collect current memory metrics
   */
  private collectMetrics(): MemoryMetrics {
    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    
    const heapUsedPercent = memUsage.heapUsed / heapStats.heap_size_limit;
    const isWarning = heapUsedPercent >= this?.config?.warningThreshold;
    const isCritical = heapUsedPercent >= this?.config?.criticalThreshold;
    
    const metrics: MemoryMetrics = {
      timestamp: Date.now(),
      service: this?.config?.service,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      heapUsedPercent,
      isWarning,
      isCritical,
      gcCount: this.gcCount,
      gcDuration: this.gcTotalDuration,
      leakSuspected: false
    };
    
    // Log metrics
    if (isCritical) {
      logger.error('Critical memory usage', 'MEMORY_MANAGER', metrics);
    } else if (isWarning) {
      logger.warn('High memory usage', 'MEMORY_MANAGER', metrics);
    } else {
      logger.debug('Memory metrics collected', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapUsedPercent: Math.round(heapUsedPercent * 100) + '%'
      });
    }
    
    return metrics;
  }
  
  /**
   * Check for memory leaks
   */
  private checkForLeaks(metrics: MemoryMetrics): LeakDetectionResult {
    // Track memory growth
    this?.memoryGrowthSamples?.push(metrics.heapUsed);
    
    if (this?.memoryGrowthSamples?.length > this.LEAK_DETECTION_SAMPLES) {
      this?.memoryGrowthSamples?.shift();
    }
    
    if (this?.memoryGrowthSamples?.length < this.LEAK_DETECTION_SAMPLES) {
      return {
        suspected: false,
        growthRate: 0,
        samples: this?.memoryGrowthSamples?.length,
        confidence: 0,
        message: 'Insufficient samples for leak detection'
      };
    }
    
    // Calculate growth rate
    const firstSample = this.memoryGrowthSamples[0];
    const lastSample = this.memoryGrowthSamples[this?.memoryGrowthSamples?.length - 1];
    const timeDiff = (this.LEAK_DETECTION_SAMPLES * 10) / 60; // minutes
    const growthRate = (lastSample - firstSample) / 1024 / 1024 / timeDiff; // MB per minute
    
    // Check if growth is consistently increasing
    let increasingCount = 0;
    for (let i = 1; i < this?.memoryGrowthSamples?.length; i++) {
      if (this.memoryGrowthSamples[i] > this.memoryGrowthSamples[i - 1]) {
        increasingCount++;
      }
    }
    
    const confidence = increasingCount / (this?.memoryGrowthSamples?.length - 1);
    const suspected = growthRate > this.LEAK_GROWTH_THRESHOLD && confidence > 0.7;
    
    const result: LeakDetectionResult = {
      suspected,
      growthRate,
      samples: this?.memoryGrowthSamples?.length,
      confidence,
      message: suspected 
        ? `Potential memory leak detected: ${growthRate.toFixed(2)}MB/min growth`
        : 'No memory leak detected'
    };
    
    if (suspected) {
      logger.error('Memory leak suspected', 'MEMORY_MANAGER', result);
      metrics.leakSuspected = true;
      this.emit('leak-detected', result);
      
      // Take heap snapshot for analysis
      if (this?.config?.heapSnapshotOnCritical) {
        this.takeHeapSnapshot('leak-detection');
      }
    }
    
    return result;
  }
  
  /**
   * Handle memory pressure situations
   */
  private handleMemoryPressure(metrics: MemoryMetrics): void {
    if (metrics.isCritical) {
      logger.error('Critical memory pressure', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        heapUsedPercent: Math.round(metrics.heapUsedPercent * 100) + '%'
      });
      
      // Take heap snapshot for debugging
      if (this?.config?.heapSnapshotOnCritical) {
        this.takeHeapSnapshot('critical');
      }
      
      // Force garbage collection
      this.forceGC();
      
      // Clear object pools
      this.clearAllPools();
      
      // Emit critical event
      this.emit('critical-pressure', metrics);
      
      // Consider restart if configured
      if (this?.config?.restartOnOOM) {
        this.considerRestart(metrics);
      }
      
    } else if (metrics.isWarning) {
      logger.warn('Memory pressure warning', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        heapUsedPercent: Math.round(metrics.heapUsedPercent * 100) + '%'
      });
      
      // Trigger GC
      this.forceGC();
      
      // Emit warning event
      this.emit('warning-pressure', metrics);
    }
  }
  
  /**
   * Consider restarting the service due to memory pressure
   */
  private considerRestart(metrics: MemoryMetrics): void {
    const now = Date.now();
    
    // Check if we're within cooldown period
    if (now - this.lastRestartTime < this?.config?.restartCooldown) {
      logger.warn('Restart cooldown active', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        cooldownRemaining: this?.config?.restartCooldown - (now - this.lastRestartTime)
      });
      return;
    }
    
    // Check if we've exceeded max restarts
    if (this.restartCount >= this?.config?.maxRestarts) {
      logger.error('Max restarts exceeded - manual intervention required', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        restartCount: this.restartCount
      });
      this.emit('max-restarts-exceeded', { metrics, restartCount: this.restartCount });
      return;
    }
    
    logger.warn('Initiating service restart due to memory pressure', 'MEMORY_MANAGER', {
      service: this?.config?.service,
      restartCount: this.restartCount + 1,
      heapUsedPercent: Math.round(metrics.heapUsedPercent * 100) + '%'
    });
    
    this.restartCount++;
    this.lastRestartTime = now;
    
    // Emit restart event
    this.emit('restart-initiated', { metrics, restartCount: this.restartCount });
    
    // Perform graceful shutdown
    this.gracefulShutdown().then(() => {
      process.exit(1); // Exit with error code to trigger restart
    });
  }
  
  /**
   * Start automatic garbage collection
   */
  private startAutoGC(): void {
    this.gcInterval = setInterval(() => {
      const metrics = this.getCurrentMetrics();
      
      // Only run GC if memory usage is above 50%
      if (metrics && metrics.heapUsedPercent > 0.5) {
        this.forceGC();
      }
    }, this?.config?.gcInterval);
  }
  
  /**
   * Force garbage collection
   */
  forceGC(): void {
    if (!global.gc) {
      logger.warn('Garbage collection not exposed. Run with --expose-gc flag', 'MEMORY_MANAGER');
      return;
    }
    
    const startTime = performance.now();
    
    try {
      global.gc();
      
      const duration = performance.now() - startTime;
      this.gcCount++;
      this.gcTotalDuration += duration;
      
      logger.debug('Garbage collection completed', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        duration: Math.round(duration) + 'ms',
        totalGCs: this.gcCount
      });
      
      this.emit('gc-completed', { duration, count: this.gcCount });
      
    } catch (error) {
      logger.error('Garbage collection failed', 'MEMORY_MANAGER', { error });
    }
  }
  
  /**
   * Take a heap snapshot for debugging
   */
  takeHeapSnapshot(reason: string = 'manual'): string {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this?.config?.service}-${reason}-${timestamp}.heapsnapshot`;
      const filepath = join(this?.config?.snapshotDir, filename);
      
      logger.info('Taking heap snapshot', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        reason,
        filepath
      });
      
      const snapshot = v8.writeHeapSnapshot();
      
      if (snapshot) {
        writeFileSync(filepath, snapshot);
        
        logger.info('Heap snapshot saved', 'MEMORY_MANAGER', {
          service: this?.config?.service,
          filepath,
          size: snapshot?.length || 0
        });
        
        this.emit('snapshot-taken', { filepath, reason });
        
        return filepath;
      }
      
      throw new Error('Failed to generate heap snapshot');
      
    } catch (error) {
      logger.error('Failed to take heap snapshot', 'MEMORY_MANAGER', { error });
      throw error;
    }
  }
  
  /**
   * Create an object pool for efficient memory management
   */
  createObjectPool<T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 100
  ): ObjectPool<T> {
    const pool: T[] = [];
    
    const objectPool: ObjectPool<T> = {
      acquire(): T {
        if (pool?.length || 0 > 0) {
          return pool.pop()!;
        }
        return factory();
      },
      
      release(obj: T): void {
        if (pool?.length || 0 < maxSize) {
          reset(obj);
          pool.push(obj);
        }
      },
      
      size(): number {
        return pool?.length || 0;
      },
      
      clear(): void {
        pool.length = 0;
      }
    };
    
    this?.objectPools?.set(name, objectPool);
    
    logger.debug('Object pool created', 'MEMORY_MANAGER', {
      service: this?.config?.service,
      poolName: name,
      maxSize
    });
    
    return objectPool;
  }
  
  /**
   * Get an object pool by name
   */
  getObjectPool<T>(name: string): ObjectPool<T> | undefined {
    return this?.objectPools?.get(name) as ObjectPool<T> | undefined;
  }
  
  /**
   * Clear all object pools
   */
  clearAllPools(): void {
    for (const [name, pool] of this.objectPools) {
      pool.clear();
      logger.debug('Object pool cleared', 'MEMORY_MANAGER', {
        service: this?.config?.service,
        poolName: name
      });
    }
  }
  
  /**
   * Create a weak reference to an object
   */
  createWeakRef<T extends object>(key: string, obj: T): WeakRef<T> {
    const weakRef = new WeakRef(obj);
    this?.weakRefs?.set(key, weakRef);
    this?.finalizationRegistry?.register(obj, key);
    
    return weakRef;
  }
  
  /**
   * Get a weak reference by key
   */
  getWeakRef<T extends object>(key: string): T | undefined {
    const weakRef = this?.weakRefs?.get(key);
    return weakRef?.deref() as T | undefined;
  }
  
  /**
   * Get current memory metrics
   */
  getCurrentMetrics(): MemoryMetrics | undefined {
    return this.metrics[this?.metrics?.length - 1];
  }
  
  /**
   * Get memory statistics
   */
  getStatistics(): {
    service: string;
    uptime: number;
    currentMemory: MemoryMetrics | undefined;
    averageHeapUsed: number;
    peakHeapUsed: number;
    gcCount: number;
    averageGCDuration: number;
    leaksDetected: number;
    restartCount: number;
    objectPools: number;
    weakRefs: number;
  } {
    const current = this.getCurrentMetrics();
    const heapUsedValues = this?.metrics?.map(m => m.heapUsed);
    const averageHeapUsed = heapUsedValues?.length || 0 > 0
      ? heapUsedValues.reduce((a: any, b: any) => a + b, 0) / heapUsedValues?.length || 0
      : 0;
    const peakHeapUsed = Math.max(...heapUsedValues, 0);
    const leaksDetected = this?.metrics?.filter(m => m.leakSuspected).length;
    
    return {
      service: this?.config?.service,
      uptime: Date.now() - (this.metrics[0]?.timestamp || Date.now()),
      currentMemory: current,
      averageHeapUsed,
      peakHeapUsed,
      gcCount: this.gcCount,
      averageGCDuration: this.gcCount > 0 ? this.gcTotalDuration / this.gcCount : 0,
      leaksDetected,
      restartCount: this.restartCount,
      objectPools: this?.objectPools?.size,
      weakRefs: this?.weakRefs?.size
    };
  }
  
  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: any) => {
      logger.error('Uncaught exception - taking heap snapshot', 'MEMORY_MANAGER', { error });
      
      try {
        this.takeHeapSnapshot('uncaught-exception');
      } catch (snapshotError) {
        logger.error('Failed to take snapshot on exception', 'MEMORY_MANAGER', { snapshotError });
      }
    });
    
    // Handle out of memory errors
    process.on('exit', (code: any) => {
      if (code === 134) { // Out of memory exit code
        logger.error('Process exiting due to out of memory', 'MEMORY_MANAGER', {
          service: this?.config?.service,
          exitCode: code
        });
      }
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }
  
  /**
   * Perform graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    logger.info('Initiating graceful shutdown', 'MEMORY_MANAGER', {
      service: this?.config?.service
    });
    
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    
    // Clear object pools
    this.clearAllPools();
    
    // Force final GC
    this.forceGC();
    
    // Take final snapshot if memory usage is high
    const metrics = this.getCurrentMetrics();
    if (metrics && metrics.heapUsedPercent > 0.7) {
      try {
        this.takeHeapSnapshot('shutdown');
      } catch (error) {
        logger.error('Failed to take shutdown snapshot', 'MEMORY_MANAGER', { error });
      }
    }
    
    // Emit shutdown event
    this.emit('shutdown', this.getStatistics());
    
    logger.info('Graceful shutdown completed', 'MEMORY_MANAGER', {
      service: this?.config?.service
    });
  }
  
  /**
   * Shutdown the memory manager
   */
  async shutdown(): Promise<void> {
    await this.gracefulShutdown();
  }
}

// Global GC type declaration
declare global {
  var gc: (() => void) | undefined;
}

export { MemoryManager };
export default MemoryManager;