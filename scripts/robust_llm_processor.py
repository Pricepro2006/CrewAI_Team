#!/usr/bin/env python3
"""
Robust LLM Email Processing Pipeline with Async Batch Processing
Handles timeouts, implements retry logic, and provides resume capability
"""

import asyncio
import aiohttp
import sqlite3
import json
import time
import logging
import signal
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum
import re

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ProcessingPhase(Enum):
    PHASE1 = 1  # Rule-based
    PHASE2 = 2  # Llama 3.2
    PHASE3 = 3  # Phi-4

class ProcessingStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    PHASE2_COMPLETE = "phase2_complete"
    PHASE3_COMPLETE = "phase3_complete"
    FAILED = "failed"
    TIMEOUT = "timeout"

@dataclass
class ProcessingStats:
    """Track processing statistics"""
    total_processed: int = 0
    phase1_count: int = 0
    phase2_count: int = 0
    phase3_count: int = 0
    successful: int = 0
    failed: int = 0
    timeouts: int = 0
    llm_calls: int = 0
    batches_completed: int = 0
    start_time: datetime = None
    
    def __post_init__(self):
        self.start_time = datetime.now()
    
    @property
    def emails_per_minute(self) -> float:
        elapsed = (datetime.now() - self.start_time).total_seconds()
        return (self.total_processed / elapsed * 60) if elapsed > 0 else 0
    
    def log_stats(self):
        """Log current statistics"""
        logger.info(f"""
📊 Processing Statistics:
  ✅ Total Processed: {self.total_processed}
  📋 Phase 1: {self.phase1_count}
  🦙 Phase 2: {self.phase2_count}
  🔥 Phase 3: {self.phase3_count}
  ✅ Successful: {self.successful}
  ❌ Failed: {self.failed}
  ⏱️ Timeouts: {self.timeouts}
  🤖 LLM Calls: {self.llm_calls}
  🔄 Batches: {self.batches_completed}
  ⚡ Speed: {self.emails_per_minute:.1f} emails/min
""")

