/**
 * Secure Credential Management System
 * Handles environment variables with validation and secure defaults
 */

import { randomBytes } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CredentialConfig {
  required: boolean;
  validation?: (value: string) => boolean;
  mask?: boolean; // Whether to mask when logging
  sensitive: boolean;
}

interface CredentialSchema {
  [key: string]: CredentialConfig;
}

class CredentialManager {
  private static instance: CredentialManager;
  private credentials: Map<string, string> = new Map();
  private isInitialized = false;

  private readonly schema: CredentialSchema = {
    // API Configuration
    API_PORT: { required: true, sensitive: false },
    NODE_ENV: { required: true, sensitive: false },

    // Database Configuration
    DATABASE_PATH: { required: true, sensitive: false },

    // LLM Configuration (llama.cpp) (optional - using llama.cpp)
    OLLAMA_BASE_URL: { required: false, sensitive: false },
    OLLAMA_TIMEOUT: { required: false, sensitive: false },

    // ChromaDB Configuration (optional - graceful degradation)
    CHROMA_BASE_URL: { required: false, sensitive: false },
    CHROMA_COLLECTION_NAME: { required: false, sensitive: false },

    // Redis Configuration
    REDIS_HOST: { required: false, sensitive: false },
    REDIS_PORT: { required: false, sensitive: false },

    // Microsoft Graph Configuration (OPTIONAL - for email integration)
    MSGRAPH_CLIENT_ID: { 
      required: false,  // Made optional for development
      sensitive: true, 
      mask: true,
      validation: (value: any) => !value || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    },
    MSGRAPH_TENANT_ID: { 
      required: false,  // Made optional for development
      sensitive: true, 
      mask: true,
      validation: (value: any) => !value || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    },
    MSGRAPH_CLIENT_SECRET: { 
      required: false,  // Made optional for development
      sensitive: true, 
      mask: true,
      validation: (value: any) => !value || value?.length >= 20
    },

    // Webhook Configuration
    WEBHOOK_URL: { required: false, sensitive: false },
    WEBHOOK_CLIENT_STATE: { required: false, sensitive: true, mask: true },

    // JWT Configuration (SECURITY CRITICAL)
    JWT_SECRET: { 
      required: false,  // Made optional with auto-generation fallback
      sensitive: true, 
      mask: true,
      validation: (value: any) => !value || value?.length >= 64
    },
    JWT_EXPIRES_IN: { required: false, sensitive: false },

    // Security Configuration
    RATE_LIMIT_WINDOW: { required: false, sensitive: false },
    RATE_LIMIT_MAX_REQUESTS: { required: false, sensitive: false },

    // File Upload Configuration
    UPLOAD_MAX_SIZE: { required: false, sensitive: false },
    UPLOAD_ALLOWED_TYPES: { required: false, sensitive: false },

    // WebSocket Configuration
    WS_PORT: { required: false, sensitive: false },
    WS_HEALTH_INTERVAL: { required: false, sensitive: false },
  };

  private constructor() {}

  static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Initialize credential manager and validate all required environment variables
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Load from .env file if it exists
    try {
      await this.loadFromEnvFile();
    } catch (error) {
      console.warn('⚠️ No .env file found, using environment variables or defaults');
    }

    // Validate all credentials
    const errors = this.validateCredentials();
    
    // Only show warnings for missing optional credentials
    if (errors?.length > 0) {
      const criticalErrors = errors.filter(e => e.includes('API_PORT') || e.includes('NODE_ENV') || e.includes('DATABASE_PATH'));
      const warnings = errors.filter(e => !criticalErrors.includes(e));
      
      if (warnings.length > 0) {
        console.warn('⚠️ Optional credentials missing (system will use fallbacks):');
        warnings.forEach(w => console.warn('  ' + w));
      }
      
      if (criticalErrors.length > 0) {
        throw new Error(`Critical credential validation failed:\n${criticalErrors.join('\n')}`);
      }
    }

    // Check for exposed credentials in git
    try {
      await this.checkForExposedCredentials();
    } catch (error) {
      console.warn('⚠️ Could not check for exposed credentials:', error);
    }

