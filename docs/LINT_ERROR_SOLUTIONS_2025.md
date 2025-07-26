# ESLint Error Solutions Guide (2025)

## Function Type Errors

### Error: "Don't use Function as a type"

**Problem**: The @typescript-eslint/ban-types rule prevents using the generic Function type because it accepts any function-like value and provides no type safety.

**Solutions**:

1. **For Constructor Functions**:

   ```typescript
   // Bad
   toBeInstanceOf(constructor: Function): TestAssertions<T>;

   // Good
   toBeInstanceOf(constructor: new (...args: any[]) => any): TestAssertions<T>;
   ```

2. **For Generic Functions**:

   ```typescript
   // Bad
   handleFunction(func: Function): void;

   // Good - Basic
   handleFunction(func: (...args: any[]) => any): void;

   // Better - Type-safe
   handleFunction(func: (...args: unknown[]) => unknown): void;

   // Best - Specific types
   handleFunction(func: (a: string, b: number) => boolean): void;
   ```

3. **For Callbacks**:

   ```typescript
   // Bad
   callback: Function;

   // Good
   callback: () => void;
   callback: (error: Error  < /dev/null |  null, result?: any) => void;
   ```

## React Unescaped Entities

### Error: "' can be escaped with &apos;, &lsquo;, &#39;, &rsquo;"

**Problem**: React/JSX requires special characters like apostrophes to be escaped to prevent parsing issues.

**Solutions**:

1. **Use HTML Entities** (Recommended):

   ```jsx
   // Bad
   <div>Today's Emails</div>

   // Good
   <div>Today&apos;s Emails</div>
   ```

2. **Use Template Literals**:

   ```jsx
   // Good
   <div>{`Today's Emails`}</div>
   ```

3. **Extract to Variable**:

   ```jsx
   // Good
   const text = "Today's Emails";
   return <div>{text}</div>;
   ```

4. **Disable Rule** (Not Recommended):
   ```json
   // In .eslintrc.json
   {
     "rules": {
       "react/no-unescaped-entities": "off"
     }
   }
   ```

## Import Type Errors

### Error: "All imports in the declaration are only used as types"

**Problem**: TypeScript ESLint wants type-only imports to use import type syntax for better tree-shaking.

**Solutions**:

```typescript
// Bad
import { BaseEntity } from "./BaseRepository";

// Good
import type { BaseEntity } from "./BaseRepository";

// For mixed imports
import { BaseRepository } from "./BaseRepository";
import type { BaseEntity, QueryOptions } from "./BaseRepository";
```

## Debugging ESLint Errors

### Finding the Exact File with Errors

1. **Use JSON Output**:

   ```bash
   npx eslint src --ext .ts,.tsx --format json | jq '.[] | select(.messages[].ruleId == "rule-name") | .filePath'
   ```

2. **Get Detailed Error Info**:

   ```bash
   npx eslint src --ext .ts,.tsx --format compact
   ```

3. **Check Specific Rule**:
   ```bash
   npx eslint src --rule '@typescript-eslint/ban-types: error'
   ```

### Common Gotchas

1. **Line Numbers May Not Match**: ESLint might report errors in different files than expected
2. **Check All Config Files**: Look for .eslintrc.json, .eslintrc.fix.json, etc.
3. **CI May Use Different Config**: GitHub Actions might have different ESLint settings

## TypeScript Build Errors

### Error: "The inferred type cannot be named without a reference to pnpm modules"

**Problem**: TypeScript can't export types that reference pnpm's node_modules structure.

**Solutions**:

1. **Add Explicit Type Annotations**:

   ```typescript
   // Bad
   export const router = Router();

   // Good
   import { Router } from "express";
   export const router: Router = Router();
   ```

2. **Use Type Imports**:

   ```typescript
   import type { Router } from "express";
   ```

3. **Update tsconfig.json**:
   ```json
   {
     "compilerOptions": {
       "declaration": true,
       "declarationMap": true,
       "composite": true
     }
   }
   ```

## Best Practices for 2025

1. **Keep ESLint and TypeScript ESLint Updated**: Use version 6.x or higher
2. **Use Strict Type Checking**: Enable strict: true in tsconfig.json
3. **Prefer Specific Types**: Avoid any, Function, and object types
4. **Enable Recommended Rules**: Use plugin:@typescript-eslint/recommended
5. **Fix Errors, Not Disable Rules**: Only disable rules as a last resort

## Resources

- TypeScript ESLint Rules: https://typescript-eslint.io/rules/
- React ESLint Plugin: https://github.com/jsx-eslint/eslint-plugin-react
- ESLint Configuration: https://eslint.org/docs/latest/use/configure/
