/**
 * Clean duplicate imports from test files
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
    const lines = content.split('\n');
    
    // Track seen import statements
    const seenImports = new Set();
    const filteredLines = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for duplicate vitest imports
      if (trimmedLine.startsWith('import') && trimmedLine.includes('vitest')) {
        if (seenImports.has('vitest')) {
          // Skip duplicate
          changed = true;
          continue;
        }
        seenImports.add('vitest');
      }
      
      // Check for duplicate jest-dom imports
      if (trimmedLine.includes('@testing-library/jest-dom')) {
        if (seenImports.has('jest-dom')) {
          // Skip duplicate
          changed = true;
          continue;
        }
        seenImports.add('jest-dom');
      }
      
      filteredLines.push(line);
    }
    
    if (changed) {
      const newContent = filteredLines.join('\n');
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Cleaned: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error cleaning ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
console.log('🧹 Cleaning duplicate imports in test files...\n');

const testFiles = walkDirectory('./src');
console.log(`Found ${testFiles.length} test files to check\n`);

let cleaned = 0;
testFiles.forEach(file => {
  if (fixFile(file)) {
    cleaned++;
  }
});

console.log(`\n📊 Cleaned ${cleaned} out of ${testFiles.length} test files`);
console.log('✅ Import cleaning complete!');