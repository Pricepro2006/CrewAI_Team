#!/usr/bin/env python3
"""
Import Chain Metadata
=====================

Targeted import of chain analysis metadata into email_chain_analysis table.
The emails already have correct phase assignments - we just need chain metadata.
"""

import json
import sqlite3
import os
import sys
from typing import Dict, Any, Optional, Set
import logging
from datetime import datetime
import gc
import traceback

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/logs/chain_metadata_import.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ChainMetadataImporter:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.processed_chains = 0
        self.failed_chains = 0
        self.batch_size = 1000
        
    def get_db_connection(self) -> sqlite3.Connection:
        """Get database connection with optimizations"""
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.execute('PRAGMA journal_mode=WAL')
        conn.execute('PRAGMA synchronous=NORMAL')
        conn.execute('PRAGMA cache_size=10000')
        conn.execute('PRAGMA temp_store=MEMORY')
        return conn
    
    def get_existing_chain_ids(self, conn: sqlite3.Connection) -> Set[str]:
        """Get all existing chain IDs from emails_enhanced"""
        logger.info("Loading existing chain IDs from database...")
        cursor = conn.execute("SELECT DISTINCT chain_id FROM emails_enhanced WHERE chain_id IS NOT NULL")
        chain_ids = {row[0] for row in cursor.fetchall()}
        logger.info(f"Found {len(chain_ids):,} unique chain IDs in database")
        return chain_ids
    
    def find_matching_chain_id(self, full_chain_id: str, existing_ids: Set[str]) -> Optional[str]:
        """Find matching chain ID in database (handles truncated IDs)"""
        # Direct match first
        if full_chain_id in existing_ids:
            return full_chain_id
        
        # Try partial matches (database might have truncated IDs)
        for existing_id in existing_ids:
            if full_chain_id.startswith(existing_id) or existing_id.startswith(full_chain_id):
                return existing_id
        
        return None
    
    def parse_chain_json_streaming(self, file_path: str, existing_chain_ids: Set[str]) -> Dict[str, Any]:
        """
        Stream parse the JSON file to extract only chains that exist in database
        """
        matched_chains = {}
        current_chain = {}
        current_key = None
        brace_count = 0
        in_chain = False
        line_buffer = []
        processed_lines = 0
        
        logger.info(f"Starting streaming parse of {file_path}")
        logger.info(f"Looking for matches with {len(existing_chain_ids):,} database chain IDs")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    processed_lines += 1
                    
                    if processed_lines % 100000 == 0:
                        logger.info(f"Processed {processed_lines:,} lines, found {len(matched_chains):,} matching chains")
                        gc.collect()
                    
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Track brace nesting
                    brace_count += line.count('{') - line.count('}')
                    
                    # Detect start of new chain
                    if '"chain_' in line and '": {' in line:
                        # Save previous chain if it matches
                        if current_chain and current_key:
                            self._try_store_matching_chain(current_key, current_chain, existing_chain_ids, matched_chains)
                        
                        # Start new chain
                        current_key = line.split('"')[1]
                        current_chain = {}
                        line_buffer = [line]
                        in_chain = True
                        continue
                    
                    if in_chain:
                        line_buffer.append(line)
                        
                        # Try to parse when we have a complete chain
                        if brace_count == 0 and len(line_buffer) > 5:
                            try:
                                # Reconstruct chain JSON
                                chain_json = '\n'.join(line_buffer)
                                if chain_json.endswith(','):
                                    chain_json = chain_json[:-1]
                                
                                if not chain_json.startswith('{'):
                                    chain_json = '{' + chain_json + '}'
                                
                                parsed = json.loads(chain_json)
                                if current_key in parsed:
                                    current_chain = parsed[current_key]
                                    self._try_store_matching_chain(current_key, current_chain, existing_chain_ids, matched_chains)
                                
                                # Reset for next chain
                                current_chain = {}
                                current_key = None
                                line_buffer = []
                                in_chain = False
                                
                            except json.JSONDecodeError:
                                continue
                            except Exception as e:
                                logger.warning(f"Error processing chain {current_key}: {e}")
                                self.failed_chains += 1
                                current_chain = {}
                                current_key = None
                                line_buffer = []
                                in_chain = False
        
        except Exception as e:
            logger.error(f"Critical error during streaming parse: {e}")
            logger.error(traceback.format_exc())
        
        logger.info(f"Streaming parse complete. Matched chains: {len(matched_chains):,}, Failed: {self.failed_chains:,}")
        return matched_chains
    
    def _try_store_matching_chain(self, chain_key: str, chain_data: Dict[str, Any], existing_ids: Set[str], storage: Dict[str, Any]):
        """Try to store chain if it matches an existing database chain ID"""
        try:
            # Find matching chain ID in database
            matching_id = self.find_matching_chain_id(chain_key, existing_ids)
            
            if matching_id:
                # Validate chain data
                if self._validate_chain_data(chain_data):
                    # Store with the database chain ID as key
                    storage[matching_id] = chain_data
                    self.processed_chains += 1
                else:
                    self.failed_chains += 1
            # Don't increment failed_chains for non-matching IDs - that's expected
            
        except Exception as e:
            logger.warning(f"Error storing chain {chain_key}: {e}")
            self.failed_chains += 1
    
    def _validate_chain_data(self, chain_data: Dict[str, Any]) -> bool:
        """Validate chain data has required fields"""
        required_fields = ['chain_id', 'completeness', 'workflow_type']
        return all(field in chain_data for field in required_fields)
    
    def insert_chain_metadata_batch(self, chains_batch: list, conn: sqlite3.Connection):
        """Insert batch of chain metadata"""
        try:
            # Note: Using conversation_id as the primary key to match existing schema
            conn.executemany("""
                INSERT OR REPLACE INTO email_chain_analysis (
                    conversation_id, chain_type, completeness_score, total_emails,
                    workflow_detected, workflow_stage, participants, date_range,
                    analysis_version, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, chains_batch)
            conn.commit()
            logger.info(f"Inserted batch of {len(chains_batch)} chain metadata records")
        except Exception as e:
            logger.error(f"Error inserting chain metadata batch: {e}")
            conn.rollback()
            raise
    
    def import_chain_metadata(self, analysis_file_path: str):
        """Main import process for chain metadata"""
        logger.info("=== Starting Chain Metadata Import ===")
        start_time = datetime.now()
        
        try:
            conn = self.get_db_connection()
            
            try:
                # Step 1: Get existing chain IDs from database
                existing_chain_ids = self.get_existing_chain_ids(conn)
                
                if not existing_chain_ids:
                    logger.error("No chain IDs found in database!")
                    return False
                
                # Step 2: Parse JSON file and match with existing chains
                logger.info("Step 2: Parsing chain analysis JSON and matching with database...")
                matched_chains = self.parse_chain_json_streaming(analysis_file_path, existing_chain_ids)
                
                if not matched_chains:
                    logger.error("No matching chains found!")
                    return False
                
                logger.info(f"Found {len(matched_chains):,} chains matching database IDs")
                
                # Step 3: Insert chain metadata
                logger.info("Step 3: Inserting chain metadata...")
                
                batch = []
                for db_chain_id, chain_data in matched_chains.items():
                    try:
                        # Prepare metadata record
                        participants_list = chain_data.get('participants', [])
                        participants_json = json.dumps(participants_list) if participants_list else '[]'
                        
                        # Format date range
                        start_date = chain_data.get('start_date', '')
                        end_date = chain_data.get('end_date', '')
                        date_range = f"{start_date} to {end_date}" if start_date and end_date else ''
                        
                        metadata_record = (
                            db_chain_id,  # conversation_id (using as chain identifier)
                            chain_data.get('completeness', 'broken'),  # chain_type
                            float(chain_data.get('completeness_score', 0.0)),  # completeness_score
                            int(chain_data.get('email_count', 0)),  # total_emails
                            bool(chain_data.get('workflow_type') and chain_data['workflow_type'] != 'general_inquiry'),  # workflow_detected
                            chain_data.get('workflow_type', 'general_inquiry'),  # workflow_stage
                            participants_json,  # participants
                            date_range,  # date_range
                            'v1.0',  # analysis_version
                            datetime.now().isoformat(),  # created_at
                            datetime.now().isoformat()   # updated_at
                        )
                        
                        batch.append(metadata_record)
                        
                        # Insert in batches
                        if len(batch) >= self.batch_size:
                            self.insert_chain_metadata_batch(batch, conn)
                            batch = []
                    
                    except Exception as e:
                        logger.warning(f"Error preparing metadata for chain {db_chain_id}: {e}")
                        self.failed_chains += 1
                
                # Insert remaining batch
                if batch:
                    self.insert_chain_metadata_batch(batch, conn)
                
                # Step 4: Generate summary
                self._generate_import_summary(conn)
                
            finally:
                conn.close()
            
            # Report results
            duration = datetime.now() - start_time
            logger.info("=== Chain Metadata Import Complete ===")
            logger.info(f"Duration: {duration}")
            logger.info(f"Chains processed: {self.processed_chains:,}")
            logger.info(f"Chains failed: {self.failed_chains:,}")
            
            return True
            
        except Exception as e:
            logger.error(f"Import failed: {e}")
            logger.error(traceback.format_exc())
            return False
    
    def _generate_import_summary(self, conn: sqlite3.Connection):
        """Generate and log import summary"""
        logger.info("=== Import Summary ===")
        
        # Count metadata records
        cursor = conn.execute("SELECT COUNT(*) FROM email_chain_analysis")
        total_metadata = cursor.fetchone()[0]
        logger.info(f"Chain metadata records: {total_metadata:,}")
        
        # Count by workflow type
        cursor = conn.execute("""
            SELECT workflow_stage, COUNT(*) as count
            FROM email_chain_analysis
            GROUP BY workflow_stage
            ORDER BY count DESC
        """)
        
        workflow_counts = cursor.fetchall()
        logger.info("Workflow distribution:")
        for workflow, count in workflow_counts:
            logger.info(f"  {workflow}: {count:,}")

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
    
    importer = ChainMetadataImporter(db_path)
    success = importer.import_chain_metadata(analysis_file)
    
    if success:
        logger.info("Chain metadata import completed successfully!")
        sys.exit(0)
    else:
        logger.error("Chain metadata import failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()