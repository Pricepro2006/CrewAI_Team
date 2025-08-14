#!/usr/bin/env node

/**
 * Migration script to update all OllamaProvider references to LlamaCppProvider
 * This handles the transition from Ollama to llama.cpp
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const replacements = [
  {
    from: `import { OllamaProvider } from "../../llm/OllamaProvider.js";`,
    to: `import { LlamaCppProvider } from "../../llm/LlamaCppProvider.js";`
  },
  {
    from: `import { OllamaProvider } from "../llm/OllamaProvider.js";`,
    to: `import { LlamaCppProvider } from "../llm/LlamaCppProvider.js";`
  },
  {
    from: `import { OllamaProvider } from "./OllamaProvider.js";`,
    to: `import { LlamaCppProvider } from "./LlamaCppProvider.js";`
  },
  {
    from: `import { OllamaProvider } from "../../../core/llm/OllamaProvider.js";`,
    to: `import { LlamaCppProvider } from "../../../core/llm/LlamaCppProvider.js";`
  },
  {
    from: `: OllamaProvider`,
    to: `: LlamaCppProvider`
  },
  {
    from: `new OllamaProvider({`,
    to: `new LlamaCppProvider({`
  },
  {
    from: `ollamaProvider = new OllamaProvider({`,
    to: `llamaCppProvider = new LlamaCppProvider({`
  },
  {
    from: `this.ollamaProvider`,
    to: `this.llamaCppProvider`
  },
  {
    from: `const ollamaProvider`,
    to: `const llamaCppProvider`
  },
  {
    from: `let ollamaProvider`,
    to: `let llamaCppProvider`
  }
];

// Files to update
const filesToUpdate = [
  'src/core/agents/specialized/EmailAnalysisAgent.ts',
  'src/core/agents/specialized/EmailAnalysisAgentEnhanced.ts',
  'src/core/master-orchestrator/ConfidenceMasterOrchestrator.ts',
  'src/core/rag/confidence/ConfidenceResponseGenerator.ts',
  'src/core/prompts/example-usage.ts',
  'src/core/resilience/CircuitBreakerIntegration.ts',
  'src/core/middleware/BusinessSearchMiddleware.ts',
  'src/api/routes/businessSearch.ts',
  'src/core/master-orchestrator/EnhancedParser.ts',
];

function updateFile(filePath: string): boolean {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let modified = false;

  // Apply replacements
  replacements.forEach(({ from, to }) => {
    if (content.includes(from)) {
      content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
      modified = true;
    }
  });

  // Special case: Update OllamaProvider constructor calls
  // Convert Ollama-style config to llama.cpp style
  const ollamaConfigPattern = /new LlamaCppProvider\({[\s\S]*?model:\s*([^,}]+)[\s\S]*?baseUrl:\s*([^,}]+)[\s\S]*?\}\)/g;
  content = content.replace(ollamaConfigPattern, (match, model, baseUrl) => {
    const modelValue = model.trim().replace(/["']/g, '').replace(/\|\|.*/, '').trim();
    return `new LlamaCppProvider({
      modelPath: process.env.LLAMA_MODEL_PATH || \`./models/${modelValue}.gguf\`,
      contextSize: 8192,
      threads: 8,
      temperature: 0.7,
      gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0"),
    })`;
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }

  console.log(`⏭️  No changes needed: ${filePath}`);
  return false;
}

function main() {
  console.log('🔄 Starting migration from OllamaProvider to LlamaCppProvider...\n');

  let updatedCount = 0;
  let totalCount = filesToUpdate.length;

  filesToUpdate.forEach(file => {
    if (updateFile(file)) {
      updatedCount++;
    }
  });

  console.log(`\n✨ Migration complete! Updated ${updatedCount}/${totalCount} files.`);

  // Create a backup of OllamaProvider if it doesn't exist
  const ollamaProviderPath = 'src/core/llm/OllamaProvider.ts';
  const backupPath = 'src/core/llm/OllamaProvider.ts.backup';
  
  if (fs.existsSync(ollamaProviderPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(ollamaProviderPath, backupPath);
    console.log(`📦 Created backup: ${backupPath}`);
  }

  // Update environment template
  const envTemplatePath = '.env.template';
  if (fs.existsSync(envTemplatePath)) {
    let envContent = fs.readFileSync(envTemplatePath, 'utf-8');
    
    if (!envContent.includes('LLAMA_MODEL_PATH')) {
      envContent += `
# Llama.cpp Configuration
LLAMA_MODEL_PATH=./models/llama-3.2-3b.gguf
LLAMA_GPU_LAYERS=0
LLAMA_CPP_PATH=./llama.cpp/build/bin/llama-cli
`;
      fs.writeFileSync(envTemplatePath, envContent);
      console.log('📝 Updated .env.template with llama.cpp configuration');
    }
  }

  console.log('\n📌 Next steps:');
  console.log('1. Download the llama-3.2-3b GGUF model to ./models/');
  console.log('2. Build llama.cpp if not already built');
  console.log('3. Update your .env file with LLAMA_MODEL_PATH');
  console.log('4. Run TypeScript compilation to verify changes');
}

main();