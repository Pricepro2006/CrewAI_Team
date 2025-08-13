#!/usr/bin/env python3
"""
Comprehensive Email Batcher - Create batches from SQLite database
This script creates email batches directly from the database with notification filtering,
content cleaning, and TD SYNNEX footer removal as specified.
"""

import os
import re
import json
import sqlite3
import logging
from datetime import datetime
from typing import Dict, List, Set, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/iems_project/email_batching.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ComprehensiveEmailBatcher:
    def __init__(self, db_path: str = '/home/pricepro2006/iems_project/email_database.db'):
        self.db_path = db_path
        self.output_dir = '/home/pricepro2006/iems_project/email_batches'
        self.notifications_dir = '/home/pricepro2006/iems_project/notification_batches'
        self.batch_size = 10
        self.notification_batch_size = 25
        self.max_body_length = 2000
        
        # Notification email senders to filter out from workflow analysis
        self.notification_senders = {
            'nifi_cpo@tdsynnex.com',
            'cronadmin@tdsynnex.com', 
            'do_not_reply@tdsynnex.com',
            'nifiautomation@tdsynnex.com',
            'no-reply@tdsynnex.com',
            'noreply@tdsynnex.com',
            'notifications@tdsynnex.com',
            'system@tdsynnex.com',
            'automated@tdsynnex.com',
            'asussystems@tdsynnex.com',
            'jobalerts-noreply@linkedin.com',
            'messages-noreply@linkedin.com',
            'newsletters-noreply@linkedin.com',
            'no-reply@sharepointonline.com'
        }
        
        # Additional notification keywords in subjects
        self.notification_keywords = {
            'automated report', 'system notification', 'backup complete', 
            'scheduled task', 'monitoring alert', 'server status',
            'database backup', 'sync complete', 'batch job',
            'nifi sales file process finished', 'nifi automation',
            'case edit notification', 'edit decision notification'
        }
        
        # TD SYNNEX footer patterns to remove
        self.td_synnex_footer_patterns = [
            r'This email and any files transmitted with it are confidential.*?TD SYNNEX.*?(?=\n\n|\Z)',
            r'CONFIDENTIALITY NOTICE:.*?TD SYNNEX.*?(?=\n\n|\Z)',
            r'This e-mail is from TD SYNNEX.*?(?=\n\n|\Z)',
            r'The information in this email.*?TD SYNNEX.*?(?=\n\n|\Z)',
            r'Please consider the environment before printing this e-mail.*?(?=\n\n|\Z)',
            r'If you are not the intended recipient.*?TD SYNNEX.*?(?=\n\n|\Z)',
            r'Confidentiality Notice.*?TD SYNNEX.*?(?=\n\n|\Z)',
        ]
        
        # Setup directories
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.notifications_dir, exist_ok=True)
    
    def is_notification_email(self, email: Dict) -> bool:
        """Determine if email is a notification/system email"""
        sender = (email.get('sender_email', '') or '').lower()
        subject = (email.get('subject', '') or '').lower()
        
        # Check sender domain
        if sender in self.notification_senders:
            return True
        
        # Check for notification keywords in subject
        if any(keyword in subject for keyword in self.notification_keywords):
            return True
            
        return False
    
    def clean_td_synnex_footers(self, content: str) -> str:
        """Remove TD SYNNEX confidentiality footers and disclaimers"""
        if not content:
            return content
        
        cleaned_content = content
        
        # Apply each footer pattern
        for pattern in self.td_synnex_footer_patterns:
            cleaned_content = re.sub(pattern, '', cleaned_content, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove excessive whitespace that might be left behind
        cleaned_content = re.sub(r'\n{3,}', '\n\n', cleaned_content)
        cleaned_content = cleaned_content.strip()
        
        return cleaned_content
    
    def clean_email_content(self, email: Dict) -> Dict:
        """Reduce email content size while preserving important information"""
        cleaned = email.copy()
        
        # Clean body text
        body_text = email.get('body_text', '') or ''
        if body_text:
            # Remove TD SYNNEX footers first
            body_text = self.clean_td_synnex_footers(body_text)
            
            # Truncate intelligently if still too long
            if len(body_text) > self.max_body_length:
                lines = body_text.split('\n')
                important_lines = []
                in_quote = False
                char_count = 0
                
                for line in lines:
                    # Skip quoted content (lines starting with > or common quote indicators)
                    if line.strip().startswith('>') or 'wrote:' in line.lower():
                        in_quote = True
                        continue
                    if in_quote and line.strip() == '':
                        continue
                    if in_quote and not line.strip().startswith('>'):
                        in_quote = False
                        
                    # Add line if we haven't exceeded length
                    if char_count + len(line) < self.max_body_length:
                        important_lines.append(line)
                        char_count += len(line)
                    else:
                        break
                
                body_text = '\n'.join(important_lines)
                if len(email.get('body_text', '')) > len(body_text):
                    body_text += '\n[... content truncated for analysis ...]'
            
            cleaned['body_text'] = body_text
        
        # Clean HTML body similarly
        body_html = email.get('body_html', '') or ''
        if body_html:
            # Remove TD SYNNEX footers
            body_html = self.clean_td_synnex_footers(body_html)
            
            # Simple HTML cleanup - remove tags and truncate
            if len(body_html) > self.max_body_length:
                text_content = re.sub(r'<[^>]+>', '', body_html)
                if len(text_content) > self.max_body_length:
                    body_html = text_content[:self.max_body_length] + '[... truncated ...]'
            
            cleaned['body_html'] = body_html
        
        # Simplify attachments info if too large
        attachments = email.get('attachments', '')
        if attachments and len(str(attachments)) > 500:
            try:
                if isinstance(attachments, str):
                    import json
                    attachments = json.loads(attachments)
                
                if isinstance(attachments, list):
                    simplified = []
                    for att in attachments[:10]:  # Limit to first 10 attachments
                        if isinstance(att, dict):
                            simplified.append({
                                'name': att.get('name', 'unknown'),
                                'size': att.get('size', 0),
                                'type': att.get('content_type', 'unknown')
                            })
                    cleaned['attachments'] = json.dumps(simplified)
            except:
                # If parsing fails, truncate as string
                cleaned['attachments'] = str(attachments)[:500] + '[... truncated ...]'
        
        return cleaned
    
    def extract_notification_summary(self, email: Dict) -> Dict:
        """Extract key information from notification emails for dashboard"""
        summary = {
            'type': 'notification',
            'sender': email.get('sender_email', ''),
            'subject': email.get('subject', ''),
            'timestamp': email.get('received_time', ''),
            'category': 'system'
        }
        
        subject_lower = (email.get('subject', '') or '').lower()
        
        # Categorize notifications
        if any(word in subject_lower for word in ['backup', 'sync']):
            summary['category'] = 'backup_sync'
        elif any(word in subject_lower for word in ['alert', 'warning', 'error']):
            summary['category'] = 'alert'
        elif any(word in subject_lower for word in ['report', 'summary']):
            summary['category'] = 'report'
        elif any(word in subject_lower for word in ['task', 'job', 'batch', 'nifi', 'process finished']):
            summary['category'] = 'automated_task'
        elif any(word in subject_lower for word in ['edit notification', 'decision notification']):
            summary['category'] = 'workflow_notification'
        
        # Extract any numbers or key identifiers
        body = email.get('body_text', '') or ''
        if body:
            # Look for common patterns like error codes, job IDs, etc.
            patterns = {
                'error_codes': r'error[:\s]+(\w+)',
                'job_ids': r'job[:\s]+(\w+)',
                'counts': r'(\d+)\s+(files?|records?|items?)',
            }
            
            for pattern_name, pattern in patterns.items():
                matches = re.findall(pattern, body.lower())
                if matches:
                    summary[pattern_name] = matches[:5]  # Limit to first 5 matches
        
        return summary
    
    def load_emails_from_database(self, limit: int = None) -> List[Dict]:
        """Load emails from SQLite database"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            cursor = conn.cursor()
            
            # Build query
            query = """
                SELECT * FROM emails 
                ORDER BY mailbox_email, received_time DESC
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            # Convert to list of dictionaries
            emails = []
            for row in rows:
                email = dict(row)
                emails.append(email)
            
            conn.close()
            logger.info(f"Loaded {len(emails)} emails from database")
            return emails
            
        except Exception as e:
            logger.error(f"Error loading emails from database: {e}")
            raise
    
    def get_database_statistics(self) -> Dict:
        """Get statistics about emails in the database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Total emails
            cursor.execute("SELECT COUNT(*) FROM emails")
            total_emails = cursor.fetchone()[0]
            
            # Emails by mailbox
            cursor.execute("""
                SELECT mailbox_email, COUNT(*) as count 
                FROM emails 
                GROUP BY mailbox_email 
                ORDER BY count DESC
            """)
            by_mailbox = dict(cursor.fetchall())
            
            # Emails by year
            cursor.execute("""
                SELECT year, COUNT(*) as count 
                FROM emails 
                WHERE year > 0
                GROUP BY year 
                ORDER BY year DESC
            """)
            by_year = dict(cursor.fetchall())
            
            # Folders processed
            cursor.execute("""
                SELECT COUNT(DISTINCT folder_path) 
                FROM emails 
                WHERE folder_path IS NOT NULL
            """)
            total_folders = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                'total_emails': total_emails,
                'by_mailbox': by_mailbox,
                'by_year': by_year,
                'total_folders': total_folders
            }
            
        except Exception as e:
            logger.error(f"Error getting database statistics: {e}")
            return {}
    
    def create_email_batches(self, limit: int = None) -> Dict:
        """Create email batches from database"""
        logger.info("🚀 Starting comprehensive email batching process")
        
        # Get database statistics
        stats = self.get_database_statistics()
        logger.info(f"📊 Database Statistics:")
        logger.info(f"   📧 Total emails: {stats.get('total_emails', 0):,}")
        logger.info(f"   📁 Total folders: {stats.get('total_folders', 0)}")
        
        if stats.get('by_mailbox'):
            logger.info(f"   📬 By mailbox:")
            for mailbox, count in stats['by_mailbox'].items():
                logger.info(f"      • {mailbox}: {count:,} emails")
        
        # Load emails
        emails = self.load_emails_from_database(limit)
        total_emails = len(emails)
        
        if total_emails == 0:
            logger.warning("No emails found in database")
            return {'business_batches': 0, 'notification_batches': 0}
        
        logger.info(f"📧 Processing {total_emails:,} emails")
        
        # Separate notifications from business emails
        business_emails = []
        notification_emails = []
        
        for email in emails:
            if self.is_notification_email(email):
                notification_summary = self.extract_notification_summary(email)
                notification_emails.append(notification_summary)
            else:
                # Clean and reduce content size for business emails
                cleaned_email = self.clean_email_content(email)
                business_emails.append(cleaned_email)
        
        logger.info(f"📊 Email Classification:")
        logger.info(f"   💼 Business emails: {len(business_emails):,}")
        logger.info(f"   🔔 Notification emails: {len(notification_emails):,}")
        
        # Create business email batches
        business_batches = 0
        for i in range(0, len(business_emails), self.batch_size):
            batch = business_emails[i:i+self.batch_size]
            batch_num = i // self.batch_size + 1
            batch_path = os.path.join(self.output_dir, f"emails_batch_{batch_num}.json")
            
            with open(batch_path, "w", encoding="utf-8") as f:
                json.dump(batch, f, indent=2, ensure_ascii=False)
            
            logger.info(f"📝 Wrote business batch {batch_num}: {len(batch)} emails to {batch_path}")
            business_batches += 1
        
        # Create notification email batches
        notification_batches = 0
        if notification_emails:
            for i in range(0, len(notification_emails), self.notification_batch_size):
                batch = notification_emails[i:i+self.notification_batch_size]
                batch_num = i // self.notification_batch_size + 1
                batch_path = os.path.join(self.notifications_dir, f"notifications_batch_{batch_num}.json")
                
                with open(batch_path, "w", encoding="utf-8") as f:
                    json.dump(batch, f, indent=2, ensure_ascii=False)
                
                logger.info(f"🔔 Wrote notification batch {batch_num}: {len(batch)} notifications to {batch_path}")
                notification_batches += 1
        
        # Create summary report
        summary = {
            'processed_at': datetime.now().isoformat(),
            'total_emails': total_emails,
            'business_emails': len(business_emails),
            'notification_emails': len(notification_emails),
            'business_batches': business_batches,
            'notification_batches': notification_batches,
            'batch_size_business': self.batch_size,
            'batch_size_notifications': self.notification_batch_size,
            'content_filtering': {
                'max_body_length': self.max_body_length,
                'filtered_senders': list(self.notification_senders),
                'notification_keywords': list(self.notification_keywords),
                'td_synnex_footer_removal': True
            },
            'database_statistics': stats
        }
        
        summary_path = os.path.join(self.output_dir, 'batch_processing_summary.json')
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"\n🎉 BATCHING COMPLETE:")
        logger.info(f"   📧 Total emails processed: {total_emails:,}")
        logger.info(f"   💼 Business emails: {len(business_emails):,} ({business_batches} batches)")
        logger.info(f"   🔔 Notifications: {len(notification_emails):,} ({notification_batches} batches)")
        logger.info(f"   📁 Business batches directory: {self.output_dir}")
        logger.info(f"   📁 Notification batches directory: {self.notifications_dir}")
        logger.info(f"   📋 Summary: {summary_path}")
        
        return {
            'business_batches': business_batches,
            'notification_batches': notification_batches,
            'summary': summary
        }

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Create comprehensive email batches from database')
    parser.add_argument('--db-path', default='/home/pricepro2006/iems_project/email_database.db', help='Path to SQLite database')
    parser.add_argument('--limit', type=int, help='Limit number of emails to process (for testing)')
    parser.add_argument('--output-dir', help='Output directory for batches')
    
    args = parser.parse_args()
    
    batcher = ComprehensiveEmailBatcher(args.db_path)
    
    if args.output_dir:
        batcher.output_dir = args.output_dir
        batcher.notifications_dir = os.path.join(args.output_dir, 'notifications')
        os.makedirs(batcher.output_dir, exist_ok=True)
        os.makedirs(batcher.notifications_dir, exist_ok=True)
    
    try:
        result = batcher.create_email_batches(args.limit)
        
        print(f"\n✅ SUCCESS: Created {result['business_batches']} business batches and {result['notification_batches']} notification batches")
        return 0
        
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        return 1

if __name__ == "__main__":
    import sys
    sys.exit(main())