# Incident Response Playbook - Walmart Grocery Agent Local Development

**Version:** 1.0.0  
**Environment:** LOCAL DEVELOPMENT ONLY  
**Last Updated:** August 7, 2025  
**Critical Ports:** 3001 (API), 8080 (WebSocket), 3005-3010 (Microservices)

---

## 🚨 QUICK DIAGNOSIS FLOWCHART

```
Is the issue...
├── WebSocket related? → Section 1
├── Database related? → Section 2
├── Port conflict? → Section 7.3
├── Memory/Performance? → Section 6.3
├── Service not starting? → Section 7.1
└── Unknown? → Run diagnostic script (Section 3)
```

---

## 1. WebSocket Failure Scenarios

### 1.1 Connection Failure (Ports 3001/8080)

**Detection:**
```javascript
// Browser Console Error Patterns:
"WebSocket connection to 'ws://localhost:8080' failed"
"Error during WebSocket handshake"
"net::ERR_CONNECTION_REFUSED"
```

**Diagnosis:**
```bash
# Check if WebSocket server is running
lsof -i :8080
lsof -i :3001

# Check WebSocket server logs
tail -f logs/websocket.log

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:8080
```

**Resolution:**
```bash
# Step 1: Kill stuck processes
pkill -f "node.*websocket"
lsof -ti:8080 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Step 2: Clear node modules cache
rm -rf node_modules/.cache

# Step 3: Restart WebSocket server
npm run websocket:restart

# Step 4: If still failing, reset WebSocket configuration
cp src/api/websocket/WalmartWebSocketServer.ts.backup src/api/websocket/WalmartWebSocketServer.ts
npm run build
npm run dev
```

**Verification:**
```bash
# Check connection
wscat -c ws://localhost:8080
# Type: {"type":"ping"} and expect {"type":"pong"}
```

**Prevention:**
- Use PM2 for process management: `pm2 start ecosystem.config.js`
- Implement connection pooling limits in `src/api/websocket/WalmartWebSocketServer.ts`

### 1.2 Infinite Reconnection Loop

**Detection:**
```javascript
// Console shows repeated:
"WebSocket reconnecting... attempt 1"
"WebSocket reconnecting... attempt 2"
// ... continues indefinitely
```

**Diagnosis:**
```bash
# Monitor connection attempts
watch -n 1 'netstat -an | grep -E ":(8080|3001)"'

# Check for memory leaks
node --inspect src/api/server.ts
# Open chrome://inspect and check Memory tab
```

**Resolution:**
```bash
# Update reconnection logic
cat > /tmp/fix-reconnect.js << 'EOF'
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;
let reconnectAttempts = 0;

function connectWebSocket() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    return;
  }
  
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.onclose = () => {
    reconnectAttempts++;
    setTimeout(connectWebSocket, RECONNECT_DELAY * Math.pow(2, reconnectAttempts));
  };
  
  ws.onopen = () => {
    reconnectAttempts = 0;
  };
}
EOF

# Apply fix to component
node /tmp/fix-reconnect.js > src/ui/hooks/useGroceryWebSocket.fixed.ts
```

### 1.3 Message Delivery Failures

**Detection:**
- Messages sent but no response received
- Browser Network tab shows pending WebSocket frames
- Console: "WebSocket message timeout"

**Resolution:**
```bash
# Clear message queue
redis-cli FLUSHDB

# Restart message handler
pm2 restart websocket-handler

# Monitor message flow
npm run monitor:websocket
```

### 1.4 CORS Issues in Development

**Detection:**
```
"Access to WebSocket at 'ws://localhost:8080' from origin 'http://localhost:3000' has been blocked by CORS policy"
```

**Resolution:**
```javascript
// Add to src/api/websocket/WalmartWebSocketServer.ts
const wss = new WebSocket.Server({
  port: 8080,
  verifyClient: (info) => {
    const origin = info.origin || info.req.headers.origin;
    return ['http://localhost:3000', 'http://localhost:3001'].includes(origin);
  }
});
```

---

## 2. Database Issue Scenarios

### 2.1 SQLite Database Lock

**Detection:**
```
"SQLITE_BUSY: database is locked"
"Error: database is locked"
```

**Diagnosis:**
```bash
# Check for locks
fuser walmart_grocery.db
fuser app.db
fuser crewai_enhanced.db

# Check SQLite journal files
ls -la *.db-journal
ls -la *.db-wal
ls -la *.db-shm
```

