#!/usr/bin/env python3
"""
Full IEMS Email Migration - Process all 141,075 emails
Imports emails from JSON files in received_emails directory
"""

import os
import sys
import sqlite3
import json
import logging
from datetime import datetime
from pathlib import Path
import re
import time
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FullEmailMigration:
    def __init__(self):
        self.db_path = "/home/pricepro2006/CrewAI_Team/data/app.db"
        self.emails_dir = "/home/pricepro2006/iems_project/received_emails"
        self.conn = None
        self.processed_count = 0
        self.error_count = 0
        self.email_count = 0
        self.duplicate_count = 0
        self.start_time = time.time()
        
    def extract_addresses(self, address_list):
        """Extract email addresses from list that can contain strings or dicts"""
        addresses = []
        for item in address_list:
            if isinstance(item, dict):
                addresses.append(item.get('address', ''))
            else:
                addresses.append(str(item))
        return ', '.join(filter(None, addresses))
        
    def connect_db(self):
        """Connect to the database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            
            # Enable performance optimizations
            self.conn.execute("PRAGMA journal_mode = WAL")
            self.conn.execute("PRAGMA synchronous = NORMAL")
            self.conn.execute("PRAGMA cache_size = 10000")
            self.conn.execute("PRAGMA temp_store = MEMORY")
            
            logger.info(f"Connected to database: {self.db_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False
            
    def process_email_file(self, filepath):
        """Process a single email JSON file"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                emails = json.load(f)
                
            if not isinstance(emails, list):
                logger.warning(f"Invalid format in {filepath}: expected list")
                return False
                
            # Extract mailbox and folder from filename
            filename = os.path.basename(filepath)
            parts = filename.replace('.json', '').split('_')
            mailbox = parts[0].replace('_at_', '@').replace('_', '.')
            
            # Find folder name (everything between mailbox and date)
            folder_start = filename.find(parts[0]) + len(parts[0]) + 1
            folder_end = filename.rfind('_2025')
            folder = filename[folder_start:folder_end].replace('_', ' ') if folder_end > folder_start else 'Inbox'
            
            logger.info(f"Processing {len(emails)} emails from {mailbox}/{folder}")
            
            for email_data in emails:
                self.insert_email(email_data, mailbox, folder)
                
            self.processed_count += 1
            
            # Commit every file for better progress tracking
            self.conn.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing {filepath}: {e}")
            self.error_count += 1
            return False
            
    def insert_email(self, email_data, mailbox, folder):
        """Insert single email record into database"""
        try:
            cursor = self.conn.cursor()
            
            # Generate unique ID based on email ID or create new one
            email_id = email_data.get('id', str(uuid.uuid4()))
            graph_id = f"IEMS_{email_id[:20]}"
            
            # Check if email already exists
            cursor.execute("SELECT id FROM emails WHERE graph_id = ?", (graph_id,))
            if cursor.fetchone():
                self.duplicate_count += 1
                return  # Skip duplicate
            
            # Extract fields
            subject = email_data.get('subject', 'No Subject')[:500]
            
            # Handle from field - can be string or dict
            from_field = email_data.get('from', 'unknown@email.com')
            if isinstance(from_field, dict):
                from_email = from_field.get('address', 'unknown@email.com')
                from_name = from_field.get('name', from_email.split('@')[0])
            else:
                from_email = from_field
                from_name = email_data.get('from_name', from_email.split('@')[0] if '@' in from_email else from_email)
            # Handle to/cc fields - can be list of strings or list of dicts
            to_list = email_data.get('to', [])
            to_addresses = self.extract_addresses(to_list)[:500]
            
            cc_list = email_data.get('cc', [])
            cc_addresses = self.extract_addresses(cc_list)[:500]
            received_at = email_data.get('received', datetime.now().isoformat())
            importance = email_data.get('importance', 'normal')
            has_attachments = email_data.get('has_attachments', False)
            body_preview = email_data.get('body_preview', '')[:500]
            body = email_data.get('body', '')
            
            # Insert email
            cursor.execute("""
                INSERT INTO emails (
                    graph_id, subject, sender_email, sender_name,
                    received_at, to_addresses, cc_addresses,
                    body_preview, body, has_attachments,
                    importance, mailbox, folder, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                graph_id,
                subject,
                from_email,
                from_name,
                received_at,
                to_addresses,
                cc_addresses,
                body_preview,
                body,
                has_attachments,
                importance,
                mailbox,
                folder
            ))
            
            # Get email row ID
            email_row_id = cursor.lastrowid
            self.email_count += 1
            
            # Create basic email analysis
            self.create_email_analysis(cursor, email_row_id, email_data, received_at)
            
            # Progress update every 1000 emails
            if self.email_count % 1000 == 0:
                elapsed = time.time() - self.start_time
                rate = self.email_count / elapsed
                logger.info(f"Imported {self.email_count} emails ({rate:.1f} emails/sec)")
                
        except Exception as e:
            logger.error(f"Error inserting email: {e}")
            
    def create_email_analysis(self, cursor, email_row_id, email_data, received_at):
        """Create email analysis record"""
        try:
            # Generate analysis ID
            analysis_id = str(uuid.uuid4())
            
            # Determine workflow based on subject/sender
            subject_data = email_data.get('subject', '')
            subject = subject_data.lower() if isinstance(subject_data, str) else ''
            
            sender_data = email_data.get('from', '')
            if isinstance(sender_data, dict):
                sender = sender_data.get('address', '').lower()
            else:
                sender = sender_data.lower() if isinstance(sender_data, str) else ''
            
            # Simple workflow classification
            workflow = 'General'
            if 'order' in subject or 'po#' in subject:
                workflow = 'Order Processing'
            elif 'quote' in subject:
                workflow = 'Quote Request'
            elif 'support' in subject or 'issue' in subject:
                workflow = 'Technical Support'
            elif 'invoice' in subject or 'payment' in subject:
                workflow = 'Billing'
                
            # Priority based on importance
            importance = email_data.get('importance', 'normal')
            priority = 'medium'
            if importance == 'high':
                priority = 'high'
            elif importance == 'low':
                priority = 'low'
                
            # Insert analysis
            cursor.execute("""
                INSERT INTO email_analysis (
                    id, email_id, quick_workflow, quick_priority,
                    quick_confidence, workflow_state, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                analysis_id,
                email_row_id,
                workflow,
                priority,
                0.75,  # Default confidence
                'imported',
                received_at
            ))
            
        except Exception as e:
            logger.error(f"Error creating email analysis: {e}")
            
    def run_migration(self):
        """Run the complete migration"""
        logger.info("Starting full IEMS email migration...")
        logger.info("Target: 141,075 emails from JSON files")
        
        if not self.connect_db():
            return False
            
        try:
            # Get all email JSON files
            email_files = sorted(Path(self.emails_dir).glob("*.json"))
            # Filter out Zone.Identifier files
            email_files = [f for f in email_files if not str(f).endswith('.json:Zone.Identifier')]
            
            total_files = len(email_files)
            logger.info(f"Found {total_files} email JSON files to process")
            
            # Process each file
            for i, filepath in enumerate(email_files):
                self.process_email_file(filepath)
                
                # Progress update
                if (i + 1) % 5 == 0:
                    percent = ((i + 1) / total_files) * 100
                    elapsed = time.time() - self.start_time
                    rate = self.email_count / elapsed if elapsed > 0 else 0
                    eta = (total_files - i - 1) / (rate / 60) if rate > 0 else 0
                    
                    logger.info(f"Progress: {i + 1}/{total_files} files ({percent:.1f}%) - "
                              f"{self.email_count} emails imported - "
                              f"ETA: {eta:.1f} minutes")
                    
            # Final commit
            self.conn.commit()
            
            # Calculate final stats
            elapsed_total = time.time() - self.start_time
            
            logger.info("=" * 60)
            logger.info("Migration completed!")
            logger.info(f"Total time: {elapsed_total/60:.1f} minutes")
            logger.info(f"Files processed: {self.processed_count}")
            logger.info(f"Emails imported: {self.email_count}")
            logger.info(f"Duplicates skipped: {self.duplicate_count}")
            logger.info(f"Errors: {self.error_count}")
            logger.info(f"Average rate: {self.email_count/elapsed_total:.1f} emails/second")
            logger.info("=" * 60)
            
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
            
            # Count emails by mailbox
            cursor.execute("""
                SELECT 
                    mailbox,
                    COUNT(*) as count
                FROM emails
                WHERE graph_id LIKE 'IEMS_%'
                GROUP BY mailbox
                ORDER BY count DESC
                LIMIT 10
            """)
            
            logger.info("\nTop 10 mailboxes by email count:")
            for row in cursor.fetchall():
                logger.info(f"  {row[0]}: {row[1]} emails")
                
            # Count by workflow
            cursor.execute("""
                SELECT 
                    ea.quick_workflow,
                    COUNT(*) as count
                FROM emails e
                JOIN email_analysis ea ON e.id = ea.email_id
                WHERE e.graph_id LIKE 'IEMS_%'
                GROUP BY ea.quick_workflow
                ORDER BY count DESC
            """)
            
            logger.info("\nEmails by workflow type:")
            for row in cursor.fetchall():
                logger.info(f"  {row[0]}: {row[1]} emails")
                
        except Exception as e:
            logger.error(f"Error updating statistics: {e}")

if __name__ == "__main__":
    migration = FullEmailMigration()
    success = migration.run_migration()
    sys.exit(0 if success else 1)