/**
 * Real-World Scenario Tests for CrewAI Agent System
 * 
 * These tests validate the agent system with realistic use cases and queries
 * that would be encountered in production environments.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import Database from 'better-sqlite3';

// Test configuration
const API_BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:8080';

interface TestScenario {
  name: string;
  description: string;
  query: string;
  expectedAgents: string[];
  expectedOutputs: string[];
  minExecutionTime?: number;
  maxExecutionTime?: number;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: 'Security Audit Request',
    description: 'User requests a comprehensive security audit of the codebase',
    query: 'Perform a security audit of the CrewAI system, identify vulnerabilities, and provide remediation recommendations with code examples',
    expectedAgents: ['ResearchAgent', 'CodeAgent', 'DataAnalysisAgent', 'WriterAgent'],
    expectedOutputs: ['vulnerabilities', 'recommendations', 'code examples'],
    maxExecutionTime: 30000
  },
  {
    name: 'Email Campaign Analysis',
    description: 'Analyze email campaign effectiveness and generate insights',
    query: 'Analyze the last 30 days of email campaigns, identify top performers, calculate engagement metrics, and suggest improvements',
    expectedAgents: ['EmailAnalysisAgent', 'DataAnalysisAgent', 'WriterAgent'],
    expectedOutputs: ['metrics', 'top performers', 'suggestions'],
    maxExecutionTime: 25000
  },
  {
    name: 'Code Refactoring Request',
    description: 'Request to refactor and optimize existing code',
    query: 'Review the WebSocket service implementation, identify performance bottlenecks, and provide optimized code with explanations',
    expectedAgents: ['ResearchAgent', 'CodeAgent', 'WriterAgent'],
    expectedOutputs: ['bottlenecks', 'optimized code', 'explanations'],
    maxExecutionTime: 20000
  },
  {
    name: 'Business Intelligence Report',
    description: 'Generate comprehensive business intelligence report',
    query: 'Create a business intelligence report analyzing customer engagement trends, revenue patterns, and growth opportunities based on email and transaction data',
    expectedAgents: ['DataAnalysisAgent', 'EmailAnalysisAgent', 'WriterAgent'],
    expectedOutputs: ['trends', 'patterns', 'opportunities', 'visualizations'],
    maxExecutionTime: 35000
  },
  {
    name: 'API Documentation Generation',
    description: 'Automatically generate API documentation',
    query: 'Generate comprehensive API documentation for all agent endpoints including examples, request/response schemas, and error codes',
    expectedAgents: ['ResearchAgent', 'CodeAgent', 'WriterAgent'],
    expectedOutputs: ['endpoints', 'schemas', 'examples', 'error codes'],
    maxExecutionTime: 25000
  }
];

describe('Real-World Scenario Integration Tests', () => {
  let app: any;
  let ws: WebSocket;
  let db: Database.Database;

  beforeAll(async () => {
    console.log('Setting up test environment...');
    
    // Initialize database
    db = new Database(':memory:');
    
    // Seed with realistic test data
    await seedTestData(db);
    
    // Import and start server
    const { default: createApp } = await import('../../src/api/app');
    app = await createApp();
    
    // Wait for server initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify server health
    const healthCheck = await request(app).get('/api/health');
    expect(healthCheck.status).toBe(200);
  });

  afterAll(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    if (db) {
      db.close();
    }
  });

  describe('Scenario Execution Tests', () => {
    TEST_SCENARIOS.forEach(scenario => {
      it(`should handle scenario: ${scenario.name}`, async () => {
        console.log(`\\nExecuting scenario: ${scenario.name}`);
        console.log(`Query: ${scenario.query}`);
        
        const startTime = Date.now();
        
        // Execute query through API
        const response = await request(app)
          .post('/api/agent/orchestrate')
          .send({
            query: scenario.query,
            context: {
              enableRAG: true,
              timeout: scenario.maxExecutionTime || 30000
            }
          })
          .timeout(scenario.maxExecutionTime || 30000);
        
        const executionTime = Date.now() - startTime;
        
        // Validate response
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        expect(response.body.success).toBe(true);
        expect(response.body.plan).toBeDefined();
        expect(response.body.results).toBeDefined();
        
        // Validate involved agents
        const involvedAgents = response.body.plan.steps.map((s: any) => s.agent);
        scenario.expectedAgents.forEach(agent => {
          expect(involvedAgents).toContain(agent);
        });
        
        // Validate output contains expected elements
        const resultText = JSON.stringify(response.body.results).toLowerCase();
        scenario.expectedOutputs.forEach(output => {
          expect(resultText).toContain(output.toLowerCase());
        });
        
        // Validate execution time
        if (scenario.maxExecutionTime) {
          expect(executionTime).toBeLessThan(scenario.maxExecutionTime);
        }
        if (scenario.minExecutionTime) {
          expect(executionTime).toBeGreaterThan(scenario.minExecutionTime);
        }
        
        console.log(`✓ Scenario completed in ${executionTime}ms`);
        console.log(`  Agents used: ${involvedAgents.join(', ')}`);
      });
    });
  });

  describe('WebSocket Real-Time Monitoring', () => {
    beforeAll(async () => {
      ws = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
    });

    it('should monitor real-time execution of complex query', async () => {
      const events: any[] = [];
      
      // Set up WebSocket listeners
      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        events.push(event);
      });

      // Execute complex query
      const complexQuery = 'Analyze system performance, identify bottlenecks, generate optimization plan with code, and create monitoring dashboard specification';
      
      const response = await request(app)
        .post('/api/agent/orchestrate')
        .send({
          query: complexQuery,
          context: {
            enableWebSocket: true,
            sessionId: 'test-session-1'
          }
        });
      
      // Wait for WebSocket events
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Validate WebSocket events
      expect(events.length).toBeGreaterThan(0);
      
      const eventTypes = events.map(e => e.type);
      expect(eventTypes).toContain('agent.started');
      expect(eventTypes).toContain('agent.progress');
      expect(eventTypes).toContain('agent.completed');
      
      // Validate event sequence
      const agentStartEvents = events.filter(e => e.type === 'agent.started');
      const agentCompleteEvents = events.filter(e => e.type === 'agent.completed');
      
      expect(agentStartEvents.length).toBeGreaterThan(0);
      expect(agentCompleteEvents.length).toBe(agentStartEvents.length);
      
      console.log(`Received ${events.length} WebSocket events during execution`);
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle malformed queries gracefully', async () => {
      const malformedQueries = [
        '',
        '   ',
        'a'.repeat(10000), // Very long query
        '!@#$%^&*()', // Special characters only
        'SELECT * FROM users', // SQL injection attempt
        '<script>alert("XSS")</script>' // XSS attempt
      ];

      for (const query of malformedQueries) {
        const response = await request(app)
          .post('/api/agent/orchestrate')
          .send({ query });
        
        expect(response.status).toBeOneOf([400, 422]);
        expect(response.body.error).toBeDefined();
        expect(response.body.message).toBeDefined();
      }
    });

    it('should handle timeout scenarios', async () => {
      const response = await request(app)
        .post('/api/agent/orchestrate')
        .send({
          query: 'Perform an extremely complex analysis that would take forever',
          context: {
            timeout: 1000 // 1 second timeout
          }
        })
        .timeout(5000);
      
      expect(response.status).toBeOneOf([408, 504]);
      expect(response.body.error).toContain('timeout');
    });

    it('should handle concurrent request limits', async () => {
      const concurrentRequests = 50;
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .post('/api/agent/orchestrate')
          .send({
            query: 'Simple test query',
            context: { priority: 'low' }
          })
      );

      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200);
      const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.status === 429);
      
      expect(successful.length).toBeGreaterThan(0);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      console.log(`Concurrent requests: ${successful.length} successful, ${rateLimited.length} rate limited`);
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain data consistency across agents', async () => {
      // Create a test email
      const emailId = 'consistency-test-email';
      
      db.exec(`
        INSERT INTO emails (id, subject, body, sender, timestamp)
        VALUES ('${emailId}', 'Test Subject', 'Test Body', 'test@example.com', ${Date.now()})
      `);

      // Query the same email through different agents
      const queries = [
        `Analyze email ${emailId} for sentiment`,
        `Extract action items from email ${emailId}`,
        `Summarize email ${emailId}`
      ];

      const results = await Promise.all(queries.map(query =>
        request(app)
          .post('/api/agent/orchestrate')
          .send({ query })
      ));

      // All should reference the same email
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.results).toContain(emailId);
      });
    });

    it('should handle database transaction rollbacks', async () => {
      const response = await request(app)
        .post('/api/agent/orchestrate')
        .send({
          query: 'Process batch of emails with intentional failure in the middle',
          context: {
            testMode: true,
            failAt: 5
          }
        });

      // Verify rollback occurred
      const emailCount = db.prepare('SELECT COUNT(*) as count FROM emails WHERE id LIKE "batch-test-%"').get();
      expect(emailCount.count).toBe(0); // All should be rolled back
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain SLA under normal load', async () => {
      const normalLoad = 10; // requests per second
      const duration = 5000; // 5 seconds
      const requests: Promise<any>[] = [];
      
      const startTime = Date.now();
      
      const interval = setInterval(() => {
        requests.push(
          request(app)
            .post('/api/agent/orchestrate')
            .send({
              query: 'What is the status of the system?',
              context: { priority: 'normal' }
            })
        );
      }, 1000 / normalLoad);

      await new Promise(resolve => setTimeout(resolve, duration));
      clearInterval(interval);

      const results = await Promise.all(requests);
      
      const responseTimes = results.map(r => r.body.executionTime || 0);
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      
      console.log(`\\nPerformance under normal load:`);
      console.log(`  Requests: ${requests.length}`);
      console.log(`  Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`  P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
      
      expect(avgResponseTime).toBeLessThan(1000); // SLA: < 1 second average
      expect(p95ResponseTime).toBeLessThan(2000); // SLA: < 2 seconds P95
    });
  });

  describe('Integration with External Services', () => {
    it('should integrate with RAG system for enhanced responses', async () => {
      const response = await request(app)
        .post('/api/agent/orchestrate')
        .send({
          query: 'What are the best practices for WebSocket implementation based on our codebase?',
          context: {
            enableRAG: true,
            ragSources: ['codebase', 'documentation']
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
      expect(response.body.metadata.ragDocumentsUsed).toBeGreaterThan(0);
      expect(response.body.metadata.sources).toBeInstanceOf(Array);
    });

    it('should fallback gracefully when external services fail', async () => {
      // Simulate external service failure
      const response = await request(app)
        .post('/api/agent/orchestrate')
        .send({
          query: 'Generate report with external data',
          context: {
            mockExternalFailure: true
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.degradedMode).toBe(true);
      expect(response.body.warnings).toContain('external service unavailable');
    });
  });
});

// Helper function to seed test data
async function seedTestData(db: Database.Database) {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      subject TEXT,
      body TEXT,
      sender TEXT,
      recipient TEXT,
      timestamp INTEGER,
      thread_id TEXT,
      sentiment REAL,
      category TEXT,
      processed BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      amount REAL,
      product TEXT,
      timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT,
      message TEXT,
      timestamp INTEGER,
      service TEXT
    );
  `);

  // Seed emails
  const emailStmt = db.prepare(`
    INSERT INTO emails (id, subject, body, sender, recipient, timestamp, thread_id, sentiment, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const emailTemplates = [
    { category: 'support', sentiment: -0.5, subject: 'Issue with' },
    { category: 'sales', sentiment: 0.8, subject: 'Interested in' },
    { category: 'feedback', sentiment: 0.3, subject: 'Feedback on' },
    { category: 'inquiry', sentiment: 0.0, subject: 'Question about' }
  ];

  for (let i = 0; i < 1000; i++) {
    const template = emailTemplates[i % emailTemplates.length];
    emailStmt.run(
      `email-${i}`,
      `${template.subject} product ${i % 50}`,
      `Detailed message body for email ${i} discussing various topics and concerns.`,
      `sender${i % 100}@example.com`,
      `support@company.com`,
      Date.now() - i * 3600000,
      `thread-${Math.floor(i / 5)}`,
      template.sentiment + (Math.random() - 0.5) * 0.2,
      template.category
    );
  }

  // Seed transactions
  const transStmt = db.prepare(`
    INSERT INTO transactions (id, customer_id, amount, product, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < 500; i++) {
    transStmt.run(
      `trans-${i}`,
      `customer-${i % 100}`,
      Math.random() * 1000 + 10,
      `product-${i % 50}`,
      Date.now() - i * 7200000
    );
  }

  // Seed system logs
  const logStmt = db.prepare(`
    INSERT INTO system_logs (level, message, timestamp, service)
    VALUES (?, ?, ?, ?)
  `);

  const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
  const services = ['MasterOrchestrator', 'ResearchAgent', 'CodeAgent', 'DataAnalysisAgent'];

  for (let i = 0; i < 200; i++) {
    logStmt.run(
      logLevels[i % logLevels.length],
      `Log message ${i} from service operation`,
      Date.now() - i * 60000,
      services[i % services.length]
    );
  }

  console.log('Test data seeded successfully');
}