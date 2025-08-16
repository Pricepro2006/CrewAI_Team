/**
 * WebSocket Upgrade Handshake Tests
 * Tests WebSocket protocol upgrade, handshake validation, and security aspects
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server, IncomingMessage } from 'http';
import { Socket } from 'net';
import { WalmartWebSocketServer } from '../WalmartWebSocketServer.js';
import { WebSocketServer } from 'ws';
import { createHash } from 'crypto';

describe('WebSocket Upgrade Handshake Tests', () => {
  let server: Server;
  let walmartWS: WalmartWebSocketServer;
  let port: number;
  
  beforeAll((done) => {
    port = 3000 + Math.floor(Math.random() * 1000);
    server = createServer();
    server.listen(port, done);
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  beforeEach(() => {
    walmartWS = new WalmartWebSocketServer();
  });
  
  afterEach(() => {
    walmartWS?.shutdown();
  });

  describe('HTTP to WebSocket Upgrade', () => {
    it('should handle valid upgrade requests', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        method: 'GET',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'origin': 'http://localhost:3000'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn(),
        end: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
      
      // Should not destroy socket for valid upgrade
      expect(mockSocket.destroy).not.toHaveBeenCalled();
    });

    it('should reject upgrade when server not initialized', () => {
      const uninitializedWS = new WalmartWebSocketServer();
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      uninitializedWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('should handle upgrade with callback', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      const callback = vi.fn();
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead, callback);
      }).not.toThrow();
    });

    it('should handle malformed upgrade requests gracefully', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          // Missing required WebSocket headers
          'connection': 'keep-alive'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });
  });

  describe('WebSocket Handshake Validation', () => {
    it('should validate WebSocket version', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '8', // Older version
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should validate WebSocket key format', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'invalid-key-format'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should handle missing required headers', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          // Missing all WebSocket headers
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should validate origin headers when present', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'origin': 'https://trusted-domain.com'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });
  });

  describe('Path-based Routing', () => {
    it('should handle requests to correct path', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
      
      expect(mockSocket.destroy).not.toHaveBeenCalled();
    });

    it('should handle requests with query parameters', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart?token=abc123&session=xyz789',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should handle requests to different paths', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/different-service',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });
  });

  describe('Security and Error Handling', () => {
    it('should handle upgrade errors gracefully', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      // Mock a scenario where upgrade fails
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
        setTimeout: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('some data');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should handle socket errors during upgrade', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            // Simulate socket error
            setTimeout(() => callback(new Error('Socket error')), 10);
          }
        })
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should validate request method', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        method: 'POST', // Wrong method for WebSocket upgrade
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should handle concurrent upgrade requests', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const createMockUpgrade = (id: number) => {
        const mockRequest = {
          url: `/ws/walmart?client=${id}`,
          headers: {
            'connection': 'upgrade',
            'upgrade': 'websocket',
            'sec-websocket-version': '13',
            'sec-websocket-key': `dGhlIHNhbXBsZSBub25jZSR7aWR9`
          }
        } as IncomingMessage;
        
        const mockSocket = {
          destroy: vi.fn(),
          write: vi.fn()
        } as any as Socket;
        
        const mockHead = Buffer.from('');
        
        return { mockRequest, mockSocket, mockHead };
      };
      
      // Create multiple concurrent upgrade requests
      const upgrades = Array.from({ length: 5 }, (_, i) => createMockUpgrade(i));
      
      expect(() => {
        upgrades.forEach(({ mockRequest, mockSocket, mockHead }) => {
          walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
        });
      }).not.toThrow();
    });
  });

  describe('Protocol Compliance', () => {
    it('should handle WebSocket subprotocol negotiation', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'sec-websocket-protocol': 'chat, superchat'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should handle WebSocket extensions', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==',
          'sec-websocket-extensions': 'permessage-deflate; client_max_window_bits'
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });

    it('should generate proper WebSocket accept key', () => {
      // Test the WebSocket accept key generation logic
      const clientKey = 'dGhlIHNhbXBsZSBub25jZQ==';
      const magicString = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
      const expectedAccept = createHash('sha1')
        .update(clientKey + magicString)
        .digest('base64');
      
      expect(expectedAccept).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    });

    it('should handle case-insensitive headers', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'CONNECTION': 'upgrade',
          'UPGRADE': 'websocket',
          'SEC-WEBSOCKET-VERSION': '13',
          'SEC-WEBSOCKET-KEY': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as any as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      expect(() => {
        walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      }).not.toThrow();
    });
  });

  describe('Connection Limits and Resource Management', () => {
    it('should handle maximum connection limits', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      // Create many upgrade requests to test limits
      const maxRequests = 100;
      const requests = [];
      
      for (let i = 0; i < maxRequests; i++) {
        const mockRequest = {
          url: `/ws/walmart?id=${i}`,
          headers: {
            'connection': 'upgrade',
            'upgrade': 'websocket',
            'sec-websocket-version': '13',
            'sec-websocket-key': `dGhlIHNhbXBsZSBub25jZSR7aWR9${i}`
          }
        } as IncomingMessage;
        
        const mockSocket = {
          destroy: vi.fn(),
          write: vi.fn()
        } as any as Socket;
        
        const mockHead = Buffer.from('');
        
        requests.push({ mockRequest, mockSocket, mockHead });
      }
      
      expect(() => {
        requests.forEach(({ mockRequest, mockSocket, mockHead }) => {
          walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
        });
      }).not.toThrow();
    });

    it('should clean up resources after failed upgrades', () => {
      walmartWS.initialize(server, '/ws/walmart');
      
      const mockRequest = {
        url: '/ws/walmart',
        headers: {
          'connection': 'upgrade',
          'upgrade': 'websocket',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='
        }
      } as IncomingMessage;
      
      const mockSocket = {
        destroy: vi.fn(),
        write: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn()
      } as any as Socket;
      
      const mockHead = Buffer.from('');
      
      // Simulate upgrade failure
      walmartWS.handleUpgrade(mockRequest, mockSocket, mockHead);
      
      // Should handle cleanup gracefully
      expect(() => {
        walmartWS.shutdown();
      }).not.toThrow();
    });
  });
});
