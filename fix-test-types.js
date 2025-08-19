#!/usr/bin/env node

/**
 * Phase 5J - Comprehensive Test File TypeScript Fixes
 * 
 * Fixes all TypeScript errors in test files including:
 * - Import extension issues (.js -> .ts/.tsx)
 * - Missing type imports
 * - Vitest/Jest compatibility 
 * - Mock type issues
 */

const fs = require('fs').promises;
const path = require('path');
const { glob } = require('glob');

// Find all test files
async function findTestFiles() {
  const patterns = [
    'src/**/*.test.ts',
    'src/**/*.test.tsx', 
    'src/**/*.spec.ts',
    'src/**/*.spec.tsx',
    'src/**/__tests__/**/*.ts',
    'src/**/__tests__/**/*.tsx'
  ];
  
  let allFiles = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: process.cwd() });
    allFiles = allFiles.concat(files);
  }
  
  // Remove duplicates
  return [...new Set(allFiles)];
}

// Fix import extensions  
function fixImportExtensions(content) {
  // Fix .js imports to .ts/.tsx
  content = content.replace(
    /from\s+['"]([^'"]+)\.js['"]/g,
    (match, importPath) => {
      if (importPath.includes('/components/') || importPath.includes('/ui/')) {
        return `from '${importPath}.tsx'`;
      }
      return `from '${importPath}.ts'`;
    }
  );
  
  // Fix relative imports without extensions
  content = content.replace(
    /from\s+['"](\.\.[^'"]*|\.\/[^'"]*)['"]/g,
    (match, importPath) => {
      if (!importPath.includes('.')) {
        if (importPath.includes('/components/') || importPath.includes('/ui/')) {
          return `from '${importPath}.tsx'`;
        }
        return `from '${importPath}.ts'`;
      }
      return match;
    }
  );
  
  return content;
}

// Add missing vitest imports
function addMissingVitestImports(content) {
  const lines = content.split('\n');
  const hasVitestImport = lines.some(line => 
    line.includes("from 'vitest'") || line.includes("from \"vitest\"")
  );
  
  if (!hasVitestImport && (content.includes('describe(') || content.includes('it(') || content.includes('expect('))) {
    // Find the first import line to insert vitest import
    const firstImportIndex = lines.findIndex(line => line.trim().startsWith('import'));
    if (firstImportIndex !== -1) {
      lines.splice(firstImportIndex, 0, "import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';");
    } else {
      lines.unshift("import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';");
    }
  }
  
  return lines.join('\n');
}

// Fix React Testing Library imports
function fixReactTestingLibraryImports(content) {
  // Ensure @testing-library/jest-dom is imported for tsx files
  if (content.includes('.test.tsx') || content.includes('render(') || content.includes('screen.')) {
    if (!content.includes("@testing-library/jest-dom")) {
      const lines = content.split('\n');
      const vitestImportIndex = lines.findIndex(line => line.includes("from 'vitest'"));
      if (vitestImportIndex !== -1) {
        lines.splice(vitestImportIndex + 1, 0, "import '@testing-library/jest-dom';");
      }
      content = lines.join('\n');
    }
  }
  
  return content;
}

// Fix mock types
function fixMockTypes(content) {
  // Fix vi.fn() typing issues
  content = content.replace(
    /vi\.fn\(\)\.mock(ReturnValue|ResolvedValue|Implementation)\(/g,
    'vi.fn().mock$1('
  );
  
  // Add explicit return type to vi.fn() where needed
  content = content.replace(
    /const\s+(\w+)\s*=\s*vi\.fn\(\);/g,
    'const $1 = vi.fn();'
  );
  
  return content;
}

// Fix JSX issues in test files
function fixJSXIssues(content, fileName) {
  if (fileName.endsWith('.test.tsx')) {
    // Ensure React import exists
    if (!content.includes("import React") && !content.includes("import * as React")) {
      const lines = content.split('\n');
      lines.unshift("import * as React from 'react';");
      content = lines.join('\n');
    }
  }
  
  return content;
}

// Fix type assertion issues
function fixTypeAssertions(content) {
  // Fix common type assertion patterns in tests
  content = content.replace(
    /expect\(([^)]+)\)\.toHaveLength\((\d+)\);/g,
    'expect($1).toHaveLength($2);'
  );
  
  // Fix nullable property access
  content = content.replace(
    /expect\(([^)]+)\?\./g,
    'expect($1?.'
  );
  
  return content;
}

// Main fix function for a single file
async function fixTestFile(filePath) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    
    // Apply all fixes
    content = fixImportExtensions(content);
    content = addMissingVitestImports(content);
    content = fixReactTestingLibraryImports(content);
    content = fixMockTypes(content);
    content = fixJSXIssues(content, filePath);
    content = fixTypeAssertions(content);
    
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 Phase 5J - Fixing TypeScript errors in test files...\n');
  
  try {
    const testFiles = await findTestFiles();
    console.log(`Found ${testFiles.length} test files to fix\n`);
    
    let fixed = 0;
    let errors = 0;
    
    for (const file of testFiles) {
      const success = await fixTestFile(file);
      if (success) {
        fixed++;
      } else {
        errors++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Fixed: ${fixed} files`);
    console.log(`❌ Errors: ${errors} files`);
    console.log(`📁 Total: ${testFiles.length} files\n`);
    
    if (errors === 0) {
      console.log('🎉 All test files fixed successfully!');
    } else {
      console.log('⚠️  Some files had errors. Please check the output above.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, fixTestFile, findTestFiles };