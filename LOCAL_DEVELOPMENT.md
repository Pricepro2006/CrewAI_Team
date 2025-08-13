# Local Development Guide

Simple, practical guide for local development - no enterprise complexity.

## 🚀 Quick Start

```bash
# One-command setup
./dev-quick-start.sh

# Start development
pnpm dev
```

## 📋 Available Commands

### Service Management
```bash
# Check service status
pnpm local:services status

# Start/stop services manually  
pnpm local:services start
pnpm local:services stop
pnpm local:services restart

# Health check
pnpm local:health
```

### Development
```bash
# Start development servers
pnpm dev                    # Full stack
pnpm dev:server            # Backend only
pnpm dev:client            # Frontend only
pnpm dev:client:walmart    # Walmart agent (port 5178)
```

### Testing
```bash
pnpm test                  # Unit tests
pnpm test:e2e              # End-to-end tests
pnpm test:walmart-browsers # Walmart agent browser tests
pnpm typecheck             # TypeScript validation
```

### Maintenance
```bash
pnpm local:backup          # Backup databases
pnpm local:optimize        # Optimize memory usage
pnpm db:backup             # Enhanced database backup
```

## 🔧 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Main application |
| Walmart Agent | http://localhost:5178/walmart | Grocery pricing |
| API Server | http://localhost:3000 | Backend API |
| Ollama | http://localhost:11434 | Local LLM |
| Redis | localhost:6379 | Cache & sessions |

## ⚡ Performance Notes

- **Query Response Time**: <50ms (maintained)
- **Email Database**: 143,000+ emails optimized
- **Memory Usage**: Optimized for local development
- **Hot Reload**: Enabled for fast development

## 🗃️ Database Management

```bash
# Database operations
pnpm db:backup             # Create backup
pnpm db:migrate            # Run migrations
pnpm db:admin              # Admin tools
```

## 🔧 Optional: Auto-start Services

For services that start automatically on boot:

```bash
# Install systemd services (optional)
sudo ./systemd/install-services.sh

# Enable auto-start
sudo systemctl enable ollama-local redis-local
```

## 🧠 Memory Optimization

If you need to reduce memory usage:

```bash
pnpm local:optimize
```

This will:
- Optimize Ollama model loading
- Set memory limits for services  
- Configure parallel processing limits
- Maintain <50ms query performance

## 🛠️ Troubleshooting

### Services Won't Start
```bash
# Check what's using ports
lsof -i :3000
lsof -i :5173
lsof -i :11434

# Kill competing processes
pnpm local:services stop
```

### Memory Issues
```bash
# Check memory usage
free -h

# Optimize memory
pnpm local:optimize

# Restart services
pnpm local:services restart
```

### Database Issues
```bash
# Check database integrity
pnpm db:admin

# Restore from backup
ls data/backups/
cp data/backups/[backup-file] data/crewai_enhanced.db
```

## 📁 Project Structure

```
CrewAI_Team/
├── src/                   # Application source (DO NOT TOUCH)
├── data/                  # Databases & backups
├── scripts/               # Utility scripts
├── systemd/               # Optional service files
├── local-services.sh      # Service management
├── dev-quick-start.sh     # One-command setup
├── memory-optimize.sh     # Memory optimization
└── package.json           # NPM scripts
```

## 🎯 Development Workflow

1. **Start Development**:
   ```bash
   ./dev-quick-start.sh
   pnpm dev
   ```

2. **Make Changes**: Edit files in `src/` - hot reload enabled

3. **Test Changes**:
   ```bash
   pnpm test
   pnpm typecheck
   ```

4. **Daily Backup**:
   ```bash
   pnpm local:backup
   ```

## 🚫 What Was Removed

- ❌ Kubernetes configurations ($3000/month)
- ❌ Enterprise monitoring (Prometheus/Grafana)
- ❌ Complex multi-environment configs
- ❌ Over-engineered Docker setups
- ❌ Unnecessary documentation files

## ✅ What Was Kept

- ✅ All application source code
- ✅ Existing performance optimizations
- ✅ Current architecture (React + tRPC + Node.js + SQLite)
- ✅ Fast development workflow
- ✅ Comprehensive test suite
- ✅ Database with 143K emails