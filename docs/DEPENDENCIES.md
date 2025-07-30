# CrewAI Team - Dependencies and Installation Guide

## Core Dependencies

### Runtime Dependencies
- **Node.js**: v20.11 or higher
- **SQLite**: v3.44 or higher
- **Redis**: v7.0 or higher (for queue management and caching)
- **Ollama**: Latest version (for local LLM inference)
- **ChromaDB**: v0.4.0 or higher (for vector operations)

### Development Dependencies
- **TypeScript**: v5.3.3
- **React**: v18.2.0
- **Vite**: v5.0.11
- **Python**: v3.x with distutils module

## Known Installation Issues

### 1. Socket.IO Dependency
The WebSocketManager component (`src/core/websocket/WebSocketManager.ts`) requires `socket.io` and `@types/socket.io`. However, installation may fail due to node-gyp compilation issues with better-sqlite3.

**Issue**: 
```
ModuleNotFoundError: No module named 'distutils'
```

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install python3-distutils

# Fedora/RHEL
sudo dnf install python3-distutils

# macOS (using Homebrew)
brew install python-setuptools

# Or use a Python virtual environment with distutils
python3 -m venv venv
source venv/bin/activate
```

### 2. Better-SQLite3 Compilation
Better-SQLite3 requires node-gyp to compile native bindings, which can fail on some systems.

**Alternative Solutions**:
1. Use pre-built binaries:
   ```bash
   npm install better-sqlite3 --build-from-source=false
   ```

2. Install build tools:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install build-essential

   # macOS
   xcode-select --install

   # Windows
   npm install --global windows-build-tools
   ```

## Optional Dependencies

### WebSocket Support
For real-time features, the following packages are required:
- `socket.io`: ^4.7.0
- `@types/socket.io`: ^4.0.0
- `socket.io-client`: ^4.7.0 (for client-side)
- `@types/socket.io-client`: ^3.0.0

**Note**: WebSocket functionality is optional. The application will work without it, but real-time updates will fall back to polling.

## Environment-Specific Dependencies

### Production
```json
{
  "pm2": "^5.3.0",
  "compression": "^1.7.4",
  "helmet": "^7.1.0"
}
```

### Development Only
```json
{
  "eslint": "^8.56.0",
  "prettier": "^3.2.4",
  "husky": "^9.1.7",
  "lint-staged": "^16.1.2",
  "vitest": "^1.2.0",
  "playwright": "^1.54.1"
}
```

## Dependency Installation Order

For best results, install dependencies in this order:

1. **System Dependencies**:
   ```bash
   # Install Python with distutils
   # Install build tools for your OS
   ```

2. **Core Node Dependencies**:
   ```bash
   npm install --ignore-scripts
   ```

3. **Native Dependencies**:
   ```bash
   npm rebuild better-sqlite3
   ```

4. **Optional Dependencies** (if needed):
   ```bash
   npm install socket.io @types/socket.io --save
   npm install socket.io-client @types/socket.io-client --save-dev
   ```

## Troubleshooting

### Error: Cannot find module 'socket.io'
The WebSocketManager is designed to work with socket.io, but due to compilation issues, it may not install correctly. You can:

1. Skip WebSocket features temporarily
2. Use a different Node.js version (v18.x often works better)
3. Install in a clean environment:
   ```bash
   rm -rf node_modules package-lock.json
   npm cache clean --force
   npm install
   ```

### Error: Python executable not found
Ensure Python is in your PATH:
```bash
which python3
# or
where python
```

### Error: No matching version found for package
Clear npm cache and try again:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Version Compatibility Matrix

| Package | Min Version | Max Version | Notes |
|---------|-------------|-------------|-------|
| Node.js | 20.11.0 | 22.x | v22.15.0 may have node-gyp issues |
| TypeScript | 5.0.0 | 5.5.x | Strict mode enabled |
| React | 18.2.0 | 18.3.x | No React 19 support yet |
| Vite | 5.0.0 | 5.x | Using ESM modules |
| SQLite | 3.44.0 | Latest | JSON support required |

## Future Dependencies

The following dependencies are planned for future releases:

1. **Email Pipeline Integration**:
   - `@microsoft/microsoft-graph-client`: For MS Graph API
   - `node-cron`: For scheduled tasks

2. **Enhanced Security**:
   - `argon2`: For password hashing upgrade
   - `node-jose`: For JWT improvements

3. **Performance**:
   - `bull`: For better queue management
   - `ioredis`: For Redis cluster support

## Maintaining Dependencies

1. **Regular Updates**:
   ```bash
   npm outdated
   npm update --save
   ```

2. **Security Audits**:
   ```bash
   npm audit
   npm audit fix
   ```

3. **Lock File Maintenance**:
   - Always commit `package-lock.json`
   - Regenerate if corrupted: `npm install --package-lock-only`

---

Last Updated: January 28, 2025
Version: 1.0.0