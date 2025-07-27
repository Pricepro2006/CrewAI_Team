#!/usr/bin/env node

/**
 * Utility script to generate a secure JWT secret
 * Usage: node scripts/generate-jwt-secret.js
 */

import crypto from 'crypto';

function generateSecureSecret(length: number = 64): string {
  // Generate a cryptographically secure random string
  return crypto.randomBytes(length).toString('base64url');
}

function main(): void {
  console.log('\n🔐 JWT Secret Generator for CrewAI Team\n');
  
  const secret = generateSecureSecret();
  
  console.log('Generated secure JWT secret:');
  console.log('─'.repeat(80));
  console.log(secret);
  console.log('─'.repeat(80));
  
  console.log('\nℹ️  Instructions:');
  console.log('1. Copy the secret above');
  console.log('2. Add to your .env file: JWT_SECRET=' + secret);
  console.log('3. Keep this secret secure and never commit it to version control');
  console.log('4. Use different secrets for each environment (dev, staging, prod)');
  
  console.log('\n✅ Secret properties:');
  console.log(`   - Length: ${secret.length} characters`);
  console.log(`   - Entropy: High (cryptographically secure random)`);
  console.log(`   - Character set: Base64 URL-safe (A-Z, a-z, 0-9, -, _)`);
  console.log('   - Suitable for production use\n');
}

main();

export { generateSecureSecret };