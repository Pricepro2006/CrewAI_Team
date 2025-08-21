#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

function fixOptionalChainingAssignments(content) {
  // Pattern: this?.something?.property++ or this?.something?.property = value
  const patterns = [
    // Fix increment/decrement operations
    /(\s+)(this\?\.[\w?.]+)\+\+/g,
    /(\s+)(this\?\.[\w?.]+)\-\-/g,
    // Fix compound assignments
    /(\s+)(this\?\.[\w?.]+)\s*\+=\s*/g,
    /(\s+)(this\?\.[\w?.]+)\s*\-=\s*/g,
    /(\s+)(this\?\.[\w?.]+)\s*\*=\s*/g,
    /(\s+)(this\?\.[\w?.]+)\s*\/=\s*/g,
  ];

  let fixed = content;
  
  // Fix increment/decrement
  fixed = fixed.replace(/(\s+)(this\?\.[\w?.]+)\+\+/g, (match, indent, expr) => {
    const cleanExpr = expr.replace(/\?/g, '');
    return `${indent}if (${cleanExpr}) { ${cleanExpr}++ }`;
  });
  
  fixed = fixed.replace(/(\s+)(this\?\.[\w?.]+)\-\-/g, (match, indent, expr) => {
    const cleanExpr = expr.replace(/\?/g, '');
    return `${indent}if (${cleanExpr}) { ${cleanExpr}-- }`;
  });

  // Fix simple assignments (this?.prop = value)
  fixed = fixed.replace(/(\s+)(this\?\.[\w?.]+)\s*=\s*([^;]+);/g, (match, indent, expr, value) => {
    // Skip if it's already in an if statement or it's a comparison
    if (match.includes('==') || match.includes('===')) return match;
    
    const cleanExpr = expr.replace(/\?/g, '');
    const parts = cleanExpr.split('.');
    
    // Build the check condition - need to check each level
    if (parts.length > 2) {
      const checks = [];
      for (let i = 1; i < parts.length - 1; i++) {
        checks.push(parts.slice(0, i + 1).join('.'));
      }
      const condition = checks.join(' && ');
      return `${indent}if (${condition}) {\n${indent}  ${cleanExpr} = ${value};\n${indent}}`;
    } else {
      return `${indent}if (${parts[0]}) {\n${indent}  ${cleanExpr} = ${value};\n${indent}}`;
    }
  });

  return fixed;
}

// Find all TypeScript files
const files = glob.sync('src/**/*.ts', { 
  cwd: '/home/pricepro2006/CrewAI_Team',
  absolute: true,
  ignore: ['**/node_modules/**', '**/dist/**']
});

console.log(`Found ${files.length} TypeScript files to check...`);

let fixedCount = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Check if file needs fixing
  if (content.includes('this?.') && (
    content.includes('++') || 
    content.includes('--') ||
    /this\?\.[\w?.]+\s*=\s*[^=]/.test(content)
  )) {
    const fixed = fixOptionalChainingAssignments(content);
    
    if (fixed !== content) {
      fs.writeFileSync(file, fixed);
      console.log(`Fixed: ${path.relative('/home/pricepro2006/CrewAI_Team', file)}`);
      fixedCount++;
    }
  }
});

console.log(`\nFixed ${fixedCount} files with optional chaining assignment issues.`);