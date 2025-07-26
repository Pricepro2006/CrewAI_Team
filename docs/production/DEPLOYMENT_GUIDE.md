# Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the CrewAI Team system in production environments. The system is designed to be self-contained and can run on a single server or be distributed across multiple instances.

## Prerequisites

### Hardware Requirements

**Minimum Requirements:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 50 GB SSD
- Network: 1 Gbps

**Recommended Requirements:**
- CPU: 8+ cores
- RAM: 16+ GB
- Storage: 100+ GB NVMe SSD
- Network: 1 Gbps
- GPU: Optional (for faster inference)

### Software Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Node.js**: 18+ (tested with v22.15.0)
- **Docker**: 24.0+ (optional)
- **Python**: 3.8+ (for Ollama)
- **Git**: Latest version

## Deployment Options

### Option 1: Traditional Server Deployment

#### Step 1: System Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Ollama
curl https://ollama.ai/install.sh | sh

# Install system dependencies
sudo apt install -y build-essential python3-pip sqlite3
```

#### Step 2: Application Setup

```bash
# Clone repository
git clone https://github.com/your-org/CrewAI_Team.git
cd CrewAI_Team

# Install dependencies
pnpm install
pnpm approve-builds

# Initialize production database
pnpm run init:production-db

# Build application
pnpm run build
```

#### Step 3: Ollama Model Setup

```bash
# Start Ollama service
sudo systemctl start ollama
sudo systemctl enable ollama

# Pull required models
ollama pull qwen3:14b
ollama pull qwen3:8b
ollama pull nomic-embed-text

# Verify models
ollama list
```

#### Step 4: Environment Configuration

Create `/home/user/CrewAI_Team/.env`:

```bash
# Production environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_PATH=/var/lib/crewai/app.db

# Ollama
OLLAMA_URL=http://localhost:11434

# ChromaDB
CHROMA_PATH=/var/lib/crewai/chroma
CHROMA_HOST=localhost
CHROMA_PORT=8000

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/crewai

# Security
JWT_SECRET=your-secure-jwt-secret-here-change-this
```

#### Step 5: System Service Setup

Create `/etc/systemd/system/crewai-team.service`:

```ini
[Unit]
Description=CrewAI Team Application
After=network.target ollama.service

[Service]
Type=simple
User=crewai
Group=crewai
WorkingDirectory=/home/crewai/CrewAI_Team
ExecStart=/usr/bin/node dist/api/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/home/crewai/CrewAI_Team/.env

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable crewai-team
sudo systemctl start crewai-team
```

#### Step 6: Reverse Proxy Setup (Nginx)

Install and configure Nginx:

```bash
sudo apt install nginx

