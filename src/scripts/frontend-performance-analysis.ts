#!/usr/bin/env tsx
/**
 * Frontend Performance Analysis for Walmart Grocery Agent
 * Analyzes bundle size, Core Web Vitals, component render performance
 */

import { spawn } from "child_process";
import { existsSync, statSync, readFileSync } from "fs";
import { join, extname } from "path";
import { writeFile } from "fs/promises";
import { glob } from "glob";

interface BundleAnalysis {
  file: string;
  size: number;
  sizeHuman: string;
  type: 'js' | 'css' | 'html' | 'asset';
  gzipSize?: number;
  gzipSizeHuman?: string;
}

interface ComponentMetrics {
  component: string;
  file: string;
  linesOfCode: number;
  complexity: number;
  dependencies: string[];
  renderPotential: 'low' | 'medium' | 'high';
}

interface CoreWebVitalsTarget {
  metric: string;
  good: string;
  needsImprovement: string;
  poor: string;
  description: string;
}

class FrontendPerformanceAnalyzer {
  private readonly distPath = "dist";
  private readonly srcPath = "src/ui";
  
  private readonly coreWebVitalsTargets: CoreWebVitalsTarget[] = [
    {
      metric: "Largest Contentful Paint (LCP)",
      good: "≤ 2.5s",
      needsImprovement: "2.5s - 4.0s", 
      poor: "> 4.0s",
      description: "Time when the largest content element becomes visible"
    },
    {
      metric: "First Input Delay (FID)",
      good: "≤ 100ms",
      needsImprovement: "100ms - 300ms",
      poor: "> 300ms", 
      description: "Time from first user interaction to browser response"
    },
    {
      metric: "Cumulative Layout Shift (CLS)",
      good: "≤ 0.1",
      needsImprovement: "0.1 - 0.25",
      poor: "> 0.25",
      description: "Visual stability - how much content shifts during page load"
    },
    {
      metric: "First Contentful Paint (FCP)",
      good: "≤ 1.8s", 
      needsImprovement: "1.8s - 3.0s",
      poor: "> 3.0s",
      description: "Time when first content element becomes visible"
    }
  ];

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async getGzipSize(filePath: string): Promise<number> {
    return new Promise((resolve: any) => {
      const gzip = spawn('gzip', ['-c'], { stdio: ['pipe', 'pipe', 'pipe'] });
      const wc = spawn('wc', ['-c'], { stdio: ['pipe', 'pipe', 'pipe'] });
      
      if (gzip?.stdout && wc?.stdin) {
        gzip.stdout.pipe(wc.stdin);
      }
      
      let output = '';
      if (wc?.stdout) {
        wc.stdout.on('data', (data: any) => {
          output += data.toString();
        });
      }
      
      wc.on('close', () => {
        const size = parseInt(output.trim()) || 0;
        resolve(size);
      });
      
      gzip.on('error', () => resolve(0));
      wc.on('error', () => resolve(0));
      
      try {
        const content = readFileSync(filePath);
        if (gzip?.stdin) {
          gzip.stdin.write(content);
          gzip.stdin.end();
        }
      } catch {
        resolve(0);
      }
    });
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

  public async analyzeBundleSize(): Promise<BundleAnalysis[]> {
    console.log('📦 Analyzing bundle sizes...');
    
    if (!existsSync(this.distPath)) {
      console.log(`⚠️ Distribution directory not found: ${this.distPath}`);
      console.log('Run "npm run build" first to generate the build');
      return [];
    }

    const files = await new Promise<string[]>((resolve, reject) => {
      glob(`${this.distPath}/**/*`, { nodir: true }, (err: any, matches: string[]) => {
        if (err) reject(err);
        else resolve(matches);
      });
    });
    const analyses: BundleAnalysis[] = [];
    
    for (const file of files) {
      try {
        const stats = statSync(file);
        const relativePath = file.replace(this.distPath + '/', '');
        const type = this.getFileType(file);
        
        const analysis: BundleAnalysis = {
          file: relativePath,
          size: stats.size,
          sizeHuman: this.formatBytes(stats.size),
          type
        };
        
        // Get gzip size for text files
        if (type === 'js' || type === 'css' || type === 'html') {
          const gzipSize = await this.getGzipSize(file);
          analysis.gzipSize = gzipSize;
          analysis.gzipSizeHuman = this.formatBytes(gzipSize);
        }
        
        analyses.push(analysis);
      } catch (error) {
        console.log(`⚠️ Could not analyze ${file}: ${error}`);
      }
    }
    
    return analyses.sort((a, b) => b.size - a.size);
  }

  private countLinesOfCode(filePath: string): number {
    try {
      const content = readFileSync(filePath, 'utf8');
      return content.split('\n').filter(line => line.trim() && !line.trim().startsWith('//')).length;
    } catch {
      return 0;
    }
  }

  private calculateComplexity(content: string): number {
    // Simple complexity calculation based on control structures
    const patterns = [
      /\bif\s*\(/g,
      /\belse\b/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\btry\b/g,
      /\bcatch\b/g,
      /\?\s*:/g, // ternary operators
      /&&|\|\|/g // logical operators
    ];
    
    let complexity = 1; // Base complexity
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches?.length || 0;
      }
    });
    
