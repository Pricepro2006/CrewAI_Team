#!/usr/bin/env python3
"""
Direct IEMS to Email Dashboard Migration
Simplified migration that directly imports analysis results
"""

import os
import sys
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DirectMigration:
    def __init__(self):
        self.db_path = "/home/pricepro2006/CrewAI_Team/data/app.db"
        self.analysis_dir = "/home/pricepro2006/iems_project/analysis_results"
        self.iems_project_dir = "/home/pricepro2006/iems_project"
        self.conn = None
        self.processed_count = 0
        self.error_count = 0
        self.email_count = 0
        
    def connect_db(self):
        """Connect to the database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            logger.info(f"Connected to database: {self.db_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False
            
    def extract_json_from_file(self, filepath):
        """Extract JSON data from analysis file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Find JSON content between ```json and ```
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                return json.loads(json_str)
            else:
                logger.warning(f"No JSON found in {filepath}")
                return None
                
        except Exception as e:
            logger.error(f"Error parsing {filepath}: {e}")
            return None
            
    def process_batch_file(self, filepath):
        """Process a single batch file"""
        try:
            # Extract batch info from filename
            filename = os.path.basename(filepath)
            match = re.match(r'analysis_batch_(\d+)_(\d{8})_(\d{6})\.txt', filename)
            if not match:
                logger.warning(f"Invalid filename format: {filename}")
                return False
                
            batch_num = match.group(1)
            date_str = match.group(2)
            time_str = match.group(3)
            
            # Parse JSON data
            data = self.extract_json_from_file(filepath)
            if not data:
                return False
                
            # Extract workflow information
            workflow_analysis = data.get('workflow_state_analysis', {})
            primary_workflow = data.get('workflow_classification', {}).get('primary', 'General Support')
            urgency = data.get('urgency_assessment', {}).get('level', 'Medium')
            
            # Process start points (new emails)
            for start_point in workflow_analysis.get('start_points', []):
                self.insert_email(
                    batch_id=f"BATCH_{batch_num}",
                    email_data=start_point,
                    workflow_state='START_POINT',
                    workflow_type=primary_workflow,
                    urgency=urgency,
                    date_str=date_str,
                    time_str=time_str
                )
                
            # Process in-progress items
            for in_progress in workflow_analysis.get('in_progress_indicators', []):
                self.insert_email(
                    batch_id=f"BATCH_{batch_num}",
                    email_data=in_progress,
                    workflow_state='IN_PROGRESS',
                    workflow_type=primary_workflow,
                    urgency=urgency,
                    date_str=date_str,
                    time_str=time_str
                )
                
            self.processed_count += 1
            # Commit every 5 batches for better performance
            if self.processed_count % 5 == 0:
                self.conn.commit()
                
            return True
            
        except Exception as e:
            logger.error(f"Error processing {filepath}: {e}")
            self.error_count += 1
            return False
            
    def insert_email(self, batch_id, email_data, workflow_state, workflow_type, urgency, date_str, time_str):
        """Insert email record into database"""
        try:
            cursor = self.conn.cursor()
            
            # Generate unique IDs
            email_id = email_data.get('email_id', 1)
            unique_id = f"{batch_id}_EMAIL_{email_id}"
            
            # Map urgency to priority
            priority_map = {
                'Critical': 'critical',
                'High': 'high',
                'Medium': 'medium',
                'Low': 'low'
            }
            priority = priority_map.get(urgency, 'medium')
            
            # Map workflow state to status
            status_map = {
                'START_POINT': 'red',
                'IN_PROGRESS': 'yellow',
                'COMPLETION': 'green'
            }
            status = status_map.get(workflow_state, 'yellow')
            
            # Extract email details
            sender = email_data.get('sender', 'Unknown')
            context = email_data.get('context', 'Email processing')
            markers = email_data.get('markers', [])
            subject = markers[0] if markers else context
            
            # Create timestamp
            timestamp = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} " + \
                       f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
            
            # Check if email already exists
            cursor.execute("SELECT id FROM emails WHERE graph_id = ?", (unique_id,))
            if cursor.fetchone():
                return  # Skip duplicate
            
            # Insert email (using current schema without workflow columns)
            cursor.execute("""
                INSERT INTO emails (
                    graph_id, subject, sender_email, sender_name,
                    received_at, to_addresses, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                unique_id,
                subject[:500],  # Limit subject length
                f"{sender.replace(', ', '.').lower()}@company.com",
                sender,
                timestamp,
                'team@company.com'
            ))
            
            # Insert email analysis with workflow data
            email_row_id = cursor.lastrowid
            self.email_count += 1
            
            analysis_data = {
                'context': context,
                'markers': markers,
                'urgency': urgency,
                'workflow_state': workflow_state,
                'workflow_type': workflow_type,
                'priority': priority,
                'status': status
            }
            
            # Generate unique ID for email_analysis
            import uuid
            analysis_id = str(uuid.uuid4())
            
            cursor.execute("""
                INSERT INTO email_analysis (
                    id, email_id, quick_workflow, quick_priority,
                    quick_urgency, quick_confidence, workflow_state,
                    deep_workflow_primary, entities_po_numbers,
                    contextual_summary, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                analysis_id,
                email_row_id,
                workflow_type,
                priority,
                urgency,
                0.85,
                workflow_state,
                workflow_type,
                json.dumps(markers) if markers else None,
                context,
                timestamp
            ))
            
        except Exception as e:
            logger.error(f"Error inserting email: {e}")
            
    def run_migration(self):
        """Run the complete migration"""
        logger.info("Starting IEMS data migration...")
        
        if not self.connect_db():
            return False
            
        try:
            # Get all analysis files
            analysis_files = sorted(Path(self.analysis_dir).glob("analysis_batch_*.txt"))
            total_files = len(analysis_files)
            
            logger.info(f"Found {total_files} analysis files to process")
            
            # Process each file
            for i, filepath in enumerate(analysis_files):
                self.process_batch_file(filepath)
                
                # Progress update every 10 files
                if (i + 1) % 10 == 0:
                    percent = ((i + 1) / total_files) * 100
                    logger.info(f"Progress: {i + 1}/{total_files} files ({percent:.1f}%)")
                
            # Final commit
            self.conn.commit()
            
            logger.info(f"Migration completed!")
            logger.info(f"Processed: {self.processed_count} batch files")
            logger.info(f"Emails imported: {self.email_count}")
            logger.info(f"Errors: {self.error_count}")
            logger.info(f"Parse warnings: {total_files - self.processed_count - self.error_count}")
            
            # Update statistics
            self.update_statistics()
            
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False
            
        finally:
            if self.conn:
                self.conn.close()
                
    def update_statistics(self):
        """Update email statistics after migration"""
        try:
            cursor = self.conn.cursor()
            
            # Count emails by workflow state
            cursor.execute("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN ea.workflow_state = 'START_POINT' THEN 1 ELSE 0 END) as start_count,
                    SUM(CASE WHEN ea.workflow_state = 'IN_PROGRESS' THEN 1 ELSE 0 END) as progress_count,
                    SUM(CASE WHEN ea.workflow_state = 'COMPLETION' THEN 1 ELSE 0 END) as complete_count
                FROM emails e
                LEFT JOIN email_analysis ea ON e.id = ea.email_id
            """)
            
            stats = cursor.fetchone()
            logger.info(f"Total emails: {stats[0]}")
            logger.info(f"Start Points (New): {stats[1]}")
            logger.info(f"In Progress: {stats[2]}")
            logger.info(f"Completed: {stats[3]}")
            
        except Exception as e:
            logger.error(f"Error updating statistics: {e}")

if __name__ == "__main__":
    migration = DirectMigration()
    success = migration.run_migration()
    sys.exit(0 if success else 1)