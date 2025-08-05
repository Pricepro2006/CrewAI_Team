#!/usr/bin/env python3
"""
Simple Chain Summary Generator
=============================

Generate chain metadata from existing email data - no JSON parsing needed.
"""

import sqlite3
import json
from datetime import datetime

def create_chain_metadata_from_emails():
    """Create chain analysis metadata directly from email data"""
    
    db_path = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
    conn = sqlite3.connect(db_path)
    
    print("=== Generating Chain Metadata from Email Data ===")
    
    # Generate chain metadata from existing emails
    cursor = conn.execute("""
        INSERT OR REPLACE INTO email_chain_analysis (
            conversation_id, chain_type, completeness_score, total_emails,
            workflow_detected, workflow_stage, participants, date_range,
            analysis_version, created_at, updated_at
        )
        SELECT 
            chain_id,
            chain_type,
            AVG(chain_completeness_score),
            COUNT(*),
            CASE WHEN chain_type != 'broken' THEN 1 ELSE 0 END,
            CASE 
                WHEN chain_type = 'complete' THEN 'completed_workflow'
                WHEN chain_type = 'partial' THEN 'partial_workflow' 
                ELSE 'general_inquiry'
            END,
            '[]',
            MIN(created_date_time) || ' to ' || MAX(created_date_time),
            'v1.0-generated',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM emails_enhanced 
        WHERE chain_id IS NOT NULL
        GROUP BY chain_id, chain_type
    """)
    
    records_created = cursor.rowcount
    conn.commit()
    conn.close()
    
    print(f"✅ Created {records_created:,} chain metadata records")
    print("✅ Email processing pipeline is ready!")
    
    return records_created

if __name__ == "__main__":
    create_chain_metadata_from_emails()