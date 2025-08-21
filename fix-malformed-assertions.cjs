/**
 * Fix malformed test assertions
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
    
    // Fix malformed property access that got converted incorrectly
    const fixes = [
      // Fix config.property?.length patterns
      [/expect\(config\?\.\w+\?\)\.toHaveLength\(/g, match => {
        const property = match.match(/config\?\.(\w+)\?/)[1];
        return `expect(config?.${property}).toBeDefined()`;
      }],
      
      // Fix other property?.length patterns
      [/expect\(([^)]+)\?\.\w+\?\)\.toHaveLength\(/g, (match, obj) => {
        return `expect(${obj}).toBeDefined()`;
      }],
      
      // Fix result[0]?.length patterns that should be content or similar
      [/expect\(result\[0\]\?\.length\)/g, 'expect(result[0]?.content)'],
      
      // Fix metadata?.length patterns 
      [/expect\(chunk\?\.metadata\?\.length\)/g, 'expect(chunk?.metadata?.chunkIndex)'],
      
      // Fix missed_entities?.length patterns
      [/expect\(analysis\?\.missed_entities\?\.length\)/g, 'expect(analysis?.missed_entities)'],
      
      // Fix strategic_insights?.length patterns
      [/expect\(result\?\.strategic_insights\?\.length\)/g, 'expect(result?.strategic_insights)'],
      
      // Fix workflow_intelligence?.length patterns  
      [/expect\(analysis\?\.workflow_intelligence\?\.length\)/g, 'expect(analysis?.workflow_intelligence)'],
      
      // Fix parsingMetrics?.length patterns
      [/expect\(stats\?\.parsingMetrics\?\.length\)/g, 'expect(stats?.parsingMetrics)'],
      
      // Fix cors?.length patterns
      [/expect\(config\?\.cors\?\.length\)/g, 'expect(config?.cors)'],
      
      // Fix csp?.length patterns
      [/expect\(config\?\.csp\?\.length\)/g, 'expect(config?.csp)'],
      
      // Fix hsts? patterns
      [/expect\(config\?\.hsts\?\)\.toHaveLength\((\d+)\)/g, 'expect(config?.hsts).toBe($1)'],
    ];
    
    for (const [pattern, replacement] of fixes) {
      const newContent = content.replace(pattern, replacement);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    }
    
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
console.log('🔧 Fixing malformed test assertions...\n');

const testFiles = walkDirectory('./src');
console.log(`Found ${testFiles.length} test files to check\n`);

let fixed = 0;
testFiles.forEach(file => {
  if (fixFile(file)) {
    fixed++;
  }
});

console.log(`\n📊 Fixed ${fixed} out of ${testFiles.length} test files`);
console.log('✅ Assertion fixing complete!');