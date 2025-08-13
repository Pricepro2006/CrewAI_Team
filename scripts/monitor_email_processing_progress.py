#!/usr/bin/env python3
"""
Monitor Email Processing Progress
Shows real-time statistics and projections
"""

import sqlite3
import time
from datetime import datetime, timedelta
import os

def get_processing_stats(db_path):
    """Get current processing statistics"""
    conn = sqlite3.connect(db_path)
    
    # Overall stats
    total_emails = conn.execute("SELECT COUNT(*) FROM emails_enhanced").fetchone()[0]
    
    # Complete chains stats
    complete_chains_total = conn.execute("""
        SELECT COUNT(*) FROM emails_enhanced 
        WHERE chain_completeness_score >= 0.7
    """).fetchone()[0]
    
    complete_chains_processed = conn.execute("""
        SELECT COUNT(*) FROM emails_enhanced 
        WHERE chain_completeness_score >= 0.7 
        AND phase2_result LIKE '%llama_3_2%'
    """).fetchone()[0]
    
    # Recent processing stats (last hour)
    recent_processed = conn.execute("""
        SELECT COUNT(*) FROM emails_enhanced 
        WHERE analyzed_at > datetime('now', '-1 hour')
        AND phase2_result LIKE '%llama_3_2%'
    """).fetchone()[0]
    
    # Get start time of current run
    first_recent = conn.execute("""
        SELECT MIN(analyzed_at) FROM emails_enhanced 
        WHERE analyzed_at > datetime('now', '-3 hours')
        AND phase2_result LIKE '%llama_3_2%'
    """).fetchone()[0]
    
    # High priority stats
    high_priority = conn.execute("""
        SELECT COUNT(*) FROM emails_enhanced 
        WHERE phase2_result LIKE '%llama_3_2%'
        AND (workflow_state LIKE '%High%' OR workflow_state LIKE '%Critical%')
    """).fetchone()[0]
    
    # Business value
    total_value = conn.execute("""
        SELECT COUNT(*) FROM emails_enhanced 
        WHERE phase2_result LIKE '%llama_3_2%'
        AND extracted_entities LIKE '%value%'
    """).fetchone()[0]
    
    conn.close()
    
    return {
        'total_emails': total_emails,
        'complete_chains_total': complete_chains_total,
        'complete_chains_processed': complete_chains_processed,
        'complete_chains_remaining': complete_chains_total - complete_chains_processed,
        'recent_processed': recent_processed,
        'first_recent': first_recent,
        'high_priority': high_priority,
        'total_value': total_value
    }

def display_progress():
    """Display formatted progress report"""
    db_path = './data/crewai_enhanced.db'
    
    print("\033[2J\033[H")  # Clear screen
    print("="*80)
    print("📊 EMAIL PROCESSING PROGRESS MONITOR")
    print("="*80)
    print(f"Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    stats = get_processing_stats(db_path)
    
    # Overall progress
    print("📈 COMPLETE EMAIL CHAINS (Score ≥ 0.7):")
    print(f"  Total Chains: {stats['complete_chains_total']:,}")
    print(f"  Processed: {stats['complete_chains_processed']:,} ({stats['complete_chains_processed']/stats['complete_chains_total']*100:.1f}%)")
    print(f"  Remaining: {stats['complete_chains_remaining']:,}")
    print()
    
    # Current run stats
    if stats['first_recent']:
        start_time = datetime.fromisoformat(stats['first_recent'])
        elapsed = datetime.now() - start_time
        elapsed_minutes = elapsed.total_seconds() / 60
        
        if elapsed_minutes > 0:
            rate = stats['recent_processed'] / elapsed_minutes
            
            print("⚡ CURRENT RUN PERFORMANCE:")
            print(f"  Started: {start_time.strftime('%H:%M:%S')}")
            print(f"  Elapsed: {elapsed}")
            print(f"  Processed in last hour: {stats['recent_processed']}")
            print(f"  Processing rate: {rate:.1f} emails/minute")
            print()
            
            # Projections
            if rate > 0:
                remaining_hours = stats['complete_chains_remaining'] / (rate * 60)
                eta = datetime.now() + timedelta(hours=remaining_hours)
                
                print("📅 PROJECTIONS:")
                print(f"  Time to complete chains: {remaining_hours:.1f} hours ({remaining_hours/24:.1f} days)")
                print(f"  Estimated completion: {eta.strftime('%Y-%m-%d %H:%M')}")
                print(f"  Daily capacity: {int(rate * 60 * 24):,} emails/day")
    
    print()
    print("🎯 QUALITY METRICS:")
    print(f"  High Priority Emails: {stats['high_priority']:,}")
    if stats['complete_chains_processed'] > 0:
        print(f"  High Priority Rate: {stats['high_priority']/stats['complete_chains_processed']*100:.1f}%")
    
    print()
    print("💡 PARALLEL PROCESSING STATUS:")
    # Check if process is running
    if os.system("pgrep -f 'process_emails_parallel' > /dev/null") == 0:
        print("  ✅ Parallel processor is RUNNING")
        
        # Check worker health
        worker_count = os.popen("ps aux | grep -E 'Worker-[0-3]' | grep -v grep | wc -l").read().strip()
        print(f"  🔧 Active workers: {worker_count}/4")
        
        # Check Ollama
        ollama_cpu = os.popen("ps aux | grep 'ollama runner' | grep -v grep | awk '{print $3}'").read().strip()
        if ollama_cpu:
            print(f"  🧠 Ollama CPU usage: {ollama_cpu}%")
    else:
        print("  ❌ Parallel processor is NOT running")
    
    print("="*80)

def continuous_monitor(refresh_seconds=60):
    """Continuously monitor progress"""
    while True:
        try:
            display_progress()
            time.sleep(refresh_seconds)
        except KeyboardInterrupt:
            print("\nMonitoring stopped.")
            break
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Monitor email processing progress')
    parser.add_argument('--once', action='store_true', help='Run once instead of continuous')
    parser.add_argument('--refresh', type=int, default=60, help='Refresh interval in seconds')
    
    args = parser.parse_args()
    
    if args.once:
        display_progress()
    else:
        continuous_monitor(args.refresh)