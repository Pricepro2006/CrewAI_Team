#!/usr/bin/env python3
"""
Real-Time Email Processing Progress Monitor
Tracks the progress of adaptive 3-phase email processing with live updates.

Key Features:
- Real-time progress tracking for 143k emails
- Phase-specific processing rates
- Memory and performance monitoring
- ETA calculations
- Processing bottleneck detection
"""

import sqlite3
import time
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, Any
import json

# Configuration
DB_PATH = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
REFRESH_INTERVAL = 5  # seconds
STATS_FILE = "/home/pricepro2006/CrewAI_Team/data/processing_stats.json"

def clear_screen():
    """Clear terminal screen"""
    os.system('clear' if os.name == 'posix' else 'cls')

def get_current_stats():
    """Get current processing statistics from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Overall statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'error' THEN 1 END) as errors
            FROM emails_enhanced
        """)
        
        total, processed, processing, pending, errors = cursor.fetchone()
        
        # Phase-specific statistics
        cursor.execute("""
            SELECT 
                phase_completed,
                COUNT(*) as total_in_phase,
                COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_in_phase,
                COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_in_phase,
                AVG(CASE WHEN status = 'processed' THEN confidence_score END) as avg_confidence
            FROM emails_enhanced
            WHERE phase_completed IS NOT NULL
            GROUP BY phase_completed
            ORDER BY phase_completed
        """)
        
        phase_stats = cursor.fetchall()
        
        # Recent processing activity (last 5 minutes)
        cursor.execute("""
            SELECT COUNT(*) 
            FROM emails_enhanced 
            WHERE analyzed_at IS NOT NULL 
              AND datetime(analyzed_at) > datetime('now', '-5 minutes')
        """)
        
        recent_processed = cursor.fetchone()[0]
        
        # Processing rate calculation
        cursor.execute("""
            SELECT 
                COUNT(*) as count,
                MIN(datetime(analyzed_at)) as earliest,
                MAX(datetime(analyzed_at)) as latest
            FROM emails_enhanced 
            WHERE analyzed_at IS NOT NULL
        """)
        
        rate_data = cursor.fetchone()
        processing_rate = 0
        if rate_data[0] > 0 and rate_data[1] and rate_data[2]:
            time_diff = (datetime.fromisoformat(rate_data[2]) - datetime.fromisoformat(rate_data[1])).total_seconds()
            if time_diff > 0:
                processing_rate = rate_data[0] / time_diff * 60  # emails per minute
        
        return {
            'timestamp': datetime.now().isoformat(),
            'total': total,
            'processed': processed,
            'processing': processing,
            'pending': pending,
            'errors': errors,
            'phase_stats': phase_stats,
            'recent_processed': recent_processed,
            'processing_rate': processing_rate
        }
        
    except Exception as e:
        print(f"Error getting stats: {e}")
        return None
    finally:
        conn.close()

def calculate_eta(current_stats: Dict[str, Any]) -> str:
    """Calculate estimated time to completion"""
    if current_stats['processing_rate'] == 0:
        return "Unknown"
    
    remaining = current_stats['pending']
    if remaining == 0:
        return "Complete"
    
    minutes_remaining = remaining / current_stats['processing_rate']
    eta = datetime.now() + timedelta(minutes=minutes_remaining)
    
    if minutes_remaining < 60:
        return f"{minutes_remaining:.1f} minutes"
    elif minutes_remaining < 1440:  # 24 hours
        return f"{minutes_remaining/60:.1f} hours"
    else:
        return f"{minutes_remaining/1440:.1f} days"

def format_processing_rate(rate: float) -> str:
    """Format processing rate for display"""
    if rate == 0:
        return "0 emails/min"
    elif rate < 1:
        return f"{rate*60:.1f} emails/hour"
    else:
        return f"{rate:.1f} emails/min"

