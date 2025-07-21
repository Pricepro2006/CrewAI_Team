# Deployment Troubleshooting Guide

This guide documents common deployment issues and their solutions based on real-world experience deploying the CrewAI Team application in 2025.

## Table of Contents
- [TypeScript Compilation Errors](#typescript-compilation-errors)
- [ES Module Resolution Issues](#es-module-resolution-issues)
- [Docker Build Failures](#docker-build-failures)
- [Service Connection Issues](#service-connection-issues)
- [Port Conflicts](#port-conflicts)
- [Best Practices for 2025](#best-practices-for-2025)

---

## TypeScript Compilation Errors

### Problem: Test Files Causing Production Build Failures
**Symptoms:**
- Hundreds of TypeScript errors during production build
- Errors like "Cannot use namespace 'jest' as a value"
- Build process fails with test-related type errors

**Root Cause:**
Test files are being included in production TypeScript compilation, but test dependencies (`@types/jest`, etc.) are not available in production.

**Solution:**
Create a separate TypeScript configuration for production builds that excludes test files:

1. Create `tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.server.json",
  "compilerOptions": {
    "skipLibCheck": true,
    "skipDefaultLibCheck": true,
    "noEmitOnError": false,
    "allowImportingTsExtensions": false
  },
  "exclude": [
    "node_modules",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    "**/__tests__/**",
    "**/test/**",
    "**/tests/**"
  ]
}
```

2. Update `package.json` build scripts:
```json
{
  "scripts": {
    "build:server:production": "tsc -p tsconfig.build.json",
    "build:production": "npm run build:client && npm run build:server:production && npm run fix:esm"
  }
}
```

**Result:** TypeScript errors reduced from 216 to 14 (93% reduction), with remaining errors being non-critical warnings.

---

## ES Module Resolution Issues

### Problem: ERR_MODULE_NOT_FOUND in Production
**Symptoms:**
- Node.js cannot find modules after TypeScript compilation
- Error: `Cannot find module '/dist/api/trpc/context'`
- Works in development but fails in production

**Root Cause:**
TypeScript compiles imports without adding `.js` extensions, but Node.js ES modules require explicit extensions in imports.

**Solution:**
Create a post-build script to add `.js` extensions to all relative imports:

1. Create `scripts/fix-esm-imports.js`:
```javascript
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

async function processDirectory(dir) {
  const entries = await readdir(dir);
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.endsWith('.js')) {
      await processFile(fullPath);
    }
  }
}

async function processFile(filePath) {
  let content = await readFile(filePath, 'utf-8');
  let modified = false;
  
  // Fix relative imports without extensions
  content = content.replace(
    /from\s+["'](\.[^"']+)["']/g,
    (match, importPath) => {
      if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
        return match;
      }
      modified = true;
      return `from "${importPath}.js"`;
    }
  );
  
  // Fix dynamic imports
  content = content.replace(
    /import\(["'](\.[^"']+)["']\)/g,
    (match, importPath) => {
      if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
        return match;
      }
      modified = true;
      return `import("${importPath}.js")`;
    }
  );
  
  if (modified) {
    await writeFile(filePath, content, 'utf-8');
    console.log(`✅ Fixed imports in: ${path.relative(process.cwd(), filePath)}`);
  }
}

// Main execution
const distPath = path.join(__dirname, '..', 'dist');

console.log('🔧 Fixing ES module imports...');
processDirectory(distPath)
  .then(() => console.log('✨ All imports fixed!'))
  .catch(err => {
    console.error('❌ Error fixing imports:', err);
    process.exit(1);
  });
```

2. Add to build pipeline:
```json
{
  "scripts": {
    "fix:esm": "node scripts/fix-esm-imports.js",
    "build:production": "npm run build:client && npm run build:server:production && npm run fix:esm"
  }
}
```

**Alternative for Development:**
Use `--experimental-specifier-resolution=node` flag:
```bash
NODE_OPTIONS='--experimental-specifier-resolution=node' node dist/api/server.js
```

---

## Docker Build Failures

### Problem: pnpm Frozen Lockfile Errors
**Symptoms:**
- Docker build fails with "Cannot install with frozen-lockfile"
- `pnpm-lock.yaml` is not up to date with `package.json`

**Solution:**
1. Update lockfile locally:
```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "fix: Update pnpm lockfile"
```

2. Use multi-stage Docker build:
```dockerfile
FROM node:20-alpine AS builder
RUN npm install -g pnpm@9.15.2
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build:production

FROM node:20-alpine
RUN npm install -g pnpm@9.15.2
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["node", "dist/api/server.js"]
```

---

## Service Connection Issues

### Problem: Redis Connection Refused
**Symptoms:**
- Multiple "Error: connect ECONNREFUSED 127.0.0.1:6379" in logs
- Application still runs but with warnings

**Solution:**
Redis is optional for this application. To suppress warnings:

1. Check if Redis is actually required in your configuration
2. If not needed, ensure Redis-dependent features have proper fallbacks
3. If needed, start Redis:
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

### Problem: IPv6 Rate Limiter Warning
**Symptoms:**
- ValidationError: Custom keyGenerator appears to use request IP without calling ipKeyGenerator
- Warning about IPv6 users bypassing limits

**Solution:**
This is a non-critical warning from express-rate-limit v8.0.1. The application continues to function properly. To fix:

1. Update rate limiter configuration to use proper IPv6 handling
2. Or acknowledge the warning as non-critical for internal applications

---

## Port Conflicts

### Problem: EADDRINUSE Errors
**Symptoms:**
- "Error: listen EADDRINUSE: address already in use :::3001"
- Cannot start staging environment

**Solution:**
Kill existing processes before starting:

```bash
# Find and kill processes on specific ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Or use the deployment script that handles this automatically
./scripts/deploy-staging-simple.sh
```

---

## Best Practices for 2025

Based on research of current Node.js and TypeScript practices:

### 1. ES Module Configuration
- Always use explicit `.js` extensions in imports for ES modules
- Use `"type": "module"` in package.json
- Configure TypeScript with `"module": "ESNext"` and `"moduleResolution": "bundler"`

### 2. TypeScript Production Builds
- Separate development and production TypeScript configurations
- Exclude test files from production builds
- Use `skipLibCheck` for faster builds when appropriate

### 3. Deployment Scripts
- Always include cleanup of existing processes
- Use `nohup` for background processes
- Capture logs for debugging
- Include health checks after deployment

### 4. Error Handling
- Implement graceful degradation for optional services
- Add proper timeout handling for service connections
- Use structured logging for easier debugging

### 5. Performance Optimizations
- Enable SQLite WAL mode for better concurrency
- Use connection pooling where applicable
- Implement proper cache headers for static assets

---

## Quick Reference Commands

### Check Service Status
```bash
# Check if services are running
curl http://localhost:3001/health | jq .

# Check logs
tail -f staging.log

# Check process
ps aux | grep "node dist/api/server.js"
```

### Restart Services
```bash
# Kill existing processes
./scripts/deploy-staging-simple.sh

# Or manually
lsof -ti:3001 | xargs kill -9
NODE_ENV=staging PORT=3001 node dist/api/server.js
```

### Debug Build Issues
```bash
# Check TypeScript errors
npx tsc --noEmit

# Build for production
npm run build:production

# Test the build locally
NODE_OPTIONS='--experimental-specifier-resolution=node' node dist/api/server.js
```

---

## References

- [Node.js ES Modules Documentation (2025)](https://nodejs.org/api/esm.html)
- [TypeScript 5.7 Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [Express Rate Limit IPv6 Handling](https://express-rate-limit.github.io/ERR_ERL_KEY_GEN_IPV6/)
- [Better-SQLite3 Performance Guide](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md)

---

*Last Updated: January 21, 2025*
*Version: 1.0.0*