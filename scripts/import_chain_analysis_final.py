#!/usr/bin/env python3
"""
Final Memory-Efficient Email Chain Analysis Import Script
Uses Python's built-in json module with streaming approach to handle large JSON files.

Key Features:
- Direct JSON streaming with ijson library for memory efficiency
- Handles actual JSON structure from chain analysis
- Batch database updates for performance
- Real-time progress monitoring with memory usage
"""

import sqlite3
import sys
import os
from datetime import datetime
from typing import Dict, Any, Iterator
import gc

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

def install_ijson():
    """Install ijson if not available"""
    try:
        import ijson
        return True
    except ImportError:
        log_progress("Installing ijson for efficient JSON streaming...")
        os.system("pip install ijson")
        try:
            import ijson  # Try importing again
            return True
        except ImportError:
            log_progress("Failed to install ijson. Falling back to chunked loading.")
            return False

def load_chain_analysis_with_ijson() -> Dict[str, Dict[str, Any]]:
    """Load chain analysis using ijson for memory efficiency"""
    try:
        import ijson
    except ImportError:
        return {}
    
    log_progress("Loading chain analysis with ijson streaming...")
    email_to_chain = {}
    phase_counts = {1: 0, 2: 0, 3: 0}
    chains_processed = 0
    
    try:
        with open(CHAIN_ANALYSIS_PATH, 'rb') as f:
            # Parse the main object structure
            parser = ijson.parse(f)
            current_chain_id = None
            current_chain_data = {}
            current_emails = []
            in_emails_array = False
            current_email = {}
            
            for prefix, event, value in parser:
                # Handle chain-level data
                if prefix.count('.') == 1 and event == 'map_key':
                    current_chain_id = value
                    current_chain_data = {}
                    current_emails = []
                    chains_processed += 1
                    
                elif current_chain_id and prefix == f"{current_chain_id}.completeness" and event == 'string':
                    current_chain_data['completeness'] = value
                    
                elif current_chain_id and prefix == f"{current_chain_id}.completeness_score" and event == 'number':
                    current_chain_data['completeness_score'] = value
                    
                elif current_chain_id and prefix == f"{current_chain_id}.workflow_type" and event == 'string':
                    current_chain_data['workflow_type'] = value
                    
                elif current_chain_id and prefix == f"{current_chain_id}.confidence_score" and event == 'number':
                    current_chain_data['confidence_score'] = value
                    
                # Handle emails array
                elif current_chain_id and prefix == f"{current_chain_id}.emails" and event == 'start_array':
                    in_emails_array = True
                    current_emails = []
                    
                elif current_chain_id and prefix == f"{current_chain_id}.emails" and event == 'end_array':
                    in_emails_array = False
                    # Process this chain
                    process_chain_data(current_chain_id, current_chain_data, current_emails, 
                                     email_to_chain, phase_counts)
                    
                # Handle individual emails in the array
                elif in_emails_array and prefix == f"{current_chain_id}.emails.item" and event == 'start_map':
                    current_email = {}
                    
                elif in_emails_array and prefix == f"{current_chain_id}.emails.item.MessageID" and event == 'string':
                    current_email['MessageID'] = value
                    
                elif in_emails_array and prefix == f"{current_chain_id}.emails.item" and event == 'end_map':
                    if 'MessageID' in current_email:
                        current_emails.append(current_email['MessageID'])
                    current_email = {}
                
                # Progress logging
                if chains_processed % 1000 == 0 and chains_processed > 0:
                    log_progress(f"Processed {chains_processed} chains, mapped {len(email_to_chain)} emails")
                    gc.collect()
        
        log_progress(f"ijson processing complete:")
        log_progress(f"  Total chains processed: {chains_processed}")
        log_progress(f"  Total emails mapped: {len(email_to_chain)}")
        log_progress(f"  Phase 1 (Complete): {phase_counts[1]} chains")
        log_progress(f"  Phase 2 (Partial): {phase_counts[2]} chains")
        log_progress(f"  Phase 3 (Broken): {phase_counts[3]} chains")
        
        return email_to_chain
        
    except Exception as e:
        log_progress(f"ijson processing error: {e}")
        return {}

def process_chain_data(chain_id: str, chain_data: Dict[str, Any], email_ids: list,
                      email_to_chain: Dict[str, Dict[str, Any]], 
                      phase_counts: Dict[int, int]):
    """Process a single chain and update email mappings"""
    try:
        # Extract chain properties with defaults
        completeness = chain_data.get('completeness', 'broken')
        completeness_score = float(chain_data.get('completeness_score', 0.0))
        workflow_type = chain_data.get('workflow_type', 'general_inquiry')
        confidence_score = float(chain_data.get('confidence_score', 0.0))
        
        # Get phase assignment
        recommended_phase = get_chain_completeness_phase(completeness, completeness_score)
        phase_counts[recommended_phase] += 1
        
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
            
    except Exception as e:
        log_progress(f"Error processing chain {chain_id}: {e}")

