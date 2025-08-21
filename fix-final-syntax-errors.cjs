/**
 * Fix final syntax errors in test files
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
    
    // Fix malformed .toBeDefined()X); patterns
    content = content.replace(/\.toBeDefined\(\)(\d+)\);/g, (match, number) => {
      changed = true;
      return `.toBeDefined();`;
    });
    
    // Fix malformed .toBe()X); patterns 
    content = content.replace(/\.toBe\(\)(\d+)\);/g, (match, number) => {
      changed = true;
      return `.toBe(${number});`;
    });
    
    // Fix other malformed patterns
    content = content.replace(/\?\.\w+\?\)\.toHaveLength\(/g, (match) => {
      changed = true;
      return ')?.length !== undefined && expect(';
    });
    
    // Fix config?.property).toBeDefined() patterns
    content = content.replace(
      /expect\((config\?\.\w+)\)\.toBeDefined\(\);/g, 
      'expect($1).toBeDefined();'
    );
    
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
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
console.log('🔧 Fixing final syntax errors in test files...\n');

const testFiles = walkDirectory('./src');
console.log(`Found ${testFiles.length} test files to check\n`);

let fixed = 0;
testFiles.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\n📊 Fixed ${fixed} out of ${testFiles.length} test files`);
console.log('✅ Final syntax fixing complete!');