def display_stats(stats: Dict[str, Any]):
    """Display formatted statistics"""
    if not stats:
        print("❌ Unable to retrieve statistics")
        return
    
    clear_screen()
    
    # Header
    print("=" * 80)
    print("📊 ADAPTIVE 3-PHASE EMAIL PROCESSING MONITOR")
    print("=" * 80)
    print(f"🕒 Last Updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📈 Processing Rate: {format_processing_rate(stats['processing_rate'])}")
    print(f"⏰ ETA: {calculate_eta(stats)}")
    print()
    
    # Overall Progress
    total = stats['total']
    processed = stats['processed']
    processing = stats['processing']
    pending = stats['pending']
    errors = stats['errors']
    
    progress_pct = (processed / total * 100) if total > 0 else 0
    
    print("📋 OVERALL PROGRESS")
    print("-" * 40)
    print(f"Total Emails:     {total:,}")
    print(f"✅ Processed:     {processed:,} ({progress_pct:.1f}%)")
    print(f"🔄 Processing:    {processing:,}")
    print(f"⏳ Pending:       {pending:,}")
    print(f"❌ Errors:        {errors:,}")
    print()
    
    # Progress Bar
    bar_width = 50
    filled = int(bar_width * progress_pct / 100)
    bar = "█" * filled + "░" * (bar_width - filled)
    print(f"Progress: [{bar}] {progress_pct:.1f}%")
    print()
    
    # Phase-Specific Statistics
    print("🎯 PHASE-SPECIFIC PROGRESS")
    print("-" * 60)
    print(f"{'Phase':<8} {'Type':<10} {'Total':<10} {'Processed':<12} {'Rate':<8} {'Confidence':<12}")
    print("-" * 60)
    
    for phase_data in stats['phase_stats']:
        phase, total_in_phase, processed_in_phase, processing_in_phase, avg_confidence = phase_data
        
        phase_progress = (processed_in_phase / total_in_phase * 100) if total_in_phase > 0 else 0
        phase_type = {1: "Complete", 2: "Partial", 3: "Broken"}.get(phase, "Unknown")
        confidence_str = f"{avg_confidence:.3f}" if avg_confidence else "N/A"
        
        print(f"Phase {phase:<3} {phase_type:<10} {total_in_phase:<10,} {processed_in_phase:<12,} {phase_progress:<7.1f}% {confidence_str:<12}")
    
    print()
    
    # Recent Activity
    print("🔥 RECENT ACTIVITY (Last 5 minutes)")
    print("-" * 40)
    print(f"Recently Processed: {stats['recent_processed']:,} emails")
    
    # Memory and Performance
    try:
        # Get database size
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT page_count * page_size / 1024 / 1024 FROM pragma_page_count(), pragma_page_size()")
        db_size = cursor.fetchone()[0]
        conn.close()
        
        print(f"Database Size: {db_size:.1f} MB")
    except:
        pass
    
    print()
    
    # Status Messages
    if processing > 0:
        print("🟢 Processing is ACTIVE")
    elif pending > 0:
        print("🟡 Processing is IDLE - emails pending")
    else:
        print("🔴 Processing is COMPLETE")
    
    if errors > 0:
        print(f"⚠️  {errors} emails have errors - check logs")
    
    print()
    print("Press Ctrl+C to exit")

def save_stats_history(stats: Dict[str, Any]):
    """Save statistics to history file"""
    try:
        history = []
        if os.path.exists(STATS_FILE):
            with open(STATS_FILE, 'r') as f:
                history = json.load(f)
        
        # Keep only last 1000 entries
        history = history[-999:]
        history.append(stats)
        
        with open(STATS_FILE, 'w') as f:
            json.dump(history, f)
            
    except Exception as e:
        print(f"Warning: Could not save stats history: {e}")

def main():
    """Main monitoring loop"""
    print("🚀 Starting Email Processing Monitor...")
    print(f"📊 Monitoring database: {DB_PATH}")
    print(f"🔄 Refresh interval: {REFRESH_INTERVAL} seconds")
    print()
    
    try:
        while True:
            stats = get_current_stats()
            if stats:
                display_stats(stats)
                save_stats_history(stats)
            
            time.sleep(REFRESH_INTERVAL)
            
    except KeyboardInterrupt:
        print("\n\n👋 Monitor stopped by user")
        print("📊 Final statistics saved to:", STATS_FILE)
    except Exception as e:
        print(f"\n❌ Monitor error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()