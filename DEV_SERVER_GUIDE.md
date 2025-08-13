# Development Server Guide - Walmart Grocery Agent

## Quick Start

### Start Development Server
```bash
npm run dev-server
```
This command starts both the frontend (Vite) and backend (Node.js) servers optimized for Walmart Grocery Agent development.

### Access URLs
- **Frontend (Walmart Agent)**: http://localhost:5178/walmart
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **WebSocket**: ws://localhost:3001/trpc-ws

## Features

### Hot Reload Capabilities
- ✅ **React Fast Refresh**: Instant component updates without losing state
- ✅ **TypeScript Compilation**: Real-time TypeScript error checking and compilation
- ✅ **CSS Hot Module Replacement**: Immediate style updates
- ✅ **File Change Detection**: Automatic rebuild on file changes
- ✅ **Error Overlay**: Development errors displayed in browser

### Development Optimizations
- **Port Configuration**: Automatically configured for port 5178
- **Proxy Setup**: API calls automatically proxied to backend
- **Source Maps**: Enabled for debugging
- **Network Access**: Available on local network (host: true)

## Commands

### Primary Commands
```bash
# Start development server (recommended)
npm run dev-server

# Check server status
./dev-server-status.sh

# Stop development server
pkill -f 'concurrently.*dev-server'
```

### Alternative Commands
```bash
# Start only frontend on port 5178
npm run dev:client:walmart

# Start only backend
npm run dev:server

# Standard development server (port 5173)
npm run dev
```

## Configuration

### Vite Configuration
- **Port**: 5178 (configurable via VITE_PORT environment variable)
- **Hot Module Replacement**: Enabled with error overlay
- **Network Access**: Enabled for testing on other devices
- **Proxy**: API routes automatically forwarded to backend

### Environment Variables
```bash
VITE_PORT=5178          # Frontend port
NODE_ENV=development    # Development mode
```

## Troubleshooting

### Port Already in Use
If port 5178 is in use, Vite will automatically find the next available port (e.g., 5179).

### Backend Connection Issues
Check that the backend server is running:
```bash
curl http://localhost:3000/health
```

### Hot Reload Not Working
1. Check file watchers: `fs.inotify.max_user_watches`
2. Verify file permissions
3. Check network connectivity

## Architecture

### Frontend (Vite)
- React 18 with Fast Refresh
- TypeScript compilation
- Tailwind CSS with hot reload
- tRPC client integration

### Backend (Node.js)
- Express server with tRPC
- WebSocket support for real-time updates
- Database connections (SQLite/Redis)
- Ollama integration for LLM features

### Walmart-Specific Features
- Real-time pricing updates
- Shopping session management
- Grocery list synchronization
- Location-based services

## Development Workflow

1. **Start Server**: `npm run dev-server`
2. **Open Browser**: Navigate to http://localhost:5178/walmart
3. **Make Changes**: Edit files and see instant updates
4. **Debug**: Use browser DevTools with source maps
5. **Test**: Hot reload preserves state during development

## Status Monitoring

Run `./dev-server-status.sh` to check:
- Server process status
- Port availability
- Network connectivity
- Hot reload functionality

---

*Development server configured for optimal Walmart Grocery Agent development experience with hot-reload functionality.*