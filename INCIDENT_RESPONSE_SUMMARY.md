# 📚 Incident Response System - Walmart Grocery Agent

**Created:** August 7, 2025  
**Environment:** Local Development  
**Version:** 1.0.0

## 🎯 Overview

A comprehensive incident response system has been created for the Walmart Grocery Agent local development environment. This system provides automated detection, diagnosis, and recovery tools for common development issues.

## 📁 Files Created

### 1. **Main Documentation**
- `/INCIDENT_RESPONSE_PLAYBOOK.md` - Complete 10-section playbook with procedures
- `/QUICK_REFERENCE_CARD.md` - One-page cheat sheet for emergencies
- `/INCIDENT_RESPONSE_SUMMARY.md` - This summary document

### 2. **Diagnostic Scripts**
- `/scripts/diagnostics/comprehensive_diagnostic.sh` - Full system health check
- `/scripts/test_incident_response.sh` - Test script to verify tools

### 3. **Recovery Scripts**
- `/scripts/recovery/quick_fix.sh` - One-click fixes for common issues
- `/scripts/recovery/websocket_recovery.sh` - WebSocket-specific recovery
- `/scripts/recovery/database_recovery.sh` - Database recovery and optimization

### 4. **Master Command Center**
- `/scripts/incident_response.sh` - Central incident response tool with menu

## 🚀 Quick Start

### For Any Issue:
```bash
./scripts/incident_response.sh
```

### For Automatic Detection & Fix:
```bash
./scripts/incident_response.sh --auto
```

### For Specific Issues:

**WebSocket Problems:**
```bash
./scripts/recovery/websocket_recovery.sh
```

**Database Issues:**
```bash
./scripts/recovery/database_recovery.sh
```

**Quick Fix Everything:**
```bash
./scripts/recovery/quick_fix.sh 1
```

## 🔍 Key Features

### 1. **Automated Detection**
- Identifies WebSocket failures
- Detects database locks/corruption
- Finds port conflicts
- Monitors memory usage
- Checks service health

### 2. **One-Click Recovery**
- Quick fix for all common issues
- Automatic database recovery
- WebSocket connection repair
- Memory cleanup
- Service restart

### 3. **Comprehensive Diagnostics**
- Full system health report
- Service status checking
- Database integrity verification
- Memory usage analysis
- Log error detection

### 4. **Guided Response**
- Step-by-step problem resolution
- Automated incident logging
- Severity classification (P0-P3)
- Recovery verification

## 📊 Coverage

### WebSocket Issues Covered:
✅ Connection failures (ports 3001, 8080)  
✅ Infinite reconnection loops  
✅ Message delivery failures  
✅ CORS problems  
✅ Port conflicts  
✅ Memory leaks  

### Database Issues Covered:
✅ SQLite locks  
✅ Database corruption  
✅ Slow query performance  
✅ Migration failures  
✅ Connection pool exhaustion  
✅ Missing indexes  

### General Issues Covered:
✅ Port conflicts  
✅ Memory exhaustion  
✅ Service startup failures  
✅ Ollama not running  
✅ Node.js crashes  
✅ Build failures  

## 🎮 Usage Examples

### Example 1: WebSocket Not Connecting
```bash
# Quick diagnosis and fix
./scripts/incident_response.sh --websocket

# Or use the menu
./scripts/incident_response.sh
# Select option 4
```

### Example 2: Database Locked
```bash
# Automatic database recovery
./scripts/recovery/database_recovery.sh --auto

# Or specific database
./scripts/recovery/database_recovery.sh
# Select option 1 for walmart_grocery.db
```

### Example 3: Complete System Down
```bash
# Emergency recovery
./scripts/incident_response.sh --auto

# Or full reset
./scripts/recovery/quick_fix.sh 8
```

## 📈 Incident Severity Levels

- **P0** - Complete outage, immediate response required
- **P1** - Major functionality broken, < 1 hour response
- **P2** - Significant issues, < 4 hour response  
- **P3** - Minor issues, next business day

## 🔧 Maintenance

### Regular Health Checks:
```bash
# Run daily
./scripts/diagnostics/comprehensive_diagnostic.sh

# Monitor in real-time
watch -n 10 './scripts/diagnostics/comprehensive_diagnostic.sh'
```

### Backup Strategy:
```bash
# Backup all databases
./scripts/recovery/database_recovery.sh
# Select option 5

# Automatic backup (add to cron)
0 */4 * * * /home/pricepro2006/CrewAI_Team/scripts/recovery/database_recovery.sh --auto
```

## 📝 Post-Incident Process

1. **Log the incident** - Automatically done by scripts
2. **Review logs** - Check `/incidents/` directory
3. **Update playbook** - Add new scenarios as discovered
4. **Test recovery** - Verify fixes work consistently
5. **Share knowledge** - Document unusual issues

## 🏃 Emergency Commands

```bash
# STOP EVERYTHING
pkill -f node && pkill -f ollama

# QUICK RESTART
npm run restart:all

# FULL RESET
./scripts/recovery/quick_fix.sh 8

# CHECK EVERYTHING
./scripts/diagnostics/comprehensive_diagnostic.sh
```

## 📚 Additional Resources

- Main Playbook: `/INCIDENT_RESPONSE_PLAYBOOK.md`
- Quick Reference: `/QUICK_REFERENCE_CARD.md`
- WebSocket Fix Guide: See Section 1 of playbook
- Database Recovery: See Section 2 of playbook
- Monitoring Dashboard: `http://localhost:3002/monitor`

## ✅ System Requirements Met

All requested deliverables have been created:

1. ✅ **INCIDENT_RESPONSE_PLAYBOOK.md** - Comprehensive 10-section guide
2. ✅ **Quick Reference Card** - One-page emergency guide
3. ✅ **Diagnostic Scripts** - Automated troubleshooting tools
4. ✅ **Recovery Scripts** - One-click fixes for common issues

The system is fully operational and ready for use in the local development environment.

---

**For immediate help:** Run `./scripts/incident_response.sh`