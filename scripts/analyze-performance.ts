#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: Array<{
    name: string;
    size: number;
    gzipped: number;
  }>;
  assets: Array<{
    name: string;
    size: number;
  }>;
}

interface PerformanceReport {
  bundleAnalysis: BundleAnalysis;
  optimizations: {
    codesplitting: boolean;
    treeshaking: boolean;
    minification: boolean;
    compression: boolean;
    lazyLoading: boolean;
    serviceWorker: boolean;
    webVitals: boolean;
  };
  recommendations: string[];
}

async function analyzeBundleSize(): Promise<BundleAnalysis> {
  const distPath = path.join(process.cwd(), 'dist/ui');
  
  if (!fs.existsSync(distPath)) {
    console.log('Building application first...');
    await execAsync('npm run build:client');
  }

  const analysis: BundleAnalysis = {
    totalSize: 0,
    gzippedSize: 0,
    chunks: [],
    assets: []
  };

  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath, { recursive: true }) as string[];
    
    for (const file of files) {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        analysis.totalSize += stats.size;
        
        analysis.assets.push({
          name: file,
          size: stats.size
        });

        // Categorize chunks
        if (file.includes('vendor') || file.includes('chunk')) {
          analysis.chunks.push({
            name: file,
            size: stats.size,
            gzipped: Math.round(stats.size * 0.3) // Estimated gzip ratio
          });
        }
      }
    }
  }

  analysis.gzippedSize = Math.round(analysis.totalSize * 0.3); // Estimated gzip ratio
  
  return analysis;
}

function checkOptimizations(): PerformanceReport['optimizations'] {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  const srcFiles = getAllTsxFiles('src/ui');

  return {
    codesplitting: viteConfig.includes('manualChunks') && 
                   srcFiles.some(content => content.includes('React.lazy')),
    treeshaking: viteConfig.includes('treeshake'),
    minification: viteConfig.includes('minify'),
    compression: viteConfig.includes('compression') || viteConfig.includes('gzip'),
    lazyLoading: srcFiles.some(content => content.includes('React.lazy') || content.includes('loading="lazy"')),
    serviceWorker: fs.existsSync('public/sw.js') && 
                   srcFiles.some(content => content.includes('serviceWorker')),
    webVitals: packageJson.dependencies?.['web-vitals'] && 
               srcFiles.some(content => content.includes('web-vitals'))
  };
}

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const items = fs.readdirSync(dir, { recursive: true }) as string[];
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isFile() && (item.endsWith('.tsx') || item.endsWith('.ts'))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        files.push(content);
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }
  
  return files;
}

function generateRecommendations(bundleAnalysis: BundleAnalysis, optimizations: PerformanceReport['optimizations']): string[] {
  const recommendations: string[] = [];
  const targetSize = 1.5 * 1024 * 1024; // 1.5MB target

  // Bundle size recommendations
  if (bundleAnalysis.totalSize > targetSize) {
    const excess = ((bundleAnalysis.totalSize - targetSize) / 1024 / 1024).toFixed(2);
    recommendations.push(`Bundle size is ${excess}MB over target. Consider more aggressive code splitting.`);
  }

  // Optimization recommendations
  if (!optimizations.codesplitting) {
    recommendations.push('Implement code splitting with React.lazy() for route-level components.');
  }

  if (!optimizations.treeshaking) {
    recommendations.push('Enable tree shaking in Vite configuration to remove dead code.');
  }

  if (!optimizations.lazyLoading) {
    recommendations.push('Add lazy loading for images and heavy components.');
  }

  if (!optimizations.serviceWorker) {
    recommendations.push('Implement service worker for offline caching and faster load times.');
  }

  if (!optimizations.webVitals) {
    recommendations.push('Add Core Web Vitals monitoring to track performance metrics.');
  }

  // Large chunk analysis
  const largeChunks = bundleAnalysis.chunks.filter(chunk => chunk.size > 500 * 1024); // > 500KB
  if (largeChunks.length > 0) {
    recommendations.push(`Large chunks detected: ${largeChunks.map(c => c.name).join(', ')}. Consider splitting further.`);
  }

  // Success message if everything looks good
  if (recommendations.length === 0) {
    recommendations.push('🎉 All performance optimizations are implemented!');
  }

  return recommendations;
}

function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
}

function formatReport(report: PerformanceReport): string {
  const { bundleAnalysis, optimizations, recommendations } = report;
  
  return `
📊 PERFORMANCE ANALYSIS REPORT
${'='.repeat(50)}

🎯 BUNDLE SIZE ANALYSIS
• Total Size: ${formatSize(bundleAnalysis.totalSize)}
• Estimated Gzipped: ${formatSize(bundleAnalysis.gzippedSize)}
• Target: 1.50MB
• Status: ${bundleAnalysis.totalSize <= 1.5 * 1024 * 1024 ? '✅ GOOD' : '❌ OVER TARGET'}

📦 CHUNK BREAKDOWN
${bundleAnalysis.chunks.map(chunk => 
  `• ${chunk.name}: ${formatSize(chunk.size)} (${formatSize(chunk.gzipped)} gzipped)`
).join('\n')}

🚀 OPTIMIZATIONS STATUS
• Code Splitting: ${optimizations.codesplitting ? '✅' : '❌'}
• Tree Shaking: ${optimizations.treeshaking ? '✅' : '❌'}
• Minification: ${optimizations.minification ? '✅' : '❌'}
• Lazy Loading: ${optimizations.lazyLoading ? '✅' : '❌'}
• Service Worker: ${optimizations.serviceWorker ? '✅' : '❌'}
• Web Vitals: ${optimizations.webVitals ? '✅' : '❌'}

💡 RECOMMENDATIONS
${recommendations.map(rec => `• ${rec}`).join('\n')}

🎯 PERFORMANCE TARGETS
• First Contentful Paint (FCP): < 1.8s
• Largest Contentful Paint (LCP): < 2.5s
• First Input Delay (FID): < 100ms
• Cumulative Layout Shift (CLS): < 0.1

Run 'npm run dev' and check the browser console for real-time Core Web Vitals metrics.
  `;
}

async function main() {
  try {
    console.log('🔍 Analyzing frontend performance...\n');

    const bundleAnalysis = await analyzeBundleSize();
    const optimizations = checkOptimizations();
    const recommendations = generateRecommendations(bundleAnalysis, optimizations);

    const report: PerformanceReport = {
      bundleAnalysis,
      optimizations,
      recommendations
    };

    console.log(formatReport(report));

    // Save report to file
    const reportPath = path.join(process.cwd(), 'performance-report.txt');
    fs.writeFileSync(reportPath, formatReport(report));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Exit with error code if recommendations exist (excluding success message)
    const hasIssues = recommendations.some(rec => !rec.includes('🎉'));
    process.exit(hasIssues ? 1 : 0);

  } catch (error) {
    console.error('Error analyzing performance:', error);
    process.exit(1);
  }
}

// Run the main function directly since this is an ES module
main();