#!/usr/bin/env python3
"""
Reset failed and timeout emails back to pending status for reprocessing
Useful for retrying after fixing issues
"""

import sqlite3
import sys
from datetime import datetime

def reset_failed_emails(db_path: str, status_to_reset: list = None):
    """Reset emails with specified statuses back to pending"""
    
    if status_to_reset is None:
        status_to_reset = ['failed', 'timeout', 'processing']
    
    try:
        with sqlite3.connect(db_path) as conn:
            # First, count emails to reset
            placeholders = ','.join(['?' for _ in status_to_reset])
            cursor = conn.execute(
                f"SELECT COUNT(*) FROM emails_enhanced WHERE status IN ({placeholders})",
                status_to_reset
            )
            count = cursor.fetchone()[0]
            
            if count == 0:
                print("No emails found to reset.")
                return
            
            print(f"Found {count} emails to reset with status in: {status_to_reset}")
            response = input("Continue? (y/n): ")
            
            if response.lower() != 'y':
                print("Cancelled.")
                return
            
            # Reset the emails
            conn.execute(
                f"""UPDATE emails_enhanced 
                   SET status = 'pending',
                       analyzed_at = NULL
                   WHERE status IN ({placeholders})""",
                status_to_reset
            )
            
            conn.commit()
            print(f"✅ Reset {count} emails to pending status")
            
            # Show current distribution
            cursor = conn.execute("""
                SELECT status, COUNT(*) 
                FROM emails_enhanced 
                WHERE chain_completeness_score IS NOT NULL
                GROUP BY status
                ORDER BY COUNT(*) DESC
            """)
            
            print("\n📊 Current Status Distribution:")
            for row in cursor:
                print(f"  {row[0]:<20} {row[1]:>8,}")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def main():
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    if len(sys.argv) > 1:
        # Custom statuses from command line
        status_to_reset = sys.argv[1].split(',')
        print(f"Resetting emails with status: {status_to_reset}")
    else:
        # Default: reset failed, timeout, and stuck processing
        status_to_reset = ['failed', 'timeout', 'processing']
    
    reset_failed_emails(db_path, status_to_reset)

if __name__ == '__main__':
    main()