#!/bin/bash
# Comprehensive Database Analysis Script
# Analyzes the current state of crewai.db before optimization

echo "=== Comprehensive Database Analysis ==="
echo "Analysis started at: $(date)"
echo "Database: data/crewai.db"
echo "========================================"

# Check if database exists
if [ ! -f "data/crewai.db" ]; then
    echo "ERROR: Database not found at data/crewai.db"
    exit 1
fi

# Overall database info
echo -e "\n1. DATABASE OVERVIEW"
echo "--------------------"
echo "File size: $(du -h data/crewai.db | cut -f1)"
echo "Last modified: $(stat -c %y data/crewai.db 2>/dev/null || stat -f %Sm -t '%Y-%m-%d %H:%M:%S' data/crewai.db)"

# Table information
echo -e "\n2. TABLE ANALYSIS"
echo "-----------------"
sqlite3 data/crewai.db << 'EOF'
.headers on
.mode column
SELECT 
    name as table_name,
    (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as indexes
FROM sqlite_master m 
WHERE type='table' 
ORDER BY name;
EOF

# Row counts for each table
echo -e "\n3. ROW COUNTS BY TABLE"
echo "----------------------"
for table in $(sqlite3 data/crewai.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"); do
    count=$(sqlite3 data/crewai.db "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "Error")
    printf "%-30s %10s rows\n" "$table:" "$count"
done

# Storage analysis by table
echo -e "\n4. STORAGE ANALYSIS"
echo "-------------------"
sqlite3 data/crewai.db << 'EOF' 2>/dev/null || echo "Storage analysis not available"
SELECT 
    name,
    SUM(pgsize) as size_bytes,
    ROUND(SUM(pgsize)/1024.0, 2) as size_kb,
    ROUND(SUM(pgsize)/1024.0/1024.0, 2) as size_mb
FROM dbstat
GROUP BY name
ORDER BY size_bytes DESC
LIMIT 20;
EOF

# Email analysis specific
echo -e "\n5. EMAIL DATA ANALYSIS"
echo "----------------------"
sqlite3 data/crewai.db << 'EOF'
.headers off
SELECT 'Total emails:', COUNT(*) FROM emails_enhanced;
SELECT 'Unique senders:', COUNT(DISTINCT sender) FROM emails_enhanced;
SELECT 'Date range:', MIN(sent_date) || ' to ' || MAX(sent_date) FROM emails_enhanced;
SELECT 'Emails with entities:', COUNT(DISTINCT email_id) FROM email_entities;
SELECT 'Emails with stage results:', COUNT(DISTINCT email_id) FROM stage_results;
EOF

# Workflow state distribution
echo -e "\n6. WORKFLOW STATE DISTRIBUTION"
echo "------------------------------"
sqlite3 data/crewai.db << 'EOF'
.headers on
.mode column
SELECT 
    workflow_state,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced), 2) as percentage
FROM emails_enhanced
GROUP BY workflow_state
ORDER BY count DESC;
EOF

# Priority distribution
echo -e "\n7. PRIORITY DISTRIBUTION"
echo "------------------------"
sqlite3 data/crewai.db << 'EOF'
.headers on
.mode column
SELECT 
    priority,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced), 2) as percentage
FROM emails_enhanced
GROUP BY priority
ORDER BY count DESC;
EOF

# Entity type distribution
echo -e "\n8. ENTITY TYPE DISTRIBUTION"
echo "---------------------------"
sqlite3 data/crewai.db << 'EOF'
.headers on
.mode column
SELECT 
    entity_type,
    COUNT(*) as count,
    COUNT(DISTINCT email_id) as unique_emails
FROM email_entities
GROUP BY entity_type
ORDER BY count DESC;
EOF

# Duplicate analysis
echo -e "\n9. DUPLICATE ANALYSIS"
echo "---------------------"
TOTAL_EMAILS=$(sqlite3 data/crewai.db "SELECT COUNT(*) FROM emails_enhanced;")
UNIQUE_HASHES=$(sqlite3 data/crewai.db "SELECT COUNT(DISTINCT email_hash) FROM emails_enhanced;")
DUPLICATES=$((TOTAL_EMAILS - UNIQUE_HASHES))
echo "Total emails: $TOTAL_EMAILS"
echo "Unique email hashes: $UNIQUE_HASHES"
echo "Duplicate emails: $DUPLICATES"

if [ $DUPLICATES -gt 0 ]; then
    echo -e "\nTop duplicate email hashes:"
    sqlite3 data/crewai.db << 'EOF'
.headers on
.mode column
SELECT 
    email_hash,
    COUNT(*) as duplicate_count
FROM emails_enhanced
GROUP BY email_hash
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
EOF
fi

# Index analysis
echo -e "\n10. INDEX ANALYSIS"
echo "------------------"
sqlite3 data/crewai.db << 'EOF'
.headers on
.mode column
SELECT 
    name as index_name,
    tbl_name as table_name,
    sql
FROM sqlite_master 
WHERE type='index' AND sql IS NOT NULL
ORDER BY tbl_name, name;
EOF

# Performance hints
echo -e "\n11. OPTIMIZATION OPPORTUNITIES"
echo "------------------------------"
echo "Checking for missing indexes on foreign keys..."
sqlite3 data/crewai.db << 'EOF'
SELECT 'Missing indexes on:' as finding;
SELECT '- email_entities.email_id' WHERE NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='index' AND sql LIKE '%email_id%' AND tbl_name='email_entities');
SELECT '- stage_results.email_id' WHERE NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='index' AND sql LIKE '%email_id%' AND tbl_name='stage_results');
SELECT '- emails_enhanced.thread_id' WHERE NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='index' AND sql LIKE '%thread_id%' AND tbl_name='emails_enhanced');
EOF

# Write results to file
echo -e "\n========================================"
echo "Analysis completed at: $(date)"
echo "Results saved to: reports/database-analysis-$(date +%Y%m%d).txt"

# Create reports directory and save output
mkdir -p reports
echo "Note: Run this script with '> reports/database-analysis-$(date +%Y%m%d).txt' to save output"