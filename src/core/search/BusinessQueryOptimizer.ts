/**
 * Business Query Optimizer for GROUP 2B WebSearch Enhancement
 * Implements security best practices and query optimization
 */

import {
  QueryComponents,
  LocationInfo,
  UrgencyLevel,
  TimeConstraint,
  SearchOperator,
  QueryOptimizationResult,
  SecurityFlag,
  ServiceMapping
} from './types';

export class BusinessQueryOptimizer {
  private static readonly DANGEROUS_PATTERNS = [
    // SQL Injection patterns
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script|declare|cast|convert)\b)/gi,
    /(['";]|--|\*|\/\*|\*\/|xp_|sp_)/gi,
    /(0x[0-9a-f]+)/gi, // Hex encoding
    /(\b(char|concat|substring|ascii)\s*\()/gi,
    
    // XSS patterns
    /(<script[^>]*>|<\/script>|javascript:|onerror=|onload=|onclick=)/gi,
    /(document\.|window\.|eval\(|innerHTML|outerHTML)/gi,
    /(%3C|%3E|%22|%27|%2F)/gi, // URL encoded tags
    
    // Path traversal
    /(\.\.\/|\.\.\\|%2e%2e)/gi,
    
    // Command injection
    /([;&|`]|\$\(|\${)/g
  ];

  private static readonly LOCATION_PATTERNS = {
    zipCode: /\b\d{5}(?:-\d{4})?\b/,
    stateAbbr: /\b[A-Z]{2}\b/,
    cityState: /([A-Za-z\s]+),\s*([A-Za-z\s]+)/,
    streetAddress: /\d+\s+[A-Za-z0-9\s,.-]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|plaza|pl)\b/i
  };

  private static readonly TIME_PATTERNS = {
    emergency: /\b(emergency|urgent|immediately|asap|now|right away)\b/i,
    availability: /\b(24\/7|24 hours|open now|weekend|weekday|after hours|holiday)\b/i,
    schedule: /\b(morning|afternoon|evening|night|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  };

  private static readonly SERVICE_MAPPINGS: ServiceMapping[] = [
    {
      category: 'plumbing',
      aliases: ['plumber', 'plumbers', 'plumbing services', 'pipe repair'],
      keywords: ['leak', 'pipe', 'drain', 'water', 'toilet', 'sink', 'faucet'],
      businessIndicators: ['licensed', 'insured', 'emergency service', '24/7']
    },
    {
      category: 'electrical',
      aliases: ['electrician', 'electricians', 'electrical services', 'electrical repair'],
      keywords: ['wiring', 'outlet', 'breaker', 'voltage', 'circuit', 'panel'],
      businessIndicators: ['licensed electrician', 'certified', 'emergency electrical']
    },
    {
      category: 'hvac',
      aliases: ['heating', 'cooling', 'air conditioning', 'ac repair', 'furnace repair'],
      keywords: ['temperature', 'thermostat', 'duct', 'filter', 'refrigerant'],
      businessIndicators: ['EPA certified', 'NATE certified', 'emergency HVAC']
    },
    {
      category: 'roofing',
      aliases: ['roofer', 'roofers', 'roofing services', 'roof repair'],
      keywords: ['shingle', 'leak', 'gutter', 'flashing', 'ventilation'],
      businessIndicators: ['licensed roofer', 'insured', 'free estimates']
    },
    {
      category: 'locksmith',
      aliases: ['lock service', 'key service', 'locksmith services'],
      keywords: ['lock', 'key', 'deadbolt', 'rekey', 'lockout'],
      businessIndicators: ['mobile locksmith', '24 hour', 'emergency locksmith']
    }
  ];

  /**
   * Optimize a natural language query for business search
   */
  public static optimize(query: string): QueryOptimizationResult {
    // Security validation first
    const securityFlags = this.validateSecurity(query);
    if (securityFlags.some(f => f.severity === 'high')) {
      return {
        optimizedQuery: '',
        components: this.createEmptyComponents(query),
        searchSuggestions: [],
        confidence: 0,
        securityFlags
      };
    }

    // Parse query components
    const components = this.parseQuery(query);
    
    // Build optimized query
    const optimizedQuery = this.buildOptimizedQuery(components);
    
    // Generate search suggestions
    const searchSuggestions = this.generateSuggestions(components);
    
    // Calculate confidence score
    const confidence = this.calculateConfidence(components);

    return {
      optimizedQuery,
      components,
      searchSuggestions,
      confidence,
      securityFlags
    };
  }

  /**
   * Validate query for security threats
   */
  private static validateSecurity(query: string): SecurityFlag[] {
    const flags: SecurityFlag[] = [];
    
    for (const pattern of this.DANGEROUS_PATTERNS) {
      const matches = query.match(pattern);
      if (matches) {
        flags.push({
          type: this.getSecurityType(pattern),
          severity: 'high',
          detail: `Dangerous pattern detected: ${matches[0]}`
        });
      }
    }

    // Check for excessive length (potential buffer overflow)
    if (query.length > 500) {
      flags.push({
        type: 'suspicious_pattern',
        severity: 'medium',
        detail: 'Query length exceeds safe limit'
      });
    }

    // Check for repeated characters (potential DOS)
    const repeatedChars = /(.)\1{10,}/;
    if (repeatedChars.test(query)) {
      flags.push({
        type: 'suspicious_pattern',
        severity: 'medium',
        detail: 'Excessive character repetition detected'
      });
    }

    return flags;
  }

  /**
   * Parse query into components
   */
  private static parseQuery(query: string): QueryComponents {
    const cleanQuery = this.sanitizeInput(query);
    
    return {
      serviceType: this.extractServiceType(cleanQuery),
      location: this.extractLocation(cleanQuery),
      urgency: this.extractUrgency(cleanQuery),
      timeConstraints: this.extractTimeConstraints(cleanQuery),
      originalQuery: query,
      expandedTerms: this.expandTerms(cleanQuery),
      businessIndicators: this.extractBusinessIndicators(cleanQuery),
      searchOperators: this.extractSearchOperators(cleanQuery)
    };
  }

  /**
   * Sanitize input to prevent injection attacks
   */
  private static sanitizeInput(input: string): string {
    // Remove control characters
    let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Escape special characters for safe regex use
    sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    return sanitized;
  }

  /**
   * Extract service type from query
   */
  private static extractServiceType(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    for (const mapping of this.SERVICE_MAPPINGS) {
      // Check aliases
      for (const alias of mapping.aliases) {
        if (lowerQuery.includes(alias)) {
          return mapping.category;
        }
      }
      
      // Check keywords
      let keywordCount = 0;
      for (const keyword of mapping.keywords) {
        if (lowerQuery.includes(keyword)) {
          keywordCount++;
        }
      }
      
      if (keywordCount >= 2) {
        return mapping.category;
      }
    }
    
    // Extract potential service from query structure
    const serviceMatch = query.match(/\b([a-z]+(?:ing|er|ist|ice|ices))\b/i);
    return serviceMatch ? serviceMatch[1].toLowerCase() : 'general service';
  }

  /**
   * Extract location information
   */
  private static extractLocation(query: string): LocationInfo {
    const location: LocationInfo = {
      rawLocation: '',
      confidence: 0
    };

    // Check for zip code
    const zipMatch = query.match(this.LOCATION_PATTERNS.zipCode);
    if (zipMatch) {
      location.zipCode = zipMatch[0];
      location.rawLocation = zipMatch[0];
      location.confidence = 0.9;
      return location;
    }

    // Check for city, state pattern
    const cityStateMatch = query.match(this.LOCATION_PATTERNS.cityState);
    if (cityStateMatch) {
      location.city = cityStateMatch[1].trim();
      location.state = cityStateMatch[2].trim();
      location.rawLocation = cityStateMatch[0];
      location.confidence = 0.8;
      
      // Check if state is abbreviation
      if (location.state.length === 2) {
        location.stateAbbr = location.state.toUpperCase();
      }
      
      return location;
    }

    // Check for street address
    const addressMatch = query.match(this.LOCATION_PATTERNS.streetAddress);
    if (addressMatch) {
      location.address = addressMatch[0];
      location.rawLocation = addressMatch[0];
      location.confidence = 0.7;
      return location;
    }

    // Check for "near me" pattern
    if (/\bnear me\b/i.test(query)) {
      location.rawLocation = 'near me';
      location.confidence = 0.5;
      return location;
    }

    // Extract any potential location words
    const locationWords = query.match(/\b(?:in|at|near|around)\s+([A-Za-z\s]+)/i);
    if (locationWords) {
      location.rawLocation = locationWords[1].trim();
      location.confidence = 0.3;
    }

    return location;
  }

  /**
   * Extract urgency level
   */
  private static extractUrgency(query: string): UrgencyLevel {
    if (this.TIME_PATTERNS.emergency.test(query)) {
      return UrgencyLevel.EMERGENCY;
    }
    
    if (/\b(urgent|quickly|fast|hurry)\b/i.test(query)) {
      return UrgencyLevel.URGENT;
    }
    
    return UrgencyLevel.NORMAL;
  }

  /**
   * Extract time constraints
   */
  private static extractTimeConstraints(query: string): TimeConstraint[] {
    const constraints: TimeConstraint[] = [];
    
    // Check availability patterns
    const availMatch = query.match(this.TIME_PATTERNS.availability);
    if (availMatch) {
      const constraint: TimeConstraint = {
        type: 'availability',
        value: availMatch[0]
      };
      
      if (availMatch[0].includes('24/7') || availMatch[0].includes('24 hours')) {
        constraint.parsed = { hours: '24/7' };
      } else if (availMatch[0].includes('open now')) {
        constraint.parsed = { isNow: true };
      } else if (availMatch[0].includes('weekend')) {
        constraint.parsed = { days: ['Saturday', 'Sunday'] };
      }
      
      constraints.push(constraint);
    }
    
    // Check schedule patterns
    const scheduleMatch = query.match(this.TIME_PATTERNS.schedule);
    if (scheduleMatch) {
      constraints.push({
        type: 'schedule',
        value: scheduleMatch[0],
        parsed: this.parseSchedule(scheduleMatch[0])
      });
    }
    
    // Check for immediate needs
    if (this.TIME_PATTERNS.emergency.test(query)) {
      constraints.push({
        type: 'immediate',
        value: 'immediate',
        parsed: { isNow: true }
      });
    }
    
    return constraints;
  }

  /**
   * Parse schedule string
   */
  private static parseSchedule(schedule: string): any {
    const lower = schedule.toLowerCase();
    const parsed: any = {};
    
    // Days of week
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const foundDays = days.filter(day => lower.includes(day));
    if (foundDays.length > 0) {
      parsed.days = foundDays.map(d => d.charAt(0).toUpperCase() + d.slice(1));
    }
    
    // Time of day
    if (/morning/i.test(schedule)) {
      parsed.hours = '6:00 AM - 12:00 PM';
    } else if (/afternoon/i.test(schedule)) {
      parsed.hours = '12:00 PM - 6:00 PM';
    } else if (/evening/i.test(schedule)) {
      parsed.hours = '6:00 PM - 10:00 PM';
    } else if (/night/i.test(schedule)) {
      parsed.hours = '10:00 PM - 6:00 AM';
    }
    
    // Relative days
    if (/today/i.test(schedule)) {
      parsed.isToday = true;
    } else if (/tomorrow/i.test(schedule)) {
      parsed.isTomorrow = true;
    }
    
    return parsed;
  }

  /**
   * Expand search terms with synonyms
   */
  private static expandTerms(query: string): string[] {
    const expanded: string[] = [];
    const serviceType = this.extractServiceType(query);
    
    const mapping = this.SERVICE_MAPPINGS.find(m => m.category === serviceType);
    if (mapping) {
      expanded.push(...mapping.aliases);
      expanded.push(...mapping.keywords);
    }
    
    return [...new Set(expanded)];
  }

  /**
   * Extract business indicators
   */
  private static extractBusinessIndicators(query: string): string[] {
    const indicators: string[] = [];
    const commonIndicators = [
      'phone number',
      'address',
      'hours',
      'reviews',
      'ratings',
      'licensed',
      'insured',
      'certified',
      'professional',
      'reliable',
      'affordable',
      'free estimate',
      'warranty'
    ];
    
    const lowerQuery = query.toLowerCase();
    for (const indicator of commonIndicators) {
      if (lowerQuery.includes(indicator)) {
        indicators.push(indicator);
      }
    }
    
    // Always include basic business info
    if (!indicators.includes('phone number')) indicators.push('phone number');
    if (!indicators.includes('address')) indicators.push('address');
    if (!indicators.includes('hours')) indicators.push('hours');
    
    return indicators;
  }

  /**
   * Extract search operators
   */
  private static extractSearchOperators(query: string): SearchOperator[] {
    const operators: SearchOperator[] = [];
    
    if (/\bnear me\b/i.test(query)) {
      operators.push({ type: 'near' });
    }
    
    if (/\bopen now\b/i.test(query)) {
      operators.push({ type: 'open_now' });
    }
    
    const ratingMatch = query.match(/\b(\d+(?:\.\d+)?)\s*(?:star|rating)/i);
    if (ratingMatch) {
      operators.push({ type: 'rated', value: ratingMatch[1] });
    }
    
    if (/\blicensed\b/i.test(query)) {
      operators.push({ type: 'licensed' });
    }
    
    return operators;
  }

  /**
   * Build optimized search query
   */
  private static buildOptimizedQuery(components: QueryComponents): string {
    const parts: string[] = [];
    
    // Service type
    if (components.serviceType && components.serviceType !== 'general service') {
      parts.push(components.serviceType);
    }
    
    // Location
    if (components.location.rawLocation) {
      if (components.location.rawLocation === 'near me') {
        parts.push('near me');
      } else {
        parts.push(components.location.rawLocation);
      }
    }
    
    // Business indicators
    parts.push(...components.businessIndicators);
    
    // Time constraints
    for (const constraint of components.timeConstraints) {
      if (constraint.type === 'availability' && constraint.parsed?.isNow) {
        parts.push('open now');
      }
    }
    
    // Search operators
    for (const operator of components.searchOperators) {
      if (operator.type === 'rated' && operator.value) {
        parts.push(`${operator.value} star rating`);
      }
    }
    
    return parts.join(' ');
  }

  /**
   * Generate search suggestions
   */
  private static generateSuggestions(components: QueryComponents): string[] {
    const suggestions: string[] = [];
    
    // Base suggestion
    suggestions.push(this.buildOptimizedQuery(components));
    
    // Alternative with expanded terms
    if (components.expandedTerms.length > 0) {
      const altQuery = `${components.expandedTerms[0]} ${components.location.rawLocation} ${components.businessIndicators.join(' ')}`;
      suggestions.push(altQuery.trim());
    }
    
    // Emergency variant
    if (components.urgency === UrgencyLevel.EMERGENCY) {
      suggestions.push(`emergency ${components.serviceType} ${components.location.rawLocation} 24/7`);
    }
    
    // Reviews focused
    suggestions.push(`best ${components.serviceType} ${components.location.rawLocation} reviews ratings`);
    
    return [...new Set(suggestions)].slice(0, 4);
  }

  /**
   * Calculate confidence score
   */
  private static calculateConfidence(components: QueryComponents): number {
    let confidence = 0;
    
    // Service type confidence
    if (components.serviceType && components.serviceType !== 'general service') {
      confidence += 0.3;
    }
    
    // Location confidence
    confidence += components.location.confidence * 0.4;
    
    // Business indicators
    if (components.businessIndicators.length > 3) {
      confidence += 0.2;
    }
    
    // Time constraints
    if (components.timeConstraints.length > 0) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1);
  }

  /**
   * Get security type from pattern
   */
  private static getSecurityType(pattern: RegExp): 'sql_injection' | 'xss' | 'suspicious_pattern' {
    const patternStr = pattern.toString();
    
    if (patternStr.includes('union') || patternStr.includes('select') || patternStr.includes('exec')) {
      return 'sql_injection';
    }
    
    if (patternStr.includes('script') || patternStr.includes('javascript') || patternStr.includes('onerror')) {
      return 'xss';
    }
    
    return 'suspicious_pattern';
  }

  /**
   * Create empty components for rejected queries
   */
  private static createEmptyComponents(originalQuery: string): QueryComponents {
    return {
      serviceType: '',
      location: { rawLocation: '', confidence: 0 },
      urgency: UrgencyLevel.NORMAL,
      timeConstraints: [],
      originalQuery,
      expandedTerms: [],
      businessIndicators: [],
      searchOperators: []
    };
  }
}