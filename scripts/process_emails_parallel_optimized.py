#!/usr/bin/env python3
"""
Optimized Parallel Email Processing with Claude Opus-Level LLM
Maintains premium quality while achieving 3-4x throughput
"""

import sys
import json
import sqlite3
import asyncio
import aiohttp
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from queue import Queue
import threading

sys.path.append('scripts')
from claude_opus_llm_processor import ClaudeOpusLLMProcessor

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(threadName)s] - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('./logs/parallel_processing.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ProcessingStats:
    """Thread-safe statistics tracking"""
    def __init__(self):
        self.lock = threading.Lock()
        self.total_processed = 0
        self.complete_chains = 0
        self.incomplete_chains = 0
        self.high_priority = 0
        self.total_value = 0.0
        self.total_actions = 0
        self.errors = 0
        self.start_time = datetime.now()
        self.processing_times = []
    
    def update(self, **kwargs):
        with self.lock:
            for key, value in kwargs.items():
                if hasattr(self, key):
                    if key == 'processing_times':
                        self.processing_times.extend(value)
                    else:
                        current = getattr(self, key)
                        setattr(self, key, current + value)

class OptimizedDatabasePool:
    """Connection pool for concurrent database access"""
    def __init__(self, db_path: str, pool_size: int = 5):
        self.db_path = db_path
        self.pool_size = pool_size
        self.connections = Queue(maxsize=pool_size)
        
        # Initialize connection pool
        for _ in range(pool_size):
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            
            # Optimize SQLite for concurrent access
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("PRAGMA synchronous = NORMAL")
            conn.execute("PRAGMA cache_size = -64000")  # 64MB cache
            conn.execute("PRAGMA temp_store = MEMORY")
            conn.execute("PRAGMA mmap_size = 268435456")  # 256MB mmap
            
            self.connections.put(conn)
    
    def get_connection(self):
        """Get a connection from the pool"""
        return self.connections.get()
    
    def return_connection(self, conn):
        """Return a connection to the pool"""
        self.connections.put(conn)
    
    def close_all(self):
        """Close all connections"""
        while not self.connections.empty():
            conn = self.connections.get()
            conn.close()

class ParallelEmailProcessor:
    def __init__(self, db_path: str, parallel_workers: int = 3, hours_to_run: int = 7):
        self.db_path = db_path
        self.parallel_workers = parallel_workers
        self.hours_to_run = hours_to_run
        self.db_pool = OptimizedDatabasePool(db_path, pool_size=parallel_workers + 2)
        self.stats = ProcessingStats()
        self.end_time = datetime.now() + timedelta(hours=hours_to_run)
        
        # Create worker processors
        self.processors = [
            ClaudeOpusLLMProcessor(db_path) 
            for _ in range(parallel_workers)
        ]
        
        # Thread pool for parallel execution
        self.executor = ThreadPoolExecutor(max_workers=parallel_workers)
        
        logger.info(f"🚀 Initialized parallel processor with {parallel_workers} workers")
    
    def get_pending_emails_batch(self, batch_size: int = 20) -> List[Dict]:
        """Get a batch of pending emails with optimized query"""
        conn = self.db_pool.get_connection()
        try:
            cursor = conn.execute("""
                SELECT id, subject, body_content, chain_completeness_score,
                       sender_email, received_date_time
                FROM emails_enhanced 
                WHERE (phase2_result IS NULL OR phase2_result = '' 
                       OR phase2_result NOT LIKE '%llama_3_2%')
                AND chain_completeness_score >= 0.7
                ORDER BY chain_completeness_score DESC, received_date_time DESC
                LIMIT ?
            """, (batch_size,))
            
            return [dict(row) for row in cursor.fetchall()]
        finally:
            self.db_pool.return_connection(conn)
    
    def process_email_worker(self, worker_id: int, email: Dict) -> Optional[Dict]:
        """Worker function to process a single email"""
        processor = self.processors[worker_id]
        thread_name = f"Worker-{worker_id}"
        
        try:
            logger.info(f"[{thread_name}] Processing: {email['subject'][:60]}...")
            
            start_time = time.time()
            result = processor.process_email(email)
            processing_time = time.time() - start_time
            
            if result:
                # Extract stats
                wa = result.get('workflow_analysis', {})
                bi = result.get('business_intelligence', {})
                
                self.stats.update(
                    total_processed=1,
                    complete_chains=1 if email['chain_completeness_score'] >= 0.7 else 0,
                    high_priority=1 if wa.get('priority') in ['High', 'Critical'] else 0,
                    total_value=bi.get('estimated_value', 0) or 0,
                    total_actions=len(result.get('actionable_items', [])),
                    processing_times=[processing_time]
                )
                
                # Update database
                self.update_database_concurrent([result])
                
                logger.info(f"[{thread_name}] ✅ Completed in {processing_time:.1f}s - "
                           f"Priority: {wa.get('priority')} - "
                           f"Value: ${bi.get('estimated_value', 0):,.2f}")
                
                return result
            else:
                self.stats.update(errors=1)
                logger.error(f"[{thread_name}] ❌ Failed to process email")
                return None
                
        except Exception as e:
            self.stats.update(errors=1)
            logger.error(f"[{thread_name}] ❌ Error: {str(e)}")
            return None
    
    def update_database_concurrent(self, results: List[Dict]):
        """Update database with thread-safe connection from pool"""
        if not results:
            return
        
        conn = self.db_pool.get_connection()
        try:
            for result in results:
                if not result:
                    continue
                
                # Prepare phase result
                phase_result = {
                    'method': result['method'],
                    'confidence': result.get('confidence', 0),
                    'processing_time': result.get('processing_time', 0),
                    'timestamp': datetime.now().isoformat()
                }
                
                # Update main record
                conn.execute("""
                    UPDATE emails_enhanced 
                    SET status = 'analyzed',
                        phase_completed = ?,
                        extracted_entities = ?,
                        workflow_state = ?,
                        analyzed_at = ?,
                        phase2_result = ?
                    WHERE id = ?
                """, (
                    result['phase'],
                    json.dumps(result.get('entities', {})),
                    json.dumps(result.get('workflow_analysis', {})),
                    result.get('processed_at'),
                    json.dumps(phase_result),
                    result['email_id']
                ))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Database update error: {e}")
            conn.rollback()
        finally:
            self.db_pool.return_connection(conn)
    
    async def process_batch_async(self, emails: List[Dict]):
        """Process a batch of emails in parallel"""
        futures = []
        
        # Submit tasks to thread pool
        for i, email in enumerate(emails[:self.parallel_workers]):
            worker_id = i % self.parallel_workers
            future = self.executor.submit(
                self.process_email_worker, 
                worker_id, 
                email
            )
            futures.append(future)
        
        # Wait for all to complete
        results = []
        for future in futures:
            try:
                result = future.result(timeout=120)  # 2 minute timeout
                if result:
                    results.append(result)
            except Exception as e:
                logger.error(f"Future execution error: {e}")
                self.stats.update(errors=1)
        
        return results
    
    def show_progress(self):
        """Display current processing statistics"""
        elapsed = datetime.now() - self.stats.start_time
        remaining = self.end_time - datetime.now()
        
        # Calculate rates
        if self.stats.total_processed > 0:
            avg_time = sum(self.stats.processing_times) / len(self.stats.processing_times)
            rate = self.stats.total_processed / (elapsed.total_seconds() / 60)
        else:
            avg_time = 0
            rate = 0
        
        logger.info("\n" + "="*70)
        logger.info("📊 PARALLEL PROCESSING PROGRESS")
        logger.info("="*70)
        logger.info(f"Workers: {self.parallel_workers}")
        logger.info(f"Elapsed: {elapsed}")
        logger.info(f"Remaining: {remaining}")
        logger.info(f"Total processed: {self.stats.total_processed}")
        logger.info(f"  Complete chains: {self.stats.complete_chains}")
        logger.info(f"High priority: {self.stats.high_priority}")
        logger.info(f"Total actions: {self.stats.total_actions}")
        logger.info(f"Total value: ${self.stats.total_value:,.2f}")
        logger.info(f"Errors: {self.stats.errors}")
        
        if rate > 0:
            logger.info(f"\n📈 Performance Metrics:")
            logger.info(f"Processing rate: {rate:.1f} emails/minute")
            logger.info(f"Average time: {avg_time:.1f} seconds/email")
            logger.info(f"Speedup vs sequential: {rate/1.8:.1f}x")
            
            # Project completion
            remaining_emails = 131347  # From previous analysis
            est_hours = remaining_emails / (rate * 60)
            logger.info(f"Estimated time for all emails: {est_hours:.1f} hours ({est_hours/24:.1f} days)")
        
        logger.info("="*70 + "\n")
    
    async def run_optimized_pipeline(self):
        """Main processing loop with parallel execution"""
        logger.info("="*80)
        logger.info(f"🚀 Starting OPTIMIZED {self.hours_to_run}-hour parallel processing")
        logger.info(f"Workers: {self.parallel_workers}")
        logger.info(f"Start time: {self.stats.start_time}")
        logger.info(f"End time: {self.end_time}")
        logger.info("Prioritizing complete email chains (score >= 0.7)")
        logger.info("="*80)
        
        batch_num = 0
        
        while datetime.now() < self.end_time:
            batch_num += 1
            
            # Get emails to process
            batch_size = self.parallel_workers * 3  # Fetch 3x workers for queue
            emails = self.get_pending_emails_batch(batch_size)
            
            if not emails:
                logger.info("No more pending emails. Waiting 5 minutes...")
                await asyncio.sleep(300)
                continue
            
            logger.info(f"\n📦 Batch {batch_num}: Processing {len(emails)} emails")
            
            # Process in parallel chunks
            for i in range(0, len(emails), self.parallel_workers):
                chunk = emails[i:i + self.parallel_workers]
                
                # Check time limit
                if datetime.now() >= self.end_time:
                    logger.info("⏰ Time limit reached. Stopping processing.")
                    break
                
                # Process chunk in parallel
                await self.process_batch_async(chunk)
                
                # Smart rate limiting - only if processing was very fast
                avg_time = (sum(self.stats.processing_times[-len(chunk):]) / len(chunk) 
                           if self.stats.processing_times else 30)
                if avg_time < 15:
                    await asyncio.sleep(max(0, 15 - avg_time))
            
            # Show progress every batch
            self.show_progress()
        
        # Final summary
        self.show_final_summary()
    
    def show_final_summary(self):
        """Display final processing summary"""
        total_time = datetime.now() - self.stats.start_time
        
        logger.info("\n" + "="*80)
        logger.info("🏁 OPTIMIZED PROCESSING FINAL SUMMARY")
        logger.info("="*80)
        logger.info(f"Total processing time: {total_time}")
        logger.info(f"Parallel workers used: {self.parallel_workers}")
        logger.info(f"Emails processed: {self.stats.total_processed}")
        logger.info(f"  Complete chains: {self.stats.complete_chains}")
        logger.info(f"High priority emails: {self.stats.high_priority}")
        logger.info(f"Total actionable items: {self.stats.total_actions}")
        logger.info(f"Total estimated value: ${self.stats.total_value:,.2f}")
        logger.info(f"Errors: {self.stats.errors}")
        
        if self.stats.total_processed > 0:
            rate = self.stats.total_processed / (total_time.total_seconds() / 60)
            avg_time = sum(self.stats.processing_times) / len(self.stats.processing_times)
            
            logger.info(f"\n📊 Performance Analysis:")
            logger.info(f"  Processing rate: {rate:.1f} emails/minute")
            logger.info(f"  Average time per email: {avg_time:.1f} seconds")
            logger.info(f"  Speedup vs sequential: {rate/1.8:.1f}x")
            logger.info(f"  Actions per email: {self.stats.total_actions / self.stats.total_processed:.1f}")
            logger.info(f"  High priority rate: {self.stats.high_priority / self.stats.total_processed * 100:.1f}%")
            logger.info(f"  Success rate: {(1 - self.stats.errors / self.stats.total_processed) * 100:.1f}%")
        
        # Check total progress
        conn = self.db_pool.get_connection()
        try:
            llama_count = conn.execute("""
                SELECT COUNT(*) FROM emails_enhanced 
                WHERE phase2_result LIKE '%llama_3_2%'
            """).fetchone()[0]
            
            logger.info(f"\n📈 CUMULATIVE PROGRESS:")
            logger.info(f"Total LLM processed: {llama_count} emails")
            logger.info(f"Progress: {llama_count / 132084 * 100:.2f}% of target")
            
            remaining = 132084 - llama_count
            if rate > 0:
                est_hours = remaining / (rate * 60)
                logger.info(f"Remaining emails: {remaining}")
                logger.info(f"Estimated time to complete: {est_hours:.1f} hours ({est_hours/24:.1f} days)")
            
        finally:
            self.db_pool.return_connection(conn)
        
        logger.info("="*80)
        
        # Cleanup
        self.executor.shutdown(wait=True)
        self.db_pool.close_all()

# Main execution
async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Optimized parallel email processing')
    parser.add_argument('--workers', type=int, default=3, 
                       help='Number of parallel workers (default: 3)')
    parser.add_argument('--hours', type=int, default=7,
                       help='Hours to run (default: 7)')
    parser.add_argument('--db', type=str, default='./data/crewai_enhanced.db',
                       help='Database path')
    
    args = parser.parse_args()
    
    # Validate worker count
    if args.workers < 1:
        args.workers = 1
    elif args.workers > 5:
        logger.warning("More than 5 workers may cause memory issues. Proceeding with caution.")
    
    # Create logs directory
    import os
    os.makedirs('./logs', exist_ok=True)
    
    # Initialize and run processor
    processor = ParallelEmailProcessor(
        db_path=args.db,
        parallel_workers=args.workers,
        hours_to_run=args.hours
    )
    
    await processor.run_optimized_pipeline()

if __name__ == "__main__":
    # Run with asyncio
    asyncio.run(main())