    return complexity;
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Extract imports
    const importRegex = /import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match?.[1]) dependencies.push(match[1]);
    }
    
    // Extract require statements
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      if (match?.[1]) dependencies.push(match[1]);
    }
    
    return [...new Set(dependencies)];
  }

  private calculateRenderPotential(complexity: number, loc: number, dependencies: string[]): 'low' | 'medium' | 'high' {
    const dependencyScore = dependencies ? dependencies.length * 0.3 : 0;
    const score = complexity * 0.5 + loc * 0.01 + dependencyScore;
    
    if (score > 50) return 'high';
    if (score > 20) return 'medium';
    return 'low';
  }

  public async analyzeComponents(): Promise<ComponentMetrics[]> {
    console.log('🧩 Analyzing React components...');
    
    if (!existsSync(this.srcPath)) {
      console.log(`⚠️ Source directory not found: ${this.srcPath}`);
      return [];
    }

    const componentFiles = await new Promise<string[]>((resolve, reject) => {
      glob(`${this.srcPath}/**/*.{tsx,jsx}`, { 
        ignore: ['**/*.test.*', '**/*.spec.*', '**/*.d.ts']
      }, (err: any, matches: string[]) => {
        if (err) reject(err);
        else resolve(matches);
      });
    });
    
    const metrics: ComponentMetrics[] = [];
    
    for (const file of componentFiles) {
      try {
        const content = readFileSync(file, 'utf8');
        const relativePath = file.replace(this.srcPath + '/', '');
        
        // Extract component name from file path or content
        const componentName = relativePath.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') || 'Unknown';
        
        const loc = this.countLinesOfCode(file);
        const complexity = this.calculateComplexity(content);
        const dependencies = this.extractDependencies(content);
        const renderPotential = this.calculateRenderPotential(complexity, loc, dependencies);
        
        metrics.push({
          component: componentName,
          file: relativePath,
          linesOfCode: loc,
          complexity,
          dependencies: dependencies ? dependencies.filter(dep => !dep.startsWith('.')) : [], // External deps only
          renderPotential
        });
        
      } catch (error) {
        console.log(`⚠️ Could not analyze component ${file}: ${error}`);
      }
    }
    
    return metrics.sort((a, b) => b.complexity - a.complexity);
  }

  private async runLighthouse(url: string): Promise<any> {
    return new Promise((resolve: any) => {
      console.log(`🔍 Running Lighthouse analysis on ${url}...`);
      
      const lighthouse = spawn('npx', [
        'lighthouse',
        url,
        '--output=json',
        '--chrome-flags="--headless --no-sandbox"',
        '--quiet'
      ], { stdio: ['inherit', 'pipe', 'pipe'] });
      
      let output = '';
      if (lighthouse?.stdout) {
        lighthouse.stdout.on('data', (data: any) => {
          output += data.toString();
        });
      }
      
      lighthouse.on('close', (code: any) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (error) {
            console.log('⚠️ Could not parse Lighthouse results');
            resolve(null);
          }
        } else {
          console.log('⚠️ Lighthouse analysis failed');
          resolve(null);
        }
      });
      
      lighthouse.on('error', () => {
        console.log('⚠️ Could not run Lighthouse (not installed?)');
        resolve(null);
      });
    });
  }

  public async analyzeWebVitals(url: string = 'http://localhost:5178'): Promise<any> {
    console.log('🎯 Analyzing Core Web Vitals...');
    
    const result = await this.runLighthouse(url);
    if (!result) {
      return null;
    }
    
    const audits = result?.audits;
    const webVitals = {
      lcp: audits['largest-contentful-paint']?.numericValue / 1000 || null,
      fid: audits['max-potential-fid']?.numericValue / 1000 || null,
      cls: audits['cumulative-layout-shift']?.numericValue || null,
      fcp: audits['first-contentful-paint']?.numericValue / 1000 || null,
      ttfb: audits['server-response-time']?.numericValue / 1000 || null,
      performance: result?.categories?.performance?.score * 100 || null
    };
    
    return webVitals;
  }

  public displayResults(
    bundleAnalysis: BundleAnalysis[], 
    componentMetrics: ComponentMetrics[], 
    webVitals: any
  ) {
    console.log('\n' + '='.repeat(80));
    console.log('FRONTEND PERFORMANCE ANALYSIS RESULTS');
    console.log('='.repeat(80));
    
    // Bundle Size Analysis
    console.log('\n📦 BUNDLE SIZE ANALYSIS');
    console.log('-'.repeat(50));
    
    const totalSize = bundleAnalysis.reduce((sum: any, item: any) => sum + item.size, 0);
    const jsFiles = bundleAnalysis?.filter(item => item.type === 'js');
    const cssFiles = bundleAnalysis?.filter(item => item.type === 'css');
    
    console.log(`\nTotal Bundle Size: ${this.formatBytes(totalSize)}`);
    console.log(`JavaScript: ${this.formatBytes(jsFiles.reduce((sum: any, item: any) => sum + item.size, 0))}`);
    console.log(`CSS: ${this.formatBytes(cssFiles.reduce((sum: any, item: any) => sum + item.size, 0))}`);
    
    console.log('\nLargest Files:');
    bundleAnalysis.slice(0, 10).forEach((item, index) => {
      const compressed = item.gzipSizeHuman ? ` (${item.gzipSizeHuman} gzipped)` : '';
      console.log(`  ${index + 1}. ${item.file}: ${item.sizeHuman}${compressed}`);
    });
    
    // Bundle size recommendations
    const largeBundles = bundleAnalysis ? bundleAnalysis.filter(item => item.size > 500 * 1024) : []; // > 500KB
    if (largeBundles.length > 0) {
      console.log('\n⚠️ Large bundles detected (>500KB):');
      largeBundles.forEach(bundle => {
        console.log(`  • ${bundle.file}: ${bundle.sizeHuman}`);
      });
      console.log('💡 Consider code splitting, tree shaking, or lazy loading');
    }
    
    // Component Analysis
    console.log('\n🧩 COMPONENT COMPLEXITY ANALYSIS');
    console.log('-'.repeat(50));
    
    const highComplexity = componentMetrics ? componentMetrics.filter(c => c.renderPotential === 'high') : [];
    const mediumComplexity = componentMetrics ? componentMetrics.filter(c => c.renderPotential === 'medium') : [];
    
    const totalComponents = componentMetrics ? componentMetrics.length : 0;
    const highCount = highComplexity.length;
    const mediumCount = mediumComplexity.length;
    const lowCount = totalComponents - highCount - mediumCount;
    
    console.log(`\nTotal Components: ${totalComponents}`);
    console.log(`High Complexity: ${highCount}`);
    console.log(`Medium Complexity: ${mediumCount}`);
    console.log(`Low Complexity: ${lowCount}`);
    
    if (highComplexity.length > 0) {
      console.log('\n🔴 High Complexity Components (optimization candidates):');
      highComplexity.slice(0, 5).forEach((comp, index) => {
        console.log(`  ${index + 1}. ${comp.component}`);
        console.log(`     File: ${comp.file}`);
        console.log(`     Lines: ${comp.linesOfCode}, Complexity: ${comp.complexity}`);
        console.log(`     External Dependencies: ${comp.dependencies ? comp.dependencies.length : 0}`);
      });
    }
    
    // Web Vitals Analysis
    if (webVitals) {
      console.log('\n🎯 CORE WEB VITALS');
      console.log('-'.repeat(50));
      
      console.log(`\nOverall Performance Score: ${webVitals.performance?.toFixed(1) || 'N/A'}/100`);
      
      const vitalsData = [
        { name: 'Largest Contentful Paint (LCP)', value: webVitals.lcp, unit: 's', target: 2.5 },
        { name: 'First Input Delay (FID)', value: webVitals.fid, unit: 'ms', target: 100 },
        { name: 'Cumulative Layout Shift (CLS)', value: webVitals.cls, unit: '', target: 0.1 },
        { name: 'First Contentful Paint (FCP)', value: webVitals.fcp, unit: 's', target: 1.8 },
        { name: 'Time to First Byte (TTFB)', value: webVitals.ttfb, unit: 's', target: 0.8 }
      ];
      
      vitalsData.forEach(vital => {
        if (vital.value !== null) {
          const status = vital.value <= vital.target ? '✅' : '⚠️';
          const valueStr = vital.unit ? `${vital?.value?.toFixed(2)}${vital.unit}` : vital?.value?.toFixed(3);
          const targetStr = vital.unit ? `${vital.target}${vital.unit}` : vital?.target?.toString();
          console.log(`  ${status} ${vital.name}: ${valueStr} (target: ≤${targetStr})`);
        }
      });
    }
    
    // Core Web Vitals Targets Reference
    console.log('\n📊 CORE WEB VITALS TARGETS');
    console.log('-'.repeat(50));
    this?.coreWebVitalsTargets?.forEach(target => {
      console.log(`\n${target.metric}:`);
      console.log(`  Good: ${target.good}`);
      console.log(`  Needs Improvement: ${target.needsImprovement}`);
      console.log(`  Poor: ${target.poor}`);
      console.log(`  Description: ${target.description}`);
    });
    
    // Optimization Recommendations
    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS');
    console.log('-'.repeat(50));
    
    const recommendations: Array<{priority: string; category: string; issue: string; solution: string}> = [];
    
    // Bundle size recommendations
    if (totalSize > 2 * 1024 * 1024) { // > 2MB
      recommendations.push({
        priority: 'HIGH',
        category: 'Bundle Size',
        issue: `Large total bundle size: ${this.formatBytes(totalSize)}`,
        solution: 'Implement code splitting, lazy loading, and tree shaking'
      });
    }
    
    const largeJSFiles = jsFiles?.filter(f => f.size > 1024 * 1024); // > 1MB
    if (largeJSFiles?.length || 0 > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'JavaScript',
        issue: `Large JS files detected: ${largeJSFiles?.map(f => f.file).join(', ')}`,
        solution: 'Split large files, implement dynamic imports, optimize vendor chunks'
      });
    }
    
    // Component recommendations
    if (highComplexity?.length || 0 > 5) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Components',
        issue: `${highComplexity?.length || 0} high-complexity components`,
        solution: 'Refactor complex components, implement React.memo, use useMemo/useCallback'
      });
    }
    
    // Web Vitals recommendations
    if (webVitals) {
      if (webVitals.lcp > 2.5) {
        recommendations.push({
          priority: 'HIGH',
          category: 'LCP',
          issue: `LCP too slow: ${webVitals?.lcp?.toFixed(2)}s`,
          solution: 'Optimize images, implement preloading, reduce server response time'
        });
      }
      
      if (webVitals.cls > 0.1) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'CLS',
          issue: `Layout shift detected: ${webVitals?.cls?.toFixed(3)}`,
          solution: 'Reserve space for dynamic content, optimize font loading'
        });
      }
    }
    
    // Display recommendations by priority
    const priorities = ['HIGH', 'MEDIUM', 'LOW'];
    priorities.forEach(priority => {
      const priorityRecs = recommendations?.filter((r: any) => r.priority === priority);
      if (priorityRecs?.length || 0 === 0) return;
      
      console.log(`\n🔴 ${priority} PRIORITY:`);
      priorityRecs.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.category}: ${rec.issue}`);
        console.log(`   💡 Solution: ${rec.solution}`);
      });
    });
    
    if (recommendations?.length || 0 === 0) {
      console.log('\n✅ Frontend performance looks good! All metrics are within acceptable ranges.');
    }
  }

  public async saveResults(
    bundleAnalysis: BundleAnalysis[], 
    componentMetrics: ComponentMetrics[], 
    webVitals: any
  ) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = `benchmark-results/frontend-analysis-${timestamp}.json`;
    
    const report = {
      timestamp: new Date().toISOString(),
      bundleAnalysis: {
        totalFiles: bundleAnalysis?.length || 0,
        totalSize: bundleAnalysis.reduce((sum: any, item: any) => sum + item.size, 0),
        files: bundleAnalysis
      },
      componentMetrics: {
        totalComponents: componentMetrics?.length || 0,
        highComplexity: componentMetrics?.filter(c => c.renderPotential === 'high').length,
        mediumComplexity: componentMetrics?.filter(c => c.renderPotential === 'medium').length,
        components: componentMetrics
      },
      webVitals,
      coreWebVitalsTargets: this.coreWebVitalsTargets
    };
    
    try {
      await writeFile(resultsPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Results saved to: ${resultsPath}`);
    } catch (error) {
      console.log(`⚠️ Could not save results: ${error}`);
    }
  }

  public async runAnalysis(): Promise<void> {
    console.log('🚀 Starting frontend performance analysis...\n');
    
    const bundleAnalysis = await this.analyzeBundleSize();
    const componentMetrics = await this.analyzeComponents();
    const webVitals = await this.analyzeWebVitals();
    
    this.displayResults(bundleAnalysis, componentMetrics, webVitals);
    await this.saveResults(bundleAnalysis, componentMetrics, webVitals);
    
    console.log('\n✅ Frontend performance analysis completed!');
  }
}

// Main execution
async function main() {
  const analyzer = new FrontendPerformanceAnalyzer();
  
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

export type { BundleAnalysis, ComponentMetrics };
export { FrontendPerformanceAnalyzer };