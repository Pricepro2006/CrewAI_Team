# Email Pipeline Backup and Recovery System

This document describes the comprehensive backup and recovery system for the CrewAI Email Pipeline, consisting of three specialized scripts designed to handle different operational scenarios.

## Scripts Overview

### 1. `backup-email-pipeline.sh` - Database Backup with Versioning
**Purpose**: Create versioned backups of databases, configurations, and system state with automatic cleanup.

**Features**:
- Automated database backup with SQLite integrity verification
- Configuration file backup and compression
- System state snapshots for troubleshooting
- Automatic backup rotation (keeps last 10 backups)
- Retention policy (removes backups older than 30 days)
- Disk space monitoring and cleanup
- Comprehensive logging and verification

### 2. `rollback-email-pipeline.sh` - Service Restoration
**Purpose**: Rollback the email pipeline to a previous backup state for service restoration.

**Features**:
- Interactive rollback with safety confirmations
- Pre-rollback backup creation
- Database and configuration restoration
- Service management (stop/start/verify)
- Integrity verification after rollback
- Automatic service health checks
- Rollback history tracking

### 3. `recover-email-pipeline.sh` - Emergency Recovery
**Purpose**: Emergency recovery for critical failures and data corruption scenarios.

**Features**:
- Automatic failure detection and classification
- Database corruption repair
- Redis queue cleanup and rebuilding
- System cleanup and dependency verification
- Emergency backup creation
- Disaster recovery package generation
- Comprehensive health reporting

## Usage Examples

### Backup Operations

```bash
# Create full backup
./scripts/backup-email-pipeline.sh backup

# List available backups
./scripts/backup-email-pipeline.sh list

# Check backup system status
./scripts/backup-email-pipeline.sh status

# Clean up old backups
./scripts/backup-email-pipeline.sh cleanup

# Verify specific backup integrity
./scripts/backup-email-pipeline.sh verify 20250130_143022
```

### Rollback Operations

```bash
# List available rollback targets
./scripts/rollback-email-pipeline.sh list

# Rollback with confirmation prompt
./scripts/rollback-email-pipeline.sh rollback 20250130_143022

# Rollback without confirmation (automated)
./scripts/rollback-email-pipeline.sh rollback 20250130_143022 true

# Check rollback system status
./scripts/rollback-email-pipeline.sh status
```

### Recovery Operations

```bash
# Interactive emergency recovery
./scripts/recover-email-pipeline.sh emergency

# Automated recovery (no prompts)
./scripts/recover-email-pipeline.sh auto-recovery

# System health report
./scripts/recover-email-pipeline.sh health

# Create disaster recovery package
./scripts/recover-email-pipeline.sh disaster-package

# Repair databases only
./scripts/recover-email-pipeline.sh repair-db

# Clean system and rebuild queues
./scripts/recover-email-pipeline.sh clean-system
```

## Backup Structure

The backup system creates the following structure:

```
backups/
├── databases_YYYYMMDD_HHMMSS/
│   ├── crewai.db.gz           # Compressed database backup
│   └── app.db.gz              # Compressed database backup
├── config_YYYYMMDD_HHMMSS.tar.gz     # Configuration files
├── logs_YYYYMMDD_HHMMSS.tar.gz       # Recent log files
├── system_state_YYYYMMDD_HHMMSS.txt  # System state snapshot
└── emergency/                         # Emergency backups
    ├── emergency_YYYYMMDD_HHMMSS/     # Emergency backup sets
    └── recovery_YYYYMMDD.log          # Recovery logs
```

## Safety Features

### Backup Script Safety
- Disk space verification before backup
- Service temporary shutdown for consistency
- Database integrity verification
- Automatic compression and cleanup
- Multiple validation layers

### Rollback Script Safety
- Pre-rollback backup creation
- Interactive confirmation prompts
- Service graceful shutdown
- Database integrity verification
- Automatic rollback on failure

### Recovery Script Safety
- Failure detection and classification
- Emergency backup before changes
- Staged recovery process
- Comprehensive verification
- Disaster recovery package creation

## Configuration

### Environment Variables
```bash
# Database paths
DATABASE_PATH=./data/crewai.db

# Service settings
NODE_ENV=production
REDIS_URL=redis://localhost:6379

# Backup settings (script defaults)
MAX_BACKUPS=10
BACKUP_RETENTION_DAYS=30
COMPRESSION_LEVEL=6
```

### Script Configuration
Edit the configuration section in each script:

**Backup Script**:
- `MAX_BACKUPS=10` - Number of backup sets to retain
- `BACKUP_RETENTION_DAYS=30` - Days to keep backups
- `COMPRESSION_LEVEL=6` - gzip compression level (1-9)

