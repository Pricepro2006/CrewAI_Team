#!/usr/bin/env node

/**
 * Memory Management Test Suite
 * 
 * Tests and benchmarks the memory management system across all microservices
 * Simulates various memory pressure scenarios and validates recovery mechanisms
 */

import { MemoryManager } from '../src/monitoring/MemoryManager.js';
import { MemoryMonitoringService } from '../src/monitoring/MemoryMonitoringService.js';
import { logger } from '../src/utils/logger.js';
import { performance } from 'perf_hooks';

interface TestResult {
  test: string;
  passed: boolean;
  duration: number;
  details: any;
}

class MemoryManagementTester {
  private results: TestResult[] = [];
  private memoryManager?: MemoryManager;
  private monitoringService?: MemoryMonitoringService;
  
  async runAllTests(): Promise<void> {
    logger.info('Starting Memory Management Test Suite', 'MEMORY_TEST');
    
    try {
      // Initialize services
      await this.initializeServices();
      
      // Run test suites
      await this.testMemoryLimits();
      await this.testGarbageCollection();
      await this.testObjectPooling();
      await this.testLeakDetection();
      await this.testMemoryPressureRecovery();
      await this.testHeapSnapshots();
      await this.testServiceCoordination();
      await this.testAlertSystem();
      
      // Print results
      this.printResults();
      
    } catch (error) {
      logger.error('Test suite failed', 'MEMORY_TEST', { error });
    } finally {
      await this.cleanup();
    }
  }
  
  private async initializeServices(): Promise<void> {
    logger.info('Initializing test services', 'MEMORY_TEST');
    
    // Initialize memory manager for test service
    this.memoryManager = MemoryManager.getInstance({
      service: 'test-service',
      maxHeapSize: 128, // Small limit for testing
      warningThreshold: 0.6,
      criticalThreshold: 0.8,
      gcInterval: 5000,
      heapSnapshotOnCritical: false,
      enableAutoGC: true,
      enableMemoryProfiling: true,
      snapshotDir: './test-snapshots',
      restartOnOOM: false,
      maxRestarts: 3,
      restartCooldown: 10000
    });
    
    // Initialize monitoring service
    this.monitoringService = MemoryMonitoringService.getInstance();
    await this.monitoringService.start(3008);
    
    // Wait for initialization
    await this.delay(2000);
  }
  