class RobustLLMProcessor:
    def __init__(self, db_path: str, batch_size: int = 10):
        self.db_path = db_path
        self.batch_size = batch_size
        self.ollama_url = "http://localhost:11434"
        self.stats = ProcessingStats()
        self.shutdown_requested = False
        self.current_batch_ids = []
        
        # Async HTTP session settings
        self.timeout = aiohttp.ClientTimeout(total=60, connect=5, sock_read=50)
        self.connector = aiohttp.TCPConnector(limit=5, force_close=True)
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Retry settings
        self.max_retries = 3
        self.retry_delay = 2
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logger.info("🛑 Shutdown signal received. Finishing current batch...")
        self.shutdown_requested = True
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            timeout=self.timeout,
            connector=self.connector
        )
        await self.test_ollama_connection()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
        await asyncio.sleep(0.25)  # Allow connections to close
    
    async def test_ollama_connection(self):
        """Test Ollama connection and available models"""
        try:
            async with self.session.get(f"{self.ollama_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    models = [m['name'] for m in data.get('models', [])]
                    logger.info(f"✅ Ollama connected. Models: {models}")
                    
                    if 'llama3.2:3b' not in models:
                        logger.warning("⚠️ llama3.2:3b not found")
                    if 'phi-4' not in models and 'doomgrave/phi-4:14b-tools-Q3_K_S' not in models:
                        logger.warning("⚠️ phi-4 model not found")
                else:
                    logger.error("❌ Ollama not responding properly")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Ollama: {e}")
    
    def get_db_connection(self) -> sqlite3.Connection:
        """Get a new database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def get_pending_emails(self, limit: int) -> List[Dict]:
        """Get batch of pending emails"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.execute("""
                    SELECT 
                        id, subject, body_content, chain_completeness_score,
                        sender_email, received_date_time, status,
                        phase_completed, workflow_state
                    FROM emails_enhanced 
                    WHERE status IN ('pending', 'timeout', 'failed')
                    AND chain_completeness_score IS NOT NULL
                    ORDER BY 
                        CASE WHEN status = 'timeout' THEN 0 ELSE 1 END,
                        chain_completeness_score DESC
                    LIMIT ?
                """, (limit,))
                
                emails = [dict(row) for row in cursor.fetchall()]
                
                # Mark emails as processing
                if emails:
                    email_ids = [e['id'] for e in emails]
                    placeholders = ','.join(['?' for _ in email_ids])
                    conn.execute(
                        f"UPDATE emails_enhanced SET status = 'processing' WHERE id IN ({placeholders})",
                        email_ids
                    )
                    conn.commit()
                    self.current_batch_ids = email_ids
                
                return emails
        except Exception as e:
            logger.error(f"❌ Database error: {e}")
            return []
    
    def determine_phase(self, completeness_score: float) -> ProcessingPhase:
        """Determine processing phase based on completeness"""
        if completeness_score >= 0.7:
            return ProcessingPhase.PHASE1
        elif completeness_score >= 0.3:
            return ProcessingPhase.PHASE2
        else:
            return ProcessingPhase.PHASE3
    
    def get_system_prompt(self) -> str:
        """Get optimized system prompt"""
        return """You are an expert business email analyst for TD SYNNEX. Extract actionable business intelligence.

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "priority": "Critical|High|Medium|Low",
  "workflow_type": "Quote Request|Order Processing|Support Ticket|General Inquiry|Escalation",
  "workflow_state": "START_POINT|IN_PROGRESS|COMPLETION",
  "business_entities": {
    "po_numbers": [],
    "quote_numbers": [],
    "order_numbers": [],
    "amounts": [{"value": 0, "currency": "USD"}],
    "products": [],
    "customers": [],
    "dates": [{"date": "YYYY-MM-DD", "context": "string"}]
  },
  "actionable_items": [
    {"action": "string", "owner": "string", "deadline": "string", "business_impact": "High|Medium|Low"}
  ],
  "financial_intelligence": {
    "estimated_value": 0,
    "revenue_opportunity": "High|Medium|Low|None"
  },
  "summary": "2 sentence business summary",
  "confidence": 0.0
}"""
    
    async def call_ollama_async(self, model: str, prompt: str, system: str = None) -> Optional[str]:
        """Async Ollama API call with retry logic"""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.8,
                "num_predict": 800,
                "repeat_penalty": 1.1
            }
        }
        
        if system:
            payload["system"] = system
        
        for attempt in range(self.max_retries):
            try:
                self.stats.llm_calls += 1
                
                async with self.session.post(
                    f"{self.ollama_url}/api/generate",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=45)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result.get('response', '').strip()
                    else:
                        logger.warning(f"Ollama returned {response.status}")
                        
            except asyncio.TimeoutError:
                logger.warning(f"⏱️ Timeout on attempt {attempt + 1}/{self.max_retries}")
                self.stats.timeouts += 1
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))
            except Exception as e:
                logger.error(f"❌ Ollama error: {e}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay)
        
        return None
    
    def parse_json_response(self, response: str) -> Optional[Dict]:
        """Parse JSON from LLM response"""
        if not response:
            return None
        
        try:
            # Find JSON in response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            logger.debug("JSON parse failed, attempting recovery")
        
        return None
    
    async def process_phase1(self, email: Dict) -> Dict[str, Any]:
        """Rule-based processing (no LLM)"""
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        priority = "Low"
        workflow_type = "General Inquiry"
        
        # Priority detection
        if any(word in content for word in ['urgent', 'critical', 'asap', 'emergency']):
            priority = "Critical"
        elif any(word in content for word in ['quote', 'pricing', 'po ', 'purchase order']):
            priority = "High"
        elif any(word in content for word in ['issue', 'problem', 'support']):
            priority = "Medium"
        
        # Workflow type detection
        if any(word in content for word in ['quote', 'pricing', 'rfq']):
            workflow_type = "Quote Request"
        elif any(word in content for word in ['po ', 'purchase order', 'order #']):
            workflow_type = "Order Processing"
        elif any(word in content for word in ['issue', 'problem', 'support']):
            workflow_type = "Support Ticket"
        elif any(word in content for word in ['urgent', 'escalate']):
            workflow_type = "Escalation"
        
        return {
            'phase': ProcessingPhase.PHASE1.value,
            'method': 'rule_based',
            'priority': priority,
            'workflow_type': workflow_type,
            'workflow_state': 'IN_PROGRESS',
            'confidence': 0.7,
            'processing_time': 0.1
        }
    
    async def process_phase2(self, email: Dict) -> Dict[str, Any]:
        """Llama 3.2 processing"""
        start_time = time.time()
        
        system_prompt = self.get_system_prompt()
        user_prompt = f"""Analyze this email:
SUBJECT: {email.get('subject', '')}
FROM: {email.get('sender_email', '')}
COMPLETENESS: {email.get('chain_completeness_score', 0):.2f}
BODY: {email.get('body_content', '')[:1000]}...

