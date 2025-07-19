/**
 * Query Optimization Examples for GROUP 2B WebSearch Enhancement
 * Demonstrates various query optimization scenarios
 */

import { QueryEnhancer, BusinessQueryOptimizer, LocationDatabase } from '../index';

// Example queries to test
const exampleQueries = [
  // Basic service queries
  "plumber near me",
  "emergency plumber in Philidelphia",
  "24/7 electrician Los Angelos CA",
  "weekend HVAC repair service Denver Colorado",
  
  // Complex queries with multiple components
  "licensed roofer in Pheonix AZ open now with good reviews",
  "affordable locksmith service 90210 available today",
  "best rated plumbing services in Cincinatti Ohio",
  
  // Queries with security concerns (should be flagged)
  "plumber' OR 1=1--",
  "electrician <script>alert('xss')</script>",
  "hvac service'; DROP TABLE users;--",
  
  // Queries with time constraints
  "urgent water leak repair Boston MA",
  "emergency electrical service available right now Chicago",
  "furnace repair tomorrow morning Minneapolis",
  
  // Queries with location variations
  "ac repair Alberquerque New Mexico",
  "heating service in N.Y.C.",
  "locksmith SF California",
  
  // Regional queries
  "fontanero cerca de mi", // Spanish for plumber
  "best techador in Phoenix", // Spanish for roofer
];

console.log("=== Query Optimization Examples ===\n");

// Process each example query
exampleQueries.forEach((query, index) => {
  console.log(`\n--- Example ${index + 1} ---`);
  console.log(`Original Query: "${query}"`);
  
  // Run optimization
  const optimizationResult = BusinessQueryOptimizer.optimize(query);
  
  // Check for security issues
  if (optimizationResult.securityFlags.length > 0) {
    console.log("\n⚠️  SECURITY ISSUES DETECTED:");
    optimizationResult.securityFlags.forEach(flag => {
      console.log(`  - [${flag.severity.toUpperCase()}] ${flag.type}: ${flag.detail}`);
    });
    console.log("\nQuery rejected for security reasons.\n");
    continue;
  }
  
  // Run enhancement
  const enhanced = QueryEnhancer.enhance(query);
  
  console.log("\nOptimization Results:");
  console.log(`  Service Type: ${optimizationResult.components.serviceType}`);
  console.log(`  Location: ${optimizationResult.components.location.rawLocation || 'Not specified'}`);
  console.log(`  Urgency: ${optimizationResult.components.urgency}`);
  console.log(`  Confidence: ${(optimizationResult.confidence * 100).toFixed(0)}%`);
  
  if (optimizationResult.components.location.city) {
    const correction = LocationDatabase.correctLocation(optimizationResult.components.location.city);
    if (correction.corrected !== optimizationResult.components.location.city) {
      console.log(`  Location Correction: ${optimizationResult.components.location.city} → ${correction.corrected}`);
    }
  }
  
  console.log("\nEnhanced Queries:");
  console.log(`  Primary: "${enhanced.primary}"`);
  if (enhanced.alternatives.length > 0) {
    console.log("  Alternatives:");
    enhanced.alternatives.forEach((alt, i) => {
      console.log(`    ${i + 1}. "${alt}"`);
    });
  }
  
  console.log("\nMetadata:");
  console.log(`  Has Location: ${enhanced.metadata.hasLocation}`);
  console.log(`  Has Time Constraint: ${enhanced.metadata.hasTimeConstraint}`);
  console.log(`  Service Category: ${enhanced.metadata.serviceCategory}`);
  console.log(`  Search Operators: ${enhanced.metadata.searchOperators.join(', ') || 'None'}`);
  
  // Format for different search engines
  console.log("\nSearch Engine Formatting:");
  console.log(`  Google: "${QueryEnhancer.formatForSearchEngine(enhanced.primary, 'google')}"`);
  console.log(`  Bing: "${QueryEnhancer.formatForSearchEngine(enhanced.primary, 'bing')}"`);
  console.log(`  DuckDuckGo: "${QueryEnhancer.formatForSearchEngine(enhanced.primary, 'ddg')}"`);
});

// Demonstrate location database features
console.log("\n\n=== Location Database Examples ===\n");

const locationExamples = [
  "Philidelphia",
  "Los Angelos",
  "Cincinatti",
  "Alberquerque",
  "N.Y.C.",
  "SF"
];

locationExamples.forEach(location => {
  const correction = LocationDatabase.correctLocation(location);
  console.log(`"${location}" → "${correction.corrected}" (confidence: ${(correction.confidence * 100).toFixed(0)}%)`);
  
  const metadata = LocationDatabase.getCityMetadata(correction.corrected);
  if (metadata) {
    console.log(`  State: ${metadata.state}, Population: ${metadata.population?.toLocaleString()}`);
  }
});

// Demonstrate state abbreviations
console.log("\n\n=== State Abbreviation Examples ===\n");

const stateExamples = ["California", "New York", "Texas", "Penn", "Mass"];
stateExamples.forEach(state => {
  const abbr = LocationDatabase.getStateAbbreviation(state);
  console.log(`"${state}" → ${abbr || 'Not found'}`);
});

// Demonstrate regional service terminology
console.log("\n\n=== Regional Service Terminology ===\n");

const regions = ['Northeast', 'South', 'Midwest', 'West', 'Southwest'];
const service = 'plumbing';

regions.forEach(region => {
  const terms = LocationDatabase.getRegionalTerms(region, service);
  console.log(`${region} terms for "${service}": ${terms.join(', ')}`);
});

// Performance test
console.log("\n\n=== Performance Test ===\n");

const startTime = Date.now();
const iterations = 1000;

for (let i = 0; i < iterations; i++) {
  const query = exampleQueries[i % exampleQueries.length];
  BusinessQueryOptimizer.optimize(query);
  QueryEnhancer.enhance(query);
}

const endTime = Date.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`Processed ${iterations} queries in ${endTime - startTime}ms`);
console.log(`Average time per query: ${avgTime.toFixed(2)}ms`);

// Export some example functions for testing
export function optimizeQuery(query: string) {
  return BusinessQueryOptimizer.optimize(query);
}

export function enhanceQuery(query: string) {
  return QueryEnhancer.enhance(query);
}

export function correctLocation(location: string) {
  return LocationDatabase.correctLocation(location);
}