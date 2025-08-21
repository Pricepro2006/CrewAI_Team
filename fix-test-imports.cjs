/**
 * Simple script to fix .js import extensions in test files
 */

const fs = require('fs');
const path = require('path');

function walkDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDirectory(filePath, fileList);
    } else if (
      file.endsWith('.test.ts') || 
      file.endsWith('.test.tsx') || 
      file.endsWith('.spec.ts') || 
      file.endsWith('.spec.tsx')
    ) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Remove .js extensions from relative imports
    const newContent = content.replace(
      /from\s+['"]([^'"]*\/)([^'"\/]+)\.js['"]/g,
      (match, path, file) => {
        changed = true;
        return `from '${path}${file}'`;
      }
    );
    
    // Also fix direct file imports with .js
    const finalContent = newContent.replace(
      /from\s+['"](\.\.[^'"]*|\.\/[^'"]*?)\.js['"]/g,
      (match, path) => {
        changed = true;
        return `from '${path}'`;
      }
    );
    
    if (changed) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🔧 Fixing .js imports in test files...\n');

const testFiles = walkDirectory('./src');
console.log(`Found ${testFiles.length} test files\n`);

let fixed = 0;
testFiles.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\n📊 Fixed ${fixed} out of ${testFiles.length} test files`);
console.log('✅ Import fixing complete!');