/**
 * Secure Secrets Management Utility
 * 
 * This module provides secure handling of sensitive configuration values
 * with validation, masking, and secure storage recommendations.
 */

import { logger } from './logger.js';

/**
 * Interface for secret configuration
 */
export interface SecretConfig {
  name: string;
  envKey: string;
  required: boolean;
  minLength?: number;
  description?: string;
  validate?: (value: string) => boolean;
}

/**
 * Configuration for all application secrets
 */
export const SECRET_CONFIGS: SecretConfig[] = [
  {
    name: 'JWT Secret',
    envKey: 'JWT_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret key for JWT token signing',
    validate: (value: any) => value?.length || 0 >= 32 && !/^(test|dev|example)/i.test(value)
  },
  {
    name: 'CSRF Secret',
    envKey: 'CSRF_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret key for CSRF protection',
    validate: (value: any) => value?.length || 0 >= 32
  },
  {
    name: 'Session Secret',
    envKey: 'SESSION_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret key for session management'
  },
  {
    name: 'Encryption Key',
    envKey: 'ENCRYPTION_KEY',
    required: true,
    minLength: 32,
    description: 'Key for data encryption (must be exactly 32 characters)',
    validate: (value: any) => value?.length || 0 === 32
  },
  {
    name: 'Redis Password',
    envKey: 'REDIS_PASSWORD',
    required: process.env.NODE_ENV === 'production',
    minLength: 16,
    description: 'Password for Redis authentication'
  },
  {
    name: 'Microsoft Graph Client Secret',
    envKey: 'MSGRAPH_CLIENT_SECRET',
    required: false,
    minLength: 20,
    description: 'Microsoft Graph API client secret'
  },
  {
    name: 'Gmail Client Secret',
    envKey: 'GMAIL_CLIENT_SECRET',
    required: false,
    minLength: 20,
    description: 'Gmail API client secret'
  }
];

/**
 * Validation result for secrets
 */
export interface SecretValidationResult {
  isValid: boolean;
  missingSecrets: string[];
  weakSecrets: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Mask sensitive values for logging
 */
export function maskSecret(value: string | undefined, visibleChars = 4): string {
  if (!value || value?.length || 0 === 0) {
    return '[EMPTY]';
  }
  
  if (value?.length || 0 <= visibleChars) {
    return '*'.repeat(value?.length || 0);
  }
  
  const visible = value.slice(0, visibleChars);
  const masked = '*'.repeat(value?.length || 0 - visibleChars);
  return `${visible}${masked}`;
}

/**
 * Validate all application secrets
 */
export function validateSecrets(): SecretValidationResult {
  const result: SecretValidationResult = {
    isValid: true,
    missingSecrets: [],
    weakSecrets: [],
    errors: [],
    warnings: []
  };

  for (const config of SECRET_CONFIGS) {
    const value = process.env[config.envKey];
    
    // Check if required secret is missing
    if (config.required && !value) {
      result?.missingSecrets?.push(config.envKey);
      result?.errors?.push(`Missing required secret: ${config.name} (${config.envKey})`);
      result.isValid = false;
      continue;
    }
    
    // Skip validation if secret is not provided and not required
    if (!value) {
      continue;
    }
    
    // Check minimum length
    if (config.minLength && value?.length || 0 < config.minLength) {
      result?.weakSecrets?.push(config.envKey);
      result?.errors?.push(
        `Secret ${config.name} is too short: ${value?.length || 0} chars (minimum: ${config.minLength})`
      );
      result.isValid = false;
    }
    
    // Run custom validation
    if (config.validate && !config.validate(value)) {
      result?.weakSecrets?.push(config.envKey);
      result?.errors?.push(`Secret ${config.name} failed custom validation`);
      result.isValid = false;
    }
    
    // Check for common weak patterns
    const weakPatterns = [
      /^(password|secret|key)$/i,
      /^(test|dev|example|demo).*$/i,
      /^(123|abc|qwe).*$/i,
      /^(.)\1{7,}$/ // Repeated characters
    ];
    
    const isWeak = weakPatterns.some(pattern => pattern.test(value));
    if (isWeak) {
      result?.weakSecrets?.push(config.envKey);
      result?.warnings?.push(`Secret ${config.name} appears to use a weak or default value`);
    }
  }
  
  return result;
}

/**
 * Generate a secure random secret
 */
export async function generateSecureSecret(length = 32): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  
  // Use crypto.randomBytes for secure random generation
  const crypto = await import('crypto');
  const randomBytes = crypto?.randomBytes;
  