def load_chain_analysis_chunked() -> Dict[str, Dict[str, Any]]:
    """Fallback chunked loading approach"""
    log_progress("Using chunked loading approach...")
    
    # Try to load in smaller chunks
    chunk_size = 50 * 1024 * 1024  # 50MB chunks
    email_to_chain = {}
    
    try:
        with open(CHAIN_ANALYSIS_PATH, 'r', encoding='utf-8') as f:
            content = f.read(chunk_size)
            
            # Try to find complete JSON objects in the content
            if content.startswith('{') and content.count('"chain_') > 0:
                # Simple approach: just get the first few chains for testing
                log_progress("Loading first chunk for testing...")
                
                # Find the first few complete chain objects
                lines = content.split('\n')
                json_content = "{\n"
                brace_count = 1
                chain_count = 0
                
                for line in lines[1:]:  # Skip first line (opening brace)
                    json_content += line + "\n"
                    
                    if '"chain_' in line and line.strip().endswith(': {'):
                        chain_count += 1
                    
                    brace_count += line.count('{') - line.count('}')
                    
                    # Stop after 10 complete chains or when we close the main object
                    if chain_count >= 10 or brace_count <= 0:
                        if brace_count > 0:
                            json_content += "}\n"
                        break
                
                # Try to parse this smaller JSON
                import json
                try:
                    chain_data = json.loads(json_content)
                    log_progress(f"Successfully loaded {len(chain_data)} chains for testing")
                    
                    # Process the chains
                    phase_counts = {1: 0, 2: 0, 3: 0}
                    for chain_id, chain_info in chain_data.items():
                        if 'emails' in chain_info:
                            email_ids = [email.get('MessageID', email.get('id', '')) 
                                       for email in chain_info['emails'] 
                                       if isinstance(email, dict)]
                            email_ids = [eid for eid in email_ids if eid]  # Remove empty IDs
                            
                            process_chain_data(chain_id, chain_info, email_ids, 
                                             email_to_chain, phase_counts)
                    
                    log_progress(f"Chunked processing result:")
                    log_progress(f"  Emails mapped: {len(email_to_chain)}")
                    log_progress(f"  Phase distribution: {phase_counts}")
                    
                    return email_to_chain
                    
                except json.JSONDecodeError as e:
                    log_progress(f"JSON decode error in chunked approach: {e}")
                    
    except Exception as e:
        log_progress(f"Chunked loading error: {e}")
    
    return {}

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
        if updated_count > 0:
            log_progress("Database update complete!")
            log_progress(f"  Phase 1 (Complete): {phase_counts[1]:,} emails ({phase_counts[1]/updated_count*100:.1f}%)")
            log_progress(f"  Phase 2 (Partial): {phase_counts[2]:,} emails ({phase_counts[2]/updated_count*100:.1f}%)")
            log_progress(f"  Phase 3 (Broken): {phase_counts[3]:,} emails ({phase_counts[3]/updated_count*100:.1f}%)")
            log_progress(f"  Total updated: {updated_count:,} emails")
            log_progress(f"  Not found in chains: {not_found_count:,} emails")
            log_progress(f"  Coverage: {updated_count/total_processed*100:.2f}%")
        else:
            log_progress("No emails were updated. Check email ID matching.")
        
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
        # Check if any data was imported
        cursor.execute("SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score IS NOT NULL")
        updated_count = cursor.fetchone()[0]
        
        if updated_count == 0:
            log_progress("No chain data found in database. Import may have failed.")
            return
        
        # Check phase distribution
        cursor.execute("""
            SELECT 
                phase_completed,
                chain_type,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / ?, 2) as percentage
            FROM emails_enhanced 
            WHERE chain_completeness_score IS NOT NULL
            GROUP BY phase_completed, chain_type
            ORDER BY phase_completed, chain_type
        """, (updated_count,))
        
        results = cursor.fetchall()
        log_progress("Final Chain Distribution by Phase:")
        for phase, chain_type, count, percentage in results:
            log_progress(f"  Phase {phase} ({chain_type}): {count:,} emails ({percentage}%)")
        
        # Overall statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT chain_id) as unique_chains,
                AVG(chain_completeness_score) as avg_score
            FROM emails_enhanced
            WHERE chain_completeness_score IS NOT NULL
        """)
        
        unique_chains, avg_score = cursor.fetchone()[1:]
        cursor.execute("SELECT COUNT(*) FROM emails_enhanced")
        total_emails = cursor.fetchone()[0]
        
        log_progress(f"Overall Statistics:")
        log_progress(f"  Total emails: {total_emails:,}")
        log_progress(f"  Emails with chain data: {updated_count:,}")
        log_progress(f"  Unique chains: {unique_chains:,}")
        log_progress(f"  Average completeness score: {avg_score:.3f}")
        log_progress(f"  Import coverage: {updated_count/total_emails*100:.2f}%")
        
    except Exception as e:
        log_progress(f"Verification error: {e}")
    finally:
        conn.close()

def main():
    """Main execution function"""
    log_progress("Starting final email chain import process")
    
    try:
        # Check if files exist
        if not os.path.exists(CHAIN_ANALYSIS_PATH):
            log_progress(f"Chain analysis file not found: {CHAIN_ANALYSIS_PATH}")
            sys.exit(1)
        
        if not os.path.exists(DB_PATH):
            log_progress(f"Database file not found: {DB_PATH}")
            sys.exit(1)
        
        # Step 1: Try to load chain analysis data
        email_to_chain = {}
        
        # First try ijson approach
        if install_ijson():
            email_to_chain = load_chain_analysis_with_ijson()
        
        # If ijson fails, try chunked approach
        if not email_to_chain:
            log_progress("ijson approach failed, trying chunked loading...")
            email_to_chain = load_chain_analysis_chunked()
        
        if not email_to_chain:
            log_progress("All loading approaches failed. Exiting.")
            sys.exit(1)
        
        # Step 2: Update database
        update_database_with_chain_data(email_to_chain)
        
        # Step 3: Verify results
        verify_import_results()
        
        log_progress("Import process completed!")
        log_progress("Database is ready for adaptive 3-phase email processing!")
        
    except Exception as e:
        log_progress(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()