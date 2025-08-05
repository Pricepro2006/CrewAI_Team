#!/usr/bin/env python3
"""
Monitor HIGH-QUALITY Business Intelligence Email Processing
Shows only emails processed with Claude Opus-level analysis
"""

import sqlite3
import json
from datetime import datetime, timedelta
import time
import argparse

def get_high_quality_stats(db_path):
    """Get statistics for high-quality BI processed emails only"""
    conn = sqlite3.connect(db_path)
    
    # Total emails
    total = conn.execute("SELECT COUNT(*) FROM emails_enhanced").fetchone()[0]
    
    # High-quality BI processed (Claude Opus level)
    high_quality = conn.execute("""
        SELECT COUNT(*) 
        FROM emails_enhanced 
        WHERE workflow_state LIKE '%business_intelligence%' 
          AND workflow_state LIKE '%actionable_items%' 
          AND workflow_state LIKE '%claude_opus%'
    """).fetchone()[0]
    
    # Get processing in last hour
    last_hour = conn.execute("""
        SELECT COUNT(*) 
        FROM emails_enhanced 
        WHERE workflow_state LIKE '%business_intelligence%' 
          AND workflow_state LIKE '%actionable_items%' 
          AND workflow_state LIKE '%claude_opus%'
          AND analyzed_at > datetime('now', '-1 hour')
    """).fetchone()[0]
    
    # Get business value extracted
    business_value = conn.execute("""
        SELECT COUNT(*), SUM(CAST(JSON_EXTRACT(workflow_state, '$.business_intelligence.estimated_value') AS REAL))
        FROM emails_enhanced 
        WHERE workflow_state LIKE '%business_intelligence%' 
          AND workflow_state LIKE '%claude_opus%'
          AND JSON_EXTRACT(workflow_state, '$.business_intelligence.estimated_value') > 0
    """).fetchall()[0]
    
    # Get priority distribution
    high_priority = conn.execute("""
        SELECT COUNT(*)
        FROM emails_enhanced 
        WHERE workflow_state LIKE '%claude_opus%'
          AND (JSON_EXTRACT(workflow_state, '$.workflow_analysis.priority') IN ('High', 'Critical')
               OR JSON_EXTRACT(workflow_state, '$.priority') IN ('High', 'Critical'))
    """).fetchone()[0]
    
    # Get completeness distribution of remaining emails
    remaining_complete = conn.execute("""
        SELECT COUNT(*)
        FROM emails_enhanced 
        WHERE (workflow_state IS NULL 
            OR workflow_state NOT LIKE '%business_intelligence%' 
            OR workflow_state NOT LIKE '%claude_opus%')
          AND chain_completeness_score >= 0.9
    """).fetchone()[0]
    
    conn.close()
    
    return {
        'total': total,
        'high_quality': high_quality,
        'last_hour': last_hour,
        'business_value_count': business_value[0] or 0,
        'total_value': business_value[1] or 0,
        'high_priority': high_priority,
        'remaining_complete_chains': remaining_complete
    }

def display_stats(stats):
    """Display statistics in a clear format"""
    remaining = stats['total'] - stats['high_quality']
    percent = (stats['high_quality'] / stats['total'] * 100) if stats['total'] > 0 else 0
    rate = stats['last_hour']  # emails per hour
    
    print("\n" + "="*80)
    print("📊 HIGH-QUALITY BUSINESS INTELLIGENCE PROCESSING STATUS")
    print("="*80)
    
    print(f"\n✅ Claude Opus-Level Processing:")
    print(f"  Total Emails: {stats['total']:,}")
    print(f"  High-Quality BI Processed: {stats['high_quality']:,} ({percent:.2f}%)")
    print(f"  Remaining: {remaining:,} ({100-percent:.2f}%)")
    
    print(f"\n📈 Performance:")
    print(f"  Last Hour: {stats['last_hour']} emails")
    print(f"  Current Rate: {rate/60:.1f} emails/minute")
    
    if rate > 0:
        hours_remaining = remaining / rate
        days_remaining = hours_remaining / 24
        print(f"  ETA: {hours_remaining:.1f} hours ({days_remaining:.1f} days)")
    
    print(f"\n💰 Business Intelligence Extracted:")
    print(f"  Emails with Value: {stats['business_value_count']:,}")
    print(f"  Total Value Identified: ${stats['total_value']:,.2f}")
    print(f"  High Priority Emails: {stats['high_priority']:,}")
    
    print(f"\n📊 Remaining Work:")
    print(f"  Complete Chains (0.9+) to Process: {stats['remaining_complete_chains']:,}")
    
    print("="*80)
    
    # Quality check
    if rate < 1:
        print("\n⚠️  WARNING: Processing rate is very low. Check if processor is running.")
    
    print(f"\n⏰ Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

def main():
    parser = argparse.ArgumentParser(description='Monitor high-quality BI email processing')
    parser.add_argument('--db', default='./data/crewai_enhanced.db', help='Database path')
    parser.add_argument('--interval', type=int, default=300, help='Update interval in seconds')
    parser.add_argument('--once', action='store_true', help='Run once and exit')
    
    args = parser.parse_args()
    
    if args.once:
        stats = get_high_quality_stats(args.db)
        display_stats(stats)
    else:
        print(f"Starting continuous monitoring (updates every {args.interval} seconds)")
        print("Press Ctrl+C to stop")
        
        while True:
            try:
                stats = get_high_quality_stats(args.db)
                display_stats(stats)
                time.sleep(args.interval)
            except KeyboardInterrupt:
                print("\nMonitoring stopped.")
                break
            except Exception as e:
                print(f"\nError: {e}")
                time.sleep(args.interval)

if __name__ == '__main__':
    main()