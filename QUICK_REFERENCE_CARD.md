# 🚀 Quick Reference Card - Walmart Grocery Agent

## 🔴 EMERGENCY COMMANDS

```bash
# STOP EVERYTHING
pkill -f node && pkill -f ollama

# QUICK RESTART
npm run restart:all

# FULL RESET
./scripts/full_reset.sh
```

---

## 🔧 COMMON FIXES

### WebSocket Down
```bash
lsof -ti:8080 | xargs kill -9
npm run websocket:restart
```

### Database Locked
```bash
fuser -k walmart_grocery.db
rm -f *.db-journal *.db-wal
```

### Port Conflict
```bash
lsof -ti:3001 | xargs kill -9
# Or for any port:
npx kill-port [PORT]
```

### Memory Issue
```bash
NODE_OPTIONS="--max-old-space-size=2048" npm run dev
```

### Ollama Not Running
```bash
ollama serve &
ollama pull qwen3:0.6b
```

---

## 📊 HEALTH CHECKS

```bash
# Quick health check
./scripts/monitor_health.sh

# Test WebSocket
wscat -c ws://localhost:8080
> {"type":"ping"}

# Check database
sqlite3 walmart_grocery.db "PRAGMA integrity_check;"

# Check all ports
lsof -i -P | grep LISTEN | grep node
```

---

## 🔍 DIAGNOSTICS

```bash
# Full diagnostic
./scripts/diagnose.sh

# Memory usage
ps aux | grep node | awk '{sum+=$6} END {print sum/1024 " MB"}'

# Database size
du -h *.db

# Check logs
tail -f logs/*.log | grep -i error
```

---

## 🛠️ SERVICE MANAGEMENT

| Service | Port | Start Command | Check Command |
|---------|------|--------------|---------------|
| API | 3001 | `npm run api:start` | `curl localhost:3001/health` |
| WebSocket | 8080 | `npm run websocket:start` | `wscat -c ws://localhost:8080` |
| NLP | 3008 | `npm run nlp:start` | `curl localhost:3008/health` |
| Grocery | 3005 | `npm run grocery:start` | `curl localhost:3005/health` |
| Monitor | 3010 | `npm run monitor` | `open http://localhost:3010` |

---

## 💾 DATABASE OPERATIONS

```bash
# Backup
cp walmart_grocery.db backup_$(date +%Y%m%d).db

# Restore
cp backup_20250807.db walmart_grocery.db

# Vacuum (optimize)
sqlite3 walmart_grocery.db "VACUUM;"

# Clear data
sqlite3 walmart_grocery.db "DELETE FROM grocery_lists; VACUUM;"
```

---

## 🚨 ERROR PATTERNS

| Error | Meaning | Fix |
|-------|---------|-----|
| `EADDRINUSE` | Port in use | Kill process on port |
| `SQLITE_BUSY` | DB locked | Kill DB processes |
| `ENOMEM` | Out of memory | Increase Node memory |
| `ECONNREFUSED` | Service down | Start the service |
| `WebSocket failed` | WS server down | Restart WebSocket |

---

## 📁 KEY FILES

```
src/api/websocket/WalmartWebSocketServer.ts  # WebSocket server
src/database/WalmartDatabaseManager.ts       # Database manager
src/api/server.ts                            # Main API
.env                                          # Configuration
logs/                                         # Log files
scripts/                                      # Utility scripts
```

---

## 🔄 RECOVERY SEQUENCE

1. **Stop all** → `pkill -f node`
2. **Clear locks** → `rm -f *.db-journal`
3. **Clear cache** → `rm -rf node_modules/.cache`
4. **Restart Ollama** → `ollama serve &`
5. **Start services** → `npm run dev`

---

## 📞 ESCALATION

| Level | Time | Action |
|-------|------|--------|
| 1 | < 2min | Restart service |
| 2 | < 10min | Clear cache & restart |
| 3 | < 30min | Full reset |
| 4 | > 30min | Restore from backup |

---

## 🎯 ONE-LINERS

```bash
# Kill all Node processes
pkill -f node

# Find what's using a port
lsof -i :PORT

# Monitor in real-time
watch -n 1 './scripts/monitor_health.sh'

# Test all endpoints
for p in 3001 3005 3008 8080; do curl -s localhost:$p/health && echo "✓ $p" || echo "✗ $p"; done

# Emergency backup
tar -czf emergency_backup_$(date +%Y%m%d_%H%M%S).tar.gz *.db src/

# Check everything
npm run healthcheck
```

---

**📌 GOLDEN RULE:** When in doubt, run `./scripts/diagnose.sh` first!