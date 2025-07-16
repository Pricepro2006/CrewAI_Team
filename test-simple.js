#!/usr/bin/env node

// Simple test to verify core functionality works
import axios from 'axios';

console.log('🚀 Testing CrewAI Team Core Functionality...\n');

// Test 1: Ollama Connection
async function testOllama() {
  console.log('1. Testing Ollama connection...');
  try {
    const response = await axios.get('http://localhost:11434/api/tags');
    const models = response.data.models.map(m => m.name);
    console.log('✅ Ollama connected successfully');
    console.log('   Available models:', models.join(', '));
    
    // Test a simple inference
    const testResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'qwen3:8b',
      prompt: 'Hello, respond with just "Hello back!"',
      stream: false
    });
    
    console.log('✅ Model inference test passed');
    console.log('   Response:', testResponse.data.response.trim());
    return true;
  } catch (error) {
    console.log('❌ Ollama test failed:', error.message);
    return false;
  }
}

// Test 2: Search API
async function testSearch() {
  console.log('\n2. Testing DuckDuckGo Search...');
  try {
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: 'typescript',
        format: 'json',
        no_html: '1',
        skip_disambig: '1'
      },
      timeout: 10000,
      headers: {
        'User-Agent': 'CrewAI-Team-Test/1.0'
      }
    });
    
    console.log('✅ DuckDuckGo search test passed');
    console.log('   Found result:', response.data.Abstract ? 'Abstract available' : 'No abstract, but API responded');
    return true;
  } catch (error) {
    console.log('❌ Search test failed:', error.message);
    return false;
  }
}

// Test 3: Database initialization
async function testDatabase() {
  console.log('\n3. Testing Database...');
  try {
    // Check if database file exists
    const fs = await import('fs');
    const path = await import('path');
    
    const dbPath = path.join(process.cwd(), 'data', 'app.db');
    
    if (fs.existsSync(dbPath)) {
      console.log('✅ Database file exists at:', dbPath);
      const stats = fs.statSync(dbPath);
      console.log('   Size:', Math.round(stats.size / 1024), 'KB');
      return true;
    } else {
      console.log('❌ Database file not found at:', dbPath);
      console.log('   Run: pnpm run init:production-db');
      return false;
    }
  } catch (error) {
    console.log('❌ Database test failed:', error.message);
    return false;
  }
}

// Test 4: Core directories
async function testDirectories() {
  console.log('\n4. Testing Core Directories...');
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const requiredDirs = [
      'data',
      'data/logs',
      'src/core/master-orchestrator',
      'src/core/agents',
      'src/core/tools',
      'src/core/rag'
    ];
    
    for (const dir of requiredDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        console.log('✅', dir);
      } else {
        console.log('❌', dir, 'not found');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.log('❌ Directory test failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = [];
  
  results.push(await testOllama());
  results.push(await testSearch());
  results.push(await testDatabase());
  results.push(await testDirectories());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(50));
  console.log(`🎯 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! System appears to be working correctly.');
    console.log('\nNext steps:');
    console.log('  - Run: pnpm run dev:client');
    console.log('  - Run: pnpm run dev:server');
    console.log('  - Navigate to: http://localhost:5173');
  } else {
    console.log('⚠️  Some tests failed. Please check the issues above.');
  }
  
  console.log('='.repeat(50));
}

runTests().catch(console.error);