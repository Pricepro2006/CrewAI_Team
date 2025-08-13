#!/usr/bin/env node

/**
 * Security Setup Script
 * Helps users set up secure credentials and validates the environment
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function generateJWTSecret() {
  return crypto.randomBytes(64).toString('base64url');
}

function generateClientState() {
  return crypto.randomBytes(32).toString('hex');
}

function checkEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found!', 'red');
    
    if (fs.existsSync(envExamplePath)) {
      log('📋 Copying .env.example to .env...', 'blue');
      fs.copyFileSync(envExamplePath, envPath);
      log('✅ Created .env file from template', 'green');
    } else {
      log('❌ .env.example not found either!', 'red');
      process.exit(1);
    }
  }
  
  return envPath;
}

function checkGitIgnore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  
  if (!fs.existsSync(gitignorePath)) {
    log('⚠️  .gitignore not found!', 'yellow');
    return false;
  }
  
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignoreContent.includes('.env')) {
    log('⚠️  .env not in .gitignore!', 'yellow');
    
    // Add .env to .gitignore
    fs.appendFileSync(gitignorePath, '\n# Environment variables\n.env\n.env.*\n!.env.example\n');
    log('✅ Added .env to .gitignore', 'green');
  }
  
  return true;
}

function checkExposedCredentials() {
  try {
    // Check if .env is tracked by git
    const gitFiles = execSync('git ls-files', { encoding: 'utf8' });
    if (gitFiles.includes('.env')) {
      log('🚨 CRITICAL: .env file is tracked by git!', 'red');
      log('   Run: git rm --cached .env', 'yellow');
      log('   Run: git commit -m "Remove .env from version control"', 'yellow');
      return false;
    }
    
    // Check for sensitive patterns in git history
    const sensitivePatterns = [
      'MSGRAPH_CLIENT_SECRET=',
      'JWT_SECRET=',
      'CLIENT_SECRET='
    ];
    
    let foundExposed = false;
    for (const pattern of sensitivePatterns) {
      try {
        execSync(`git log --all -p -S "${pattern}" --`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        log(`⚠️  Found "${pattern}" in git history!`, 'yellow');
        foundExposed = true;
      } catch {
        // No matches found, which is good
      }
    }
    
    if (foundExposed) {
      log('🔄 Consider rotating these credentials!', 'yellow');
    }
    
    return !foundExposed;
  } catch (error) {
    log('ℹ️  Git not available, skipping git checks', 'blue');
    return true;
  }
}

function updateEnvFile(envPath) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  let updated = false;
  
  // Generate new JWT secret if placeholder
  if (envContent.includes('your-jwt-secret-here')) {
    const newJwtSecret = generateJWTSecret();
    envContent = envContent.replace(
      /JWT_SECRET=.*/g,
      `JWT_SECRET=${newJwtSecret}`
    );
    updated = true;
    log('🔑 Generated new JWT secret', 'green');
  }
  
  // Generate new client state if placeholder
  if (envContent.includes('your-secret-client-state-here')) {
    const newClientState = generateClientState();
    envContent = envContent.replace(
      /WEBHOOK_CLIENT_STATE=.*/g,
      `WEBHOOK_CLIENT_STATE=${newClientState}`
    );
    updated = true;
    log('🔑 Generated new webhook client state', 'green');
  }
  
  if (updated) {
    fs.writeFileSync(envPath, envContent);
    log('✅ Updated .env file with new credentials', 'green');
  }
  
  return updated;
}

function validateCredentials(envPath) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  const env = {};
  
  // Parse env file
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value) {
        env[key] = value;
      }
    }
  }
  
  const issues = [];
  
  // Check for placeholder values
  const placeholders = [
    'your-client-id-here',
    'your-tenant-id-here',
    'your-client-secret-here',
    'your-azure-client-id-here',
    'your-azure-tenant-id-here',
    'your-azure-client-secret-here'
  ];
  
  for (const [key, value] of Object.entries(env)) {
    if (placeholders.some(placeholder => value.toLowerCase().includes(placeholder))) {
      issues.push(`❌ ${key} still has placeholder value`);
    }
  }
  
  // Validate specific formats
  if (env.MSGRAPH_CLIENT_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.MSGRAPH_CLIENT_ID)) {
    issues.push('❌ MSGRAPH_CLIENT_ID is not a valid GUID format');
  }
  
  if (env.MSGRAPH_TENANT_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.MSGRAPH_TENANT_ID)) {
    issues.push('❌ MSGRAPH_TENANT_ID is not a valid GUID format');
  }
  
  if (env.JWT_SECRET && env.JWT_SECRET.length < 64) {
    issues.push('❌ JWT_SECRET should be at least 64 characters long');
  }
  
  return issues;
}

function main() {
  log(`${colors.bold}🔒 CrewAI Team Security Setup${colors.reset}`, 'cyan');
  log('Checking and configuring security settings...\n');
  
  // Step 1: Check .env file
  log('1. Checking .env file...', 'blue');
  const envPath = checkEnvFile();
  
  // Step 2: Check .gitignore
  log('\n2. Checking .gitignore...', 'blue');
  checkGitIgnore();
  
  // Step 3: Check for exposed credentials
  log('\n3. Checking for exposed credentials...', 'blue');
  const noExposedCreds = checkExposedCredentials();
  
  // Step 4: Update credentials
  log('\n4. Updating credentials...', 'blue');
  const credentialsUpdated = updateEnvFile(envPath);
  
  // Step 5: Validate credentials
  log('\n5. Validating credentials...', 'blue');
  const issues = validateCredentials(envPath);
  
  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log('SECURITY SETUP SUMMARY', 'cyan');
  log('='.repeat(50), 'cyan');
  
  if (issues.length > 0) {
    log('\n⚠️  Issues found:', 'yellow');
    issues.forEach(issue => log(`   ${issue}`, 'yellow'));
    
    log('\n📋 Next steps:', 'blue');
    log('   1. Get your Microsoft Graph credentials from:', 'white');
    log('      https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps', 'cyan');
    log('   2. Update the placeholder values in .env', 'white');
    log('   3. Run this script again to validate', 'white');
  } else {
    log('\n✅ All security checks passed!', 'green');
  }
  
  if (!noExposedCreds) {
    log('\n🚨 URGENT: Rotate exposed credentials immediately!', 'red');
  }
  
  if (credentialsUpdated) {
    log('\n🔑 New credentials generated. Keep your .env file secure!', 'green');
  }
  
  log('\n📖 Documentation:', 'blue');
  log('   • Environment setup: README.md', 'white');
  log('   • Security best practices: docs/SECURITY.md', 'white');
  log('   • Microsoft Graph setup: docs/MICROSOFT_GRAPH_SETUP.md', 'white');
  
  log('\n🔒 Remember: Never commit .env files to version control!', 'magenta');
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  generateJWTSecret,
  generateClientState,
  checkEnvFile,
  checkGitIgnore,
  validateCredentials
};