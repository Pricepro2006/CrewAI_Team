# Claude Code Templates

This directory contains reusable code templates for JavaScript and TypeScript development. These templates follow best practices and include proper TypeScript types, error handling, and documentation.

## Available Templates

### React Components

1. **react-component-functional.tsx**
   - Basic functional component with TypeScript
   - Props interface with children and className
   - Proper display name
   - Usage: Components that need minimal state

2. **react-component-with-hooks.tsx**
   - Comprehensive hooks usage (useState, useEffect, useCallback, useMemo, useRef)
   - Form handling with validation
   - Loading and error states
   - Cleanup on unmount
   - Usage: Complex interactive components

3. **react-context-provider.tsx**
   - Context API implementation
   - Custom hook for consuming context
   - HOC for legacy component support
   - Type-safe context value
   - Usage: Global state management

4. **react-custom-hook.ts**
   - Custom hook pattern with TypeScript
   - Async data fetching with abort controller
   - Debouncing support
   - Memory leak prevention
   - Usage: Reusable logic extraction

### API & Backend

5. **typescript-api-endpoint.ts**
   - Express endpoint with Zod validation
   - Async error handling
   - Request/Response typing
   - CRUD operations
   - Usage: RESTful API endpoints

6. **express-router.ts**
   - Complete Express router setup
   - Middleware integration
   - Swagger documentation
   - Rate limiting and caching
   - Usage: API route modules

7. **trpc-router.ts**
   - tRPC router implementation
   - Type-safe procedures
   - Input validation with Zod
   - Error handling with TRPCError
   - Usage: Type-safe API with tRPC

### Services & Utilities

8. **typescript-service-class.ts**
   - Singleton service pattern
   - Event emitter integration
   - Retry logic and caching
   - Initialization lifecycle
   - Usage: Business logic services

9. **nodejs-module.js**
   - CommonJS module pattern
   - EventEmitter-based
   - Configuration management
   - Cache with TTL
   - Usage: Node.js modules

10. **utility-functions.ts**
    - Common utility functions
    - Type helpers
    - Async utilities (retry, timeout, batch)
    - Object manipulation
    - Usage: Shared utilities

### Types & Testing

11. **typescript-interface-types.ts**
    - Comprehensive type definitions
    - Enums and type guards
    - Input/Output types
    - Utility types
    - Usage: Shared type definitions

12. **jest-test-suite.ts**
    - Jest test suite structure
    - Mock setup and cleanup
    - Different test categories
    - Performance and snapshot tests
    - Usage: Unit and integration tests

## How to Use

1. Copy the template file you need
2. Replace placeholder variables:
   - `{{ComponentName}}`, `{{ModuleName}}`, etc. - Main entity name
   - `{{componentName}}`, `{{moduleName}}`, etc. - camelCase version
   - `{{ComponentDescription}}`, `{{ModuleDescription}}`, etc. - Description
   - `{{endpoint-path}}`, `{{module-path}}`, etc. - Path references

3. Customize the template for your specific needs

## Template Variables

Common placeholder patterns used across templates:

- `{{EntityName}}` - PascalCase name (e.g., UserProfile)
- `{{entityName}}` - camelCase name (e.g., userProfile)
- `{{entity-name}}` - kebab-case name (e.g., user-profile)
- `{{ENTITY_NAME}}` - UPPER_SNAKE_CASE (e.g., USER_PROFILE)
- `{{Description}}` - Human-readable description
- `{{path}}` - File or URL path

## Best Practices

All templates follow these principles:

1. **TypeScript First** - Strong typing throughout
2. **Error Handling** - Proper error boundaries and handling
3. **Documentation** - JSDoc comments and examples
4. **Testing Ready** - Structured for easy testing
5. **Performance** - Optimized patterns (memoization, cleanup)
6. **Accessibility** - ARIA attributes where applicable
7. **Security** - Input validation and sanitization

## Contributing

To add a new template:

1. Create the template file in this directory
2. Use consistent placeholder patterns
3. Include comprehensive comments
4. Add an entry to this README
5. Test the template in a real project

## Memory Usage Error Fix

Based on the error message you're seeing:
```
❌ Error recorded: memory_threshold - Memory usage exceeded threshold: 891MB
```

This indicates your application is consuming too much memory. Here are the solutions:

### 1. **Increase Memory Limits**
```javascript
// In your cache configuration
const MEMORY_THRESHOLD = 1024 * 1024 * 1024; // 1GB instead of ~891MB
const MAX_CACHE_SIZE = 1000; // Reduce from current limit
const CACHE_EVICTION_BATCH = 200; // Increase eviction batch size
```

### 2. **Implement Aggressive Cache Management**
```javascript
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.memoryThreshold = 800 * 1024 * 1024; // 800MB safety limit
    this.checkInterval = 60000; // Check every minute
    
    // Start periodic cleanup
    this.startMemoryMonitoring();
  }
  
  startMemoryMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      if (usage.heapUsed > this.memoryThreshold) {
        this.aggressiveCleanup();
      }
    }, this.checkInterval);
  }
  
  aggressiveCleanup() {
    // Sort by last access time and remove oldest 50%
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    const toRemove = Math.floor(entries.length * 0.5);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}
```

### 3. **Use Memory-Efficient Data Structures**
```javascript
// Instead of storing full objects, store compressed or encoded versions
class EfficientCache {
  set(key, value) {
    // Compress large objects
    const compressed = this.compress(value);
    super.set(key, compressed);
  }
  
  get(key) {
    const compressed = super.get(key);
    return compressed ? this.decompress(compressed) : null;
  }
  
  compress(obj) {
    // Use zlib or similar for compression
    return zlib.gzipSync(JSON.stringify(obj));
  }
  
  decompress(buffer) {
    return JSON.parse(zlib.gunzipSync(buffer).toString());
  }
}
```

### 4. **Implement Cache Partitioning**
```javascript
// Split cache into multiple smaller caches
class PartitionedCache {
  constructor(partitions = 4) {
    this.partitions = Array(partitions).fill(null).map(() => new Map());
  }
  
  getPartition(key) {
    const hash = this.hashCode(key);
    return this.partitions[Math.abs(hash) % this.partitions.length];
  }
  
  set(key, value) {
    const partition = this.getPartition(key);
    
    // Check partition size before adding
    if (partition.size > 100) {
      this.evictFromPartition(partition);
    }
    
    partition.set(key, value);
  }
}
```

### 5. **Node.js Memory Configuration**
```bash
# Increase Node.js heap size
node --max-old-space-size=2048 your-app.js

# Or in package.json
"scripts": {
  "start": "node --max-old-space-size=2048 dist/api/server.js"
}
```

### 6. **Implement TTL-based Eviction**
```javascript
class TTLCache {
  constructor(defaultTTL = 300000) { // 5 minutes
    this.cache = new Map();
    this.timers = new Map();
    this.defaultTTL = defaultTTL;
  }
  
  set(key, value, ttl = this.defaultTTL) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    // Set new value
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl
    });
    
    // Set eviction timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
  }
}
```

The main issue appears to be that your cache is growing without bounds. Implement one or more of these solutions to keep memory usage under control.