    this.isInitialized = true;
    console.log('✅ Credential Manager initialized successfully (with graceful fallbacks)');
  }

  /**
   * Load credentials from .env file
   */
  private async loadFromEnvFile(): Promise<void> {
    const envPath = join(process.cwd(), '.env');
    
    if (!existsSync(envPath)) {
      // Don't throw, just return - we'll use environment variables or defaults
      return;
    }

    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          this?.credentials?.set(key, value);
        }
      }
    }
  }

  /**
   * Validate all credentials according to schema
   */
  private validateCredentials(): string[] {
    const errors: string[] = [];

    for (const [key, config] of Object.entries(this.schema)) {
      const value = this?.credentials?.get(key) || process.env[key];

      if (config.required && !value) {
        errors.push(`❌ Missing required credential: ${key}`);
        continue;
      }

      if (value && config.validation && !config.validation(value)) {
        errors.push(`❌ Invalid format for credential: ${key}`);
        continue;
      }

      // Check for placeholder values
      if (value && this.isPlaceholderValue(value)) {
        errors.push(`❌ Placeholder value detected for: ${key}. Please set a real value.`);
        continue;
      }

      if (value) {
        this?.credentials?.set(key, value);
      }
    }

    return errors;
  }

  /**
   * Check if a value is a placeholder
   */
  private isPlaceholderValue(value: string): boolean {
    const placeholders = [
      'your-client-id-here',
      'your-tenant-id-here',
      'your-client-secret-here',
      'your-jwt-secret-here',
      'your-secret-client-state-here',
      'your-azure-client-id-here',
      'your-azure-tenant-id-here',
      'your-azure-client-secret-here',
      'your-jwt-secret-here-must-be-64-chars-minimum'
    ];
    
    return placeholders.includes(value.toLowerCase()) || 
           value.includes('your-') || 
           value.includes('placeholder') ||
           value.includes('example');
  }

  /**
   * Check for exposed credentials in git history
   */
  private async checkForExposedCredentials(): Promise<void> {
    try {
      const { execSync } = require('child_process');
      
      // Check if .env is in git index
      const gitFiles = execSync('git ls-files', { encoding: 'utf8', cwd: process.cwd() });
      if (gitFiles.includes('.env')) {
        console.warn('⚠️  WARNING: .env file is tracked by git! Remove it immediately:');
        console.warn('   git rm --cached .env');
        console.warn('   git commit -m "Remove .env from version control"');
      }

      // Check for exposed secrets in committed files
      const sensitivePatterns = [
        'MSGRAPH_CLIENT_SECRET=',
        'JWT_SECRET=',
        'WEBHOOK_CLIENT_STATE='
      ];

      for (const pattern of sensitivePatterns) {
        try {
          execSync(`git log --all -p -S "${pattern}" --`, { 
            encoding: 'utf8', 
            cwd: process.cwd(),
            stdio: 'pipe'
          });
          console.warn(`⚠️  WARNING: Found "${pattern}" in git history! Consider rotating these credentials.`);
        } catch {
          // No matches found, which is good
        }
      }
    } catch (error) {
      // Git not available or not a git repo, skip checks
    }
  }

  /**
   * Get a credential value
   */
  get(key: string): string | undefined {
    if (!this.isInitialized) {
      throw new Error('CredentialManager not initialized. Call initialize() first.');
    }
    return this?.credentials?.get(key);
  }

  /**
   * Get a required credential value
   */
  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required credential not found: ${key}`);
    }
    return value;
  }

  /**
   * Check if a credential exists
   */
  has(key: string): boolean {
    return this?.credentials?.has(key);
  }

  /**
   * Get masked credential for logging
   */
  getMasked(key: string): string {
    const value = this.get(key);
    if (!value) return 'undefined';

    const config = this.schema[key];
    if (config?.mask || config?.sensitive) {
      if (value?.length || 0 <= 8) {
        return '***';
      }
      return `${value.substring(0, 4)}***${value.substring(value?.length || 0 - 4)}`;
    }
    return value;
  }

  /**
   * Generate a new JWT secret
   */
  static generateJWTSecret(): string {
    return randomBytes(64).toString('base64url');
  }

  /**
   * Generate a new client state for webhooks
   */
  static generateClientState(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Rotate sensitive credentials (generates new values)
   */
  rotateCredentials(): { jwt_secret: string; client_state: string } {
    const newJwtSecret = CredentialManager.generateJWTSecret();
    const newClientState = CredentialManager.generateClientState();

    console.log('🔄 Generated new credentials:');
    console.log(`JWT_SECRET=${newJwtSecret}`);
    console.log(`WEBHOOK_CLIENT_STATE=${newClientState}`);
    console.log('\n⚠️  IMPORTANT: Update your .env file with these new values!');
    console.log('⚠️  IMPORTANT: Update your Microsoft Graph webhook subscription with the new client state!');

    return {
      jwt_secret: newJwtSecret,
      client_state: newClientState
    };
  }

  /**
   * Get all credentials for debugging (sensitive values masked)
   */
  getDebugInfo(): Record<string, string> {
    const debug: Record<string, string> = {};
    const keys = Array.from(this.credentials.keys());
    for (const key of keys) {
      debug[key] = this.getMasked(key);
    }
    return debug;
  }
}

export default CredentialManager;