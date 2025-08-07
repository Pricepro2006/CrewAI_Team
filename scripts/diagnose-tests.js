#!/usr/bin/env node

/**
 * Test Discovery and Diagnostics Script
 * Analyzes test configuration and discovers issues
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 WALMART GROCERY AGENT - TEST DIAGNOSTICS');
console.log('='.repeat(60));

// Check test directories
function checkTestDirectories() {
  console.log('\n📁 Test Directory Analysis:');
  
  const testDirs = [
    './tests/e2e',
    './tests/browser-compatibility',
    './tests/config',
    './tests/production'
  ];
  
  testDirs.forEach(dir => {
    const fullPath = path.resolve(dir);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath, { withFileTypes: true });
      const testFiles = files.filter(f => f.name.endsWith('.spec.ts') || f.name.endsWith('.test.ts'));
      console.log(`✅ ${dir}: ${files.length} files, ${testFiles.length} test files`);
      
      testFiles.forEach(file => {
        console.log(`   - ${file.name}`);
      });
    } else {
      console.log(`❌ ${dir}: Directory not found`);
    }
  });
}

// Check configuration files
function checkConfigurations() {
  console.log('\n⚙️  Configuration Files Analysis:');
  
  const configs = [
    './playwright.config.ts',
    './playwright.e2e.config.ts', 
    './vitest.config.ts',
    './vitest.integration.config.ts'
  ];
  
  configs.forEach(config => {
    if (fs.existsSync(config)) {
      console.log(`✅ ${config}: Found`);
      try {
        const content = fs.readFileSync(config, 'utf8');
        if (content.includes('testDir')) {
          const testDirMatch = content.match(/testDir:\s*['"]([^'"]+)['"]/);
          if (testDirMatch) {
            console.log(`   → testDir: ${testDirMatch[1]}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error reading config: ${error.message}`);
      }
    } else {
      console.log(`❌ ${config}: Not found`);
    }
  });
}

// Check dependencies
function checkDependencies() {
  console.log('\n📦 Dependencies Analysis:');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const testDeps = [
      '@playwright/test',
      'vitest',
      '@testing-library/react',
      '@testing-library/jest-dom',
      'playwright'
    ];
    
    testDeps.forEach(dep => {
      if (deps[dep]) {
        console.log(`✅ ${dep}: ${deps[dep]}`);
      } else {
        console.log(`❌ ${dep}: Not installed`);
      }
    });
  } catch (error) {
    console.log(`❌ Error reading package.json: ${error.message}`);
  }
}

// Check server status
function checkServers() {
  console.log('\n🌐 Server Status Analysis:');
  
  const ports = [5178, 3000, 3001];
  
  ports.forEach(port => {
    try {
      const result = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}`, { timeout: 5000 });
      const statusCode = result.toString().trim();
      if (statusCode === '200' || statusCode === '404') {
        console.log(`✅ Port ${port}: Server responding (HTTP ${statusCode})`);
      } else {
        console.log(`⚠️  Port ${port}: Unexpected response (HTTP ${statusCode})`);
      }
    } catch (error) {
      console.log(`❌ Port ${port}: Server not responding`);
    }
  });
}

// Run test file analysis
function analyzeTestFiles() {
  console.log('\n🧪 Test File Analysis:');
  
  const testFiles = [
    './tests/e2e/walmart-grocery-agent.spec.ts',
    './tests/e2e/websocket-realtime.spec.ts',
    './tests/e2e/integration-workflows.spec.ts',
    './tests/e2e/visual-regression.spec.ts'
  ];
  
  testFiles.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const testBlocks = (content.match(/test\(/g) || []).length;
        const describeBlocks = (content.match(/test\.describe\(/g) || []).length;
        const imports = (content.match(/^import.*from/gm) || []).length;
        
        console.log(`✅ ${path.basename(file)}:`);
        console.log(`   - ${testBlocks} test() blocks`);
        console.log(`   - ${describeBlocks} describe() blocks`);
        console.log(`   - ${imports} import statements`);
        
        // Check for potential issues
        if (content.includes('.js\'') && file.endsWith('.ts')) {
          console.log(`   ⚠️  Uses .js imports in TypeScript file`);
        }
        
        if (!content.includes('test(') && !content.includes('it(')) {
          console.log(`   ❌ No test cases found`);
        }
        
      } catch (error) {
        console.log(`❌ ${file}: Error reading file - ${error.message}`);
      }
    } else {
      console.log(`❌ ${file}: File not found`);
    }
  });
}

// Generate recommendations
function generateRecommendations() {
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('='.repeat(40));
  
  // Check for configuration mismatch
  if (fs.existsSync('./playwright.config.ts')) {
    const content = fs.readFileSync('./playwright.config.ts', 'utf8');
    if (content.includes('browser-compatibility') && fs.existsSync('./tests/e2e')) {
      console.log('🔧 CRITICAL: Playwright config points to browser-compatibility but e2e tests exist');
      console.log('   → Use: npx playwright test --config=playwright.e2e.config.ts');
    }
  }
  
  // Check test file extensions
  const e2eFiles = fs.existsSync('./tests/e2e') ? fs.readdirSync('./tests/e2e') : [];
  const specFiles = e2eFiles.filter(f => f.endsWith('.spec.ts'));
  
  if (specFiles.length > 0) {
    console.log(`✅ Found ${specFiles.length} test specification files`);
    console.log('   → Run: npx playwright test --config=playwright.e2e.config.ts');
  } else {
    console.log('❌ No .spec.ts files found in tests/e2e');
  }
  
  // Server recommendations
  console.log('\n🚀 QUICK START COMMANDS:');
  console.log('1. Start development server: npm run dev-server');
  console.log('2. Run E2E tests: npx playwright test --config=playwright.e2e.config.ts');
  console.log('3. Run browser tests: npx playwright test --config=playwright.config.ts');
  console.log('4. View reports: npx playwright show-report playwright-report-e2e');
}

// Main execution
async function main() {
  try {
    checkTestDirectories();
    checkConfigurations();
    checkDependencies();
    checkServers();
    analyzeTestFiles();
    generateRecommendations();
    
    console.log('\n✅ Diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    process.exit(1);
  }
}

main();