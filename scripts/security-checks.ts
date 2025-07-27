#!/usr/bin/env node

/**
 * Security checks for pre-commit hook
 * Checks for common security issues in TypeScript/JavaScript files
 */

import fs from 'fs';
import path from 'path';

// Get all staged files from command line arguments
const files = process.argv.slice(2);

interface SecurityError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

interface SecurityPattern {
  pattern: RegExp;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

let hasErrors = false;
const errors: SecurityError[] = [];

// Security patterns to check
const securityPatterns: SecurityPattern[] = [
  {
    pattern: /console\.(log|info|warn|error|debug)\s*\(/g,
    message: 'Console statements found. Remove before committing.',
    severity: 'warning'
  },
  {
    pattern: /debugger\s*;/g,
    message: 'Debugger statement found. Remove before committing.',
    severity: 'error'
  },
  {
    pattern: /TODO|FIXME|HACK|XXX/g,
    message: 'TODO/FIXME comment found. Consider addressing before committing.',
    severity: 'info'
  },
  {
    pattern: /eval\s*\(/g,
    message: 'eval() usage found. This is a security risk.',
    severity: 'error'
  },
  {
    pattern: /innerHTML\s*=/g,
    message: 'innerHTML usage found. Consider using textContent or sanitization.',
    severity: 'warning'
  },
  {
    pattern: /document\.write\s*\(/g,
    message: 'document.write() found. This is a security risk.',
    severity: 'error'
  },
  {
    pattern: /window\.(location|open)\s*=/g,
    message: 'Direct window navigation found. Ensure proper validation.',
    severity: 'warning'
  },
  {
    pattern: /process\.env\.[A-Z_]+\s*\|\|\s*["'][^"']+["']/g,
    message: 'Hardcoded fallback for environment variable found.',
    severity: 'warning'
  },
  {
    pattern: /<script[^>]*>/gi,
    message: 'Script tag found in code. Potential XSS risk.',
    severity: 'error'
  },
  {
    pattern: /password\s*[:=]\s*["'][^"']+["']/gi,
    message: 'Hardcoded password found.',
    severity: 'error'
  },
  {
    pattern: /api[_\-]?key\s*[:=]\s*["'][^"']+["']/gi,
    message: 'Hardcoded API key found.',
    severity: 'error'
  }
];

// Check each file
files.forEach((file: string) => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js') && !file.endsWith('.jsx')) {
    return;
  }

  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    securityPatterns.forEach(({ pattern, message, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const line = lines[lineNumber - 1]?.trim() || '';
        
        // Skip if it's in a comment
        if (line.startsWith('//') || line.startsWith('*')) {
          continue;
        }

        errors.push({
          file,
          line: lineNumber,
          message,
          severity,
          code: line.substring(0, 80) + (line.length > 80 ? '...' : '')
        });

        if (severity === 'error') {
          hasErrors = true;
        }
      }
    });
  } catch (error) {
    console.error(`Error reading file ${file}:`, error instanceof Error ? error.message : String(error));
  }
});

// Output results
if (errors.length > 0) {
  console.log('\n🔍 Security Check Results:\n');
  
  const errorsByFile = errors.reduce<Record<string, SecurityError[]>>((acc, error) => {
    if (!acc[error.file]) acc[error.file] = [];
    acc[error.file]!.push(error);
    return acc;
  }, {});

  Object.entries(errorsByFile).forEach(([file, fileErrors]) => {
    console.log(`📄 ${file}`);
    fileErrors.forEach(error => {
      const icon = error.severity === 'error' ? '❌' : error.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`  ${icon} Line ${error.line}: ${error.message}`);
      console.log(`     ${error.code}`);
    });
    console.log('');
  });

  if (hasErrors) {
    console.log('❌ Security check failed. Fix errors before committing.');
    console.log('💡 To bypass (use with caution): git commit --no-verify\n');
    process.exit(1);
  } else {
    console.log('⚠️  Security warnings found. Consider addressing them.');
    console.log('✅ No blocking errors found. Proceeding with commit.\n');
  }
} else {
  console.log('✅ Security checks passed.\n');
}

process.exit(0);