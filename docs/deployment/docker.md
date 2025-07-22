# Docker Deployment Guide

## Overview

This guide covers deploying CrewAI Team using Docker and Docker Compose, including development and production configurations.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ available memory
- 10GB+ available storage

## Quick Start

### Using Docker Compose

```bash
# Clone repository
git clone https://github.com/crewai/team.git
cd team

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env

# Build and start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

## Dockerfile

### Multi-stage Production Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Copy static files
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs migrations ./migrations

# Create data directory
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node healthcheck.js || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

## Docker Compose Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: crewai-app
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: sqlite:///app/data/crewai.db
      REDIS_URL: redis://redis:6379
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - redis
    networks:
      - crewai-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: crewai-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    networks:
      - crewai-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: crewai-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - app
    networks:
      - crewai-network

volumes:
  redis-data:
  postgres-data:

networks:
  crewai-network:
    driver: bridge
```

### docker-compose.prod.yml

```yaml
version: '3.8'

services:
  app:
    image: crewai/team:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/crewai
      REDIS_CLUSTER: redis-cluster:6379
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    image: postgres:14-alpine
    container_name: crewai-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: crewai
      POSTGRES_USER: crewai
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - crewai-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U crewai"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-cluster:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes
    deploy:
      replicas: 3
```

## Environment Configuration

### .env file for Docker

```env
# Application
NODE_ENV=production
API_PORT=3000
WS_PORT=3001

# Database
DATABASE_URL=sqlite:///app/data/crewai.db
# For PostgreSQL:
# DATABASE_URL=postgresql://crewai:password@postgres:5432/crewai

# Redis
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
SESSION_SECRET=your-session-secret-change-this

# API Keys
WEBSEARCH_API_KEY=your-api-key
OPENAI_API_KEY=your-api-key

# Features
ENABLE_BUSINESS_SEARCH=true
ENABLE_RATE_LIMITING=true
ENABLE_METRICS=true

# Logging
LOG_LEVEL=info
LOG_DIR=/app/logs
```

## Nginx Configuration

### nginx/nginx.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
    }

    upstream websocket {
        ip_hash;
        server app:3001;
    }

    server {
        listen 80;
        server_name _;

        # Redirect to HTTPS in production
        # return 301 https://$host$request_uri;

        location / {
            proxy_pass http://api;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location /ws {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            
            # WebSocket specific
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }

        location /health {
            access_log off;
            proxy_pass http://api/api/health;
        }
    }
}
```

## Building and Running

### Development Mode

```bash
# Build with development dependencies
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

# Start in development mode with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Run with specific services
docker-compose up app redis
```

### Production Mode

```bash
# Build production image
docker build -t crewai-team:latest .

# Tag for registry
docker tag crewai-team:latest myregistry.com/crewai-team:latest

# Push to registry
docker push myregistry.com/crewai-team:latest

# Run in production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## Docker Commands Reference

### Container Management

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f app
docker-compose logs --tail=100 app

# Execute commands in container
docker-compose exec app node --version
docker-compose exec app pnpm migrate

# Restart services
docker-compose restart app
docker-compose restart

# Stop services
docker-compose stop
docker-compose down # Also removes containers
```

### Debugging

```bash
# Enter container shell
docker-compose exec app sh

# Check container resource usage
docker stats crewai-app

# Inspect container
docker inspect crewai-app

# View container processes
docker-compose top

# Check volumes
docker volume ls
docker volume inspect team_redis-data
```

## Health Checks

### healthcheck.js

```javascript
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/api/health',
  timeout: 2000
};

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  if (res.statusCode == 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.error('Health check error:', err);
  process.exit(1);
});

healthCheck.end();
```

## Backup and Restore

### Backup Script

```bash
#!/bin/bash
# docker-backup.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup database
docker-compose exec -T app tar czf - /app/data > "$BACKUP_DIR/data.tar.gz"

# Backup Redis
docker-compose exec -T redis redis-cli SAVE
docker-compose exec -T redis tar czf - /data/dump.rdb > "$BACKUP_DIR/redis.tar.gz"

# Backup environment
cp .env "$BACKUP_DIR/.env"
cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml"

echo "Backup completed: $BACKUP_DIR"
```

### Restore Script

```bash
#!/bin/bash
# docker-restore.sh

BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: ./docker-restore.sh <backup-directory>"
  exit 1
fi

# Stop services
docker-compose stop

# Restore database
docker-compose run --rm app tar xzf - < "$BACKUP_DIR/data.tar.gz"

# Restore Redis
docker-compose run --rm redis tar xzf - < "$BACKUP_DIR/redis.tar.gz"

# Start services
docker-compose up -d

echo "Restore completed from: $BACKUP_DIR"
```

## Security Best Practices

### 1. Use Secrets Management

```yaml
# docker-compose with secrets
services:
  app:
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
    secrets:
      - jwt_secret

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

### 2. Limit Container Capabilities

```yaml
services:
  app:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
```

### 3. Read-only File System

```yaml
services:
  app:
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
```

## Monitoring

### Docker Compose with Monitoring

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3030:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   docker-compose logs app
   
   # Check exit code
   docker-compose ps
   ```

2. **Permission issues**
   ```bash
   # Fix ownership
   docker-compose exec app chown -R nodejs:nodejs /app/data
   ```

3. **Out of memory**
   ```bash
   # Increase memory limits
   docker-compose down
   # Edit docker-compose.yml memory limits
   docker-compose up -d
   ```

4. **Network issues**
   ```bash
   # Recreate network
   docker-compose down
   docker network prune
   docker-compose up -d
   ```

### Debug Mode

```yaml
# docker-compose.debug.yml
services:
  app:
    build:
      target: development
    environment:
      NODE_ENV: development
      DEBUG: 'crewai:*'
    volumes:
      - .:/app
      - /app/node_modules
    command: ["node", "--inspect=0.0.0.0:9229", "dist/index.js"]
    ports:
      - "9229:9229" # Node.js debugger
```

## Next Steps

1. Set up [CI/CD Pipeline](./ci-cd.md) for automated Docker builds
2. Configure [Kubernetes](./kubernetes.md) for production orchestration
3. Implement [Monitoring](./monitoring.md) for container metrics
4. Review [Security](./security.md) hardening for containers