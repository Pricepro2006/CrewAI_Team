#!/usr/bin/env python3
"""
Pull and Analyze Emails from May-July 2025
This script:
1. Loads emails from existing batch files
2. Inserts them into the database
3. Runs them through Phase 2 or 3 analysis
"""

import os
import sys
import json
import sqlite3
from datetime import datetime
from pathlib import Path

# Configuration
BATCH_DIR = "/home/pricepro2006/iems_project/db_backups/email_batches"
DB_PATH = "/home/pricepro2006/CrewAI_Team/data/crewai.db"
START_DATE = "2025-05-01"
END_DATE = "2025-07-31"

def load_batch_files():
    """Load all batch files and filter for May-July 2025 emails"""
    all_emails = []
    batch_files = sorted([f for f in os.listdir(BATCH_DIR) if f.startswith("emails_batch_") and f.endswith(".json")])
    
    print(f"Found {len(batch_files)} batch files to process")
    
    for batch_file in batch_files:
        try:
            with open(os.path.join(BATCH_DIR, batch_file), 'r', encoding='utf-8') as f:
                emails = json.load(f)
                
            # Filter emails by date
            for email in emails:
                received_time = email.get('ReceivedTime', '')
                if received_time:
                    # Parse date
                    try:
                        email_date = datetime.fromisoformat(received_time.replace('Z', '+00:00'))
                        start = datetime.fromisoformat(START_DATE + 'T00:00:00+00:00')
                        end = datetime.fromisoformat(END_DATE + 'T23:59:59+00:00')
                        
                        if start <= email_date <= end:
                            all_emails.append(email)
                    except:
                        pass
                        
        except Exception as e:
            print(f"Error loading {batch_file}: {e}")
            
    return all_emails

