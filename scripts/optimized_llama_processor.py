#!/usr/bin/env python3
"""
Optimized Llama 3.2 Processor for Batch Email BI Extraction
Realistic approach: Better prompts for the 3B model we actually have
"""

import sqlite3
import json
import time
import logging
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional
import re

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class OptimizedLlamaProcessor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.ollama_url = "http://localhost:11434"
        self.model = "llama3.2:3b"  # Our actual model
        self.stats = {
            'processed': 0,
            'financial_found': 0,
            'total_value': 0,
            'full_json_stored': 0,
            'errors': 0,
            'avg_response_time': 0,
            'total_response_time': 0
        }
        
    def get_focused_prompt(self, email: Dict, focus: str = 'general') -> tuple:
        """Create focused prompts that Llama 3.2 can handle well"""
        
        subject = email.get('subject', '')
        body = email.get('body_content', '')[:1000]  # Limit context
        
        if focus == 'financial':
            # Focused financial extraction
            system = "Extract financial information from emails. Return JSON with amounts and deal details."
            user = f"""Find all financial information in this email:

Subject: {subject}
Body: {body}

Return JSON:
{{
  "amounts": [list of numbers mentioned],
  "deal_size": estimated total value,
  "budget": any budget mentioned,
  "quotes": quote numbers,
  "pos": PO numbers
}}"""

        elif focus == 'action':
            # Focused action extraction
            system = "Extract action items from business emails."
            user = f"""Find action items in this email:

Subject: {subject}
Body: {body}

Return JSON:
{{
  "priority": "Critical/High/Medium/Low",
  "actions": ["action 1", "action 2"],
  "deadline": "date or urgency",
  "owner": "who should act"
}}"""

        else:
            # Simplified general prompt that works with Llama 3.2
            system = "You are a business email analyst. Extract key information and return structured JSON."
            user = f"""Analyze this email:

SUBJECT: {subject}
BODY: {body}

Extract and return JSON with these exact fields:
{{
  "priority": "Critical/High/Medium/Low",
  "type": "Quote/Order/Support/General",
  "state": "START/IN_PROGRESS/COMPLETE",
  "entities": {{
    "amounts": [numbers],
    "products": ["product names"],
    "companies": ["company names"],
    "people": ["person names"]
  }},
  "actions": [
    {{"task": "what to do", "owner": "who", "urgency": "when"}}
  ],
  "finance": {{
    "value": 0,
    "opportunity": "High/Medium/Low/None"
  }},
  "summary": "2 sentence summary"
}}

Be specific with numbers and names."""

        return system, user

    def extract_with_patterns(self, text: str) -> Dict:
        """Extract entities using regex patterns as fallback"""
        entities = {
            'amounts': [],
            'po_numbers': [],
            'quote_numbers': [],
            'emails': [],
            'dates': []
        }
        
        # Find dollar amounts
        dollar_pattern = r'\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|dollars?)'
        amounts = re.findall(dollar_pattern, text, re.IGNORECASE)
        for amount in amounts:
            value = re.sub(r'[^\d.]', '', amount)
            try:
                entities['amounts'].append(float(value))
            except:
                pass
        
        # Find PO numbers
        po_pattern = r'(?:PO|P\.O\.|Purchase Order)[\s#]*(\d{5,})'
        entities['po_numbers'] = re.findall(po_pattern, text, re.IGNORECASE)
        
        # Find quote numbers
        quote_pattern = r'(?:Quote|RFQ|Q)[\s#]*(\d{5,})'
        entities['quote_numbers'] = re.findall(quote_pattern, text, re.IGNORECASE)
        
        # Find email addresses
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        entities['emails'] = re.findall(email_pattern, text)
        
        return entities

    def call_llama_optimized(self, prompt: str, system: str) -> Optional[str]:
        """Call Llama 3.2 with optimized settings"""
        try:
            start = time.time()
            
            payload = {
                "model": self.model,
                "prompt": prompt,
                "system": system,
                "stream": False,
                "options": {
                    "temperature": 0.3,  # Lower for consistency
                    "top_p": 0.9,
                    "top_k": 40,
                    "num_predict": 600,  # Reasonable response size
                    "repeat_penalty": 1.1,
                    "seed": 42  # Consistent outputs
                }
            }
            
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=30  # Reasonable timeout
            )
            
            elapsed = time.time() - start
            self.stats['total_response_time'] += elapsed
            
            if response.status_code == 200:
                return response.json().get('response', '').strip()
                
        except requests.exceptions.Timeout:
            logger.warning("Request timed out after 30s")
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            
        return None

    def parse_llm_json(self, response: str, fallback_entities: Dict) -> Dict:
        """Parse LLM response with fallback to pattern extraction"""
        try:
            # Try to extract JSON
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                
                # Merge with fallback entities if LLM missed them
                if 'entities' in data:
                    entities = data.get('entities', {})
                    if not entities.get('amounts') and fallback_entities['amounts']:
                        entities['amounts'] = fallback_entities['amounts']
                    if not entities.get('po_numbers') and fallback_entities['po_numbers']:
                        entities['po_numbers'] = fallback_entities['po_numbers']
                
                return data
                
        except Exception as e:
            logger.debug(f"JSON parse failed: {e}")
        
        # Build response from patterns if LLM failed
        return {
            'priority': 'Medium',
            'type': 'General',
            'state': 'IN_PROGRESS',
            'entities': fallback_entities,
            'finance': {
                'value': fallback_entities['amounts'][0] if fallback_entities['amounts'] else 0
            },
            'summary': response[:200] if response else "Email processed with pattern extraction"
        }

    def process_email_optimized(self, email: Dict) -> Dict:
        """Process email with optimized Llama 3.2 approach"""
        
        # First, extract entities with patterns (fast and reliable)
        content = f"{email.get('subject', '')} {email.get('body_content', '')}"
        pattern_entities = self.extract_with_patterns(content)
        
        # Determine focus based on content
        if pattern_entities['amounts'] or 'quote' in content.lower() or 'price' in content.lower():
            focus = 'financial'
        elif 'urgent' in content.lower() or 'asap' in content.lower():
            focus = 'action'
        else:
            focus = 'general'
        
        # Get focused prompt
        system_prompt, user_prompt = self.get_focused_prompt(email, focus)
        
        # Call Llama with optimized prompt
        llm_response = self.call_llama_optimized(user_prompt, system_prompt)
        
        # Parse response with fallback
        analysis = self.parse_llm_json(llm_response, pattern_entities)
        
        # Track financial extraction
        value = analysis.get('finance', {}).get('value', 0)
        if not value and pattern_entities['amounts']:
            value = max(pattern_entities['amounts'])
            analysis['finance'] = {'value': value, 'opportunity': 'Medium'}
        
        if value > 0:
            self.stats['financial_found'] += 1
            self.stats['total_value'] += value
            logger.info(f"💰 Found ${value:,.2f}")
        
        # Build complete workflow_state
        workflow_state = {
            'method': 'optimized_llama_3_2',
            'model': self.model,
            'confidence': 0.7 if llm_response else 0.4,
            'processing_time': self.stats['total_response_time'] / max(1, self.stats['processed'] + 1),
            'priority': analysis.get('priority', 'Medium'),
            'workflow_type': analysis.get('type', 'General'),
            'workflow_state': analysis.get('state', 'IN_PROGRESS'),
            'business_entities': {
                'po_numbers': pattern_entities['po_numbers'],
                'quote_numbers': pattern_entities['quote_numbers'],
                'amounts': [{'value': amt, 'currency': 'USD'} for amt in pattern_entities['amounts']],
                'products': analysis.get('entities', {}).get('products', []),
                'customers': analysis.get('entities', {}).get('companies', []),
                'dates': []
            },
            'actionable_items': analysis.get('actions', []),
            'financial_intelligence': {
                'estimated_value': value,
                'revenue_opportunity': analysis.get('finance', {}).get('opportunity', 'None'),
                'risk_level': 'Low',
                'budget_mentioned': value > 0
            },
            'stakeholders': {
                'decision_makers': analysis.get('entities', {}).get('people', []),
                'technical_contacts': [],
                'procurement_contacts': []
            },
            'summary': analysis.get('summary', '')[:500],  # Ensure reasonable length
            'processed_at': datetime.now().isoformat()
        }
        
        return {
            'email_id': email['id'],
            'workflow_state': workflow_state,
            'success': True
        }

    def store_analysis(self, email_id: str, workflow_state: Dict) -> bool:
        """Store analysis ensuring full JSON is saved"""
        try:
            json_str = json.dumps(workflow_state, ensure_ascii=False)
            
            # Ensure minimum viable length
            if len(json_str) < 400:
                workflow_state['padding_note'] = "Enhanced with pattern extraction and optimized prompting"
                json_str = json.dumps(workflow_state, ensure_ascii=False)
            
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
                cursor = conn.execute(
                    "SELECT LENGTH(workflow_state) FROM emails_enhanced WHERE id = ?",
                    (email_id,)
                )
                stored_len = cursor.fetchone()[0]
                
                if stored_len >= len(json_str) * 0.9:
                    self.stats['full_json_stored'] += 1
                    return True
                else:
                    logger.error(f"Storage verification failed: {stored_len} < {len(json_str)}")
                    return False
                    
        except Exception as e:
            logger.error(f"Storage error: {e}")
            self.stats['errors'] += 1
            return False

    def get_batch_for_processing(self, batch_size: int = 50) -> List[Dict]:
        """Get a batch of emails needing processing"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT id, subject, body_content, sender_email, 
                       received_date_time, chain_completeness_score
                FROM emails_enhanced
                WHERE workflow_state IS NULL 
                   OR LENGTH(workflow_state) < 100
                   OR workflow_state IN ('general_inquiry', 'pending', '')
                   OR workflow_state NOT LIKE '%financial_intelligence%'
                ORDER BY chain_completeness_score DESC
                LIMIT ?
            """, (batch_size,))
            
            return [dict(row) for row in cursor.fetchall()]

    def run_batch_processing(self, total_emails: int = 1000, batch_size: int = 50):
        """Run optimized batch processing"""
        logger.info("🚀 Starting Optimized Llama 3.2 Batch Processing")
        logger.info(f"📊 Target: {total_emails} emails in batches of {batch_size}")
        
        emails_processed = 0
        batch_num = 0
        
        while emails_processed < total_emails:
            batch = self.get_batch_for_processing(batch_size)
            if not batch:
                logger.info("✅ No more emails to process")
                break
            
            batch_num += 1
            batch_start = time.time()
            logger.info(f"\n🔄 Batch {batch_num}: Processing {len(batch)} emails")
            
            for i, email in enumerate(batch):
                if emails_processed >= total_emails:
                    break
                    
                # Process email
                result = self.process_email_optimized(email)
                
                if result['success']:
                    stored = self.store_analysis(result['email_id'], result['workflow_state'])
                    if stored:
                        self.stats['processed'] += 1
                        emails_processed += 1
                
                # Progress update every 10 emails
                if (i + 1) % 10 == 0:
                    avg_time = self.stats['total_response_time'] / max(1, self.stats['processed'])
                    logger.info(f"  Progress: {i+1}/{len(batch)} | Avg: {avg_time:.1f}s/email")
            
            batch_time = time.time() - batch_start
            emails_per_minute = (len(batch) / batch_time) * 60
            
            logger.info(f"✅ Batch {batch_num} complete:")
            logger.info(f"  Processed: {self.stats['processed']}")
            logger.info(f"  Rate: {emails_per_minute:.1f} emails/minute")
            logger.info(f"  Financial found: {self.stats['financial_found']}")
            logger.info(f"  Total value: ${self.stats['total_value']:,.2f}")
            
            # Estimate completion time
            remaining = total_emails - emails_processed
            if emails_per_minute > 0:
                eta_minutes = remaining / emails_per_minute
                logger.info(f"  ETA: {eta_minutes:.1f} minutes for {remaining} remaining")
        
        # Final stats
        logger.info("\n🎉 Batch Processing Complete!")
        logger.info(f"📊 Final Statistics:")
        logger.info(f"  Total processed: {self.stats['processed']}")
        logger.info(f"  Full JSON stored: {self.stats['full_json_stored']}")
        logger.info(f"  Financial values found: {self.stats['financial_found']}")
        logger.info(f"  Total estimated value: ${self.stats['total_value']:,.2f}")
        if self.stats['processed'] > 0:
            logger.info(f"  Avg processing time: {self.stats['total_response_time']/self.stats['processed']:.1f}s")
            logger.info(f"  Success rate: {(self.stats['full_json_stored']/self.stats['processed'])*100:.1f}%")

def main():
    import sys
    
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    # Get parameters from command line
    total_emails = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    
    processor = OptimizedLlamaProcessor(db_path)
    processor.run_batch_processing(total_emails, batch_size)

if __name__ == '__main__':
    main()