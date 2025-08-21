#!/bin/bash
# Simple Local Backup Script
# No over-engineering - just practical backups

set -e

PROJECT_DIR="/home/pricepro2006/CrewAI_Team"
BACKUP_DIR="$PROJECT_DIR/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "🗃️  Creating local backup..."

# Backup SQLite databases
for db in "$PROJECT_DIR/data"/*.db; do
    if [ -f "$db" ]; then
        db_name=$(basename "$db")
        cp "$db" "$BACKUP_DIR/${db_name%.db}_$TIMESTAMP.db"
        echo "✅ Backed up: $db_name"
    fi
done

# Backup critical config files
cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/package_$TIMESTAMP.json"
cp "$PROJECT_DIR/vite.config.ts" "$BACKUP_DIR/vite.config_$TIMESTAMP.ts"

# Clean old backups (keep last 10)
cd "$BACKUP_DIR"
ls -t *.db | tail -n +11 | xargs rm -f 2>/dev/null || true
ls -t package_*.json | tail -n +6 | xargs rm -f 2>/dev/null || true
ls -t vite.config_*.ts | tail -n +6 | xargs rm -f 2>/dev/null || true

echo "✅ Backup completed: $TIMESTAMP"
echo "📁 Location: $BACKUP_DIR"
echo "💾 Database size: $(du -sh $PROJECT_DIR/data/*.db 2>/dev/null | awk '{sum+=$1} END {print sum "K"}')"

# Optional: Show disk space
echo "💿 Backup directory size: $(du -sh $BACKUP_DIR)"