#!/usr/bin/env python3
"""
Consolidate all unique emails using MCP WSL filesystem
"""

import json
import os
import sqlite3
from collections import defaultdict
from datetime import datetime
import hashlib

def generate_email_id(email):
    """Generate a unique ID for emails without internet_message_id"""
    id_fields = []
    
    if isinstance(email, dict):
        for field in ['MessageID', 'messageId', 'id', 'Id', 'ID']:
            if field in email:
                return str(email[field])
        
        id_fields.append(email.get('from', email.get('From', email.get('sender_email', ''))))
        id_fields.append(email.get('subject', email.get('Subject', '')))
        id_fields.append(email.get('received_at', email.get('ReceivedDateTime', email.get('receivedDateTime', ''))))
        id_fields.append(email.get('body', email.get('Body', email.get('body_text', '')))[:100])
    
    content = '|'.join(str(f) for f in id_fields if f)
    return hashlib.md5(content.encode()).hexdigest()

def get_message_id(email):
    """Extract message ID from various possible fields"""
    if isinstance(email, dict):
        id_fields = ['internet_message_id', 'internetMessageId', 'MessageID', 'messageId', 'id', 'Id']
        for field in id_fields:
            if field in email and email[field]:
                return email[field]
    return None

def process_emails_from_file(filepath):
    """Process emails from a JSON file"""
    emails = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        if isinstance(data, list):
            emails.extend(data)
        elif isinstance(data, dict):
            if 'emails' in data:
                emails.extend(data['emails'])
            elif 'messages' in data:
                emails.extend(data['messages'])
            elif 'value' in data:
                emails.extend(data['value'])
            else:
                emails.append(data)
                
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        
    return emails

def main():
    all_emails = {}
    stats = defaultdict(int)
    duplicate_count = 0
    
    # Process IEMS email batches
    print("\n1. Processing IEMS email batches...")
    iems_batch_dir = '/home/pricepro2006/iems_project/db_backups/email_batches'
    
    if os.path.exists(iems_batch_dir):
        batch_files = [f for f in os.listdir(iems_batch_dir) 
                      if f.endswith('.json') and not f.endswith('Zone.Identifier')]
        
        print(f"Found {len(batch_files)} batch files")
        
        for i, filename in enumerate(batch_files):
            if i % 100 == 0:
                print(f"Processing batch {i}/{len(batch_files)}...")
                
            filepath = os.path.join(iems_batch_dir, filename)
            emails = process_emails_from_file(filepath)
            stats['iems_files'] += 1
            stats['iems_emails'] += len(emails)
            
            for email in emails:
                email_id = get_message_id(email) or generate_email_id(email)
                if email_id not in all_emails:
                    email['_source_file'] = filename
                    email['_source_type'] = 'iems_batches'
                    all_emails[email_id] = email
                else:
                    duplicate_count += 1
    
    # Process database emails
    print("\n2. Processing CrewAI database...")
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT * FROM emails_enhanced
            """)
            
            for row in cursor.fetchall():
                email = dict(row)
                email['_source'] = 'crewai_database'
                
                email_id = email.get('internet_message_id') or generate_email_id(email)
                if email_id not in all_emails:
                    all_emails[email_id] = email
                    stats['database_emails'] += 1
                else:
                    duplicate_count += 1
                    
            conn.close()
            print(f"Extracted {stats['database_emails']} emails from database")
            
        except Exception as e:
            print(f"Error extracting from database: {e}")
    
    # Save results
    output_dir = '/home/pricepro2006/CrewAI_Team/data/consolidated_emails'
    os.makedirs(output_dir, exist_ok=True)
    
    # Save main file
    output_file = os.path.join(output_dir, 'all_unique_emails.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(list(all_emails.values()), f, indent=2, ensure_ascii=False)
    
    # Stats
    stats['total_unique_emails'] = len(all_emails)
    stats['duplicates_removed'] = duplicate_count
    
    print(f"\nTotal unique emails: {stats['total_unique_emails']:,}")
    print(f"Duplicates removed: {duplicate_count:,}")
    print(f"Output: {output_file}")
    
    return stats

if __name__ == "__main__":
    main()