#!/usr/bin/env python3
"""
Check Import Needs
==================

Determine what chain data import is actually needed.
"""

import sqlite3
import json
import sys
from datetime import datetime

def analyze_import_needs():
    """Analyze what import is actually needed"""
    print("=== Chain Data Import Needs Analysis ===")
    print(f"Timestamp: {datetime.now()}")
    print()
    
    db_path = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
    stats_path = "/home/pricepro2006/CrewAI_Team/data/email_chain_analysis/chain_analysis_stats.json"
    
    # Load the analysis stats
    try:
        with open(stats_path, 'r') as f:
            stats = json.load(f)
        print("📊 Chain Analysis Stats from File:")
        print(f"  Total chains: {stats['total_chains']:,}")
        print(f"  Complete: {stats['completeness_breakdown']['complete']:,} ({stats['completeness_breakdown']['complete']/stats['total_chains']*100:.1f}%)")
        print(f"  Partial: {stats['completeness_breakdown']['partial']:,} ({stats['completeness_breakdown']['partial']/stats['total_chains']*100:.1f}%)")
        print(f"  Broken: {stats['completeness_breakdown']['broken']:,} ({stats['completeness_breakdown']['broken']/stats['total_chains']*100:.1f}%)")
        print()
    except Exception as e:
        print(f"❌ Could not load stats file: {e}")
        return
    
    # Check database state
    try:
        conn = sqlite3.connect(db_path, timeout=10.0)
        
        # Check emails in database
        cursor = conn.execute("SELECT COUNT(*) FROM emails_enhanced")
        total_emails = cursor.fetchone()[0]
        
        cursor = conn.execute("SELECT COUNT(DISTINCT chain_id) FROM emails_enhanced WHERE chain_id IS NOT NULL")
        unique_chains_db = cursor.fetchone()[0]
        
        cursor = conn.execute("""
            SELECT 
                chain_type,
                phase_completed,
                COUNT(*) as count
            FROM emails_enhanced 
            WHERE chain_completeness_score IS NOT NULL 
            GROUP BY chain_type, phase_completed 
            ORDER BY phase_completed
        """)
        
        db_distribution = cursor.fetchall()
        
        print("📊 Database Current State:")
        print(f"  Total emails: {total_emails:,}")
        print(f"  Unique chains: {unique_chains_db:,}")
        print(f"  Distribution:")
        for chain_type, phase, count in db_distribution:
            percentage = (count / total_emails) * 100 if total_emails > 0 else 0
            phase_name = {1: "Complete/Rule-based", 2: "Partial/Llama", 3: "Broken/Phi-4"}.get(phase, f"Phase {phase}")
            print(f"    {chain_type} -> {phase_name}: {count:,} ({percentage:.1f}%)")
        
        # Check chain analysis table
        cursor = conn.execute("SELECT COUNT(*) FROM email_chain_analysis")
        chain_analysis_count = cursor.fetchone()[0]
        print(f"  Chain analysis records: {chain_analysis_count:,}")
        
        conn.close()
        
        print()
        print("=== Analysis ===")
        
        # Compare stats
        expected_total = stats['total_chains']
        actual_unique = unique_chains_db
        
        if chain_analysis_count == 0:
            print("❌ No chain analysis records found in database")
            print("   The email_chain_analysis table is empty")
        else:
            print("✅ Chain analysis table has data")
        
        if abs(expected_total - actual_unique) > 1000:
            print(f"⚠️  Chain count mismatch: Expected {expected_total:,}, got {actual_unique:,}")
        else:
            print(f"✅ Chain counts roughly match: Expected {expected_total:,}, got {actual_unique:,}")
        
        # Check if distribution matches
        db_total = sum(count for _, _, count in db_distribution)
        if db_total == total_emails and total_emails > 0:
            print("✅ All emails have completeness scores and phase assignments")
            
            # Check distribution alignment
            expected_complete_pct = stats['completeness_breakdown']['complete'] / stats['total_chains'] * 100
            expected_partial_pct = stats['completeness_breakdown']['partial'] / stats['total_chains'] * 100
            expected_broken_pct = stats['completeness_breakdown']['broken'] / stats['total_chains'] * 100
            
            actual_complete = sum(count for chain_type, phase, count in db_distribution if chain_type == 'complete')
            actual_partial = sum(count for chain_type, phase, count in db_distribution if chain_type == 'partial')
            actual_broken = sum(count for chain_type, phase, count in db_distribution if chain_type == 'broken')
            
            actual_complete_pct = (actual_complete / total_emails) * 100
            actual_partial_pct = (actual_partial / total_emails) * 100
            actual_broken_pct = (actual_broken / total_emails) * 100
            
            print(f"   Complete: Expected {expected_complete_pct:.1f}%, Actual {actual_complete_pct:.1f}%")
            print(f"   Partial: Expected {expected_partial_pct:.1f}%, Actual {actual_partial_pct:.1f}%")
            print(f"   Broken: Expected {expected_broken_pct:.1f}%, Actual {actual_broken_pct:.1f}%")
            
        else:
            print("⚠️  Not all emails have completeness data")
        
        # Recommendations
        print()
        print("=== Recommendations ===")
        
        if chain_analysis_count == 0:
            print("🔧 NEEDED: Import chain analysis metadata to email_chain_analysis table")
            print("   This will provide detailed chain information for the UI and reporting")
        
        if db_total < total_emails:
            print("🔧 NEEDED: Update remaining emails with phase assignments")
        
        if abs(expected_total - actual_unique) > 1000:
            print("🔧 INVESTIGATE: Chain count discrepancy needs investigation")
        
        if chain_analysis_count == 0 or db_total < total_emails:
            print()
            print("▶️  Run the import script to fix missing data:")
            print("   python3 /home/pricepro2006/CrewAI_Team/scripts/robust_chain_import.py")
        else:
            print("✅ No import needed - data appears complete!")
    
    except Exception as e:
        print(f"❌ Error analyzing database: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    analyze_import_needs()