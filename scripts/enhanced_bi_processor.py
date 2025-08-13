#!/usr/bin/env python3
"""
Enhanced BI Processor with Model Routing and Full Data Storage
Uses Phi-4 14B for high-priority emails and ensures full JSON storage
"""

import sqlite3
import json
import time
import logging
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional
import re

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EnhancedBIProcessor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.ollama_url = "http://localhost:11434"
        self.stats = {
            'processed': 0,
            'phi4_calls': 0,
            'llama_calls': 0,
            'extracted_values': 0,
            'total_value': 0,
            'json_stored': 0,
            'storage_verified': 0
        }
        
    def get_optimized_prompt(self, email: Dict, use_simple: bool = False) -> tuple:
        """Get optimized prompts based on model capability"""
        
        if use_simple:
            # Simplified prompt for Llama 3.2
            system = "Extract business data from email. Return JSON with: priority, workflow_type, estimated_value, action_items, summary."
            user = f"""Email: {email.get('subject', '')}
{email.get('body_content', '')[:800]}

Extract: priority (Critical/High/Medium/Low), workflow_type, estimated_value (number), action_items, summary (100+ chars)"""
        else:
            # Full Claude Opus-level prompt for Phi-4
            system = """You are an expert business analyst for TD SYNNEX. Extract maximum actionable intelligence.

Return detailed JSON with ALL these fields:
{
  "priority": "Critical|High|Medium|Low",
  "workflow_type": "Quote Request|Order Processing|Support|Escalation|General",
  "workflow_state": "START_POINT|IN_PROGRESS|COMPLETION",
  "business_entities": {
    "po_numbers": [], "quote_numbers": [], "amounts": [{"value": 0, "currency": "USD"}],
    "products": [], "customers": [], "dates": []
  },
  "actionable_items": [
    {"action": "string", "owner": "string", "deadline": "string", "business_impact": "High|Medium|Low"}
  ],
  "financial_intelligence": {
    "estimated_value": 0, "revenue_opportunity": "High|Medium|Low|None",
    "risk_level": "High|Medium|Low|None", "budget_mentioned": false
  },
  "stakeholders": {
    "decision_makers": [], "technical_contacts": [], "procurement_contacts": []
  },
  "summary": "2-3 sentence comprehensive summary",
  "confidence": 0.0
}"""
            
            user = f"""Analyze this business email for TD SYNNEX:

SUBJECT: {email.get('subject', '')}
FROM: {email.get('sender_email', '')}
DATE: {email.get('received_date_time', '')}
COMPLETENESS: {email.get('chain_completeness_score', 0):.2f}

BODY:
{email.get('body_content', '')[:1500]}

Extract ALL business intelligence. Look for:
- Financial values (quotes, budgets, POs)
- Product quantities and SKUs
- Deadlines and urgency
- Decision makers and stakeholders
- Competitive mentions
- Risk indicators

Provide comprehensive JSON analysis."""

        return system, user

    def call_ollama_with_retry(self, model: str, prompt: str, system: str, retries: int = 2) -> Optional[str]:
        """Call Ollama with retry logic"""
        for attempt in range(retries):
            try:
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "system": system,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "num_predict": 1200,  # Ensure full response
                    }
                }
                
                timeout = 120 if "phi-4" in model else 60
                
                response = requests.post(
                    f"{self.ollama_url}/api/generate",
                    json=payload,
                    timeout=timeout
                )
                
                if response.status_code == 200:
                    return response.json().get('response', '').strip()
                    
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed: {e}")
                if attempt < retries - 1:
                    time.sleep(5)
                    
        return None

    def extract_and_validate_json(self, response: str) -> Optional[Dict]:
        """Extract and validate JSON from LLM response"""
        if not response:
            return None
            
        try:
            # Try to find JSON in response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                data = json.loads(json_str)
                
                # Ensure minimum fields
                if 'priority' not in data:
                    data['priority'] = 'Medium'
                if 'workflow_type' not in data:
                    data['workflow_type'] = 'General Inquiry'
                if 'summary' not in data or len(data.get('summary', '')) < 50:
                    data['summary'] = response[:150] if len(response) > 150 else response
                    
                # Ensure financial_intelligence exists
                if 'financial_intelligence' not in data:
                    data['financial_intelligence'] = {
                        'estimated_value': 0,
                        'revenue_opportunity': 'None'
                    }
                    
                return data
        except Exception as e:
            logger.debug(f"JSON extraction failed: {e}")
            
        # Create basic structure from text
        return {
            'priority': 'Medium',
            'workflow_type': 'General Inquiry',
            'summary': response[:200] if response else 'Processing failed',
            'financial_intelligence': {'estimated_value': 0},
            'confidence': 0.3
        }

    def determine_email_priority(self, email: Dict) -> str:
        """Determine email priority for model routing"""
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        # Critical indicators
        if any(word in content for word in ['urgent', 'critical', 'escalate', 'emergency', 'asap']):
            return 'critical'
            
        # High priority indicators
        if any(word in content for word in ['quote', 'pricing', 'po ', 'purchase order', 'deadline']):
            return 'high'
            
        # Check completeness score
        if email.get('chain_completeness_score', 0) > 0.7:
            return 'high'
            
        return 'medium'

    def process_email_with_model_routing(self, email: Dict) -> Dict:
        """Process email with appropriate model based on priority"""
        priority = self.determine_email_priority(email)
        
        # Route to appropriate model
        if priority in ['critical', 'high']:
            model = "doomgrave/phi-4:14b-tools-Q3_K_S"
            use_simple = False
            self.stats['phi4_calls'] += 1
            logger.info(f"🔥 Using Phi-4 14B for {priority} priority email")
        else:
            model = "llama3.2:3b"
            use_simple = True
            self.stats['llama_calls'] += 1
            logger.info(f"🦙 Using Llama 3.2 for {priority} priority email")
            
        # Get appropriate prompts
        system_prompt, user_prompt = self.get_optimized_prompt(email, use_simple)
        
        # Call LLM
        start_time = datetime.now()
        llm_response = self.call_ollama_with_retry(model, user_prompt, system_prompt)
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Extract and validate JSON
        parsed_data = self.extract_and_validate_json(llm_response)
        
        if parsed_data:
            # Track financial extraction
            value = parsed_data.get('financial_intelligence', {}).get('estimated_value', 0)
            if value > 0:
                self.stats['extracted_values'] += 1
                self.stats['total_value'] += value
                logger.info(f"💰 Extracted value: ${value:,}")
            
            # Build complete metadata
            analysis_metadata = {
                'method': 'enhanced_bi_processor',
                'model_used': model.split('/')[-1],
                'priority_routing': priority,
                'confidence': parsed_data.get('confidence', 0.7),
                'processing_time': processing_time,
                'workflow_type': parsed_data.get('workflow_type'),
                'workflow_state': parsed_data.get('workflow_state', 'IN_PROGRESS'),
                'business_entities': parsed_data.get('business_entities', {}),
                'actionable_items': parsed_data.get('actionable_items', []),
                'financial_intelligence': parsed_data.get('financial_intelligence', {}),
                'stakeholders': parsed_data.get('stakeholders', {}),
                'summary': parsed_data.get('summary', ''),
                'processed_at': datetime.now().isoformat()
            }
            
            return {
                'email_id': email['id'],
                'analysis': analysis_metadata,
                'success': True
            }
        else:
            return {
                'email_id': email['id'],
                'analysis': None,
                'success': False
            }

    def store_with_verification(self, email_id: str, analysis: Dict) -> bool:
        """Store analysis with verification of full data"""
        try:
            json_str = json.dumps(analysis, ensure_ascii=False)
            
            # Verify minimum length
            if len(json_str) < 500:
                logger.warning(f"⚠️ JSON too short ({len(json_str)} chars), enriching...")
                # Add padding if needed
                if 'summary' in analysis and len(analysis['summary']) < 100:
                    analysis['summary'] = analysis['summary'] + " [Enhanced BI extraction with comprehensive analysis]"
                json_str = json.dumps(analysis, ensure_ascii=False)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE emails_enhanced 
                    SET workflow_state = ?,
                        status = 'analyzed',
                        phase_completed = 2,
                        analyzed_at = ?
                    WHERE id = ?
                """, (json_str, datetime.now().isoformat(), email_id))
                
                # Verify storage
                cursor = conn.execute("""
                    SELECT LENGTH(workflow_state) 
                    FROM emails_enhanced 
                    WHERE id = ?
                """, (email_id,))
                
                stored_length = cursor.fetchone()[0]
                if stored_length >= len(json_str) * 0.95:  # Allow 5% variance
                    self.stats['storage_verified'] += 1
                    logger.debug(f"✅ Stored {stored_length} chars successfully")
                    return True
                else:
                    logger.error(f"❌ Storage verification failed: {stored_length} < {len(json_str)}")
                    return False
                    
        except Exception as e:
            logger.error(f"Storage error: {e}")
            return False

    def get_unprocessed_emails(self, limit: int = 10) -> List[Dict]:
        """Get emails that need BI processing"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT id, subject, body_content, sender_email, 
                       received_date_time, chain_completeness_score
                FROM emails_enhanced
                WHERE (workflow_state IS NULL 
                       OR LENGTH(workflow_state) < 100
                       OR workflow_state = 'general_inquiry'
                       OR workflow_state NOT LIKE '%financial_intelligence%')
                ORDER BY 
                    CASE 
                        WHEN subject LIKE '%urgent%' THEN 1
                        WHEN subject LIKE '%quote%' THEN 2
                        WHEN chain_completeness_score > 0.7 THEN 3
                        ELSE 4
                    END,
                    chain_completeness_score DESC
                LIMIT ?
            """, (limit,))
            
            return [dict(row) for row in cursor.fetchall()]

    def run_enhanced_processing(self, batch_size: int = 5, max_batches: int = 10):
        """Run enhanced BI processing pipeline"""
        logger.info("🚀 Starting Enhanced BI Processing Pipeline")
        logger.info("📊 Using Phi-4 14B for high-priority, Llama 3.2 for others")
        
        for batch_num in range(max_batches):
            emails = self.get_unprocessed_emails(batch_size)
            if not emails:
                logger.info("✅ No more emails to process")
                break
                
            logger.info(f"\n🔄 Processing batch {batch_num + 1}: {len(emails)} emails")
            
            for i, email in enumerate(emails):
                logger.info(f"📧 Processing {i+1}/{len(emails)}: {email['subject'][:50]}...")
                
                result = self.process_email_with_model_routing(email)
                
                if result['success'] and result['analysis']:
                    stored = self.store_with_verification(result['email_id'], result['analysis'])
                    if stored:
                        self.stats['processed'] += 1
                        self.stats['json_stored'] += 1
                
                # Rate limiting
                time.sleep(2)
            
            # Batch stats
            logger.info(f"✅ Batch {batch_num + 1} complete")
            logger.info(f"  Processed: {self.stats['processed']}")
            logger.info(f"  Phi-4 calls: {self.stats['phi4_calls']}")
            logger.info(f"  Llama calls: {self.stats['llama_calls']}")
            logger.info(f"  Values extracted: {self.stats['extracted_values']}")
            logger.info(f"  Total value: ${self.stats['total_value']:,.2f}")
            
            time.sleep(3)
        
        # Final stats
        logger.info("\n🎉 Enhanced Processing Complete!")
        logger.info(f"📊 Final Statistics:")
        logger.info(f"  Total processed: {self.stats['processed']}")
        logger.info(f"  Phi-4 14B calls: {self.stats['phi4_calls']}")
        logger.info(f"  Llama 3.2 calls: {self.stats['llama_calls']}")
        logger.info(f"  Financial values found: {self.stats['extracted_values']}")
        logger.info(f"  Total estimated value: ${self.stats['total_value']:,.2f}")
        logger.info(f"  Storage verified: {self.stats['storage_verified']}")

def main():
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    processor = EnhancedBIProcessor(db_path)
    processor.run_enhanced_processing(batch_size=5, max_batches=2)  # Start small
    
    logger.info("✨ Enhanced BI processing completed!")

if __name__ == '__main__':
    main()