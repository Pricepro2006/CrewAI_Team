# Troubleshooting Guide

## Common Issues and Solutions

### 1. Module Resolution Errors (ERR_MODULE_NOT_FOUND)

**Symptoms:**
- Error: `Cannot find module` or `ERR_MODULE_NOT_FOUND`
- Occurs when running `pnpm dev:server`
- Related to TypeScript imports and ESM modules

**Causes:**
- Node.js v22 has stricter ESM module resolution
- tsx loader conflicts with complex TypeScript path mappings
- Circular dependencies between modules

**Solutions:**

1. **Run services separately:**
   ```bash
   # Terminal 1
   pnpm dev:client
   
   # Terminal 2
   NODE_OPTIONS='--experimental-specifier-resolution=node' pnpm tsx src/api/server.ts
   ```

2. **Use production build:**
   ```bash
   pnpm build
   pnpm start
   ```

3. **Switch to ts-node-dev (recommended for development):**
   ```bash
   pnpm add -D ts-node-dev
   ```
   Then update package.json:
   ```json
   "dev:server": "ts-node-dev --respawn --transpile-only --exit-child src/api/server.ts"
   ```

### 2. Native Module Build Errors

**Symptoms:**
- Errors during `pnpm install`
- Messages about native modules needing build approval

**Solution:**
```bash
pnpm approve-builds
# Press 'a' to select all packages
# Press 'y' to approve
```

Required packages that need building:
- bcrypt (authentication)
- better-sqlite3 (database)
- esbuild (build tool)
- sqlite3 (database backup)

### 3. Dependency Version Conflicts

**Issue: @tanstack/react-query version mismatch**

**Symptom:**
- Error: `No matching export in "@tanstack/react-query" for import "hashQueryKey"`

**Solution:**
The project uses @tanstack/react-query v4 (not v5) for tRPC compatibility:
```bash
pnpm remove @tanstack/react-query
pnpm add @tanstack/react-query@^4.36.0
```

### 4. Ollama Connection Issues

**Symptoms:**
- "Ollama not available" errors
- Model not found errors

**Solutions:**

1. **Check if Ollama is running:**
   ```bash
   ollama list
   curl http://localhost:11434/api/tags
   ```

2. **Start Ollama if not running:**
   ```bash
   # If installed via snap
   snap start ollama
   
   # Or run directly
   ollama serve
   ```

3. **Pull required models:**
   ```bash
   ollama pull qwen3:14b
   ollama pull qwen3:8b
   ollama pull nomic-embed-text
   ```

### 5. ChromaDB Not Available

**Symptom:**
- Warning: "ChromaDB not available. Make sure it's running for RAG features."

**Note:** ChromaDB is optional. The system works without it, but RAG features will be disabled.

**To enable ChromaDB:**
```bash
# Using Docker
docker run -p 8000:8000 chromadb/chroma

# Or install locally
pip install chromadb
chroma run --host localhost --port 8000
```

### 6. Port Already in Use

**Symptom:**
- Error: "Port 3000/5173 is already in use"

**Solution:**
```bash
# Find and kill processes using the ports
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Or kill all node processes
pkill -f node
```

### 7. TypeScript Type Errors

**Symptom:**
- Type errors when running `pnpm typecheck`

**Common fixes:**

1. **Missing type definitions:**
   ```bash
   pnpm add -D @types/[package-name]
   ```

2. **Path alias issues:**
   - Check tsconfig.json paths match actual file structure
   - Ensure baseUrl is set correctly

3. **Circular dependency issues:**
   - Check for circular imports between modules
   - Use the shared types file: `src/core/shared/types.ts`

### 8. Environment Variable Issues

**Symptom:**
- Missing configuration errors
- "undefined" values in config

**Solution:**
1. Ensure .env file exists:
   ```bash
   cp .env.example .env
   ```

2. Check required variables are set:
   - `JWT_SECRET` (change from default)
   - `OLLAMA_URL` (default: http://localhost:11434)
   - Model names match installed models

### 9. Memory Issues

**Symptom:**
- "JavaScript heap out of memory" errors

**Solutions:**

1. **Increase Node.js memory:**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

2. **Use smaller models:**
   - Switch from qwen3:14b to qwen3:8b for development
   - Reduce concurrent agent instances

### 10. UI Not Loading

**Symptom:**
- Blank page at http://localhost:5173
- Console errors about missing modules

**Solutions:**

1. **Check Vite is running:**
   ```bash
   pnpm dev:client
   ```

2. **Clear cache and reinstall:**
   ```bash
   rm -rf node_modules .vite
   pnpm install
   ```

3. **Check for Tailwind CSS:**
   - Ensure tailwind.config.js exists
   - Ensure postcss.config.js exists

## Debug Commands

```bash
# Check Node.js version
node --version  # Should be 18+

# Check pnpm version
pnpm --version

# Check Ollama status
ollama list
curl http://localhost:11434/api/tags

# Check running processes
ps aux | grep -E "node|tsx|vite"

# Check ports in use
netstat -tulpn | grep -E "3000|5173|11434|8000"

# Test basic server
node --import tsx --experimental-specifier-resolution=node src/api/test-server.ts
```

## Getting Help

1. Check this troubleshooting guide first
2. Review CLAUDE.md for configuration details
3. Check logs in `data/logs/`
4. Enable debug mode in .env: `LOG_LEVEL=debug`
5. Create a minimal reproduction of the issue

## Clean Restart Procedure

If all else fails, try a clean restart:

```bash
# 1. Kill all processes
pkill -f node
pkill -f tsx
pkill -f vite

# 2. Clean install
rm -rf node_modules pnpm-lock.yaml
rm -rf dist .vite
rm -rf data/app.db

# 3. Reinstall
pnpm install
pnpm approve-builds

# 4. Initialize
pnpm init:db

# 5. Start fresh
pnpm dev:client  # Terminal 1
pnpm build && pnpm start  # Terminal 2 (if dev:server fails)
```