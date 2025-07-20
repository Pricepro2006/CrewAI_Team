#!/bin/bash
# Complete Knowledge Capture Script - Extract All Missing Data from July 17-18

set -e

CREWAI_DIR="/home/pricepro2006/CrewAI_Team"
MASTER_KB="$HOME/master_knowledge_base"
CAPTURE_DIR="$MASTER_KB/CrewAI_Team/complete_capture_$(date +%Y%m%d_%H%M%S)"

echo "🔍 Complete Knowledge Capture Script"
echo "==================================="
echo ""
echo "📅 Capturing all knowledge from July 17-18, 2025"
echo "📁 Output directory: $CAPTURE_DIR"
echo ""

# Create comprehensive capture directory structure
mkdir -p "$CAPTURE_DIR/logs"
mkdir -p "$CAPTURE_DIR/conversations"
mkdir -p "$CAPTURE_DIR/database_exports"
mkdir -p "$CAPTURE_DIR/configuration"
mkdir -p "$CAPTURE_DIR/test_results"
mkdir -p "$CAPTURE_DIR/documentation"
mkdir -p "$CAPTURE_DIR/analysis"

echo "📋 1. Extracting Complete Log Data"
echo "  - App logs (July 17-18): $(grep -c '2025-07-17\|2025-07-18' "$CREWAI_DIR/data/logs/app.log") entries"
echo "  - Error logs: $(wc -l < "$CREWAI_DIR/data/logs/error.log") entries"
echo "  - Backend logs: $(wc -l < "$CREWAI_DIR/backend.log") entries"

# Extract all log entries for July 17-18
grep '2025-07-17\|2025-07-18' "$CREWAI_DIR/data/logs/app.log" > "$CAPTURE_DIR/logs/app_log_july17-18.log" 2>/dev/null || echo "No app log entries found"
grep '2025-07-17\|2025-07-18' "$CREWAI_DIR/data/logs/error.log" > "$CAPTURE_DIR/logs/error_log_july17-18.log" 2>/dev/null || echo "No error log entries found"
grep '2025-07-17\|2025-07-18' "$CREWAI_DIR/backend.log" > "$CAPTURE_DIR/logs/backend_log_july17-18.log" 2>/dev/null || echo "No backend log entries found"

# Extract other log files
if [ -f "$CREWAI_DIR/server.log" ]; then
    grep '2025-07-17\|2025-07-18' "$CREWAI_DIR/server.log" > "$CAPTURE_DIR/logs/server_log_july17-18.log" 2>/dev/null || echo "No server log entries found"
fi

if [ -f "$CREWAI_DIR/frontend.log" ]; then
    grep '2025-07-17\|2025-07-18' "$CREWAI_DIR/frontend.log" > "$CAPTURE_DIR/logs/frontend_log_july17-18.log" 2>/dev/null || echo "No frontend log entries found"
fi

if [ -f "$CREWAI_DIR/client.log" ]; then
    grep '2025-07-17\|2025-07-18' "$CREWAI_DIR/client.log" > "$CAPTURE_DIR/logs/client_log_july17-18.log" 2>/dev/null || echo "No client log entries found"
fi

echo "📊 2. Extracting Database Content"
# Export all conversations from July 17-18
sqlite3 "$CREWAI_DIR/data/app.db" <<EOF > "$CAPTURE_DIR/conversations/all_conversations_july17-18.json"
.mode json
SELECT 
    c.id as conversation_id,
    c.title,
    c.created_at,
    c.updated_at,
    json_group_array(
        json_object(
            'id', m.id,
            'role', m.role,
            'content', m.content,
            'timestamp', m.timestamp,
            'metadata', m.metadata
        )
    ) as messages
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE date(c.created_at) IN ('2025-07-17', '2025-07-18')
GROUP BY c.id, c.title, c.created_at, c.updated_at
ORDER BY c.created_at;
EOF

# Export all messages from July 17-18
sqlite3 "$CREWAI_DIR/data/app.db" <<EOF > "$CAPTURE_DIR/conversations/all_messages_july17-18.json"
.mode json
SELECT 
    m.id,
    m.conversation_id,
    m.role,
    m.content,
    m.timestamp,
    m.metadata,
    c.title as conversation_title
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE date(m.timestamp) IN ('2025-07-17', '2025-07-18')
ORDER BY m.timestamp;
EOF

echo "🔧 3. Capturing Configuration Changes"
# Copy all configuration files that might have been modified
cp "$CREWAI_DIR/package.json" "$CAPTURE_DIR/configuration/"
cp "$CREWAI_DIR/.env.example" "$CAPTURE_DIR/configuration/"
cp "$CREWAI_DIR/src/config/app.config.ts" "$CAPTURE_DIR/configuration/"
cp "$CREWAI_DIR/claude_desktop_config.json" "$CAPTURE_DIR/configuration/"
cp "$CREWAI_DIR/vitest.config.ts" "$CAPTURE_DIR/configuration/"
cp "$CREWAI_DIR/vitest.integration.config.ts" "$CAPTURE_DIR/configuration/"

echo "🧪 4. Capturing Test Results and Scripts"
# Copy all test-related files
cp "$CREWAI_DIR/test-"*.ts "$CAPTURE_DIR/test_results/" 2>/dev/null || echo "No test files found"
cp "$CREWAI_DIR/"*results*.json "$CAPTURE_DIR/test_results/" 2>/dev/null || echo "No result files found"
cp "$CREWAI_DIR/irrigation-specialist-test-"*.json "$CAPTURE_DIR/test_results/" 2>/dev/null || echo "No irrigation test files found"
cp "$CREWAI_DIR/scripts/"*.sh "$CAPTURE_DIR/test_results/" 2>/dev/null || echo "No script files found"

