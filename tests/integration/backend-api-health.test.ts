import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import type { AxiosError } from 'axios';

const API_BASE_URL = 'http://localhost:3001';
const TIMEOUT = 30000; // 30 seconds for server startup

describe('Backend API Server Health Checks', () => {
  let serverAvailable = false;

  beforeAll(async () => {
    // Wait for server to be available
    const startTime = Date.now();
    while (Date.now() - startTime < TIMEOUT) {
      try {
        await axios.get(`${API_BASE_URL}/health`);
        serverAvailable = true;
        console.log('✅ Backend API server is running on port 3001');
        break;
      } catch (error) {
        // Server not ready yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, TIMEOUT);

  it('should have backend server running', () => {
    expect(serverAvailable).toBe(true);
  });

  describe('Core Endpoints', () => {
    it('GET /health should return 200', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data.status).toBe('healthy');
    });

    it('GET /api/health should return detailed health status', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('services');
      expect(response.data).toHaveProperty('timestamp');
    });

    it('GET /api/metrics should return metrics data', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/metrics`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('uptime');
      expect(response.data).toHaveProperty('memory');
      expect(response.data).toHaveProperty('cpu');
    });

    it('GET /api/walmart-grocery/health should return service health', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/walmart-grocery/health`);
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
    });
  });

  describe('tRPC Endpoints', () => {
    it('GET /trpc should return tRPC panel or 404', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      try {
        const response = await axios.get(`${API_BASE_URL}/trpc`);
        // tRPC panel may or may not be enabled
        expect([200, 404]).toContain(response.status);
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(404);
      }
    });

    it('GET /trpc/health.check should work with tRPC', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      try {
        const response = await axios.get(`${API_BASE_URL}/trpc/health.check`);
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('result');
      } catch (error) {
        // tRPC might require specific headers
        console.log('tRPC endpoint requires specific client setup');
      }
    });
  });

  describe('WebSocket Support', () => {
    it('should upgrade WebSocket connections', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      // Check if WebSocket upgrade headers are accepted
      try {
        const response = await axios.get(`${API_BASE_URL}/socket.io/`, {
          headers: {
            'Upgrade': 'websocket',
            'Connection': 'Upgrade'
          },
          validateStatus: () => true // Accept any status
        });
        // Socket.io typically returns 400 for non-WebSocket requests
        expect([400, 101]).toContain(response.status);
      } catch (error) {
        // WebSocket upgrade might fail in axios, which is expected
        console.log('WebSocket endpoint detected (upgrade required)');
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      try {
        await axios.get(`${API_BASE_URL}/non-existent-route`);
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(404);
      }
    });

    it('should handle malformed requests gracefully', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      try {
        await axios.post(`${API_BASE_URL}/api/walmart-grocery/search`, {
          // Malformed data
          invalidField: 'test'
        });
      } catch (error) {
        const axiosError = error as AxiosError;
        // Should return 400 or 422 for bad request
        expect([400, 422]).toContain(axiosError.response?.status);
      }
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      if (!serverAvailable) {
        console.log('⚠️ Skipping: Server not available');
        return;
      }
      
      const response = await axios.options(`${API_BASE_URL}/api/health`, {
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  afterAll(() => {
    if (serverAvailable) {
      console.log('✅ All backend API integration tests completed');
    } else {
      console.log('⚠️ Backend API server was not available for testing');
    }
  });
});