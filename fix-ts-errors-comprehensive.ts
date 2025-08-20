#!/usr/bin/env node

/**
 * Comprehensive TypeScript error fixing script
 * This script systematically fixes common TypeScript errors across the codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ErrorFix {
  pattern: RegExp;
  replacement: string | ((match: string, ...args: any[]) => string);
  description: string;
}

const fixes: ErrorFix[] = [
  // Fix TS2345: Type assignment errors
  {
    pattern: /logger\.(error|warn|info)\(([^,]+),\s*error\)/g,
    replacement: 'logger.$1($2, error as string)',
    description: 'Add type assertions to logger error parameters'
  },
  
  // Fix TS2339: Missing properties - add optional chaining
  {
    pattern: /(\w+)\.(\w+)\.(\w+)/g,
    replacement: (match, obj, prop1, prop2) => {
      // Don't modify if it's already optional chained or is a known safe pattern
      if (match.includes('?.') || match.startsWith('process.') || match.startsWith('Math.') || 
          match.startsWith('Date.') || match.startsWith('JSON.') || match.startsWith('console.')) {
        return match;
      }
      return `${obj}?.${prop1}?.${prop2}`;
    },
    description: 'Add optional chaining for nested property access'
  },
  
  // Fix TS7006: Implicit any types
  {
    pattern: /catch\s*\(error\)/g,
    replacement: 'catch (error: unknown)',
    description: 'Add unknown type to catch block errors'
  },
  
  // Fix TS2532: Possibly undefined - add null guards
  {
    pattern: /if\s*\(([^)]+)\)\s*{/g,
    replacement: (match, condition) => {
      // Don't modify if already has a null check
      if (condition.includes('!==') || condition.includes('===') || condition.includes('?.')) {
        return match;
      }
      // For simple variable checks, add explicit undefined check
      if (/^\w+$/.test(condition.trim())) {
        return `if (${condition} !== undefined) {`;
      }
      return match;
    },
    description: 'Add explicit undefined checks'
  },
  
  // Fix TS2322: Type incompatibilities - handle undefined in assignments
  {
    pattern: /: string = ([^;]+);/g,
    replacement: (match, value) => {
      // If the value might be undefined, add fallback
      if (value.includes('?.') || value.includes('||')) {
        return match;
      }
      if (!value.includes('"') && !value.includes("'") && !value.includes('`')) {
        return `: string = ${value} || '';`;
      }
      return match;
    },
    description: 'Add fallback values for potentially undefined strings'
  },
  
  // Fix function return type issues
  {
    pattern: /async\s+(\w+)\s*\([^)]*\)\s*{/g,
    replacement: (match, funcName) => {
      // Don't modify if already has return type
      if (match.includes(':')) {
        return match;
      }
      return match.replace('{', ': Promise<void> {');
    },
    description: 'Add Promise<void> return type to async functions without return types'
  }
];

function processFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixCount = 0;
  
  fixes.forEach(fix => {
    const originalContent = content;
    content = content.replace(fix.pattern, fix.replacement as any);
    if (content !== originalContent) {
      fixCount++;
    }
  });
  
  if (fixCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${fixCount} issues in ${filePath}`);
  }
  
  return fixCount;
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findTypeScriptFiles(fullPath));
    } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function main() {
  console.log('Starting comprehensive TypeScript error fixing...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = findTypeScriptFiles(srcDir);
  
  console.log(`Found ${files.length} TypeScript files to process`);
  
  let totalFixes = 0;
  for (const file of files) {
    totalFixes += processFile(file);
  }
  
  console.log(`\nTotal fixes applied: ${totalFixes}`);
  
  // Run TypeScript compiler to check remaining errors
  console.log('\nRunning TypeScript compiler to check remaining errors...');
  try {
    const result = execSync('pnpm tsc --noEmit 2>&1 | grep "error TS" | wc -l', { encoding: 'utf-8' });
    console.log(`Remaining TypeScript errors: ${result.trim()}`);
  } catch (error) {
    console.log('Could not count remaining errors');
  }
}

// Run the script
main();