#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';

const distDir = './dist';

async function addJsExtensions(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await addJsExtensions(fullPath);
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      let content = await readFile(fullPath, 'utf-8');
      
      // Fix relative imports without extension
      content = content.replace(
        /from\s+["'](\.[^"']+)["']/g,
        (match, importPath) => {
          // Skip if already has extension
          if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
            return match;
          }
          return `from "${importPath}.js"`;
        }
      );
      
      // Fix dynamic imports
      content = content.replace(
        /import\(["'](\.[^"']+)["']\)/g,
        (match, importPath) => {
          if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
            return match;
          }
          return `import("${importPath}.js")`;
        }
      );
      
      await writeFile(fullPath, content, 'utf-8');
    }
  }
}

console.log('🔧 Fixing ES module imports...');
addJsExtensions(distDir)
  .then(() => console.log('✅ ES module imports fixed'))
  .catch(err => {
    console.error('❌ Error fixing imports:', err);
    process.exit(1);
  });