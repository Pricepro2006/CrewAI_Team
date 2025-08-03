/**
 * PII Redactor Utility
 * Automatically detects and redacts personally identifiable information from logs
 * Based on security review recommendations
 */

export class PIIRedactor {
  // Patterns for detecting various types of PII
  private static readonly PII_PATTERNS = {
    // Email addresses
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    
    // Phone numbers (various formats)
    phoneUS: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    phoneIntl: /\b\+[0-9]{1,3}[-.\s]?[0-9]{1,15}\b/g,
    
    // Social Security Numbers
    ssn: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    
    // Credit card numbers (basic pattern - real validation would be more complex)
    creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    
    // IP addresses
    ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    ipv6: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,
    
    // Driver's license patterns (common US states)
    driversLicense: /\b[A-Z]{1,2}\d{6,8}\b/g,
    
    // Passport numbers
    passport: /\b[A-Z][0-9]{8}\b/g,
    
    // Bank account numbers (basic pattern)
    bankAccount: /\b\d{8,17}\b/g,
    
    // API keys and tokens (common patterns)
    apiKey: /\b[A-Za-z0-9_-]{32,}\b/g,
    bearerToken: /Bearer\s+[A-Za-z0-9_\-.]+/gi,
    
    // Addresses (street address pattern)
    streetAddress: /\b\d{1,5}\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/gi,
    
    // ZIP codes
    zipCode: /\b\d{5}(?:-\d{4})?\b/g,
  };

  // Configuration options
  private config: PIIRedactorConfig;

  constructor(config: Partial<PIIRedactorConfig> = {}) {
    this.config = {
      redactEmails: true,
      redactPhones: true,
      redactSSN: true,
      redactCreditCards: true,
      redactIPs: true,
      redactAddresses: true,
      redactAPIKeys: true,
      redactBankInfo: true,
      customPatterns: [],
      replacementText: "[REDACTED]",
      preservePartial: false,
      ...config,
    };
  }

  /**
   * Redact PII from a string
   */
  redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let redacted = text;

    // Apply standard PII patterns
    if (this.config.redactEmails) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.email, 'EMAIL');
    }

    if (this.config.redactPhones) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.phoneUS, 'PHONE');
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.phoneIntl, 'PHONE');
    }

    if (this.config.redactSSN) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.ssn, 'SSN');
    }

    if (this.config.redactCreditCards) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.creditCard, 'CC');
    }

    if (this.config.redactIPs) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.ipv4, 'IP');
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.ipv6, 'IP');
    }

    if (this.config.redactAddresses) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.streetAddress, 'ADDRESS');
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.zipCode, 'ZIP');
    }

    if (this.config.redactAPIKeys) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.apiKey, 'API_KEY');
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.bearerToken, 'TOKEN');
    }

    if (this.config.redactBankInfo) {
      redacted = this.redactPattern(redacted, PIIRedactor.PII_PATTERNS.bankAccount, 'BANK_ACCOUNT');
    }

    // Apply custom patterns
    for (const pattern of this.config.customPatterns) {
      redacted = this.redactPattern(redacted, pattern.regex, pattern.label);
    }

    return redacted;
  }

  /**
   * Redact PII from an object (deep redaction)
   */
  redactObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redact(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    if (typeof obj === 'object') {
      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Redact sensitive keys entirely
        if (this.isSensitiveKey(key)) {
          redacted[key] = '[REDACTED_VALUE]';
        } else {
          redacted[key] = this.redactObject(value);
        }
      }
      return redacted;
    }

    return obj;
  }

  /**
   * Check if a key name suggests sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeyPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /auth/i,
      /credential/i,
      /ssn/i,
      /social[_-]?security/i,
      /credit[_-]?card/i,
      /cvv/i,
      /pin/i,
      /private[_-]?key/i,
    ];

    return sensitiveKeyPatterns.some(pattern => pattern.test(key));
  }

  /**
   * Apply a redaction pattern to text
   */
  private redactPattern(text: string, pattern: RegExp, label: string): string {
    return text.replace(pattern, (match) => {
      if (this.config.preservePartial && match.length > 4) {
        // Preserve first and last few characters
        const preserveLength = Math.min(2, Math.floor(match.length / 4));
        const start = match.substring(0, preserveLength);
        const end = match.substring(match.length - preserveLength);
        return `${start}[${label}]${end}`;
      }
      return `[${label}]`;
    });
  }

  /**
   * Detect if text contains PII (without redacting)
   */
  containsPII(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    for (const [, pattern] of Object.entries(PIIRedactor.PII_PATTERNS)) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get types of PII found in text
   */
  detectPIITypes(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const detectedTypes: string[] = [];

    const checks = [
      { pattern: PIIRedactor.PII_PATTERNS.email, type: 'email' },
      { pattern: PIIRedactor.PII_PATTERNS.phoneUS, type: 'phone' },
      { pattern: PIIRedactor.PII_PATTERNS.phoneIntl, type: 'phone' },
      { pattern: PIIRedactor.PII_PATTERNS.ssn, type: 'ssn' },
      { pattern: PIIRedactor.PII_PATTERNS.creditCard, type: 'credit_card' },
      { pattern: PIIRedactor.PII_PATTERNS.ipv4, type: 'ip_address' },
      { pattern: PIIRedactor.PII_PATTERNS.ipv6, type: 'ip_address' },
      { pattern: PIIRedactor.PII_PATTERNS.streetAddress, type: 'address' },
      { pattern: PIIRedactor.PII_PATTERNS.apiKey, type: 'api_key' },
    ];

    for (const check of checks) {
      if (check.pattern.test(text)) {
        if (!detectedTypes.includes(check.type)) {
          detectedTypes.push(check.type);
        }
      }
    }

    return detectedTypes;
  }
}

// Configuration interface
export interface PIIRedactorConfig {
  redactEmails: boolean;
  redactPhones: boolean;
  redactSSN: boolean;
  redactCreditCards: boolean;
  redactIPs: boolean;
  redactAddresses: boolean;
  redactAPIKeys: boolean;
  redactBankInfo: boolean;
  customPatterns: Array<{ regex: RegExp; label: string }>;
  replacementText: string;
  preservePartial: boolean;
}

// Export singleton instance with default configuration
export const piiRedactor = new PIIRedactor();

// Export function for custom configurations
export function createPIIRedactor(config?: Partial<PIIRedactorConfig>): PIIRedactor {
  return new PIIRedactor(config);
}