# CrewAI Team - Port Configuration Guide
## Last Updated: August 12, 2025

---

## 🔧 Official Port Assignments

This document serves as the single source of truth for all port assignments in the CrewAI Team project.

### Core Services

| Service | Port | Protocol | Description | Status |
|---------|------|----------|-------------|---------|
| **Frontend Dev Server** | 5173 | HTTP | Vite development server for React UI | ✅ Active |
| **API Server** | 3001 | HTTP | Main tRPC API server | ✅ Active |
| **WebSocket Gateway** | 8080 | WS | Real-time WebSocket communications | ✅ Active |

### Walmart Grocery Agent Microservices

| Service | Port | Protocol | Description | Status |
|---------|------|----------|-------------|---------|
| **Grocery Service** | 3005 | HTTP | Core grocery list management | ✅ Active |
| **Cache Warmer** | 3006 | HTTP | Proactive cache management | ✅ Active |
| **Pricing Service** | 3007 | HTTP | Price tracking and history | ✅ Active |
| **NLP Service** | 3008 | HTTP | Qwen3:0.6b model for NLP | ✅ Active |
| **Deal Engine** | 3009 | HTTP | Deal detection and matching | ✅ Active |
| **Memory Monitor** | 3010 | HTTP | System health monitoring | ✅ Active |

### External Services

| Service | Port | Protocol | Description | Status |
|---------|------|----------|-------------|---------|
| **Ollama** | 11434 | HTTP | Local LLM inference server | ✅ Active |
| **Redis** | 6379 | TCP | Cache and queue management | ✅ Active |
| **ChromaDB** | 8000 | HTTP | Vector database | ⚠️ Optional |

---

## ⚠️ Deprecated Ports

These ports were used in previous versions but are NO LONGER ACTIVE:

| Port | Previous Use | Replaced By | Notes |
|------|--------------|-------------|-------|
| 3002 | WebSocket/Monitor | 8080/3010 | Migrated in v2.3.0 |
| 3003 | Monitoring WS | 8080 | Consolidated to main WS |
| 3004 | Test Server | N/A | Removed |

---

## 🔄 Port Migration History

### August 12, 2025 - WebSocket Consolidation
- **Change**: WebSocket moved from port 3002 to 8080
- **Reason**: Protocol alignment and service consolidation
- **Impact**: All WebSocket connections now use port 8080
- **Files Updated**:
  - `/src/ui/hooks/useGroceryWebSocket.ts`
  - `/src/ui/hooks/useTRPCWithCSRF.ts`
  - `/src/config/websocket.config.ts`

### August 7, 2025 - Microservices Architecture
- **Change**: Monolith decomposed into 6 microservices
- **Ports Assigned**: 3005-3010 for specialized services
- **WebSocket**: Established on port 8080

---

## 🚀 Starting Services

### Quick Start All Services
```bash
# Start all services with correct ports
npm run dev

# Or individually:
npm run api:start      # Port 3001
npm run websocket:start # Port 8080
npm run services:start  # Ports 3005-3010
```

### Verify Port Usage
```bash
# Check all Node.js services
lsof -i -P | grep LISTEN | grep node

# Check specific port
lsof -i :8080

# Test WebSocket connection
wscat -c ws://localhost:8080/ws/walmart

# Test API health
curl http://localhost:3001/health
```

---

## 🔍 Troubleshooting

### Port Already in Use
```bash
# Kill process on specific port
lsof -ti:PORT | xargs kill -9

# Example for WebSocket
lsof -ti:8080 | xargs kill -9
```

### WebSocket Connection Issues
1. **Verify server is running**: `lsof -i :8080`
2. **Check health endpoint**: `curl http://localhost:8080/health`
3. **Test WebSocket**: `wscat -c ws://localhost:8080/ws/walmart`
4. **Check logs**: `tail -f /tmp/websocket-server.log`

### Finding Available Ports
```bash
# Find next available port starting from 3000
for port in {3000..3100}; do
  lsof -i :$port > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo "Port $port is available"
    break
  fi
done
```

---

## 📝 Configuration Files

### Environment Variables
```bash
# .env file
API_PORT=3001
WEBSOCKET_PORT=8080
VITE_API_PORT=3001
VITE_WS_PORT=8080
```

### Docker Compose Ports
```yaml
services:
  api:
    ports:
      - "3001:3001"
  
  websocket:
    ports:
      - "8080:8080"
  
  frontend:
    ports:
      - "5173:5173"
```

### Nginx Proxy Configuration
```nginx
# WebSocket upstream
upstream websocket {
    server 127.0.0.1:8080;
}

# API upstream
upstream api {
    server 127.0.0.1:3001;
}
```

---

## 🔐 Security Considerations

1. **Firewall Rules**: Only expose necessary ports
2. **Production**: Use reverse proxy (Nginx) instead of direct port exposure
3. **Development**: Bind to localhost only (`127.0.0.1`)
4. **WebSocket**: Implement proper authentication and rate limiting

---

## 📚 Related Documentation

- [WALMART_WEBSOCKET_FIX_REPORT.md](../WALMART_WEBSOCKET_FIX_REPORT.md) - WebSocket port migration details
- [PDR_WALMART_GROCERY_MICROSERVICES.md](PDR_WALMART_GROCERY_MICROSERVICES.md) - Microservices architecture
- [QUICK_REFERENCE_CARD.md](../QUICK_REFERENCE_CARD.md) - Emergency commands and port checks

---

*This document is the authoritative source for port configuration. Any discrepancies in other documentation should be reported and corrected to match this guide.*