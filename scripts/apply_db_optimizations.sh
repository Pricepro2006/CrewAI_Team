#!/bin/bash

# CrewAI Team Database Optimization Script
# Safely applies performance optimizations to the email database

set -e  # Exit on error

DB_PATH="/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
BACKUP_PATH="/home/pricepro2006/CrewAI_Team/data/crewai_enhanced_backup_$(date +%Y%m%d_%H%M%S).db"
OPTIMIZE_SQL="/home/pricepro2006/CrewAI_Team/data/optimize_email_database.sql"
BENCHMARK_SQL="/home/pricepro2006/CrewAI_Team/data/benchmark_queries.sql"

echo "CrewAI Team Database Optimization"
echo "================================="
echo "Database: $DB_PATH"
echo "Backup: $BACKUP_PATH"
echo ""

# Step 1: Create backup
echo "Step 1: Creating backup..."
cp "$DB_PATH" "$BACKUP_PATH"
echo "✓ Backup created at: $BACKUP_PATH"
echo ""

# Step 2: Check current database size
echo "Step 2: Current database statistics:"
ls -lh "$DB_PATH"
sqlite3 "$DB_PATH" "SELECT COUNT(*) || ' total emails' FROM emails_enhanced;"
echo ""

# Step 3: Run benchmark before optimization
echo "Step 3: Running pre-optimization benchmark..."
echo "Time before optimization:" > benchmark_results.txt
sqlite3 "$DB_PATH" < "$BENCHMARK_SQL" >> benchmark_results.txt 2>&1
echo "✓ Pre-optimization benchmark complete"
echo ""

# Step 4: Apply optimizations
echo "Step 4: Applying optimizations..."
echo "This may take a few minutes for 143,850 emails..."
sqlite3 "$DB_PATH" < "$OPTIMIZE_SQL"
echo "✓ Optimizations applied successfully"
echo ""

# Step 5: Run benchmark after optimization
echo "Step 5: Running post-optimization benchmark..."
echo -e "\n\nTime after optimization:" >> benchmark_results.txt
sqlite3 "$DB_PATH" < "$BENCHMARK_SQL" >> benchmark_results.txt 2>&1
echo "✓ Post-optimization benchmark complete"
echo ""

# Step 6: Check new database size
echo "Step 6: Post-optimization database statistics:"
ls -lh "$DB_PATH"
sqlite3 "$DB_PATH" "SELECT COUNT(*) || ' indexes on emails_enhanced' FROM sqlite_master WHERE type='index' AND tbl_name='emails_enhanced';"
echo ""

# Step 7: Verify integrity
echo "Step 7: Verifying database integrity..."
sqlite3 "$DB_PATH" "PRAGMA integrity_check;"
echo "✓ Database integrity verified"
echo ""

# Step 8: Test optimized queries
echo "Step 8: Testing optimized query performance..."
echo "Testing phase-based query (20 emails)..."
time sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced WHERE phase_completed = 2 AND status = 'phase2_complete' LIMIT 20;"

echo "Testing chain completeness query..."
time sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score > 0.8 LIMIT 20;"

echo "Testing dashboard stats..."
time sqlite3 "$DB_PATH" "SELECT COUNT(*) as total, AVG(chain_completeness_score) as avg FROM emails_enhanced;"
echo ""

echo "✅ Optimization complete!"
echo ""
echo "Summary:"
echo "- Backup saved at: $BACKUP_PATH"
echo "- Benchmark results saved at: benchmark_results.txt"
echo "- Database optimized with new indexes and settings"
echo ""
echo "To restore from backup if needed:"
echo "  cp $BACKUP_PATH $DB_PATH"
echo ""
echo "Recommended next steps:"
echo "1. Review benchmark_results.txt for performance improvements"
echo "2. Test the application with optimized queries"
echo "3. Monitor query performance in production"