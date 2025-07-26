# CrewAI Team Deployment Guide

## Overview

This guide covers deployment options, configurations, and best practices for deploying the CrewAI Team application in various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Environment Configuration](#environment-configuration)
4. [Docker Deployment](./docker.md)
5. [Kubernetes Deployment](./kubernetes.md)
6. [Cloud Deployments](./cloud-deployments.md)
7. [CI/CD Setup](./ci-cd.md)
8. [Monitoring and Logging](./monitoring.md)
9. [Security Considerations](./security.md)
10. [Troubleshooting](./troubleshooting.md)

## Prerequisites

### System Requirements

- **Node.js**: v18.0.0 or higher
- **npm/pnpm**: Latest version
- **Database**: SQLite (included) or PostgreSQL for production
- **Redis**: v6.0 or higher (for caching and rate limiting)
- **Memory**: Minimum 2GB RAM, recommended 4GB+
- **Storage**: Minimum 10GB free space

### Required Services

1. **Redis** (for distributed features)
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:alpine
   
   # Using package manager
   sudo apt-get install redis-server
   ```

2. **PostgreSQL** (optional, for production)
   ```bash
   # Using Docker
   docker run -d -p 5432:5432 \
     -e POSTGRES_PASSWORD=yourpassword \
     -e POSTGRES_DB=crewai \
     postgres:14-alpine
   ```

## Deployment Options

### 1. Single Server Deployment

Best for: Development, testing, small teams

```bash
# Clone repository
git clone https://github.com/crewai/team.git
cd team

# Install dependencies
pnpm install

# Build application
pnpm build

# Start production server
pnpm start:prod
```

### 2. Docker Deployment

Best for: Consistent environments, easy scaling

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t crewai-team .
docker run -p 3000:3000 -p 3001:3001 crewai-team
```

### 3. Kubernetes Deployment

Best for: High availability, auto-scaling, large deployments

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n crewai
```

### 4. Cloud Platform Deployments

- **AWS**: ECS, EKS, or Elastic Beanstalk
- **Google Cloud**: Cloud Run, GKE, or App Engine
- **Azure**: Container Instances, AKS, or App Service
- **Heroku**: Using container registry
- **DigitalOcean**: App Platform or Kubernetes

## Environment Configuration

### Essential Environment Variables

```env
# Application
NODE_ENV=production
PORT=3000
WS_PORT=3001

# Database
DATABASE_URL=sqlite://./data/crewai.db
# For PostgreSQL:
# DATABASE_URL=postgresql://user:password@localhost:5432/crewai

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRY=24h

# API Keys
WEBSEARCH_API_KEY=your-websearch-api-key
OPENAI_API_KEY=your-openai-api-key

# Email Processing
EMAIL_PROCESSING_ENABLED=true
EMAIL_BATCH_SIZE=100

# Business Search
ENABLE_BUSINESS_SEARCH=true
BUSINESS_CACHE_TIMEOUT=3600

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Production Configuration

Create a `.env.production` file:

```env
# Production-specific settings
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_DEBUG=false
ENABLE_SWAGGER=false

# Security
CORS_ORIGIN=https://app.crewai.com
SECURE_COOKIES=true
SESSION_SECRET=production-session-secret

# Performance
CONNECTION_POOL_SIZE=20
CACHE_TTL=3600
ENABLE_COMPRESSION=true

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

## Quick Start Scripts

### Health Check Script

```bash
#!/bin/bash
# healthcheck.sh

API_URL="${API_URL:-http://localhost:3000}"

# Check API health
API_HEALTH=$(curl -s "$API_URL/api/health" | jq -r '.status')
if [ "$API_HEALTH" != "healthy" ]; then
  echo "API is not healthy: $API_HEALTH"
  exit 1
fi

# Check WebSocket
WS_URL="${WS_URL:-ws://localhost:3001}"
# Add WebSocket check logic

echo "All services healthy"
```

### Deployment Script

```bash
#!/bin/bash
# deploy.sh

# Pull latest code
git pull origin main

# Install dependencies
pnpm install

# Run migrations
pnpm migrate

# Build application
pnpm build

# Restart services
pm2 restart crewai-team

# Verify deployment
./healthcheck.sh
```

## SSL/TLS Configuration

### Using Let's Encrypt with Nginx

```nginx
server {
    listen 80;
    server_name app.crewai.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.crewai.com;

    ssl_certificate /etc/letsencrypt/live/app.crewai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.crewai.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Performance Optimization

### 1. Enable Caching

```env
ENABLE_REDIS_CACHE=true
CACHE_TTL=3600
CACHE_MAX_SIZE=10000
```

### 2. Enable Compression

```javascript
// In app configuration
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

### 3. Database Optimization

```env
# Connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=20

# SQLite optimizations
SQLITE_WAL_MODE=true
SQLITE_CACHE_SIZE=10000
```

## Backup and Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/crewai"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Backup SQLite
cp /app/data/crewai.db "$BACKUP_DIR/crewai_$TIMESTAMP.db"

# Backup Redis
redis-cli --rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# Upload to S3 (optional)
aws s3 cp "$BACKUP_DIR/" s3://crewai-backups/ --recursive
```

### Restore Process

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

# Stop services
pm2 stop crewai-team

# Restore database
cp "$BACKUP_FILE" /app/data/crewai.db

# Restart services
pm2 start crewai-team
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use Nginx, HAProxy, or cloud load balancer
2. **Session Management**: Use Redis for shared sessions
3. **File Storage**: Use S3 or similar for shared storage
4. **Database**: Consider read replicas for heavy read loads

### Vertical Scaling

1. **CPU**: Scale based on agent processing needs
2. **Memory**: Monitor for memory leaks, scale as needed
3. **Storage**: Monitor growth rate, plan accordingly

## Security Checklist

- [ ] Change all default passwords
- [ ] Set strong JWT secret
- [ ] Enable HTTPS/WSS
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities
- [ ] Implement backup strategy
- [ ] Set up intrusion detection

## Next Steps

1. Choose your deployment method
2. Review specific deployment guide:
   - [Docker Deployment](./docker.md)
   - [Kubernetes Deployment](./kubernetes.md)
   - [Cloud Deployments](./cloud-deployments.md)
3. Set up [CI/CD Pipeline](./ci-cd.md)
4. Configure [Monitoring](./monitoring.md)
5. Review [Security Best Practices](./security.md)