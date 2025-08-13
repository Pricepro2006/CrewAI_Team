#!/usr/bin/env python3
"""
Import emails from emails_extracted.jsonl into enhanced database
Author: Claude Code
Date: 2025-01-31
"""

import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
import hashlib

def create_enhanced_email_tables(cursor):
    """
    Create enhanced email tables if they don't exist
    """
    
    # Main emails table - matches our existing schema
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emails_enhanced (
            id TEXT PRIMARY KEY,
            internet_message_id TEXT UNIQUE,
            subject TEXT,
            body_content TEXT,
            body_preview TEXT,
            sender_email TEXT,
            sender_name TEXT,
            created_date_time DATETIME,
            received_date_time DATETIME,
            conversation_id TEXT,
            importance TEXT DEFAULT 'normal',
            has_attachments BOOLEAN DEFAULT FALSE,
            is_read BOOLEAN DEFAULT FALSE,
            status TEXT DEFAULT 'active',
            workflow_state TEXT DEFAULT 'pending',
            source_file TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Recipients table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email_id TEXT NOT NULL,
            recipient_type TEXT NOT NULL, -- 'to', 'cc', 'bcc'
            email_address TEXT NOT NULL,
            display_name TEXT,
            FOREIGN KEY (email_id) REFERENCES emails_enhanced (id)
        )
    """)
    
    # Create indexes
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_emails_conversation ON emails_enhanced(conversation_id)",
        "CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails_enhanced(sender_email)",
        "CREATE INDEX IF NOT EXISTS idx_emails_created ON emails_enhanced(created_date_time)",
        "CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails_enhanced(subject)",
        "CREATE INDEX IF NOT EXISTS idx_recipients_email ON email_recipients(email_id)",
    ]
    
    for index_sql in indexes:
        cursor.execute(index_sql)

def parse_email_date(date_str):
    """
    Parse various date formats from the JSONL data
    """
    if not date_str:
        return None
    
    try:
        # Handle ISO format with Z
        if date_str.endswith('Z'):
            date_str = date_str.replace('Z', '+00:00')
        
        return datetime.fromisoformat(date_str)
    except:
        return None

def extract_sender_info(email_data):
    """
    Extract sender email and name from different formats
    """
    # Try direct fields first
    sender_email = email_data.get('from', '')
    sender_name = email_data.get('from_name', '')
    
    # If not found, try sender object
    if not sender_email and 'sender' in email_data:
        sender_data = email_data.get('sender', {})
        if isinstance(sender_data, dict):
            email_addr = sender_data.get('emailAddress', {})
            if isinstance(email_addr, dict):
                sender_email = email_addr.get('address', '')
                sender_name = email_addr.get('name', '') or sender_data.get('name', '')
    
    return sender_email, sender_name

def extract_recipients(email_data):
    """
    Extract recipients from various fields
    """
    recipients = []
    
    # Direct to/cc fields
    for field, rec_type in [('to', 'to'), ('cc', 'cc'), ('bcc', 'bcc')]:
        if field in email_data:
            field_data = email_data[field]
            if isinstance(field_data, list):
                for email in field_data:
                    if isinstance(email, str):
                        recipients.append({'type': rec_type, 'email': email, 'name': ''})
    
    # Try toRecipients/ccRecipients format
    for field, rec_type in [('toRecipients', 'to'), ('ccRecipients', 'cc'), ('bccRecipients', 'bcc')]:
        if field in email_data:
            for recipient in email_data[field]:
                if isinstance(recipient, dict):
                    email_addr = recipient.get('emailAddress', {})
                    if isinstance(email_addr, dict):
                        email = email_addr.get('address', '')
                        name = email_addr.get('name', '')
                        if email:
                            recipients.append({'type': rec_type, 'email': email, 'name': name})
    
    return recipients

def import_emails_from_jsonl(jsonl_file, db_file, batch_size=1000, max_emails=None):
    """
    Import emails from JSONL file into SQLite database
    """
    print(f"\n=== IMPORTING EMAILS FROM JSONL ===")
    print(f"Source: {jsonl_file}")
    print(f"Database: {db_file}")
    print(f"Batch size: {batch_size}")
    if max_emails:
        print(f"Max emails: {max_emails}")
    print(f"Started at: {datetime.now()}")
    
    # Connect to database
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA synchronous = NORMAL")
    
    # Create tables
    print("\nCreating database tables...")
    create_enhanced_email_tables(cursor)
    conn.commit()
    
    # Import counters
    total_processed = 0
    imported_emails = 0
    skipped_duplicates = 0
    errors = 0
    
    email_batch = []
    recipients_batch = []
    
    try:
        with open(jsonl_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                if max_emails and total_processed >= max_emails:
                    break
                
                if line_num % 10000 == 0:
                    print(f"Processed {line_num:,} lines...")
                
                try:
                    email_data = json.loads(line.strip())
                    total_processed += 1
                    
                    # Extract core email data
                    email_id = email_data.get('id', '')
                    internet_message_id = email_data.get('internetMessageId', '') or email_data.get('internet_message_id', '')
                    
                    if not email_id and not internet_message_id:
                        print(f"Skipping email without ID on line {line_num}")
                        continue
                    
                    # Use internet_message_id as primary if available, otherwise use id
                    primary_id = internet_message_id or email_id
                    
                    # Extract sender info
                    sender_email, sender_name = extract_sender_info(email_data)
                    
                    # Parse dates
                    created_date = parse_email_date(email_data.get('createdDateTime') or email_data.get('received'))
                    received_date = parse_email_date(email_data.get('receivedDateTime') or email_data.get('received'))
                    
                    # Extract body content
                    body_content = ''
                    body_data = email_data.get('body', '')
                    if isinstance(body_data, dict):
                        body_content = body_data.get('content', '')
                    elif isinstance(body_data, str):
                        body_content = body_data
                    
                    # Handle thread_id as conversation_id
                    conversation_id = email_data.get('conversationId', '') or email_data.get('thread_id', '')
                    
                    # Prepare email record
                    email_record = (
                        primary_id,  # id
                        internet_message_id,  # internet_message_id
                        email_data.get('subject', ''),  # subject
                        body_content,  # body_content
                        email_data.get('bodyPreview', '') or email_data.get('body_preview', ''),  # body_preview
                        sender_email,  # sender_email
                        sender_name,  # sender_name
                        created_date,  # created_date_time
                        received_date,  # received_date_time
                        conversation_id,  # conversation_id
                        email_data.get('importance', 'normal'),  # importance
                        email_data.get('hasAttachments', False) or email_data.get('has_attachments', False),  # has_attachments
                        email_data.get('isRead', False) or email_data.get('is_read', False),  # is_read
                        'active',  # status
                        'pending',  # workflow_state
                        'emails_extracted.jsonl'  # source_file
                    )
                    
                    email_batch.append(email_record)
                    
                    # Extract recipients
                    recipients = extract_recipients(email_data)
                    for recipient in recipients:
                        recipient_record = (
                            primary_id,  # email_id
                            recipient['type'],  # recipient_type
                            recipient['email'],  # email_address
                            recipient['name']  # name
                        )
                        recipients_batch.append(recipient_record)
                    
                    # Batch insert
                    if len(email_batch) >= batch_size:
                        try:
                            cursor.executemany("""
                                INSERT OR IGNORE INTO emails_enhanced (
                                    id, internet_message_id, subject, body_content, body_preview,
                                    sender_email, sender_name, created_date_time, received_date_time,
                                    conversation_id, importance, has_attachments, is_read,
                                    status, workflow_state, source_file
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, email_batch)
                            
                            cursor.executemany("""
                                INSERT INTO email_recipients (
                                    email_id, recipient_type, email_address, name
                                ) VALUES (?, ?, ?, ?)
                            """, recipients_batch)
                            
                            conn.commit()
                            imported_emails += cursor.rowcount
                            print(f"Imported batch: {imported_emails:,} emails total")
                            
                        except sqlite3.IntegrityError as e:
                            skipped_duplicates += len(email_batch)
                            print(f"Skipped duplicate batch: {e}")
                        
                        email_batch = []
                        recipients_batch = []
                
                except json.JSONDecodeError as e:
                    errors += 1
                    print(f"JSON decode error on line {line_num}: {e}")
                    continue
                except Exception as e:
                    errors += 1
                    print(f"Error processing line {line_num}: {e}")
                    continue
        
        # Insert remaining batch
        if email_batch:
            try:
                cursor.executemany("""
                    INSERT OR IGNORE INTO emails_enhanced (
                        id, internet_message_id, subject, body_content, body_preview,
                        sender_email, sender_name, created_date_time, received_date_time,
                        conversation_id, importance, has_attachments, is_read,
                        status, workflow_state, source_file
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, email_batch)
                
                cursor.executemany("""
                    INSERT INTO email_recipients (
                        email_id, recipient_type, email_address, display_name
                    ) VALUES (?, ?, ?, ?)
                """, recipients_batch)
                
                conn.commit()
                imported_emails += cursor.rowcount
                
            except sqlite3.IntegrityError as e:
                skipped_duplicates += len(email_batch)
                print(f"Skipped final batch duplicates: {e}")
    
    except FileNotFoundError:
        print(f"Error: File {jsonl_file} not found")
        return
    except Exception as e:
        print(f"Error during import: {e}")
        return
    finally:
        conn.close()
    
    print(f"\n=== IMPORT COMPLETE ===")
    print(f"Total processed: {total_processed:,}")
    print(f"Successfully imported: {imported_emails:,}")
    print(f"Skipped duplicates: {skipped_duplicates:,}")
    print(f"Errors: {errors:,}")
    print(f"Completed at: {datetime.now()}")

if __name__ == '__main__':
    jsonl_file = '/home/pricepro2006/iems_project/emails_extracted.jsonl'
    db_file = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    # Import all emails
    import_emails_from_jsonl(jsonl_file, db_file, batch_size=1000)