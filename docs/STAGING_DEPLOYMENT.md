# Staging Deployment Guide

## Overview

This guide provides instructions for deploying the CrewAI Team application to a staging environment using Docker Compose.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- At least 8GB RAM available
- 20GB disk space
- Ports 3001, 3002, 5001, 8000, and 11434 available

## Quick Start

```bash
# Run the automated deployment script
./scripts/deploy-staging.sh
```

## Manual Deployment Steps

### 1. Environment Setup

Create a `.env.staging` file with appropriate configuration:

```bash
NODE_ENV=staging
PORT=3001
WS_PORT=3002
DATABASE_PATH=./data/app.db
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=phi3:mini
CHROMA_HOST=chromadb
CHROMA_PORT=8000
```

### 2. Build Images

```bash
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml build
```

### 3. Start Services

```bash
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml up -d
```

### 4. Install Required Models

```bash
# Install Phi-3 mini model
docker exec ai-agent-ollama ollama pull phi3:mini

# Install embedding model
docker exec ai-agent-ollama ollama pull nomic-embed-text
```

### 5. Verify Deployment

Check service health:

```bash
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml ps
```

Test endpoints:

```bash
# API Health
curl http://localhost:3001/health

# Ollama
curl http://localhost:11434/api/tags

# ChromaDB
curl http://localhost:8000/api/v1/heartbeat
```

## Service URLs

- **Frontend**: http://localhost:3001
- **API**: http://localhost:3001/trpc
- **WebSocket**: ws://localhost:3002
- **Ollama**: http://localhost:11434
- **ChromaDB**: http://localhost:8000

## Monitoring

### View Logs

```bash
# All services
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml logs -f app
```

### Check Resource Usage

```bash
docker stats
```

## Troubleshooting

### Port Conflicts

If you encounter port conflicts:

1. Check what's using the port:

   ```bash
   lsof -i :3001
   ```

2. Either stop the conflicting service or modify the port in `docker-compose.staging.yml`

### Service Not Starting

1. Check logs for specific service:

   ```bash
   docker-compose logs [service-name]
   ```

2. Ensure all required environment variables are set in `.env.staging`

3. Verify Docker has enough resources allocated

### Database Issues

1. Check database file permissions:

   ```bash
   ls -la data/app.db*
   ```

2. Run database checkpoint if needed:
   ```bash
   node scripts/checkpoint-wal.js
   ```

### Model Loading Issues

If Ollama models fail to load:

1. Check Ollama logs:

   ```bash
   docker logs ai-agent-ollama
   ```

2. Manually pull models:
   ```bash
   docker exec -it ai-agent-ollama ollama pull phi3:mini
   ```

## Maintenance

### Backup Database

```bash
# Create backup
cp data/app.db data/app.db.backup.$(date +%Y%m%d_%H%M%S)
```

### Update Application

```bash
# Pull latest changes
git pull

# Rebuild and redeploy
./scripts/deploy-staging.sh
```

### Clean Up

```bash
# Stop all services
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml down

# Remove volumes (WARNING: This deletes data)
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.staging.yml down -v
```

## Security Considerations

1. **Environment Variables**: Never commit `.env.staging` to version control
2. **Ports**: In production, use a reverse proxy instead of exposing ports directly
3. **Secrets**: Generate strong secrets for JWT_SECRET and SESSION_SECRET
4. **Updates**: Regularly update Docker images for security patches

## Performance Tuning

### Database Optimization

```bash
# Run periodic optimization
node scripts/checkpoint-wal.js
```

### Docker Resource Limits

Edit `docker-compose.staging.yml` to set resource limits:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 4G
```

### Monitoring Performance

Use the built-in performance monitoring:

```bash
# View performance metrics in logs
docker-compose logs app | grep PERFORMANCE
```

## Next Steps

After successful staging deployment:

1. Run integration tests: `./scripts/integration-test.sh`
2. Perform user acceptance testing
3. Monitor logs and metrics for 24-48 hours
4. Document any issues or improvements needed
5. Prepare for production deployment

## Support

For issues or questions:

- Check application logs first
- Review error messages in browser console
- Consult the main [README.md](../README.md)
- Create an issue in the project repository
