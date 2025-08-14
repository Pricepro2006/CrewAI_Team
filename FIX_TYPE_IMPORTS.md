# Type-Only Import Fixes Needed

## Files that need `import type` fixes (TS1484)

Based on the error analysis, these imports need to be changed to type-only imports:

### Express Types
```bash
# Files importing Express types
grep -r "import.*Express.*from 'express'" src/ --include="*.ts" --include="*.tsx"
```

**Fix Pattern:**
```typescript
// ❌ Before
import { Request, Response, NextFunction, Express } from 'express';

// ✅ After  
import type { Request, Response, NextFunction, Express } from 'express';
```

### Files to Fix:
1. `src/api/examples/redis-queue-integration.ts`
2. `src/api/examples/unified-cache-setup.ts`
3. All files in `src/api/middleware/`
4. All files in `src/api/routes/`

### tRPC Types
```bash
# Files importing tRPC types
grep -r "import.*from '@trpc" src/ --include="*.ts" --include="*.tsx"
```

**Fix Pattern:**
```typescript
// ❌ Before
import { inferAsyncReturnType } from '@trpc/server';

// ✅ After
import type { inferAsyncReturnType } from '@trpc/server';
```

### Database Types
```bash
# Files importing Database types
grep -r "import.*Database.*from" src/ --include="*.ts" --include="*.tsx"
```

**Fix Pattern:**
```typescript
// ❌ Before
import { Database } from 'better-sqlite3';

// ✅ After
import type { Database } from 'better-sqlite3';
// For the constructor, import separately:
import BetterSqlite3 from 'better-sqlite3';
```

## Manual Fix Instructions

### Step 1: Fix Express imports
```bash
# Open each file and change imports
code src/api/examples/redis-queue-integration.ts
code src/api/examples/unified-cache-setup.ts
```

### Step 2: Fix all middleware files
```bash
# List all middleware files
ls -la src/api/middleware/*.ts

# Open each and fix imports
```

### Step 3: Check progress
```bash
# Count remaining TS1484 errors
npx tsc --noEmit 2>&1 | grep "TS1484" | wc -l
```

## Common Type Import Patterns

### Pattern 1: Express Middleware
```typescript
// ✅ Correct way
import type { Request, Response, NextFunction } from 'express';

export const middleware = (req: Request, res: Response, next: NextFunction) => {
  // ...
};
```

### Pattern 2: tRPC Context
```typescript
// ✅ Correct way
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import type { inferAsyncReturnType } from '@trpc/server';

export const createContext = ({ req, res }: CreateExpressContextOptions) => {
  // ...
};

export type Context = inferAsyncReturnType<typeof createContext>;
```

### Pattern 3: Database Types
```typescript
// ✅ Correct way
import type { Database } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';

let db: Database;

export function initDatabase(): void {
  db = new BetterSqlite3('./data/app.db');
}
```

## Verification

After fixing, verify with:
```bash
# Should show 0 TS1484 errors
npx tsc --noEmit 2>&1 | grep "TS1484" | wc -l

# Check specific file
npx tsc --noEmit src/api/examples/redis-queue-integration.ts 2>&1
```

## Files Priority List (Fix in this order)

1. **High Priority (Core functionality)**
   - [ ] src/api/server.ts
   - [ ] src/api/trpc/trpc.router.ts
   - [ ] src/database/connection.ts
   - [ ] src/api/middleware/auth.ts

2. **Medium Priority (Features)**
   - [ ] src/api/middleware/cacheMiddleware.ts
   - [ ] src/api/routes/*.ts
   - [ ] src/ui/hooks/*.ts

3. **Low Priority (Examples/Tests)**
   - [ ] src/api/examples/*.ts
   - [ ] src/scripts/*.ts

## Expected Impact

Fixing these type-only imports should resolve approximately:
- 136 TS1484 errors
- Improve compilation speed
- Make the codebase more maintainable

---

**Note:** Do NOT use automated tools. Open each file in VS Code and manually review each import to ensure it's correctly classified as a type-only or runtime import.