Extract business intelligence and return JSON."""
        
        response = await self.call_ollama_async("llama3.2:3b", user_prompt, system_prompt)
        processing_time = time.time() - start_time
        
        if response:
            parsed = self.parse_json_response(response)
            if parsed:
                return {
                    'phase': ProcessingPhase.PHASE2.value,
                    'method': 'llama_3_2',
                    'llm_response': parsed,
                    'confidence': parsed.get('confidence', 0.8),
                    'processing_time': processing_time
                }
        
        # Fallback
        return {
            'phase': ProcessingPhase.PHASE2.value,
            'method': 'llama_3_2_fallback',
            'priority': 'Medium',
            'workflow_type': 'General Inquiry',
            'confidence': 0.5,
            'processing_time': processing_time
        }
    
    async def process_phase3(self, email: Dict) -> Dict[str, Any]:
        """Phi-4 processing for complex emails"""
        start_time = time.time()
        
        system_prompt = """Analyze incomplete email chains and reconstruct context.
Focus on missing information, required actions, and business impact.
Return JSON with standard format plus: missing_context, required_actions, escalation_needed."""
        
        user_prompt = f"""Complex email analysis needed (completeness: {email.get('chain_completeness_score', 0):.2f}):
SUBJECT: {email.get('subject', '')}
BODY: {email.get('body_content', '')[:1200]}...

