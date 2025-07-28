#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

// Check if a path is a directory
function isDirectory(filePath) {
  try {
    const resolvedPath = path.resolve(srcDir, filePath);
    const stat = fs.statSync(resolvedPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

// Check if a directory has an index file
function hasIndexFile(dirPath) {
  const indexPath = path.join(dirPath, 'index.ts');
  const indexJsPath = path.join(dirPath, 'index.js');
  return fs.existsSync(indexPath) || fs.existsSync(indexJsPath);
}

// Process import/export statements in a file
function processFile(filePath) {
  console.log(`Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Regex to match imports ending with .js that might be directories
  const importRegex = /from\s+["']([^"']+\.js)["']/g;
  
  content = content.replace(importRegex, (match, importPath) => {
    // Remove the .js extension to check if it's a directory
    const pathWithoutJs = importPath.slice(0, -3);
    
    // Convert relative imports to absolute paths for checking
    let absolutePath;
    if (pathWithoutJs.startsWith('.')) {
      absolutePath = path.resolve(path.dirname(filePath), pathWithoutJs);
    } else if (pathWithoutJs.startsWith('@/')) {
      absolutePath = path.resolve(srcDir, pathWithoutJs.slice(2));
    } else {
      // Not a relative or alias import, skip
      return match;
    }
    
    // Check if this path is a directory
    if (isDirectory(absolutePath) && hasIndexFile(absolutePath)) {
      // It's a directory with an index file, update the import
      const newImportPath = pathWithoutJs + '/index.js';
      console.log(`  ${importPath} -> ${newImportPath}`);
      modified = true;
      return `from "${newImportPath}"`;
    }
    
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Updated`);
  } else {
    console.log(`  ✓ No directory imports found`);
  }
}

// Recursively process all TypeScript files
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      processDirectory(filePath);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      processFile(filePath);
    }
  });
}

// Main execution
console.log('🔧 Fixing directory imports...\n');

console.log('📁 Processing source files...\n');
processDirectory(srcDir);

console.log('\n✅ Directory import fixing complete!');