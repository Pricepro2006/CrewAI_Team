#!/usr/bin/env python3
"""
Consolidate all unique emails from various sources into a single location.
This script will:
1. Read emails from IEMS email batches (34k emails in 6600+ files)
2. Read emails from CrewAI database (106k+ emails)
3. Read emails from other JSON sources
4. Deduplicate by internet_message_id
5. Save to a consolidated location
"""

import json
import os
import sqlite3
from pathlib import Path
from collections import defaultdict
from datetime import datetime
import hashlib

def generate_email_id(email):
    """Generate a unique ID for emails without internet_message_id"""
    content = f"{email.get('from', '')}{email.get('subject', '')}{email.get('received_at', '')}"
    return hashlib.md5(content.encode()).hexdigest()

def extract_emails_from_json_file(filepath):
    """Extract emails from a JSON file"""
    emails = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Handle different JSON structures
        if isinstance(data, list):
            emails.extend(data)
        elif isinstance(data, dict):
            # Check for common email container keys
            if 'emails' in data:
                emails.extend(data['emails'])
            elif 'messages' in data:
                emails.extend(data['messages'])
            elif 'value' in data:  # Microsoft Graph API format
                emails.extend(data['value'])
            else:
                # Assume single email
                emails.append(data)
                
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        
    return emails

def extract_emails_from_database(db_path):
    """Extract all emails from the SQLite database"""
    emails = []
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get all emails with their data
        query = """
        SELECT 
            id,
            internet_message_id,
            subject,
            sender_email,
            recipient_emails,
            cc_emails,
            body_text,
            body_html,
            received_at,
            has_attachments,
            importance,
            categories,
            conversation_id_ref,
            status,
            priority,
            workflow_type,
            workflow_state
        FROM emails_enhanced
        """
        
        cursor.execute(query)
        
        for row in cursor.fetchall():
            email = {
                'database_id': row['id'],
                'internet_message_id': row['internet_message_id'],
                'subject': row['subject'],
                'from': row['sender_email'],
                'recipients': json.loads(row['recipient_emails']) if row['recipient_emails'] else [],
                'cc': json.loads(row['cc_emails']) if row['cc_emails'] else [],
                'body_text': row['body_text'],
                'body_html': row['body_html'],
                'received_at': row['received_at'],
                'has_attachments': bool(row['has_attachments']),
                'importance': row['importance'],
                'categories': json.loads(row['categories']) if row['categories'] else [],
                'conversation_id': row['conversation_id_ref'],
                'status': row['status'],
                'priority': row['priority'],
                'workflow_type': row['workflow_type'],
                'workflow_state': row['workflow_state'],
                'source': 'crewai_database'
            }
            emails.append(email)
            
        conn.close()
        print(f"Extracted {len(emails)} emails from database")
        
    except Exception as e:
        print(f"Error extracting from database: {e}")
        
    return emails

