# Production Deployment Without Compilation

This directory contains scripts to deploy the CrewAI Email Pipeline without requiring npm install or compilation of native modules (specifically better-sqlite3).

## Overview

The deployment approach:
1. Uses the pre-built `dist` folder from development
2. Bypasses `npm install` to avoid Python distutils dependency
3. Runs in development mode without Redis (using SKIP_REDIS flag)
4. Creates SystemD services for production deployment

## Scripts

### 1. `deploy-without-compilation.sh`
Main deployment script that:
- Validates the existing dist build
- Creates production environment configuration
- Sets up SystemD service with security hardening
- Creates monitoring and health check scripts
- Starts the service without Redis dependency

### 2. `copy-minimal-deps.sh`
Helper script to manage dependencies:
- Option 1: Copy node_modules from another installation
- Option 2: Install with --ignore-scripts flag
- Option 3: Run in minimal mode with mocked dependencies

### 3. `test-deployment.sh`
Comprehensive test suite that validates:
- Pre-deployment requirements
- Service deployment status
- API endpoint functionality
- Database connectivity
- Performance metrics
- Error handling

## Quick Start

1. **Ensure the project is built:**
   ```bash
   cd /home/pricepro2006/CrewAI_Team
   npm run build:production
   ```

2. **Run the deployment:**
   ```bash
   ./deployment/production-bypass/deploy-without-compilation.sh
   ```

3. **Test the deployment:**
   ```bash
   ./deployment/production-bypass/test-deployment.sh
   ```

## Service Management

After deployment, use these commands:

```bash
# Start service
sudo systemctl start crewai-email-pipeline

# Stop service
sudo systemctl stop crewai-email-pipeline

# Restart service
sudo systemctl restart crewai-email-pipeline

# View status
sudo systemctl status crewai-email-pipeline

# View logs
sudo journalctl -u crewai-email-pipeline -f

# Monitor service
/home/pricepro2006/CrewAI_Team/scripts/monitor-service.sh
```

## Configuration

The deployment creates `.env.production` with:
- SQLite database (no PostgreSQL required)
- Redis disabled (SKIP_REDIS=true)
- Local Ollama connection
- Production logging configuration

## Limitations

Running without full dependencies means:
- No Redis queue management (uses in-memory fallback)
- Limited performance under high load
- Some advanced features may be unavailable

## Troubleshooting

### Service Won't Start
1. Check logs: `sudo journalctl -u crewai-email-pipeline -n 100`
2. Verify dist folder: `ls -la dist/api/server.js`
3. Check Node.js: `node --version` (needs v18+)

### API Not Responding
1. Check port: `ss -tlnp | grep 3001`
2. Test health: `curl http://localhost:3001/api/health`
3. Review environment: `cat .env.production`

### Database Issues
1. Verify database exists: `ls -la data/crewai.db`
2. Check permissions: `ls -la data/`
3. Copy from root if needed: `cp crewai.db data/`

## Production Considerations

For full production deployment:
1. Install Redis for proper queue management
2. Consider installing Python distutils for full npm install
3. Set up proper monitoring and alerting
4. Configure log rotation
5. Implement backup strategies

## Security Notes

The SystemD service includes:
- NoNewPrivileges protection
- Private /tmp directory
- Read-only system directories
- Resource limits (4GB RAM, 200% CPU)
- Restricted file access

## Next Steps

After successful deployment:
1. Monitor service health for 24 hours
2. Set up automated backups
3. Configure monitoring alerts
4. Plan for Redis installation when possible
5. Document any custom configurations
EOF