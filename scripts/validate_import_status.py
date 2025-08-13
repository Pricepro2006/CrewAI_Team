#!/usr/bin/env python3
"""
Database Import Status Validator
===============================

Quick validation of database state before and after chain import.
"""

import sqlite3
import sys
import json
from datetime import datetime

def check_database_status(db_path: str):
    """Check current database status"""
    print("=== Database Status Check ===")
    print(f"Database: {db_path}")
    print(f"Timestamp: {datetime.now()}")
    print()
    
    try:
        conn = sqlite3.connect(db_path, timeout=10.0)
        
        # Check emails_enhanced table
        cursor = conn.execute("SELECT COUNT(*) FROM emails_enhanced")
        total_emails = cursor.fetchone()[0]
        print(f"Total emails in database: {total_emails:,}")
        
        # Check emails with chain_id
        cursor = conn.execute("SELECT COUNT(*) FROM emails_enhanced WHERE chain_id IS NOT NULL")
        emails_with_chains = cursor.fetchone()[0]
        print(f"Emails with chain_id: {emails_with_chains:,}")
        
        # Check emails with completeness scores
        cursor = conn.execute("SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score IS NOT NULL")
        emails_with_scores = cursor.fetchone()[0]
        print(f"Emails with completeness scores: {emails_with_scores:,}")
        
        # Check phase distribution
        cursor = conn.execute("""
            SELECT phase_completed, COUNT(*) as count
            FROM emails_enhanced
            WHERE phase_completed IS NOT NULL
            GROUP BY phase_completed
            ORDER BY phase_completed
        """)
        phase_distribution = cursor.fetchall()
        
        if phase_distribution:
            print("\nPhase Distribution:")
            phase_names = {1: "Phase 1 (Rule-based)", 2: "Phase 2 (Llama 3.2)", 3: "Phase 3 (Phi-4)"}
            for phase, count in phase_distribution:
                phase_name = phase_names.get(phase, f"Phase {phase}")
                percentage = (count / total_emails) * 100 if total_emails > 0 else 0
                print(f"  {phase_name}: {count:,} ({percentage:.1f}%)")
        else:
            print("\nNo phase assignments found")
        
        # Check chain analysis table
        cursor = conn.execute("SELECT COUNT(*) FROM email_chain_analysis")
        chain_records = cursor.fetchone()[0]
        print(f"\nChain analysis records: {chain_records:,}")
        
        if chain_records > 0:
            # Check completeness distribution in chain analysis
            cursor = conn.execute("""
                SELECT completeness, COUNT(*) as count
                FROM email_chain_analysis
                GROUP BY completeness
                ORDER BY count DESC
            """)
            completeness_dist = cursor.fetchall()
            
            print("\nChain Completeness Distribution:")
            for completeness, count in completeness_dist:
                percentage = (count / chain_records) * 100 if chain_records > 0 else 0
                print(f"  {completeness}: {count:,} ({percentage:.1f}%)")
        
        # Check for orphaned emails (emails with chain_id but no chain analysis)
        cursor = conn.execute("""
            SELECT COUNT(*)
            FROM emails_enhanced e
            LEFT JOIN email_chain_analysis c ON e.chain_id = c.chain_id
            WHERE e.chain_id IS NOT NULL AND c.chain_id IS NULL
        """)
        orphaned_emails = cursor.fetchone()[0]
        if orphaned_emails > 0:
            print(f"\nOrphaned emails (chain_id but no analysis): {orphaned_emails:,}")
        
        conn.close()
        
        # Summary
        print("\n=== Status Summary ===")
        if emails_with_chains == 0:
            print("❌ No emails have chain assignments")
        elif emails_with_scores == 0:
            print("⚠️  Emails have chain_id but missing completeness scores")
        elif chain_records == 0:
            print("⚠️  Emails have chain data but no chain analysis records")
        elif orphaned_emails > 0:
            print(f"⚠️  {orphaned_emails:,} emails have chain_id but missing analysis")
        else:
            print("✅ Database appears to be properly configured")
        
        return {
            'total_emails': total_emails,
            'emails_with_chains': emails_with_chains,
            'emails_with_scores': emails_with_scores,
            'chain_records': chain_records,
            'orphaned_emails': orphaned_emails,
            'phase_distribution': dict(phase_distribution) if phase_distribution else {}
        }
        
    except Exception as e:
        print(f"❌ Error checking database: {e}")
        return None

def main():
    """Main execution"""
    db_path = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
    
    if len(sys.argv) > 1:
        db_path = sys.argv[1]
    
    status = check_database_status(db_path)
    
    if status is None:
        sys.exit(1)
    
    # Determine if import is needed
    needs_import = (
        status['emails_with_chains'] > 0 and 
        (status['emails_with_scores'] == 0 or status['chain_records'] == 0)
    )
    
    if needs_import:
        print("\n🔄 Chain data import appears to be needed")
        print("Run: python3 /home/pricepro2006/CrewAI_Team/scripts/robust_chain_import.py")
    else:
        print("\n✅ No import appears to be needed")

if __name__ == "__main__":
    main()