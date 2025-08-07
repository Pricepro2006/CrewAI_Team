# Walmart Grocery Agent - Nginx Microservices Configuration

## Overview

This directory contains a production-ready Nginx configuration for the Walmart Grocery Agent microservices architecture. The setup provides reverse proxy, load balancing, SSL termination, and service mesh capabilities for the grocery.local domain.

## Architecture

### Microservices Routing

| Service | Port | Route | Description |
|---------|------|-------|-------------|
| walmart-api-server | 3000 | `/api/*`, `/` | Main API Gateway |
| walmart-websocket | 8080 | `/ws/*` | WebSocket Service |
| walmart-pricing | 3007 | `/pricing/*` | Pricing Service |
| walmart-nlp-queue | 3008 | `/nlp/*` | NLP Queue Service |
| walmart-cache-warmer | 3006 | `/cache/*` | Cache Service |
| walmart-memory-monitor | 3009 | `/monitor/*` | Monitoring Service |

### Load Balancing Strategy

- **API Services**: `least_conn` - Distributes requests to least connected server
- **WebSocket**: `ip_hash` - Sticky sessions for WebSocket connections
- **Connection Pooling**: Upstream keepalive connections for performance

### Security Features

- **Rate Limiting**: Different zones for API, pricing, and NLP services
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **SSL/TLS**: Modern cipher suites, perfect forward secrecy
- **Request Filtering**: Block sensitive file access

## Files

```
nginx/
├── nginx.conf                 # Main Nginx configuration
├── sites-available/
│   └── grocery.local         # Virtual host configuration
├── sites-enabled/           # Symlinks to enabled sites
└── logs/                    # Access and error logs
```

## Quick Start

### 1. Setup

```bash
# Run the setup script
./scripts/setup-nginx-grocery.sh

# Or manual setup:
sudo apt-get install nginx
sudo systemctl enable nginx-grocery
```

### 2. Start Services

```bash
# Start all microservices first
sudo systemctl start walmart-api-server
sudo systemctl start walmart-websocket
sudo systemctl start walmart-pricing
sudo systemctl start walmart-nlp-queue
sudo systemctl start walmart-cache-warmer
sudo systemctl start walmart-memory-monitor

# Start Nginx
sudo systemctl start nginx-grocery
```

### 3. Management

```bash
# Use the management script
./scripts/manage-nginx-grocery.sh status
./scripts/manage-nginx-grocery.sh test
./scripts/manage-nginx-grocery.sh health
./scripts/manage-nginx-grocery.sh logs
```

## Configuration Details

### Rate Limiting

```nginx
# API: 100 requests/minute per IP
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;

# Pricing: 60 requests/minute per IP  
limit_req_zone $binary_remote_addr zone=pricing_limit:10m rate=60r/m;

# NLP: 30 requests/minute per IP
limit_req_zone $binary_remote_addr zone=nlp_limit:10m rate=30r/m;
```

### Health Checks

- **Nginx Health**: `https://grocery.local/health`
- **Service Health**: `https://grocery.local/health/{service}`
- **Upstream Health**: Automatic upstream health monitoring

### SSL Configuration

- **Development**: Self-signed certificates automatically generated
- **Production**: Update certificate paths in configuration
- **Protocols**: TLS 1.2, TLS 1.3
- **HSTS**: Enabled with 1-year max-age

### Caching

- **Static Assets**: 1-year cache with immutable headers
- **API Responses**: Selective caching based on content type
- **Pricing Data**: 5-minute cache for price endpoints

## Testing

### Health Check Tests

```bash
# Test all endpoints
curl -H "Host: grocery.local" http://localhost:8000/health
curl -k -H "Host: grocery.local" https://localhost/health

# Test specific services  
curl -H "Host: grocery.local" http://localhost:8000/health/api
curl -H "Host: grocery.local" http://localhost:8000/health/pricing
```

### Load Testing

```bash
# API load test
ab -n 1000 -c 10 -H "Host: grocery.local" http://localhost:8000/api/health

# WebSocket connection test
wscat -c ws://grocery.local:8000/ws/
```

## Monitoring

### Log Files

- **Access Logs**: `logs/grocery.local.access.log`
- **Error Logs**: `logs/grocery.local.error.log`
- **Systemd Logs**: `journalctl -u nginx-grocery -f`

### Metrics

The configuration includes response time logging and upstream metrics:

```
rt=$request_time 
uct="$upstream_connect_time" 
uht="$upstream_header_time" 
urt="$upstream_response_time"
```

### Performance Monitoring

```bash
# Monitor active connections
ss -tuln | grep -E ':(80|443|8000)'

# Check upstream health
./scripts/manage-nginx-grocery.sh health

# View real-time logs
tail -f nginx/logs/grocery.local.access.log
```

## Production Deployment

### SSL Certificates

Replace self-signed certificates with production certificates:

```bash
# Update paths in sites-available/grocery.local
ssl_certificate /path/to/production.crt;
ssl_certificate_key /path/to/production.key;
```

### Horizontal Scaling

Add additional upstream servers:

```nginx
upstream walmart_api_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;  # Additional instance
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;  # Additional instance
    keepalive 32;
}
```

### Performance Tuning

Key settings for high load:

- `worker_connections`: Adjust based on expected concurrent connections
- `keepalive_timeout`: Balance between connection reuse and resource usage
- `proxy_cache_path`: Adjust cache size based on available disk space
- `rate limiting`: Tune limits based on expected traffic patterns

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**: Check if upstream services are running
2. **SSL Certificate Errors**: Verify certificate paths and permissions
3. **Rate Limiting**: Check if limits are too restrictive
4. **WebSocket Issues**: Verify upgrade headers and sticky sessions

### Debug Mode

Enable debug logging:

```nginx
error_log /var/log/nginx/debug.log debug;
```

### Service Dependencies

Ensure microservices start before Nginx:

```bash
sudo systemctl list-dependencies nginx-grocery
```

## Security Checklist

- [ ] SSL certificates installed and valid
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Access to sensitive files blocked
- [ ] Firewall rules configured
- [ ] Log monitoring enabled
- [ ] Backup procedures in place

## Version History

- **v1.0**: Initial microservices configuration
- **v1.1**: Added WebSocket support and health checks
- **v1.2**: Enhanced security headers and rate limiting
- **v1.3**: Production SSL configuration and monitoring