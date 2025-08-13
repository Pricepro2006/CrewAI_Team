# Python Distutils Workaround for better-sqlite3

## Problem

The `better-sqlite3` package requires compilation using `node-gyp`, which depends on Python's `distutils` module. In some environments (especially newer Python versions or minimal installations), `distutils` is not available, causing installation to fail with:

```
ModuleNotFoundError: No module named 'distutils'
```

## Solution Overview

We've created multiple workaround solutions that allow the email pipeline to run without requiring system-level Python distutils installation:

### 1. **Primary Solution: Use Existing Installation**

Since `better-sqlite3` is already installed and working in the project, we can skip recompilation:

```bash
# Test if better-sqlite3 is working
node -e "require('better-sqlite3'); console.log('✓ Working')"
```

### 2. **Workaround Scripts**

We've created three helper scripts:

#### a) `scripts/start-email-pipeline.sh`

A smart startup script that:

- Checks if better-sqlite3 is working
- Verifies all dependencies
- Checks required services (Redis, Ollama)
- Provides a menu to run different pipeline configurations

**Usage:**

```bash
./scripts/start-email-pipeline.sh
```

#### b) `scripts/install-workaround.sh`

Installation workaround that:

- Detects if better-sqlite3 is already working
- Attempts to download prebuilt binaries
- Creates a mock Python distutils module as fallback
- Installs other dependencies separately

**Usage:**

```bash
./scripts/install-workaround.sh
```

#### c) `scripts/patch-install.js`

Node.js script that:

- Temporarily removes problematic dependencies
- Installs all other packages
- Attempts multiple methods to install better-sqlite3

**Usage:**

```bash
node scripts/patch-install.js
```

## Quick Start

1. **For running the email pipeline immediately:**

   ```bash
   ./scripts/start-email-pipeline.sh
   ```

2. **If you need to reinstall dependencies:**
   ```bash
   ./scripts/install-workaround.sh
   # or
   node scripts/patch-install.js
   ```

## How It Works

### Detection Phase

1. Scripts first check if `better-sqlite3` is already functional
2. If working, no compilation is needed - proceed directly

### Fallback Methods

If better-sqlite3 needs installation, the scripts try:

1. **Prebuilt Binary Download**
   - Downloads from GitHub releases
   - Matches Node version, platform, and architecture
   - No compilation needed

2. **Mock Distutils Module**
   - Creates a dummy Python distutils module
   - Satisfies node-gyp's import requirements
   - Located at `~/.local/lib/python{version}/site-packages/distutils`

3. **Ignore Scripts Installation**
   - Uses `npm install --ignore-scripts`
   - Skips compilation step
   - Works if module was previously built

## Alternative Solutions

If the workarounds don't work:

1. **Install Python distutils (system-wide fix):**

   ```bash
   # Ubuntu/Debian
   sudo apt-get install python3-distutils

   # Fedora
   sudo dnf install python3-devel

   # macOS (usually included)
   brew install python@3
   ```

2. **Use Docker:**

   ```dockerfile
   FROM node:20
   RUN apt-get update && apt-get install -y python3-distutils
   ```

3. **Copy from another installation:**
   ```bash
   # From a working installation
   cp -r /path/to/working/node_modules/better-sqlite3 ./node_modules/
   ```

## Verification

After any installation method, verify with:

```bash
# Check better-sqlite3
node -e "require('better-sqlite3'); console.log('✓ Working')"

# Check database connection
node -e "
  const Database = require('better-sqlite3');
  const db = new Database('./data/crewai.db');
  console.log('✓ Database connection successful');
  db.close();
"
```

## Troubleshooting

### Error: "Cannot find module 'better-sqlite3'"

- Run: `./scripts/install-workaround.sh`
- Check if `node_modules/better-sqlite3` exists

### Error: "Cannot open database"

- Ensure `./data/crewai.db` exists
- Run: `npm run init:db`

### Error: "Redis connection refused"

- Start Redis: `redis-server`
- Check port 6379 is not in use

### Error: "Ollama not responding"

- Start Ollama: `ollama serve`
- Check port 11434 is accessible

## Benefits of This Approach

1. **No System Changes Required** - Works without sudo/admin rights
2. **Portable** - Scripts work across different environments
3. **Fast** - Skips unnecessary compilation when possible
4. **Fallback Options** - Multiple methods ensure success
5. **User-Friendly** - Clear menu-driven interface

## Maintenance

The workaround scripts are designed to be self-maintaining:

- Automatically detect working installations
- Skip unnecessary steps
- Provide clear error messages
- Suggest alternatives when needed

For updates, modify the version numbers in the scripts to match your `package.json`.
