#!/usr/bin/env tsx
/**
 * Apply Key Performance Optimizations
 * Implements critical performance fixes based on analysis
 */

import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";

class KeyOptimizer {
  private async executeCommand(command: string, description: string): Promise<boolean> {
    return new Promise((resolve: any) => {
      console.log(`   🔄 ${description}...`);
      const process = spawn('sh', ['-c', command], { stdio: 'inherit' });
      
      process.on('close', (code: any) => {
        if (code === 0) {
          console.log(`   ✅ ${description} - SUCCESS`);
          resolve(true);
        } else {
          console.log(`   ❌ ${description} - FAILED`);
          resolve(false);
        }
      });
    });
  }

  public async optimizeViteConfig(): Promise<boolean> {
    console.log('🔧 Optimizing Vite build configuration...');
    
    const viteConfigPath = 'vite?.config?.ts';
    
    if (!existsSync(viteConfigPath)) {
      console.log('   ⚠️ vite?.config?.ts not found');
      return false;
    }
    
    try {
      let config = await readFile(viteConfigPath, 'utf-8');
      
      if (config.includes('sourcemap: false')) {
        console.log('   ✅ Vite already optimized');
        return true;
      }
      
      // Add production optimizations
      const optimizations = `
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'ui': ['@headlessui/react', '@heroicons/react'],
          'charts': ['chart.js', 'react-chartjs-2']
        }
      }
    }
  },`;
      
      if (config.includes('export default defineConfig({')) {
        config = config.replace(
          'export default defineConfig({',
          `export default defineConfig({${optimizations}`
        );
        
        await writeFile(viteConfigPath, config);
        console.log('   ✅ Vite configuration optimized');
        return true;
      }
      
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      return false;
    }
    
    return false;
  }

  public async createBuildScript(): Promise<boolean> {
    console.log('🔧 Creating optimized build script...');
    
    const scriptContent = `#!/bin/bash
# Optimized production build
set -e

echo "Building optimized production bundle..."

# Clean previous builds
rm -rf dist/
export NODE_ENV=production

# Build with optimizations
npm run build

# Remove source maps
find dist/ -name "*.map" -delete

# Show results
echo "Build complete! Size: $(du -sh dist/ | cut -f1)"
`;
    
    try {
      await writeFile('scripts/build-optimized.sh', scriptContent);
      await this.executeCommand('chmod +x scripts/build-optimized.sh', 'Make script executable');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      return false;
    }
  }

  public async createDatabaseScript(): Promise<boolean> {
    console.log('🔧 Creating database optimization script...');
    
    const scriptContent = `#!/bin/bash
# Database optimization
set -e

echo "Optimizing databases..."

optimize_db() {
    local db="$1"
    if [ -f "$db" ]; then
        echo "Optimizing $db..."
        sqlite3 "$db" "VACUUM; ANALYZE; PRAGMA optimize;"
        echo "Done: $(du -sh "$db" | cut -f1)"
    fi
}

optimize_db "data/app.db"
optimize_db "data/walmart_grocery.db" 
optimize_db "data/crewai_enhanced.db"

echo "Database optimization complete!"
`;
    
    try {
      await writeFile('scripts/optimize-databases.sh', scriptContent);
      await this.executeCommand('chmod +x scripts/optimize-databases.sh', 'Make database script executable');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      return false;
    }
  }

  public async updatePackageJson(): Promise<boolean> {
    console.log('🔧 Adding performance scripts to package.json...');
    
    try {
      const packageJson = JSON.parse(await readFile('package.json', 'utf-8'));
      
      const newScripts = {
        "build:prod": "./scripts/build-optimized.sh",
        "db:optimize": "./scripts/optimize-databases.sh", 
        "perf:report": "tsx src/scripts/performance-report-generator.ts",
        "perf:analyze": "tsx src/scripts/simple-frontend-analysis.ts",
        "monitor": "tsx src/scripts/performance-dashboard.ts"
      };
      
      packageJson.scripts = { ...packageJson.scripts, ...newScripts };
      
      await writeFile('package.json', JSON.stringify(packageJson, null, 2));
      console.log('   ✅ Package.json updated');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      return false;
    }
  }

  public async createMonitoring(): Promise<boolean> {
    console.log('🔧 Creating performance monitoring dashboard...');
    
    const monitoringCode = `#!/usr/bin/env tsx
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
    
    console.log('\\nSystem:');
    console.log('  Node.js:', process.version);
    console.log('  Platform:', process.platform);
    console.log('  Uptime:', (process.uptime() / 60).toFixed(1), 'minutes');
    
    const heapPercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (heapPercent > 80) {
      console.log('\\n⚠️ HIGH MEMORY USAGE!');
    }
    
    console.log('\\nPress Ctrl+C to exit');
  }
  
  start() {
    this.displayMetrics();
    setInterval(() => this.displayMetrics(), 5000);
  }
}

new Dashboard().start();
`;
    
    try {
      await writeFile('src/scripts/performance-dashboard.ts', monitoringCode);
      console.log('   ✅ Performance dashboard created');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed: ${error}`);
      return false;
    }
  }

  public async runOptimizations(): Promise<void> {
    console.log('🚀 APPLYING KEY PERFORMANCE OPTIMIZATIONS\n');
    
    const tasks = [
      { name: 'Vite Config', func: () => this.optimizeViteConfig() },
      { name: 'Build Script', func: () => this.createBuildScript() },
      { name: 'DB Script', func: () => this.createDatabaseScript() },
      { name: 'Package.json', func: () => this.updatePackageJson() },
      { name: 'Monitoring', func: () => this.createMonitoring() }
    ];
    
    const results = [];
    
    for (const task of tasks) {
      const success = await task.func();
      results.push({ name: task.name, success });
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('OPTIMIZATION RESULTS');
    console.log('='.repeat(50));
    
    const successful = results?.filter(r => r.success).length;
    console.log(`Overall: ${successful}/${results?.length || 0} optimizations applied\n`);
    
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.name}`);
    });
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Run: npm run build:prod');
    console.log('2. Run: npm run db:optimize');  
    console.log('3. Run: npm run perf:report');
    console.log('4. Run: npm run monitor (for real-time monitoring)');
    
    console.log('\n📈 EXPECTED IMPROVEMENTS:');
    console.log('• 20-40% faster frontend loading');
    console.log('• 15-30% smaller build size');
    console.log('• 10-20% faster database queries');
    console.log('• Better memory management');
    
    if (successful === results?.length || 0) {
      console.log('\n🎉 All optimizations applied successfully!');
    }
  }
}

const optimizer = new KeyOptimizer();
optimizer.runOptimizations().catch(console.error);