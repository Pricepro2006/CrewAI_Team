/**
 * WebSocket Health Check Tests
 * Tests WebSocket server startup, endpoint availability, and basic health checks
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';
import { createServer, Server } from 'http';
import { WalmartWebSocketServer } from '../WalmartWebSocketServer';
import { EmailProcessingWebSocket } from '../EmailProcessingWebSocket';
import { logger } from '../../../utils/logger';

describe('WebSocket Health Checks', () => {
  let server: Server;
  let walmartWS: WalmartWebSocketServer;
  let emailWS: EmailProcessingWebSocket;
  let port: number;
  
  beforeAll(() => {
    // Use a random port for testing
    port = 3000 + Math.floor(Math.random() * 1000);
    server = createServer();
  });
  
  afterAll((done) => {
    if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });
  
  beforeEach(() => {
    walmartWS = new WalmartWebSocketServer();
    emailWS = new EmailProcessingWebSocket();
  });
  
  afterEach(() => {
    walmartWS?.shutdown();
    emailWS?.shutdown();
  });

  describe('Server Startup and Availability', () => {
    it('should start HTTP server successfully', (done) => {
      server.listen(port, () => {
        expect(server.listening).toBe(true);
        const address = server.address();
        expect(address).toBeTruthy();
        if (typeof address === 'object' && address) {
          expect(address.port).toBe(port);
        }
        done();
      });
    });

    it('should initialize Walmart WebSocket server without errors', () => {
      expect(() => {
        walmartWS.initialize(server, '/ws/walmart-test');
      }).not.toThrow();
    });

    it('should initialize Email Processing WebSocket without errors', () => {
      const wss = new WebSocketServer({ server, path: '/ws/email-test' });
      expect(() => {
        emailWS.initialize(wss);
      }).not.toThrow();
    });

    it('should report correct client count initially', () => {
      walmartWS.initialize(server, '/ws/walmart-test');
      expect(walmartWS.getClientCount()).toBe(0);
      expect(emailWS.getConnectedClients()).toBe(0);
    });

    it('should handle multiple WebSocket paths on same server', () => {
      const wss1 = new WebSocketServer({ server, path: '/ws/test1' });
      const wss2 = new WebSocketServer({ server, path: '/ws/test2' });
      
      expect(() => {
        walmartWS.initialize(server, '/ws/test1');
        emailWS.initialize(wss2);
      }).not.toThrow();
    });
  });

  describe('WebSocket Endpoint Health', () => {
    it('should handle upgrade requests gracefully', () => {
      walmartWS.initialize(server, '/ws/walmart-test');
      
      // Mock upgrade request
      const mockRequest = {
        url: '/ws/walmart-test',
        headers: { 
          origin: 'http://localhost:3000',
          'sec-websocket-key': 'test-key',
          'sec-websocket-version': '13'
        }
      };
      const mockSocket = {
        destroy: vi.fn(),
        end: vi.fn()
      };
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should reject upgrade when server not initialized', () => {
      const uninitializedWS = new WalmartWebSocketServer();
      
      const mockRequest = { url: '/ws/test', headers: {} };
      const mockSocket = { destroy: vi.fn() };
      const mockHead = Buffer.from('');
      
      uninitializedWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    it('should track processing statistics correctly', () => {
      const stats = emailWS.getStats();
      expect(stats).toEqual({
        totalEmails: 0,
        processedEmails: 0,
        currentlyProcessing: 0,
        averageProcessingTime: 0,
        phase1Complete: 0,
        phase2Complete: 0,
        phase3Complete: 0,
        errors: 0
      });
    });

    it('should update statistics when processing events occur', () => {
      emailWS.updateStats({ totalEmails: 100, processedEmails: 50 });
      const stats = emailWS.getStats();
      expect(stats.totalEmails).toBe(100);
      expect(stats.processedEmails).toBe(50);
    });

    it('should handle processing lifecycle events', () => {
      const initialStats = emailWS.getStats();
      
      emailWS.emailProcessingStarted('test-email-1', 1);
      expect(emailWS.getStats().currentlyProcessing).toBe(initialStats.currentlyProcessing + 1);
      
      emailWS.emailProcessingCompleted('test-email-1', 1, 1500);
      const finalStats = emailWS.getStats();
      expect(finalStats.currentlyProcessing).toBe(initialStats.currentlyProcessing);
      expect(finalStats.processedEmails).toBe(initialStats.processedEmails + 1);
      expect(finalStats.phase1Complete).toBe(initialStats.phase1Complete + 1);
    });

    it('should handle processing errors correctly', () => {
      emailWS.emailProcessingStarted('test-email-error', 2);
      const beforeError = emailWS.getStats();
      
      emailWS.emailProcessingError('test-email-error', 2, 'Test error');
      const afterError = emailWS.getStats();
      
      expect(afterError.currentlyProcessing).toBe(beforeError.currentlyProcessing - 1);
      expect(afterError.errors).toBe(beforeError.errors + 1);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should shutdown gracefully', () => {
      walmartWS.initialize(server, '/ws/walmart-test');
      
      expect(() => {
        walmartWS.shutdown();
      }).not.toThrow();
      
      expect(walmartWS.getClientCount()).toBe(0);
    });

    it('should clean up email processing resources', () => {
      const wss = new WebSocketServer({ server, path: '/ws/email-test' });
      emailWS.initialize(wss);
      
      expect(() => {
        emailWS.shutdown();
      }).not.toThrow();
      
      expect(emailWS.getConnectedClients()).toBe(0);
    });
  });
});