def consolidate_emails():
    """Main function to consolidate all emails"""
    all_emails = {}  # Use dict for deduplication
    stats = defaultdict(int)
    
    # 1. Extract from IEMS email batches
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
            emails = extract_emails_from_json_file(filepath)
            stats['iems_files'] += 1
            stats['iems_emails'] += len(emails)
            
            for email in emails:
                # Use internet_message_id or generate one
                email_id = email.get('internet_message_id') or email.get('MessageID') or generate_email_id(email)
                if email_id not in all_emails:
                    email['source'] = 'iems_batches'
                    all_emails[email_id] = email
    
    # 2. Extract from IEMS received_emails
    print("\n2. Processing IEMS received emails...")
    iems_received_dir = '/home/pricepro2006/iems_project/received_emails'
    
    if os.path.exists(iems_received_dir):
        received_files = [f for f in os.listdir(iems_received_dir) 
                         if f.endswith('.json') and not f.endswith('Zone.Identifier')]
        
        print(f"Found {len(received_files)} received email files")
        
        for filename in received_files:
            filepath = os.path.join(iems_received_dir, filename)
            emails = extract_emails_from_json_file(filepath)
            stats['iems_received_files'] += 1
            stats['iems_received_emails'] += len(emails)
            
            for email in emails:
                email_id = email.get('internet_message_id') or email.get('MessageID') or generate_email_id(email)
                if email_id not in all_emails:
                    email['source'] = 'iems_received'
                    all_emails[email_id] = email
    
    # 3. Extract from CrewAI database
    print("\n3. Processing CrewAI database...")
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    if os.path.exists(db_path):
        db_emails = extract_emails_from_database(db_path)
        stats['database_emails'] = len(db_emails)
        
        for email in db_emails:
            email_id = email.get('internet_message_id') or generate_email_id(email)
            if email_id not in all_emails:
                all_emails[email_id] = email
            else:
                # Merge database info if email already exists
                existing = all_emails[email_id]
                if not existing.get('status'):
                    existing['status'] = email.get('status')
                if not existing.get('priority'):
                    existing['priority'] = email.get('priority')
                if not existing.get('workflow_type'):
                    existing['workflow_type'] = email.get('workflow_type')
                if not existing.get('workflow_state'):
                    existing['workflow_state'] = email.get('workflow_state')
    
    # 4. Extract from CrewAI email batches
    print("\n4. Processing CrewAI email batches...")
    crewai_batch_dir = '/home/pricepro2006/CrewAI_Team/data/email-batches'
    
    if os.path.exists(crewai_batch_dir):
        for root, dirs, files in os.walk(crewai_batch_dir):
            json_files = [f for f in files if f.endswith('.json')]
            stats['crewai_batch_files'] += len(json_files)
            
            for filename in json_files:
                filepath = os.path.join(root, filename)
                emails = extract_emails_from_json_file(filepath)
                stats['crewai_batch_emails'] += len(emails)
                
                for email in emails:
                    email_id = email.get('internet_message_id') or email.get('MessageID') or generate_email_id(email)
                    if email_id not in all_emails:
                        email['source'] = 'crewai_batches'
                        all_emails[email_id] = email
    
    # 5. Save consolidated emails
    print("\n5. Saving consolidated emails...")
    output_dir = '/home/pricepro2006/CrewAI_Team/data/consolidated_emails'
    os.makedirs(output_dir, exist_ok=True)
    
    # Save as single large file
    output_file = os.path.join(output_dir, 'all_unique_emails.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(list(all_emails.values()), f, indent=2, ensure_ascii=False)
    
    # Also save in batches of 1000 for easier processing
    batch_size = 1000
    email_list = list(all_emails.values())
    
    for i in range(0, len(email_list), batch_size):
        batch = email_list[i:i+batch_size]
        batch_file = os.path.join(output_dir, f'batch_{i//batch_size:04d}.json')
        with open(batch_file, 'w', encoding='utf-8') as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
    
    # Save statistics
    stats['total_unique_emails'] = len(all_emails)
    stats['output_batches'] = (len(email_list) + batch_size - 1) // batch_size
    
    stats_file = os.path.join(output_dir, 'consolidation_stats.json')
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(dict(stats), f, indent=2)
    
    # Print summary
    print("\n" + "="*60)
    print("CONSOLIDATION COMPLETE")
    print("="*60)
    print(f"Total unique emails: {stats['total_unique_emails']:,}")
    print(f"\nSource breakdown:")
    print(f"  - IEMS batches: {stats['iems_emails']:,} emails from {stats['iems_files']:,} files")
    print(f"  - IEMS received: {stats['iems_received_emails']:,} emails from {stats['iems_received_files']:,} files")
    print(f"  - CrewAI database: {stats['database_emails']:,} emails")
    print(f"  - CrewAI batches: {stats['crewai_batch_emails']:,} emails from {stats['crewai_batch_files']:,} files")
    print(f"\nOutput:")
    print(f"  - Location: {output_dir}")
    print(f"  - Main file: all_unique_emails.json")
    print(f"  - Batch files: {stats['output_batches']} files (1000 emails each)")
    print(f"  - Stats file: consolidation_stats.json")
    
    return stats

if __name__ == "__main__":
    consolidate_emails()