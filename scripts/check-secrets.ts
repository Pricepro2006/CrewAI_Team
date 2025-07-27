#!/usr/bin/env tsx

/**
 * Security script to check for potential secrets, API keys, and sensitive data
 * in staged files before commit.
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

// Common patterns for secrets and sensitive data
const SECRET_PATTERNS = [
  // API Keys
  /api[_-]?key\s*[:=]\s*['"`]?[a-zA-Z0-9]{20,}['"`]?/i,
  /secret[_-]?key\s*[:=]\s*['"`]?[a-zA-Z0-9]{20,}['"`]?/i,
  
  // Database credentials
  /password\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i,
  /db[_-]?password\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i,
  
  // JWT secrets
  /jwt[_-]?secret\s*[:=]\s*['"`][a-zA-Z0-9]{20,}['"`]?/i,
  
  // AWS/Cloud credentials
  /aws[_-]?access[_-]?key[_-]?id\s*[:=]\s*['"`]?AKIA[0-9A-Z]{16}['"`]?/i,
  /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"`]?[A-Za-z0-9/+=]{40}['"`]?/i,
  
  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/,
  
  // Generic high-entropy strings that might be secrets
  /['"`][A-Za-z0-9+/=]{40,}['"`]/,
];

// Files to exclude from secret scanning
const EXCLUDED_FILES = [
  '.env.example',
  '.env.template',
  'README.md',
  'SECURITY.md',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
];

// Directories to exclude
const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
];

interface SecretViolation {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return output.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    console.log('No staged files found or git not available');
    return [];
  }
}

function shouldScanFile(filePath: string): boolean {
  // Check if file exists
  if (!existsSync(filePath)) {
    return false;
  }

  // Check excluded files
  const fileName = filePath.split('/').pop() || '';
  if (EXCLUDED_FILES.includes(fileName)) {
    return false;
  }

  // Check excluded directories
  if (EXCLUDED_DIRS.some(dir => filePath.includes(dir))) {
    return false;
  }

  // Only scan text files
  const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.env', '.yml', '.yaml'];
  const hasTextExtension = textExtensions.some(ext => filePath.endsWith(ext));
  
  return hasTextExtension;
}

function scanFileForSecrets(filePath: string): SecretViolation[] {
  const violations: SecretViolation[] = [];
  
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineNumber) => {
      SECRET_PATTERNS.forEach(pattern => {
        const match = line.match(pattern);
        if (match) {
          violations.push({
            file: filePath,
            line: lineNumber + 1,
            pattern: pattern.source,
            content: line.trim().substring(0, 100) + (line.length > 100 ? '...' : '')
          });
        }
      });
    });
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}: ${error}`);
  }
  
  return violations;
}

function main(): void {
  console.log('🔐 Checking for secrets and sensitive data...');
  
  const stagedFiles = getStagedFiles();
  
  if (stagedFiles.length === 0) {
    console.log('✅ No staged files to check');
    return;
  }
  
  const allViolations: SecretViolation[] = [];
  
  stagedFiles.forEach(file => {
    if (shouldScanFile(file)) {
      const violations = scanFileForSecrets(file);
      allViolations.push(...violations);
    }
  });
  
  if (allViolations.length > 0) {
    console.error('❌ Potential secrets detected in staged files:');
    console.error('');
    
    allViolations.forEach(violation => {
      console.error(`📁 File: ${violation.file}:${violation.line}`);
      console.error(`🔍 Pattern: ${violation.pattern}`);
      console.error(`📝 Content: ${violation.content}`);
      console.error('');
    });
    
    console.error('Please review these files and remove any sensitive data before committing.');
    console.error('If these are false positives, consider:');
    console.error('1. Using environment variables for configuration');
    console.error('2. Adding the file to .gitignore if it contains test data');
    console.error('3. Using placeholder values in examples');
    console.error('');
    
    process.exit(1);
  }
  
  console.log('✅ No secrets detected in staged files');
}

// Run the check if this script is executed directly
// Check if running as main module in ESM
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as checkSecrets };