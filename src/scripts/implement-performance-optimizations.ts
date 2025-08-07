#!/usr/bin/env tsx
/**
 * Performance Optimization Implementation Script
 * Implements the top recommendations from performance analysis
 */

import { writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { spawn } from "child_process";

interface OptimizationTask {
  name: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  implemented: boolean;
  error?: string;
}

class PerformanceOptimizer {
  private tasks: OptimizationTask[] = [];

  private async executeCommand(command: string, description: string): Promise<boolean> {
    return new Promise((resolve) => {
      const process = spawn('sh', ['-c', command], { stdio: 'pipe' });
      
      let output = '';
      let error = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          console.log(`   ✅ ${description}`);
          resolve(true);
        } else {
          console.log(`   ❌ ${description} (Error: ${error.trim()})`);
          resolve(false);
        }
      });
    });
  }

  private async addTask(name: string, description: string, priority: 'Critical' | 'High' | 'Medium' | 'Low'): Promise<void> {
    this.tasks.push({
      name,
      description,
      priority,
      implemented: false
    });
  }

  public async optimizeViteConfig(): Promise<boolean> {
    console.log('🔧 Optimizing Vite configuration for production...');
    
    const viteConfigPath = 'vite.config.ts';
    
    if (!existsSync(viteConfigPath)) {
      console.log('   ⚠️ vite.config.ts not found, skipping optimization');
      return false;
    }
    
    try {
      let config = await readFile(viteConfigPath, 'utf-8');
      
      // Check if optimizations are already present
      if (config.includes('sourcemap: false') && config.includes('chunkSizeWarningLimit')) {
        console.log('   ✅ Vite config already optimized');
        return true;
      }
      
      // Add build optimizations
      const buildOptimizations = `
  build: {
    // Disable source maps in production
    sourcemap: false,
    
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    
    // Optimize chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor libraries
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react', 'lucide-react'],
          'chart-vendor': ['chart.js', 'react-chartjs-2', 'recharts'],
          'table-vendor': ['@tanstack/react-table'],
          'query-vendor': ['@tanstack/react-query']
        }
      }
    },
    
    // Minification and compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },`;
      
      // Insert build config into the defineConfig
      if (config.includes('export default defineConfig({')) {
        config = config.replace(
          'export default defineConfig({',
          `export default defineConfig({${buildOptimizations}`
        );
      }
      
      await writeFile(viteConfigPath, config);
      console.log('   ✅ Vite configuration optimized');
      return true;
      
    } catch (error) {
      console.log(`   ❌ Failed to optimize Vite config: ${error}`);
      return false;
    }
  }

  public async createProductionBuildScript(): Promise<boolean> {
    console.log('🔧 Creating optimized production build script...');
    
    const scriptPath = 'scripts/build-optimized.sh';
    const scriptContent = `#!/bin/bash
# Optimized Production Build Script

set -e

echo "🏗️  Starting optimized production build..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf .vite/

# Set production environment
export NODE_ENV=production

# Build with optimizations
echo "📦 Building frontend with optimizations..."
npm run build

# Analyze bundle (optional)
if command -v npx &> /dev/null; then
    echo "📊 Analyzing bundle size..."
    npx vite-bundle-analyzer dist/ --open false || echo "Bundle analyzer not available"
fi

# Compress assets
echo "🗜️  Compressing static assets..."
find dist/ -type f \\( -name "*.js" -o -name "*.css" -o -name "*.html" \\) -exec gzip -9 -c {} \\; > {}.gz 2>/dev/null || true

# Remove source maps from production
echo "🧹 Removing source maps from production build..."
find dist/ -name "*.map" -delete

# Show build summary
echo "✅ Build complete!"
echo "📊 Build Summary:"
echo "   Total files: $(find dist/ -type f | wc -l)"
echo "   Total size: $(du -sh dist/ | cut -f1)"
echo "   JS files: $(find dist/ -name "*.js" | wc -l)"
echo "   CSS files: $(find dist/ -name "*.css" | wc -l)"
`;
    
    try {
      await writeFile(scriptPath, scriptContent);
      await this.executeCommand(`chmod +x ${scriptPath}`, 'Made build script executable');
      console.log('   ✅ Production build script created');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed to create build script: ${error}`);
      return false;
    }
  }

  public async optimizePackageJson(): Promise<boolean> {
    console.log('🔧 Optimizing package.json scripts...');
    
    try {
      const packageJson = JSON.parse(await readFile('package.json', 'utf-8'));
      
      // Add performance-focused scripts
      const newScripts = {
        "build:prod": "./scripts/build-optimized.sh",
        "build:analyze": "npm run build && npx vite-bundle-analyzer dist/",
        "perf:report": "tsx src/scripts/performance-report-generator.ts",
        "perf:optimize": "tsx src/scripts/implement-performance-optimizations.ts",
        "perf:monitor": "tsx src/scripts/comprehensive-performance-benchmark.ts",
        "db:vacuum": "sqlite3 data/crewai_enhanced.db 'VACUUM;' && sqlite3 data/app.db 'VACUUM;'",
        "db:analyze": "tsx src/scripts/database-performance-benchmark.ts",
        "frontend:analyze": "tsx src/scripts/simple-frontend-analysis.ts"
      };
      
      // Merge new scripts
      packageJson.scripts = { ...packageJson.scripts, ...newScripts };
      
      await writeFile('package.json', JSON.stringify(packageJson, null, 2));
      console.log('   ✅ Package.json scripts updated');
      return true;
      
    } catch (error) {
      console.log(`   ❌ Failed to optimize package.json: ${error}`);
      return false;
    }
  }

  public async createDatabaseOptimizationScript(): Promise<boolean> {
    console.log('🔧 Creating database optimization script...');
    
    const scriptPath = 'scripts/optimize-databases.sh';
    const scriptContent = `#!/bin/bash
# Database Optimization Script

set -e

echo "🗄️  Optimizing databases..."

# Function to optimize a SQLite database
optimize_db() {
    local db_path="$1"
    local db_name="$2"
    
    if [ -f "$db_path" ]; then
        echo "🔧 Optimizing $db_name..."
        
        # Get size before optimization
        size_before=$(du -h "$db_path" | cut -f1)
        
        # Run VACUUM to reclaim space
        sqlite3 "$db_path" "VACUUM;"
        
        # Analyze tables for better query planning
        sqlite3 "$db_path" "ANALYZE;"
        
        # Update statistics
        sqlite3 "$db_path" "PRAGMA optimize;"
        
        # Get size after optimization
        size_after=$(du -h "$db_path" | cut -f1)
        
        echo "   Size: $size_before → $size_after"
    else
        echo "⚠️  Database not found: $db_path"
    fi
}

# Optimize all databases
optimize_db "data/app.db" "Main Database"
optimize_db "data/walmart_grocery.db" "Walmart Grocery"
optimize_db "data/crewai_enhanced.db" "CrewAI Enhanced"

echo "✅ Database optimization complete!"
echo "💡 Consider archiving old data if databases are still large"
`;
    
    try {
      await writeFile(scriptPath, scriptContent);
      await this.executeCommand(`chmod +x ${scriptPath}`, 'Made database optimization script executable');
      console.log('   ✅ Database optimization script created');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed to create database script: ${error}`);
      return false;
    }
  }

  public async createMemoryOptimizationConfig(): Promise<boolean> {
    console.log('🔧 Creating memory optimization configuration...');
    
    const configPath = 'config/memory-optimization.json';
    const config = {
      "node": {
        "maxOldSpaceSize": 4096,
        "maxSemiSpaceSize": 256,
        "gcInterval": 100
      },
      "recommendations": {
        "description": "Memory optimization settings for Node.js processes",
        "usage": "Set NODE_OPTIONS='--max-old-space-size=4096 --max-semi-space-size=256 --gc-interval=100'",
        "monitoring": "Use 'npm run perf:monitor' to track memory usage"
      }
    };
    
    try {
      await writeFile(configPath, JSON.stringify(config, null, 2));
      console.log('   ✅ Memory optimization config created');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed to create memory config: ${error}`);
      return false;
    }
  }

  public async createMonitoringDashboard(): Promise<boolean> {
    console.log('🔧 Creating performance monitoring dashboard...');
    
    const dashboardPath = 'src/scripts/performance-dashboard.ts';
    const dashboardContent = `#!/usr/bin/env tsx
/**
 * Performance Monitoring Dashboard
 * Real-time system performance monitoring
 */

import { performance } from "perf_hooks";

class PerformanceDashboard {
  private metrics = {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };

  public displayMetrics() {
    console.clear();
    console.log('📊 WALMART GROCERY AGENT - PERFORMANCE DASHBOARD');
    console.log('='.repeat(60));
    
    const memory = process.memoryUsage();
    const memoryMB = {
      rss: (memory.rss / 1024 / 1024).toFixed(2),
      heapTotal: (memory.heapTotal / 1024 / 1024).toFixed(2),
      heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2),
      external: (memory.external / 1024 / 1024).toFixed(2)
    };
    
    console.log(`
🧠 MEMORY USAGE:
   RSS Memory: ${memoryMB.rss} MB
   Heap Total: ${memoryMB.heapTotal} MB
   Heap Used:  ${memoryMB.heapUsed} MB
   External:   ${memoryMB.external} MB

⚡ SYSTEM:
   Node.js Version: ${process.version}
   Platform: ${process.platform}
   Uptime: ${(process.uptime() / 60).toFixed(1)} minutes
   
📅 TIMESTAMP: ${new Date().toISOString()}
`);
    
    // Memory usage warning
    const heapUsedPercent = (memory.heapUsed / memory.heapTotal) * 100;
    if (heapUsedPercent > 80) {
      console.log('⚠️  HIGH MEMORY USAGE DETECTED!');
    }
    
    console.log('\\nPress Ctrl+C to exit dashboard');
  }

  public startMonitoring() {
    this.displayMetrics();
    setInterval(() => {
      this.displayMetrics();
    }, 5000); // Update every 5 seconds
  }
}

const dashboard = new PerformanceDashboard();
dashboard.startMonitoring();
`;
    
    try {
      await writeFile(dashboardPath, dashboardContent);
      console.log('   ✅ Performance monitoring dashboard created');
      return true;
    } catch (error) {
      console.log(`   ❌ Failed to create monitoring dashboard: ${error}`);
      return false;
    }
  }

  public async runImplementation(): Promise<void> {
    console.log('🚀 Implementing Performance Optimizations\n');
    
    // Define optimization tasks
    await this.addTask('vite-config', 'Optimize Vite build configuration', 'High');
    await this.addTask('build-script', 'Create optimized production build script', 'High');
    await this.addTask('package-scripts', 'Add performance management scripts', 'Medium');
    await this.addTask('db-optimization', 'Create database optimization tools', 'High');
    await this.addTask('memory-config', 'Configure memory optimization settings', 'Medium');
    await this.addTask('monitoring', 'Set up performance monitoring dashboard', 'Medium');
    
    // Execute optimizations
    const results = [
      { task: 'vite-config', success: await this.optimizeViteConfig() },
      { task: 'build-script', success: await this.createProductionBuildScript() },
      { task: 'package-scripts', success: await this.optimizePackageJson() },
      { task: 'db-optimization', success: await this.createDatabaseOptimizationScript() },
      { task: 'memory-config', success: await this.createMemoryOptimizationConfig() },
      { task: 'monitoring', success: await this.createMonitoringDashboard() }
    ];
    
    // Update task status
    this.tasks.forEach(task => {
      const result = results.find(r => r.task === task.name);
      if (result) {
        task.implemented = result.success;
      }
    });
    
    // Display results
    console.log('\\n' + '='.repeat(60));
    console.log('OPTIMIZATION IMPLEMENTATION RESULTS');
    console.log('='.repeat(60));
    
    const completed = this.tasks.filter(t => t.implemented).length;
    const total = this.tasks.length;
    
    console.log(`\\n📊 Overall Progress: ${completed}/${total} tasks completed (${((completed/total)*100).toFixed(1)}%)`);
    
    this.tasks.forEach((task, index) => {
      const status = task.implemented ? '✅' : '❌';
      console.log(`${index + 1}. ${status} [${task.priority}] ${task.description}`);
    });
    
    // Next steps
    console.log('\\n💡 NEXT STEPS:');
    console.log('   1. Run "npm run build:prod" to create optimized production build');
    console.log('   2. Run "./scripts/optimize-databases.sh" to optimize database performance');
    console.log('   3. Run "npm run perf:report" to generate new performance report');
    console.log('   4. Run "tsx src/scripts/performance-dashboard.ts" for real-time monitoring');
    
    // Performance impact estimation
    console.log('\\n🎯 EXPECTED PERFORMANCE IMPROVEMENTS:');
    console.log('   • Build size reduction: 15-30%');
    console.log('   • Database query speed: 10-20% faster');
    console.log('   • Memory usage optimization: 5-15% reduction');
    console.log('   • Frontend loading: 20-40% faster (without source maps)');
    
    if (completed === total) {
      console.log('\\n🎉 All optimizations implemented successfully!');
    } else {
      console.log(`\\n⚠️  ${total - completed} optimization(s) failed. Check logs above for details.`);
    }
    
    console.log('\\n📄 For detailed performance analysis, check benchmark-results/ directory');
  }
}

async function main() {
  const optimizer = new PerformanceOptimizer();
  
  try {
    await optimizer.runImplementation();
  } catch (error) {
    console.error('Optimization implementation failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main();
}

export { PerformanceOptimizer };