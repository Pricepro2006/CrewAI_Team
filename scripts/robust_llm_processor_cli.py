#!/usr/bin/env python3
"""
CLI wrapper for Robust LLM Email Processing Pipeline
Provides command-line arguments for deployment configuration
"""

import argparse
import asyncio
import sys
import os

# Add project directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scripts.robust_llm_processor import RobustLLMProcessor
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    """Main entry point with CLI arguments"""
    parser = argparse.ArgumentParser(
        description='Robust LLM Email Processing Pipeline'
    )
    
    parser.add_argument(
        '--db', 
        type=str,
        default='/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db',
        help='Path to database file'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='Number of emails to process in each batch (default: 10)'
    )
    
    parser.add_argument(
        '--continuous',
        action='store_true',
        help='Run continuously until all emails are processed'
    )
    
    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum number of emails to process (for testing)'
    )
    
    parser.add_argument(
        '--phase',
        type=int,
        choices=[1, 2, 3],
        help='Force specific phase processing (for testing)'
    )
    
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Check database exists
    if not os.path.exists(args.db):
        logger.error(f"Database not found: {args.db}")
        sys.exit(1)
    
    logger.info(f"Starting email processing pipeline")
    logger.info(f"Database: {args.db}")
    logger.info(f"Batch size: {args.batch_size}")
    logger.info(f"Mode: {'Continuous' if args.continuous else 'Single run'}")
    
    try:
        async with RobustLLMProcessor(args.db, args.batch_size) as processor:
            # Override phase if specified
            if args.phase:
                processor.force_phase = args.phase
                logger.info(f"Forcing Phase {args.phase} processing")
            
            # Set limit if specified
            if args.limit:
                processor.max_emails = args.limit
                logger.info(f"Processing limit: {args.limit} emails")
            
            # Run the processor
            await processor.run()
            
            # If continuous mode, keep checking for new emails
            if args.continuous:
                logger.info("Running in continuous mode...")
                while not processor.shutdown_requested:
                    await asyncio.sleep(60)  # Check every minute
                    
                    # Check for new pending emails
                    emails = processor.get_pending_emails(1)
                    if emails:
                        logger.info(f"Found {len(emails)} new emails to process")
                        await processor.run()
                    
    except KeyboardInterrupt:
        logger.info("⚠️ Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())