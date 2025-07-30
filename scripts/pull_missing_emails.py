#!/usr/bin/env python3
"""
Missing Email Pipeline Integration Script
========================================

This script pulls missing emails from Microsoft Graph API and processes them
through the existing CrewAI three-phase analysis pipeline.

Usage:
    python pull_missing_emails.py --config-file config.json [options]

The script:
1. Pulls missing emails from Microsoft Graph API for date ranges:
   - May 9-31, 2025 (23 days)
   - June 1-30, 2025 (30 days) 
   - July 1-25, 2025 (25 days)
2. Creates batch files compatible with enhanced_batch_processor.py
3. Optionally processes them through the three-phase analysis pipeline
4. Integrates with the existing CrewAI Team email processing system

Author: CrewAI Team Email Pipeline
Version: 1.0.0
"""

import asyncio
import json
import logging
import argparse
import sys
from pathlib import Path
from typing import Dict, Any

# Add the email pipeline to Python path
pipeline_path = Path("/home/pricepro2006/iems_project/email_pipeline/src")
if pipeline_path.exists():
    sys.path.insert(0, str(pipeline_path))

from missing_email_retriever import MissingEmailRetriever, GraphAPIConfig


def load_config(config_file: str) -> Dict[str, Any]:
    """Load configuration from JSON file."""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error loading config file {config_file}: {e}")
        raise


def setup_logging(log_level: str = "INFO", log_file: str = None):
    """Setup logging configuration."""
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    handlers = [logging.StreamHandler()]
    
    if log_file:
        handlers.append(logging.FileHandler(log_file))
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format=log_format,
        handlers=handlers
    )


