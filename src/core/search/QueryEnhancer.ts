/**
 * Query Enhancement Module for GROUP 2B WebSearch Enhancement
 * Integrates location correction, service expansion, and operator application
 */

import { 
  QueryComponents, 
  QueryOptimizationResult,
  UrgencyLevel 
} from './types';
import { BusinessQueryOptimizer } from './BusinessQueryOptimizer';
import { LocationDatabase } from './data/locationDatabase';

export interface EnhancedQuery {
  primary: string;
  alternatives: string[];
  metadata: {
    hasLocation: boolean;
    hasTimeConstraint: boolean;
    serviceCategory: string;
    urgencyLevel: UrgencyLevel;
    searchOperators: string[];
  };
}

export class QueryEnhancer {
  /**
   * Enhance a query with location correction and service expansion
   */
  public static enhance(query: string): EnhancedQuery {
    // Get optimized components
    const optimization = BusinessQueryOptimizer.optimize(query);
    
    // Return empty result if security issues detected
    if (optimization.confidence === 0 && optimization.securityFlags.length > 0) {
      return this.createEmptyEnhancement();
    }
    
    // Enhance location
    const enhancedLocation = this.enhanceLocation(optimization.components.location);
    
    // Enhance service terms
    const enhancedService = this.enhanceService(
      optimization.components.serviceType,
      enhancedLocation.region
    );
    
    // Build enhanced queries
    const enhancedQueries = this.buildEnhancedQueries(
      optimization.components,
      enhancedLocation,
      enhancedService
    );
    
    return {
      primary: enhancedQueries[0] || '',
      alternatives: enhancedQueries.slice(1),
      metadata: {
        hasLocation: !!enhancedLocation.corrected,
        hasTimeConstraint: optimization.components.timeConstraints.length > 0,
        serviceCategory: optimization.components.serviceType,
        urgencyLevel: optimization.components.urgency,
        searchOperators: optimization.components.searchOperators.map(op => op.type)
      }
    };
  }

  /**
   * Enhance location with corrections and metadata
   */
  private static enhanceLocation(location: any): any {
    if (!location.rawLocation) {
      return { ...location, corrected: '', region: 'National' };
    }
    
    // Handle "near me" specially
    if (location.rawLocation.toLowerCase() === 'near me') {
      return { 
        ...location, 
        corrected: 'near me',
        region: 'National',
        requiresGeolocation: true
      };
    }
    
    // Correct city names
    const cityCorrection = LocationDatabase.correctLocation(location.city || location.rawLocation);
    
    // Get state info
    let state = location.state;
    let stateAbbr = location.stateAbbr;
    
    if (!stateAbbr && state) {
      stateAbbr = LocationDatabase.getStateAbbreviation(state);
    }
    
    // Determine region
    const region = state ? LocationDatabase.getRegionFromState(state) : 'National';
    
    // Build corrected location string
    let corrected = '';
    if (location.address) {
      corrected = location.address;
    } else if (location.zipCode) {
      corrected = location.zipCode;
    } else if (cityCorrection.confidence > 0.7) {
      corrected = cityCorrection.corrected;
      if (stateAbbr) {
        corrected += `, ${stateAbbr}`;
      }
    } else {
      corrected = location.rawLocation;
    }
    
    // Get city metadata if available
    const metadata = LocationDatabase.getCityMetadata(cityCorrection.corrected);
    
    return {
      ...location,
      corrected,
      region,
      cityMetadata: metadata,
      correctionConfidence: cityCorrection.confidence
    };
  }

  /**
   * Enhance service terms with regional variations
   */
  private static enhanceService(serviceType: string, region: string): string[] {
    const regionalTerms = LocationDatabase.getRegionalTerms(region, serviceType);
    
    // Add common business qualifiers
    const qualifiers = ['professional', 'licensed', 'certified', 'local', 'best'];
    const enhanced: string[] = [];
    
    // Base terms
    enhanced.push(...regionalTerms);
    
    // Add qualified versions
    for (const term of regionalTerms.slice(0, 2)) {
      for (const qualifier of qualifiers.slice(0, 2)) {
        enhanced.push(`${qualifier} ${term}`);
      }
    }
    
    return [...new Set(enhanced)];
  }

