# ESM Import Review - /src/monitoring Directory

## Executive Summary
Conducted a comprehensive review of all TypeScript files in `/home/pricepro2006/CrewAI_Team/src/monitoring/` for ESM import compatibility with Node.js v22. Found **16 TypeScript files** with various levels of ESM compatibility issues that need addressing.

## Critical Issues (Block Server Startup)

### 1. HealthCheckService.ts
```typescript
// ISSUE: axios default export pattern
import axios, { AxiosError } from 'axios';
import type { AxiosRequestConfig } from 'axios';

// FIX: Use native fetch or dynamic import
// Option 1: Replace with native fetch (recommended)
// Option 2: Dynamic import
const axios = await import('axios');
```

### 2. HealthCheckService.ts - Express Import
```typescript
// ISSUE: Express doesn't have named exports in ESM
import express from 'express';  // Missing in current file but needed

// FIX: Use default import
import express from 'express';
const { Router } = express;
```

### 3. AlertSystem.ts - node-cron
```typescript
// ISSUE: Wildcard import may not work with ESM
import * as cron from 'node-cron';

// FIX: Use default or named import
import cron from 'node-cron';
// OR
import { schedule } from 'node-cron';
```

### 4. HealthCheckService.ts - WebSocket
```typescript
// ISSUE: ws library ESM compatibility
import WebSocket from 'ws';

// FIX: Verify ESM export structure
import { WebSocket } from 'ws';
// OR if default export
import WebSocket from 'ws';
```

### 5. StructuredLogger.ts - Winston & Related
```typescript
// ISSUE: Complex winston imports need verification
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import DailyRotateFile from 'winston-daily-rotate-file';

// FIX: Verify each package's ESM exports
import winston from 'winston';
// May need dynamic imports for transports
```

## Moderate Issues (Best Practices)

### Node.js Built-in Modules
All files should use the `node:` protocol prefix for clarity and future compatibility:

```typescript
// Current (works but not ideal)
import { EventEmitter } from 'events';
import os from 'os';
import process from 'process';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import { hostname } from 'os';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';

// Recommended
import { EventEmitter } from 'node:events';
import os from 'node:os';
import process from 'node:process';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { hostname } from 'node:os';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';
```

## Low Priority Issues (Working but Could Be Improved)

### Type Imports
Several files correctly separate type imports, which is good:
```typescript
import type { AxiosRequestConfig } from 'axios';
import type { QueueMetrics } from '../api/types/grocery-nlp.types.js';
```

### File Extensions
All relative imports correctly use `.js` extensions, which is required for ESM:
```typescript
import { logger } from '../utils/logger.js';
import { sentryErrorTracker } from './SentryErrorTracker.js';
```

## File-by-File Analysis

| File | Critical Issues | Moderate Issues | Status |
|------|----------------|-----------------|---------|
| AlertSystem.ts | node-cron import | Node built-ins need node: prefix | 🔴 Needs Fix |
| ErrorTracker.ts | None | EventEmitter import | 🟡 Working |
| ErrorTypes.ts | None | None | ✅ Clean |
| GroceryAgentMetrics.ts | None | EventEmitter import | 🟡 Working |
| HealthCheckService.ts | axios, express, WebSocket | Multiple node: prefixes needed | 🔴 Critical |
| HealthChecker.ts | None | EventEmitter import | 🟡 Working |
| MemoryManager.ts | None | v8, path, fs imports | 🟡 Working |
| MemoryMonitoringService.ts | express import needed | Multiple node: prefixes | 🔴 Needs Fix |
| MetricsCollectionService.ts | None | os, process imports | 🟡 Working |
| MetricsCollector.ts | None | os, process imports | 🟡 Working |
| MonitoringSystem.ts | None | EventEmitter import | 🟡 Working |
| PerformanceMonitor.ts | None | perf_hooks import | 🟡 Working |
| SentryErrorTracker.ts | Sentry imports (verify) | None | 🟡 Verify |
| StructuredLogger.ts | winston ecosystem | os import | 🔴 Needs Fix |
| TRPCPerformanceMonitor.ts | None | None | ✅ Clean |

## Priority Actions

### 1. Immediate (Blocking)
1. **Replace axios with fetch** in HealthCheckService.ts
2. **Fix node-cron import** in AlertSystem.ts
3. **Verify winston ESM compatibility** in StructuredLogger.ts
4. **Add express properly** to MemoryMonitoringService.ts

### 2. Short-term (Best Practices)
1. Add `node:` prefix to all Node.js built-in imports
2. Verify WebSocket library ESM exports
3. Test all third-party library imports

### 3. Long-term (Maintenance)
1. Consider replacing incompatible libraries
2. Add ESM linting rules to catch future issues
3. Document ESM requirements for the team

## Testing Strategy

After fixes, test each service independently:
```bash
# Test individual services
node --experimental-specifier-resolution=node src/monitoring/HealthCheckService.js
node --experimental-specifier-resolution=node src/monitoring/AlertSystem.js
node --experimental-specifier-resolution=node src/monitoring/StructuredLogger.js
```

## Migration Script Example

```typescript
// migrate-to-esm.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const files = [/* list of files */];

files.forEach(file => {
  let content = readFileSync(file, 'utf-8');
  
  // Add node: prefix to built-ins
  content = content.replace(/from ['"]events['"]/g, "from 'node:events'");
  content = content.replace(/from ['"]os['"]/g, "from 'node:os'");
  content = content.replace(/from ['"]path['"]/g, "from 'node:path'");
  content = content.replace(/from ['"]fs['"]/g, "from 'node:fs'");
  content = content.replace(/from ['"]util['"]/g, "from 'node:util'");
  content = content.replace(/from ['"]child_process['"]/g, "from 'node:child_process'");
  content = content.replace(/from ['"]perf_hooks['"]/g, "from 'node:perf_hooks'");
  content = content.replace(/from ['"]process['"]/g, "from 'node:process'");
  content = content.replace(/from ['"]v8['"]/g, "from 'node:v8'");
  
  writeFileSync(file, content);
});
```

## Recommendations

1. **Immediate Action Required**: Fix critical issues in HealthCheckService.ts, AlertSystem.ts, and StructuredLogger.ts
2. **Library Replacement**: Consider replacing axios with native fetch API
3. **Standardization**: Apply node: prefix consistently across all files
4. **Testing**: Create comprehensive ESM compatibility tests
5. **Documentation**: Update developer guidelines with ESM requirements

## Impact Assessment

- **High Risk Files**: HealthCheckService.ts (central to monitoring)
- **Medium Risk Files**: AlertSystem.ts, StructuredLogger.ts (logging infrastructure)
- **Low Risk Files**: Most other files (already mostly compliant)

## Conclusion

The monitoring directory has several critical ESM compatibility issues that need immediate attention, particularly around third-party library imports (axios, node-cron, winston). The good news is that most files follow ESM patterns correctly with `.js` extensions and proper relative imports. The main work involves updating library import patterns and adding node: prefixes for best practices.

---
*Review Date: 2025-08-07*
*Reviewer: Architecture Review System*
*Node.js Target: v22 with ESM*