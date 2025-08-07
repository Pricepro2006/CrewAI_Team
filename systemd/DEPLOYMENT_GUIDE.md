# Walmart Grocery Agent - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Walmart Grocery Agent microservices suite using systemd with production-ready configurations, monitoring, and security hardening.

## Architecture

The system consists of 6 microservices managed by systemd:

1. **walmart-cache-warmer** (Port 3006) - Cache warming and management
2. **walmart-pricing** (Port 3007) - Price fetching and caching
3. **walmart-nlp-queue** (Port 3008) - Natural language processing queue
4. **walmart-api-server** (Port 3000) - Main API server
5. **walmart-websocket** (Port 8080) - WebSocket connections
6. **walmart-memory-monitor** (Port 3009) - System monitoring

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+ / CentOS 8+ / RHEL 8+
- **CPU**: 4+ cores recommended
- **Memory**: 8GB+ RAM recommended
- **Storage**: 20GB+ available disk space
- **Network**: Internet access for package installation

### Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install -y redis-server

# Install Nginx (optional, for reverse proxy)
sudo apt-get install -y nginx

# Install monitoring tools (optional)
sudo apt-get install -y prometheus prometheus-node-exporter
```

## Quick Deployment

### 1. Run Automated Deployment

The fastest way to deploy is using the automated deployment script:

```bash
# Clone repository
git clone https://github.com/pricepro2006/CrewAI_Team.git
cd CrewAI_Team

# Make deployment script executable
chmod +x systemd/scripts/deploy-walmart-grocery.sh

# Run deployment (requires sudo)
sudo systemd/scripts/deploy-walmart-grocery.sh
```

This script will:
- Create system user and directories
- Deploy application files
- Install systemd services
- Configure environment
- Setup logging and monitoring
- Start all services

### 2. Verify Deployment

```bash
# Check service status
systemctl status walmart-grocery.target

# Check individual services
systemctl status walmart-api-server
systemctl status walmart-websocket

# View logs
journalctl -u walmart-grocery.target -f

# Run health check
/opt/walmart-grocery/scripts/health-check.sh
```

## Manual Deployment

If you prefer manual deployment or need to customize the process:

### 1. Create System User

```bash
sudo groupadd --system walmart-grocery
sudo useradd --system --gid walmart-grocery \
             --home-dir /opt/walmart-grocery \
             --shell /bin/false \
             --comment "Walmart Grocery Service User" \
             walmart-grocery
```

### 2. Create Directory Structure

```bash
sudo mkdir -p /opt/walmart-grocery
sudo mkdir -p /etc/walmart-grocery
sudo mkdir -p /var/log/walmart-grocery
sudo mkdir -p /var/backups/walmart-grocery

# Set ownership
sudo chown walmart-grocery:walmart-grocery /opt/walmart-grocery
sudo chown walmart-grocery:walmart-grocery /var/log/walmart-grocery
sudo chown walmart-grocery:walmart-grocery /var/backups/walmart-grocery
sudo chown root:root /etc/walmart-grocery

# Set permissions
sudo chmod 755 /opt/walmart-grocery
sudo chmod 750 /etc/walmart-grocery
sudo chmod 755 /var/log/walmart-grocery
sudo chmod 750 /var/backups/walmart-grocery
```

### 3. Deploy Application Files

```bash
# Copy application files
sudo cp -r src /opt/walmart-grocery/
sudo cp package.json /opt/walmart-grocery/
sudo cp pnpm-lock.yaml /opt/walmart-grocery/

# Install dependencies
cd /opt/walmart-grocery
sudo -u walmart-grocery npm install --production

