#!/usr/bin/env python3
"""
Memory-Efficient Email Chain Analysis Import Script
Designed to handle 143k emails with chain analysis data while avoiding heap errors.

Key Features:
- Batch processing with 1000 emails per batch
- Memory-efficient JSON streaming
- Real-time progress monitoring
- Optimized for 6%/54%/40% chain distribution
- Automatic phase routing based on completeness scores
"""

import json
import sqlite3
import sys
import os
from datetime import datetime
from typing import Dict, Any, Iterator, Tuple
import gc
import psutil

# Configuration
BATCH_SIZE = 1000
DB_PATH = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
CHAIN_ANALYSIS_PATH = "/home/pricepro2006/CrewAI_Team/data/email_chain_analysis/email_chain_analysis.json"
EMAILS_PATH = "/home/pricepro2006/CrewAI_Team/data/consolidated_emails/all_unique_emails_original_format.json"

def get_memory_usage():
    """Get current memory usage in MB"""
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024

def log_progress(message: str, show_memory: bool = True):
    """Log progress with timestamp and optional memory usage"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    memory_info = f" | Memory: {get_memory_usage():.1f}MB" if show_memory else ""
    print(f"[{timestamp}]{memory_info} {message}")

def stream_json_objects(file_path: str) -> Iterator[Tuple[str, Dict[str, Any]]]:
    """
    Memory-efficient JSON streaming for large files.
    Yields (key, value) pairs from the JSON object.
    """
    log_progress(f"Starting to stream JSON from {file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        # Skip opening brace
        char = f.read(1)
        if char != '{':
            raise ValueError("Expected JSON object to start with '{'")
        
        buffer = ""
        in_string = False
        escape_next = False
        brace_depth = 0
        current_key = None
        
        while True:
            char = f.read(1)
            if not char:
                break
                
            buffer += char
            
            if escape_next:
                escape_next = False
                continue
                
            if char == '\\':
                escape_next = True
                continue
                
            if char == '"' and not escape_next:
                in_string = not in_string
                continue
                
            if in_string:
                continue
                
            if char == '{':
                brace_depth += 1
            elif char == '}':
                if brace_depth == 0:
                    # End of main object
                    break
                brace_depth -= 1
                
                if brace_depth == 0 and current_key:
                    # End of a top-level object
                    try:
                        # Extract the object JSON
                        obj_start = buffer.rfind('": {')
                        if obj_start != -1:
                            obj_json = buffer[obj_start + 3:].rstrip(',\n ')
                            obj_data = json.loads(obj_json)
                            yield current_key, obj_data
                            
                            # Clear buffer and reset
                            buffer = ""
                            current_key = None
                            gc.collect()  # Force garbage collection
                    except json.JSONDecodeError as e:
                        log_progress(f"JSON decode error for key {current_key}: {e}")
                        continue
                        
            elif char == ':' and brace_depth == 0 and current_key is None:
                # Extract the key
                key_match = buffer.strip().rstrip(':').strip()
                if key_match.startswith('"') and key_match.endswith('"'):
                    current_key = key_match[1:-1]

def get_chain_completeness_phase(completeness_score: float) -> int:
    """Map chain completeness score to processing phase"""
    if completeness_score >= 0.8:
        return 1  # Complete chains -> Phase 1 (Rule-based)
    elif completeness_score >= 0.4:
        return 2  # Partial chains -> Phase 2 (Llama 3.2)
    else:
        return 3  # Broken chains -> Phase 3 (Phi-4)

def create_email_to_chain_mapping() -> Dict[str, Dict[str, Any]]:
    """
    Create a memory-efficient mapping from email IDs to chain data.
    Processes in batches to avoid memory issues.
    """
    log_progress("Creating email-to-chain mapping...")
    email_to_chain = {}
    chain_count = 0
    
    try:
        for chain_id, chain_data in stream_json_objects(CHAIN_ANALYSIS_PATH):
            chain_count += 1
            
            # Extract key chain properties
            completeness_score = chain_data.get('completeness_score', 0.0)
            workflow_type = chain_data.get('workflow_type', 'general_inquiry')
            business_value = chain_data.get('business_value', {}).get('estimated_value', 0.0)
            
            # Map each email in the chain
            email_ids = chain_data.get('email_ids', [])
            for email_id in email_ids:
                email_to_chain[email_id] = {
                    'chain_id': chain_id,
                    'chain_completeness_score': completeness_score,
                    'chain_type': chain_data.get('type', 'unknown'),
                    'is_chain_complete': 1 if completeness_score >= 0.8 else 0,
                    'workflow_state': workflow_type,
                    'confidence_score': chain_data.get('confidence_score', 0.0),
                    'recommended_phase': get_chain_completeness_phase(completeness_score),
                    'business_value': business_value
                }
            
            if chain_count % 1000 == 0:
                log_progress(f"Processed {chain_count} chains, mapped {len(email_to_chain)} emails")
                gc.collect()
                
    except Exception as e:
        log_progress(f"Error creating email-to-chain mapping: {e}")
        return {}
    
    log_progress(f"Mapping complete: {chain_count} chains, {len(email_to_chain)} emails mapped")
    return email_to_chain

def update_emails_with_chain_data(email_to_chain: Dict[str, Dict[str, Any]]):
    """Update database with chain analysis data in batches"""
    log_progress("Starting database updates...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Get all email IDs that need updating
        cursor.execute("SELECT id FROM emails_enhanced ORDER BY id")
        all_email_ids = [row[0] for row in cursor.fetchall()]
        
        log_progress(f"Found {len(all_email_ids)} emails to potentially update")
        
        # Process in batches
        updated_count = 0
        phase_counts = {1: 0, 2: 0, 3: 0}
        
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
                
                log_progress(f"Updated batch {i//BATCH_SIZE + 1}: {len(batch_updates)} emails | Total: {updated_count}")
                gc.collect()
        
        # Final statistics
        log_progress("Update complete! Final distribution:")
        log_progress(f"  Phase 1 (Complete): {phase_counts[1]} emails ({phase_counts[1]/updated_count*100:.1f}%)")
        log_progress(f"  Phase 2 (Partial): {phase_counts[2]} emails ({phase_counts[2]/updated_count*100:.1f}%)")
        log_progress(f"  Phase 3 (Broken): {phase_counts[3]} emails ({phase_counts[3]/updated_count*100:.1f}%)")
        log_progress(f"  Total updated: {updated_count} emails")
        
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
                CASE 
                    WHEN chain_completeness_score >= 0.8 THEN 'Complete'
                    WHEN chain_completeness_score >= 0.4 THEN 'Partial'
                    ELSE 'Broken'
                END as category,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score IS NOT NULL), 2) as percentage
            FROM emails_enhanced 
            WHERE chain_completeness_score IS NOT NULL
            GROUP BY category
            ORDER BY category
        """)
        
        results = cursor.fetchall()
        log_progress("Chain Distribution Verification:")
        for category, count, percentage in results:
            log_progress(f"  {category}: {count:,} emails ({percentage}%)")
        
        # Check total counts
        cursor.execute("SELECT COUNT(*) FROM emails_enhanced")
        total_emails = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM emails_enhanced WHERE chain_completeness_score IS NOT NULL")
        emails_with_scores = cursor.fetchone()[0]
        
        log_progress(f"Total emails: {total_emails:,}")
        log_progress(f"Emails with chain scores: {emails_with_scores:,}")
        log_progress(f"Import coverage: {emails_with_scores/total_emails*100:.2f}%")
        
    except Exception as e:
        log_progress(f"Verification error: {e}")
    finally:
        conn.close()

def main():
    """Main execution function"""
    log_progress("Starting memory-efficient email chain import process")
    log_progress(f"Initial memory usage: {get_memory_usage():.1f}MB")
    
    try:
        # Step 1: Create email-to-chain mapping
        email_to_chain = create_email_to_chain_mapping()
        log_progress(f"Memory after mapping: {get_memory_usage():.1f}MB")
        
        if not email_to_chain:
            log_progress("No chain mapping data found. Exiting.")
            sys.exit(1)
        
        # Step 2: Update database with chain data
        update_emails_with_chain_data(email_to_chain)
        log_progress(f"Memory after database updates: {get_memory_usage():.1f}MB")
        
        # Step 3: Verify results
        verify_import_results()
        
        log_progress("Import process completed successfully!")
        
    except Exception as e:
        log_progress(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()