**Recovery Script**:
- `RECOVERY_TIMEOUT=300` - Recovery operation timeout (seconds)
- `SERVICE_START_TIMEOUT=60` - Service start timeout (seconds)
- `HEALTH_CHECK_TIMEOUT=120` - Health check timeout (seconds)

## Logging

Each script maintains detailed logs:

- **Backup**: `/logs/backup.log`
- **Rollback**: `/logs/rollback.log`
- **Recovery**: `/logs/recovery.log`
- **Emergency**: `/backups/emergency/recovery_YYYYMMDD.log`

## Error Handling

### Common Issues and Solutions

#### Insufficient Disk Space
```bash
# Check available space
df -h /home/pricepro2006/CrewAI_Team

# Clean up old backups
./scripts/backup-email-pipeline.sh cleanup

# Emergency cleanup
./scripts/recover-email-pipeline.sh clean-system
```

#### Database Corruption
```bash
# Repair databases
./scripts/recover-email-pipeline.sh repair-db

# If repair fails, rollback to last good backup
./scripts/rollback-email-pipeline.sh list
./scripts/rollback-email-pipeline.sh rollback TIMESTAMP
```

#### Service Won't Start
```bash
# Check system health
./scripts/recover-email-pipeline.sh health

# Full emergency recovery
./scripts/recover-email-pipeline.sh emergency
```

#### Redis Issues
```bash
# Clean and rebuild queues
./scripts/recover-email-pipeline.sh clean-system

# Manual Redis restart
sudo systemctl restart redis-server
```

## Best Practices

### Regular Operations
1. **Daily Backups**: Schedule `backup-email-pipeline.sh backup` via cron
2. **Weekly Verification**: Test backup integrity regularly
3. **Monthly Cleanup**: Review and clean old backups
4. **Health Checks**: Monitor system health regularly

### Emergency Procedures
1. **Assess First**: Use `recover-email-pipeline.sh health` to assess issues
2. **Backup Before Action**: Always create emergency backup
3. **Gradual Recovery**: Start with least invasive recovery options
4. **Document Issues**: Log all recovery actions and outcomes

### Disaster Recovery
1. **Create Packages**: Generate disaster recovery packages monthly
2. **Test Procedures**: Practice recovery procedures in test environment
3. **Update Documentation**: Keep recovery procedures current
4. **Multiple Locations**: Store disaster packages in multiple locations

## Monitoring Integration

### Cron Jobs Example
```bash
# Daily backup at 2 AM
0 2 * * * /home/pricepro2006/CrewAI_Team/scripts/backup-email-pipeline.sh backup

# Weekly cleanup on Sunday at 3 AM
0 3 * * 0 /home/pricepro2006/CrewAI_Team/scripts/backup-email-pipeline.sh cleanup

# Daily health check at 6 AM
0 6 * * * /home/pricepro2006/CrewAI_Team/scripts/recover-email-pipeline.sh health
```

### Alerting
Monitor log files for error conditions:
- Backup failures
- Database corruption
- Service failures
- Disk space issues

## Integration with Existing System

These scripts integrate with the existing CrewAI Team infrastructure:

- **Database**: Uses existing SQLite databases (`crewai.db`, `app.db`)
- **Services**: Manages existing systemd service (`crewai-email-pipeline`)
- **Configuration**: Respects existing environment variables and config files
- **Logging**: Follows existing logging patterns and directory structure
- **Security**: Maintains existing security practices and file permissions

## Support and Troubleshooting

### Diagnostic Commands
```bash
# Check all logs
tail -f /home/pricepro2006/CrewAI_Team/logs/*.log

# System status
./scripts/recover-email-pipeline.sh health

# Service status
sudo systemctl status crewai-email-pipeline

# Database integrity
sqlite3 /home/pricepro2006/CrewAI_Team/data/crewai.db "PRAGMA integrity_check;"
```

### Common Exit Codes
- `0`: Success
- `1`: General error or failure
- `130`: Script interrupted (Ctrl+C)

### Getting Help
```bash
# Script usage information
./scripts/backup-email-pipeline.sh help
./scripts/rollback-email-pipeline.sh help
./scripts/recover-email-pipeline.sh help
```

## Security Considerations

- Scripts require sudo privileges for service management
- Database backups are compressed but not encrypted
- Log files may contain sensitive information
- Pre-rollback backups preserve current state for forensics
- Emergency backups are created in secure location

## Version Compatibility

These scripts are designed for:
- CrewAI Team v2.0.0+
- Node.js 20.11+
- SQLite 3.x
- Redis 6.x+
- Ubuntu/Debian Linux systems

---

**⚠️ Important**: Always test backup and recovery procedures in a non-production environment before using in production. Keep multiple backup copies in different locations for disaster recovery scenarios.