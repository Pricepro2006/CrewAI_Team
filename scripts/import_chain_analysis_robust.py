#!/usr/bin/env python3
"""
Robust Email Chain Analysis Import Script
Handles large JSON files with potential formatting issues using a streaming approach.

Key Features:
- Processes JSON in chunks to avoid memory issues
- Handles malformed JSON gracefully
- Batch database updates for efficiency
- Real-time progress monitoring
"""

import json
import sqlite3
import sys
import os
from datetime import datetime
from typing import Dict, Any, Optional
import gc
import re

# Configuration
BATCH_SIZE = 1000
DB_PATH = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
CHAIN_ANALYSIS_PATH = "/home/pricepro2006/CrewAI_Team/data/email_chain_analysis/email_chain_analysis.json"

def log_progress(message: str):
    """Log progress with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def get_chain_completeness_phase(completeness: str, completeness_score: float) -> int:
    """Map chain completeness to processing phase"""
    if completeness == "complete" or completeness_score >= 0.8:
        return 1  # Complete chains -> Phase 1 (Rule-based)
    elif completeness == "partial" or completeness_score >= 0.4:
        return 2  # Partial chains -> Phase 2 (Llama 3.2)
    else:
        return 3  # Broken chains -> Phase 3 (Phi-4)

def extract_emails_from_chain(chain_data: Dict[str, Any]) -> list:
    """Extract email IDs from chain data"""
    emails = []
    
    # Check for direct email_ids array
    if 'email_ids' in chain_data:
        return chain_data['email_ids']
    
    # Check for emails array with MessageID
    if 'emails' in chain_data and isinstance(chain_data['emails'], list):
        for email in chain_data['emails']:
            if isinstance(email, dict) and 'MessageID' in email:
                emails.append(email['MessageID'])
            elif isinstance(email, dict) and 'id' in email:
                emails.append(email['id'])
    
    return emails

def process_chain_file_streaming():
    """
    Process the chain analysis file using a line-by-line streaming approach
    to handle very large files efficiently
    """
    log_progress("Starting streaming chain analysis processing...")
    
    email_to_chain = {}
    phase_counts = {1: 0, 2: 0, 3: 0}
    chains_processed = 0
    
    try:
        with open(CHAIN_ANALYSIS_PATH, 'r', encoding='utf-8') as f:
            current_chain_text = ""
            chain_id = None
            brace_count = 0
            in_chain = False
            
            for line_num, line in enumerate(f):
                line = line.strip()
                
                # Skip empty lines
                if not line:
                    continue
                
                # Check for start of new chain
                if line.startswith('"chain_') and line.endswith(': {'):
                    # Extract chain ID
                    chain_id_match = re.search(r'"(chain_[^"]+)":', line)
                    if chain_id_match:
                        chain_id = chain_id_match.group(1)
                        current_chain_text = "{\n"
                        brace_count = 1
                        in_chain = True
                        continue
                
                if in_chain:
                    current_chain_text += line + "\n"
                    
                    # Count braces to detect end of chain
                    brace_count += line.count('{') - line.count('}')
                    
                    # If we've closed all braces, process this chain
                    if brace_count <= 0:
                        try:
                            # Add closing brace if needed
                            if not current_chain_text.rstrip().endswith('}'):
                                current_chain_text += "}\n"
                            
                            chain_data = json.loads(current_chain_text)
                            
                            # Process this chain
                            if process_single_chain(chain_id, chain_data, email_to_chain, phase_counts):
                                chains_processed += 1
                                
                            if chains_processed % 1000 == 0:
                                log_progress(f"Processed {chains_processed} chains, mapped {len(email_to_chain)} emails")
                                gc.collect()
                                
                        except json.JSONDecodeError as e:
                            log_progress(f"JSON error in chain {chain_id}: {e}")
                        except Exception as e:
                            log_progress(f"Error processing chain {chain_id}: {e}")
                        
                        # Reset for next chain
                        in_chain = False
                        current_chain_text = ""
                        brace_count = 0
                        chain_id = None
                
                # Progress update every 100k lines
                if line_num % 100000 == 0:
                    log_progress(f"Processed {line_num:,} lines, {chains_processed} chains")
        
        log_progress(f"Streaming processing complete:")
        log_progress(f"  Total chains processed: {chains_processed}")
        log_progress(f"  Total emails mapped: {len(email_to_chain)}")
        log_progress(f"  Phase 1 (Complete): {phase_counts[1]} chains")
        log_progress(f"  Phase 2 (Partial): {phase_counts[2]} chains")
        log_progress(f"  Phase 3 (Broken): {phase_counts[3]} chains")
        
        return email_to_chain
        
    except Exception as e:
        log_progress(f"Streaming processing error: {e}")
        return {}

def process_single_chain(chain_id: str, chain_data: Dict[str, Any], 
                        email_to_chain: Dict[str, Dict[str, Any]], 
                        phase_counts: Dict[int, int]) -> bool:
    """Process a single chain and update email mappings"""
    try:
        # Extract chain properties
        completeness = chain_data.get('completeness', 'broken')
        completeness_score = float(chain_data.get('completeness_score', 0.0))
        workflow_type = chain_data.get('workflow_type', 'general_inquiry')
        confidence_score = float(chain_data.get('confidence_score', 0.0))
        
        # Get phase assignment
        recommended_phase = get_chain_completeness_phase(completeness, completeness_score)
        phase_counts[recommended_phase] += 1
        
        # Extract email IDs
        email_ids = extract_emails_from_chain(chain_data)
        
        if not email_ids:
            return False
        
        # Map emails in this chain
        for email_id in email_ids:
            email_to_chain[email_id] = {
                'chain_id': chain_id,
                'chain_completeness_score': completeness_score,
                'chain_type': completeness,
                'is_chain_complete': 1 if completeness == 'complete' else 0,
                'workflow_state': workflow_type,
                'confidence_score': confidence_score,
                'recommended_phase': recommended_phase
            }
        
        return True
        
    except Exception as e:
        log_progress(f"Error processing chain {chain_id}: {e}")
        return False

def update_database_with_chain_data(email_to_chain: Dict[str, Dict[str, Any]]):
    """Update database with chain analysis data in batches"""
    log_progress("Starting database updates...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get all email IDs that need updating
        cursor.execute("SELECT id FROM emails_enhanced ORDER BY id")
        all_email_ids = [row[0] for row in cursor.fetchall()]
        
        log_progress(f"Found {len(all_email_ids)} emails in database")
        
        # Process in batches
        updated_count = 0
        phase_counts = {1: 0, 2: 0, 3: 0}
        not_found_count = 0
        
        for i in range(0, len(all_email_ids), BATCH_SIZE):
            batch_ids = all_email_ids[i:i + BATCH_SIZE]
            batch_updates = []
            
            for email_id in batch_ids:
                if email_id in email_to_chain:
                    chain_info = email_to_chain[email_id]
                    batch_updates.append((
                        chain_info['chain_id'],
                        chain_info['chain_completeness_score'],
                        chain_info['chain_type'],
                        chain_info['is_chain_complete'],
                        chain_info['workflow_state'],
                        chain_info['confidence_score'],
                        chain_info['recommended_phase'],
                        datetime.now().isoformat(),
                        email_id
                    ))
                    phase_counts[chain_info['recommended_phase']] += 1
                else:
                    not_found_count += 1
            
            if batch_updates:
                cursor.executemany("""
                    UPDATE emails_enhanced 
                    SET chain_id = ?, 
                        chain_completeness_score = ?, 
                        chain_type = ?, 
                        is_chain_complete = ?,
                        workflow_state = ?, 
                        confidence_score = ?, 
                        phase_completed = ?, 
                        analyzed_at = ?
                    WHERE id = ?
                """, batch_updates)
                
                updated_count += len(batch_updates)
                conn.commit()
                
                batch_num = i // BATCH_SIZE + 1
                log_progress(f"Batch {batch_num}: Updated {len(batch_updates)} emails | Total: {updated_count:,}")
                
                if batch_num % 10 == 0:
                    gc.collect()
        
        # Final statistics
        total_processed = updated_count + not_found_count
        log_progress("Database update complete!")
        log_progress(f"  Phase 1 (Complete): {phase_counts[1]:,} emails ({phase_counts[1]/updated_count*100:.1f}%)")
        log_progress(f"  Phase 2 (Partial): {phase_counts[2]:,} emails ({phase_counts[2]/updated_count*100:.1f}%)")
        log_progress(f"  Phase 3 (Broken): {phase_counts[3]:,} emails ({phase_counts[3]/updated_count*100:.1f}%)")
        log_progress(f"  Total updated: {updated_count:,} emails")
        log_progress(f"  Not found in chains: {not_found_count:,} emails")
        log_progress(f"  Coverage: {updated_count/total_processed*100:.2f}%")
        
    except Exception as e:
        log_progress(f"Database update error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def verify_import_results():
    """Verify the import was successful and show distribution"""
    log_progress("Verifying import results...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check phase distribution
        cursor.execute("""
            SELECT 
                phase_completed,
                chain_type,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score IS NOT NULL), 2) as percentage
            FROM emails_enhanced 
            WHERE chain_completeness_score IS NOT NULL
            GROUP BY phase_completed, chain_type
            ORDER BY phase_completed, chain_type
        """)
        
        results = cursor.fetchall()
        log_progress("Final Chain Distribution by Phase:")
        for phase, chain_type, count, percentage in results:
            log_progress(f"  Phase {phase} ({chain_type}): {count:,} emails ({percentage}%)")
        
        # Overall statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN chain_completeness_score IS NOT NULL THEN 1 END) as with_scores,
                COUNT(DISTINCT chain_id) as unique_chains,
                AVG(chain_completeness_score) as avg_score
            FROM emails_enhanced
        """)
        
        total, with_scores, unique_chains, avg_score = cursor.fetchone()
        log_progress(f"Overall Statistics:")
        log_progress(f"  Total emails: {total:,}")
        log_progress(f"  Emails with chain data: {with_scores:,}")
        log_progress(f"  Unique chains: {unique_chains:,}")
        log_progress(f"  Average completeness score: {avg_score:.3f}")
        log_progress(f"  Import coverage: {with_scores/total*100:.2f}%")
        
        # Validate expected distribution
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN phase_completed = 1 THEN 1 END) * 100.0 / COUNT(*) as phase1_pct,
                COUNT(CASE WHEN phase_completed = 2 THEN 1 END) * 100.0 / COUNT(*) as phase2_pct,
                COUNT(CASE WHEN phase_completed = 3 THEN 1 END) * 100.0 / COUNT(*) as phase3_pct
            FROM emails_enhanced 
            WHERE chain_completeness_score IS NOT NULL
        """)
        
        phase1_pct, phase2_pct, phase3_pct = cursor.fetchone()
        log_progress(f"Distribution Validation:")
        log_progress(f"  Phase 1: {phase1_pct:.1f}% (Target: ~6%)")
        log_progress(f"  Phase 2: {phase2_pct:.1f}% (Target: ~54%)")
        log_progress(f"  Phase 3: {phase3_pct:.1f}% (Target: ~40%)")
        
    except Exception as e:
        log_progress(f"Verification error: {e}")
    finally:
        conn.close()

def main():
    """Main execution function"""
    log_progress("Starting robust email chain import process")
    
    try:
        # Check if files exist
        if not os.path.exists(CHAIN_ANALYSIS_PATH):
            log_progress(f"Chain analysis file not found: {CHAIN_ANALYSIS_PATH}")
            sys.exit(1)
        
        if not os.path.exists(DB_PATH):
            log_progress(f"Database file not found: {DB_PATH}")
            sys.exit(1)
        
        # Step 1: Process chain analysis file
        email_to_chain = process_chain_file_streaming()
        
        if not email_to_chain:
            log_progress("No email mappings created. Exiting.")
            sys.exit(1)
        
        # Step 2: Update database
        update_database_with_chain_data(email_to_chain)
        
        # Step 3: Verify results
        verify_import_results()
        
        log_progress("Import process completed successfully!")
        log_progress("Ready for adaptive 3-phase email processing!")
        
    except Exception as e:
        log_progress(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()