
// Test our security fixes
import { sqlSecurity, SqlInjectionError } from './src/database/security/SqlInjectionProtection.js';
import { executeSecureQuery } from './src/database/security/SecureQueryExecutor.js';
import { DatabaseErrorHandler } from './src/database/security/DatabaseErrorHandler.js';

// All imports should work without TypeScript errors
console.log('Security modules loaded successfully');

