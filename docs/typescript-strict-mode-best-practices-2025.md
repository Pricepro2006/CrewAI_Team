# TypeScript Strict Mode Best Practices 2025

## Overview

This document outlines best practices for handling TypeScript strict mode errors, particularly focusing on undefined type errors and modern solutions using optional chaining and nullish coalescing.

## Key TypeScript Strict Mode Flags

### Essential Compiler Options
```json
{
  "compilerOptions": {
    "strict": true,                           // Enable all strict type-checking options
    "noImplicitAny": true,                   // Error on expressions with implicit 'any'
    "strictNullChecks": true,                // Enable strict null checking
    "strictFunctionTypes": true,             // Enable strict checking of function types
    "strictBindCallApply": true,             // Enable strict bind/call/apply methods
    "strictPropertyInitialization": true,    // Ensure class properties are initialized
    "noImplicitThis": true,                  // Error on 'this' expressions with implicit 'any'
    "alwaysStrict": true,                    // Ensure 'use strict' in all files
    "noUnusedLocals": true,                  // Report errors on unused locals
    "noUnusedParameters": true,              // Report errors on unused parameters
    "noImplicitReturns": true,               // Report error when not all code paths return
    "noFallthroughCasesInSwitch": true,     // Report errors for fallthrough cases
    "noUncheckedIndexedAccess": true,       // Include 'undefined' in index signature results
    "noImplicitOverride": true,              // Ensure 'override' modifier is used
    "useUnknownInCatchVariables": true      // Default catch variables to 'unknown' instead of 'any'
  }
}
```

## Common Undefined Type Errors and Solutions

### 1. Object is Possibly 'undefined'

**Problem:**
```typescript
// Error: Object is possibly 'undefined'
const name = user.profile.name;
```

**Solution using Optional Chaining:**
```typescript
const name = user?.profile?.name; // Returns undefined if any part is null/undefined
```

### 2. Type 'undefined' is not assignable to type 'string'

**Problem:**
```typescript
// Error: Type 'string | undefined' is not assignable to type 'string'
const displayName: string = user?.name;
```

**Solution using Nullish Coalescing:**
```typescript
const displayName: string = user?.name ?? 'Guest';
```

### 3. Array Element Access

**Problem:**
```typescript
// Error: Object is possibly 'undefined'
const firstItem = items[0].name;
```

**Solution:**
```typescript
const firstItem = items?.[0]?.name;
// or with fallback
const firstItem = items?.[0]?.name ?? 'No item';
```

### 4. Function Calls on Possibly Undefined Objects

**Problem:**
```typescript
// Error: Cannot invoke an object which is possibly 'undefined'
result.callback();
```

**Solution:**
```typescript
result?.callback?.();
```

## Advanced Patterns

### 1. Type Guards for Complex Checks

```typescript
function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Usage
if (isDefined(data.value)) {
  // TypeScript knows data.value is not undefined/null here
  console.log(data.value.toString());
}
```

### 2. Non-null Assertion Operator (use sparingly)

```typescript
// Only use when you're absolutely certain the value exists
const element = document.getElementById('my-element')!; // ! tells TS it's not null
```

### 3. Combining Multiple Fallbacks

```typescript
const config = userConfig ?? defaultConfig ?? fallbackConfig ?? {};
```

## Best Practices for 2025

1. **Always enable strictNullChecks**: This catches most null/undefined errors at compile time
2. **Prefer optional chaining over nested if statements**: Cleaner and more readable
3. **Use nullish coalescing for defaults**: More predictable than || operator
4. **Avoid overusing non-null assertions (!)**: They bypass TypeScript's safety checks
5. **Use type guards for complex scenarios**: Better than type assertions
6. **Initialize class properties**: Either in declaration or constructor

## Common Patterns in Our Codebase

### Handling Chart.js Data
```typescript
// Instead of:
const dataset = chartData.datasets[0];
const status = dataset.statusKeys[index];

// Use:
const dataset = chartData.datasets?.[0];
const status = dataset?.statusKeys?.[index];
if (status !== undefined) {
  // Safe to use status
}
```

### Handling Event Handlers
```typescript
// Instead of:
onChange={value => handleChange('field', value)}

// Use explicit types:
onChange={(value: string | undefined) => handleChange('field', value ?? '')}
```

### Handling API Responses
```typescript
// Type your API responses
interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Use with optional chaining
const userData = response?.data?.user;
const username = userData?.name ?? 'Anonymous';
```

## Migration Strategy

1. Enable strict mode flags incrementally
2. Fix errors by file or module
3. Use `// @ts-expect-error` temporarily for complex fixes
4. Write tests to ensure behavior remains correct
5. Remove temporary suppressions once all related code is updated

## Tools and Resources

- TypeScript 5.x Documentation: https://www.typescriptlang.org/docs/
- ESLint with TypeScript: Helps enforce best practices
- ts-strict-ignore: Tool for gradually enabling strict mode
- TypeScript Playground: Test strict mode behavior online