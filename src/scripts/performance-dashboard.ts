#!/usr/bin/env tsx
import { performance } from "perf_hooks";

class Dashboard {
  displayMetrics() {
    console.clear();
    console.log('PERFORMANCE DASHBOARD');
    console.log('====================');
    
    const memory = process.memoryUsage();
    console.log('Memory (MB):');
    console.log('  RSS:', (memory.rss / 1024 / 1024).toFixed(2));
    console.log('  Heap:', (memory.heapUsed / 1024 / 1024).toFixed(2));
    console.log('  External:', (memory.external / 1024 / 1024).toFixed(2));
    
    console.log('\nSystem:');
    console.log('  Node.js:', process.version);
    console.log('  Platform:', process.platform);
    console.log('  Uptime:', (process.uptime() / 60).toFixed(1), 'minutes');
    
    const heapPercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (heapPercent > 80) {
      console.log('\n⚠️ HIGH MEMORY USAGE!');
    }
    
    console.log('\nPress Ctrl+C to exit');
  }
  
  start() {
    this.displayMetrics();
    setInterval(() => this.displayMetrics(), 5000);
  }
}

new Dashboard().start();
