import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { {{ModuleName}} } from '../{{module-path}}';

// Mock dependencies
jest.mock('@/utils/logger');
jest.mock('@/services/database');

// Test data
const mockData = {
  id: 'test-id-123',
  name: 'Test Item',
  value: 42,
};

const createMockContext = () => ({
  user: { id: 'user-123', role: 'admin' },
  session: { id: 'session-123' },
});

describe('{{ModuleName}}', () => {
  let instance: {{ModuleName}};
  let mockContext: ReturnType<typeof createMockContext>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset modules
    jest.resetModules();
    
    // Create fresh instances
    instance = new {{ModuleName}}();
    mockContext = createMockContext();
  });
  
  afterEach(() => {
    // Cleanup
    jest.restoreAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(instance).toBeDefined();
      expect(instance.isInitialized).toBe(false);
    });
    
    it('should initialize with custom config', () => {
      const customConfig = { timeout: 5000, retries: 3 };
      const customInstance = new {{ModuleName}}(customConfig);
      
      expect(customInstance.config).toEqual(customConfig);
    });
    
    it('should throw error if initialized twice', async () => {
      await instance.initialize();
      
      await expect(instance.initialize()).rejects.toThrow('Already initialized');
    });
  });
  
  describe('main functionality', () => {
    beforeEach(async () => {
      await instance.initialize();
    });
    
    describe('happy path', () => {
      it('should process valid input successfully', async () => {
        const input = { data: 'test' };
        const result = await instance.process(input);
        
        expect(result).toEqual({
          success: true,
          data: expect.any(Object),
        });
      });
      
      it('should handle multiple concurrent requests', async () => {
        const promises = Array.from({ length: 5 }, (_, i) => 
          instance.process({ data: `test-${i}` })
        );
        
        const results = await Promise.all(promises);
        
        expect(results).toHaveLength(5);
        results.forEach(result => {
          expect(result.success).toBe(true);
        });
      });
    });
    
    describe('error handling', () => {
      it('should handle invalid input gracefully', async () => {
        const invalidInput = { data: null };
        
        await expect(instance.process(invalidInput)).rejects.toThrow('Invalid input');
      });
      
      it('should retry on transient failures', async () => {
        const mockFn = jest.fn()
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({ success: true });
        
        instance.performOperation = mockFn;
        
        const result = await instance.process(mockData);
        
        expect(mockFn).toHaveBeenCalledTimes(3);
        expect(result.success).toBe(true);
      });
      
      it('should timeout long-running operations', async () => {
        jest.useFakeTimers();
        
        const promise = instance.processWithTimeout(mockData, 1000);
        
        jest.advanceTimersByTime(1500);
        
        await expect(promise).rejects.toThrow('Operation timed out');
        
        jest.useRealTimers();
      });
    });
    
    describe('edge cases', () => {
      it('should handle empty input', async () => {
        const result = await instance.process({});
        
        expect(result).toEqual({
          success: true,
          data: expect.any(Object),
        });
      });
      
      it('should handle very large input', async () => {
        const largeInput = {
          data: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            value: Math.random(),
          })),
        };
        
        const result = await instance.process(largeInput);
        
        expect(result.success).toBe(true);
      });
      
      it('should handle special characters in input', async () => {
        const specialInput = {
          data: 'Test with special chars: @#$%^&*()_+{}[]|\\:";\'<>?,./~`',
        };
        
        const result = await instance.process(specialInput);
        
        expect(result.success).toBe(true);
      });
    });
  });
  
  describe('mocking and spying', () => {
    it('should call dependencies with correct parameters', async () => {
      const mockDatabase = require('@/services/database');
      mockDatabase.query = jest.fn().mockResolvedValue({ rows: [mockData] });
      
      await instance.fetchData('test-id');
      
      expect(mockDatabase.query).toHaveBeenCalledWith(
        'SELECT * FROM items WHERE id = $1',
        ['test-id']
      );
    });
    
    it('should emit events on state changes', async () => {
      const eventHandler = jest.fn();
      instance.on('stateChange', eventHandler);
      
      await instance.updateState('active');
      
      expect(eventHandler).toHaveBeenCalledWith({
        previousState: 'idle',
        newState: 'active',
        timestamp: expect.any(Number),
      });
    });
  });
  
  describe('integration tests', () => {
    it('should work with real dependencies', async () => {
      // Skip in CI environment
      if (process.env.CI) {
        return;
      }
      
      const realInstance = new {{ModuleName}}({ useMocks: false });
      await realInstance.initialize();
      
      const result = await realInstance.process(mockData);
      
      expect(result.success).toBe(true);
    }, 30000); // Extended timeout for integration tests
  });
  
  describe('performance', () => {
    it('should process requests within acceptable time', async () => {
      const startTime = Date.now();
      
      await instance.process(mockData);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });
    
    it('should not leak memory', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Process many requests
      for (let i = 0; i < 1000; i++) {
        await instance.process({ data: `test-${i}` });
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
  
  describe('snapshot tests', () => {
    it('should match expected output structure', async () => {
      const result = await instance.process(mockData);
      
      expect(result).toMatchSnapshot();
    });
  });
});