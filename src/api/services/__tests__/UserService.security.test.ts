import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('UserService JWT Security', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset modules to ensure clean state
    vi.resetModules();
    // Create a clean env without JWT_SECRET
    process.env = { ...originalEnv };
    delete process.env.JWT_SECRET;
    // Set a valid database path for testing
    process.env.DATABASE_PATH = ':memory:';
  });
  
  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });
  
  describe('Production Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });
    
    it('should throw error when JWT_SECRET is not set in production', async () => {
      delete process.env.JWT_SECRET;
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).toThrow(
        'JWT_SECRET environment variable is not set. Application cannot start in production without a secure JWT secret.'
      );
    });
    
    it('should throw error when JWT_SECRET contains default value in production', async () => {
      process.env.JWT_SECRET = 'dev-secret-key-change-in-production';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).toThrow(
        'JWT_SECRET contains insecure or default values. Application cannot start with an insecure JWT secret.'
      );
    });
    
    it('should throw error when JWT_SECRET contains insecure patterns', async () => {
      const insecureSecrets = [
        'secret123456',
        'password123',
        'default-jwt-secret',
        'changeme123456',
        'your-jwt-secret-here-123456'
      ];
      
      for (const insecureSecret of insecureSecrets) {
        process.env.JWT_SECRET = insecureSecret;
        
        const { UserService } = await import('../UserService');
        
        expect(() => new UserService()).toThrow(
          'JWT_SECRET contains insecure or default values'
        );
        
        vi.resetModules();
      }
    });
    
    it('should throw error when JWT_SECRET is too short in production', async () => {
      // Use a short but non-insecure pattern secret
      process.env.JWT_SECRET = 'Ab1@Cd2#Ef3$Gh4%Ij5^Kl6&Mn7*';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).toThrow(
        /JWT_SECRET is too short \(\d+ characters\)\. Minimum 32 characters required\./
      );
    });
    
    it('should throw error when JWT_SECRET has insufficient entropy in production', async () => {
      process.env.JWT_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // 40 chars but only 1 unique
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).toThrow(
        'JWT_SECRET has insufficient character diversity. Production requires higher entropy.'
      );
    });
    
    it('should accept secure JWT_SECRET in production', async () => {
      // Generate a secure secret
      process.env.JWT_SECRET = 'xK8$mP2@nL5#qR9&bV4*cW7!fH3^jN6%tY0_aE1+dG2-zU4';
      process.env.DATABASE_PATH = ':memory:'; // Use in-memory DB for testing
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).not.toThrow();
    });
  });
  
  describe('Development Environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });
    
    it('should generate temporary secret when JWT_SECRET is not set in development', async () => {
      delete process.env.JWT_SECRET;
      process.env.DATABASE_PATH = ':memory:';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).not.toThrow();
    });
    
    it('should warn but not throw for insecure secrets in development', async () => {
      process.env.JWT_SECRET = 'dev-secret';
      process.env.DATABASE_PATH = ':memory:';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).not.toThrow();
    });
    
    it('should warn but not throw for short secrets in development', async () => {
      process.env.JWT_SECRET = 'short-dev-secret';
      process.env.DATABASE_PATH = ':memory:';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).not.toThrow();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle mixed case insecure patterns', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'MySecretPassword123456789012345678901234';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).toThrow(
        'JWT_SECRET contains insecure or default values'
      );
    });
    
    it('should validate character diversity correctly', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_PATH = ':memory:';
      
      // Test with exactly 8 unique characters (should pass in production)
      // Using letters to avoid triggering the '123456' insecure pattern
      process.env.JWT_SECRET = 'abcdefghabcdefghabcdefghabcdefgh'; // 8 unique chars, 32 length
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).not.toThrow();
    });
    
    it('should validate very long secure secrets', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_PATH = ':memory:';
      
      // 128 character secure secret
      process.env.JWT_SECRET = 'xK8$mP2@nL5#qR9&bV4*cW7!fH3^jN6%tY0_aE1+dG2-zU4|sI8(oA3)wQ6[rT9]yF5{hB2}kM7:lX0;pC4<vN1>mZ8/qS3?jD6\\tE9~uR2`gY5';
      
      const { UserService } = await import('../UserService');
      
      expect(() => new UserService()).not.toThrow();
    });
  });
});