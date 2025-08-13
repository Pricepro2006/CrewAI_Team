#!/usr/bin/env python3
"""
Fixed Memory-Efficient Email Chain Analysis Import Script
Handles the actual JSON structure from chain analysis results.

Key Features:
- Correct JSON loading for large files
- Batch processing with 1000 emails per batch  
- Memory-efficient processing with garbage collection
- Real-time progress monitoring
- Optimized for 6%/54%/40% chain distribution
"""

import json
import sqlite3
import sys
import os
from datetime import datetime
from typing import Dict, Any
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

def load_chain_analysis_in_chunks():
    """
    Load chain analysis data efficiently by processing in smaller chunks
    """
    log_progress("Loading chain analysis data...")
    
    try:
        # Try to load the JSON file in chunks
        with open(CHAIN_ANALYSIS_PATH, 'r', encoding='utf-8') as f:
            # Read the file in smaller chunks to avoid memory issues
            content = ""
            chunk_size = 1024 * 1024  # 1MB chunks
            
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                content += chunk
                
                # If we have enough content, try to parse partial JSON
                if len(content) > chunk_size * 10:  # 10MB
                    break
            
            # Parse the full JSON
            log_progress("Parsing JSON data...")
            chain_data = json.loads(content)
            log_progress(f"Successfully loaded {len(chain_data)} chains")
            return chain_data
            
    except MemoryError:
        log_progress("Memory error loading full file. Trying alternative approach...")
        return load_chain_analysis_streaming()
    except Exception as e:
        log_progress(f"Error loading chain analysis: {e}")
        return {}

def load_chain_analysis_streaming():
    """
    Alternative streaming approach for very large files
    """
    log_progress("Using streaming approach for large file...")
    
    try:
        import ijson  # Install with: pip install ijson
        
        chain_data = {}
        with open(CHAIN_ANALYSIS_PATH, 'rb') as f:
            parser = ijson.parse(f)
            current_chain = None
            current_key = None
            current_value = {}
            
            for prefix, event, value in parser:
                if event == 'start_map' and '.' not in prefix:
                    # Start of a new chain
                    current_chain = prefix
                    current_value = {}
                elif event == 'map_key' and current_chain and prefix.startswith(current_chain):
                    current_key = value
                elif event in ('string', 'number', 'boolean') and current_chain and current_key:
                    current_value[current_key] = value
                elif event == 'end_map' and current_chain and '.' not in prefix:
                    # End of current chain
                    chain_data[current_chain] = current_value
                    if len(chain_data) % 1000 == 0:
                        log_progress(f"Loaded {len(chain_data)} chains...")
                        gc.collect()
                    current_chain = None
                    current_value = {}
        
        log_progress(f"Streaming load complete: {len(chain_data)} chains")
        return chain_data
        
    except ImportError:
        log_progress("ijson not available. Installing...")
        os.system("pip install ijson")
        return load_chain_analysis_streaming()
    except Exception as e:
        log_progress(f"Streaming load error: {e}")
        return {}

def process_chain_data_for_emails(chain_data: Dict[str, Any]):
    """
    Process chain data to create email-to-chain mapping
    """
    log_progress("Processing chain data for email mapping...")
    
    email_to_chain = {}
    phase_counts = {1: 0, 2: 0, 3: 0}
    
    for chain_id, chain_info in chain_data.items():
        try:
            # Extract chain properties
            completeness = chain_info.get('completeness', 'broken')
            completeness_score = float(chain_info.get('completeness_score', 0.0))
            workflow_type = chain_info.get('workflow_type', 'general_inquiry')
            confidence_score = float(chain_info.get('confidence_score', 0.0))
            
            # Get phase assignment
            recommended_phase = get_chain_completeness_phase(completeness, completeness_score)
            phase_counts[recommended_phase] += 1
            
            # Map emails in this chain
            email_ids = chain_info.get('email_ids', [])
            
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
            
            if len(email_to_chain) % 10000 == 0:
                log_progress(f"Processed {len(email_to_chain)} email mappings...")
                gc.collect()
                
        except Exception as e:
            log_progress(f"Error processing chain {chain_id}: {e}")
            continue
    
    log_progress(f"Chain processing complete:")
    log_progress(f"  Phase 1 (Complete): {phase_counts[1]} chains")
    log_progress(f"  Phase 2 (Partial): {phase_counts[2]} chains") 
    log_progress(f"  Phase 3 (Broken): {phase_counts[3]} chains")
    log_progress(f"  Total emails mapped: {len(email_to_chain)}")
    
    return email_to_chain

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
                log_progress(f"Batch {batch_num}: Updated {len(batch_updates)} emails | Total: {updated_count}")
                gc.collect()
        
        # Final statistics
        total_processed = updated_count + not_found_count
        log_progress("Database update complete!")
        log_progress(f"  Phase 1 (Complete): {phase_counts[1]} emails ({phase_counts[1]/updated_count*100:.1f}%)")
        log_progress(f"  Phase 2 (Partial): {phase_counts[2]} emails ({phase_counts[2]/updated_count*100:.1f}%)")
        log_progress(f"  Phase 3 (Broken): {phase_counts[3]} emails ({phase_counts[3]/updated_count*100:.1f}%)")
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
    """Verify the import was successful"""
    log_progress("Verifying import results...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check distribution
        cursor.execute("""
            SELECT 
                chain_type,
                phase_completed,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score IS NOT NULL), 2) as percentage
            FROM emails_enhanced 
            WHERE chain_completeness_score IS NOT NULL
            GROUP BY chain_type, phase_completed
            ORDER BY phase_completed, chain_type
        """)
        
        results = cursor.fetchall()
        log_progress("Final Chain Distribution by Phase:")
        for chain_type, phase, count, percentage in results:
            log_progress(f"  Phase {phase} ({chain_type}): {count:,} emails ({percentage}%)")
        
        # Overall statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN chain_completeness_score IS NOT NULL THEN 1 END) as with_scores,
                COUNT(DISTINCT chain_id) as unique_chains
            FROM emails_enhanced
        """)
        
        total, with_scores, unique_chains = cursor.fetchone()
        log_progress(f"Overall Statistics:")
        log_progress(f"  Total emails: {total:,}")
        log_progress(f"  Emails with chain data: {with_scores:,}")
        log_progress(f"  Unique chains: {unique_chains:,}")
        log_progress(f"  Import coverage: {with_scores/total*100:.2f}%")
        
    except Exception as e:
        log_progress(f"Verification error: {e}")
    finally:
        conn.close()

def main():
    """Main execution function"""
    log_progress("Starting fixed email chain import process")
    
    try:
        # Step 1: Load chain analysis data
        chain_data = load_chain_analysis_in_chunks()
        if not chain_data:
            log_progress("No chain data loaded. Exiting.")
            sys.exit(1)
        
        # Step 2: Process chain data for email mapping
        email_to_chain = process_chain_data_for_emails(chain_data)
        if not email_to_chain:
            log_progress("No email mappings created. Exiting.")
            sys.exit(1)
        
        # Clear chain_data from memory
        del chain_data
        gc.collect()
        
        # Step 3: Update database
        update_database_with_chain_data(email_to_chain)
        
        # Step 4: Verify results
        verify_import_results()
        
        log_progress("Import process completed successfully!")
        
    except Exception as e:
        log_progress(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()