Reconstruct missing context and provide comprehensive analysis."""
        
        # Try different Phi-4 model names
        model_names = ["phi-4", "doomgrave/phi-4:14b-tools-Q3_K_S", "phi-4:latest"]
        response = None
        
        for model in model_names:
            response = await self.call_ollama_async(model, user_prompt, system_prompt)
            if response:
                break
        
        processing_time = time.time() - start_time
        
        if response:
            parsed = self.parse_json_response(response)
            if parsed:
                return {
                    'phase': ProcessingPhase.PHASE3.value,
                    'method': 'phi_4',
                    'llm_response': parsed,
                    'confidence': parsed.get('confidence', 0.9),
                    'processing_time': processing_time
                }
        
        # Fallback
        return {
            'phase': ProcessingPhase.PHASE3.value,
            'method': 'phi_4_fallback',
            'priority': 'High',
            'workflow_type': 'Escalation',
            'confidence': 0.6,
            'processing_time': processing_time
        }
    
    async def process_email(self, email: Dict) -> Tuple[str, Dict[str, Any]]:
        """Process single email through appropriate phase"""
        email_id = email['id']
        
        try:
            completeness = email.get('chain_completeness_score', 0.0)
            phase = self.determine_phase(completeness)
            
            # Route to appropriate processor
            if phase == ProcessingPhase.PHASE1:
                result = await self.process_phase1(email)
                self.stats.phase1_count += 1
            elif phase == ProcessingPhase.PHASE2:
                result = await self.process_phase2(email)
                self.stats.phase2_count += 1
            else:
                result = await self.process_phase3(email)
                self.stats.phase3_count += 1
            
            # Add metadata
            result['email_id'] = email_id
            result['completeness_score'] = completeness
            result['processed_at'] = datetime.now().isoformat()
            
            self.stats.successful += 1
            return (email_id, result)
            
        except Exception as e:
            logger.error(f"❌ Error processing {email_id}: {e}")
            self.stats.failed += 1
            return (email_id, None)
    
    async def process_batch(self, emails: List[Dict]) -> List[Tuple[str, Dict]]:
        """Process batch of emails concurrently"""
        tasks = [self.process_email(email) for email in emails]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions
        valid_results = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Task exception: {result}")
            elif result[1] is not None:  # (email_id, result_dict)
                valid_results.append(result)
        
        return valid_results
    
    def update_database_batch(self, results: List[Tuple[str, Dict]]) -> int:
        """Update database with batch results"""
        if not results:
            return 0
        
        try:
            with self.get_db_connection() as conn:
                update_data = []
                
                for email_id, result in results:
                    if not result:
                        continue
                    
                    # Determine status based on phase
                    phase = result.get('phase', 1)
                    if phase == 1:
                        status = ProcessingStatus.ANALYZED.value
                    elif phase == 2:
                        status = ProcessingStatus.PHASE2_COMPLETE.value
                    else:
                        status = ProcessingStatus.PHASE3_COMPLETE.value
                    
                    # Extract LLM response if available
                    llm_data = result.get('llm_response', {})
                    
                    # Prepare workflow state
                    workflow_state = {
                        'method': result.get('method'),
                        'confidence': result.get('confidence', 0),
                        'processing_time': result.get('processing_time', 0),
                        'priority': llm_data.get('priority', result.get('priority', 'Medium')),
                        'workflow_type': llm_data.get('workflow_type', result.get('workflow_type', 'General Inquiry')),
                        'workflow_state': llm_data.get('workflow_state', result.get('workflow_state', 'IN_PROGRESS')),
                        'business_entities': llm_data.get('business_entities', {}),
                        'actionable_items': llm_data.get('actionable_items', []),
                        'financial_intelligence': llm_data.get('financial_intelligence', {}),
                        'summary': llm_data.get('summary', ''),
                        'processed_at': result.get('processed_at')
                    }
                    
                    # Store phase-specific results
                    phase_result_col = f'phase{phase}_result'
                    phase_result = json.dumps({
                        'method': result.get('method'),
                        'confidence': result.get('confidence'),
                        'processing_time': result.get('processing_time'),
                        'timestamp': result.get('processed_at')
                    })
                    
                    update_data.append((
                        status,
                        phase,
                        json.dumps(llm_data.get('business_entities', {})),
                        json.dumps(workflow_state),
                        result.get('processed_at'),
                        phase_result,
                        email_id
                    ))
                
                if update_data:
                    # Update with phase-specific result
                    for data in update_data:
                        phase = data[1]
                        phase_col = f'phase{phase}_result'
                        
                        conn.execute(f"""
                            UPDATE emails_enhanced 
                            SET status = ?, 
                                phase_completed = ?,
                                extracted_entities = ?,
                                workflow_state = ?,
                                analyzed_at = ?,
                                {phase_col} = ?
                            WHERE id = ?
                        """, data)
                    
                    conn.commit()
                    return len(update_data)
                    
        except Exception as e:
            logger.error(f"❌ Database update error: {e}")
            # Mark emails as failed
            self.mark_batch_as_failed(self.current_batch_ids)
            return 0
        
        return 0
    
    def mark_batch_as_failed(self, email_ids: List[str]):
        """Mark batch as failed for retry"""
        if not email_ids:
            return
        
        try:
            with self.get_db_connection() as conn:
                placeholders = ','.join(['?' for _ in email_ids])
                conn.execute(
                    f"UPDATE emails_enhanced SET status = 'failed' WHERE id IN ({placeholders})",
                    email_ids
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to mark batch as failed: {e}")
    
    def get_progress_summary(self) -> Dict:
        """Get current processing progress"""
        try:
            with self.get_db_connection() as conn:
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
                        SUM(CASE WHEN status = 'analyzed' THEN 1 ELSE 0 END) as analyzed,
                        SUM(CASE WHEN status = 'phase2_complete' THEN 1 ELSE 0 END) as phase2,
                        SUM(CASE WHEN status = 'phase3_complete' THEN 1 ELSE 0 END) as phase3,
                        SUM(CASE WHEN status IN ('failed', 'timeout') THEN 1 ELSE 0 END) as failed
                    FROM emails_enhanced
                    WHERE chain_completeness_score IS NOT NULL
                """)
                
                return dict(cursor.fetchone())
        except Exception as e:
            logger.error(f"Failed to get progress: {e}")
            return {}
    
    async def run(self):
        """Main processing loop with batch processing"""
        logger.info("🚀 Starting Robust LLM Email Processing Pipeline")
        logger.info(f"📦 Batch size: {self.batch_size}")
        logger.info("🛑 Press Ctrl+C to stop gracefully")
        
        # Show initial progress
        progress = self.get_progress_summary()
        logger.info(f"📊 Initial state: {progress}")
        
        while not self.shutdown_requested:
            # Get batch of emails
            emails = self.get_pending_emails(self.batch_size)
            
            if not emails:
                logger.info("✅ No more pending emails")
                break
            
            batch_start = time.time()
            logger.info(f"🔄 Processing batch {self.stats.batches_completed + 1}: {len(emails)} emails")
            
            # Process batch concurrently
            results = await self.process_batch(emails)
            
            # Update database
            updated = self.update_database_batch(results)
            
            # Update stats
            self.stats.total_processed += len(emails)
            self.stats.batches_completed += 1
            
            batch_time = time.time() - batch_start
            logger.info(f"✅ Batch complete: {updated}/{len(emails)} successful in {batch_time:.1f}s")
            
            # Log statistics every 5 batches
            if self.stats.batches_completed % 5 == 0:
                self.stats.log_stats()
                progress = self.get_progress_summary()
                logger.info(f"📊 Overall progress: {progress}")
            
            # Brief pause between batches
            await asyncio.sleep(1)
        
        # Final statistics
        logger.info("🏁 Processing pipeline completed")
        self.stats.log_stats()
        
        final_progress = self.get_progress_summary()
        logger.info(f"📊 Final state: {final_progress}")

async def main():
    """Main entry point"""
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    batch_size = 15  # Optimal batch size for 60+ emails/minute
    
    try:
        async with RobustLLMProcessor(db_path, batch_size) as processor:
            await processor.run()
    except KeyboardInterrupt:
        logger.info("⚠️ Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())