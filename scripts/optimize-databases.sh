#!/bin/bash
# Database Optimization Script

set -e

echo "🗄️  Optimizing databases..."

# Function to optimize a SQLite database
optimize_db() {
    local db_path="$1"
    local db_name="$2"
    
    if [ -f "$db_path" ]; then
        echo "🔧 Optimizing $db_name..."
        
        # Get size before optimization
        size_before=$(du -h "$db_path" | cut -f1)
        
        # Run VACUUM to reclaim space
        sqlite3 "$db_path" "VACUUM;"
        
        # Analyze tables for better query planning
        sqlite3 "$db_path" "ANALYZE;"
        
        # Update statistics
        sqlite3 "$db_path" "PRAGMA optimize;"
        
        # Get size after optimization
        size_after=$(du -h "$db_path" | cut -f1)
        
        echo "   Size: $size_before → $size_after"
    else
        echo "⚠️  Database not found: $db_path"
    fi
}

# Optimize all databases
optimize_db "data/app.db" "Main Database"
optimize_db "data/walmart_grocery.db" "Walmart Grocery"
optimize_db "data/crewai_enhanced.db" "CrewAI Enhanced"

echo "✅ Database optimization complete!"
echo "💡 Consider archiving old data if databases are still large"