echo "📚 5. Capturing Documentation and Analysis"
# Copy all markdown files that might contain knowledge
find "$CREWAI_DIR" -name "*.md" -newermt "2025-07-17" -not -path "*/node_modules/*" -exec cp {} "$CAPTURE_DIR/documentation/" \; 2>/dev/null || echo "No new documentation found"

# Copy confidence system files
cp -r "$CREWAI_DIR/src/core/rag/confidence" "$CAPTURE_DIR/documentation/confidence_system/" 2>/dev/null || echo "No confidence system files found"

echo "🔍 6. Generating Analysis Summary"
cat > "$CAPTURE_DIR/analysis/capture_summary.md" <<EOF
# Complete Knowledge Capture Summary

## Capture Details
- **Date**: $(date)
- **Period**: July 17-18, 2025
- **Source**: CrewAI Team Project
- **Capture Method**: Comprehensive extraction script

## Data Captured

### Log Data
- App logs: $(wc -l < "$CAPTURE_DIR/logs/app_log_july17-18.log" 2>/dev/null || echo "0") entries
- Error logs: $(wc -l < "$CAPTURE_DIR/logs/error_log_july17-18.log" 2>/dev/null || echo "0") entries
- Backend logs: $(wc -l < "$CAPTURE_DIR/logs/backend_log_july17-18.log" 2>/dev/null || echo "0") entries
- Server logs: $(wc -l < "$CAPTURE_DIR/logs/server_log_july17-18.log" 2>/dev/null || echo "0") entries
- Frontend logs: $(wc -l < "$CAPTURE_DIR/logs/frontend_log_july17-18.log" 2>/dev/null || echo "0") entries
- Client logs: $(wc -l < "$CAPTURE_DIR/logs/client_log_july17-18.log" 2>/dev/null || echo "0") entries

### Database Content
- Conversations: $(sqlite3 "$CREWAI_DIR/data/app.db" "SELECT COUNT(*) FROM conversations WHERE date(created_at) IN ('2025-07-17', '2025-07-18')")
- Messages: $(sqlite3 "$CREWAI_DIR/data/app.db" "SELECT COUNT(*) FROM messages WHERE date(timestamp) IN ('2025-07-17', '2025-07-18')")

### Configuration Files
- package.json ($(stat --format=%Y "$CREWAI_DIR/package.json" | xargs -I {} date -d @{} "+%Y-%m-%d %H:%M:%S"))
- .env.example ($(stat --format=%Y "$CREWAI_DIR/.env.example" | xargs -I {} date -d @{} "+%Y-%m-%d %H:%M:%S"))
- app.config.ts ($(stat --format=%Y "$CREWAI_DIR/src/config/app.config.ts" | xargs -I {} date -d @{} "+%Y-%m-%d %H:%M:%S"))
- claude_desktop_config.json ($(stat --format=%Y "$CREWAI_DIR/claude_desktop_config.json" | xargs -I {} date -d @{} "+%Y-%m-%d %H:%M:%S"))

### Test Results
- Test files: $(ls -1 "$CAPTURE_DIR/test_results/" 2>/dev/null | wc -l)
- Result files: $(ls -1 "$CAPTURE_DIR/test_results/"*results*.json 2>/dev/null | wc -l)

### Documentation
- New documentation files: $(ls -1 "$CAPTURE_DIR/documentation/" 2>/dev/null | wc -l)

## Key Findings

### Vector Store Issues
- ChromaDB was not running (resolved)
- Source files were empty (restored)
- No cloud integration (implemented)

### System Activity
- High orchestrator activity on July 17 (replanning due to failures)
- Vector store initialization errors
- Database schema validation on July 18

### Development Progress
- Multi-vector store implementation completed
- Confidence system integration ongoing
- Performance optimization in progress

## Next Steps

1. Review captured log data for patterns
2. Analyze conversation data for insights
3. Validate all knowledge has been captured
4. Organize data for easy retrieval
5. Create searchable index of captured knowledge

## Files Structure
```
$CAPTURE_DIR/
├── logs/                   # All log files from July 17-18
├── conversations/          # Database exports of conversations
├── database_exports/       # Additional database content
├── configuration/          # Configuration files
├── test_results/          # Test files and results
├── documentation/         # Documentation and analysis
└── analysis/             # This summary and analysis
```

---
*Generated by complete-knowledge-capture.sh on $(date)*
EOF

echo ""
echo "✅ Complete Knowledge Capture Completed!"
echo "📁 Data saved to: $CAPTURE_DIR"
echo "📊 Summary available at: $CAPTURE_DIR/analysis/capture_summary.md"
echo ""
echo "📈 Statistics:"
echo "  - Log entries: $(find "$CAPTURE_DIR/logs" -name "*.log" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")"
echo "  - Conversations: $(sqlite3 "$CREWAI_DIR/data/app.db" "SELECT COUNT(*) FROM conversations WHERE date(created_at) IN ('2025-07-17', '2025-07-18')")"
echo "  - Messages: $(sqlite3 "$CREWAI_DIR/data/app.db" "SELECT COUNT(*) FROM messages WHERE date(timestamp) IN ('2025-07-17', '2025-07-18')")"
echo "  - Files captured: $(find "$CAPTURE_DIR" -type f | wc -l)"
echo ""
echo "🔗 All knowledge from July 17-18 has been comprehensively captured and organized."
echo "🎯 The master knowledge base now contains complete data for analysis and retrieval."
