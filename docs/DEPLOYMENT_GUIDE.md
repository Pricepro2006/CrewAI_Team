# Production Deployment Guide

## Overview

This guide covers the complete deployment process for the CrewAI Team system, including environment setup, database initialization, service configuration, and production optimization. The system supports multiple deployment strategies from local development to enterprise-scale production.

**Deployment Options:**
- **Local Development**: Docker Compose with hot reloading
- **Single Server**: Traditional VPS deployment with process management
- **Container Orchestration**: Kubernetes for high availability
- **Cloud Deployment**: AWS/Azure/GCP with managed services

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **CPU**: 4 cores (8 recommended)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 50GB SSD (100GB+ for production)
- **Network**: 100Mbps (1Gbps for high-volume processing)

**Software Dependencies:**
- **Node.js**: 20.11 or higher
- **Python**: 3.8+ (for email extraction scripts)
- **SQLite**: 3.44+ (or PostgreSQL for production)
- **Redis**: 6.0+ (for caching and queues)
- **Ollama**: Latest version (for LLM processing)
- **Docker**: 24.0+ (for containerized deployment)

### Environment Variables

Create a comprehensive `.env` file:

```bash
# Application Configuration
NODE_ENV=production
PORT=3001
API_BASE_URL=https://your-domain.com/api

# Database Configuration
DATABASE_URL=sqlite:./data/crewai.db
DATABASE_ENHANCED_URL=sqlite:./data/crewai_enhanced.db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODELS=llama3.2:3b,phi-4:14b
OLLAMA_TIMEOUT=120000

# ChromaDB Configuration
CHROMADB_URL=http://localhost:8000
CHROMADB_COLLECTION=crewai-embeddings

# Security Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-256-bits
CSRF_SECRET=your-csrf-secret-key
SESSION_SECRET=your-session-secret-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Microsoft Graph API (for email extraction)
MICROSOFT_CLIENT_ID=your-azure-app-client-id
MICROSOFT_CLIENT_SECRET=your-azure-app-client-secret
MICROSOFT_TENANT_ID=your-azure-tenant-id

# Email Configuration
EMAIL_BATCH_SIZE=100
EMAIL_PROCESSING_TIMEOUT=300000
EMAIL_RETRY_ATTEMPTS=3

# Performance Configuration
MAX_CONCURRENT_PROCESSING=4
CACHE_TTL=3600
QUERY_TIMEOUT=30000

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=info
LOG_FORMAT=json

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
```

## Local Development Deployment

### Quick Start with Docker Compose

1. **Clone and Setup**:
```bash
git clone https://github.com/Pricepro2006/CrewAI_Team.git
cd CrewAI_Team

# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Install dependencies
npm install
```

2. **Start Services**:
```bash
# Start all services with Docker Compose
docker-compose up -d

# Verify service health
docker-compose ps
```

3. **Initialize Database**:
```bash
# Run database migrations
npm run db:migrate

# Optional: Load sample data
npm run db:seed
```

4. **Start Development Server**:
```bash
# Start development server with hot reloading
npm run dev

# Or start individual services
npm run dev:server  # Backend only
npm run dev:client  # Frontend only
```

### Docker Compose Configuration

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=sqlite:/app/data/crewai.db
      - REDIS_URL=redis://redis:6379
      - OLLAMA_HOST=http://ollama:11434
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - redis
      - ollama
      - chromadb
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_MODELS=llama3.2:3b,phi-4:14b
    restart: unless-stopped

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chromadb_data:/chroma/chroma
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  redis_data:
  ollama_data:
  chromadb_data:
```

## Production Deployment

### Single Server Deployment

1. **Server Preparation**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install other dependencies
sudo apt install -y sqlite3 redis-server nginx python3 python3-pip
```

2. **Application Setup**:
```bash
# Clone repository
git clone https://github.com/Pricepro2006/CrewAI_Team.git /opt/crewai-team
cd /opt/crewai-team

# Install dependencies
npm ci --production

# Build application
npm run build

# Set up directories
sudo mkdir -p /var/log/crewai-team
sudo mkdir -p /var/lib/crewai-team/data
sudo chown -R $USER:$USER /var/log/crewai-team /var/lib/crewai-team
```

3. **Database Setup**:
```bash
# Initialize production database
NODE_ENV=production npm run db:migrate

# Set up database backup
sudo crontab -e
# Add: 0 2 * * * /opt/crewai-team/scripts/database-backup.sh
```

4. **Process Management with PM2**:

**ecosystem.config.js**:
```javascript
module.exports = {
  apps: [{
    name: 'crewai-team-api',
    script: 'dist/api/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/crewai-team/api-error.log',
    out_file: '/var/log/crewai-team/api-out.log',
    log_file: '/var/log/crewai-team/api-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=4096'
  }, {
    name: 'crewai-team-worker',
    script: 'dist/workers/email-processor.js',
    instances: 2,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      WORKER_TYPE: 'email-processor'
    },
    error_file: '/var/log/crewai-team/worker-error.log',
    out_file: '/var/log/crewai-team/worker-out.log',
    time: true
  }]
};
```

