#!/bin/bash
# Safe Email Deduplication Script
# Removes duplicate emails while preserving the most recent version

echo "=== Email Deduplication Script ==="
echo "Started at: $(date)"

# Safety check
if [ ! -f "data/crewai.db" ]; then
    echo "ERROR: Database not found at data/crewai.db"
    exit 1
fi

# Create backup first
echo "Creating safety backup..."
BACKUP_FILE="data/backups/crewai.db.$(date +%Y%m%d_%H%M%S).pre-dedup"
mkdir -p data/backups
cp data/crewai.db "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE"

# Check current state
echo -e "\nCurrent duplicate analysis:"
sqlite3 data/crewai.db << 'EOF'
SELECT 
    'Total emails:' as metric, 
    COUNT(*) as count 
FROM emails_enhanced
UNION ALL
SELECT 
    'Unique email hashes:',
    COUNT(DISTINCT email_hash)
FROM emails_enhanced
UNION ALL
SELECT 
    'Duplicates to remove:',
    COUNT(*) - COUNT(DISTINCT email_hash)
FROM emails_enhanced;
EOF

# Count duplicates
DUPLICATES=$(sqlite3 data/crewai.db "SELECT COUNT(*) - COUNT(DISTINCT email_hash) FROM emails_enhanced;")

if [ "$DUPLICATES" -eq "0" ]; then
    echo -e "\nNo duplicates found. Database is already clean!"
    exit 0
fi

echo -e "\nFound $DUPLICATES duplicate emails to remove."
echo "Proceeding with deduplication..."

# Create deduplication SQL script
cat > /tmp/deduplicate.sql << 'EOF'
-- Begin transaction for safety
BEGIN TRANSACTION;

-- Save IDs of emails to keep (most recent for each hash)
CREATE TEMP TABLE emails_to_keep AS
SELECT MAX(id) as id
FROM emails_enhanced
GROUP BY email_hash;

-- Save IDs of emails to delete
CREATE TEMP TABLE emails_to_delete AS
SELECT e.id
FROM emails_enhanced e
WHERE e.id NOT IN (SELECT id FROM emails_to_keep);

-- Log what we're about to delete
SELECT 'Emails to delete: ' || COUNT(*) FROM emails_to_delete;

-- Delete related records first (maintaining referential integrity)
DELETE FROM email_entities 
WHERE email_id IN (SELECT id FROM emails_to_delete);

DELETE FROM stage_results 
WHERE email_id IN (SELECT id FROM emails_to_delete);

DELETE FROM email_analysis 
WHERE email_id IN (SELECT id FROM emails_to_delete);

-- Delete duplicate emails
DELETE FROM emails_enhanced 
WHERE id IN (SELECT id FROM emails_to_delete);

-- Verify results
SELECT 'Emails remaining: ' || COUNT(*) FROM emails_enhanced;
SELECT 'Unique hashes: ' || COUNT(DISTINCT email_hash) FROM emails_enhanced;

-- Clean up temp tables
DROP TABLE emails_to_keep;
DROP TABLE emails_to_delete;

-- Commit if everything looks good
COMMIT;

-- Optimize after deletion
VACUUM;
ANALYZE;
EOF

# Execute deduplication
echo -e "\nExecuting deduplication..."
sqlite3 data/crewai.db < /tmp/deduplicate.sql

# Verify results
echo -e "\nVerifying results:"
sqlite3 data/crewai.db << 'EOF'
SELECT 
    'Total emails after dedup:' as metric, 
    COUNT(*) as count 
FROM emails_enhanced
UNION ALL
SELECT 
    'Unique email hashes:',
    COUNT(DISTINCT email_hash)
FROM emails_enhanced
UNION ALL
SELECT 
    'Remaining duplicates:',
    COUNT(*) - COUNT(DISTINCT email_hash)
FROM emails_enhanced;
EOF

# Check database integrity
echo -e "\nChecking database integrity..."
INTEGRITY=$(sqlite3 data/crewai.db "PRAGMA integrity_check;")
if [ "$INTEGRITY" = "ok" ]; then
    echo "Database integrity: OK"
else
    echo "WARNING: Database integrity check failed!"
    echo "$INTEGRITY"
fi

# Clean up
rm -f /tmp/deduplicate.sql

# Final size comparison
echo -e "\nSize comparison:"
echo "Original: $(du -h "$BACKUP_FILE" | cut -f1)"
echo "After dedup: $(du -h data/crewai.db | cut -f1)"

echo -e "\nDeduplication completed at: $(date)"
echo "Backup preserved at: $BACKUP_FILE"