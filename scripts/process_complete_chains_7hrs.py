#!/usr/bin/env python3
"""
Process complete email chains (completeness >= 0.7) for 7 hours straight
Prioritizes complete chains for maximum business intelligence extraction
"""

import sys
import json
import sqlite3
import time
import logging
from datetime import datetime, timedelta
sys.path.append('scripts')
from claude_opus_llm_processor import ClaudeOpusLLMProcessor

# Setup enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('./logs/email_processing_7hr.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ContinuousEmailProcessor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.processor = ClaudeOpusLLMProcessor(db_path)
        self.start_time = datetime.now()
        self.end_time = self.start_time + timedelta(hours=7)
        self.stats = {
            'total_processed': 0,
            'complete_chains': 0,
            'incomplete_chains': 0,
            'high_priority': 0,
            'total_value': 0,
            'total_actions': 0,
            'errors': 0,
            'timeouts': 0
        }
        
    def get_high_completeness_emails(self, limit: int = 50) -> list:
        """Get emails with high chain completeness scores first"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                # First try to get complete chains (>= 0.7) that haven't been processed with LLM
                cursor = conn.execute("""
                    SELECT id, subject, body_content, chain_completeness_score,
                           sender_email, received_date_time
                    FROM emails_enhanced 
                    WHERE (phase2_result IS NULL OR phase2_result = '' OR phase2_result NOT LIKE '%llama_3_2%')
                    AND chain_completeness_score >= 0.7
                    ORDER BY chain_completeness_score DESC, received_date_time DESC
                    LIMIT ?
                """, (limit,))
                
                complete_chains = [dict(row) for row in cursor.fetchall()]
                
                if len(complete_chains) < limit:
                    # Get some incomplete chains too
                    remaining = limit - len(complete_chains)
                    cursor = conn.execute("""
                        SELECT id, subject, body_content, chain_completeness_score,
                               sender_email, received_date_time
                        FROM emails_enhanced 
                        WHERE (phase2_result IS NULL OR phase2_result = '' OR phase2_result NOT LIKE '%llama_3_2%')
                        AND chain_completeness_score < 0.7
                        AND chain_completeness_score IS NOT NULL
                        ORDER BY chain_completeness_score DESC
                        LIMIT ?
                    """, (remaining,))
                    
                    incomplete_chains = [dict(row) for row in cursor.fetchall()]
                    return complete_chains + incomplete_chains
                
                return complete_chains
                
        except Exception as e:
            logger.error(f"Failed to get emails: {e}")
            return []
    
    def save_processing_log(self, email_id: str, result: dict):
        """Save detailed processing log for analysis"""
        try:
            log_entry = {
                'email_id': email_id,
                'timestamp': datetime.now().isoformat(),
                'phase': result.get('phase'),
                'method': result.get('method'),
                'processing_time': result.get('processing_time', 0),
                'workflow_type': result.get('workflow_analysis', {}).get('type'),
                'priority': result.get('workflow_analysis', {}).get('priority'),
                'estimated_value': result.get('business_intelligence', {}).get('estimated_value', 0),
                'action_items': len(result.get('actionable_items', [])),
                'confidence': result.get('confidence', 0)
            }
            
            with open('./logs/processing_details.jsonl', 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
                
        except Exception as e:
            logger.error(f"Failed to save processing log: {e}")
    
    def process_continuously(self):
        """Process emails continuously for 7 hours"""
        logger.info("="*80)
        logger.info("🚀 Starting 7-hour continuous email processing")
        logger.info(f"Start time: {self.start_time}")
        logger.info(f"End time: {self.end_time}")
        logger.info("Prioritizing complete email chains (score >= 0.7)")
        logger.info("="*80)
        
        batch_size = 20  # Process 20 at a time
        batch_num = 0
        
        while datetime.now() < self.end_time:
            batch_num += 1
            
            # Get next batch of emails
            emails = self.get_high_completeness_emails(batch_size)
            if not emails:
                logger.info("No more pending emails. Waiting 5 minutes...")
                time.sleep(300)  # Wait 5 minutes then check again
                continue
            
            logger.info(f"\n📦 Batch {batch_num}: Processing {len(emails)} emails")
            complete_in_batch = sum(1 for e in emails if e['chain_completeness_score'] >= 0.7)
            logger.info(f"  Complete chains: {complete_in_batch}")
            logger.info(f"  Incomplete chains: {len(emails) - complete_in_batch}")
            
            # Process each email
            for i, email in enumerate(emails, 1):
                # Check if we've exceeded time limit
                if datetime.now() >= self.end_time:
                    logger.info("⏰ 7-hour time limit reached. Stopping processing.")
                    break
                
                try:
                    logger.info(f"\n🔄 Processing {i}/{len(emails)}: {email['subject'][:60]}...")
                    logger.info(f"  Chain score: {email['chain_completeness_score']:.3f}")
                    
                    # Process email
                    result = self.processor.process_email(email)
                    
                    if result:
                        # Update stats
                        self.stats['total_processed'] += 1
                        if email['chain_completeness_score'] >= 0.7:
                            self.stats['complete_chains'] += 1
                        else:
                            self.stats['incomplete_chains'] += 1
                        
                        # Extract key metrics
                        wa = result.get('workflow_analysis', {})
                        if wa.get('priority') == 'High':
                            self.stats['high_priority'] += 1
                        
                        bi = result.get('business_intelligence', {})
                        estimated_value = bi.get('estimated_value', 0)
                        if estimated_value is not None:
                            self.stats['total_value'] += estimated_value
                        self.stats['total_actions'] += len(result.get('actionable_items', []))
                        
                        # Log results
                        logger.info(f"  ✅ Processed successfully")
                        logger.info(f"  Workflow: {wa.get('type')} - {wa.get('priority')}")
                        logger.info(f"  Actions: {len(result.get('actionable_items', []))}")
                        if bi.get('estimated_value', 0) > 0:
                            logger.info(f"  💰 Value: ${bi.get('estimated_value'):,.2f}")
                        
                        # Save to database
                        self.processor.update_database([result])
                        
                        # Save detailed log
                        self.save_processing_log(email['id'], result)
                        
                        # Update phase result
                        phase_result = {
                            'method': result['method'],
                            'confidence': result.get('confidence', 0),
                            'processing_time': result.get('processing_time', 0),
                            'timestamp': datetime.now().isoformat()
                        }
                        
                        with sqlite3.connect(self.db_path) as conn:
                            if result['phase'] == 2:
                                conn.execute("""
                                    UPDATE emails_enhanced 
                                    SET phase2_result = ?
                                    WHERE id = ?
                                """, (json.dumps(phase_result), email['id']))
                            elif result['phase'] == 3:
                                conn.execute("""
                                    UPDATE emails_enhanced 
                                    SET phase3_result = ?
                                    WHERE id = ?
                                """, (json.dumps(phase_result), email['id']))
                            conn.commit()
                        
                    else:
                        self.stats['errors'] += 1
                        logger.error(f"  ❌ Failed to process email")
                    
                    # Rate limiting to avoid overwhelming Ollama
                    time.sleep(2)
                    
                except Exception as e:
                    self.stats['errors'] += 1
                    logger.error(f"  ❌ Error: {str(e)}")
                    continue
            
            # Show progress every batch
            self.show_progress()
            
        # Final summary
        self.show_final_summary()
    
    def show_progress(self):
        """Show current processing progress"""
        elapsed = datetime.now() - self.start_time
        remaining = self.end_time - datetime.now()
        
        logger.info("\n" + "="*60)
        logger.info("📊 PROGRESS UPDATE")
        logger.info("="*60)
        logger.info(f"Elapsed time: {elapsed}")
        logger.info(f"Remaining time: {remaining}")
        logger.info(f"Total processed: {self.stats['total_processed']}")
        logger.info(f"  Complete chains: {self.stats['complete_chains']}")
        logger.info(f"  Incomplete chains: {self.stats['incomplete_chains']}")
        logger.info(f"High priority: {self.stats['high_priority']}")
        logger.info(f"Total actions generated: {self.stats['total_actions']}")
        logger.info(f"Total value identified: ${self.stats['total_value']:,.2f}")
        
        if self.stats['total_processed'] > 0:
            rate = self.stats['total_processed'] / (elapsed.total_seconds() / 60)
            logger.info(f"Processing rate: {rate:.1f} emails/minute")
            
            # Estimate completion
            remaining_emails = 132000 - self.stats['total_processed']
            est_time = remaining_emails / rate / 60  # hours
            logger.info(f"Estimated time to process all: {est_time:.1f} hours")
        
        logger.info("="*60 + "\n")
    
    def show_final_summary(self):
        """Show final processing summary"""
        total_time = datetime.now() - self.start_time
        
        logger.info("\n" + "="*80)
        logger.info("🏁 FINAL PROCESSING SUMMARY")
        logger.info("="*80)
        logger.info(f"Total processing time: {total_time}")
        logger.info(f"Emails processed: {self.stats['total_processed']}")
        logger.info(f"  Complete chains: {self.stats['complete_chains']}")
        logger.info(f"  Incomplete chains: {self.stats['incomplete_chains']}")
        logger.info(f"High priority emails: {self.stats['high_priority']}")
        logger.info(f"Total actionable items: {self.stats['total_actions']}")
        logger.info(f"Total estimated value: ${self.stats['total_value']:,.2f}")
        logger.info(f"Errors: {self.stats['errors']}")
        
        if self.stats['total_processed'] > 0:
            logger.info(f"\nAverages:")
            logger.info(f"  Actions per email: {self.stats['total_actions'] / self.stats['total_processed']:.1f}")
            logger.info(f"  Processing rate: {self.stats['total_processed'] / (total_time.total_seconds() / 60):.1f} emails/minute")
            logger.info(f"  High priority rate: {self.stats['high_priority'] / self.stats['total_processed'] * 100:.1f}%")
        
        # Update global stats
        with sqlite3.connect(self.db_path) as conn:
            llama_count = conn.execute("""
                SELECT COUNT(*) FROM emails_enhanced 
                WHERE phase2_result LIKE '%llama_3_2%'
            """).fetchone()[0]
            
            logger.info(f"\n📈 TOTAL LLM PROCESSED: {llama_count} emails")
            logger.info(f"Progress: {llama_count / 132084 * 100:.2f}% of marked emails")
        
        logger.info("="*80)

# Main execution
if __name__ == "__main__":
    # Create logs directory
    import os
    os.makedirs('./logs', exist_ok=True)
    
    # Start processing
    processor = ContinuousEmailProcessor('./data/crewai_enhanced.db')
    processor.process_continuously()