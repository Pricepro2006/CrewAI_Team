"""
Microsoft Graph API Email Retriever for CrewAI Team
==================================================

This script retrieves missing emails from Microsoft Graph API for specific date ranges
and creates batch JSON files compatible with the existing CrewAI email processing pipeline.

Missing Date Ranges:
- May 9-31, 2025: 23 days missing
- June 1-30, 2025: Entire month missing  
- July 1-25, 2025: 25 days missing

Total: 78 days of missing emails

Author: CrewAI Team Email Pipeline
Version: 1.0.0
"""

import json
import sqlite3
import logging
import asyncio
import aiohttp
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple
from contextlib import contextmanager
from dataclasses import dataclass, asdict
import hashlib
import uuid
import re
import os
from urllib.parse import quote


@dataclass
class EmailBatch:
    """Represents a batch of emails for processing."""
    batch_number: int
    start_date: str
    end_date: str
    email_count: int
    created_at: str
    graph_api_version: str = "v1.0"
    target_database: str = "crewai.db"


@dataclass
class GraphAPIConfig:
    """Microsoft Graph API configuration."""
    tenant_id: str
    client_id: str
    client_secret: str
    user_id: str  # Email address or user ID to fetch from
    base_url: str = "https://graph.microsoft.com/v1.0"
    max_retries: int = 3
    retry_delay: float = 1.0
    rate_limit_delay: float = 0.1
    batch_size: int = 50  # Emails per batch file
    page_size: int = 100  # Emails per API request