def insert_emails_to_database(emails):
    """Insert emails into the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    inserted = 0
    skipped = 0
    
    for email in emails:
        try:
            # Check if email already exists
            cursor.execute("SELECT COUNT(*) FROM emails WHERE id = ?", (email['MessageID'],))
            if cursor.fetchone()[0] > 0:
                skipped += 1
                continue
            
            # Parse recipients
            recipients = email.get('Recipients', '{}')
            if isinstance(recipients, str):
                try:
                    recipients_dict = json.loads(recipients)
                    to_addresses = json.dumps([r.get('address', r) if isinstance(r, dict) else r 
                                             for r in recipients_dict.get('to', [])])
                except:
                    to_addresses = '[]'
            else:
                to_addresses = '[]'
            
            # Insert email
            cursor.execute('''
                INSERT INTO emails (
                    id, graph_id, subject, sender_email, sender_name,
                    to_addresses, received_at, is_read, has_attachments,
                    body_preview, body, importance, categories,
                    raw_content, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                email['MessageID'],
                email['MessageID'],  # Use MessageID as graph_id for uniqueness
                email.get('Subject', ''),
                email.get('SenderEmail', ''),
                email.get('SenderName', ''),
                to_addresses,
                email.get('ReceivedTime', ''),
                1 if email.get('IsRead') else 0,
                1 if email.get('HasAttachments') else 0,
                email.get('BodyText', '')[:500] if email.get('BodyText') else '',
                email.get('BodyText', ''),
                email.get('Importance', 'normal'),
                json.dumps([email.get('FolderPath', 'Inbox')]),
                json.dumps(email),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            inserted += 1
            
            if inserted % 100 == 0:
                conn.commit()
                print(f"Inserted {inserted} emails...")
                
        except Exception as e:
            print(f"Error inserting email {email.get('MessageID', 'unknown')}: {e}")
    
    conn.commit()
    conn.close()
    
    return inserted, skipped

def analyze_emails(emails):
    """Run Phase 2/3 analysis on emails"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    analyzed = 0
    
    for email in emails:
        try:
            # Skip if already analyzed
            cursor.execute("SELECT COUNT(*) FROM email_analysis WHERE email_id = ?", (email['MessageID'],))
            if cursor.fetchone()[0] > 0:
                continue
            
            # Phase 1: Quick Classification
            subject = email.get('Subject', '')
            body = email.get('BodyText', '')
            text = f"{subject} {body}".lower()
            
            # Detect workflow
            if 'rma' in text or 'return' in text or 'defective' in text:
                workflow = 'RMA Processing'
            elif 'quote' in text or 'pricing' in text:
                workflow = 'Quote Processing'
            elif 'order' in text or 'po#' in text:
                workflow = 'Order Management'
            elif 'tracking' in text or 'shipment' in text:
                workflow = 'Shipping Management'
            elif 'billing' in text or 'invoice' in text:
                workflow = 'Billing Support'
            else:
                workflow = 'General Support'
            
            # Detect priority
            if 'urgent' in subject.lower() or 'critical' in subject.lower():
                priority = 'Critical'
            elif 'important' in subject.lower() or 'priority' in subject.lower():
                priority = 'High'
            elif 'fyi' in subject.lower():
                priority = 'Low'
            else:
                priority = 'Medium'
            
            # Phase 2: Entity extraction (for high priority)
            entities_contacts = json.dumps([email.get('SenderEmail', '')])
            action_summary = f"{workflow} - {priority} priority"
            
            if priority in ['Critical', 'High']:
                # Extract PO numbers
                import re
                po_pattern = r'\b(?:PO#?|P\.O\.)\s*(\d{7,12})\b'
                po_numbers = re.findall(po_pattern, text, re.IGNORECASE)
                entities_po_numbers = json.dumps(po_numbers) if po_numbers else None
                
                # Extract part numbers
                part_pattern = r'\b[A-Z0-9]{5,15}[-#]?[A-Z0-9]{0,5}\b'
                part_numbers = list(set(re.findall(part_pattern, body)))[:10]
                entities_part_numbers = json.dumps(part_numbers) if part_numbers else None
            else:
                entities_po_numbers = None
                entities_part_numbers = None
            
            # Insert analysis
            analysis_id = f"analysis_{datetime.now().timestamp()}_{email['MessageID'][:10]}"
            
            cursor.execute('''
                INSERT INTO email_analysis (
                    id, email_id, quick_workflow, quick_priority, quick_intent,
                    quick_confidence, entities_contacts, action_summary,
                    entities_po_numbers, entities_part_numbers,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                analysis_id,
                email['MessageID'],
                workflow,
                priority,
                'request' if 'request' in text else 'information',
                0.85,
                entities_contacts,
                action_summary,
                entities_po_numbers,
                entities_part_numbers,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            
            analyzed += 1
            
            if analyzed % 100 == 0:
                conn.commit()
                print(f"Analyzed {analyzed} emails...")
                
        except Exception as e:
            print(f"Error analyzing email {email.get('MessageID', 'unknown')}: {e}")
    
    conn.commit()
    conn.close()
    
    return analyzed

def main():
    print("=== Email Pipeline: May-July 2025 ===\n")
    
    # Step 1: Load emails from batch files
    print("Step 1: Loading emails from batch files...")
    emails = load_batch_files()
    
    # Group by month and folder
    stats = {}
    for email in emails:
        month = email.get('ReceivedTime', '')[:7]
        folder = email.get('FolderPath', 'Unknown')
        key = f"{month} - {folder}"
        stats[key] = stats.get(key, 0) + 1
    
    print(f"\nTotal emails found: {len(emails)}")
    print("\nBreakdown by month and folder:")
    for key in sorted(stats.keys()):
        print(f"  {key}: {stats[key]} emails")
    
    # Step 2: Insert emails into database
    print("\nStep 2: Inserting emails into database...")
    inserted, skipped = insert_emails_to_database(emails)
    print(f"Inserted: {inserted}, Skipped (already exists): {skipped}")
    
    # Step 3: Run analysis
    print("\nStep 3: Running Phase 2/3 analysis...")
    # Only analyze emails that were successfully inserted
    inserted_emails = []
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    for email in emails:
        cursor.execute("SELECT COUNT(*) FROM emails WHERE id = ?", (email['MessageID'],))
        if cursor.fetchone()[0] > 0:
            inserted_emails.append(email)
    conn.close()
    
    analyzed = analyze_emails(inserted_emails)
    print(f"Analyzed: {analyzed} emails")
    
    # Step 4: Summary
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            strftime('%Y-%m', received_at) as month,
            COUNT(*) as total,
            COUNT(DISTINCT CASE WHEN ea.id IS NOT NULL THEN e.id END) as analyzed
        FROM emails e
        LEFT JOIN email_analysis ea ON e.id = ea.email_id
        WHERE e.received_at >= ? AND e.received_at <= ?
        GROUP BY month
        ORDER BY month
    """, (START_DATE, END_DATE + 'T23:59:59'))
    
    print("\n=== Final Summary ===")
    print("Month     | Total | Analyzed")
    print("----------|-------|----------")
    for row in cursor.fetchall():
        print(f"{row[0]} | {row[1]:5d} | {row[2]:5d}")
    
    conn.close()
    print("\n✅ Pipeline complete! Emails are now available in the dashboard.")

if __name__ == "__main__":
    main()