# Set proper ownership
sudo chown -R walmart-grocery:walmart-grocery /opt/walmart-grocery
```

### 4. Install Systemd Services

```bash
# Copy service files
sudo cp systemd/services/*.service /etc/systemd/system/
sudo cp systemd/services/walmart-grocery.target /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable services
sudo systemctl enable walmart-grocery.target
sudo systemctl enable walmart-{cache-warmer,pricing,nlp-queue,api-server,websocket,memory-monitor}
```

### 5. Create Environment Configuration

```bash
sudo tee /etc/walmart-grocery/.env << 'EOF'
NODE_ENV=production
LOG_LEVEL=info
LOG_DIR=/var/log/walmart-grocery

# Database
DATABASE_PATH=/opt/walmart-grocery/data/grocery.db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# API Configuration
API_HOST=0.0.0.0
CORS_ORIGIN=*
REQUEST_TIMEOUT=30000

# Cache Configuration
CACHE_TTL=3600
CACHE_MAX_SIZE=100

# Monitoring
HEALTH_CHECK_INTERVAL=60000
METRICS_ENABLED=true

# Security (generate new secrets)
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
EOF

sudo chmod 640 /etc/walmart-grocery/.env
sudo chown root:walmart-grocery /etc/walmart-grocery/.env
```

### 6. Start Services

```bash
# Start all services
sudo systemctl start walmart-grocery.target

# Check status
sudo systemctl status walmart-grocery.target
```

## Configuration

### Service Resource Limits

Each service has configured resource limits:

| Service | Memory Limit | CPU Limit | File Descriptors |
|---------|--------------|-----------|------------------|
| Cache Warmer | 256MB | 25% | 1024 |
| Pricing | 512MB | 50% | 2048 |
| NLP Queue | 384MB | 40% | 1536 |
| API Server | 1GB | 100% | 4096 |
| WebSocket | 512MB | 75% | 3072 |
| Memory Monitor | 128MB | 10% | 512 |

### Security Hardening

All services include security hardening:
- `NoNewPrivileges=true`
- `PrivateTmp=true`
- `PrivateDevices=true`
- `ProtectSystem=strict`
- `ProtectHome=true`
- `RestrictNamespaces=true`
- `SystemCallArchitectures=native`

### Service Dependencies

Services start in proper order:
1. Redis (external dependency)
2. Memory Monitor (independent)
3. Cache Warmer (depends on Redis)
4. Pricing Service (depends on Cache Warmer)
5. NLP Queue (depends on Redis)
6. API Server (depends on Pricing, Cache Warmer)
7. WebSocket (depends on API Server)

## Monitoring and Alerting

### Setup Prometheus Monitoring

```bash
# Install Prometheus
sudo apt-get install -y prometheus

# Copy Prometheus configuration
sudo cp systemd/configs/prometheus.yml /etc/prometheus/
sudo cp systemd/configs/alerts.yml /etc/prometheus/

# Restart Prometheus
sudo systemctl restart prometheus
sudo systemctl enable prometheus
```

### Setup Grafana Dashboard

```bash
# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y grafana

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# Import dashboard
# Navigate to http://localhost:3000 (admin/admin)
# Import systemd/configs/monitoring-dashboard.json
```

### Log Monitoring

Setup log rotation and monitoring:

```bash
# Setup log rotation
sudo systemd/scripts/log-rotation-setup.sh

# View aggregated logs
sudo tail -f /var/log/walmart-grocery/*.log

# Monitor specific service
sudo journalctl -u walmart-api-server -f

# View error logs
sudo tail -f /var/log/walmart-grocery/errors.log
```

## Reverse Proxy Setup

### Nginx Configuration

```bash
# Copy Nginx configuration
sudo cp systemd/configs/nginx-walmart-grocery.conf /etc/nginx/sites-available/walmart-grocery

# Enable site
sudo ln -s /etc/nginx/sites-available/walmart-grocery /etc/nginx/sites-enabled/

# Create admin password file (optional)
sudo apt-get install -y apache2-utils
sudo htpasswd -c /etc/nginx/htpasswd admin

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

Access points after Nginx setup:
- Main API: `http://localhost/api/`
- WebSocket: `ws://localhost/ws`
- Health Check: `http://localhost/health`
- Admin Monitoring: `http://localhost/admin/monitor/` (requires auth)

## Backup and Recovery

### Automated Backups

Setup automated backups:

```bash
# Make backup script executable
chmod +x systemd/scripts/backup-walmart-grocery.sh

# Setup daily incremental backup
echo "0 2 * * * root /home/pricepro2006/CrewAI_Team/systemd/scripts/backup-walmart-grocery.sh incremental" | sudo tee -a /etc/crontab

# Setup weekly full backup
echo "0 3 * * 0 root /home/pricepro2006/CrewAI_Team/systemd/scripts/backup-walmart-grocery.sh full" | sudo tee -a /etc/crontab
```

### Manual Backup

```bash
# Full backup
sudo systemd/scripts/backup-walmart-grocery.sh full

# Incremental backup
sudo systemd/scripts/backup-walmart-grocery.sh incremental

# Configuration only
sudo systemd/scripts/backup-walmart-grocery.sh config
```

### Recovery

```bash
# List available backups
ls -la /var/backups/walmart-grocery/

# Extract backup
cd /var/backups/walmart-grocery
sudo tar -xzf 20250806_120000.tar.gz

# Stop services
sudo systemctl stop walmart-grocery.target

# Restore application files
sudo cp -r 20250806_120000/application/* /opt/walmart-grocery/

# Restore configuration
sudo cp -r 20250806_120000/config/* /etc/walmart-grocery/

# Restore systemd files
sudo cp 20250806_120000/systemd/* /etc/systemd/system/

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl start walmart-grocery.target
```

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check service status
sudo systemctl status walmart-api-server

# View detailed logs
sudo journalctl -u walmart-api-server -n 50

# Check configuration
sudo nginx -t
sudo systemctl list-dependencies walmart-grocery.target
```

#### High Memory Usage

```bash
# Check memory limits
sudo systemctl show walmart-api-server | grep Memory

# Monitor memory usage
sudo systemctl status walmart-grocery.target
top -p $(pgrep -f walmart)
```

#### Permission Issues

```bash
# Check file ownership
sudo find /opt/walmart-grocery -not -user walmart-grocery -ls

# Fix ownership
sudo chown -R walmart-grocery:walmart-grocery /opt/walmart-grocery

# Check systemd user
sudo systemctl show walmart-api-server | grep User
```

#### Network/Port Issues

```bash
# Check port usage
sudo netstat -tlnp | grep -E ':(3000|3006|3007|3008|3009|8080)'

# Check firewall
sudo ufw status
sudo iptables -L

# Test connectivity
curl -f http://localhost:3000/health
```

### Performance Tuning

#### Increase File Limits

```bash
# Add to /etc/security/limits.conf
echo "walmart-grocery soft nofile 8192" | sudo tee -a /etc/security/limits.conf
echo "walmart-grocery hard nofile 16384" | sudo tee -a /etc/security/limits.conf
```

#### Optimize Redis

```bash
# Edit /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory <bytes>/maxmemory 512mb/' /etc/redis/redis.conf
sudo sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf

# Restart Redis
sudo systemctl restart redis-server
```

## Security Checklist

- [ ] Services run as non-root user
- [ ] File permissions properly configured
- [ ] Network access restricted where appropriate
- [ ] Environment files secured (640 permissions)
- [ ] Secrets properly generated and protected
- [ ] Log files access controlled
- [ ] Systemd security features enabled
- [ ] Nginx basic authentication configured for admin endpoints
- [ ] Firewall configured (if applicable)
- [ ] SSL/TLS configured for production (if applicable)

## Maintenance

### Regular Tasks

```bash
# Check service health (daily)
/opt/walmart-grocery/scripts/health-check.sh

# Review logs (weekly)
sudo journalctl -u walmart-grocery.target --since "1 week ago" | grep -E "(ERROR|WARN)"

# Check disk space (weekly)
df -h /opt/walmart-grocery /var/log/walmart-grocery /var/backups/walmart-grocery

# Update system packages (monthly)
sudo apt update && sudo apt upgrade

# Review security updates (monthly)
sudo apt list --upgradable | grep -E "(security|nodejs|nginx|redis)"
```

### Updates

```bash
# Update application
sudo systemctl stop walmart-grocery.target
cd /opt/walmart-grocery
sudo -u walmart-grocery git pull
sudo -u walmart-grocery npm install
sudo systemctl start walmart-grocery.target

# Update systemd configuration
sudo cp systemd/services/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart walmart-grocery.target
```

## Support

For additional support:

1. Check logs: `journalctl -u walmart-grocery.target -f`
2. Review monitoring: Grafana dashboard at http://localhost:3000
3. Run health checks: `/opt/walmart-grocery/scripts/health-check.sh`
4. Backup before major changes: `sudo systemd/scripts/backup-walmart-grocery.sh full`

---

**Version**: 1.0  
**Last Updated**: August 6, 2025  
**Maintainer**: CrewAI Team