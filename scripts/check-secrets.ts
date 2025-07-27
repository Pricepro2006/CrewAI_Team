#!/usr/bin/env node

/**
 * Check for hardcoded secrets and sensitive information
 * Runs on all staged files
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Get all staged files from command line arguments
const files = process.argv.slice(2);

interface SecretError {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
  type: string;
  code?: string;
}

interface SecretPattern {
  pattern: RegExp;
  type: string;
}

let hasErrors = false;
const errors: SecretError[] = [];

// Common secret patterns
const secretPatterns: SecretPattern[] = [
  // API Keys
  { pattern: /api[_-]?key\s*[:=]\s*["']([A-Za-z0-9-_]{20,})["']/gi, type: 'API Key' },
  { pattern: /apikey\s*[:=]\s*["']([A-Za-z0-9-_]{20,})["']/gi, type: 'API Key' },
  
  // AWS
  { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key' },
  { pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*["']([A-Za-z0-9/+=]{40})["']/gi, type: 'AWS Secret Key' },
  
  // Private Keys
  { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, type: 'Private Key' },
  { pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g, type: 'PGP Private Key' },
  
  // Passwords
  { pattern: /password\s*[:=]\s*["']([^"']{8,})["']/gi, type: 'Password' },
  { pattern: /pwd\s*[:=]\s*["']([^"']{8,})["']/gi, type: 'Password' },
  { pattern: /passwd\s*[:=]\s*["']([^"']{8,})["']/gi, type: 'Password' },
  
  // Database URLs
  { pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+/gi, type: 'MongoDB URL' },
  { pattern: /postgres:\/\/[^:]+:[^@]+@[^/]+/gi, type: 'PostgreSQL URL' },
  { pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+/gi, type: 'MySQL URL' },
  
  // Tokens
  { pattern: /token\s*[:=]\s*["']([A-Za-z0-9-_]{20,})["']/gi, type: 'Token' },
  { pattern: /bearer\s+([A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)/gi, type: 'JWT Token' },
  
  // OAuth
  { pattern: /client[_-]?secret\s*[:=]\s*["']([A-Za-z0-9-_]{20,})["']/gi, type: 'OAuth Secret' },
  { pattern: /refresh[_-]?token\s*[:=]\s*["']([A-Za-z0-9-_]{20,})["']/gi, type: 'Refresh Token' },
  
  // GitHub
  { pattern: /gh[opsu]_[A-Za-z0-9]{36}/g, type: 'GitHub Token' },
  { pattern: /github[_-]?token\s*[:=]\s*["']([A-Za-z0-9]{40})["']/gi, type: 'GitHub Token' },
  
  // Stripe
  { pattern: /sk_live_[A-Za-z0-9]{24,}/g, type: 'Stripe Secret Key' },
  { pattern: /rk_live_[A-Za-z0-9]{24,}/g, type: 'Stripe Restricted Key' },
  
  // SendGrid
  { pattern: /SG\.[A-Za-z0-9-_]{22}\.[A-Za-z0-9-_]{43}/g, type: 'SendGrid API Key' },
  
  // Slack
  { pattern: /xox[baprs]-[0-9]{10,}-[A-Za-z0-9]{24,}/g, type: 'Slack Token' },
  
  // Generic secrets
  { pattern: /secret\s*[:=]\s*["']([^"']{8,})["']/gi, type: 'Secret' },
  { pattern: /private[_-]?key\s*[:=]\s*["']([^"']{8,})["']/gi, type: 'Private Key' }
];

// Entropy check for high-entropy strings
function calculateEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }
  
  let entropy = 0;
  const len = str.length;
  for (const char in freq) {
    const p = freq[char]! / len;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

// Check for high entropy strings that might be secrets
function checkHighEntropy(content: string, file: string): void {
  const stringPattern = /["']([A-Za-z0-9\-_+/=]{20,})["']/g;
  let match;
  
  while ((match = stringPattern.exec(content)) !== null) {
    const str = match[1];
    if (!str) continue;
    const entropy = calculateEntropy(str);
    
    // High entropy threshold (typical for secrets)
    if (entropy > 4.5) {
      const lineNumber = content.substring(0, match.index!).split('\n').length;
      errors.push({
        file,
        line: lineNumber,
        message: `High entropy string detected (entropy: ${entropy.toFixed(2)}). Possible secret.`,
        severity: 'warning',
        type: 'High Entropy String'
      });
    }
  }
}

// Allowed exceptions (add more as needed)
const allowedPatterns = [
  /localhost/i,
  /127\.0\.0\.1/,
  /example\.com/i,
  /test/i,
  /demo/i,
  /dummy/i,
  /placeholder/i,
  /your[_-]?api[_-]?key/i,
  /your[_-]?secret/i,
  /\$\{[^}]+\}/,  // Template literals
  /process\.env\./,  // Environment variables
];

// Check each file
files.forEach((file: string) => {
  // Skip certain file types and directories
  if (file.includes('node_modules/') || 
      file.includes('.git/') ||
      file.includes('dist/') ||
      file.includes('build/') ||
      file.endsWith('.lock') ||
      file.endsWith('.log')) {
    return;
  }

  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    secretPatterns.forEach(({ pattern, type }) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index!).split('\n').length;
        const line = lines[lineNumber - 1] || '';
        
        // Check if it's an allowed pattern
        let isAllowed = false;
        for (const allowed of allowedPatterns) {
          if (allowed.test(line)) {
            isAllowed = true;
            break;
          }
        }
        
        if (!isAllowed) {
          errors.push({
            file,
            line: lineNumber,
            message: `Potential ${type} found`,
            severity: 'error',
            type,
            code: line ? line.trim().substring(0, 80) + (line.trim().length > 80 ? '...' : '') : ''
          });
          hasErrors = true;
        }
      }
    });
    
    // Check for high entropy strings
    checkHighEntropy(content, file);
    
  } catch (error: any) {
    // Skip binary files
    if (error?.code !== 'ENOENT') {
      console.error(`Error reading file ${file}:`, error?.message || String(error));
    }
  }
});

// Output results
if (errors.length > 0) {
  console.log('\n🔐 Secret Detection Results:\n');
  
  const errorsByFile = errors.reduce<Record<string, SecretError[]>>((acc, error) => {
    if (!acc[error.file]) acc[error.file] = [];
    acc[error.file]!.push(error);
    return acc;
  }, {});

  Object.entries(errorsByFile).forEach(([file, fileErrors]) => {
    console.log(`📄 ${file}`);
    fileErrors.forEach(error => {
      const icon = error.severity === 'error' ? '🚨' : '⚠️';
      console.log(`  ${icon} Line ${error.line}: ${error.message}`);
      if (error.code) {
        console.log(`     ${error.code}`);
      }
    });
    console.log('');
  });

  if (hasErrors) {
    console.log('🚨 Potential secrets detected! Do not commit sensitive information.');
    console.log('💡 Use environment variables or a secrets management system instead.');
    console.log('💡 To bypass (ONLY if false positive): git commit --no-verify\n');
    process.exit(1);
  }
}

process.exit(0);