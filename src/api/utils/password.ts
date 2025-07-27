import bcrypt from 'bcrypt';
import crypto from 'crypto';

/**
 * Password Utilities for Secure Authentication
 * Provides functions for hashing, verifying, and validating passwords
 */

export class PasswordManager {
  private readonly saltRounds: number;
  private readonly minPasswordLength: number;

  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    this.minPasswordLength = parseInt(process.env.MIN_PASSWORD_LENGTH || '8');
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    if (!password) {
      throw new Error('Password is required');
    }

    if (password.length < this.minPasswordLength) {
      throw new Error(`Password must be at least ${this.minPasswordLength} characters long`);
    }

    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
    strength: 'weak' | 'medium' | 'strong';
  } {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < this.minPasswordLength) {
      errors.push(`Password must be at least ${this.minPasswordLength} characters long`);
    } else if (password.length >= 12) {
      score += 2;
    } else if (password.length >= 8) {
      score += 1;
    }

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);

    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (!hasSpecialChars) {
      errors.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    // Common pattern checks
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password should not contain repeating characters');
      score -= 1;
    }

    if (/123|abc|qwe|password|admin/i.test(password)) {
      errors.push('Password should not contain common patterns');
      score -= 2;
    }

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong';
    if (score >= 6) {
      strength = 'strong';
    } else if (score >= 4) {
      strength = 'medium';
    } else {
      strength = 'weak';
    }

    // If there are validation errors, it's automatically weak
    if (errors.length > 0) {
      strength = 'weak';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = lowercase + uppercase + numbers + specialChars;
    
    let password = '';
    
    // Ensure at least one character from each category
    password += this.getRandomChar(lowercase);
    password += this.getRandomChar(uppercase);
    password += this.getRandomChar(numbers);
    password += this.getRandomChar(specialChars);
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += this.getRandomChar(allChars);
    }
    
    // Shuffle the password
    return this.shuffleString(password);
  }

  /**
   * Generate a temporary password for password reset
   */
  generateTemporaryPassword(): string {
    return this.generateSecurePassword(12);
  }

  /**
   * Check if a password has been compromised (basic implementation)
   * In a real-world scenario, you might want to check against HaveIBeenPwned API
   */
  isPasswordCompromised(password: string): boolean {
    const commonPasswords = [
      'password', '123456', '123456789', '12345678', '12345',
      'qwerty', 'abc123', 'password123', 'admin', 'letmein',
      'welcome', 'monkey', '1234567890', 'Password1', 'password1'
    ];

    return commonPasswords.some(common => 
      password.toLowerCase().includes(common.toLowerCase())
    );
  }

  /**
   * Calculate password entropy (bits of entropy)
   */
  calculatePasswordEntropy(password: string): number {
    let characterSpace = 0;
    
    if (/[a-z]/.test(password)) characterSpace += 26;
    if (/[A-Z]/.test(password)) characterSpace += 26;
    if (/\d/.test(password)) characterSpace += 10;
    if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)) characterSpace += 32;
    
    return Math.log2(Math.pow(characterSpace, password.length));
  }

  /**
   * Get a random character from a string
   */
  private getRandomChar(chars: string): string {
    const randomIndex = crypto.randomInt(0, chars.length);
    return chars[randomIndex];
  }

  /**
   * Shuffle a string randomly
   */
  private shuffleString(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }
}

// Export singleton instance
export const passwordManager = new PasswordManager();