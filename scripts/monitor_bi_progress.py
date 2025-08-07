#!/usr/bin/env python3
"""
Monitor BI Processing Progress
Shows real-time stats on email processing
"""

import sqlite3
import time
from datetime import datetime, timedelta
import os

def get_stats(db_path):
    """Get current processing statistics"""
    with sqlite3.connect(db_path) as conn:
        # Overall stats
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total_emails,
                COUNT(CASE WHEN workflow_state LIKE '%claude_opus%' THEN 1 END) as claude_opus,
                COUNT(CASE WHEN workflow_state LIKE '%llama_3_2%' THEN 1 END) as llama_processed,
                COUNT(CASE WHEN LENGTH(workflow_state) > 500 THEN 1 END) as full_bi,
                COUNT(CASE WHEN LENGTH(workflow_state) < 100 THEN 1 END) as minimal,
                AVG(CASE WHEN LENGTH(workflow_state) > 100 THEN LENGTH(workflow_state) END) as avg_bi_length
            FROM emails_enhanced
        """)
        overall = cursor.fetchone()
        
        # Recent activity
        cursor = conn.execute("""
            SELECT COUNT(*) as last_hour
            FROM emails_enhanced
            WHERE analyzed_at > datetime('now', '-1 hour')
            AND workflow_state LIKE '%claude_opus%'
        """)
        recent = cursor.fetchone()
        
        # Financial extraction
        cursor = conn.execute("""
            SELECT COUNT(*) as with_value
            FROM emails_enhanced
            WHERE workflow_state LIKE '%estimated_value%'
            AND workflow_state NOT LIKE '%"estimated_value": 0%'
            AND workflow_state NOT LIKE '%"estimated_value":0%'
        """)
        financial = cursor.fetchone()
        
        # Latest processed
        cursor = conn.execute("""
            SELECT analyzed_at, subject, LENGTH(workflow_state) as size
            FROM emails_enhanced
            WHERE workflow_state LIKE '%claude_opus%'
            ORDER BY analyzed_at DESC
            LIMIT 3
        """)
        latest = cursor.fetchall()
        
        return overall, recent[0], financial[0], latest

def monitor_progress():
    """Monitor processing progress with live updates"""
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    print("="*60)
    print("📊 BI PROCESSING MONITOR")
    print("="*60)
    
    # Check if processor is running
    is_running = os.system("ps aux | grep claude_opus_llm_processor.py | grep -v grep > /dev/null") == 0
    
    start_time = datetime.now()
    last_count = 0
    
    while True:
        os.system('clear')
        
        overall, last_hour, with_value, latest = get_stats(db_path)
        
        total, claude_opus, llama, full_bi, minimal, avg_length = overall
        
        # Calculate progress
        progress_pct = (claude_opus / total) * 100
        remaining = total - claude_opus
        
        # Calculate rate
        elapsed = (datetime.now() - start_time).total_seconds() / 60  # minutes
        if elapsed > 0 and last_hour > 0:
            rate_per_min = last_hour / 60
            eta_hours = (remaining / rate_per_min) / 60 if rate_per_min > 0 else 999
        else:
            rate_per_min = 0
            eta_hours = 999
        
        # Display
        print("="*60)
        print("📊 BI PROCESSING MONITOR")
        print("="*60)
        print(f"⚙️  Processor Status: {'🟢 RUNNING' if is_running else '🔴 STOPPED'}")
        print(f"🕐 Monitor Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        print("📈 OVERALL PROGRESS:")
        print(f"  Total Emails:        {total:,}")
        print(f"  Claude Opus Process: {claude_opus:,} ({progress_pct:.2f}%)")
        print(f"  Full BI Extracted:   {full_bi:,}")
        print(f"  With Financial Data: {with_value:,}")
        print(f"  Avg BI Length:       {avg_length:.0f} chars")
        print()
        
        print("⚡ PROCESSING RATE:")
        print(f"  Last Hour:     {last_hour} emails")
        print(f"  Rate:          {rate_per_min:.1f} emails/minute")
        print(f"  Remaining:     {remaining:,} emails")
        if eta_hours < 999:
            print(f"  ETA:           {eta_hours:.1f} hours ({eta_hours/24:.1f} days)")
        else:
            print(f"  ETA:           Calculating...")
        print()
        
        print("📧 LATEST PROCESSED:")
        for item in latest:
            timestamp, subject, size = item
            subject_preview = subject[:40] + "..." if len(subject) > 40 else subject
            print(f"  [{timestamp[:19]}] {subject_preview} ({size} chars)")
        
        print()
        print("💡 RECOMMENDATIONS:")
        if rate_per_min < 1:
            print("  ⚠️  Processing is very slow - consider:")
            print("     - Using cloud API (GPT-4, Claude) for bulk processing")
            print("     - Running multiple parallel processors")
            print("     - Simplifying prompts for faster response")
        elif progress_pct < 1:
            print("  📌 Still early in processing - monitor for stability")
        else:
            days_remaining = eta_hours / 24
            if days_remaining > 7:
                print(f"  ⏰ At current rate, will take {days_remaining:.0f} days")
                print("     Consider cloud API for faster processing")
        
        print()
        print("Press Ctrl+C to exit | Updates every 30 seconds")
        
        # Update running status
        is_running = os.system("ps aux | grep claude_opus_llm_processor.py | grep -v grep > /dev/null") == 0
        
        try:
            time.sleep(30)
        except KeyboardInterrupt:
            print("\n👋 Monitoring stopped")
            break

if __name__ == "__main__":
    monitor_progress()