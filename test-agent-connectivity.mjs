#!/usr/bin/env node
/**
 * Test script to verify agent connectivity and tRPC routes
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

async function testEndpoint(name, url, method = 'GET', data = null) {
  try {
    console.log(`\n📡 Testing ${name}...`);
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ ${name}: SUCCESS`);
    console.log(`   Status: ${response.status}`);
    if (response.data) {
      console.log(`   Response:`, JSON.stringify(response.data, null, 2).substring(0, 200));
    }
    return response.data;
  } catch (error) {
    console.log(`❌ ${name}: FAILED`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error:`, error.response.data?.message || error.response.statusText);
    } else {
      console.log(`   Error:`, error.message);
    }
    return null;
  }
}

async function testLlamaServer() {
  try {
    console.log(`\n🦙 Testing llama.cpp server on port 8081...`);
    const response = await axios.get('http://localhost:8081/health', { timeout: 2000 });
    console.log(`✅ llama.cpp server: ONLINE`);
    return true;
  } catch (error) {
    console.log(`❌ llama.cpp server: OFFLINE`);
    console.log(`   Please start llama-server on port 8081`);
    return false;
  }
}

async function testChromaDB() {
  try {
    console.log(`\n🗃️ Testing ChromaDB on port 8000...`);
    const response = await axios.get('http://localhost:8000/api/v1/heartbeat', { timeout: 2000 });
    console.log(`✅ ChromaDB: ONLINE`);
    return true;
  } catch (error) {
    console.log(`⚠️ ChromaDB: OFFLINE (using in-memory fallback)`);
    return false;
  }
}

async function testRedis() {
  try {
    console.log(`\n📊 Testing Redis on port 6379...`);
    // Can't directly test Redis from HTTP, checking via health endpoint
    const health = await testEndpoint('Health Check', '/trpc/health.status');
    if (health?.result?.data?.services?.redis) {
      console.log(`✅ Redis: ${health.result.data.services.redis.status.toUpperCase()}`);
      return health.result.data.services.redis.status === 'healthy';
    }
    console.log(`⚠️ Redis: Status unknown (using memory fallback)`);
    return false;
  } catch (error) {
    console.log(`⚠️ Redis: Cannot determine status`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('🔍 CREWAI AGENT CONNECTIVITY TEST');
  console.log('========================================');
  
  // Test infrastructure services
  const llamaOnline = await testLlamaServer();
  const chromaOnline = await testChromaDB();
  const redisOnline = await testRedis();
  
  // Test tRPC endpoints
  console.log('\n--- Testing tRPC Endpoints ---');
  
  // Basic health check
  await testEndpoint('Health Status', '/trpc/health.status');
  await testEndpoint('Health Ping', '/trpc/health.ping');
  
  // Agent endpoints
  console.log('\n--- Testing Agent Endpoints ---');
  const agentList = await testEndpoint('Agent List', '/trpc/agent.list');
  await testEndpoint('Agent Status', '/trpc/agent.status');
  await testEndpoint('Agent Pool Status', '/trpc/agent.poolStatus');
  await testEndpoint('Agent Config', '/trpc/agent.getConfig');
  
  // Test agent execution if agents are available
  if (agentList?.result?.data?.agents?.length > 0) {
    const firstAgent = agentList.result.data.agents[0];
    console.log(`\n🤖 Found ${agentList.result.data.agents.length} agents`);
    console.log(`   Testing execution with: ${firstAgent.type}`);
    
    await testEndpoint(
      'Agent Execute',
      '/trpc/agent.execute',
      'POST',
      {
        agentType: firstAgent.type,
        task: 'Test connectivity: Please respond with a simple acknowledgment.',
        context: {}
      }
    );
  } else {
    console.log('\n⚠️ No agents found in registry');
  }
  
  // Test RAG endpoints
  console.log('\n--- Testing RAG Endpoints ---');
  await testEndpoint('RAG Status', '/trpc/rag.status');
  
  // Test WebSocket endpoints
  console.log('\n--- Testing WebSocket Endpoints ---');
  await testEndpoint('WebSocket Status', '/trpc/ws.status');
  
  // Summary
  console.log('\n========================================');
  console.log('📊 CONNECTIVITY SUMMARY');
  console.log('========================================');
  console.log(`llama.cpp server (8081): ${llamaOnline ? '✅ ONLINE' : '❌ OFFLINE'}`);
  console.log(`ChromaDB (8000):         ${chromaOnline ? '✅ ONLINE' : '⚠️ OFFLINE (fallback active)'}`);
  console.log(`Redis (6379):            ${redisOnline ? '✅ ONLINE' : '⚠️ OFFLINE (fallback active)'}`);
  console.log(`Agent Registry:          ${agentList ? '✅ ACCESSIBLE' : '❌ NOT ACCESSIBLE'}`);
  
  if (!llamaOnline) {
    console.log('\n⚠️ RECOMMENDATION: Start llama-server on port 8081 for LLM functionality');
    console.log('   Example: ./llama-server --model <model-path> --port 8081');
  }
  
  if (agentList?.result?.data?.agents?.length === 0) {
    console.log('\n⚠️ WARNING: Agent registry is empty. Agents may not be initialized.');
  }
}

main().catch(console.error);