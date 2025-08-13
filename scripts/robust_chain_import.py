#!/usr/bin/env python3
"""
Robust Chain Data Import Script
==============================

Memory-efficient import of email chain analysis data with JSON error handling.
Processes the 8M line JSON file in chunks to avoid memory spikes.
"""

import json
import sqlite3
import os
import sys
from typing import Dict, Any, Optional, List, Tuple
import logging
from datetime import datetime
import gc
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/logs/robust_chain_import.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class RobustChainImporter:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.processed_chains = 0
        self.failed_chains = 0
        self.updated_emails = 0
        self.batch_size = 1000
        
        # Phase distribution targets from stats
        self.phase_targets = {
            'complete': 0.06,    # 6% -> Phase 1 (Rule-based)
            'partial': 0.54,     # 54% -> Phase 2 (Llama 3.2)
            'broken': 0.401      # 40.1% -> Phase 3 (Phi-4)
        }
    
    def get_db_connection(self) -> sqlite3.Connection:
        """Get database connection with optimizations"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        conn.execute('PRAGMA temp_store=MEMORY')
        return conn
    
    def parse_json_line_by_line(self, file_path: str) -> Dict[str, Any]:
        """
        Parse large JSON file line by line to handle malformed sections
        Returns valid chain data, skipping malformed entries
        """
        chains_data = {}
        current_chain = {}
        current_key = None
        brace_count = 0
        in_chain = False
        line_buffer = []
        
        logger.info(f"Starting line-by-line JSON parsing of {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if line_num % 100000 == 0:
                        logger.info(f"Processed {line_num:,} lines, found {len(chains_data):,} valid chains")
                        # Force garbage collection every 100k lines
                        gc.collect()
                    
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Track brace nesting
                    brace_count += line.count('{') - line.count('}')
                    
                    # Detect start of new chain
                    if '"chain_' in line and '": {' in line:
                        # Save previous chain if valid
                        if current_chain and current_key:
                            try:
                                self._validate_and_store_chain(current_key, current_chain, chains_data)
                            except Exception as e:
                                logger.warning(f"Failed to store chain {current_key}: {e}")
                                self.failed_chains += 1
                        
                        # Start new chain
                        current_key = line.split('"')[1]
                        current_chain = {}
                        line_buffer = [line]
                        in_chain = True
                        continue
                    
                    if in_chain:
                        line_buffer.append(line)
                        
                        # Try to parse when we think we have a complete chain
                        if brace_count == 0 and len(line_buffer) > 5:
                            try:
                                # Reconstruct the chain JSON
                                chain_json = '\n'.join(line_buffer)
                                if chain_json.endswith(','):
                                    chain_json = chain_json[:-1]
                                
                                # Wrap in braces to make valid JSON
                                if not chain_json.startswith('{'):
                                    chain_json = '{' + chain_json + '}'
                                
                                parsed = json.loads(chain_json)
                                if current_key in parsed:
                                    current_chain = parsed[current_key]
                                    self._validate_and_store_chain(current_key, current_chain, chains_data)
                                    self.processed_chains += 1
                                
                                # Reset for next chain
                                current_chain = {}
                                current_key = None
                                line_buffer = []
                                in_chain = False
                                
                            except json.JSONDecodeError:
                                # Continue accumulating lines
                                continue
                            except Exception as e:
                                logger.warning(f"Error processing chain {current_key}: {e}")
                                self.failed_chains += 1
                                # Reset and continue
                                current_chain = {}
                                current_key = None
                                line_buffer = []
                                in_chain = False
        
        except Exception as e:
            logger.error(f"Critical error during JSON parsing: {e}")
            logger.error(traceback.format_exc())
        
        logger.info(f"JSON parsing complete. Valid chains: {len(chains_data):,}, Failed: {self.failed_chains:,}")
        return chains_data
    
    def _validate_and_store_chain(self, chain_id: str, chain_data: Dict[str, Any], storage: Dict[str, Any]):
        """Validate chain data and store if valid"""
        required_fields = ['chain_id', 'completeness', 'workflow_type']
        
        if not all(field in chain_data for field in required_fields):
            raise ValueError(f"Missing required fields in chain {chain_id}")
        
        # Ensure numeric values are valid
        if 'completeness_score' in chain_data:
            try:
                chain_data['completeness_score'] = float(chain_data['completeness_score'])
            except (ValueError, TypeError):
                chain_data['completeness_score'] = 0.0
        
        if 'email_count' in chain_data:
            try:
                chain_data['email_count'] = int(chain_data['email_count'])
            except (ValueError, TypeError):
                chain_data['email_count'] = 0
        
        storage[chain_id] = chain_data
    
    def insert_chain_analysis_batch(self, chains_batch: List[Tuple], conn: sqlite3.Connection):
        """Insert batch of chain analysis data"""
        try:
            conn.executemany("""
                INSERT OR REPLACE INTO email_chain_analysis (
                    chain_id, subject_normalized, conversation_id, email_count,
                    participants, start_date, end_date, workflow_type,
                    completeness, completeness_score, entities, actionable_items,
                    business_value, key_phrases, sentiment_scores, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, chains_batch)
            conn.commit()
            logger.info(f"Inserted batch of {len(chains_batch)} chain analysis records")
        except Exception as e:
            logger.error(f"Error inserting chain analysis batch: {e}")
            conn.rollback()
            raise
    
    def update_emails_with_phase_recommendations(self, chains_data: Dict[str, Any], conn: sqlite3.Connection):
        """Update emails with completeness scores and phase recommendations"""
        logger.info("Updating emails with phase recommendations...")
        
        batch_updates = []
        processed = 0
        
        for chain_id, chain_info in chains_data.items():
            completeness = chain_info.get('completeness', 'broken')
            completeness_score = chain_info.get('completeness_score', 0.0)
            
            # Determine recommended phase based on completeness
            if completeness == 'complete':
                recommended_phase = 1  # Rule-based processing
            elif completeness == 'partial':
                recommended_phase = 2  # Llama 3.2 processing
            else:  # broken or unknown
                recommended_phase = 3  # Phi-4 processing
            
            # Determine if chain is complete for processing
            is_complete = 1 if completeness == 'complete' else 0
            
            batch_updates.append((
                completeness_score,
                completeness,
                is_complete,
                recommended_phase,  # Store as phase_completed for now
                chain_id
            ))
            
            processed += 1
            
            # Process in batches
            if len(batch_updates) >= self.batch_size:
                self._execute_email_updates(batch_updates, conn)
                batch_updates = []
                logger.info(f"Updated {processed:,} chains with phase recommendations")
        
        # Process remaining batch
        if batch_updates:
            self._execute_email_updates(batch_updates, conn)
        
        logger.info(f"Completed updating emails. Total chains processed: {processed:,}")
    
    def _execute_email_updates(self, batch_updates: List[Tuple], conn: sqlite3.Connection):
        """Execute batch email updates"""
        try:
            conn.executemany("""
                UPDATE emails_enhanced 
                SET chain_completeness_score = ?,
                    chain_type = ?,
                    is_chain_complete = ?,
                    phase_completed = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE chain_id = ?
            """, batch_updates)
            conn.commit()
            self.updated_emails += len(batch_updates)
        except Exception as e:
            logger.error(f"Error updating email batch: {e}")
            conn.rollback()
            raise
    
    def import_chain_data(self, analysis_file_path: str):
        """Main import process"""
        logger.info("=== Starting Robust Chain Data Import ===")
        start_time = datetime.now()
        
        try:
            # Step 1: Parse JSON with error handling
            logger.info("Step 1: Parsing chain analysis JSON...")
            chains_data = self.parse_json_line_by_line(analysis_file_path)
            
            if not chains_data:
                logger.error("No valid chain data found!")
                return False
            
            # Step 2: Insert chain analysis data
            logger.info("Step 2: Inserting chain analysis data...")
            conn = self.get_db_connection()
            
            try:
                chain_batch = []
                for chain_id, chain_info in chains_data.items():
                    # Prepare chain analysis record
                    participants_json = json.dumps(chain_info.get('participants', []))
                    entities_json = json.dumps(chain_info.get('entities', {}))
                    actionable_items_json = json.dumps(chain_info.get('actionable_items', []))
                    key_phrases_json = json.dumps(chain_info.get('key_phrases', []))
                    sentiment_scores_json = json.dumps(chain_info.get('sentiment_scores', {}))
                    
                    chain_record = (
                        chain_id,
                        chain_info.get('subject_normalized', ''),
                        chain_info.get('conversation_id'),
                        chain_info.get('email_count', 0),
                        participants_json,
                        chain_info.get('start_date'),
                        chain_info.get('end_date'),
                        chain_info.get('workflow_type', 'general_inquiry'),
                        chain_info.get('completeness', 'broken'),
                        chain_info.get('completeness_score', 0.0),
                        entities_json,
                        actionable_items_json,
                        chain_info.get('business_value', 0.0),
                        key_phrases_json,
                        sentiment_scores_json,
                        datetime.now().isoformat()
                    )
                    
                    chain_batch.append(chain_record)
                    
                    # Insert in batches
                    if len(chain_batch) >= self.batch_size:
                        self.insert_chain_analysis_batch(chain_batch, conn)
                        chain_batch = []
                
                # Insert remaining batch
                if chain_batch:
                    self.insert_chain_analysis_batch(chain_batch, conn)
                
                # Step 3: Update emails with phase recommendations
                self.update_emails_with_phase_recommendations(chains_data, conn)
                
                # Step 4: Generate summary
                self._generate_import_summary(conn)
                
            finally:
                conn.close()
            
            # Report results
            duration = datetime.now() - start_time
            logger.info("=== Import Complete ===")
            logger.info(f"Duration: {duration}")
            logger.info(f"Chains processed: {self.processed_chains:,}")
            logger.info(f"Chains failed: {self.failed_chains:,}")
            logger.info(f"Emails updated: {self.updated_emails:,}")
            
            return True
            
        except Exception as e:
            logger.error(f"Import failed: {e}")
            logger.error(traceback.format_exc())
            return False
    
    def _generate_import_summary(self, conn: sqlite3.Connection):
        """Generate and log import summary"""
        logger.info("=== Import Summary ===")
        
        # Count chains by completeness
        cursor = conn.execute("""
            SELECT completeness, COUNT(*) as count
            FROM email_chain_analysis
            GROUP BY completeness
            ORDER BY count DESC
        """)
        
        completeness_counts = cursor.fetchall()
        for completeness, count in completeness_counts:
            logger.info(f"Chains - {completeness}: {count:,}")
        
        # Count emails by phase recommendation
        cursor = conn.execute("""
            SELECT phase_completed, COUNT(*) as count
            FROM emails_enhanced
            WHERE phase_completed IS NOT NULL
            GROUP BY phase_completed
            ORDER BY phase_completed
        """)
        
        phase_counts = cursor.fetchall()
        for phase, count in phase_counts:
            phase_name = {1: "Rule-based", 2: "Llama 3.2", 3: "Phi-4"}.get(phase, f"Phase {phase}")
            logger.info(f"Emails for {phase_name}: {count:,}")

def main():
    """Main execution"""
    db_path = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db"
    analysis_file = "/home/pricepro2006/CrewAI_Team/data/email_chain_analysis/email_chain_analysis.json"
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found: {db_path}")
        sys.exit(1)
    
    if not os.path.exists(analysis_file):
        logger.error(f"Analysis file not found: {analysis_file}")
        sys.exit(1)
    
    importer = RobustChainImporter(db_path)
    success = importer.import_chain_data(analysis_file)
    
    if success:
        logger.info("Chain data import completed successfully!")
        sys.exit(0)
    else:
        logger.error("Chain data import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()