  /**
   * Build multiple enhanced query variations
   */
  private static buildEnhancedQueries(
    components: QueryComponents,
    enhancedLocation: any,
    enhancedService: string[]
  ): string[] {
    const queries: string[] = [];
    
    // Primary query - most specific
    const primaryParts: string[] = [];
    
    // Add service (use first enhanced term)
    if (enhancedService.length > 0) {
      primaryParts.push(enhancedService[0]);
    }
    
    // Add location
    if (enhancedLocation.corrected) {
      primaryParts.push(enhancedLocation.corrected);
    }
    
    // Add urgency modifiers
    if (components.urgency === UrgencyLevel.EMERGENCY) {
      primaryParts.unshift('emergency');
    }
    
    // Add time constraints
    for (const constraint of components.timeConstraints) {
      if (constraint.type === 'availability' && constraint.parsed?.isNow) {
        primaryParts.push('open now');
      } else if (constraint.value.includes('24/7')) {
        primaryParts.push('24/7 available');
      }
    }
    
    // Add business indicators
    primaryParts.push(...components.businessIndicators);
    
    queries.push(primaryParts.join(' '));
    
    // Alternative queries
    // Version with expanded location
    if (enhancedLocation.cityMetadata?.state) {
      const altQuery = `${enhancedService[0]} ${enhancedLocation.corrected}, ${enhancedLocation.cityMetadata.state} ${components.businessIndicators.join(' ')}`;
      queries.push(altQuery.trim());
    }
    
    // Version with different service terms
    for (let i = 1; i < Math.min(enhancedService.length, 3); i++) {
      const altQuery = `${enhancedService[i]} ${enhancedLocation.corrected} ${components.businessIndicators.join(' ')}`;
      queries.push(altQuery.trim());
    }
    
    // Version focused on reviews
    queries.push(`best rated ${components.serviceType} ${enhancedLocation.corrected} reviews ratings`);
    
    // Version with search operators
    for (const operator of components.searchOperators) {
      if (operator.type === 'near' && enhancedLocation.corrected) {
        queries.push(`${components.serviceType} near ${enhancedLocation.corrected}`);
      } else if (operator.type === 'rated' && operator.value) {
        queries.push(`${operator.value} star ${components.serviceType} ${enhancedLocation.corrected}`);
      }
    }
    
    // Remove duplicates and empty strings
    return [...new Set(queries.filter(q => q.trim().length > 0))];
  }

  /**
   * Create empty enhancement for security-flagged queries
   */
  private static createEmptyEnhancement(): EnhancedQuery {
    return {
      primary: '',
      alternatives: [],
      metadata: {
        hasLocation: false,
        hasTimeConstraint: false,
        serviceCategory: '',
        urgencyLevel: UrgencyLevel.NORMAL,
        searchOperators: []
      }
    };
  }

  /**
   * Format query for specific search engines
   */
  public static formatForSearchEngine(query: string, engine: 'google' | 'bing' | 'ddg'): string {
    // Common formatting
    let formatted = query.trim();
    
    switch (engine) {
      case 'google':
        // Google-specific operators
        if (formatted.includes('near me')) {
          formatted = formatted.replace('near me', '');
          formatted += ' near me';
        }
        // Add quotes for exact phrases
        if (formatted.includes('phone number')) {
          formatted = formatted.replace('phone number', '"phone number"');
        }
        break;
        
      case 'bing':
        // Bing-specific formatting
        if (formatted.includes('open now')) {
          formatted = formatted.replace('open now', '');
          formatted += ' +hours:"open now"';
        }
        break;
        
      case 'ddg':
        // DuckDuckGo formatting
        // DDG uses ! for exact match
        if (formatted.includes('reviews')) {
          formatted = formatted.replace('reviews', '!reviews');
        }
        break;
    }
    
    return formatted;
  }

  /**
   * Generate structured query for APIs
   */
  public static generateStructuredQuery(components: QueryComponents): any {
    return {
      what: components.serviceType,
      where: {
        city: components.location.city,
        state: components.location.state,
        zipCode: components.location.zipCode,
        coordinates: components.location.coordinates
      },
      when: components.timeConstraints.map(tc => ({
        type: tc.type,
        value: tc.value,
        parsed: tc.parsed
      })),
      filters: {
        urgency: components.urgency,
        operators: components.searchOperators,
        businessInfo: components.businessIndicators
      }
    };
  }
}