**Resolution:**
```bash
# Step 1: Backup current database
cp walmart_grocery.db walmart_grocery.db.backup.$(date +%Y%m%d_%H%M%S)

# Step 2: Kill processes holding locks
fuser -k walmart_grocery.db

# Step 3: Remove journal files
rm -f walmart_grocery.db-journal
rm -f walmart_grocery.db-wal
rm -f walmart_grocery.db-shm

# Step 4: Verify integrity
sqlite3 walmart_grocery.db "PRAGMA integrity_check;"

# Step 5: If corrupted, restore from backup
if [ $? -ne 0 ]; then
  cp walmart_grocery.db.backup.$(date +%Y%m%d) walmart_grocery.db
fi

# Step 6: Restart services
npm run services:restart
```

### 2.2 Slow Query Performance

**Detection:**
- API responses > 1 second
- Console shows: "Slow query detected"
- Database file > 1GB

**Diagnosis:**
```bash
# Analyze query performance
sqlite3 walmart_grocery.db << EOF
.timer on
EXPLAIN QUERY PLAN 
SELECT * FROM grocery_lists 
WHERE user_id = 'test' 
ORDER BY created_at DESC 
LIMIT 10;
EOF

# Check database size and fragmentation
sqlite3 walmart_grocery.db "PRAGMA page_count; PRAGMA freelist_count;"
```

**Resolution:**
```bash
# Step 1: Add missing indexes
sqlite3 walmart_grocery.db << EOF
CREATE INDEX IF NOT EXISTS idx_grocery_lists_user_id ON grocery_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_lists_created_at ON grocery_lists(created_at);
CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);
ANALYZE;
EOF

# Step 2: Vacuum database
sqlite3 walmart_grocery.db "VACUUM;"

# Step 3: Optimize query cache
echo "query_cache_size=10M" >> .env
```

### 2.3 Database Corruption

**Detection:**
```
"database disk image is malformed"
"file is not a database"
```

**Resolution:**
```bash
# Automatic recovery script
cat > recover_database.sh << 'EOF'
#!/bin/bash
DB_NAME=$1
if [ -z "$DB_NAME" ]; then
  echo "Usage: ./recover_database.sh <database_name>"
  exit 1
fi

echo "Attempting to recover $DB_NAME..."

# Try to dump what we can
sqlite3 $DB_NAME ".dump" > ${DB_NAME}.sql 2>/dev/null

if [ $? -eq 0 ]; then
  mv $DB_NAME ${DB_NAME}.corrupted
  sqlite3 $DB_NAME < ${DB_NAME}.sql
  echo "Database recovered successfully"
else
  echo "Recovery failed. Restoring from backup..."
  cp backups/${DB_NAME}.backup.latest $DB_NAME
fi
EOF

chmod +x recover_database.sh
./recover_database.sh walmart_grocery.db
```

### 2.4 Connection Pool Exhaustion

**Detection:**
```
"too many connections"
"SQLITE_BUSY: database connection pool exhausted"
```

**Resolution:**
```javascript
// Update src/database/WalmartDatabaseManager.ts
const db = new Database('walmart_grocery.db', {
  readonly: false,
  fileMustExist: true,
  timeout: 5000,
  verbose: console.log
});

// Set connection limits
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
```

---

## 3. Incident Detection & Monitoring

### 3.1 Automated Detection Script

```bash
cat > scripts/monitor_health.sh << 'EOF'
#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== System Health Check ==="

# Check WebSocket
if lsof -i:8080 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ WebSocket server running${NC}"
else
  echo -e "${RED}✗ WebSocket server DOWN${NC}"
fi

# Check API
if curl -s http://localhost:3001/health > /dev/null; then
  echo -e "${GREEN}✓ API server healthy${NC}"
else
  echo -e "${RED}✗ API server unhealthy${NC}"
fi

# Check databases
for db in walmart_grocery.db app.db crewai_enhanced.db; do
  if [ -f $db ]; then
    if sqlite3 $db "SELECT 1;" > /dev/null 2>&1; then
      echo -e "${GREEN}✓ $db accessible${NC}"
    else
      echo -e "${RED}✗ $db locked or corrupted${NC}"
    fi
  fi
done

# Check memory usage
MEM_USAGE=$(ps aux | grep node | awk '{sum+=$6} END {print sum/1024}')
if (( $(echo "$MEM_USAGE > 2048" | bc -l) )); then
  echo -e "${YELLOW}⚠ High memory usage: ${MEM_USAGE}MB${NC}"
else
  echo -e "${GREEN}✓ Memory usage normal: ${MEM_USAGE}MB${NC}"
fi

# Check port conflicts
for port in 3001 3005 3006 3007 3008 3009 3010 8080; do
  if lsof -i:$port > /dev/null 2>&1; then
    PID=$(lsof -ti:$port)
    PROCESS=$(ps -p $PID -o comm=)
    if [[ $PROCESS == *"node"* ]]; then
      echo -e "${GREEN}✓ Port $port: $PROCESS${NC}"
    else
      echo -e "${YELLOW}⚠ Port $port occupied by: $PROCESS${NC}"
    fi
  fi
done
EOF

chmod +x scripts/monitor_health.sh
```

