#!/bin/bash
# Quick Database Optimization Script
# This script performs immediate optimizations that are safe to run

echo "=== CrewAI Database Quick Optimization ==="
echo "Starting at: $(date)"

# Create backup directory if it doesn't exist
mkdir -p data/backups

# Step 1: Create backup
echo "Step 1: Creating backup..."
BACKUP_FILE="data/backups/crewai.db.$(date +%Y%m%d_%H%M%S).pre-optimization"
cp data/crewai.db "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# Step 2: Check current size
echo -e "\nStep 2: Current database state:"
echo "Size: $(du -h data/crewai.db | cut -f1)"
echo "Emails: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM emails_enhanced;' 2>/dev/null || echo 'Error reading count')"
echo "Entities: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM email_entities;' 2>/dev/null || echo 'Error reading count')"

# Step 3: Add critical indexes
echo -e "\nStep 3: Adding performance-critical indexes..."
sqlite3 data/crewai.db << EOF
-- Email hash index for deduplication
CREATE INDEX IF NOT EXISTS idx_emails_hash ON emails_enhanced(email_hash);

-- Entity-email relationship index
CREATE INDEX IF NOT EXISTS idx_entities_email ON email_entities(email_id);

-- Thread tracking index
CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails_enhanced(thread_id);

-- Workflow state index
CREATE INDEX IF NOT EXISTS idx_emails_workflow_state ON emails_enhanced(workflow_state);

-- Priority index for quick filtering
CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails_enhanced(priority);

-- Date index for time-based queries
CREATE INDEX IF NOT EXISTS idx_emails_sent_date ON emails_enhanced(sent_date);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emails_sender_date ON emails_enhanced(sender, sent_date);
CREATE INDEX IF NOT EXISTS idx_emails_state_priority ON emails_enhanced(workflow_state, priority);
EOF

# Step 4: Optimize with VACUUM
echo -e "\nStep 4: Running VACUUM to reclaim space..."
sqlite3 data/crewai.db "VACUUM;"

# Step 5: Update statistics
echo -e "\nStep 5: Updating query statistics..."
sqlite3 data/crewai.db "ANALYZE;"

# Step 6: Check for duplicates
echo -e "\nStep 6: Checking for duplicate emails..."
DUPLICATES=$(sqlite3 data/crewai.db "SELECT COUNT(*) FROM (SELECT email_hash, COUNT(*) as c FROM emails_enhanced GROUP BY email_hash HAVING c > 1);" 2>/dev/null || echo "0")
echo "Duplicate email hashes found: $DUPLICATES"

# Step 7: Final size check
echo -e "\nStep 7: Optimization complete!"
echo "New size: $(du -h data/crewai.db | cut -f1)"
echo "Completed at: $(date)"

# Create a simple health check script
cat > scripts/db-health-check.sh << 'HEALTH_EOF'
#!/bin/bash
echo "=== Database Health Check ==="
echo "Database size: $(du -h data/crewai.db 2>/dev/null | cut -f1 || echo 'Not found')"
echo "Email count: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM emails_enhanced;' 2>/dev/null || echo 'Error')"
echo "Entity count: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM email_entities;' 2>/dev/null || echo 'Error')"
echo "Stage results: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM stage_results;' 2>/dev/null || echo 'Error')"
echo "Duplicate check: $(sqlite3 data/crewai.db 'SELECT COUNT(*) FROM (SELECT email_hash, COUNT(*) as c FROM emails_enhanced GROUP BY email_hash HAVING c > 1);' 2>/dev/null || echo '0')"
HEALTH_EOF

chmod +x scripts/db-health-check.sh
echo -e "\nHealth check script created: scripts/db-health-check.sh"