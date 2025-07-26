#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const templatesConfig = require('./templates.json');

// Helper to prompt user
const prompt = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Replace variables in template
const replaceVariables = (content, variables) => {
  let result = content;
  
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(pattern, value);
  }
  
  return result;
};

// Generate variable variations
const generateVariations = (baseName, type) => {
  const variations = {
    [type]: baseName
  };
  
  // Generate other cases
  if (type === 'PascalCase') {
    // PascalCase to camelCase
    variations.camelCase = baseName.charAt(0).toLowerCase() + baseName.slice(1);
    // PascalCase to kebab-case
    variations.kebabCase = baseName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
    // PascalCase to UPPER_SNAKE_CASE
    variations.UPPER_SNAKE_CASE = baseName
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  }
  
  return variations;
};

// Main function
async function main() {
  console.log('\n🚀 Claude Code Template Generator\n');
  
  // List available templates
  console.log('Available templates:\n');
  templatesConfig.templates.forEach((template, index) => {
    console.log(`${index + 1}. ${template.category} - ${template.name}`);
    console.log(`   ${template.description}\n`);
  });
  
  // Get template choice
  const choice = await prompt('Select a template (number): ');
  const templateIndex = parseInt(choice) - 1;
  
  if (templateIndex < 0 || templateIndex >= templatesConfig.templates.length) {
    console.log('Invalid choice!');
    rl.close();
    return;
  }
  
  const template = templatesConfig.templates[templateIndex];
  console.log(`\nSelected: ${template.name}\n`);
  
  // Get output file
  const outputPath = await prompt('Output file path: ');
  
  // Collect variable values
  const variables = {};
  console.log('\nEnter values for template variables:\n');
  
  for (const variable of template.variables) {
    const value = await prompt(`${variable.name} (e.g., ${variable.example}): `);
    variables[variable.name] = value;
    
    // Generate variations if it's a name-type variable
    if (variable.name.includes('Name') && !variable.name.includes('name')) {
      const variations = generateVariations(value, 'PascalCase');
      
      // Add camelCase version
      const camelCaseKey = variable.name.charAt(0).toLowerCase() + variable.name.slice(1);
      if (template.variables.some(v => v.name === camelCaseKey)) {
        variables[camelCaseKey] = variations.camelCase;
      }
      
      // Add kebab-case version
      const kebabKey = variable.name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      if (template.variables.some(v => v.name === kebabKey)) {
        variables[kebabKey] = variations.kebabCase;
      }
      
      // Add UPPER_SNAKE_CASE version
      const upperKey = variable.name.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
      if (template.variables.some(v => v.name === upperKey)) {
        variables[upperKey] = variations.UPPER_SNAKE_CASE;
      }
    }
  }
  
  // Read template file
  const templatePath = path.join(__dirname, template.file);
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  
  // Replace variables
  const outputContent = replaceVariables(templateContent, variables);
  
  // Create output directory if needed
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write output file
  fs.writeFileSync(outputPath, outputContent);
  
  console.log(`\n✅ Template generated successfully at: ${outputPath}\n`);
  
  rl.close();
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});