### 3.2 Browser DevTools Indicators

```javascript
// Add to browser console for monitoring
const monitorWebSocket = () => {
  const originalWebSocket = window.WebSocket;
  window.WebSocket = function(...args) {
    console.log('WebSocket created:', args[0]);
    const ws = new originalWebSocket(...args);
    
    ws.addEventListener('open', () => console.log('✅ WebSocket connected'));
    ws.addEventListener('close', (e) => console.log('❌ WebSocket closed:', e.code, e.reason));
    ws.addEventListener('error', (e) => console.error('⚠️ WebSocket error:', e));
    ws.addEventListener('message', (e) => console.log('📨 Message:', e.data));
    
    return ws;
  };
};
monitorWebSocket();
```

---

## 4. Quick Reference Commands

### 4.1 Service Management

```bash
# Start all services
npm run dev

# Start specific services
npm run api:start        # API server
npm run websocket:start  # WebSocket server
npm run microservices    # All microservices

# Stop all services
npm run stop:all
pkill -f node

# Restart services
npm run restart:all

# Check service status
npm run status
```

### 4.2 Database Commands

```bash
# Quick database checks
sqlite3 walmart_grocery.db "PRAGMA integrity_check;"
sqlite3 walmart_grocery.db ".tables"
sqlite3 walmart_grocery.db ".schema grocery_lists"

# Backup database
cp walmart_grocery.db backups/walmart_grocery.db.$(date +%Y%m%d_%H%M%S)

# Restore database
cp backups/walmart_grocery.db.latest walmart_grocery.db

# Clear database
sqlite3 walmart_grocery.db "DELETE FROM grocery_lists; DELETE FROM items; VACUUM;"
```

### 4.3 WebSocket Debugging

```bash
# Test WebSocket connection
wscat -c ws://localhost:8080

# Monitor WebSocket traffic
tcpdump -i lo -X port 8080

# Check WebSocket process
ps aux | grep -i websocket

# Kill WebSocket process
pkill -f "websocket"
```

### 4.4 Memory Cleanup

```bash
# Clear Node.js cache
rm -rf node_modules/.cache
rm -rf .next/cache
rm -rf dist/

# Force garbage collection
node --expose-gc -e "global.gc()"

# Monitor memory usage
watch -n 1 'ps aux | grep node | head -5'
```

---

## 5. Common Development Issues

### 5.1 Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Resolution:**
```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9

# Alternative method
npx kill-port 3001

# Kill all Node processes
pkill -f node
```

### 5.2 Ollama Service Not Running

**Error:** `Failed to connect to Ollama at http://localhost:11434`

**Resolution:**
```bash
# Start Ollama
ollama serve &

# Pull required model
ollama pull qwen3:0.6b

# Test Ollama
curl http://localhost:11434/api/tags
```

### 5.3 NPM/PNPM Dependency Issues

**Error:** `Cannot find module` or `peer dependency` warnings

**Resolution:**
```bash
# Clear everything and reinstall
rm -rf node_modules package-lock.json pnpm-lock.yaml
npm cache clean --force
npm install

# Or with pnpm
pnpm store prune
pnpm install
```

### 5.4 TypeScript Compilation Errors

**Error:** `Type error: Property does not exist`

**Resolution:**
```bash
# Clear TypeScript cache
rm -rf dist/ tsconfig.tsbuildinfo

# Rebuild
npm run build

# If persists, check types
npx tsc --noEmit
```

---

## 6. Recovery Procedures