Start services:
```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### Nginx Configuration

**nginx.conf**:
```nginx
upstream crewai_backend {
    server 127.0.0.1:3001;
    # Add more servers for load balancing
    # server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Static Assets
    location /static/ {
        alias /opt/crewai-team/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API Routes
    location /api/ {
        proxy_pass http://crewai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://crewai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
        root /opt/crewai-team/dist/client;
        index index.html;
    }
}
```

## Kubernetes Deployment

### Kubernetes Manifests

**namespace.yaml**:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crewai-team
```

**configmap.yaml**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: crewai-config
  namespace: crewai-team
data:
  NODE_ENV: "production"
  REDIS_HOST: "redis-service"
  DATABASE_URL: "sqlite:/app/data/crewai.db"
  OLLAMA_HOST: "http://ollama-service:11434"
```

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crewai-team-api
  namespace: crewai-team
spec:
  replicas: 3
  selector:
    matchLabels:
      app: crewai-team-api
  template:
    metadata:
      labels:
        app: crewai-team-api
    spec:
      containers:
      - name: api
        image: crewai-team:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: crewai-config
        - secretRef:
            name: crewai-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: crewai-data-pvc
```

**service.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: crewai-team-service
  namespace: crewai-team
spec:
  selector:
    app: crewai-team-api
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

**ingress.yaml**:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crewai-team-ingress
  namespace: crewai-team
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: crewai-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: crewai-team-service
            port:
              number: 80
```

Deploy to Kubernetes:
```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n crewai-team
kubectl get services -n crewai-team

# View logs
kubectl logs -f deployment/crewai-team-api -n crewai-team
```

## Database Migration and Backup

### Automated Backup Script

**scripts/database-backup.sh**:
```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/crewai-team"
DB_PATH="/var/lib/crewai-team/data/crewai_enhanced.db"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup with compression
sqlite3 "$DB_PATH" ".backup $BACKUP_DIR/crewai_enhanced_$DATE.db"
gzip "$BACKUP_DIR/crewai_enhanced_$DATE.db"

# Verify backup integrity
if sqlite3 "$BACKUP_DIR/crewai_enhanced_$DATE.db.gz" "PRAGMA integrity_check;" > /dev/null 2>&1; then
    echo "Backup successful: crewai_enhanced_$DATE.db.gz"
else
    echo "Backup failed: integrity check failed"
    exit 1
fi

# Clean old backups
find "$BACKUP_DIR" -name "*.db.gz" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "$(date): Database backup completed successfully" >> /var/log/crewai-team/backup.log
```

### Migration Management

```bash
# Run database migrations
npm run db:migrate

# Check migration status
npm run db:status

# Rollback last migration (if needed)
npm run db:rollback

# Create new migration
npm run db:create-migration --name add_new_feature
```

## Monitoring and Health Checks

### Health Check Endpoints

The application provides comprehensive health check endpoints:

```bash
# Basic health check
curl http://localhost:3001/api/health

# Detailed system health
curl http://localhost:3001/api/health/system

# Email pipeline health
curl http://localhost:3001/api/health/email-pipeline

# Database health
curl http://localhost:3001/api/health/database
```

### Prometheus Metrics

**prometheus.yml**:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'crewai-team'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/api/metrics'
    scrape_interval: 10s
```

### Log Management

```bash
# Configure log rotation
sudo tee /etc/logrotate.d/crewai-team << EOF
/var/log/crewai-team/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 crewai crewai
    postrotate
        pm2 reload all
    endscript
}
EOF
```

## Performance Optimization for Production

### System Tuning

**System limits** (`/etc/security/limits.conf`):
```
crewai soft nofile 65536
crewai hard nofile 65536
crewai soft nproc 32768
crewai hard nproc 32768
```

**Kernel parameters** (`/etc/sysctl.conf`):
```
# Network optimization
net.core.somaxconn = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_fin_timeout = 30

# Memory optimization
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
```

### Node.js Optimization

```bash
# Set Node.js flags for production
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# Enable production optimizations
export NODE_ENV=production
export UV_THREADPOOL_SIZE=128
```

## Troubleshooting

### Common Issues and Solutions

1. **Database Connection Issues**:
```bash
# Check database file permissions
ls -la /var/lib/crewai-team/data/

# Test database connectivity
sqlite3 /var/lib/crewai-team/data/crewai_enhanced.db "SELECT COUNT(*) FROM emails;"
```

2. **Memory Issues**:
```bash
# Monitor memory usage
pm2 monit

# Restart application if memory usage is high
pm2 restart all
```

3. **Port Conflicts**:
```bash
# Check what's using port 3001
sudo netstat -tlnp | grep :3001

# Kill process using the port
sudo kill -9 $(sudo lsof -t -i:3001)
```

4. **SSL Certificate Issues**:
```bash
# Check certificate validity
openssl x509 -in /etc/nginx/ssl/cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew
```

## Security Considerations

### Production Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Enable firewall and configure proper rules
- [ ] Set up SSL/TLS certificates
- [ ] Configure proper file permissions
- [ ] Enable audit logging
- [ ] Set up intrusion detection
- [ ] Configure rate limiting
- [ ] Enable CSRF protection
- [ ] Implement proper authentication
- [ ] Regular security updates

### Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 3001/tcp  # Block direct access to API
```

This deployment guide provides comprehensive instructions for deploying the CrewAI Team system in various environments with proper security, monitoring, and performance optimization.