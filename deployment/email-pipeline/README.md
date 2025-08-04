# Email Pipeline Production Deployment

This directory contains the production deployment configuration for the CrewAI Team Email Pipeline service.

## Overview

The email pipeline is a production-ready, adaptive three-phase email analysis system that intelligently processes email chains based on completeness for maximum workflow intelligence extraction.

### Architecture

- **Phase 1**: Rule-based pattern matching and basic entity extraction
- **Phase 2**: Llama 3.2:3b analysis for chain completeness scoring
- **Phase 3**: Phi-4 deep analysis for complex workflows (with Llama 3.2:3b fallback)

### Components

1. **Email Pipeline Service**: Core processing service with REST API
2. **Redis**: Queue management for BullMQ
3. **Ollama**: Local LLM service for model inference
4. **SQLite**: Database for email storage and analysis results

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 8GB RAM (16GB recommended)
- 50GB free disk space

### Deploy

```bash
# Clone and navigate to deployment directory
cd deployment/email-pipeline

# Deploy all services
./deploy.sh
```

The deployment script will:
1. Check prerequisites
2. Set up environment files
3. Build and start all services
4. Wait for services to be healthy
5. Verify the deployment

### Access Services

After deployment, services will be available at:

- **Email Pipeline API**: http://localhost:3456
- **Health Check**: http://localhost:3456/health
- **Service Status**: http://localhost:3456/status  
- **Metrics**: http://localhost:3456/metrics
- **Ollama API**: http://localhost:11434
- **Redis**: localhost:6379

## Configuration

### Environment Variables

Copy and customize the environment file:

```bash
cp .env.production .env
# Edit .env with your specific configuration
```

Key configuration sections:

- **Database**: SQLite connection and settings
- **Redis**: Queue management configuration
- **Ollama**: LLM service settings
- **Pipeline**: Processing parameters and thresholds
- **Performance**: Memory and concurrency limits
- **Monitoring**: Logging and metrics settings

### Pipeline Configuration

The `config/pipeline-config.json` file contains detailed pipeline settings:

- Phase configurations and thresholds
- Model settings and fallbacks
- Processing limits and timeouts
- Queue and retry configurations

## Management Commands

```bash
# View service status
./deploy.sh status

# View logs
./deploy.sh logs

# Restart services
./deploy.sh restart

# Stop services
./deploy.sh stop

# Clean deployment (removes all data)
./deploy.sh clean
```

## API Usage

### Health Check

```bash
curl http://localhost:3456/health
```

### Service Status

```bash
curl http://localhost:3456/status
```

### Trigger Manual Processing

```bash
curl -X POST http://localhost:3456/api/process-emails \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "priority": "high"}'
```

### Metrics

```bash
curl http://localhost:3456/metrics
```

## Monitoring

### Logs

Service logs are available via Docker Compose:

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f email-pipeline
docker-compose logs -f redis
docker-compose logs -f ollama
```

### Health Monitoring

The pipeline service includes comprehensive health checks:

- Database connectivity
- Queue processor status
- Ollama LLM service availability
- Memory and CPU usage

### Performance Metrics

Key metrics tracked:

- Email processing throughput
- Queue statistics
- Model inference times
- Memory and CPU usage
- Error rates and types

## Scaling

### Horizontal Scaling

To scale processing capacity:

1. **Multiple Workers**: Increase `WORKER_CONCURRENCY` in environment
2. **Batch Size**: Adjust `EMAIL_PROCESSING_BATCH_SIZE` for throughput
3. **Queue Limits**: Modify `EMAIL_PROCESSING_CONCURRENT_LIMIT`

### Resource Allocation

Recommended resource allocation:

- **Development**: 4GB RAM, 2 CPU cores
- **Production**: 8-16GB RAM, 4-8 CPU cores
- **High-volume**: 16-32GB RAM, 8-16 CPU cores

### Database Scaling

For high-volume deployments:

1. Consider PostgreSQL instead of SQLite
2. Implement database sharding
3. Add read replicas for analytics

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   # Check logs
   ./deploy.sh logs
   
   # Verify prerequisites
   docker --version
   docker-compose --version
   ```

2. **Out of memory errors**
   ```bash
   # Increase memory limits in docker-compose.yml
   # Reduce batch sizes in environment configuration
   ```

3. **Model loading failures**
   ```bash
   # Check Ollama logs
   docker-compose logs ollama
   
   # Manually pull model
   docker-compose exec ollama ollama pull llama3.2:3b
   ```

4. **Queue processing stalled**
   ```bash
   # Check Redis connectivity
   docker-compose exec redis redis-cli ping
   
   # Restart queue processor
   docker-compose restart email-pipeline
   ```

### Log Analysis

Key log patterns to monitor:

- `ERROR` level messages
- Memory usage warnings
- Queue processing failures
- Model timeout errors
- Database connection issues

### Performance Tuning

1. **Memory Optimization**
   - Adjust `NODE_OPTIONS=--max-old-space-size=4096`
   - Monitor heap usage in metrics
   - Implement garbage collection tuning

2. **Processing Optimization**
   - Balance batch size vs. memory usage
   - Tune concurrency limits
   - Optimize model parameters

3. **Queue Tuning**
   - Adjust retry strategies
   - Implement priority queues
   - Monitor queue depth

## Security

### Production Security

1. **Network Security**
   - Use reverse proxy (nginx/traefik)
   - Implement SSL/TLS termination
   - Configure firewall rules

2. **Authentication**
   - Enable API authentication if needed
   - Set strong Redis passwords
   - Implement rate limiting

3. **Data Security**
   - Encrypt sensitive data at rest
   - Implement audit logging
   - Regular security updates

### Environment Security

```bash
# Secure file permissions
chmod 600 .env
chmod 700 deploy.sh

# Review exposed ports
docker-compose ps
```

## Backup and Recovery

### Database Backup

```bash
# Manual backup
docker-compose exec email-pipeline sqlite3 /app/data/crewai_enhanced.db ".backup /app/data/backups/backup_$(date +%Y%m%d_%H%M%S).db"

# Automated backup (configure in .env)
AUTO_BACKUP_ENABLED=true
BACKUP_INTERVAL=24h
BACKUP_RETENTION_DAYS=30
```

### Configuration Backup

```bash
# Backup configuration
tar -czf email-pipeline-config-$(date +%Y%m%d).tar.gz \
  .env config/ docker-compose.yml
```

### Recovery

```bash
# Restore from backup
docker-compose down
# Restore database file
# Restore configuration files
docker-compose up -d
```

## Support

### Documentation

- [Email Pipeline Architecture](../../docs/EMAIL_PIPELINE_PRODUCTION_ARCHITECTURE.md)
- [Development Guide](../../CLAUDE.md)
- [API Documentation](../../docs/api/)

### Monitoring Dashboards

Consider integrating with:

- Prometheus + Grafana for metrics
- ELK Stack for log analysis
- Custom monitoring solutions

### Maintenance

Regular maintenance tasks:

1. **Daily**: Monitor logs and metrics
2. **Weekly**: Check disk space and performance
3. **Monthly**: Update dependencies and models
4. **Quarterly**: Full system backup and recovery test