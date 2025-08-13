#!/usr/bin/env python3
"""Real-time Monitoring Dashboard"""

import time
import sqlite3
import json
from datetime import datetime
from pathlib import Path

def get_metrics():
    """Get current metrics"""
    db_path = '/home/pricepro2006/CrewAI_Team/model-benchmarks/pattern_extraction.db'
    
    if not Path(db_path).exists():
        return None
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get extraction stats
    cursor.execute("""
        SELECT 
            COUNT(*) as total_processed,
            AVG(processing_time) as avg_time,
            SUM(entities_found) as total_entities,
            COUNT(DISTINCT purpose) as unique_purposes
        FROM extraction_logs
        WHERE timestamp > datetime('now', '-1 hour')
    """)
    
    stats = cursor.fetchone()
    
    # Get pattern stats
    cursor.execute("""
        SELECT 
            COUNT(*) as total_patterns,
            COUNT(CASE WHEN verified = 1 THEN 1 END) as verified_patterns,
            AVG(confidence) as avg_confidence
        FROM discovered_patterns
    """)
    
    patterns = cursor.fetchone()
    
    conn.close()
    
    return {
        'timestamp': datetime.now().isoformat(),
        'extraction': {
            'total_processed': stats[0] or 0,
            'avg_processing_time': stats[1] or 0,
            'total_entities': stats[2] or 0,
            'unique_purposes': stats[3] or 0
        },
        'patterns': {
            'total': patterns[0] or 0,
            'verified': patterns[1] or 0,
            'avg_confidence': patterns[2] or 0
        }
    }

def display_dashboard():
    """Display monitoring dashboard"""
    print("\033[2J\033[H")  # Clear screen
    print("="*70)
    print("TD SYNNEX PATTERN EXTRACTION - MONITORING DASHBOARD")
    print("="*70)
    
    while True:
        metrics = get_metrics()
        
        if metrics:
            print(f"\nLast Update: {metrics['timestamp']}")
            print("\nEXTRACTION METRICS (Last Hour):")
            print(f"  Emails Processed: {metrics['extraction']['total_processed']:,}")
            print(f"  Avg Processing Time: {metrics['extraction']['avg_processing_time']:.3f}s")
            print(f"  Total Entities Found: {metrics['extraction']['total_entities']:,}")
            print(f"  Unique Purposes: {metrics['extraction']['unique_purposes']}")
            
            print("\nPATTERN DISCOVERY:")
            print(f"  Total Patterns: {metrics['patterns']['total']:,}")
            print(f"  Verified Patterns: {metrics['patterns']['verified']:,}")
            print(f"  Avg Confidence: {metrics['patterns']['avg_confidence']:.2%}")
            
            # Check discovery log
            log_path = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/full_discovery/discovery_state.pkl')
            if log_path.exists():
                print("\nDISCOVERY PROGRESS:")
                print("  Status: RUNNING")
                print(f"  State file: {log_path}")
        else:
            print("\nWaiting for metrics...")
        
        print("\n[Press Ctrl+C to exit]")
        time.sleep(5)
        print("\033[2J\033[H")  # Clear screen

if __name__ == "__main__":
    try:
        display_dashboard()
    except KeyboardInterrupt:
        print("\n\nMonitoring stopped.")
