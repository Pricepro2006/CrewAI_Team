#!/usr/bin/env tsx

/**
 * Script to validate SQL injection security across the codebase
 */

import { SqlInjectionValidator } from '../src/database/security/sql-injection-validator';
import { logger } from '../src/utils/logger';

async function main() {
  console.log('🔍 SQL Injection Security Validation Script');
  console.log('==========================================\n');
  
  try {
    const validator = new SqlInjectionValidator();
    
    // Validate the entire src directory
    await validator.validateCodebase('src');
    
    const vulnerabilities = validator.getVulnerabilities();
    
    if (vulnerabilities.length > 0) {
      console.log('\n⚠️  Action Required: Fix the identified SQL injection vulnerabilities');
      process.exit(1);
    } else {
      console.log('\n✅ All SQL queries are properly secured!');
      process.exit(0);
    }
  } catch (error) {
    logger.error('SQL validation script failed', 'SCRIPT', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);