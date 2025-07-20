import { describe, it, expect, beforeEach } from 'vitest';
import { BusinessResponseValidator } from '../BusinessResponseValidator.js';

describe('BusinessResponseValidator', () => {
  let validator: BusinessResponseValidator;

  beforeEach(() => {
    validator = new BusinessResponseValidator();
  });

  describe('Phone Number Extraction', () => {
    it('should extract US phone numbers in various formats', () => {
      const text = `
        Call us at (555) 123-4567 or 555.987.6543
        Toll free: 1-800-555-1234
        Mobile: +1 555 234 5678
        Office: 555-876-5432 ext. 123
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.phones).toHaveLength(5);
      expect(result.contactInfo.phones[0].type).toBe('tollFree');
      expect(result.contactInfo.phones.some(p => p.value.includes('ext'))).toBe(true);
    });

    it('should extract international phone numbers', () => {
      const text = `
        UK: +44 20 7123 4567
        Germany: +49 30 12345678
        Australia: +61 2 9876 5432
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.phones).toHaveLength(3);
      expect(result.contactInfo.phones.every(p => p.type === 'international')).toBe(true);
    });

    it('should handle edge cases in phone numbers', () => {
      const text = `
        Partial: 123-4567 (local number)
        No dashes: 5551234567
        With parentheses: (555)1234567
        Dots: 555.123.4567
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.phones.length).toBeGreaterThan(0);
      expect(result.contactInfo.phones[0].normalized).toMatch(/^\d+$/);
    });

    it('should mask phone numbers in privacy mode', () => {
      const privacyValidator = new BusinessResponseValidator({ privacyMode: true });
      const text = 'Call us at 555-123-4567';

      const result = privacyValidator.validateResponse(text);
      
      expect(result.contactInfo.phones[0].value).toContain('XXXX4567');
      expect(result.contactInfo.phones[0].normalized).toContain('XXXX4567');
    });
  });

  describe('Address Extraction', () => {
    it('should extract complete US addresses', () => {
      const text = `
        Visit us at 123 Main Street, Suite 100, New York, NY 10001
        Secondary location: 456 Oak Avenue, Los Angeles, CA 90012
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.addresses).toHaveLength(2);
      expect(result.contactInfo.addresses[0].street).toContain('Main Street');
      expect(result.contactInfo.addresses[0].city).toBe('New York');
      expect(result.contactInfo.addresses[0].state).toBe('NY');
      expect(result.contactInfo.addresses[0].zip).toBe('10001');
    });

    it('should extract PO Box addresses', () => {
      const text = `
        Mail to: P.O. Box 1234, Seattle, WA 98101
        Alternative: PO Box 5678, Portland, OR 97201
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.addresses).toHaveLength(2);
      expect(result.contactInfo.addresses.every(a => a.type === 'poBox')).toBe(true);
    });

    it('should handle address variations', () => {
      const text = `
        123 Main St., Apt 4B, Boston, MA 02101
        456 Elm Road Unit 12, Chicago, IL 60601
        789 Park Blvd #5, Houston, TX 77001-1234
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.addresses.length).toBeGreaterThan(0);
      expect(result.contactInfo.addresses[0].value).toContain('Apt');
    });
  });

  describe('Business Name Extraction', () => {
    it('should extract business names with entity types', () => {
      const text = `
        Contact ABC Corporation for more info.
        XYZ Services LLC handles all inquiries.
        Tech Solutions Inc. is our partner.
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.businessNames).toHaveLength(3);
      expect(result.contactInfo.businessNames.every(b => b.hasEntityType)).toBe(true);
      expect(result.contactInfo.businessNames[0].confidence).toBeGreaterThan(0.7);
    });

    it('should extract standalone business names', () => {
      const text = `
        Visit Joe's Pizza for the best slice.
        Green Gardens Landscaping offers great service.
        Contact Blue Sky Travel today.
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.businessNames.length).toBeGreaterThan(0);
    });

    it('should handle business names with special characters', () => {
      const text = `
        Smith & Jones Associates
        O'Brien's Irish Pub
        21st Century Tech Co.
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.businessNames.length).toBeGreaterThan(0);
      expect(result.contactInfo.businessNames.some(b => b.value.includes('&'))).toBe(true);
    });
  });

  describe('Business Hours Extraction', () => {
    it('should extract standard hours', () => {
      const text = `
        Open Monday-Friday 9am-5pm
        Saturday: 10:00am - 3:00pm
        Sunday: Closed
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.hours.length).toBeGreaterThan(0);
      expect(result.contactInfo.hours.some(h => h.type === 'standard')).toBe(true);
    });

    it('should detect 24/7 operations', () => {
      const text = `
        We're open 24/7 for your convenience.
        Emergency service available twenty-four seven.
        Around the clock support.
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.hours.some(h => h.type === '24/7')).toBe(true);
    });

    it('should extract day ranges', () => {
      const text = `
        Open Mon-Fri
        Weekend hours: Sat-Sun
        Closed Monday-Wednesday
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.hours.some(h => h.type === 'dayRange')).toBe(true);
    });
  });

  describe('Email and Website Extraction', () => {
    it('should extract email addresses', () => {
      const text = `
        Email us at info@example.com
        Support: support@company.co.uk
        sales@business.org
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.emails).toHaveLength(3);
      expect(result.contactInfo.emails[0].domain).toBe('example.com');
    });

    it('should extract websites', () => {
      const text = `
        Visit https://www.example.com
        More info at http://company.org
        https://secure.business.net/contact
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.websites).toHaveLength(3);
      expect(result.contactInfo.websites[0].protocol).toBe('https:');
    });
  });

  describe('Validation Results', () => {
    it('should correctly identify actionable information', () => {
      const textWithInfo = 'Call 555-123-4567 or visit 123 Main St, City, ST 12345';
      const textWithoutInfo = 'For more information, please contact us.';

      const resultWithInfo = validator.validateResponse(textWithInfo);
      const resultWithoutInfo = validator.validateResponse(textWithoutInfo);

      expect(resultWithInfo.hasActionableInfo).toBe(true);
      expect(resultWithoutInfo.hasActionableInfo).toBe(false);
    });

    it('should identify missing information', () => {
      const text = 'ABC Company is located at 123 Main St.';
      const result = validator.validateResponse(text);

      expect(result.missingInfo).toContain('phone');
      expect(result.missingInfo).toContain('hours');
      expect(result.missingInfo).toContain('online contact');
    });

    it('should provide helpful suggestions', () => {
      const text = 'Contact us for more information.';
      const result = validator.validateResponse(text);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('phone'))).toBe(true);
    });

    it('should calculate confidence scores correctly', () => {
      const highConfidenceText = `
        ABC Corporation
        123 Main Street, Suite 100, New York, NY 10001
        Phone: (555) 123-4567
        Email: info@abccorp.com
        Hours: Mon-Fri 9am-5pm
      `;

      const lowConfidenceText = `
        Some Company
        Somewhere on Main
        Call us
      `;

      const highResult = validator.validateResponse(highConfidenceText);
      const lowResult = validator.validateResponse(lowConfidenceText);

      expect(highResult.confidence).toBeGreaterThan(0.7);
      expect(lowResult.confidence).toBeLessThan(0.5);
    });
  });

  describe('False Positive Prevention', () => {
    it('should not extract invalid phone numbers', () => {
      const text = `
        Order #1234567890
        ZIP: 12345
        Year: 2024
        Price: $999.99
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.phones).toHaveLength(0);
    });

    it('should not extract non-address numbers as addresses', () => {
      const text = `
        Product ID: 123 Special Edition
        Version 456 Released
        789 units sold
      `;

      const result = validator.validateResponse(text);
      
      expect(result.contactInfo.addresses).toHaveLength(0);
    });

    it('should not extract common words as business names', () => {
      const text = `
        The Quick Brown Fox
        This Is A Test
        New York Times
      `;

      const result = validator.validateResponse(text);
      
      // Should only extract "New York Times" as it's a proper business name
      expect(result.contactInfo.businessNames.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance', () => {
    it('should handle large text efficiently', () => {
      const largeText = Array(1000).fill('Call 555-123-4567 or visit 123 Main St.').join(' ');
      
      const startTime = Date.now();
      const result = validator.validateResponse(largeText);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      expect(result.contactInfo.phones.length).toBeGreaterThan(0);
    });

    it('should deduplicate effectively', () => {
      const text = `
        Call 555-123-4567
        Phone: (555) 123-4567
        Contact: 555.123.4567
        Tel: +1 555 123 4567
      `;

      const result = validator.validateResponse(text);
      
      // Should recognize these as the same number
      expect(result.contactInfo.phones.length).toBeLessThanOrEqual(2);
    });
  });
});