class MissingEmailRetriever:
    """
    Retrieves missing emails from Microsoft Graph API and creates batch files.
    
    This retriever:
    - Authenticates with Microsoft Graph API using client credentials
    - Retrieves emails for specific missing date ranges
    - Transforms emails to match CrewAI database schema
    - Creates JSON batch files matching existing pipeline format
    - Handles rate limiting, pagination, and error recovery
    - Avoids duplicate processing through database checks
    """
    
    def __init__(
        self,
        config: GraphAPIConfig,
        crewai_db_path: str = "/home/pricepro2006/CrewAI_Team/data/crewai.db",
        batch_output_dir: str = "/home/pricepro2006/CrewAI_Team/data/missing_email_batches",
        logger: Optional[logging.Logger] = None
    ):
        """
        Initialize the Missing Email Retriever.
        
        Args:
            config: Microsoft Graph API configuration
            crewai_db_path: Path to CrewAI database
            batch_output_dir: Directory for batch file output
            logger: Optional logger instance
        """
        self.config = config
        self.crewai_db_path = crewai_db_path
        self.batch_output_dir = Path(batch_output_dir)
        
        # Setup logger
        self.logger = logger or self._setup_default_logger()
        
        # Ensure output directory exists
        self.batch_output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize session and access token
        self.session: Optional[aiohttp.ClientSession] = None
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        
        # Statistics
        self.stats = {
            'emails_retrieved': 0,
            'batches_created': 0,
            'api_calls': 0,
            'rate_limit_hits': 0,
            'errors': 0,
            'duplicates_skipped': 0
        }
        
        # Define missing date ranges
        self.missing_date_ranges = [
            ('2025-05-09', '2025-05-31'),  # 23 days
            ('2025-06-01', '2025-06-30'),  # 30 days
            ('2025-07-01', '2025-07-25')   # 25 days
        ]
        
        # Validate database path
        self._validate_database_path()
    
    def _setup_default_logger(self) -> logging.Logger:
        """Setup default logger if none provided."""
        logger = logging.getLogger(__name__)
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _validate_database_path(self) -> None:
        """Validate that the CrewAI database exists."""
        if not os.path.exists(self.crewai_db_path):
            raise FileNotFoundError(f"CrewAI database not found: {self.crewai_db_path}")
    
    @contextmanager
    def _get_db_connection(self):
        """Context manager for database connections."""
        conn = None
        try:
            conn = sqlite3.connect(self.crewai_db_path)
            conn.row_factory = sqlite3.Row
            yield conn
        except sqlite3.Error as e:
            self.logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    async def _get_access_token(self) -> str:
        """
        Get access token using client credentials flow.
        
        Returns:
            Access token string
        """
        if self.access_token and self.token_expires_at:
            # Check if token is still valid (with 5 minute buffer)
            if datetime.now() < self.token_expires_at - timedelta(minutes=5):
                return self.access_token
        
        token_url = f"https://login.microsoftonline.com/{self.config.tenant_id}/oauth2/v2.0/token"
        
        data = {
            'grant_type': 'client_credentials',
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'scope': 'https://graph.microsoft.com/.default'
        }
        
        try:
            async with self.session.post(token_url, data=data) as response:
                if response.status == 200:
                    token_data = await response.json()
                    self.access_token = token_data['access_token']
                    expires_in = token_data.get('expires_in', 3600)
                    self.token_expires_at = datetime.now() + timedelta(seconds=expires_in)
                    
                    self.logger.info("Successfully obtained access token")
                    return self.access_token
                else:
                    error_text = await response.text()
                    raise Exception(f"Token request failed: {response.status} - {error_text}")
                    
        except Exception as e:
            self.logger.error(f"Error getting access token: {e}")
            raise
    
    async def _make_graph_request(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        retry_count: int = 0
    ) -> Dict[str, Any]:
        """
        Make a request to Microsoft Graph API with error handling and retries.
        
        Args:
            endpoint: API endpoint (relative to base URL)
            params: Query parameters
            retry_count: Current retry attempt
            
        Returns:
            JSON response as dictionary
        """
        token = await self._get_access_token()
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        url = f"{self.config.base_url}/{endpoint.lstrip('/')}"
        
        try:
            self.stats['api_calls'] += 1
            
            # Apply rate limiting
            await asyncio.sleep(self.config.rate_limit_delay)
            
            async with self.session.get(url, headers=headers, params=params) as response:
                if response.status == 200:
                    return await response.json()
                
                elif response.status == 429:  # Rate limited
                    self.stats['rate_limit_hits'] += 1
                    retry_after = int(response.headers.get('Retry-After', 60))
                    self.logger.warning(f"Rate limited, waiting {retry_after} seconds")
                    await asyncio.sleep(retry_after)
                    
                    if retry_count < self.config.max_retries:
                        return await self._make_graph_request(endpoint, params, retry_count + 1)
                    else:
                        raise Exception("Max retries exceeded for rate limiting")
                
                elif response.status in [401, 403]:  # Authentication/authorization error
                    # Clear token and retry once
                    self.access_token = None
                    self.token_expires_at = None
                    
                    if retry_count == 0:
                        return await self._make_graph_request(endpoint, params, retry_count + 1)
                    else:
                        error_text = await response.text()
                        raise Exception(f"Authentication failed: {response.status} - {error_text}")
                
                else:
                    error_text = await response.text()
                    if retry_count < self.config.max_retries:
                        self.logger.warning(f"Request failed, retrying: {response.status}")
                        await asyncio.sleep(self.config.retry_delay * (retry_count + 1))
                        return await self._make_graph_request(endpoint, params, retry_count + 1)
                    else:
                        raise Exception(f"Request failed: {response.status} - {error_text}")
                        
        except Exception as e:
            self.stats['errors'] += 1
            self.logger.error(f"Error making Graph request to {endpoint}: {e}")
            raise
    
    def _get_existing_message_ids(self) -> Set[str]:
        """
        Get set of existing Message IDs from existing batch files and database to avoid duplicates.
        
        This checks both:
        1. Existing batch files that may not have been processed yet
        2. CrewAI database emails that have been processed through the three-phase pipeline
        
        Returns:
            Set of existing Message IDs
        """
        existing_ids = set()
        
        try:
            # Check existing batch files in the same directory structure
            iems_batch_dir = Path("/home/pricepro2006/iems_project/db_backups/email_batches")
            missing_batch_dir = self.batch_output_dir
            
            # Check IEMS batch files
            if iems_batch_dir.exists():
                for batch_file in iems_batch_dir.glob("emails_batch_*.json"):
                    try:
                        with open(batch_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            for email in data:
                                if isinstance(email, dict) and email.get('MessageID'):
                                    existing_ids.add(email['MessageID'])
                    except Exception as e:
                        self.logger.warning(f"Error reading batch file {batch_file}: {e}")
            
            # Check our own missing email batch files
            for batch_file in missing_batch_dir.glob("missing_emails_batch_*.json"):
                try:
                    with open(batch_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        emails = data.get('emails', [])
                        for email in emails:
                            if isinstance(email, dict) and email.get('MessageID'):
                                existing_ids.add(email['MessageID'])
                except Exception as e:
                    self.logger.warning(f"Error reading missing batch file {batch_file}: {e}")
            
            # Check CrewAI database for emails that have been processed
            try:
                with self._get_db_connection() as conn:
                    cursor = conn.cursor()
                    # Check if there's a graph_id field in emails table
                    cursor.execute("PRAGMA table_info(emails)")
                    columns = [row[1] for row in cursor.fetchall()]
                    
                    if 'graph_id' in columns:
                        cursor.execute("SELECT graph_id FROM emails WHERE graph_id IS NOT NULL")
                        for row in cursor.fetchall():
                            existing_ids.add(row[0])
                    
                    self.logger.info(f"Found {len(existing_ids)} existing email IDs across all sources")
                    
            except Exception as e:
                self.logger.warning(f"Error checking CrewAI database: {e}")
        
        except Exception as e:
            self.logger.error(f"Error getting existing Message IDs: {e}")
        
        return existing_ids
    
    async def _retrieve_emails_for_date_range(
        self,
        start_date: str,
        end_date: str,
        existing_message_ids: Set[str]
    ) -> List[Dict[str, Any]]:
        """
        Retrieve emails from Graph API for a specific date range.
        
        Args:
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            existing_message_ids: Set of existing Message IDs to avoid duplicates
            
        Returns:
            List of email dictionaries
        """
        emails = []
        
        # Convert dates to ISO format for Graph API
        start_iso = f"{start_date}T00:00:00Z"
        end_iso = f"{end_date}T23:59:59Z"
        
        # Build OData filter for date range
        filter_query = f"receivedDateTime ge {start_iso} and receivedDateTime le {end_iso}"
        
        # Build select query for fields we need
        select_fields = [
            'id', 'subject', 'sender', 'toRecipients', 'ccRecipients', 'bccRecipients',
            'receivedDateTime', 'sentDateTime', 'isRead', 'hasAttachments', 'body',
            'bodyPreview', 'importance', 'categories', 'internetMessageId'
        ]
        
        params = {
            '$filter': filter_query,
            '$select': ','.join(select_fields),
            '$orderby': 'receivedDateTime desc',
            '$top': self.config.page_size
        }
        
        endpoint = f"users/{self.config.user_id}/messages"
        next_url = None
        page_count = 0
        
        self.logger.info(f"Retrieving emails from {start_date} to {end_date}")
        
        try:
            while True:
                page_count += 1
                
                if next_url:
                    # Use the next URL for pagination
                    response = await self._make_graph_request(next_url.split('/v1.0/')[-1])
                else:
                    # First request
                    response = await self._make_graph_request(endpoint, params)
                
                page_emails = response.get('value', [])
                self.logger.info(f"Retrieved page {page_count} with {len(page_emails)} emails")
                
                # Filter out duplicates and transform emails
                for email_data in page_emails:
                    graph_id = email_data.get('id')
                    
                    if graph_id in existing_message_ids:
                        self.stats['duplicates_skipped'] += 1
                        continue
                    
                    # Transform email to our format (IEMS batch format)
                    transformed_email = self._transform_graph_email(email_data)
                    emails.append(transformed_email)
                    existing_message_ids.add(graph_id)  # Prevent duplicates within this run
                
                # Check for next page
                next_url = response.get('@odata.nextLink')
                if not next_url:
                    break
                
                # Safety check to prevent infinite loops
                if page_count > 1000:
                    self.logger.warning(f"Stopping after {page_count} pages for safety")
                    break
        
        except Exception as e:
            self.logger.error(f"Error retrieving emails for {start_date} to {end_date}: {e}")
            raise
        
        self.logger.info(f"Retrieved {len(emails)} new emails from {start_date} to {end_date}")
        return emails
    
    def _transform_graph_email(self, graph_email: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform Microsoft Graph email format to IEMS database format for pipeline compatibility.
        
        This creates emails in the same format as existing batch files so they can be processed
        through the existing enhanced_batch_processor.py and three-phase analysis pipeline.
        
        Args:
            graph_email: Email data from Microsoft Graph API
            
        Returns:
            Transformed email dictionary matching IEMS/batch format
        """
        try:
            # Extract sender information
            sender_data = graph_email.get('sender', {})
            sender_address = sender_data.get('emailAddress', {})
            sender_email = sender_address.get('address', '')
            sender_name = sender_address.get('name', '')
            
            # Extract recipient information in the format used by existing batches
            to_recipients = []
            cc_recipients = []
            bcc_recipients = []
            
            for recipient in graph_email.get('toRecipients', []):
                email_addr = recipient.get('emailAddress', {})
                if email_addr.get('address'):
                    to_recipients.append(email_addr['address'])
            
            for recipient in graph_email.get('ccRecipients', []):
                email_addr = recipient.get('emailAddress', {})
                if email_addr.get('address'):
                    cc_recipients.append(email_addr['address'])
            
            for recipient in graph_email.get('bccRecipients', []):
                email_addr = recipient.get('emailAddress', {})
                if email_addr.get('address'):
                    bcc_recipients.append(email_addr['address'])
            
            # Format recipients like existing batch files
            recipients_dict = {
                "to": to_recipients,
                "cc": cc_recipients,
                "bcc": bcc_recipients
            }
            recipients_json = json.dumps(recipients_dict)
            
            # Extract body content
            body_data = graph_email.get('body', {})
            body_content = body_data.get('content', '')
            body_type = body_data.get('contentType', 'text')
            
            # Extract dates and convert to format used in existing batches
            received_at = graph_email.get('receivedDateTime', '')
            if received_at:
                # Keep the Z format as used in existing batch files
                received_at = received_at  # Already in correct format
            
            # Extract other fields matching batch format
            subject = graph_email.get('subject', '')
            has_attachments = 1 if graph_email.get('hasAttachments', False) else 0
            is_read = 1 if graph_email.get('isRead', False) else 0
            importance = graph_email.get('importance', 'normal')
            
            # Generate a unique ID for this email (similar to IEMS format)
            message_id = graph_email.get('id', str(uuid.uuid4()))
            
            # Create email in format matching existing batch files
            return {
                "MessageID": message_id,
                "Subject": subject,
                "SenderEmail": sender_email,
                "SenderName": sender_name,
                "Recipients": recipients_json,
                "ReceivedTime": received_at,
                "FolderPath": "Inbox",  # Default folder since Graph API doesn't specify
                "BodyText": body_content,
                "HasAttachments": has_attachments,
                "Importance": importance,
                "MailboxSource": self.config.user_id,  # Use the configured user ID
                "ThreadID": graph_email.get('conversationId', ''),
                "ConversationID": graph_email.get('conversationId', ''),
                "BodyHTML": body_content if body_type.lower() == 'html' else None,
                "IsRead": is_read,
                "ExtractedAt": datetime.now().isoformat(),
                "AnalyzedAt": None,
                "SuggestedThemes": None,
                "SuggestedCategory": None,
                "KeyPhrases": None,
                "FullAnalysis": None,
                "IsSynthetic": 0,
                "workflow_state": None,
                # Additional metadata for tracking Graph API source
                "_graph_api_metadata": {
                    "original_graph_id": graph_email.get('id'),
                    "retrieved_at": datetime.now().isoformat(),
                    "body_content_type": body_type,
                    "source": "microsoft_graph_api"
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error transforming email {graph_email.get('id', 'unknown')}: {e}")
            raise
    
    def _get_next_batch_number(self) -> int:
        """
        Determine the next batch number for missing email batches.
        
        Returns:
            Next batch number to use
        """
        try:
            # Look for existing batch files
            batch_files = list(self.batch_output_dir.glob("missing_emails_batch_*.json"))
            
            if not batch_files:
                return 1
            
            # Extract batch numbers
            batch_numbers = []
            pattern = re.compile(r'missing_emails_batch_(\d+)\.json')
            
            for file in batch_files:
                match = pattern.match(file.name)
                if match:
                    batch_numbers.append(int(match.group(1)))
            
            return max(batch_numbers) + 1 if batch_numbers else 1
            
        except Exception as e:
            self.logger.error(f"Error determining next batch number: {e}")
            return 1
    
    def _create_batch_file(
        self,
        batch_number: int,
        emails: List[Dict[str, Any]],
        start_date: str,
        end_date: str
    ) -> str:
        """
        Create a batch JSON file for the emails in the same format as existing batch files.
        
        This creates files compatible with the existing enhanced_batch_processor.py
        which expects simple arrays of email objects.
        
        Args:
            batch_number: Batch number
            emails: List of email dictionaries in IEMS format
            start_date: Start date of the batch
            end_date: End date of the batch
            
        Returns:
            Path to created batch file
        """
        # Create filename matching existing pattern but indicating missing emails
        filename = f"missing_emails_batch_{batch_number}.json"
        filepath = self.batch_output_dir / filename
        
        try:
            # Save as simple array like existing batch files
            # The enhanced_batch_processor will handle the complex formatting
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(emails, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Created batch file: {filepath} with {len(emails)} emails ({start_date} to {end_date})")
            self.stats['batches_created'] += 1
            
            # Also create a metadata file for tracking
            metadata_file = filepath.with_suffix('.metadata.json')
            metadata = {
                "batch_number": batch_number,
                "start_date": start_date,
                "end_date": end_date,
                "email_count": len(emails),
                "created_at": datetime.now().isoformat(),
                "missing_date_ranges": self.missing_date_ranges,
                "retrieval_stats": dict(self.stats),
                "source": "microsoft_graph_api",
                "compatible_with": "enhanced_batch_processor.py",
                "next_step": "Process through three-phase analysis pipeline"
            }
            
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            return str(filepath)
            
        except Exception as e:
            self.logger.error(f"Error creating batch file {filepath}: {e}")
            raise
    
    async def retrieve_all_missing_emails(self) -> List[str]:
        """
        Retrieve all missing emails for the defined date ranges.
        
        Returns:
            List of created batch file paths
        """
        created_files = []
        start_time = time.time()
        
        self.logger.info("Starting missing email retrieval process")
        self.logger.info(f"Missing date ranges: {self.missing_date_ranges}")
        
        try:
            # Initialize HTTP session
            connector = aiohttp.TCPConnector(limit=10, limit_per_host=5)
            self.session = aiohttp.ClientSession(connector=connector)
            
            # Get existing Message IDs to avoid duplicates
            existing_message_ids = self._get_existing_message_ids()
            self.logger.info(f"Found {len(existing_message_ids)} existing emails across all sources")
            
            # Process each date range
            all_emails = []
            
            for start_date, end_date in self.missing_date_ranges:
                self.logger.info(f"Processing date range: {start_date} to {end_date}")
                
                try:
                    range_emails = await self._retrieve_emails_for_date_range(
                        start_date, end_date, existing_message_ids
                    )
                    all_emails.extend(range_emails)
                    self.stats['emails_retrieved'] += len(range_emails)
                    
                    self.logger.info(
                        f"Range {start_date} to {end_date}: {len(range_emails)} emails retrieved"
                    )
                    
                except Exception as e:
                    self.logger.error(f"Error processing range {start_date} to {end_date}: {e}")
                    continue  # Continue with next range
            
            if not all_emails:
                self.logger.info("No new emails found to process")
                return created_files
            
            # Create batch files
            self.logger.info(f"Creating batch files for {len(all_emails)} emails")
            
            batch_number = self._get_next_batch_number()
            
            for i in range(0, len(all_emails), self.config.batch_size):
                batch_emails = all_emails[i:i + self.config.batch_size]
                
                # Determine date range for this batch
                batch_dates = [email['ReceivedTime'][:10] for email in batch_emails if email.get('ReceivedTime')]
                batch_start = min(batch_dates) if batch_dates else 'unknown'
                batch_end = max(batch_dates) if batch_dates else 'unknown'
                
                batch_file = self._create_batch_file(
                    batch_number, batch_emails, batch_start, batch_end
                )
                created_files.append(batch_file)
                batch_number += 1
            
        except Exception as e:
            self.logger.error(f"Error in retrieve_all_missing_emails: {e}")
            raise
        
        finally:
            # Close HTTP session
            if self.session:
                await self.session.close()
        
        elapsed_time = time.time() - start_time
        
        # Log final statistics
        self.logger.info("Missing email retrieval completed")
        self.logger.info(f"Processing time: {elapsed_time:.2f} seconds")
        self.logger.info(f"Statistics: {self.stats}")
        self.logger.info(f"Batch files created: {len(created_files)}")
        
        return created_files
    
    def get_retrieval_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about the retrieval process.
        
        Returns:
            Dictionary with retrieval statistics
        """
        return {
            'missing_date_ranges': self.missing_date_ranges,
            'total_missing_days': sum(
                (datetime.strptime(end, '%Y-%m-%d') - datetime.strptime(start, '%Y-%m-%d')).days + 1
                for start, end in self.missing_date_ranges
            ),
            'stats': dict(self.stats),
            'config': {
                'batch_size': self.config.batch_size,
                'page_size': self.config.page_size,
                'max_retries': self.config.max_retries,
                'rate_limit_delay': self.config.rate_limit_delay
            },
            'batch_output_dir': str(self.batch_output_dir),
            'database_path': self.crewai_db_path
        }


async def main():
    """
    Main function for the missing email retriever.
    """
    import argparse
    
    # Setup argument parser
    parser = argparse.ArgumentParser(
        description="Microsoft Graph API Missing Email Retriever for CrewAI Team"
    )
    parser.add_argument('--tenant-id', required=True, help='Azure AD Tenant ID')
    parser.add_argument('--client-id', required=True, help='Azure AD Application Client ID')
    parser.add_argument('--client-secret', required=True, help='Azure AD Application Client Secret')
    parser.add_argument('--user-id', required=True, help='Email address or User ID to retrieve from')
    parser.add_argument('--batch-size', type=int, default=50, help='Emails per batch file')
    parser.add_argument('--page-size', type=int, default=100, help='Emails per API request')
    parser.add_argument('--output-dir', default='/home/pricepro2006/CrewAI_Team/data/missing_email_batches', help='Output directory for batch files')
    parser.add_argument('--crewai-db', default='/home/pricepro2006/CrewAI_Team/data/crewai.db', help='Path to CrewAI database')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], default='INFO', help='Logging level')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making API calls')
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create configuration
    config = GraphAPIConfig(
        tenant_id=args.tenant_id,
        client_id=args.client_id,
        client_secret=args.client_secret,
        user_id=args.user_id,
        batch_size=args.batch_size,
        page_size=args.page_size
    )
    
    # Create retriever instance
    retriever = MissingEmailRetriever(
        config=config,
        crewai_db_path=args.crewai_db,
        batch_output_dir=args.output_dir
    )
    
    if args.dry_run:
        print("DRY RUN MODE - No API calls will be made")
        stats = retriever.get_retrieval_statistics()
        print(f"Would process {stats['total_missing_days']} missing days")
        print(f"Missing date ranges: {stats['missing_date_ranges']}")
        print(f"Batch configuration: {stats['config']}")
        return
    
    try:
        # Run the retrieval process
        created_files = await retriever.retrieve_all_missing_emails()
        
        # Print summary
        stats = retriever.get_retrieval_statistics()
        print(f"\nMissing Email Retrieval Summary:")
        print(f"Created batch files: {len(created_files)}")
        print(f"Total emails retrieved: {stats['stats']['emails_retrieved']}")
        print(f"API calls made: {stats['stats']['api_calls']}")
        print(f"Rate limit hits: {stats['stats']['rate_limit_hits']}")
        print(f"Duplicates skipped: {stats['stats']['duplicates_skipped']}")
        print(f"Errors encountered: {stats['stats']['errors']}")
        
        if created_files:
            print(f"\nBatch files created:")
            for file in created_files[:5]:  # Show first 5
                print(f"  - {file}")
            if len(created_files) > 5:
                print(f"  ... and {len(created_files) - 5} more files")
        
    except Exception as e:
        logging.error(f"Error in main process: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())