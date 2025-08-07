# 📋 Local Deployment Optimization Plan

## ⚠️ Core Principles
- **NO over-engineering** - Simple solutions only
- **Preserve <50ms query performance** - Currently at 15ms
- **Ollama concurrency limit: 2 operations** - Prevents BI degradation
- **Zero-cost implementation** - Use existing Linux tools

---

## 1️⃣ Systemd Auto-Start Services

### Current State
- Services start manually via `pnpm dev` or shell scripts
- No automatic recovery on crash/reboot

### Proposed Solution
**Simple systemd user services** (NOT system-wide to avoid permission issues)

```bash
# Location: ~/.config/systemd/user/
```

#### Files to Create:
1. **ollama.service** - Manages Ollama with 2-operation limit
2. **redis.service** - Simple Redis startup
3. **crewai-app.service** - Node.js application

#### Key Configuration:
```ini
# Ollama service with concurrency limit
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Restart=on-failure
RestartSec=10
```

### Benefits
- Auto-start on boot (optional)
- Automatic restart on crash
- Clean shutdown on system halt
- No performance impact

### Risks & Mitigation
- **Risk**: Service conflicts
- **Mitigation**: Use user services, not system services

---

## 2️⃣ Reverse Proxy Setup

### Current State
- Direct access to ports: 3000, 5173, 5178, 11434
- No unified access point

### Proposed Solution
**Nginx lightweight config** (already installed on most systems)

```nginx
# Single config file: /etc/nginx/sites-available/crewai-local
# Memory usage: <10MB
```

#### Access Points:
- `http://localhost/` → Main app (5173)
- `http://localhost/api` → Backend (3000)
- `http://localhost/walmart` → Walmart agent (5178)
- `http://localhost/ollama` → Ollama API (11434)

### Benefits
- Single access point
- Optional SSL for local development
- Better WebSocket handling
- No performance impact (adds <1ms latency)

### Risks & Mitigation
- **Risk**: Added complexity
- **Mitigation**: Single config file, optional feature

---

## 3️⃣ Ollama Optimization (2 Operations Max)

### Current State
- Can handle 2 concurrent operations well
- 3-4 operations cause BI analysis degradation

### Proposed Solution
**Hard limits with queue management**

#### Implementation:
1. **Environment Variables** (already in memory-optimize.sh):
   ```bash
   OLLAMA_NUM_PARALLEL=2
   OLLAMA_MAX_LOADED_MODELS=2
   OLLAMA_LOAD_TIMEOUT=10m
   ```

2. **Application-level queue**:
   ```typescript
   // src/core/services/OllamaQueueManager.ts
   const queue = new PQueue({ concurrency: 2 });
   ```

3. **Model preloading**:
   ```bash
   # Preload frequently used models on startup
   ollama run llama2:latest --keepalive 5m &
   ollama run codellama:latest --keepalive 5m &
   ```

### Benefits
- Prevents BI degradation
- Predictable performance
- Better resource utilization
- Queue provides graceful handling

### Risks & Mitigation
- **Risk**: Request queuing delays
- **Mitigation**: Priority queue for critical operations

---

## 4️⃣ SQLite Backup Automation

### Current State
- Manual backups via `pnpm local:backup`
- 143K emails database (3.2GB)

### Proposed Solution
**Simple cron-based backup** with rotation

#### Components:
1. **Backup script** (enhance existing):
   ```bash
   # scripts/auto-backup.sh
   - Daily incremental backups
   - Weekly full backups
   - Keep last 7 daily, 4 weekly
   - Compression with zstd (better than gzip)
   ```

2. **Cron entry** (user crontab):
   ```cron
   # Daily at 2 AM
   0 2 * * * /home/pricepro2006/CrewAI_Team/scripts/auto-backup.sh
   ```

3. **Backup verification**:
   ```bash
   # Verify backup integrity
   sqlite3 backup.db "PRAGMA integrity_check"
   ```

### Benefits
- Automated protection
- Space-efficient (zstd = 60% compression)
- No performance impact (runs at 2 AM)
- Keeps working backups

### Risks & Mitigation
- **Risk**: Disk space usage
- **Mitigation**: Rotation policy, compression

---

## 📊 Implementation Priority & Effort

| Task | Priority | Effort | Impact | Risk |
|------|----------|--------|--------|------|
| Ollama Optimization | HIGH | 2 hours | Prevents degradation | Low |
| SQLite Backups | HIGH | 1 hour | Data protection | Low |
| Systemd Services | MEDIUM | 2 hours | Convenience | Low |
| Reverse Proxy | LOW | 1 hour | Better access | Low |

---

## 🚀 Implementation Steps

### Phase 1: Critical (Do First)
1. **Ollama Optimization**
   - Update environment variables
   - Implement PQueue in application
   - Test with 2, 3, 4 concurrent operations
   - Verify BI analysis quality

2. **SQLite Backup Automation**
   - Enhance backup script with compression
   - Add rotation logic
   - Set up cron job
   - Test restore procedure

### Phase 2: Convenience (Do Second)
3. **Systemd Services**
   - Create user service files
   - Test start/stop/restart
   - Enable for auto-start (optional)
   - Document manual fallback

4. **Reverse Proxy**
   - Create nginx config
   - Test all endpoints
   - Add to documentation
   - Keep direct access as fallback

---

## ✅ Success Criteria

1. **Performance**: Query time remains <20ms (currently 15ms)
2. **Reliability**: Services auto-recover from crashes
3. **Ollama**: Max 2 concurrent operations enforced
4. **Backups**: Daily automated with verification
5. **Simplicity**: Each component < 100 lines of config

---

## 🚫 What We're NOT Doing

- ❌ Kubernetes/Docker orchestration
- ❌ Complex monitoring stacks
- ❌ Database replication
- ❌ Load balancers
- ❌ Service mesh
- ❌ Distributed tracing
- ❌ Multi-node setups

---

## 📝 Testing Plan

### Before Implementation:
- Baseline performance metrics
- Current memory usage
- BI analysis quality benchmark

### After Each Phase:
- Performance comparison
- Memory usage check
- BI analysis quality test
- Rollback procedure ready

---

## 🎯 Expected Outcomes

- **Ollama**: Stable 2-operation limit, no BI degradation
- **Backups**: Zero data loss risk
- **Services**: Optional auto-start convenience
- **Access**: Cleaner URL structure (optional)
- **Performance**: Maintained at 15ms queries
- **Cost**: Still $0/month

---

## ⏰ Estimated Timeline

- **Total time**: 6 hours
- **Phase 1**: 3 hours (Ollama + Backups)
- **Phase 2**: 3 hours (Systemd + Nginx)
- **Testing**: Included in each phase

---

## 🔄 Rollback Plan

Each optimization can be independently disabled:
1. **Ollama**: Remove env vars, restart
2. **Backups**: Disable cron job
3. **Systemd**: `systemctl --user disable` services
4. **Nginx**: Remove config, use direct ports

---

**Ready for approval to begin Phase 1 implementation.**