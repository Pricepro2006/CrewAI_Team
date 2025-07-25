#!/bin/bash

echo "=== Deep Email Analysis Progress Monitor ==="
echo "Started: $(date)"
echo ""

while true; do
    TOTAL_EMAILS=$(sqlite3 data/app.db "SELECT COUNT(*) FROM email_analysis;")
    ANALYZED=$(sqlite3 data/app.db "SELECT COUNT(*) FROM email_analysis WHERE deep_model IS NOT NULL;")
    REMAINING=$((TOTAL_EMAILS - ANALYZED))
    PERCENT=$(awk "BEGIN {printf \"%.2f\", ($ANALYZED / $TOTAL_EMAILS) * 100}")
    
    # Get recent log entries
    RECENT_LOG=$(tail -5 logs/deep_analysis.log | grep "Analyzed email" | tail -1)
    
    clear
    echo "=== Deep Email Analysis Progress ==="
    echo "Time: $(date)"
    echo ""
    echo "Total Emails: $TOTAL_EMAILS"
    echo "Analyzed: $ANALYZED ($PERCENT%)"
    echo "Remaining: $REMAINING"
    echo ""
    echo "Recent Activity:"
    echo "$RECENT_LOG"
    echo ""
    
    # Estimate completion time
    if [ $ANALYZED -gt 10 ]; then
        # Get start time from first log entry
        START_TIME=$(head -1 logs/deep_analysis.log | cut -d' ' -f1-2)
        CURRENT_TIME=$(date +%s)
        START_SECONDS=$(date -d "$START_TIME" +%s 2>/dev/null || echo $CURRENT_TIME)
        ELAPSED=$((CURRENT_TIME - START_SECONDS))
        
        if [ $ELAPSED -gt 0 ] && [ $ANALYZED -gt 0 ]; then
            RATE=$(awk "BEGIN {printf \"%.2f\", $ANALYZED / ($ELAPSED / 60)}")
            ESTIMATED_TOTAL_MINUTES=$(awk "BEGIN {printf \"%.0f\", $TOTAL_EMAILS / $RATE}")
            ESTIMATED_REMAINING_MINUTES=$(awk "BEGIN {printf \"%.0f\", $REMAINING / $RATE}")
            
            echo "Processing Rate: $RATE emails/minute"
            echo "Estimated Time Remaining: $ESTIMATED_REMAINING_MINUTES minutes ($(($ESTIMATED_REMAINING_MINUTES / 60)) hours)"
        fi
    fi
    
    echo ""
    echo "Press Ctrl+C to exit monitoring"
    
    sleep 10
done