# TypeScript Error Resolution Guide

## Common TypeScript Errors and Solutions

### 1. Module Not Found Errors

**Error**: `Cannot find module 'socket.io' or its corresponding type declarations`

**Solution**:
1. Install the module and its types:
   ```bash
   npm install socket.io @types/socket.io
   ```
2. If installation fails due to compilation issues, create mock types:
   ```typescript
   // src/types/socket.io-mock.d.ts
   declare module 'socket.io' {
     export interface Server {
       on(event: string, listener: Function): void;
       emit(event: string, ...args: any[]): void;
     }
     export interface Socket {
       id: string;
       handshake: any;
       on(event: string, listener: Function): void;
       emit(event: string, ...args: any[]): void;
       join(room: string): void;
       leave(room: string): void;
     }
   }
   ```

### 2. Type Mismatch Errors

**Error**: Complex types vs simple types (e.g., `ProductPrice` object vs `number`)

**Solution**: Create UI types and adapters
```typescript
// UI Types
export interface UIProduct {
  price: number; // Simple type for UI
}

// Adapter
export class ProductAdapter {
  static toUI(product: Product): UIProduct {
    return {
      price: typeof product.price === 'number' 
        ? product.price 
        : product.price.amount
    };
  }
}
```

### 3. Window Object in Node.js

**Error**: `Cannot find name 'window'`

**Solution**: Check environment and use appropriate globals
```typescript
// Check if in browser
const isBrowser = typeof window !== 'undefined';

// Use conditional logic
if (isBrowser) {
  window.addEventListener('error', handler);
}
```

### 4. Missing Exports

**Error**: `Module has no exported member 'X'`

**Solution**: Ensure proper exports
```typescript
// Wrong
class MyClass { }

// Right
export class MyClass { }
export type { MyType } from './types';
```

### 5. Type-Only Imports with verbatimModuleSyntax

**Error**: `'X' is a type and must be imported using a type-only import`

**Solution**: Use type imports
```typescript
// Wrong
import { MyType } from './types';

// Right
import type { MyType } from './types';
```

### 6. Function Parameter Issues

**Error**: `Expected X arguments, but got Y`

**Solution**: Make parameters optional or provide defaults
```typescript
// Wrong
function greet(name: string, age: number) { }
greet("John"); // Error

// Right
function greet(name: string, age?: number) { }
// OR
function greet(name: string, age: number = 0) { }
```

### 7. Union Type Handling

**Problem**: Need to handle union types properly

**Solution**: Use type guards
```typescript
function getPrice(price: number | ProductPrice): number {
  if (typeof price === 'number') {
    return price;
  }
  return price.amount;
}
```

### 8. Test File Issues

**Error**: Missing test dependencies

**Solution**: 
1. Install test dependencies:
   ```bash
   npm install --save-dev @types/jest supertest @types/supertest
   ```
2. Or skip tests requiring unavailable dependencies:
   ```typescript
   describe.skip('Integration tests', () => {
     // Tests that require supertest
   });
   ```

### 9. Circular Dependencies

**Error**: Circular dependency detected

**Solution**: 
1. Use lazy imports
2. Restructure code to avoid circular references
3. Use interfaces instead of concrete types

### 10. Build Configuration Issues

**Error**: `Option 'project' cannot be mixed with source files`

**Solution**: Check TypeScript command and npm scripts
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.json"
  }
}
```

## Python distutils Issue

**Error**: `ModuleNotFoundError: No module named 'distutils'`

**Context**: Occurs when installing packages that require compilation (e.g., better-sqlite3)

**Solutions**:
1. Install Python distutils:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install python3-distutils
   
   # macOS
   brew install python-setuptools
   ```

2. Use Node.js version with prebuilt binaries:
   ```bash
   nvm use 20.11.0  # LTS version with better compatibility
   ```

3. Skip optional dependencies:
   ```bash
   npm install --omit=optional
   ```

## Best Practices

1. **Enable Strict Mode**: Use `"strict": true` in tsconfig.json
2. **Use Type Guards**: Properly narrow union types
3. **Avoid `any`**: Use `unknown` when type is truly unknown
4. **Type Imports**: Use `import type` for type-only imports
5. **Check Environment**: Handle browser vs Node.js differences
6. **Mock Missing Types**: Create `.d.ts` files for untyped modules
7. **Use Adapters**: Transform between complex domain types and simple UI types

## Debugging TypeScript Errors

1. **Check Actual Error Count**:
   ```bash
   npx tsc --noEmit 2>&1 | grep -E "error TS[0-9]+" | wc -l
   ```

2. **List All Errors**:
   ```bash
   npx tsc --noEmit
   ```

3. **Check Why File Included**:
   ```bash
   npx tsc --explainFiles
   ```

4. **Check Module Resolution**:
   ```bash
   npx tsc --traceResolution
   ```

5. **Fix Incrementally**: Start with the simplest errors first

## Common Patterns

### UI Type Pattern
```typescript
// Domain type (complex)
interface Product {
  price: { amount: number; currency: string };
}

// UI type (simple)
interface UIProduct {
  price: number;
  priceFormatted: string;
}

// Adapter
function toUIProduct(product: Product): UIProduct {
  return {
    price: product.price.amount,
    priceFormatted: `$${product.price.amount.toFixed(2)}`
  };
}
```

### Mock Pattern for Missing Modules
```typescript
// When you can't install a module, mock it
declare module 'missing-module' {
  export function doSomething(): void;
  export class SomeClass {
    method(): string;
  }
}
```

### Environment Check Pattern
```typescript
// utils/environment.ts
export const isBrowser = typeof window !== 'undefined';
export const isNode = typeof process !== 'undefined' && process.versions?.node;

// Usage
import { isBrowser } from './utils/environment';

if (isBrowser) {
  // Browser-specific code
} else {
  // Node.js-specific code
}
```