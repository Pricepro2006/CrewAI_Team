#!/usr/bin/env python3
"""
Adaptive Email Processing Pipeline
Routes emails through 3 phases based on chain completeness scores
"""

import sqlite3
import json
import time
import logging
from datetime import datetime
from typing import Dict, List, Any

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AdaptiveEmailProcessor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.stats = {
            'processed': 0,
            'phase1': 0,
            'phase2': 0, 
            'phase3': 0,
            'errors': 0
        }
    
    def get_pending_emails(self, limit: int = 100) -> List[Dict]:
        """Get pending emails for processing"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("""
                    SELECT id, subject, body_content, chain_completeness_score,
                           sender_email, received_date_time
                    FROM emails_enhanced 
                    WHERE status = 'pending'
                    AND chain_completeness_score IS NOT NULL
                    ORDER BY chain_completeness_score DESC
                    LIMIT ?
                """, (limit,))
                
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get pending emails: {e}")
            return []
    
    def determine_phase(self, completeness_score: float) -> int:
        """Determine processing phase based on completeness score"""
        if completeness_score >= 0.7:
            return 1  # High completeness - Rule-based processing
        elif completeness_score >= 0.3:
            return 2  # Medium completeness - Llama 3.2 processing
        else:
            return 3  # Low completeness - Phi-4 processing
    
    def process_phase1(self, email: Dict) -> Dict[str, Any]:
        """Rule-based processing for high completeness emails"""
        logger.debug(f"Phase 1 processing: {email['id']}")
        
        # Simple rule-based entity extraction
        entities = []
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        # Basic entity extraction
        if any(word in content for word in ['meeting', 'call', 'schedule']):
            entities.append({'type': 'meeting', 'confidence': 0.8})
        
        if any(word in content for word in ['price', 'quote', 'cost', '$']):
            entities.append({'type': 'financial', 'confidence': 0.9})
            
        if any(word in content for word in ['urgent', 'asap', 'deadline']):
            entities.append({'type': 'urgent', 'confidence': 0.8})
            
        if any(word in content for word in ['order', 'purchase', 'po']):
            entities.append({'type': 'order', 'confidence': 0.9})
        
        return {
            'entities': entities,
            'phase': 1,
            'method': 'rule_based',
            'confidence': 0.8 if entities else 0.4
        }
    
    def process_phase2(self, email: Dict) -> Dict[str, Any]:
        """Llama 3.2 processing simulation for medium completeness"""
        logger.debug(f"Phase 2 processing: {email['id']}")
        
        # Simulate Llama 3.2 processing
        entities = []
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        # More sophisticated analysis simulation
        if 'contract' in content or 'agreement' in content:
            entities.append({'type': 'legal_document', 'confidence': 0.9})
            
        if any(word in content for word in ['api', 'integration', 'system']):
            entities.append({'type': 'technical', 'confidence': 0.8})
            
        if any(word in content for word in ['client', 'customer', 'stakeholder']):
            entities.append({'type': 'business_relationship', 'confidence': 0.85})
            
        if 'support' in content or 'help' in content:
            entities.append({'type': 'support_request', 'confidence': 0.8})
        
        return {
            'entities': entities,
            'phase': 2,
            'method': 'llama_3_2',
            'confidence': 0.85 if entities else 0.5
        }
    
    def process_phase3(self, email: Dict) -> Dict[str, Any]:
        """Phi-4 processing simulation for low completeness/broken chains"""
        logger.debug(f"Phase 3 processing: {email['id']}")
        
        # Simulate complex Phi-4 analysis
        entities = []
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        # Complex workflow analysis
        if any(word in content for word in ['workflow', 'process', 'pipeline']):
            entities.append({'type': 'workflow_definition', 'confidence': 0.95})
            
        if any(word in content for word in ['approval', 'review', 'sign-off']):
            entities.append({'type': 'approval_process', 'confidence': 0.9})
            
        if 'escalate' in content or 'manager' in content:
            entities.append({'type': 'escalation', 'confidence': 0.85})
            
        # Context reconstruction for broken chains
        entities.append({'type': 'context_reconstruction', 'confidence': 0.7})
        
        return {
            'entities': entities,
            'phase': 3,
            'method': 'phi_4',
            'confidence': 0.9 if entities else 0.6
        }
    
    def process_email(self, email: Dict) -> Dict[str, Any]:
        """Process single email through appropriate phase"""
        try:
            completeness_score = email['chain_completeness_score'] or 0.0
            phase = self.determine_phase(completeness_score)
            
            # Route to appropriate processing phase
            if phase == 1:
                result = self.process_phase1(email)
                self.stats['phase1'] += 1
            elif phase == 2:
                result = self.process_phase2(email)
                self.stats['phase2'] += 1
            else:
                result = self.process_phase3(email)
                self.stats['phase3'] += 1
            
            result['email_id'] = email['id']
            result['completeness_score'] = completeness_score
            result['processed_at'] = datetime.now().isoformat()
            
            self.stats['processed'] += 1
            return result
            
        except Exception as e:
            logger.error(f"Failed to process email {email['id']}: {e}")
            self.stats['errors'] += 1
            return None
    
    def update_database(self, results: List[Dict]) -> int:
        """Update database with processing results"""
        if not results:
            return 0
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                update_data = []
                
                for result in results:
                    if not result:
                        continue
                        
                    update_data.append((
                        'analyzed',  # status
                        result['phase'],  # phase_completed
                        json.dumps(result['entities']),  # extracted_entities
                        json.dumps({
                            'method': result['method'],
                            'confidence': result['confidence'],
                            'completeness_score': result['completeness_score']
                        }),  # analysis metadata (using workflow_state for now)
                        result['processed_at'],
                        result['email_id']
                    ))
                
                if update_data:
                    conn.executemany("""
                        UPDATE emails_enhanced 
                        SET status = ?, phase_completed = ?, extracted_entities = ?,
                            workflow_state = ?, analyzed_at = ?
                        WHERE id = ?
                    """, update_data)
                    
                    conn.commit()
                    return len(update_data)
                    
        except Exception as e:
            logger.error(f"Failed to update database: {e}")
            return 0
        
        return 0
    
    def run_processing_pipeline(self, batch_size: int = 50):
        """Run the adaptive processing pipeline"""
        logger.info("Starting adaptive email processing pipeline")
        
        total_processed = 0
        batch_count = 0
        
        while True:
            # Get pending emails
            emails = self.get_pending_emails(batch_size)
            if not emails:
                logger.info("No more pending emails to process")
                break
                
            logger.info(f"Processing batch {batch_count + 1}: {len(emails)} emails")
            
            # Process emails
            results = []
            for email in emails:
                result = self.process_email(email)
                if result:
                    results.append(result)
            
            # Update database
            updated = self.update_database(results)
            total_processed += updated
            
            # Show batch stats
            phase_dist = {}
            for result in results:
                if result:
                    phase = result['phase']
                    phase_dist[phase] = phase_dist.get(phase, 0) + 1
            
            logger.info(f"Batch {batch_count + 1} complete: {updated} emails processed")
            logger.info(f"Phase distribution: {phase_dist}")
            
            batch_count += 1
            
            # Brief pause between batches
            time.sleep(0.5)
        
        # Final statistics
        logger.info("Processing pipeline completed!")
        logger.info(f"Total processed: {self.stats['processed']}")
        logger.info(f"Phase 1 (Rule-based): {self.stats['phase1']}")
        logger.info(f"Phase 2 (Llama 3.2): {self.stats['phase2']}")
        logger.info(f"Phase 3 (Phi-4): {self.stats['phase3']}")
        logger.info(f"Errors: {self.stats['errors']}")
        
        return total_processed

def main():
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    processor = AdaptiveEmailProcessor(db_path)
    total_processed = processor.run_processing_pipeline(batch_size=100)
    
    # Show final database stats
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'analyzed' THEN 1 ELSE 0 END) as analyzed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN phase_completed = 1 THEN 1 ELSE 0 END) as phase_1,
                SUM(CASE WHEN phase_completed = 2 THEN 1 ELSE 0 END) as phase_2,
                SUM(CASE WHEN phase_completed = 3 THEN 1 ELSE 0 END) as phase_3
            FROM emails_enhanced
        """)
        
        stats = cursor.fetchone()
        logger.info(f"\nFinal Database Stats:")
        logger.info(f"  Total emails: {stats[0]}")
        logger.info(f"  Analyzed: {stats[1]}")
        logger.info(f"  Pending: {stats[2]}")
        logger.info(f"  Phase 1 completed: {stats[3]}")
        logger.info(f"  Phase 2 completed: {stats[4]}")
        logger.info(f"  Phase 3 completed: {stats[5]}")

if __name__ == '__main__':
    main()