  private async testMemoryLimits(): Promise<void> {
    const testName = 'Memory Limits';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing memory limits', 'MEMORY_TEST');
      
      // Get initial metrics
      const initialMetrics = this.memoryManager!.getCurrentMetrics();
      details.initialHeapUsed = initialMetrics?.heapUsed;
      
      // Allocate memory in chunks
      const allocations: Buffer[] = [];
      const chunkSize = 10 * 1024 * 1024; // 10MB chunks
      
      for (let i = 0; i < 5; i++) {
        allocations.push(Buffer.alloc(chunkSize));
        await this.delay(100);
        
        const metrics = this.memoryManager!.getCurrentMetrics();
        if (metrics) {
          details[`allocation${i + 1}`] = {
            heapUsed: metrics.heapUsed,
            heapUsedPercent: metrics.heapUsedPercent,
            isWarning: metrics.isWarning,
            isCritical: metrics.isCritical
          };
        }
      }
      
      // Check if warnings were triggered
      const finalMetrics = this.memoryManager!.getCurrentMetrics();
      if (finalMetrics) {
        passed = finalMetrics.isWarning || finalMetrics.isCritical;
        details.finalHeapUsed = finalMetrics.heapUsed;
        details.warningTriggered = finalMetrics.isWarning;
        details.criticalTriggered = finalMetrics.isCritical;
      }
      
      // Clear allocations
      allocations.length = 0;
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testGarbageCollection(): Promise<void> {
    const testName = 'Garbage Collection';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing garbage collection', 'MEMORY_TEST');
      
      // Create garbage
      let garbage: any[] = [];
      for (let i = 0; i < 1000; i++) {
        garbage.push({
          data: Buffer.alloc(10240), // 10KB
          nested: { value: Math.random() }
        });
      }
      
      const beforeGC = this.memoryManager!.getCurrentMetrics();
      details.beforeGC = {
        heapUsed: beforeGC?.heapUsed,
        heapUsedPercent: beforeGC?.heapUsedPercent
      };
      
      // Clear references and force GC
      garbage = [];
      this.memoryManager!.forceGC();
      
      // Wait for GC to complete
      await this.delay(1000);
      
      const afterGC = this.memoryManager!.getCurrentMetrics();
      details.afterGC = {
        heapUsed: afterGC?.heapUsed,
        heapUsedPercent: afterGC?.heapUsedPercent
      };
      
      // Check if memory was freed
      if (beforeGC && afterGC) {
        const freed = beforeGC.heapUsed - afterGC.heapUsed;
        details.memoryFreed = freed;
        passed = freed > 0;
      }
      
      const stats = this.memoryManager!.getStatistics();
      details.gcCount = stats.gcCount;
      details.averageGCDuration = stats.averageGCDuration;
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testObjectPooling(): Promise<void> {
    const testName = 'Object Pooling';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing object pooling', 'MEMORY_TEST');
      
      // Create object pool
      const pool = this.memoryManager!.createObjectPool(
        'test-pool',
        () => ({ id: Math.random(), data: Buffer.alloc(1024) }),
        (obj) => { obj.id = 0; },
        10
      );
      
      // Test acquire and release
      const objects: any[] = [];
      
      // Acquire objects
      for (let i = 0; i < 5; i++) {
        objects.push(pool.acquire());
      }
      details.acquiredObjects = objects.length;
      details.poolSizeAfterAcquire = pool.size();
      
      // Release objects back to pool
      for (const obj of objects) {
        pool.release(obj);
      }
      details.poolSizeAfterRelease = pool.size();
      
      // Test pool reuse
      const reusedObj = pool.acquire();
      details.objectReused = reusedObj.id === 0; // Should be reset
      
      passed = details.poolSizeAfterRelease === 5 && details.objectReused;
      
      // Clear pool
      pool.clear();
      details.poolSizeAfterClear = pool.size();
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testLeakDetection(): Promise<void> {
    const testName = 'Leak Detection';
    const startTime = performance.now();
    let passed = false;
    const details: any = { samples: [] };
    
    try {
      logger.info('Testing leak detection', 'MEMORY_TEST');
      
      // Simulate memory leak
      const leakyArray: any[] = [];
      
      for (let i = 0; i < 10; i++) {
        // Allocate memory that won't be freed
        leakyArray.push(Buffer.alloc(5 * 1024 * 1024)); // 5MB per iteration
        
        // Force metrics collection
        const metrics = this.memoryManager!.getCurrentMetrics();
        if (metrics) {
          details.samples.push({
            iteration: i + 1,
            heapUsed: metrics.heapUsed,
            leakSuspected: metrics.leakSuspected
          });
        }
        
        await this.delay(1000); // Wait between allocations
      }
      
      // Check if leak was detected
      const finalMetrics = this.memoryManager!.getCurrentMetrics();
      passed = finalMetrics?.leakSuspected || false;
      details.leakDetected = passed;
      
      // Clear the leak
      leakyArray.length = 0;
      
    } catch (error) {
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testMemoryPressureRecovery(): Promise<void> {
    const testName = 'Memory Pressure Recovery';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing memory pressure recovery', 'MEMORY_TEST');
      
      // Create memory pressure
      const pressureData: Buffer[] = [];
      const chunkSize = 20 * 1024 * 1024; // 20MB chunks
      
      // Allocate until warning threshold
      while (true) {
        const metrics = this.memoryManager!.getCurrentMetrics();
        if (metrics && metrics.isWarning) {
          details.warningReached = true;
          details.heapUsedAtWarning = metrics.heapUsed;
          break;
        }
        
        pressureData.push(Buffer.alloc(chunkSize));
        await this.delay(100);
        
        if (pressureData.length > 10) {
          // Safety limit
          break;
        }
      }
      
      // Trigger recovery
      this.memoryManager!.clearAllPools();
      this.memoryManager!.forceGC();
      
      // Release memory
      pressureData.length = 0;
      
      // Wait for recovery
      await this.delay(2000);
      
      const recoveredMetrics = this.memoryManager!.getCurrentMetrics();
      details.heapUsedAfterRecovery = recoveredMetrics?.heapUsed;
      details.recovered = recoveredMetrics ? !recoveredMetrics.isWarning : false;
      
      passed = details.recovered;
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testHeapSnapshots(): Promise<void> {
    const testName = 'Heap Snapshots';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing heap snapshots', 'MEMORY_TEST');
      
      // Take a snapshot
      const filepath = this.memoryManager!.takeHeapSnapshot('test');
      details.snapshotPath = filepath;
      
      // Check if file was created
      const fs = await import('fs');
      passed = fs.existsSync(filepath);
      details.fileExists = passed;
      
      if (passed) {
        const stats = fs.statSync(filepath);
        details.fileSize = stats.size;
        
        // Clean up test snapshot
        fs.unlinkSync(filepath);
      }
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testServiceCoordination(): Promise<void> {
    const testName = 'Service Coordination';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing service coordination', 'MEMORY_TEST');
      
      // Check monitoring service metrics
      const response = await fetch('http://localhost:3008/metrics');
      
      if (response.ok) {
        const metrics = await response.json();
        details.servicesMonitored = metrics.services.length;
        details.totalMemoryUsed = metrics.totalMemoryUsed;
        details.totalMemoryLimit = metrics.totalMemoryLimit;
        
        passed = metrics.services.length > 0;
      } else {
        passed = false;
        details.error = 'Failed to fetch metrics';
      }
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private async testAlertSystem(): Promise<void> {
    const testName = 'Alert System';
    const startTime = performance.now();
    let passed = true;
    const details: any = {};
    
    try {
      logger.info('Testing alert system', 'MEMORY_TEST');
      
      // Check for alerts
      const response = await fetch('http://localhost:3008/alerts');
      
      if (response.ok) {
        const alerts = await response.json();
        details.totalAlerts = alerts.length;
        details.unresolvedAlerts = alerts.filter((a: any) => !a.resolved).length;
        
        // Check alert severities
        const severities = alerts.reduce((acc: any, alert: any) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        }, {});
        
        details.alertsBySeverity = severities;
        passed = true;
      } else {
        passed = false;
        details.error = 'Failed to fetch alerts';
      }
      
    } catch (error) {
      passed = false;
      details.error = error;
    }
    
    this.results.push({
      test: testName,
      passed,
      duration: performance.now() - startTime,
      details
    });
  }
  
  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('MEMORY MANAGEMENT TEST RESULTS');
    console.log('='.repeat(80));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`\nSummary: ${passed} passed, ${failed} failed`);
    console.log(`Total Duration: ${totalDuration.toFixed(2)}ms\n`);
    
    for (const result of this.results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test} (${result.duration.toFixed(2)}ms)`);
      
      if (!result.passed || process.env.VERBOSE) {
        console.log('  Details:', JSON.stringify(result.details, null, 2));
      }
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Generate recommendations
    this.generateRecommendations();
  }
  
  private generateRecommendations(): void {
    console.log('\nRECOMMENDATIONS:');
    console.log('-'.repeat(40));
    
    const recommendations: string[] = [];
    
    // Check GC performance
    const gcTest = this.results.find(r => r.test === 'Garbage Collection');
    if (gcTest && gcTest.details.averageGCDuration > 100) {
      recommendations.push('• Consider optimizing garbage collection settings');
    }
    
    // Check leak detection
    const leakTest = this.results.find(r => r.test === 'Leak Detection');
    if (leakTest && !leakTest.passed) {
      recommendations.push('• Leak detection may need tuning for sensitivity');
    }
    
    // Check memory limits
    const limitsTest = this.results.find(r => r.test === 'Memory Limits');
    if (limitsTest && !limitsTest.details.warningTriggered) {
      recommendations.push('• Warning thresholds may be set too high');
    }
    
    // Check recovery
    const recoveryTest = this.results.find(r => r.test === 'Memory Pressure Recovery');
    if (recoveryTest && !recoveryTest.passed) {
      recommendations.push('• Memory recovery mechanisms need improvement');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('• All systems operating within normal parameters');
    }
    
    recommendations.forEach(r => console.log(r));
    console.log();
  }
  
  private async cleanup(): Promise<void> {
    logger.info('Cleaning up test resources', 'MEMORY_TEST');
    
    if (this.memoryManager) {
      await this.memoryManager.shutdown();
    }
    
    if (this.monitoringService) {
      await this.monitoringService.shutdown();
    }
    
    // Clean up test snapshots directory
    try {
      const fs = await import('fs');
      const path = await import('path');
      const testSnapshotDir = './test-snapshots';
      
      if (fs.existsSync(testSnapshotDir)) {
        const files = fs.readdirSync(testSnapshotDir);
        for (const file of files) {
          fs.unlinkSync(path.join(testSnapshotDir, file));
        }
        fs.rmdirSync(testSnapshotDir);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MemoryManagementTester();
  
  tester.runAllTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}

export { MemoryManagementTester };