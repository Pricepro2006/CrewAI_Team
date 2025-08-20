/**
 * End-to-End Tests for LLM Integration with llama.cpp
 * Tests the complete email processing pipeline with real components
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import Database from 'better-sqlite3';
import request from 'supertest';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';

// Import real components for E2E testing
import { LLMProviderManager } from '../src/core/llm/LLMProviderManager';
import { LlamaCppHttpProvider } from '../src/core/llm/LlamaCppHttpProvider';
import { MasterOrchestrator } from '../src/core/master-orchestrator/MasterOrchestrator';
import { EmailProcessingWorker } from '../src/core/workers/EmailProcessingWorker';
import { WebSocketService } from '../src/api/services/WebSocketService';
import { UnifiedEmailService } from '../src/api/services/UnifiedEmailService';
import { AgentRegistry } from '../src/core/agents/registry/AgentRegistry';
import { logger } from '../src/utils/logger';

// Test configuration
const TEST_CONFIG = {
  llamaServer: {
    port: 8081,
    host: 'localhost',
    modelPath: process.env.LLAMA_MODEL_PATH || '/models/llama-3.2-3b.gguf',
    contextSize: 4096,
    threads: 4
  },
  websocket: {
    port: 8080
  },
  api: {
    port: 3001
  },
  database: {
    path: ':memory:' // Use in-memory DB for tests
  }
};

describe('LLM Integration E2E Tests', () => {
  let llamaServerProcess: ChildProcess | null = null;
  let websocketService: WebSocketService;
  let llmManager: LLMProviderManager;
  let masterOrchestrator: MasterOrchestrator;
  let emailWorker: EmailProcessingWorker;
  let db: Database.Database;
  let wsClient: WebSocket;
  let apiServer: any;

  // Helper function to wait for llama server to be ready
  async function waitForLlamaServer(maxAttempts = 30, delay = 1000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await axios.get(`http://localhost:${TEST_CONFIG.llamaServer.port}/health`);
        if (response.status === 200) {
          logger.info('llama-server is ready', 'E2E_TEST');
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return false;
  }

  // Helper function to start llama server
  async function startLlamaServer(): Promise<ChildProcess> {
    const args = [
      '-m', TEST_CONFIG.llamaServer.modelPath,
      '-c', TEST_CONFIG.llamaServer.contextSize.toString(),
      '-t', TEST_CONFIG.llamaServer.threads.toString(),
      '--port', TEST_CONFIG.llamaServer.port.toString(),
      '--host', TEST_CONFIG.llamaServer.host,
      '--api-key', 'test-key',
      '--log-disable'
    ];

    const process = spawn('llama-server', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    process.stdout?.on('data', (data) => {
      logger.debug(`llama-server: ${data}`, 'E2E_TEST');
    });

    process.stderr?.on('data', (data) => {
      logger.warn(`llama-server error: ${data}`, 'E2E_TEST');
    });

    return process;
  }

  beforeAll(async () => {
    // Start llama server if not already running
    const isRunning = await waitForLlamaServer(1, 100);
    
    if (!isRunning) {
      logger.info('Starting llama-server for E2E tests', 'E2E_TEST');
      llamaServerProcess = await startLlamaServer();
      
      const serverReady = await waitForLlamaServer();
      if (!serverReady) {
        throw new Error('Failed to start llama-server for E2E tests');
      }
    }

    // Initialize database
    db = new Database(TEST_CONFIG.database.path);
    await initializeTestDatabase(db);

    // Initialize LLM Manager
    llmManager = LLMProviderManager.getInstance();
    await llmManager.initialize();

    // Initialize WebSocket service
    websocketService = new WebSocketService();
    await websocketService.initialize(TEST_CONFIG.websocket.port);

    // Initialize other services
    masterOrchestrator = new MasterOrchestrator();
    await masterOrchestrator.initialize();

    emailWorker = new EmailProcessingWorker(db);
    await emailWorker.initialize();

    // Start API server
    const app = await createTestApp(db);
    apiServer = app.listen(TEST_CONFIG.api.port);

    // Connect WebSocket client for testing
    wsClient = new WebSocket(`ws://localhost:${TEST_CONFIG.websocket.port}`);
    await new Promise((resolve, reject) => {
      wsClient.once('open', resolve);
      wsClient.once('error', reject);
    });
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    // Cleanup in reverse order
    wsClient?.close();
    apiServer?.close();
    
    await emailWorker?.shutdown();
    await masterOrchestrator?.shutdown();
    await websocketService?.shutdown();
    await llmManager?.destroy();
    
    db?.close();

    // Stop llama server if we started it
    if (llamaServerProcess) {
      llamaServerProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!llamaServerProcess.killed) {
        llamaServerProcess.kill('SIGKILL');
      }
    }
  });

  describe('LLM Provider Connectivity', () => {
    it('should connect to llama-server successfully', async () => {
      const provider = new LlamaCppHttpProvider(`http://localhost:${TEST_CONFIG.llamaServer.port}`);
      await provider.initialize();
      
      const response = await provider.generate('Hello, this is a test', {
        maxTokens: 50,
        temperature: 0.7
      });
      
      expect(response).toHaveProperty('text');
      expect(response.text).toBeTruthy();
      expect(response.model).toContain('llama');
      
      await provider.destroy();
    });

    it('should handle provider failover', async () => {
      // Force primary provider to fail
      const provider = llmManager.getProvider('llama-cpp');
      vi.spyOn(provider, 'generate').mockRejectedValueOnce(new Error('Simulated failure'));
      
      // Should fallback to secondary provider
      const response = await llmManager.generate('Test failover mechanism');
      
      expect(response).toHaveProperty('text');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('fallback'),
        'LLM_MANAGER'
      );
    });

    it('should maintain connection pool under load', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        llmManager.generate(`Concurrent request ${i}`, {
          maxTokens: 20
        })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toHaveProperty('text');
        expect(result.text).toBeTruthy();
      });
    });
  });

  describe('Email Processing Pipeline', () => {
    const testEmail = {
      id: 'test-email-001',
      subject: 'Test Email for LLM Processing',
      body: 'This is a test email to verify the LLM integration is working correctly with deal #45791720.',
      from: 'test@example.com',
      to: 'recipient@example.com',
      received_date: new Date().toISOString()
    };

    beforeEach(async () => {
      // Clear email processing results
      db.prepare('DELETE FROM emails WHERE id = ?').run(testEmail.id);
      
      // Insert test email
      db.prepare(`
        INSERT INTO emails (id, subject, body, from_address, to_address, received_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        testEmail.id,
        testEmail.subject,
        testEmail.body,
        testEmail.from,
        testEmail.to,
        testEmail.received_date
      );
    });

    it('should process email through complete pipeline', async () => {
      const result = await emailWorker.processEmail(testEmail.id);
      
      expect(result).toHaveProperty('phase1Results');
      expect(result).toHaveProperty('phase2Results');
      expect(result).toHaveProperty('phase3Results');
      
      // Check phase 1 (rule-based extraction)
      expect(result.phase1Results).toHaveProperty('dealId', '45791720');
      
      // Check phase 2 (LLM analysis)
      expect(result.phase2Results).toHaveProperty('intent');
      expect(result.phase2Results).toHaveProperty('entities');
      
      // Check phase 3 (strategic analysis)
      expect(result.phase3Results).toHaveProperty('recommendations');
    });

    it('should handle batch email processing', async () => {
      const emailIds = ['test-001', 'test-002', 'test-003'];
      
      // Insert test emails
      emailIds.forEach(id => {
        db.prepare(`
          INSERT OR REPLACE INTO emails (id, subject, body, from_address, to_address, received_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id,
          `Test email ${id}`,
          `Body for ${id} with deal #45791720`,
          'test@example.com',
          'recipient@example.com',
          new Date().toISOString()
        );
      });
      
      const results = await Promise.all(
        emailIds.map(id => emailWorker.processEmail(id))
      );
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('phase1Results');
        expect(result).toHaveProperty('phase2Results');
      });
    });

    it('should update database with processing results', async () => {
      await emailWorker.processEmail(testEmail.id);
      
      const row = db.prepare('SELECT * FROM emails WHERE id = ?').get(testEmail.id);
      
      expect(row.phase_1_results).toBeTruthy();
      expect(row.phase_2_results).toBeTruthy();
      expect(row.processing_status).toBe('completed');
      expect(row.processed_at).toBeTruthy();
    });
  });

  describe('Agent Integration with LLM', () => {
    it('should route queries through MasterOrchestrator', async () => {
      const query = 'Find all emails related to deal #45791720 and summarize them';
      
      const plan = await masterOrchestrator.createPlan(query);
      
      expect(plan).toHaveProperty('steps');
      expect(plan.steps).toBeInstanceOf(Array);
      expect(plan.steps.length).toBeGreaterThan(0);
      
      const result = await masterOrchestrator.executePlan(plan);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('output');
    });

    it('should use appropriate agents for different tasks', async () => {
      const queries = [
        { query: 'Generate code to parse email headers', expectedAgent: 'CodeAgent' },
        { query: 'Research best practices for email processing', expectedAgent: 'ResearchAgent' },
        { query: 'Analyze patterns in email communication', expectedAgent: 'DataAnalysisAgent' }
      ];
      
      for (const { query, expectedAgent } of queries) {
        const plan = await masterOrchestrator.createPlan(query);
        
        const hasExpectedAgent = plan.steps.some(step => 
          step.agent === expectedAgent
        );
        
        expect(hasExpectedAgent).toBe(true);
      }
    });

    it('should maintain context across agent interactions', async () => {
      // First query
      const query1 = 'Find emails from customer ACME Corp';
      const result1 = await masterOrchestrator.process(query1);
      
      // Follow-up query using context
      const query2 = 'Summarize the deals mentioned in those emails';
      const result2 = await masterOrchestrator.process(query2);
      
      expect(result2).toHaveProperty('context');
      expect(result2.context).toContain('ACME Corp');
    });
  });

  describe('WebSocket Real-time Updates', () => {
    it('should send real-time updates during email processing', async () => {
      const messages: any[] = [];
      
      wsClient.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      
      await emailWorker.processEmail('test-email-002');
      
      // Wait for messages
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const processingMessages = messages.filter(m => 
        m.type === 'email.processing'
      );
      
      expect(processingMessages.length).toBeGreaterThan(0);
      expect(processingMessages[0]).toHaveProperty('data.emailId', 'test-email-002');
    });

    it('should broadcast LLM generation events', async () => {
      const messages: any[] = [];
      
      wsClient.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });
      
      await llmManager.generate('Test WebSocket broadcast', {
        stream: true
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const llmMessages = messages.filter(m => 
        m.type === 'llm.generation'
      );
      
      expect(llmMessages.length).toBeGreaterThan(0);
    });

    it('should handle concurrent WebSocket connections', async () => {
      const clients = await Promise.all(
        Array(5).fill(null).map(() => {
          const client = new WebSocket(`ws://localhost:${TEST_CONFIG.websocket.port}`);
          return new Promise<WebSocket>((resolve, reject) => {
            client.once('open', () => resolve(client));
            client.once('error', reject);
          });
        })
      );
      
      // Send test message to all clients
      websocketService.broadcast({
        type: 'test.broadcast',
        data: { message: 'Test concurrent connections' }
      });
      
      const messages = await Promise.all(
        clients.map(client => 
          new Promise((resolve) => {
            client.once('message', (data) => {
              resolve(JSON.parse(data.toString()));
            });
          })
        )
      );
      
      expect(messages).toHaveLength(5);
      messages.forEach(msg => {
        expect(msg).toHaveProperty('type', 'test.broadcast');
      });
      
      // Cleanup
      clients.forEach(client => client.close());
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-volume email processing', async () => {
      const emailCount = 50;
      const startTime = Date.now();
      
      // Create test emails
      const emailIds = Array(emailCount).fill(null).map((_, i) => {
        const id = `load-test-${i}`;
        db.prepare(`
          INSERT OR REPLACE INTO emails (id, subject, body, from_address, to_address, received_date)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id,
          `Load test email ${i}`,
          `Performance test body ${i} with various content and deal #45791720`,
          'test@example.com',
          'recipient@example.com',
          new Date().toISOString()
        );
        return id;
      });
      
      // Process all emails concurrently
      const results = await Promise.all(
        emailIds.map(id => emailWorker.processEmail(id))
      );
      
      const duration = Date.now() - startTime;
      const throughput = emailCount / (duration / 1000);
      
      expect(results).toHaveLength(emailCount);
      expect(throughput).toBeGreaterThan(1); // At least 1 email per second
      
      logger.info(`Processed ${emailCount} emails in ${duration}ms (${throughput.toFixed(2)} emails/sec)`, 'E2E_TEST');
    });

    it('should maintain response times under concurrent load', async () => {
      const concurrentRequests = 20;
      const responseTimes: number[] = [];
      
      const requests = Array(concurrentRequests).fill(null).map(async (_, i) => {
        const start = Date.now();
        
        await llmManager.generate(`Concurrent request ${i}`, {
          maxTokens: 50
        });
        
        const responseTime = Date.now() - start;
        responseTimes.push(responseTime);
        
        return responseTime;
      });
      
      await Promise.all(requests);
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      expect(avgResponseTime).toBeLessThan(5000); // Average under 5 seconds
      expect(maxResponseTime).toBeLessThan(10000); // Max under 10 seconds
      
      logger.info(`Average response time: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime}ms`, 'E2E_TEST');
    });

    it('should handle memory efficiently during sustained load', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await llmManager.generate(`Memory test iteration ${i}`, {
          maxTokens: 30
        });
        
        // Allow garbage collection
        if (i % 10 === 0) {
          if (global.gc) global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024); // MB
      
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
      
      logger.info(`Memory increase after ${iterations} iterations: ${memoryIncrease.toFixed(2)}MB`, 'E2E_TEST');
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from llama-server restart', async () => {
      if (!llamaServerProcess) {
        console.log('Skipping server restart test - using external server');
        return;
      }
      
      // Kill the server
      llamaServerProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify it's down
      await expect(llmManager.generate('Test during downtime'))
        .rejects.toThrow();
      
      // Restart server
      llamaServerProcess = await startLlamaServer();
      await waitForLlamaServer();
      
      // Should recover automatically
      const response = await llmManager.generate('Test after recovery');
      expect(response).toHaveProperty('text');
    });

    it('should handle corrupted email data gracefully', async () => {
      const corruptedEmail = {
        id: 'corrupted-001',
        subject: null,
        body: undefined,
        from_address: '',
        to_address: 'test@example.com',
        received_date: 'invalid-date'
      };
      
      db.prepare(`
        INSERT OR REPLACE INTO emails (id, subject, body, from_address, to_address, received_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        corruptedEmail.id,
        corruptedEmail.subject,
        corruptedEmail.body,
        corruptedEmail.from_address,
        corruptedEmail.to_address,
        corruptedEmail.received_date
      );
      
      const result = await emailWorker.processEmail(corruptedEmail.id);
      
      expect(result).toHaveProperty('error');
      expect(result.processingStatus).toBe('failed');
    });

    it('should handle API request timeouts', async () => {
      const slowRequest = request(apiServer)
        .post('/api/process-email')
        .send({ emailId: 'test-timeout', timeout: 100 })
        .timeout(5000);
      
      await expect(slowRequest).rejects.toThrow();
    });
  });
});

// Helper functions

async function initializeTestDatabase(db: Database.Database) {
  // Create necessary tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      subject TEXT,
      body TEXT,
      from_address TEXT,
      to_address TEXT,
      received_date TEXT,
      phase_1_results TEXT,
      phase_2_results TEXT,
      phase_3_results TEXT,
      processing_status TEXT DEFAULT 'pending',
      processed_at TEXT,
      error_message TEXT
    );
    
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      agent_name TEXT,
      task_type TEXT,
      input_data TEXT,
      output_data TEXT,
      status TEXT,
      created_at TEXT,
      completed_at TEXT
    );
    
    CREATE TABLE IF NOT EXISTS llm_requests (
      id TEXT PRIMARY KEY,
      provider TEXT,
      model TEXT,
      prompt TEXT,
      response TEXT,
      tokens_used INTEGER,
      duration_ms INTEGER,
      created_at TEXT
    );
  `);
}

async function createTestApp(db: Database.Database) {
  const express = await import('express');
  const app = express.default();
  
  app.use(express.json());
  
  // Basic health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Email processing endpoint
  app.post('/api/process-email', async (req, res) => {
    try {
      const { emailId } = req.body;
      const worker = new EmailProcessingWorker(db);
      const result = await worker.processEmail(emailId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // LLM generation endpoint
  app.post('/api/generate', async (req, res) => {
    try {
      const { prompt, options } = req.body;
      const manager = LLMProviderManager.getInstance();
      const result = await manager.generate(prompt, options);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  return app;
}