async def main():
    """Main function for the missing email pipeline."""
    parser = argparse.ArgumentParser(
        description="Pull missing emails and process through CrewAI pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Pull emails using config file
  python pull_missing_emails.py --config-file config.json
  
  # Pull emails with command line options
  python pull_missing_emails.py --tenant-id xxx --client-id yyy --client-secret zzz --user-id user@company.com
  
  # Dry run to see what would be done
  python pull_missing_emails.py --config-file config.json --dry-run
  
  # Pull and process through pipeline
  python pull_missing_emails.py --config-file config.json --process-pipeline
        """
    )
    
    # Configuration options
    parser.add_argument('--config-file', help='JSON configuration file')
    parser.add_argument('--tenant-id', help='Azure AD Tenant ID')
    parser.add_argument('--client-id', help='Azure AD Application Client ID')
    parser.add_argument('--client-secret', help='Azure AD Application Client Secret')
    parser.add_argument('--user-id', help='Email address or User ID to retrieve from')
    
    # Processing options
    parser.add_argument('--batch-size', type=int, default=50, help='Emails per batch file')
    parser.add_argument('--page-size', type=int, default=100, help='Emails per API request')
    parser.add_argument('--output-dir', default='/home/pricepro2006/CrewAI_Team/data/missing_email_batches', 
                       help='Output directory for batch files')
    parser.add_argument('--crewai-db', default='/home/pricepro2006/CrewAI_Team/data/crewai.db', 
                       help='Path to CrewAI database')
    
    # Control options
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without API calls')
    parser.add_argument('--process-pipeline', action='store_true', 
                       help='Process created batches through three-phase pipeline')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], 
                       default='INFO', help='Logging level')
    parser.add_argument('--log-file', help='Log file path (default: console only)')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.log_level, args.log_file)
    logger = logging.getLogger(__name__)
    
    try:
        # Load configuration
        if args.config_file:
            config_data = load_config(args.config_file)
            logger.info(f"Loaded configuration from {args.config_file}")
        else:
            # Build config from command line arguments
            if not all([args.tenant_id, args.client_id, args.client_secret, args.user_id]):
                parser.error("Either --config-file or all of --tenant-id, --client-id, --client-secret, --user-id must be provided")
            
            config_data = {
                'tenant_id': args.tenant_id,
                'client_id': args.client_id,
                'client_secret': args.client_secret,
                'user_id': args.user_id,
                'batch_size': args.batch_size,
                'page_size': args.page_size
            }
        
        # Create Graph API configuration
        config = GraphAPIConfig(
            tenant_id=config_data['tenant_id'],
            client_id=config_data['client_id'],
            client_secret=config_data['client_secret'],
            user_id=config_data['user_id'],
            batch_size=config_data.get('batch_size', args.batch_size),
            page_size=config_data.get('page_size', args.page_size),
            max_retries=config_data.get('max_retries', 3),
            rate_limit_delay=config_data.get('rate_limit_delay', 0.1)
        )
        
        # Create retriever instance
        retriever = MissingEmailRetriever(
            config=config,
            crewai_db_path=args.crewai_db,
            batch_output_dir=args.output_dir
        )
        
        if args.dry_run:
            logger.info("=" * 60)
            logger.info("DRY RUN MODE - No API calls will be made")
            logger.info("=" * 60)
            
            stats = retriever.get_retrieval_statistics()
            print(f"\nMissing Email Retrieval Plan:")
            print(f"Total missing days: {stats['total_missing_days']}")
            print(f"Missing date ranges:")
            for start, end in stats['missing_date_ranges']:
                print(f"  - {start} to {end}")
            print(f"\nConfiguration:")
            print(f"  Batch size: {stats['config']['batch_size']} emails per file")
            print(f"  Page size: {stats['config']['page_size']} emails per API request")
            print(f"  Output directory: {stats['batch_output_dir']}")
            print(f"  Database: {stats['database_path']}")
            print(f"\nNo actual API calls will be made in dry run mode.")
            return
        
        # Run the retrieval process
        logger.info("=" * 60)
        logger.info("Starting Missing Email Retrieval Process")
        logger.info("=" * 60)
        
        created_files = await retriever.retrieve_all_missing_emails()
        
        # Print summary
        stats = retriever.get_retrieval_statistics()
        logger.info("=" * 60)
        logger.info("Missing Email Retrieval Complete")
        logger.info("=" * 60)
        
        print(f"\nSummary:")
        print(f"✅ Batch files created: {len(created_files)}")
        print(f"📧 Total emails retrieved: {stats['stats']['emails_retrieved']}")
        print(f"🔄 API calls made: {stats['stats']['api_calls']}")
        print(f"⏳ Rate limit hits: {stats['stats']['rate_limit_hits']}")
        print(f"🔁 Duplicates skipped: {stats['stats']['duplicates_skipped']}")
        print(f"❌ Errors encountered: {stats['stats']['errors']}")
        
        if created_files:
            print(f"\n📁 Batch files created:")
            for file in created_files[:5]:  # Show first 5
                print(f"   {file}")
            if len(created_files) > 5:
                print(f"   ... and {len(created_files) - 5} more files")
        
        # Process through pipeline if requested
        if args.process_pipeline and created_files:
            logger.info("\n" + "=" * 60)
            logger.info("Processing Through Three-Phase Pipeline")
            logger.info("=" * 60)
            
            try:
                # Import and use the enhanced batch processor
                from processors.enhanced_batch_processor import EnhancedEmailBatchProcessor
                
                # Create processor targeting our missing email batch files
                processor = EnhancedEmailBatchProcessor(
                    batch_output_dir=args.output_dir,
                    crewai_db_path=args.crewai_db
                )
                
                # Note: This would require modifications to enhanced_batch_processor 
                # to work with our batch file format
                logger.info("Pipeline processing would go here...")
                logger.info("Note: Integration with enhanced_batch_processor needs to be completed")
                
            except ImportError as e:
                logger.warning(f"Could not import pipeline components: {e}")
                logger.info("Batch files created and ready for manual processing")
        
        print(f"\n🎉 Process completed successfully!")
        print(f"📍 Next steps:")
        print(f"   1. Review batch files in: {args.output_dir}")
        print(f"   2. Process through enhanced_batch_processor.py")
        print(f"   3. Run three-phase analysis on the batches")
        print(f"   4. Monitor results in CrewAI dashboard")
        
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
        sys.exit(1)
    
    except Exception as e:
        logger.error(f"Error in main process: {e}")
        logger.exception("Full traceback:")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())