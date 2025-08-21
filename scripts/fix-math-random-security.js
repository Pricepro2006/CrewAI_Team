#!/usr/bin/env node

/**
 * Fix Math.random() usage in security contexts
 * Replaces Math.random() with crypto.randomBytes() where appropriate
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

console.log('🔧 Fixing Math.random() in security contexts\n');

// List of files that need fixing based on audit
const filesToFix = [
  'src/api/middleware/security/csrf.ts',
  'src/api/middleware/websocketAuth.ts',
  'src/core/auth/AuthService.ts',
  'src/database/security/DataEncryption.ts',
];

function fixFile(filePath) {
  const fullPath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;
  
  // Check if file already imports crypto
  const hasCryptoImport = content.includes("import crypto from 'crypto'") || 
                          content.includes("import * as crypto from 'crypto'") ||
                          content.includes('require("crypto")') ||
                          content.includes("require('crypto')");
  
  // Pattern to replace Math.random() in token/secret generation contexts
  const patterns = [
    {
      // Pattern: Math.random().toString(36).substring(x)
      regex: /Math\.random\(\)\.toString\(36\)\.substring?\(\d+\)/g,
      replacement: "crypto.randomBytes(16).toString('hex')"
    },
    {
      // Pattern: Math.random().toString(16)
      regex: /Math\.random\(\)\.toString\(16\)/g,
      replacement: "crypto.randomBytes(8).toString('hex')"
    },
    {
      // Pattern: Math.floor(Math.random() * max) for IDs
      regex: /Math\.floor\(Math\.random\(\)\s*\*\s*(\d+)\)/g,
      replacement: (match, max) => `crypto.randomInt(0, ${max})`
    },
    {
      // Pattern: Simple Math.random() for tokens
      regex: /Math\.random\(\)/g,
      replacement: "crypto.randomBytes(4).readUInt32BE(0) / 0xffffffff"
    }
  ];
  
  // Apply replacements
  patterns.forEach(({ regex, replacement }) => {
    if (content.match(regex)) {
      if (typeof replacement === 'string') {
        content = content.replace(regex, replacement);
      } else {
        content = content.replace(regex, replacement);
      }
      modified = true;
    }
  });
  
  // Add crypto import if modified and not present
  if (modified && !hasCryptoImport) {
    // For TypeScript files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      // Add import at the top after other imports
      const importRegex = /^(import .+;\n)+/m;
      if (importRegex.test(content)) {
        content = content.replace(importRegex, (match) => {
          return match + "import crypto from 'crypto';\n";
        });
      } else {
        // Add at the very beginning if no imports found
        content = "import crypto from 'crypto';\n\n" + content;
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  } else {
    console.log(`ℹ️  No changes needed: ${filePath}`);
    return false;
  }
}

// Fix priority files
console.log('Fixing high-priority security files:\n');
let fixedCount = 0;

filesToFix.forEach(file => {
  if (fixFile(file)) {
    fixedCount++;
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);
console.log('\n📝 Note: Run the security audit again to verify all fixes');
console.log('   node scripts/security-audit.js');