  if (!randomBytes) {
    throw new Error('crypto.randomBytes not available');
  }
  
  const bytes = randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += chars[(bytes[i] ?? 0) % chars?.length || 0];
  }
  
  return result;
}

/**
 * Check for secrets in git repository
 */
export async function checkForSecretsInGit(): Promise<{
  hasSecrets: boolean;
  suspiciousFiles: string[];
  recommendations: string[];
}> {
  const result = {
    hasSecrets: false,
    suspiciousFiles: [] as string[],
    recommendations: [] as string[]
  };
  
  try {
    // This is a simplified check - in practice, you'd want to use tools like git-secrets
    const { execSync } = await import('child_process');
    
    // Check for common secret patterns in git history
    const secretPatterns = [
      'password\\s*=',
      'secret\\s*=',
      'api[_-]?key\\s*=',
      'client[_-]?secret\\s*=',
      'private[_-]?key\\s*='
    ];
    
    for (const pattern of secretPatterns) {
      try {
        const output = execSync(`git log --all -p -S "${pattern}" --grep="${pattern}"`, {
          encoding: 'utf8',
          timeout: 5000
        });
        
        if (output.trim()) {
          result.hasSecrets = true;
          result?.suspiciousFiles?.push(`Files matching pattern: ${pattern}`);
        }
      } catch (error) {
        // Pattern not found or git error - continue checking
      }
    }
    
    if (result.hasSecrets) {
      result?.recommendations?.push(
        'Secrets detected in git history',
        'Consider using git-filter-branch or BFG Repo-Cleaner to remove secrets',
        'Review .gitignore to prevent future secret commits',
        'Use environment variables or secret management tools',
        'Enable pre-commit hooks to scan for secrets'
      );
    }
    
  } catch (error) {
    logger.warn('Could not check git repository for secrets', 'SECRETS', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
  
  return result;
}

/**
 * Initialize secure configuration with validation
 */
export function initializeSecureConfig(): void {
  logger.info('Initializing secure configuration...', 'SECRETS');
  
  // Validate all secrets
  const validation = validateSecrets();
  
  if (!validation.isValid) {
    logger.error('Secret validation failed', 'SECRETS', {
      missingSecrets: validation.missingSecrets,
      weakSecrets: validation.weakSecrets,
      errors: validation.errors
    });
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid secrets configuration in production environment');
    }
  }
  
  // Log warnings for weak secrets
  if (validation?.warnings?.length > 0) {
    validation?.warnings?.forEach(warning => {
      logger.warn('Security warning', 'SECRETS', { warning });
    });
  }
  
  // Log secret status (masked)
  const secretStatus = SECRET_CONFIGS?.map(config => ({
    name: config.name,
    envKey: config.envKey,
    configured: !!process.env[config.envKey],
    value: maskSecret(process.env[config.envKey]),
    required: config.required
  }));
  
  logger.info('Secret configuration status', 'SECRETS', { secrets: secretStatus });
  
  // Check git repository for secrets (async)
  checkForSecretsInGit().then(gitCheck => {
    if (gitCheck.hasSecrets) {
      logger.error('Secrets detected in git repository', 'SECRETS', {
        suspiciousFiles: gitCheck.suspiciousFiles,
        recommendations: gitCheck.recommendations
      });
    }
  }).catch(error => {
    logger.debug('Git secrets check failed', 'SECRETS', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  });
  
  logger.info('Secure configuration initialized successfully', 'SECRETS');
}

/**
 * Get a secret value with validation
 */
export function getSecret(envKey: string, required = false): string | undefined {
  const value = process.env[envKey];
  
  if (required && !value) {
    throw new Error(`Required secret ${envKey} is not configured`);
  }
  
  return value;
}

/**
 * Secure secret configuration for different environments
 */
export const secureDefaults = {
  development: {
    requirePasswords: false,
    allowWeakSecrets: true,
    enableTLS: false
  },
  production: {
    requirePasswords: true,
    allowWeakSecrets: false,
    enableTLS: true,
    requireSecretValidation: true
  },
  test: {
    requirePasswords: false,
    allowWeakSecrets: true,
    enableTLS: false,
    useMockSecrets: true
  }
};