### 6.1 Complete System Reset

```bash
#!/bin/bash
# save as: scripts/full_reset.sh

echo "🔄 Starting full system reset..."

# Stop all services
pkill -f node
pkill -f ollama

# Backup databases
mkdir -p backups/$(date +%Y%m%d)
cp *.db backups/$(date +%Y%m%d)/

# Clear caches
rm -rf node_modules/.cache
rm -rf dist/
rm -rf .next/

# Reset databases
sqlite3 walmart_grocery.db < src/database/migrations/reset.sql

# Reinstall dependencies
npm ci

# Rebuild
npm run build

# Start services
npm run dev

echo "✅ System reset complete"
```

### 6.2 Database Recovery from Backup

```bash
#!/bin/bash
# save as: scripts/restore_database.sh

DB_NAME=${1:-walmart_grocery.db}
BACKUP_DIR="backups"

# List available backups
echo "Available backups:"
ls -lh $BACKUP_DIR/*.db* | tail -10

# Select backup
read -p "Enter backup filename: " BACKUP_FILE

# Restore
if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
  cp $DB_NAME $DB_NAME.before_restore
  cp $BACKUP_DIR/$BACKUP_FILE $DB_NAME
  echo "✅ Database restored from $BACKUP_FILE"
else
  echo "❌ Backup file not found"
fi
```

### 6.3 Memory Exhaustion Recovery

```bash
#!/bin/bash
# save as: scripts/fix_memory.sh

echo "🧹 Cleaning up memory..."

# Kill memory-intensive processes
pkill -f "node --max-old-space-size"

# Clear swap if used
sudo swapoff -a && sudo swapon -a

# Restart with memory limits
NODE_OPTIONS="--max-old-space-size=2048" npm run dev

# Monitor memory
watch -n 2 'free -h'
```

---

## 7. Diagnostic Scripts

### 7.1 Comprehensive Health Check

```bash
#!/bin/bash
# save as: scripts/diagnose.sh

cat > scripts/diagnose.sh << 'EOF'
#!/bin/bash

echo "🔍 Running comprehensive diagnostics..."
echo "=================================="

# Function to check service
check_service() {
  local port=$1
  local name=$2
  if lsof -i:$port > /dev/null 2>&1; then
    echo "✅ $name (port $port) is running"
  else
    echo "❌ $name (port $port) is NOT running"
  fi
}

# Check all services
check_service 3001 "API Server"
check_service 8080 "WebSocket Server"
check_service 3005 "Grocery Service"
check_service 3006 "Cache Warmer"
check_service 3007 "Pricing Service"
check_service 3008 "NLP Service"
check_service 11434 "Ollama"

# Check databases
echo -e "\n📊 Database Status:"
for db in *.db; do
  if [ -f $db ]; then
    SIZE=$(du -h $db | cut -f1)
    if sqlite3 $db "SELECT 1;" > /dev/null 2>&1; then
      echo "✅ $db ($SIZE) - OK"
    else
      echo "❌ $db ($SIZE) - LOCKED/CORRUPTED"
    fi
  fi
done

# Check memory
echo -e "\n💾 Memory Usage:"
free -h

# Check disk space
echo -e "\n💿 Disk Usage:"
df -h .

# Check Node processes
echo -e "\n🔄 Node Processes:"
ps aux | grep node | grep -v grep | wc -l
echo "Active Node processes: $(ps aux | grep node | grep -v grep | wc -l)"

# Check for errors in logs
echo -e "\n📝 Recent Errors:"
if [ -d logs ]; then
  grep -i error logs/*.log | tail -5
fi

echo -e "\n=================================="
echo "Diagnostics complete!"
EOF

chmod +x scripts/diagnose.sh
```

### 7.2 WebSocket Connection Tester