# Create configuration
sudo tee /etc/nginx/sites-available/crewai-team << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Static files
    location /static {
        alias /home/crewai/CrewAI_Team/dist/client;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/crewai-team /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 7: SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### Option 2: Docker Deployment

#### Step 1: Create Dockerfile

```dockerfile
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache python3 py3-pip build-base sqlite

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build application
RUN pnpm run build

# Create non-root user
RUN addgroup -g 1001 -S crewai
RUN adduser -S crewai -u 1001 -G crewai

# Create data directories
RUN mkdir -p /app/data/logs /app/data/chroma
RUN chown -R crewai:crewai /app

USER crewai

EXPOSE 3000

CMD ["node", "dist/api/server.js"]
```

#### Step 2: Create Docker Compose

```yaml
version: '3.8'

services:
  crewai-team:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/app.db
      - OLLAMA_URL=http://ollama:11434
      - CHROMA_PATH=/app/data/chroma
      - LOG_LEVEL=info
      - JWT_SECRET=your-secure-jwt-secret-here
    volumes:
      - ./data:/app/data
      - ./logs:/app/data/logs
    depends_on:
      - ollama
      - chroma
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - CHROMA_SERVER_HOST=0.0.0.0
      - CHROMA_SERVER_PORT=8000
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - crewai-team
    restart: unless-stopped

volumes:
  ollama_data:
  chroma_data:
```

#### Step 3: Deploy with Docker

```bash
# Build and start services
docker-compose up --build -d

# Pull Ollama models
docker-compose exec ollama ollama pull qwen3:14b
docker-compose exec ollama ollama pull qwen3:8b
docker-compose exec ollama ollama pull nomic-embed-text

# Check logs
docker-compose logs -f crewai-team
```

### Option 3: Cloud Deployment (AWS/GCP/Azure)

#### AWS Deployment

1. **EC2 Instance Setup**
   ```bash
   # Launch EC2 instance (t3.large or larger)
   # Install Docker and Docker Compose
   # Follow Docker deployment steps
   ```

2. **RDS Database** (Optional)
   ```bash
   # Create RDS PostgreSQL instance
   # Update DATABASE_URL in environment
   ```

3. **Load Balancer Setup**
   ```bash
   # Create Application Load Balancer
   # Configure health checks
   # Set up SSL termination
   ```

#### GCP Deployment

1. **Compute Engine**
   ```bash
   # Create VM instance
   # Install dependencies
   # Follow traditional deployment
   ```

2. **Cloud Run** (Container)
   ```bash
   # Build Docker image
   # Deploy to Cloud Run
   # Configure environment variables
   ```

#### Azure Deployment

1. **Container Instances**
   ```bash
   # Create resource group
   # Deploy container group
   # Configure networking
   ```

## Configuration Management

### Environment Variables

Create a secure configuration management system:

```bash
# Development
cp .env.example .env.development

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

### Secrets Management

Use environment-specific secrets:

```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Store in secure location
echo "JWT_SECRET=your-generated-secret" >> .env.production
```

## Monitoring & Logging

### System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor resources
htop                    # CPU and memory
iotop                   # Disk I/O
nethogs                 # Network usage
```

### Application Monitoring

```bash
# View application logs
sudo journalctl -u crewai-team -f

# View application-specific logs
tail -f /var/log/crewai/app.log
tail -f /var/log/crewai/error.log
```

### Log Rotation

Configure log rotation:

```bash
sudo tee /etc/logrotate.d/crewai-team << 'EOF'
/var/log/crewai/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 crewai crewai
    postrotate
        systemctl reload crewai-team
    endscript
}
EOF
```

## Backup & Recovery

### Database Backup

```bash
# Create backup script
cat > /home/crewai/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/crewai"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup SQLite database
cp /var/lib/crewai/app.db $BACKUP_DIR/app_$DATE.db

# Backup ChromaDB
tar -czf $BACKUP_DIR/chroma_$DATE.tar.gz -C /var/lib/crewai chroma/

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /home/crewai/backup.sh

# Add to crontab
echo "0 2 * * * /home/crewai/backup.sh" | crontab -
```

### Disaster Recovery

```bash
# Create disaster recovery plan
cat > /home/crewai/restore.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/crewai"
RESTORE_DATE=$1

if [ -z "$RESTORE_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    exit 1
fi

# Stop services
sudo systemctl stop crewai-team

# Restore database
cp $BACKUP_DIR/app_$RESTORE_DATE.db /var/lib/crewai/app.db

# Restore ChromaDB
tar -xzf $BACKUP_DIR/chroma_$RESTORE_DATE.tar.gz -C /var/lib/crewai/

# Start services
sudo systemctl start crewai-team
EOF

chmod +x /home/crewai/restore.sh
```

## Security Hardening

### System Security

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Application Security

```bash
# Set proper file permissions
sudo chown -R crewai:crewai /home/crewai/CrewAI_Team
sudo chmod -R 755 /home/crewai/CrewAI_Team
sudo chmod 600 /home/crewai/CrewAI_Team/.env

# Secure database
sudo chmod 600 /var/lib/crewai/app.db
```

## Performance Optimization

### System Tuning

```bash
# Optimize for AI workloads
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.dirty_ratio=15' >> /etc/sysctl.conf
echo 'vm.dirty_background_ratio=5' >> /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

### Application Tuning

```bash
# Optimize Node.js
export NODE_OPTIONS="--max-old-space-size=4096"

# Optimize Ollama
export OLLAMA_NUM_PARALLEL=4
export OLLAMA_MAX_LOADED_MODELS=2
```

## Health Checks

### System Health Check Script

```bash
cat > /home/crewai/health-check.sh << 'EOF'
#!/bin/bash

# Check services
systemctl is-active --quiet crewai-team || echo "CRITICAL: CrewAI Team service is down"
systemctl is-active --quiet ollama || echo "CRITICAL: Ollama service is down"
systemctl is-active --quiet nginx || echo "CRITICAL: Nginx service is down"

# Check disk space
DISK_USAGE=$(df /var/lib/crewai | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "WARNING: Disk usage is at ${DISK_USAGE}%"
fi

# Check memory
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "WARNING: Memory usage is at ${MEMORY_USAGE}%"
fi

# Check API health
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
if [ $HTTP_STATUS -ne 200 ]; then
    echo "CRITICAL: API health check failed with status $HTTP_STATUS"
fi
EOF

chmod +x /home/crewai/health-check.sh

# Add to crontab for monitoring
echo "*/5 * * * * /home/crewai/health-check.sh" | crontab -
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   # Check logs
   sudo journalctl -u crewai-team -n 50
   
   # Check configuration
   node -c dist/api/server.js
   ```

2. **Database Connection Issues**
   ```bash
   # Check permissions
   ls -la /var/lib/crewai/
   
   # Test database
   sqlite3 /var/lib/crewai/app.db ".tables"
   ```

3. **Ollama Model Issues**
   ```bash
   # Check Ollama status
   ollama list
   
   # Test model
   ollama run qwen3:8b "Hello"
   ```

### Log Analysis

```bash
# Analyze error patterns
grep -i error /var/log/crewai/app.log | tail -20

# Check performance issues
grep -i "slow operation" /var/log/crewai/app.log

# Monitor memory usage
grep -i "memory" /var/log/crewai/app.log
```

## Maintenance

### Regular Maintenance Tasks

1. **Daily**
   - Check system health
   - Review error logs
   - Monitor resource usage

2. **Weekly**
   - Update security patches
   - Clean up old logs
   - Test backup restoration

3. **Monthly**
   - Update dependencies
   - Performance optimization
   - Security audit

### Update Process

```bash
# Update application
cd /home/crewai/CrewAI_Team
git pull origin main
pnpm install
pnpm run build

# Restart services
sudo systemctl restart crewai-team
```

## Support & Maintenance

### Getting Help

1. **Documentation** - Check production documentation
2. **Logs** - Review application and system logs
3. **Health Checks** - Run diagnostic scripts
4. **Community** - GitHub issues and discussions

### Professional Support

For production deployments, consider:
- Managed hosting services
- Professional monitoring tools
- Dedicated support contracts
- Custom development services

---

**Deployment Status**: ✅ Production Ready  
**Last Updated**: {{ current_date }}  
**Version**: 1.0.0