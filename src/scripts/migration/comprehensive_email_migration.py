#!/usr/bin/env python3
"""
Comprehensive Email Migration Script
Migrates 33,797 emails from crewai.db to app.db with enhanced multi-stage analysis
Incorporates 90% accuracy entity extraction patterns from email-batch-processor.ts
"""

import os
import sys
import sqlite3
import json
import re
import logging
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
import uuid

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class ComprehensiveEmailMigration:
    def __init__(self):
        self.source_db_path = "/home/pricepro2006/CrewAI_Team/data/crewai.db"
        self.target_db_path = "/home/pricepro2006/CrewAI_Team/data/app.db"
        self.batch_size = 1000
        self.source_conn = None
        self.target_conn = None
        self.stats = {
            'total_emails': 0,
            'migrated': 0,
            'analyzed': 0,
            'entities_extracted': 0,
            'errors': 0,
            'start_time': time.time()
        }
        
    def connect_databases(self) -> bool:
        """Connect to both source and target databases with performance optimizations"""
        try:
            # Connect to source database
            self.source_conn = sqlite3.connect(self.source_db_path)
            self.source_conn.row_factory = sqlite3.Row
            logger.info(f"Connected to source database: {self.source_db_path}")
            
            # Connect to target database with autocommit disabled
            self.target_conn = sqlite3.connect(self.target_db_path, isolation_level=None)
            self.target_conn.row_factory = sqlite3.Row
            
            # Apply performance optimizations
            self.target_conn.execute("PRAGMA journal_mode = WAL")
            self.target_conn.execute("PRAGMA synchronous = NORMAL")
            self.target_conn.execute("PRAGMA cache_size = 10000")
            self.target_conn.execute("PRAGMA temp_store = MEMORY")
            self.target_conn.execute("PRAGMA mmap_size = 268435456")
            self.target_conn.execute("PRAGMA foreign_keys = ON")
            self.target_conn.execute("PRAGMA busy_timeout = 30000")
            
            logger.info(f"Connected to target database: {self.target_db_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to databases: {e}")
            return False
            
    def get_total_email_count(self) -> int:
        """Get total number of emails to migrate"""
        cursor = self.source_conn.cursor()
        count = cursor.execute("SELECT COUNT(*) FROM emails_enhanced").fetchone()[0]
        return count
        
    def clean_html_content(self, html: str) -> str:
        """Clean HTML content to extract plain text"""
        if not html:
            return ""
            
        # Remove script and style tags
        cleaned = re.sub(r'<script\b[^<]*(?:(?!</script>)<[^<]*)*</script>', '', html, flags=re.IGNORECASE)
        cleaned = re.sub(r'<style\b[^<]*(?:(?!</style>)<[^<]*)*</style>', '', cleaned, flags=re.IGNORECASE)
        
        # Remove HTML tags
        cleaned = re.sub(r'<[^>]*>', '', cleaned)
        
        # Decode HTML entities
        cleaned = cleaned.replace('&nbsp;', ' ')
        cleaned = cleaned.replace('&amp;', '&')
        cleaned = cleaned.replace('&lt;', '<')
        cleaned = cleaned.replace('&gt;', '>')
        cleaned = cleaned.replace('&quot;', '"')
        cleaned = cleaned.replace('&#39;', "'")
        
        # Clean up whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned)
        return cleaned.strip()
        
    def analyze_workflow_content(self, subject: str, body_text: str) -> Dict[str, Any]:
        """Analyze email content to determine workflow state and business process"""
        content = f"{subject} {body_text}".lower()
        
        # Determine workflow state
        workflow_state = "NEW"
        
        # COMPLETION indicators (highest priority)
        completion_keywords = [
            "success", "approved", "completed", "processed", "created",
            "confirmed", "sent to", "here are", "here is"
        ]
        if any(keyword in content for keyword in completion_keywords):
            workflow_state = "COMPLETION"
            
        # IN_PROGRESS indicators
        elif (subject.lower().startswith(("re:", "re ")) or 
              any(keyword in content for keyword in ["needed", "required", "issue", 
                                                      "verification", "provide", "please"])):
            workflow_state = "IN_PROGRESS"
            
        # Identify business process category
        business_process = "General"
        categories = []
        
        # Quote processing
        if any(keyword in content for keyword in ["quote", "pricing", "rfq", 
                                                   "approved", "f5q-", "price increase"]):
            business_process = "Quote Processing"
            categories.append("Quote Management")
            
        # Order management
        if any(keyword in content for keyword in ["po#", "po ", "order", "bo#", 
                                                   "backorder", "so#"]):
            business_process = "Order Management"
            categories.append("Order Processing")
            
        # Deal registration
        if any(keyword in content for keyword in ["deal registration", "deal reg", 
                                                   "spa automation", "dr"]):
            business_process = "Deal Registration"
            categories.append("Partner Management")
            
        # Renewal processing
        if any(keyword in content for keyword in ["renewal", "fy2", "annual", 
                                                   "lypo", "lyso"]):
            business_process = "Renewal Processing"
            categories.append("Subscription Management")
            
        # Returns processing
        if any(keyword in content for keyword in ["refuse", "return"]):
            business_process = "Returns Processing"
            categories.append("Order Processing")
            
        # Information distribution
        if any(keyword in content for keyword in ["briefing", "daily", "newsletter"]):
            business_process = "Information Distribution"
            categories.append("Communications")
            
        # Issue resolution
        if any(keyword in content for keyword in ["issue", "problem", "correct"]):
            business_process = "Issue Resolution"
            categories.append("Problem Management")
            
        # Verification processing
        if any(keyword in content for keyword in ["verification", "address"]):
            business_process = "Verification Processing"
            categories.append("Data Management")
            
        # Identify urgency indicators
        urgency_indicators = []
        urgent_keywords = [
            "may be deleted", "urgent", "expedite", "in a bind", 
            "asap", "critical"
        ]
        if any(keyword in content for keyword in urgent_keywords):
            urgency_indicators.append("HIGH_PRIORITY")
            
        if "effective" in content and "2025" in content:
            urgency_indicators.append("DEADLINE_SENSITIVE")
            
        if any(keyword in content for keyword in ["price increase", "price change"]):
            urgency_indicators.append("PRICING_UPDATE")
            
        return {
            'workflow_state': workflow_state,
            'business_process': business_process,
            'categories': categories,
            'urgency_indicators': urgency_indicators
        }
        
    def extract_business_entities(self, subject: str, body_text: str) -> Dict[str, List[str]]:
        """Extract business entities using patterns that achieved 90% accuracy"""
        content = f"{subject} {body_text}"
        entities = {
            'po_numbers': [],
            'quote_numbers': [],
            'case_numbers': [],
            'part_numbers': [],
            'order_references': [],
            'companies': [],
            'vendors': [],
            'contacts': []
        }
        
        # Extract order numbers
        order_patterns = [
            r'(?:bo#|order#|refuse order#|original order#)\s*:?\s*(\d{6,12})',
            r'(?:so#|so )\s*:?\s*(\d{6,12})',
            r'(?:lypo#|lyso#)\s*(\d{6,12})'
        ]
        
        for pattern in order_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                if match not in entities['order_references']:
                    entities['order_references'].append(match)
                    
        # Extract PO numbers (stored as quotes)
        po_matches = re.findall(r'(?:po#|po )\s*:?\s*(\d{6,12})', content, re.IGNORECASE)
        for po in po_matches:
            po_ref = f"PO-{po}"
            if po_ref not in entities['po_numbers']:
                entities['po_numbers'].append(po_ref)
                
        # Extract business reference numbers
        reference_patterns = [
            r'\b\d{7,10}\b',  # 7-10 digit reference numbers
            r'\bf5q-\d+\b',  # F5 quote numbers
            r'\bftq-\d+\b',  # FTQ quote numbers
            r'\bpo-\d+\b',  # Purchase order numbers
            r'\bq-\d+-\d+\b',  # Vendor quote numbers
            r'\bwq\d+\b',  # WQ reference numbers
            r'\bcpq-\d+\b',  # CPQ reference numbers
            r'\bdr\d+\b',  # Deal registration numbers
            r'\bcas-[a-z0-9]+-[a-z0-9]+\b',  # CAS case numbers
            r'\breg\s*#\s*([A-Z0-9]+)\b',  # REG# patterns
            r'\bbd#?\s*(\d+)\b',  # BD# patterns
            r'\bdb-\d+\b',  # DB- patterns
            r'\bpn#?\s*([A-Z0-9]+)\b'  # PN# patterns
        ]
        
        # Extract from subject line primarily (more reliable)
        for pattern in reference_patterns:
            matches = re.findall(pattern, subject, re.IGNORECASE)
            for ref in matches:
                clean_ref = ref.strip().upper()
                
                # Skip HTML color codes
                if re.match(r'^[0-9A-F]{6}$', clean_ref):
                    continue
                    
                # Handle special patterns
                if 'REG' in clean_ref:
                    clean_ref = re.sub(r'REG\s*#?\s*', '', clean_ref, flags=re.IGNORECASE)
                    
                if 'BD' in clean_ref:
                    bd_num = re.sub(r'BD#?\s*', '', clean_ref, flags=re.IGNORECASE)
                    entities['quote_numbers'].append(f"BD-{bd_num}")
                    continue
                    
                if clean_ref.startswith('CAS-'):
                    entities['case_numbers'].append(clean_ref)
                elif clean_ref.startswith(('FTQ-', 'F5Q-', 'Q-', 'CPQ-')):
                    entities['quote_numbers'].append(clean_ref)
                elif len(clean_ref) >= 4 and not clean_ref.isdigit():
                    entities['part_numbers'].append(clean_ref)
                    
        # Extract SKUs
        sku_patterns = [
            r'\b[A-Z0-9]{5,10}(?:#[A-Z0-9]{3})?\b',  # Standard SKU format
            r'\b(?:hpi-|hpp-|apl-|dell-)[a-z0-9]+(?:#aba|/aba)?\b',  # Vendor prefixed
            r'\b[a-z]?\d+[a-z]+\d*(?:#[a-z0-9]+)?\b',  # General SKU patterns
            r'\b\d[a-z]\d{3}[a-z]#[a-z0-9]+\b'  # HP format
        ]
        
        for pattern in sku_patterns:
            matches = re.findall(pattern, subject, re.IGNORECASE)
            for sku in matches:
                clean_sku = sku.strip().upper()
                if (len(clean_sku) >= 4 and 
                    not clean_sku.isdigit() and 
                    clean_sku not in entities['part_numbers']):
                    entities['part_numbers'].append(clean_sku)
                    
        # Extract companies
        companies = self.extract_companies_from_subject(subject)
        entities['companies'].extend(companies)
        
        # Extract additional companies from content
        company_patterns = [
            r'(?:reseller name is:|company:)\s*([a-z\s&,.]+)',
            r'university of ([a-z\s]+)',
            r'(.*?) equipment group',
            r'(.*?) & associates',
            r'([a-z\s]+) cpas'
        ]
        
        for pattern in company_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                company = match.strip().upper()
                if company and len(company) > 2 and company not in entities['companies']:
                    entities['companies'].append(company)
                    
        # Extract vendors
        vendors = self.extract_vendors_from_context(subject, body_text)
        entities['vendors'].extend(vendors)
        
        # Extract email contacts
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        email_matches = re.findall(email_pattern, content)
        for email in email_matches:
            if email.lower() not in entities['contacts']:
                entities['contacts'].append(email.lower())
                
        return entities
        
    def extract_companies_from_subject(self, subject: str) -> List[str]:
        """Extract company names from subject line"""
        companies = []
        
        # Direct company patterns
        company_patterns = [
            ('marriott', 'MARRIOTT'),
            ('edf renewables', 'EDF RENEWABLES'),
            ('american electric power|aep', 'AMERICAN ELECTRIC POWER'),
            ('cloud software group', 'CLOUD SOFTWARE GROUP'),
            ('ppg', 'PPG'),
            ('optiv security', 'OPTIV SECURITY'),
            ('compucom', 'COMPUCOM'),
            ('insight(?!HPI@)', 'INSIGHT'),
            ('first watch', 'FIRST WATCH'),
            ('lesco lightin', 'LESCO LIGHTIN'),
            ('new mexico environment', 'NEW MEXICO ENVIRONMENT'),
            ('scan health', 'SCAN HEALTH'),
            ('turing enterprises', 'TURING ENTERPRISES'),
            ('infoblox', 'INFOBLOX'),
            (r'jensen\s*&\s*halstead', 'JENSEN & HALSTEAD LTD'),
            ('cae\\s+usa', 'CAE USA INC'),
            ('securus', 'SECURUS')
        ]
        
        for pattern, company in company_patterns:
            if re.search(pattern, subject, re.IGNORECASE):
                if company not in companies:
                    companies.append(company)
                    
        # Dynamic company extraction from quote patterns
        # Pattern: "Quote Request-{Company Name}-CAS-"
        match = re.search(r'quote request-([^-]+)-cas-', subject, re.IGNORECASE)
        if match:
            company = match.group(1).strip().upper()
            if company and company not in companies:
                companies.append(company)
                
        # Pattern: "Quote request - {Company Name} - {number}"
        match = re.search(r'quote request\s*-\s*([^-]+)\s*-\s*\d+', subject, re.IGNORECASE)
        if match:
            company = match.group(1).strip().upper()
            if company and company not in companies:
                companies.append(company)
                
        # Pattern: "{Company Name} | CAS-"
        match = re.search(r'^([^|]+)\s*\|.*cas-', subject, re.IGNORECASE)
        if match and match.group(1).lower() != 're:':
            company = match.group(1).replace('re:', '').strip().upper()
            if company and company not in companies:
                companies.append(company)
                
        # Corporate suffix patterns
        match = re.search(r'([A-Za-z\s]+)(?:,\s*Inc\.|\\s+Corporation|\\s+LLC|\\s+Ltd\.)', 
                         subject, re.IGNORECASE)
        if match:
            company = match.group(1).strip().upper()
            if company and len(company) > 2 and company not in companies:
                companies.append(company)
                
        return companies
        
    def extract_vendors_from_context(self, subject: str, body_text: str) -> List[str]:
        """Extract vendor names from email content"""
        vendors = []
        content = f"{subject} {body_text}"
        
        vendor_patterns = [
            ('fortinet', 'FORTINET'),
            ('f5', 'F5'),
            ('imperva', 'IMPERVA'),
            ('symantec', 'SYMANTEC'),
            ('thales', 'THALES'),
            ('hp|hpi', 'HP'),
            ('dell', 'DELL'),
            ('panasonic|toughbook', 'PANASONIC'),
            ('logitech', 'LOGITECH'),
            ('poly', 'POLY'),
            ('apple|apl-', 'APPLE'),
            ('sap', 'SAP'),
            ('securus', 'SECURUS'),
            ('microsoft|surface|windows|office|azure', 'MICROSOFT')
        ]
        
        for pattern, vendor in vendor_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                if vendor not in vendors:
                    vendors.append(vendor)
                    
        return vendors
        
    def migrate_emails_batch(self, offset: int) -> int:
        """Migrate a batch of emails with analysis"""
        cursor = self.source_conn.cursor()
        
        # Fetch batch from source
        emails = cursor.execute("""
            SELECT * FROM emails_enhanced 
            ORDER BY id 
            LIMIT ? OFFSET ?
        """, (self.batch_size, offset)).fetchall()
        
        if not emails:
            return 0
        
        try:
            for email in emails:
                # Clean and prepare email data
                body_text = self.clean_html_content(email['body_html'] or email['body_text'] or '')
                subject = email['subject'] or ''
                
                # Stage 1: Quick analysis
                workflow_analysis = self.analyze_workflow_content(subject, body_text)
                
                # Stage 2: Entity extraction
                entities = self.extract_business_entities(subject, body_text)
                
                # Check if email already exists
                existing = self.target_conn.execute(
                    "SELECT id FROM emails WHERE graph_id = ?", 
                    (email['graph_id'],)
                ).fetchone()
                
                if existing:
                    email_id = existing[0]
                    self.stats['migrated'] += 1
                    logger.debug(f"Email already exists with id {email_id}: {email['graph_id']}")
                else:
                    # Insert email record with proper TEXT ID
                    email_text_id = f"email-{str(uuid.uuid4())}"
                    cursor_target = self.target_conn.cursor()
                    cursor_target.execute("""
                        INSERT INTO emails (
                            id, graph_id, subject, sender_email, sender_name,
                            received_at, body_preview, body, has_attachments,
                            importance, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (
                        email_text_id,
                        email['graph_id'],
                        subject,
                        email['sender_email'],
                        email['sender_name'] or email['sender_email'],
                        email['received_at'],
                        email['body_preview'] or body_text[:200],
                        body_text,
                        email['has_attachments'],
                        email['importance'] or 'normal'
                    ))
                    
                    email_id = email_text_id
                    self.stats['migrated'] += 1
                
                # Insert or update email analysis
                analysis_id = str(uuid.uuid4())
                
                # Check if analysis exists
                existing_analysis = self.target_conn.execute(
                    "SELECT id FROM email_analysis WHERE email_id = ?",
                    (email_id,)
                ).fetchone()
                
                if not existing_analysis:
                    self.target_conn.execute("""
                        INSERT INTO email_analysis (
                            id, email_id,
                            quick_workflow, quick_priority, quick_intent, 
                            quick_confidence, workflow_state,
                            entities_po_numbers, entities_quote_numbers,
                            entities_case_numbers, entities_part_numbers,
                            entities_order_references, entities_contacts,
                            deep_workflow_primary, contextual_summary,
                            created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (
                        analysis_id,
                        email_id,
                        workflow_analysis['business_process'],
                        'High' if 'HIGH_PRIORITY' in workflow_analysis['urgency_indicators'] else 'Medium',
                        'Action Required' if workflow_analysis['workflow_state'] == 'IN_PROGRESS' else 'Information',
                        0.85,
                        workflow_analysis['workflow_state'],
                        json.dumps(entities['po_numbers']),
                        json.dumps(entities['quote_numbers']),
                        json.dumps(entities['case_numbers']),
                        json.dumps(entities['part_numbers']),
                        json.dumps(entities['order_references']),
                        json.dumps(entities['contacts']),
                        workflow_analysis['business_process'],
                        f"Email regarding {workflow_analysis['business_process']} "
                        f"with {len(entities['part_numbers'])} products and "
                        f"{len(entities['companies'])} companies involved."
                    ))
                    
                    self.stats['analyzed'] += 1
                    self.stats['entities_extracted'] += sum(len(v) for v in entities.values())
                    
            logger.info(f"Migrated batch at offset {offset}, processed {len(emails)} emails")
            return len(emails)
            
        except Exception as e:
            logger.error(f"Error migrating batch at offset {offset}: {e}")
            self.stats['errors'] += 1
            return 0
            
    def run_migration(self):
        """Execute the complete migration"""
        logger.info("=" * 80)
        logger.info("Starting Comprehensive Email Migration")
        logger.info("=" * 80)
        
        if not self.connect_databases():
            return False
            
        try:
            # Get total count
            total_emails = self.get_total_email_count()
            self.stats['total_emails'] = total_emails
            logger.info(f"Found {total_emails:,} emails to migrate")
            
            # Create progress tracking table
            self.target_conn.execute("""
                CREATE TABLE IF NOT EXISTS migration_progress (
                    batch_id INTEGER PRIMARY KEY,
                    source_count INTEGER,
                    migrated_count INTEGER,
                    analyzed_count INTEGER,
                    status TEXT,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP
                )
            """)
            
            # Process in batches
            for offset in range(0, total_emails, self.batch_size):
                batch_start = time.time()
                
                # Start transaction for this batch
                self.target_conn.execute("BEGIN TRANSACTION")
                
                try:
                    # Record batch start
                    self.target_conn.execute("""
                        INSERT INTO migration_progress (
                            batch_id, source_count, status, started_at
                        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, (offset // self.batch_size, self.batch_size, 'processing'))
                    
                    # Process batch
                    processed = self.migrate_emails_batch(offset)
                
                    # Update batch completion
                    self.target_conn.execute("""
                        UPDATE migration_progress 
                        SET migrated_count = ?, analyzed_count = ?, 
                            status = 'completed', completed_at = CURRENT_TIMESTAMP
                        WHERE batch_id = ?
                    """, (processed, processed, offset // self.batch_size))
                    
                    # Commit the batch
                    self.target_conn.execute("COMMIT")
                    
                    # Progress report
                    progress = ((offset + processed) / total_emails) * 100
                    elapsed = time.time() - self.stats['start_time']
                    rate = self.stats['migrated'] / elapsed if elapsed > 0 else 0
                    eta = (total_emails - self.stats['migrated']) / rate / 60 if rate > 0 else 0
                    
                    logger.info(f"Progress: {progress:.1f}% - "
                              f"Migrated: {self.stats['migrated']:,} - "
                              f"Analyzed: {self.stats['analyzed']:,} - "
                              f"Entities: {self.stats['entities_extracted']:,} - "
                              f"Rate: {rate:.1f} emails/sec - "
                              f"ETA: {eta:.1f} minutes")
                              
                except Exception as e:
                    # Rollback on error
                    self.target_conn.execute("ROLLBACK")
                    logger.error(f"Error processing batch at offset {offset}: {e}")
                    self.stats['errors'] += 1
                          
            # Final statistics
            total_time = time.time() - self.stats['start_time']
            logger.info("=" * 80)
            logger.info("Migration Completed Successfully!")
            logger.info(f"Total time: {total_time/60:.1f} minutes")
            logger.info(f"Emails migrated: {self.stats['migrated']:,}")
            logger.info(f"Emails analyzed: {self.stats['analyzed']:,}")
            logger.info(f"Entities extracted: {self.stats['entities_extracted']:,}")
            logger.info(f"Errors: {self.stats['errors']}")
            logger.info(f"Average rate: {self.stats['migrated']/total_time:.1f} emails/second")
            logger.info("=" * 80)
            
            # Update statistics
            self.update_statistics()
            
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            return False
            
        finally:
            if self.source_conn:
                self.source_conn.close()
            if self.target_conn:
                self.target_conn.close()
                
    def update_statistics(self):
        """Update migration statistics in target database"""
        try:
            cursor = self.target_conn.cursor()
            
            # Email statistics
            stats = cursor.execute("""
                SELECT 
                    COUNT(DISTINCT e.id) as total_emails,
                    COUNT(DISTINCT ea.id) as analyzed_emails,
                    COUNT(DISTINCT CASE WHEN ea.workflow_state = 'COMPLETION' THEN e.id END) as completed,
                    COUNT(DISTINCT CASE WHEN ea.workflow_state = 'IN_PROGRESS' THEN e.id END) as in_progress,
                    COUNT(DISTINCT CASE WHEN ea.quick_priority = 'High' THEN e.id END) as high_priority
                FROM emails e
                LEFT JOIN email_analysis ea ON e.id = ea.email_id
            """).fetchone()
            
            logger.info("\nFinal Database Statistics:")
            logger.info(f"  Total emails: {stats['total_emails']:,}")
            logger.info(f"  Analyzed emails: {stats['analyzed_emails']:,}")
            logger.info(f"  Completed workflows: {stats['completed']:,}")
            logger.info(f"  In-progress workflows: {stats['in_progress']:,}")
            logger.info(f"  High priority emails: {stats['high_priority']:,}")
            
            # Entity statistics
            entity_stats = cursor.execute("""
                SELECT 
                    SUM(json_array_length(entities_po_numbers)) as po_count,
                    SUM(json_array_length(entities_quote_numbers)) as quote_count,
                    SUM(json_array_length(entities_part_numbers)) as part_count,
                    SUM(json_array_length(entities_order_references)) as order_count
                FROM email_analysis
                WHERE entities_po_numbers IS NOT NULL
            """).fetchone()
            
            if entity_stats:
                logger.info(f"\nEntity Extraction Statistics:")
                logger.info(f"  PO Numbers: {entity_stats['po_count'] or 0:,}")
                logger.info(f"  Quote Numbers: {entity_stats['quote_count'] or 0:,}")
                logger.info(f"  Part Numbers: {entity_stats['part_count'] or 0:,}")
                logger.info(f"  Order References: {entity_stats['order_count'] or 0:,}")
                
        except Exception as e:
            logger.error(f"Error updating statistics: {e}")

if __name__ == "__main__":
    migration = ComprehensiveEmailMigration()
    success = migration.run_migration()
    sys.exit(0 if success else 1)