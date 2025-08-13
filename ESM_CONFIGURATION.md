# ESM Configuration for Node.js v22

## Overview
This project has been configured for full ESM (ECMAScript Modules) support with Node.js v22, providing modern JavaScript module syntax and improved performance.

## Configuration Changes

### TypeScript Configuration (`tsconfig.json`)
- **Module**: Changed from `ESNext` to `NodeNext` for proper Node.js ESM support
- **Module Resolution**: Changed from `bundler` to `NodeNext` for Node.js module resolution
- **Module Detection**: Added `"moduleDetection": "force"` for better ESM detection
- **Target**: ES2022 (optimized for Node.js v22 features)
- **Verbatim Module Syntax**: Enabled for stricter import/export checking

### Server Configuration (`config/typescript/tsconfig.server.json`)
- Inherits from main tsconfig with Node.js-specific overrides
- Module and resolution set to `NodeNext` for server-side code
- Removed browser-specific type definitions

### Build Configuration (`config/typescript/tsconfig.build.json`)
- Extends server configuration for production builds
- Ensures consistent module resolution across build pipeline

### Package.json Updates
- **Type**: Set to `"module"` for ESM by default
- **Engines**: Updated to require Node.js >=20.0.0
- **Exports**: Added proper export mappings for package consumers
- **Scripts**: Updated to use tsx directly with proper ESM flags

## Key Features

### 1. Import Syntax
- Use ES6 import/export syntax throughout the codebase
- No need for `require()` or `module.exports`
- Support for top-level await in modules

### 2. File Extensions
- TypeScript files compile to `.js` extensions
- Imports should not include `.ts` extensions in TypeScript files
- Node.js will resolve `.js` extensions automatically

### 3. JSON Imports
- JSON files can be imported directly with `resolveJsonModule: true`
- Example: `import config from './config.json'`

### 4. Path Aliases
- Configured path aliases work with ESM:
  - `@/*` → `src/*`
  - `@core/*` → `src/core/*`
  - `@api/*` → `src/api/*`
  - `@ui/*` → `src/ui/*`
  - `@utils/*` → `src/utils/*`
  - `@config/*` → `src/config/*`

## Development Commands

### Start Development Server
```bash
npm run dev:server
# Uses tsx with ESM loader for hot-reloading TypeScript
```

### Build for Production
```bash
npm run build:server
# Compiles TypeScript to ESM JavaScript
```

### Run Production Server
```bash
npm start
# Runs compiled ESM JavaScript with Node.js
```

## Migration Guide

### Converting from CommonJS

#### Before (CommonJS):
```javascript
const express = require('express');
const { someFunction } = require('./utils');
module.exports = { myFunction };
```

#### After (ESM):
```typescript
import express from 'express';
import { someFunction } from './utils.js';
export { myFunction };
```

### Handling `__dirname` and `__filename`

#### ESM equivalent:
```typescript
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### Dynamic Imports
```typescript
// Use dynamic imports for conditional loading
const module = await import('./dynamic-module.js');
```

## Compatibility Notes

### Node.js Version
- Minimum: Node.js 20.0.0
- Recommended: Node.js 22.0.0+
- Full ESM support without experimental flags

### Dependencies
- Most npm packages now support ESM
- For CommonJS-only packages, Node.js provides automatic interop
- Use `esModuleInterop: true` for better compatibility

### Testing
- Vitest configured for ESM testing
- Playwright tests work with ESM configuration
- Jest alternatives available if needed

## Troubleshooting

### Common Issues

1. **"Cannot use import statement outside a module"**
   - Ensure `"type": "module"` is in package.json
   - Check file extension is `.mjs` or package.json has module type

2. **"Module not found" errors**
   - Don't use `.ts` extensions in imports
   - Ensure `moduleResolution` is set correctly
   - Check path aliases are configured

3. **TypeScript compilation errors**
   - Run `npx tsc --noEmit` to check for type errors
   - Ensure `module` and `moduleResolution` match in tsconfig

4. **Runtime import errors**
   - Use `node:` prefix for Node.js built-in modules
   - Check if dependencies support ESM

## Performance Benefits

1. **Faster startup times** - ESM modules are parsed once
2. **Better tree-shaking** - Unused exports can be eliminated
3. **Native async/await** - Top-level await support
4. **Improved caching** - Module caching at the platform level
5. **Future-proof** - ESM is the standard going forward

## Best Practices

1. Always use explicit file extensions in relative imports (in compiled `.js` files)
2. Prefer named exports over default exports for better tree-shaking
3. Use `node:` prefix for built-in modules for clarity
4. Keep `tsconfig.json` module settings consistent across variants
5. Test both development and production builds regularly

## Resources

- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [TypeScript ESM Support](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Vite ESM Guide](https://vitejs.dev/guide/features.html#esm)