/**
 * Agent Evaluation Runner
 * Simplified version to test all agents without dependencies
 */

import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n=== CrewAI Agent System Evaluation ===\n');

// Import and run the evaluation
async function main() {
  try {
    console.log('Loading evaluation module...');
    
    // Import the evaluation module
    const evaluationPath = path.resolve(__dirname, 'src/test/agent-evaluation.ts');
    const { AgentEvaluator } = await import(pathToFileURL(evaluationPath).href);
    
    console.log('Starting agent evaluation...');
    const evaluator = new AgentEvaluator();
    await evaluator.evaluateAllAgents();
    
  } catch (error) {
    console.error('Error during evaluation:', error.message);
    
    // Basic agent test without full evaluation
    console.log('\nFalling back to basic agent checks...\n');
    await basicAgentCheck();
  }
}

async function basicAgentCheck() {
  const agents = [
    'MasterOrchestrator',
    'EmailAnalysisAgent', 
    'ResearchAgent',
    'DataAnalysisAgent',
    'CodeAgent',
    'WriterAgent',
    'ToolExecutorAgent'
  ];
  
  console.log('=== BASIC AGENT AVAILABILITY CHECK ===\n');
  
  for (const agentName of agents) {
    try {
      let modulePath;
      
      if (agentName === 'MasterOrchestrator') {
        modulePath = './src/core/orchestration/MasterOrchestrator.js';
      } else {
        modulePath = `./src/core/agents/specialized/${agentName}.js`;
      }
      
      const module = await import(modulePath);
      const AgentClass = module[agentName] || module.default;
      
      if (AgentClass) {
        console.log(`✅ ${agentName}: Available`);
        
        // Try to instantiate
        try {
          let instance;
          if (agentName === 'MasterOrchestrator') {
            instance = AgentClass.getInstance();
          } else {
            instance = new AgentClass();
          }
          
          if (instance) {
            console.log(`   ✓ Instantiation: SUCCESS`);
            
            // Check for key methods
            if (typeof instance.execute === 'function' || typeof instance.processQuery === 'function') {
              console.log(`   ✓ Core Methods: AVAILABLE`);
            } else {
              console.log(`   ⚠ Core Methods: MISSING`);
            }
          }
        } catch (instError) {
          console.log(`   ❌ Instantiation: FAILED (${instError.message})`);
        }
      } else {
        console.log(`❌ ${agentName}: Class not found`);
      }
      
    } catch (error) {
      console.log(`❌ ${agentName}: Module not found or failed to load`);
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Check database connectivity
  console.log('=== DATABASE CONNECTIVITY ===\n');
  try {
    const dbModule = await import('./src/database/connection.js');
    console.log('✅ Database module: Available');
  } catch (error) {
    console.log('❌ Database module: Failed to load');
  }
  
  // Check LLM integration
  console.log('=== LLM INTEGRATION ===\n');
  try {
    const llmModule = await import('./src/core/llm/LLMProviderManager.js');
    console.log('✅ LLM Provider Manager: Available');
    
    const LLMProviderManager = llmModule.LLMProviderManager || llmModule.default;
    if (LLMProviderManager) {
      const manager = LLMProviderManager.getInstance();
      console.log('   ✓ Singleton pattern: Working');
    }
  } catch (error) {
    console.log('❌ LLM Provider Manager: Failed to load');
    console.log(`   Error: ${error.message}`);
  }
  
  // Check agent registry
  console.log('=== AGENT REGISTRY ===\n');
  try {
    const registryModule = await import('./src/core/agents/registry/AgentRegistry.js');
    console.log('✅ Agent Registry: Available');
    
    const AgentRegistry = registryModule.AgentRegistry || registryModule.default;
    if (AgentRegistry) {
      const registry = AgentRegistry.getInstance();
      console.log('   ✓ Registry instance: Working');
      
      const agents = registry.getAllAgents();
      console.log(`   ✓ Registered agents: ${agents.length}`);
    }
  } catch (error) {
    console.log('❌ Agent Registry: Failed to load');
    console.log(`   Error: ${error.message}`);
  }
}

main().catch(console.error);