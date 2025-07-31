#!/usr/bin/env python3
"""
Run comprehensive deep extraction for all mailboxes
This script processes all mailboxes defined in mailboxes.json with deep folder discovery
"""

import os
import sys
import json
import time
import subprocess
import logging
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/iems_project/comprehensive_extraction.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ComprehensiveExtractionManager:
    def __init__(self):
        self.base_dir = '/home/pricepro2006/iems_project'
        self.mailboxes_config = os.path.join(self.base_dir, 'config', 'mailboxes.json')
        self.db_path = os.path.join(self.base_dir, 'data', 'email_analysis.db')
        self.extractor_script = os.path.join(self.base_dir, 'comprehensive_deep_extractor.py')
        self.results = {}
        
    def load_mailboxes(self):
        """Load mailbox configuration"""
        try:
            with open(self.mailboxes_config, 'r') as f:
                mailboxes = json.load(f)
            
            logger.info(f"Loaded {len(mailboxes)} mailboxes from configuration")
            return mailboxes
            
        except Exception as e:
            logger.error(f"Failed to load mailboxes configuration: {e}")
            raise
    
    def check_prerequisites(self):
        """Check that all required files exist"""
        required_files = [
            self.mailboxes_config,
            self.extractor_script,
            os.path.join(self.base_dir, 'msal_device_auth.py'),
            os.path.join(self.base_dir, 'graph_connector.py')
        ]
        
        missing_files = []
        for file_path in required_files:
            if not os.path.exists(file_path):
                missing_files.append(file_path)
        
        if missing_files:
            logger.error(f"Missing required files: {missing_files}")
            raise FileNotFoundError(f"Missing files: {missing_files}")
        
        logger.info("All prerequisite files found")
    
    def extract_single_mailbox(self, mailbox_config: dict, start_date: str = None) -> dict:
        """Extract emails from a single mailbox"""
        mailbox_email = mailbox_config['email']
        mailbox_name = mailbox_config.get('name', mailbox_email)
        
        logger.info(f"🚀 Starting extraction for {mailbox_name} ({mailbox_email})")
        
        start_time = datetime.now()
        result = {
            'mailbox_email': mailbox_email,
            'mailbox_name': mailbox_name,
            'start_time': start_time.isoformat(),
            'status': 'running',
            'emails_extracted': 0,
            'folders_processed': 0,
            'error': None
        }
        
        try:
            # Build command
            cmd = [
                'python3', self.extractor_script,
                '--mailbox', mailbox_email,
                '--db-path', self.db_path,
                '--resume'
            ]
            
            if start_date:
                cmd.extend(['--start-date', start_date])
            
            # Run extraction
            logger.info(f"Running command: {' '.join(cmd)}")
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=21600  # 6 hour timeout per mailbox (enough for 100k emails)
            )
            
            # Parse results from output
            output = process.stdout
            if process.returncode == 0:
                result['status'] = 'completed'
                
                # Extract statistics from output - look for actual format
                for line in output.split('\n'):
                    if 'SUCCESS: Extracted' in line and 'emails from' in line:
                        try:
                            # Parse: "✅ SUCCESS: Extracted 22300 emails from mailbox@example.com"
                            parts = line.split('Extracted')[1].split('emails from')
                            result['emails_extracted'] = int(parts[0].strip())
                        except:
                            pass
                
                # Get folder count from progress file
                try:
                    progress_file = os.path.join(self.base_dir, f"deep_extraction_progress_{mailbox_email.replace('@', '_at_').replace('.', '_')}.json")
                    if os.path.exists(progress_file):
                        with open(progress_file, 'r') as f:
                            progress_data = json.load(f)
                        result['folders_processed'] = len(progress_data.get('processed_folders', []))
                except:
                    pass
                
                logger.info(f"✅ Completed {mailbox_name}: {result['emails_extracted']} emails, {result['folders_processed']} folders")
                
            else:
                result['status'] = 'failed'
                result['error'] = process.stderr
                logger.error(f"❌ Failed {mailbox_name}: {process.stderr}")
        
        except subprocess.TimeoutExpired:
            result['status'] = 'timeout'
            result['error'] = 'Extraction timed out after 2 hours'
            logger.error(f"⏰ Timeout {mailbox_name}: Extraction took too long")
            
        except Exception as e:
            result['status'] = 'error'
            result['error'] = str(e)
            logger.error(f"💥 Error {mailbox_name}: {e}")
        
        # Calculate duration
        end_time = datetime.now()
        result['end_time'] = end_time.isoformat()
        result['duration_minutes'] = (end_time - start_time).total_seconds() / 60
        
        return result
    
    def run_all_extractions(self, start_date: str = None, max_workers: int = 1):
        """Run extraction for all mailboxes"""
        logger.info("🚀 Starting comprehensive extraction for all mailboxes")
        
        try:
            # Check prerequisites
            self.check_prerequisites()
            
            # Load mailboxes
            mailboxes = self.load_mailboxes()
            
            # Sort by priority (high priority first)
            mailboxes.sort(key=lambda x: 0 if x.get('priority') == 'high' else 1)
            
            logger.info(f"📊 EXTRACTION PLAN:")
            logger.info(f"  📧 Total mailboxes: {len(mailboxes)}")
            logger.info(f"  🗓️ Start date filter: {start_date or 'No filter (all emails)'}")
            logger.info(f"  🔄 Max concurrent extractions: {max_workers}")
            
            # Process mailboxes
            if max_workers == 1:
                # Sequential processing for stability
                for i, mailbox in enumerate(mailboxes, 1):
                    logger.info(f"\n📂 [{i}/{len(mailboxes)}] Processing {mailbox['name']} ({mailbox['email']})")
                    result = self.extract_single_mailbox(mailbox, start_date)
                    self.results[mailbox['email']] = result
                    
                    # Add delay between mailboxes to avoid rate limiting
                    if i < len(mailboxes):
                        logger.info("⏱️  Waiting 30 seconds before next mailbox...")
                        time.sleep(30)
            else:
                # Parallel processing (use with caution)
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    future_to_mailbox = {
                        executor.submit(self.extract_single_mailbox, mailbox, start_date): mailbox
                        for mailbox in mailboxes
                    }
                    
                    for future in as_completed(future_to_mailbox):
                        mailbox = future_to_mailbox[future]
                        try:
                            result = future.result()
                            self.results[mailbox['email']] = result
                        except Exception as e:
                            logger.error(f"Exception in parallel extraction for {mailbox['email']}: {e}")
            
            # Generate summary
            self.generate_final_summary()
            
        except Exception as e:
            logger.error(f"Comprehensive extraction failed: {e}")
            raise
    
    def generate_final_summary(self):
        """Generate and display final extraction summary"""
        total_emails = sum(r.get('emails_extracted', 0) for r in self.results.values())
        total_folders = sum(r.get('folders_processed', 0) for r in self.results.values())
        successful = sum(1 for r in self.results.values() if r.get('status') == 'completed')
        failed = len(self.results) - successful
        
        total_duration = sum(r.get('duration_minutes', 0) for r in self.results.values())
        
        logger.info(f"\n🎉 COMPREHENSIVE EXTRACTION SUMMARY:")
        logger.info(f"  📧 Total emails extracted: {total_emails:,}")
        logger.info(f"  📁 Total folders processed: {total_folders}")
        logger.info(f"  ✅ Successful mailboxes: {successful}")
        logger.info(f"  ❌ Failed mailboxes: {failed}")
        logger.info(f"  ⏱️  Total time: {total_duration:.1f} minutes")
        if total_duration > 0:
            logger.info(f"  📈 Average rate: {total_emails/(total_duration):.1f} emails/minute")
        
        # Detailed results
        logger.info(f"\n📊 DETAILED RESULTS:")
        for email, result in self.results.items():
            status_emoji = "✅" if result['status'] == 'completed' else "❌"
            logger.info(f"  {status_emoji} {result['mailbox_name']} ({email}): {result['emails_extracted']:,} emails, {result['folders_processed']} folders")
            if result.get('error'):
                logger.info(f"    Error: {result['error'][:100]}...")
        
        # Save detailed results
        summary_file = os.path.join(self.base_dir, 'comprehensive_extraction_summary.json')
        summary_data = {
            'extraction_date': datetime.now().isoformat(),
            'total_emails': total_emails,
            'total_folders': total_folders,
            'successful_mailboxes': successful,
            'failed_mailboxes': failed,
            'total_duration_minutes': total_duration,
            'average_emails_per_minute': total_emails/total_duration if total_duration > 0 else 0,
            'mailbox_results': self.results
        }
        
        with open(summary_file, 'w') as f:
            json.dump(summary_data, f, indent=2)
        
        logger.info(f"  💾 Detailed summary saved to: {summary_file}")
        
        # Expected vs actual comparison
        logger.info(f"\n📈 EXTRACTION ANALYSIS:")
        if total_emails < 50000:
            logger.warning(f"  ⚠️  Total emails ({total_emails:,}) is less than expected (200,000+)")
            logger.info(f"     This may indicate incomplete extraction or limited date range")
        else:
            logger.info(f"  🎯 Extraction appears comprehensive with {total_emails:,} emails")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Run comprehensive deep extraction for all mailboxes')
    parser.add_argument('--start-date', help='Start date for extraction (ISO format, e.g., 2024-01-01T00:00:00Z)')
    parser.add_argument('--workers', type=int, default=1, help='Number of concurrent extractions (default: 1 for stability)')
    parser.add_argument('--test-mode', action='store_true', help='Test mode: only process first mailbox')
    
    args = parser.parse_args()
    
    manager = ComprehensiveExtractionManager()
    
    try:
        if args.test_mode:
            logger.info("🧪 Running in TEST MODE - processing only first mailbox")
            mailboxes = manager.load_mailboxes()
            if mailboxes:
                result = manager.extract_single_mailbox(mailboxes[0], args.start_date)
                manager.results[mailboxes[0]['email']] = result
                manager.generate_final_summary()
        else:
            manager.run_all_extractions(args.start_date, args.workers)
        
        print(f"\n✅ SUCCESS: Comprehensive extraction completed")
        return 0
        
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())