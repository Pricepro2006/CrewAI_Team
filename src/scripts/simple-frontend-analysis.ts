#!/usr/bin/env tsx
/**
 * Simple Frontend Performance Analysis
 * Analyzes build artifacts without complex dependencies
 */

import { readdir, stat } from "fs/promises";
import { readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";
import { writeFile } from "fs/promises";
import { spawn } from "child_process";

interface FileAnalysis {
  path: string;
  size: number;
  sizeHuman: string;
  type: 'js' | 'css' | 'html' | 'asset';
}

class SimpleFrontendAnalyzer {
  private distPath = "dist";
  private srcPath = "src/ui";

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getFileType(filename: string): 'js' | 'css' | 'html' | 'asset' {
    const ext = extname(filename).toLowerCase();
    switch (ext) {
      case '.js':
      case '.mjs':
      case '.ts':
        return 'js';
      case '.css':
      case '.scss':
      case '.sass':
        return 'css';
      case '.html':
        return 'html';
      default:
        return 'asset';
    }
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await readdir(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          const subFiles = await this.walkDirectory(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  public async analyzeBundleSize(): Promise<FileAnalysis[]> {
    console.log('📦 Analyzing bundle sizes...');
    
    if (!existsSync(this.distPath)) {
      console.log(`⚠️ Distribution directory not found: ${this.distPath}`);
      return [];
    }
    
    const files = await this.walkDirectory(this.distPath);
    const analyses: FileAnalysis[] = [];
    
    for (const file of files) {
      try {
        const stats = statSync(file);
        const relativePath = file.replace(this.distPath + '/', '');
        
        analyses.push({
          path: relativePath,
          size: stats.size,
          sizeHuman: this.formatBytes(stats.size),
          type: this.getFileType(file)
        });
      } catch (error) {
        console.log(`⚠️ Could not analyze ${file}`);
      }
    }
    
    return analyses.sort((a, b) => b.size - a.size);
  }

  public async analyzeComponents(): Promise<{total: number, files: string[]}> {
    console.log('🧩 Analyzing React components...');
    
    if (!existsSync(this.srcPath)) {
      console.log(`⚠️ Source directory not found: ${this.srcPath}`);
      return { total: 0, files: [] };
    }
    
    const files = await this.walkDirectory(this.srcPath);
    const componentFiles = files?.filter(f => 
      (f.endsWith('.tsx') || f.endsWith('.jsx')) &&
      !f.includes('.test.') &&
      !f.includes('.spec.')
    );
    
    return {
      total: componentFiles?.length || 0,
      files: componentFiles.slice(0, 20) // Limit output
    };
  }

  public async getSystemMetrics() {
    return new Promise((resolve: any) => {
      // Get memory usage
      const memInfo = spawn('free', ['-m']);
      let memOutput = '';
      
      memInfo?.stdout?.on('data', (data: any) => {
        memOutput += data.toString();
      });
      
      memInfo.on('close', () => {
        const memLines = memOutput.split('\n');
        let memUsage = { total: 0, used: 0, percentage: 0 };
        
        if (memLines?.length || 0 > 1) {
          const memData = memLines[1]?.split(/\s+/);
          if (memData?.length || 0 >= 3) {
            memUsage = {
              total: parseInt(memData?.[1] || '0'),
              used: parseInt(memData?.[2] || '0'),
              percentage: (parseInt(memData?.[2] || '0') / parseInt(memData?.[1] || '1')) * 100
            };
          }
        }
        
        resolve({
          memory: memUsage,
          nodeProcesses: 0, // We'll count these separately
          timestamp: new Date().toISOString()
        });
      });
      
      memInfo.on('error', () => {
        resolve({
          memory: { total: 0, used: 0, percentage: 0 },
          nodeProcesses: 0,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  public displayResults(bundleFiles: FileAnalysis[], components: any, systemMetrics: any) {
    console.log('\n' + '='.repeat(80));
    console.log('FRONTEND PERFORMANCE ANALYSIS RESULTS');
    console.log('='.repeat(80));
    
    // Bundle Analysis
    const totalSize = bundleFiles.reduce((sum: any, file: any) => sum + file.size, 0);
    const jsFiles = bundleFiles?.filter(f => f.type === 'js');
    const cssFiles = bundleFiles?.filter(f => f.type === 'css');
    
    console.log('\n📦 BUNDLE SIZE ANALYSIS');
    console.log('-'.repeat(50));
    console.log(`Total Files: ${bundleFiles?.length || 0}`);
    console.log(`Total Size: ${this.formatBytes(totalSize)}`);
    console.log(`JavaScript Files: ${jsFiles?.length || 0} (${this.formatBytes(jsFiles.reduce((s: any, f: any) => s + f.size, 0))})`);
    console.log(`CSS Files: ${cssFiles?.length || 0} (${this.formatBytes(cssFiles.reduce((s: any, f: any) => s + f.size, 0))})`);
    
    console.log('\n🔍 LARGEST FILES:');
    bundleFiles.slice(0, 15).forEach((file, index) => {
      const icon = file.type === 'js' ? '📜' : file.type === 'css' ? '🎨' : '📄';
      console.log(`  ${index + 1}. ${icon} ${file.path}: ${file.sizeHuman}`);
    });
    
    // Component Analysis
    console.log('\n🧩 COMPONENT ANALYSIS');
    console.log('-'.repeat(50));
    console.log(`Total Components: ${components.total}`);
    
    if (components?.files?.length > 0) {
      console.log('\nComponent Files (first 20):');
      components?.files?.forEach((file: string, index: number) => {
        const relativePath = file.replace(this.srcPath + '/', '');
        console.log(`  ${index + 1}. ${relativePath}`);
      });
    }
    
    // System Metrics
    console.log('\n📊 SYSTEM METRICS');
    console.log('-'.repeat(50));
    if (systemMetrics?.memory?.total > 0) {
      console.log(`Memory Usage: ${systemMetrics?.memory?.used}MB / ${systemMetrics?.memory?.total}MB (${systemMetrics?.memory?.percentage.toFixed(1)}%)`);
    }
    
    // Performance Recommendations
    console.log('\n💡 PERFORMANCE RECOMMENDATIONS');
    console.log('-'.repeat(50));
    
    const recommendations = [];
    
    if (totalSize > 50 * 1024 * 1024) { // > 50MB
      recommendations.push({
        priority: 'HIGH',
        issue: `Large bundle size: ${this.formatBytes(totalSize)}`,
        solution: 'Consider implementing code splitting and lazy loading'
      });
    }
    
    const largeJSFiles = jsFiles?.filter(f => f.size > 5 * 1024 * 1024); // > 5MB
    if (largeJSFiles?.length || 0 > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: `${largeJSFiles?.length || 0} large JavaScript files detected`,
        solution: 'Split large bundles, implement dynamic imports'
      });
    }
    
    if (components.total > 100) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: `Large number of components: ${components.total}`,
        solution: 'Consider component lazy loading and code splitting by route'
      });
    }
    
    if (bundleFiles?.filter(f => f.type === 'asset').length > 200) {
      recommendations.push({
        priority: 'MEDIUM',
        issue: 'Large number of static assets',
        solution: 'Implement asset optimization and CDN caching'
      });
    }
    
    if (recommendations?.length || 0 === 0) {
      console.log('✅ Frontend bundle size looks reasonable!');
    } else {
      recommendations.forEach((rec, index) => {
        const priorityIcon = rec.priority === 'HIGH' ? '🔴' : '🟡';
        console.log(`\n${priorityIcon} ${rec.priority}: ${rec.issue}`);
        console.log(`   💡 ${rec.solution}`);
      });
    }
    
    // Build Performance Tips
    console.log('\n⚡ BUILD OPTIMIZATION TIPS');
    console.log('-'.repeat(50));
    console.log('• Enable tree shaking to remove dead code');
    console.log('• Use Vite\'s code splitting features');
    console.log('• Implement lazy loading for routes and components');
    console.log('• Optimize images and compress assets');
    console.log('• Use a CDN for static assets');
    console.log('• Enable gzip/brotli compression');
  }

  public async saveResults(bundleFiles: FileAnalysis[], components: any, systemMetrics: any) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = `benchmark-results/simple-frontend-analysis-${timestamp}.json`;
    
    const report = {
      timestamp: new Date().toISOString(),
      bundleAnalysis: {
        totalFiles: bundleFiles?.length || 0,
        totalSize: bundleFiles.reduce((sum: any, file: any) => sum + file.size, 0),
        files: bundleFiles
      },
      componentAnalysis: components,
      systemMetrics
    };
    
    try {
      await writeFile(resultsPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Results saved to: ${resultsPath}`);
    } catch (error) {
      console.log(`⚠️ Could not save results: ${error}`);
    }
  }

  public async runAnalysis() {
    console.log('🚀 Starting simple frontend performance analysis...\n');
    
    const bundleFiles = await this.analyzeBundleSize();
    const components = await this.analyzeComponents();
    const systemMetrics = await this.getSystemMetrics();
    
    this.displayResults(bundleFiles, components, systemMetrics);
    await this.saveResults(bundleFiles, components, systemMetrics);
    
    console.log('\n✅ Frontend performance analysis completed!');
  }
}

async function main() {
  const analyzer = new SimpleFrontendAnalyzer();
  
  try {
    await analyzer.runAnalysis();
  } catch (error) {
    console.error('Frontend analysis failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main();
}

export { SimpleFrontendAnalyzer };