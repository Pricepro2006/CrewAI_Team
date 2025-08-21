# TypeScript 'any' Type Migration Plan

## Current State (August 3, 2025)
- 100 ESLint warnings for `@typescript-eslint/no-explicit-any`
- Production email pipeline working well
- Pre-commit hooks causing development friction

## Immediate Actions (Now)

### 1. Switch to Development Mode
```bash
./scripts/toggle-lint-staged.sh dev
```
This allows existing warnings while preventing new ones.

### 2. Fix Memory Issues
```bash
# Clear TypeScript cache
rm -f .tsbuildinfo.precommit

# Use optimized lint-staged config
cp .lintstagedrc.optimized.json .lintstagedrc.json
```

### 3. Create Type Definition Files
For frequently used 'any' types, create proper type definitions:

```typescript
// src/types/common.ts
export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type JsonObject = Record<string, unknown>;
export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
```

## Short-term Strategy (Next Sprint)

### Phase 1: Critical Path Types (Week 1)
Focus on production-critical files:
- Email processing pipeline types
- API route handlers
- Database query results
- WebSocket event types

### Phase 2: Gradual Migration (Week 2-3)
1. Group similar 'any' warnings by type
2. Create shared type definitions
3. Fix 10-15 warnings per day
4. Use `unknown` instead of `any` for truly dynamic types

### Phase 3: Enforcement (Week 4)
1. Switch rule from "warn" to "error" for new files only:
```json
{
  "overrides": [
    {
      "files": ["src/**/*.new.ts", "src/**/*.new.tsx"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "error"
      }
    }
  ]
}
```

## Long-term Strategy

### 1. Type Coverage Goals
- Month 1: Reduce to 50 warnings
- Month 2: Reduce to 25 warnings
- Month 3: Zero warnings, switch to strict mode

### 2. Tooling Improvements
- Add type coverage reporting
- Create custom ESLint rules for common patterns
- Set up incremental type checking in CI

### 3. Team Practices
- Code review emphasis on new 'any' types
- Type definition documentation
- Regular type debt reduction sessions

## Type Priority Matrix

| Priority | File Pattern | Reason |
|----------|-------------|---------|
| High | `src/api/services/*` | Production services |
| High | `src/core/processors/*` | Email processing |
| Medium | `src/api/routes/*` | API endpoints |
| Medium | `src/database/*` | Data integrity |
| Low | `src/ui/components/*` | UI flexibility |
| Low | `scripts/*` | Development tools |

## Common 'any' Patterns to Fix

1. **Event Handlers**
   ```typescript
   // Before
   onClick: (e: any) => void
   
   // After
   onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
   ```

2. **API Responses**
   ```typescript
   // Before
   const response: any = await fetch()
   
   // After
   const response: ApiResponse<UserData> = await fetch()
   ```

3. **Dynamic Objects**
   ```typescript
   // Before
   const config: any = {}
   
   // After
   const config: Record<string, unknown> = {}
   ```

## Monitoring Progress

Track progress with:
```bash
# Count current warnings
npx eslint src --ext .ts,.tsx | grep "no-explicit-any" | wc -l

# Generate type coverage report
npx type-coverage --detail
```

## Conclusion

This gradual approach allows us to:
1. Continue shipping features without friction
2. Improve type safety incrementally
3. Avoid introducing bugs in working code
4. Build team consensus on type patterns

Remember: The goal is better code quality, not perfect TypeScript overnight.