/**
 * Contact Information Validation Patterns
 * Comprehensive regex patterns for extracting business contact information
 */

export const ContactPatterns = {
  // Phone Number Patterns
  phone: {
    // US Phone Numbers
    usStandard: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})(?:\s?(?:ext|x|extension)\.?\s?(\d+))?/gi,
    
    // International Phone Numbers
    international: /\+(?:[0-9][-.\s]?){6,14}[0-9]/g,
    
    // Toll-free numbers
    tollFree: /1[-.\s]?(?:800|888|877|866|855|844|833)[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/gi,
    
    // Generic phone pattern (catches most formats)
    generic: /(?:(?:\+?[1-9]{1,3}[-.\s]?)?(?:\([0-9]{1,4}\)|[0-9]{1,4})[-.\s]?)?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}/g,
    
    // Confidence scoring based on format
    getConfidence: (match: string): number => {
      if (match.match(/^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/)) return 0.95;
      if (match.match(/^\+[0-9]{1,3}[-.\s]?/)) return 0.85;
      if (match.length >= 10 && match.length <= 15) return 0.7;
      return 0.5;
    }
  },

  // Address Patterns
  address: {
    // Street address with number
    streetAddress: /\b(\d{1,5})\s+([A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl|Parkway|Pkwy|Highway|Hwy|Way))\.?\b/gi,
    
    // PO Box
    poBox: /(?:P\.?O\.?\s*Box|Post\s*Office\s*Box)\s*\d+/gi,
    
    // Suite/Apartment/Unit
    unit: /(?:Suite|Ste|Apt|Apartment|Unit|#)\s*[A-Za-z0-9]+/gi,
    
    // City, State, Zip
    cityStateZip: /\b([A-Za-z\s]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)\b/g,
    
    // Full address pattern
    fullAddress: /\d{1,5}\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl)\.?\s*(?:Suite|Ste|Apt|Unit|#)?\s*[A-Za-z0-9]*,?\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?/gi,
    
    // International addresses (more flexible)
    international: /\d{1,5}\s+[A-Za-z0-9\s,.-]+(?:\d{4,6})?/gi
  },

  // Business Hours Patterns
  hours: {
    // Standard hours format (9-5, 9am-5pm, etc.)
    standard: /\b(?:(\d{1,2})(?::(\d{2}))?(?:\s*(?:am|AM|pm|PM))?)\s*[-–—]\s*(?:(\d{1,2})(?::(\d{2}))?(?:\s*(?:am|AM|pm|PM))?)\b/g,
    
    // Day ranges (Mon-Fri, Monday-Friday)
    dayRange: /\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*[-–—]\s*(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\b/gi,
    
    // 24/7 variations
    twentyFourSeven: /\b(?:24\/7|24\s*hours|twenty[\s-]?four\s*seven|around\s*the\s*clock)\b/gi,
    
    // Closed days
    closed: /\b(?:closed\s*(?:on\s*)?(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?s?))\b/gi,
    
    // Full hours pattern
    fullHours: /(?:(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*[-–—:]?\s*)?(?:\d{1,2}(?::\d{2})?\s*(?:am|AM|pm|PM)?)\s*[-–—]\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|AM|pm|PM)?)/gi
  },

  // Business Name Patterns
  businessName: {
    // Common business entity types
    entityTypes: /\b(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co|LLP|LP|Partners|Associates|Group|Services|Solutions|Enterprises|Holdings|Industries)\b\.?/gi,
    
    // Business name with entity type
    withEntity: /\b[A-Z][A-Za-z0-9\s&'.-]+(?:Inc|LLC|Ltd|Corp|Corporation|Company|Co|LLP|LP)\.?\b/g,
    
    // Standalone business names (capitalized words)
    standalone: /\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)*\b/g,
    
    // Business names with special characters
    withSpecialChars: /\b[A-Z][A-Za-z0-9\s&'.-]+[A-Za-z0-9]\b/g
  },

  // Email Patterns
  email: {
    standard: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    withName: /(?:[A-Za-z\s]+\s*<)?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,})>?/gi
  },

  // Website Patterns
  website: {
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi,
    domain: /(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}/gi
  }
};

// Helper functions for pattern matching
export const PatternHelpers = {
  /**
   * Extract all matches for a pattern with confidence scores
   */
  extractMatches: (text: string, pattern: RegExp, confidenceFunc?: (match: string) => number) => {
    const matches: Array<{ value: string; confidence: number; index: number }> = [];
    let match;
    
    // Reset the regex to ensure we start from the beginning
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0].trim();
      const confidence = confidenceFunc ? confidenceFunc(value) : 0.8;
      matches.push({
        value,
        confidence,
        index: match.index
      });
    }
    
    return matches;
  },

  /**
   * Clean and normalize phone numbers
   */
  normalizePhone: (phone: string): string => {
    return phone.replace(/[^\d+]/g, '');
  },

  /**
   * Clean and normalize addresses
   */
  normalizeAddress: (address: string): string => {
    return address
      .replace(/\s+/g, ' ')
      .replace(/\./g, '')
      .trim();
  },

  /**
   * Validate and score business names
   */
  scoreBusinessName: (name: string): number => {
    let score = 0.5;
    
    // Higher score for entity types
    if (name.match(ContactPatterns.businessName.entityTypes)) score += 0.3;
    
    // Higher score for proper capitalization
    if (name.match(/^[A-Z]/)) score += 0.1;
    
    // Lower score for all caps (might be heading)
    if (name === name.toUpperCase()) score -= 0.2;
    
    // Higher score for reasonable length
    if (name.length >= 3 && name.length <= 50) score += 0.1;
    
    return Math.max(0, Math.min(1, score));
  }
};

// Pattern validation rules
export const ValidationRules = {
  phone: {
    minLength: 10,
    maxLength: 20,
    requiredDigits: 7
  },
  address: {
    minLength: 10,
    maxLength: 200,
    requiredComponents: ['number', 'street']
  },
  businessName: {
    minLength: 2,
    maxLength: 100,
    minWords: 1
  },
  hours: {
    minLength: 3,
    maxLength: 100
  }
};