```javascript
// save as: scripts/test_websocket.js

const WebSocket = require('ws');

function testWebSocket(port = 8080) {
  console.log(`Testing WebSocket on port ${port}...`);
  
  const ws = new WebSocket(`ws://localhost:${port}`);
  
  ws.on('open', () => {
    console.log('✅ Connected successfully');
    
    // Test ping
    ws.send(JSON.stringify({ type: 'ping' }));
    
    // Test grocery update
    ws.send(JSON.stringify({
      type: 'grocery:update',
      data: { listId: 'test', items: [] }
    }));
    
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 2000);
  });
  
  ws.on('message', (data) => {
    console.log('📨 Received:', data.toString());
  });
  
  ws.on('error', (error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
  
  ws.on('close', () => {
    console.log('Connection closed');
  });
}

testWebSocket(process.argv[2] || 8080);
```

---

## 8. Escalation Path

### Level 1: Quick Fixes (< 2 minutes)
1. Restart affected service
2. Clear cache
3. Kill stuck process

### Level 2: Standard Recovery (< 10 minutes)
1. Stop all services
2. Clear all caches
3. Restart services in order
4. Run diagnostic script

### Level 3: Deep Recovery (< 30 minutes)
1. Full system reset
2. Database integrity check
3. Reinstall dependencies
4. Rebuild from source

### Level 4: Critical Recovery (> 30 minutes)
1. Restore from backup
2. Reset development environment
3. Clone fresh repository
4. Migrate data

---

## 9. Post-Incident Actions

### 9.1 Incident Log Template

```markdown
## Incident Report - [DATE]

**Issue:** [Brief description]
**Severity:** P0/P1/P2/P3
**Duration:** [Start time - End time]
**Impact:** [What was affected]

### Root Cause
[What caused the issue]

### Resolution
[Steps taken to fix]

### Prevention
[How to prevent recurrence]

### Action Items
- [ ] Update documentation
- [ ] Add monitoring
- [ ] Create test case
- [ ] Update playbook
```

### 9.2 Automated Incident Logger

```bash
#!/bin/bash
# save as: scripts/log_incident.sh

cat > scripts/log_incident.sh << 'EOF'
#!/bin/bash

INCIDENT_DIR="incidents"
mkdir -p $INCIDENT_DIR

DATE=$(date +%Y%m%d_%H%M%S)
INCIDENT_FILE="$INCIDENT_DIR/incident_$DATE.md"

echo "## Incident Report - $DATE" > $INCIDENT_FILE
echo "" >> $INCIDENT_FILE
read -p "Issue description: " ISSUE
echo "**Issue:** $ISSUE" >> $INCIDENT_FILE

echo "**Severity:** P2" >> $INCIDENT_FILE
echo "**Duration:** $(date)" >> $INCIDENT_FILE
echo "" >> $INCIDENT_FILE

read -p "What was the root cause? " CAUSE
echo "### Root Cause" >> $INCIDENT_FILE
echo "$CAUSE" >> $INCIDENT_FILE
echo "" >> $INCIDENT_FILE

read -p "How was it resolved? " RESOLUTION
echo "### Resolution" >> $INCIDENT_FILE
echo "$RESOLUTION" >> $INCIDENT_FILE

echo "✅ Incident logged to $INCIDENT_FILE"
EOF

chmod +x scripts/log_incident.sh
```

---

## 10. Prevention Strategies

### 10.1 Proactive Monitoring

```bash
# Add to package.json scripts
"monitor": "nodemon scripts/monitor_health.sh",
"monitor:dashboard": "open http://localhost:3002/monitor",
"healthcheck": "scripts/diagnose.sh"
```

### 10.2 Automated Backups

```bash
# Add to crontab
*/30 * * * * cd /path/to/project && ./scripts/backup_databases.sh
```

### 10.3 Resource Limits

```javascript
// Add to .env
NODE_OPTIONS=--max-old-space-size=2048
UV_THREADPOOL_SIZE=4
SQLITE_BUSY_TIMEOUT=5000
WEBSOCKET_MAX_CONNECTIONS=100
```

---

## Appendix A: Error Code Reference

| Error Code | Description | Quick Fix |
|------------|-------------|-----------|
| EADDRINUSE | Port in use | `lsof -ti:PORT \| xargs kill -9` |
| SQLITE_BUSY | Database locked | `fuser -k database.db` |
| ENOMEM | Out of memory | `NODE_OPTIONS="--max-old-space-size=4096"` |
| ECONNREFUSED | Connection refused | Check service is running |
| ETIMEDOUT | Operation timeout | Increase timeout values |

## Appendix B: Critical Files

- `/src/api/websocket/WalmartWebSocketServer.ts` - WebSocket server
- `/src/database/WalmartDatabaseManager.ts` - Database manager
- `/src/api/server.ts` - Main API server
- `/.env` - Environment configuration
- `/logs/` - Application logs

---

**For urgent issues, run:** `./scripts/diagnose.sh && ./scripts/full_reset.sh`