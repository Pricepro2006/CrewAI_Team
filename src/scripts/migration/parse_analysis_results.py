#!/usr/bin/env python3
"""
Parse IEMS Analysis Results and Load into Migration Tables
This script reads the analysis batch files and extracts structured data
"""

import os
import json
import sqlite3
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IEMSAnalysisParser:
    def __init__(self, db_path: str, analysis_dir: str):
        self.db_path = db_path
        self.analysis_dir = Path(analysis_dir)
        self.conn = None
        self.cursor = None
        
    def connect_db(self):
        """Connect to SQLite database"""
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
        logger.info(f"Connected to database: {self.db_path}")
        
    def close_db(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            logger.info("Database connection closed")
            
    def extract_json_from_file(self, file_path: Path) -> Optional[Dict]:
        """Extract JSON content from analysis file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Find JSON content within markdown code blocks
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                return json.loads(json_str)
            else:
                logger.warning(f"No JSON found in {file_path}")
                return None
                
        except Exception as e:
            logger.error(f"Error parsing {file_path}: {str(e)}")
            return None
            
    def extract_batch_info(self, filename: str) -> Dict[str, Any]:
        """Extract batch number and date from filename"""
        # Pattern: analysis_batch_XXX_YYYYMMDD_HHMMSS.txt
        match = re.match(r'analysis_batch_(\d+)_(\d{8})_(\d{6})\.txt', filename)
        if match:
            batch_num = int(match.group(1))
            date_str = match.group(2)
            time_str = match.group(3)
            
            # Parse date and time
            date = datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M%S")
            
            return {
                'batch_id': f"batch_{batch_num}_{date_str}_{time_str}",
                'batch_number': batch_num,
                'analysis_date': date.isoformat()
            }
        return {}
        
    def parse_workflow_state(self, workflow_data: Dict) -> str:
        """Extract overall workflow state"""
        state = workflow_data.get('overall_state', '')
        # Remove emoji and normalize
        state_clean = re.sub(r'[🔴🟡🟢]\s*', '', state).strip()
        return state_clean
        
    def parse_entities(self, entity_data: Dict, batch_id: str) -> List[Dict]:
        """Extract entities from analysis"""
        entities = []
        
        # Extract reference numbers
        ref_numbers = entity_data.get('reference_numbers', {})
        
        # PO Numbers
        for po in ref_numbers.get('po_numbers', []):
            entities.append({
                'batch_id': batch_id,
                'entity_type': 'po_number',
                'entity_value': po,
                'entity_context': 'Purchase Order'
            })
            
        # Quote Numbers
        for quote in ref_numbers.get('quote_numbers', []):
            entities.append({
                'batch_id': batch_id,
                'entity_type': 'quote_number',
                'entity_value': quote,
                'entity_context': 'Quote Reference'
            })
            
        # Products
        for product in ref_numbers.get('products', []):
            if isinstance(product, dict):
                entities.append({
                    'batch_id': batch_id,
                    'entity_type': 'product',
                    'entity_value': product.get('name', ''),
                    'entity_context': product.get('type', '')
                })
                
        return entities
        
    def parse_participants(self, entity_data: Dict, batch_id: str) -> List[Dict]:
        """Extract participants from analysis"""
        participants = []
        
        participants_data = entity_data.get('participants', {})
        
        # Customer participants
        customer = participants_data.get('customer', {})
        if customer:
            participants.append({
                'batch_id': batch_id,
                'participant_name': customer.get('name', ''),
                'participant_email': customer.get('email', ''),
                'participant_role': 'Customer',
                'participant_type': 'customer'
            })
            
        # Internal team
        for member in participants_data.get('internal_team', []):
            participants.append({
                'batch_id': batch_id,
                'participant_name': member.get('name', ''),
                'participant_email': member.get('email', ''),
                'participant_role': member.get('role', ''),
                'participant_type': 'internal'
            })
            
        return participants
        
    def parse_action_items(self, action_items: List[Dict], batch_id: str) -> List[Dict]:
        """Extract action items from analysis"""
        parsed_items = []
        
        for item in action_items:
            parsed_items.append({
                'batch_id': batch_id,
                'description': item.get('description', ''),
                'owner': item.get('owner', ''),
                'priority': item.get('priority', 'Medium'),
                'deadline': item.get('deadline', ''),
                'status': item.get('status', 'Pending')
            })
            
        return parsed_items
        
    def save_to_migration_tables(self, analysis_data: Dict, file_info: Dict):
        """Save parsed data to migration tables"""
        batch_id = file_info['batch_id']
        
        try:
            # Save main analysis record
            self.cursor.execute("""
                INSERT OR REPLACE INTO migration_analysis_temp 
                (batch_id, batch_number, analysis_date, raw_json, workflow_state, 
                 primary_focus, urgency_level, business_impact, customer_name, customer_email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                batch_id,
                file_info['batch_number'],
                file_info['analysis_date'],
                json.dumps(analysis_data),
                self.parse_workflow_state(analysis_data.get('workflow_analysis', {})),
                analysis_data.get('workflow_analysis', {}).get('primary_focus', ''),
                analysis_data.get('priority_assessment', {}).get('urgency_level', ''),
                analysis_data.get('priority_assessment', {}).get('business_impact', ''),
                analysis_data.get('entity_extraction', {}).get('participants', {}).get('customer', {}).get('name', ''),
                analysis_data.get('entity_extraction', {}).get('participants', {}).get('customer', {}).get('email', '')
            ))
            
            # Save entities
            entities = self.parse_entities(analysis_data.get('entity_extraction', {}), batch_id)
            for entity in entities:
                self.cursor.execute("""
                    INSERT INTO migration_entities_temp 
                    (batch_id, entity_type, entity_value, entity_context)
                    VALUES (?, ?, ?, ?)
                """, (entity['batch_id'], entity['entity_type'], 
                      entity['entity_value'], entity['entity_context']))
                      
            # Save participants
            participants = self.parse_participants(analysis_data.get('entity_extraction', {}), batch_id)
            for participant in participants:
                self.cursor.execute("""
                    INSERT INTO migration_participants_temp 
                    (batch_id, participant_name, participant_email, participant_role, participant_type)
                    VALUES (?, ?, ?, ?, ?)
                """, (participant['batch_id'], participant['participant_name'],
                      participant['participant_email'], participant['participant_role'],
                      participant['participant_type']))
                      
            # Save action items
            action_items = self.parse_action_items(analysis_data.get('action_items', []), batch_id)
            for item in action_items:
                self.cursor.execute("""
                    INSERT INTO migration_action_items_temp 
                    (batch_id, description, owner, priority, deadline, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (item['batch_id'], item['description'], item['owner'],
                      item['priority'], item['deadline'], item['status']))
                      
            self.conn.commit()
            logger.info(f"Successfully saved data for batch {batch_id}")
            
        except Exception as e:
            self.conn.rollback()
            logger.error(f"Error saving batch {batch_id}: {str(e)}")
            raise
            
    def process_all_files(self):
        """Process all analysis files in the directory"""
        # Get all analysis batch files
        analysis_files = sorted(self.analysis_dir.glob("analysis_batch_*.txt"))
        
        logger.info(f"Found {len(analysis_files)} analysis files to process")
        
        processed = 0
        failed = 0
        
        # Log migration start
        self.cursor.execute("""
            INSERT INTO migration_log (migration_step, status)
            VALUES ('parse_analysis_results', 'started')
        """)
        migration_log_id = self.cursor.lastrowid
        self.conn.commit()
        
        for file_path in analysis_files:
            try:
                # Extract batch info from filename
                file_info = self.extract_batch_info(file_path.name)
                if not file_info:
                    logger.warning(f"Could not parse filename: {file_path.name}")
                    failed += 1
                    continue
                    
                # Extract JSON from file
                analysis_data = self.extract_json_from_file(file_path)
                if not analysis_data:
                    failed += 1
                    continue
                    
                # Save to migration tables
                self.save_to_migration_tables(analysis_data, file_info)
                processed += 1
                
                # Log progress every 10 files
                if processed % 10 == 0:
                    logger.info(f"Progress: {processed}/{len(analysis_files)} files processed")
                    
            except Exception as e:
                logger.error(f"Failed to process {file_path}: {str(e)}")
                failed += 1
                
        # Update migration log
        self.cursor.execute("""
            UPDATE migration_log 
            SET status = 'completed',
                records_processed = ?,
                records_failed = ?,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (processed, failed, migration_log_id))
        self.conn.commit()
        
        logger.info(f"Processing complete: {processed} succeeded, {failed} failed")
        
def main():
    """Main execution function"""
    # Configuration
    DB_PATH = "/home/pricepro2006/CrewAI_Team/data/email_dashboard.db"
    ANALYSIS_DIR = "/home/pricepro2006/iems_project/analysis_results"
    
    # Create parser instance
    parser = IEMSAnalysisParser(DB_PATH, ANALYSIS_DIR)
    
    try:
        # Connect to database
        parser.connect_db()
        
        # Process all files
        parser.process_all_files()
        
    finally:
        # Close database connection
        parser.close_db()
        
if __name__ == "__main__":
    main()