#!/usr/bin/env python3
"""
Real-time monitoring for LLM email processing pipeline
Shows progress, statistics, and performance metrics
"""

import sqlite3
import time
import os
import sys
from datetime import datetime
from typing import Dict, Tuple

class ProcessingMonitor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.last_stats = None
        self.start_time = datetime.now()
    
    def get_db_stats(self) -> Dict:
        """Get current database statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                        SUM(CASE WHEN status = 'analyzed' THEN 1 ELSE 0 END) as analyzed,
                        SUM(CASE WHEN status = 'phase2_complete' THEN 1 ELSE 0 END) as phase2_complete,
                        SUM(CASE WHEN status = 'phase3_complete' THEN 1 ELSE 0 END) as phase3_complete,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout,
                        SUM(CASE WHEN phase_completed = 1 THEN 1 ELSE 0 END) as phase1_count,
                        SUM(CASE WHEN phase_completed = 2 THEN 1 ELSE 0 END) as phase2_count,
                        SUM(CASE WHEN phase_completed = 3 THEN 1 ELSE 0 END) as phase3_count
                    FROM emails_enhanced
                    WHERE chain_completeness_score IS NOT NULL
                """)
                
                stats = dict(cursor.fetchone())
                
                # Get recent processing stats
                cursor = conn.execute("""
                    SELECT COUNT(*) as recent_count
                    FROM emails_enhanced
                    WHERE analyzed_at > datetime('now', '-5 minutes')
                """)
                
                stats['recent_processed'] = cursor.fetchone()[0]
                
                # Get average processing times by phase
                cursor = conn.execute("""
                    SELECT 
                        phase_completed,
                        AVG(CAST(json_extract(workflow_state, '$.processing_time') AS REAL)) as avg_time
                    FROM emails_enhanced
                    WHERE workflow_state IS NOT NULL
                    AND analyzed_at > datetime('now', '-1 hour')
                    GROUP BY phase_completed
                """)
                
                avg_times = {row[0]: row[1] for row in cursor.fetchall() if row[1]}
                stats['avg_processing_times'] = avg_times
                
                return stats
                
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {}
    
    def calculate_progress(self, stats: Dict) -> Tuple[float, float]:
        """Calculate overall progress and speed"""
        total = stats.get('total', 0)
        processed = total - stats.get('pending', 0) - stats.get('processing', 0)
        
        progress = (processed / total * 100) if total > 0 else 0
        
        # Calculate processing speed
        if self.last_stats and 'processed_count' in self.last_stats:
            time_diff = 60  # Assuming 1 minute between checks
            count_diff = processed - self.last_stats['processed_count']
            speed = count_diff  # emails per minute
        else:
            # Use recent_processed for initial speed estimate
            speed = stats.get('recent_processed', 0) / 5  # per minute
        
        return progress, speed
    
    def display_stats(self, stats: Dict):
        """Display statistics in a formatted way"""
        os.system('clear' if os.name == 'posix' else 'cls')
        
        progress, speed = self.calculate_progress(stats)
        
        print("=" * 80)
        print("📊 CrewAI Email Processing Monitor".center(80))
        print("=" * 80)
        print(f"🕐 Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"⏱️  Runtime: {datetime.now() - self.start_time}")
        print()
        
        # Overall progress
        total = stats.get('total', 0)
        pending = stats.get('pending', 0)
        processing = stats.get('processing', 0)
        completed = total - pending - processing
        
        print(f"📈 Overall Progress: {progress:.1f}% ({completed:,}/{total:,})")
        print(f"⚡ Processing Speed: {speed:.1f} emails/minute")
        
        if speed > 0 and pending > 0:
            eta_minutes = pending / speed
            print(f"⏳ Estimated Time Remaining: {eta_minutes:.0f} minutes")
        
        print()
        print("📋 Status Distribution:")
        print(f"  ⏳ Pending:         {pending:>8,} ({pending/total*100:.1f}%)")
        print(f"  🔄 Processing:      {processing:>8,}")
        print(f"  ✅ Analyzed:        {stats.get('analyzed', 0):>8,}")
        print(f"  🦙 Phase 2 Complete: {stats.get('phase2_complete', 0):>8,}")
        print(f"  🔥 Phase 3 Complete: {stats.get('phase3_complete', 0):>8,}")
        print(f"  ❌ Failed:          {stats.get('failed', 0):>8,}")
        print(f"  ⏱️  Timeout:         {stats.get('timeout', 0):>8,}")
        
        print()
        print("🎯 Phase Distribution:")
        print(f"  📋 Phase 1 (Rules):  {stats.get('phase1_count', 0):>8,}")
        print(f"  🦙 Phase 2 (Llama):  {stats.get('phase2_count', 0):>8,}")
        print(f"  🔥 Phase 3 (Phi-4):  {stats.get('phase3_count', 0):>8,}")
        
        # Average processing times
        avg_times = stats.get('avg_processing_times', {})
        if avg_times:
            print()
            print("⏱️  Average Processing Times:")
            for phase, avg_time in avg_times.items():
                if avg_time:
                    print(f"  Phase {phase}: {avg_time:.2f}s")
        
        print()
        print("💡 Recent Activity:")
        print(f"  Last 5 minutes: {stats.get('recent_processed', 0)} emails processed")
        
        print()
        print("=" * 80)
        print("Press Ctrl+C to exit")
        
        # Store current stats for next iteration
        self.last_stats = stats.copy()
        self.last_stats['processed_count'] = completed
    
    def run(self, refresh_interval: int = 30):
        """Run the monitor with specified refresh interval"""
        print("Starting email processing monitor...")
        print(f"Refreshing every {refresh_interval} seconds")
        
        try:
            while True:
                stats = self.get_db_stats()
                if stats:
                    self.display_stats(stats)
                else:
                    print("Failed to get statistics")
                
                time.sleep(refresh_interval)
                
        except KeyboardInterrupt:
            print("\n\nMonitor stopped by user")
            sys.exit(0)

def main():
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    monitor = ProcessingMonitor(db_path)
    
    # Run with 30 second refresh interval
    monitor.run(refresh_interval=30)

if __name__ == '__main__':
    main()