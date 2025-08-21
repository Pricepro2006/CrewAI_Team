#!/usr/bin/env node

/**
 * Security Audit Script
 * Checks for common security vulnerabilities and configuration issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const SECURITY_ISSUES = [];
const WARNINGS = [];
const PASSED = [];

console.log('🔐 Security Audit for CrewAI Team\n');
console.log('=' .repeat(50));

// Check 1: Verify .env is not tracked in git
function checkEnvGitIgnore() {
  console.log('\n📝 Checking .env file security...');
  
  const gitignorePath = path.join(projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (gitignore.includes('.env')) {
      PASSED.push('✅ .env is in .gitignore');
    } else {
      SECURITY_ISSUES.push('❌ CRITICAL: .env is NOT in .gitignore - secrets could be committed!');
    }
  } else {
    SECURITY_ISSUES.push('❌ CRITICAL: No .gitignore file found!');
  }

  // Check if .env.example exists
  if (fs.existsSync(path.join(projectRoot, '.env.example'))) {
    PASSED.push('✅ .env.example template exists');
  } else {
    WARNINGS.push('⚠️ No .env.example file - create one for documentation');
  }
}

// Check 2: Verify no hardcoded secrets in source files
function checkHardcodedSecrets() {
  console.log('\n🔍 Scanning for hardcoded secrets...');
  
  const suspiciousPatterns = [
    /api[_-]?key\s*=\s*["'][a-zA-Z0-9]{20,}/gi,
    /secret\s*=\s*["'][a-zA-Z0-9]{20,}/gi,
    /password\s*=\s*["'][^"']{8,}/gi,
    /token\s*=\s*["'][a-zA-Z0-9]{20,}/gi,
    /client[_-]?secret\s*=\s*["'][a-zA-Z0-9]{20,}/gi
  ];

  const srcDir = path.join(projectRoot, 'src');
  const files = getAllFiles(srcDir, ['.ts', '.js', '.tsx', '.jsx']);
  
  let foundIssues = false;
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    suspiciousPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        // Exclude test files and example patterns
        if (!file.includes('.test.') && !file.includes('.spec.') && 
            !file.includes('example') && !file.includes('template')) {
          SECURITY_ISSUES.push(`❌ Possible hardcoded secret in ${path.relative(projectRoot, file)}`);
          foundIssues = true;
        }
      }
    });
  });

  if (!foundIssues) {
    PASSED.push('✅ No hardcoded secrets detected in source files');
  }
}

// Check 3: Verify Math.random() is not used for security
function checkCryptoUsage() {
  console.log('\n🎲 Checking cryptographic security...');
  
  const srcDir = path.join(projectRoot, 'src');
  const files = getAllFiles(srcDir, ['.ts', '.js']);
  
  let foundMathRandom = false;
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for Math.random in security contexts
    if (content.includes('Math.random') && 
        (content.includes('password') || content.includes('token') || 
         content.includes('secret') || content.includes('key'))) {
      
      // Exclude test files
      if (!file.includes('.test.') && !file.includes('.spec.')) {
        SECURITY_ISSUES.push(`❌ Math.random() used in security context: ${path.relative(projectRoot, file)}`);
        foundMathRandom = true;
      }
    }
    
    // Check for proper crypto usage
    if (content.includes('crypto.randomBytes')) {
      PASSED.push(`✅ Secure crypto.randomBytes used in ${path.relative(projectRoot, file)}`);
    }
  });

  if (!foundMathRandom) {
    PASSED.push('✅ No insecure Math.random() usage in security contexts');
  }
}

// Check 4: Verify environment variables
function checkEnvironmentVars() {
  console.log('\n🔧 Checking environment configuration...');
  
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    
    // Check for placeholder values
    if (env.includes('your-') || env.includes('xxx') || env.includes('placeholder')) {
      WARNINGS.push('⚠️ Placeholder values detected in .env - ensure real values are configured');
    }
    
    // Check JWT secret length
    const jwtMatch = env.match(/JWT_SECRET=(.+)/);
    if (jwtMatch && jwtMatch[1]) {
      if (jwtMatch[1].length < 32) {
        SECURITY_ISSUES.push('❌ JWT_SECRET is too short (minimum 32 characters recommended)');
      } else {
        PASSED.push('✅ JWT_SECRET has sufficient length');
      }
    }
    
    // Check for required security vars
    const requiredVars = ['JWT_SECRET', 'NODE_ENV'];
    requiredVars.forEach(varName => {
      if (!env.includes(`${varName}=`)) {
        SECURITY_ISSUES.push(`❌ Missing required environment variable: ${varName}`);
      }
    });
  } else {
    WARNINGS.push('⚠️ No .env file found - ensure it\'s created from .env.example');
  }
}

// Check 5: Verify WebSocket authentication
function checkWebSocketAuth() {
  console.log('\n🔌 Checking WebSocket security...');
  
  const wsGatewayPath = path.join(projectRoot, 'src/api/websocket/WebSocketGateway.ts');
  if (fs.existsSync(wsGatewayPath)) {
    const content = fs.readFileSync(wsGatewayPath, 'utf8');
    
    // Check for async token validation
    if (content.includes('async verifyClient') && content.includes('validateToken')) {
      PASSED.push('✅ WebSocket has async authentication implementation');
    } else if (content.includes('// Note: This should be async')) {
      SECURITY_ISSUES.push('❌ WebSocket authentication is using synchronous placeholder');
    }
    
    // Check for proper Bearer token extraction
    if (content.includes('Bearer ')) {
      PASSED.push('✅ WebSocket handles Bearer token format');
    }
  }
}

// Helper function to get all files recursively
function getAllFiles(dirPath, extensions = []) {
  const files = [];
  
  function traverse(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        traverse(fullPath);
      } else if (entry.isFile()) {
        if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dirPath);
  return files;
}

// Run all checks
checkEnvGitIgnore();
checkHardcodedSecrets();
checkCryptoUsage();
checkEnvironmentVars();
checkWebSocketAuth();

// Generate report
console.log('\n' + '=' .repeat(50));
console.log('📊 Security Audit Report\n');

if (PASSED.length > 0) {
  console.log('✅ Passed Checks:');
  PASSED.forEach(item => console.log(`   ${item}`));
}

if (WARNINGS.length > 0) {
  console.log('\n⚠️  Warnings:');
  WARNINGS.forEach(item => console.log(`   ${item}`));
}

if (SECURITY_ISSUES.length > 0) {
  console.log('\n❌ Security Issues Found:');
  SECURITY_ISSUES.forEach(item => console.log(`   ${item}`));
  console.log('\n🚨 CRITICAL: Fix security issues before deployment!');
  process.exit(1);
} else {
  console.log('\n✅ All critical security checks passed!');
  console.log('📝 Remember to:');
  console.log('   1. Update Azure Portal with new client secret');
  console.log('   2. Test all authentication flows');
  console.log('   3. Monitor for any authentication failures');
  console.log('   4. Keep secrets rotated regularly');
}

console.log('\n' + '=' .repeat(50));