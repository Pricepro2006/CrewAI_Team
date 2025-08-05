#!/usr/bin/env python3
"""
REAL Adaptive Email Processing Pipeline with ACTUAL LLMs
Uses Ollama to run Llama 3.2:3b and Phi-4 models for real analysis
"""

import sqlite3
import json
import time
import logging
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class RealLLMProcessor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.ollama_url = "http://localhost:11434"
        self.stats = {
            'processed': 0,
            'phase1': 0,
            'phase2': 0, 
            'phase3': 0,
            'errors': 0,
            'llm_calls': 0,
            'llm_failures': 0
        }
        
        # Test Ollama connection
        self.test_ollama_connection()
    
    def test_ollama_connection(self):
        """Test if Ollama is running and models are available"""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get('models', [])
                available_models = [model['name'] for model in models]
                logger.info(f"Ollama connected. Available models: {available_models}")
                
                # Check for required models
                if 'llama3.2:3b' not in available_models:
                    logger.warning("llama3.2:3b not found - Phase 2 will use fallback")
                if 'doomgrave/phi-4:14b-tools-Q3_K_S' not in available_models:
                    logger.warning("phi-4 not found - Phase 3 will use fallback")
            else:
                logger.error("Ollama not responding properly")
        except Exception as e:
            logger.error(f"Failed to connect to Ollama: {e}")
    
    def call_ollama(self, model: str, prompt: str, system: str = None) -> Optional[str]:
        """Make actual API call to Ollama"""
        try:
            self.stats['llm_calls'] += 1
            
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.9,
                    "num_predict": 500
                }
            }
            
            if system:
                payload["system"] = system
            
            logger.debug(f"Calling {model} with {len(prompt)} chars")
            
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '').strip()
            else:
                logger.error(f"Ollama API error: {response.status_code}")
                self.stats['llm_failures'] += 1
                return None
                
        except Exception as e:
            logger.error(f"Failed to call {model}: {e}")
            self.stats['llm_failures'] += 1
            return None
    
    def get_pending_emails(self, limit: int = 50) -> List[Dict]:
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
            return 2  # Medium completeness - REAL Llama 3.2 processing
        else:
            return 3  # Low completeness - REAL Phi-4 processing
    
    def process_phase1(self, email: Dict) -> Dict[str, Any]:
        """Rule-based processing for high completeness emails"""
        logger.debug(f"Phase 1 (Rule-based): {email['id']}")
        
        entities = []
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        # Basic rule-based entity extraction
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
            'confidence': 0.8 if entities else 0.4,
            'llm_used': None
        }
    
    def process_phase2(self, email: Dict) -> Dict[str, Any]:
        """REAL Llama 3.2 processing for medium completeness"""
        logger.info(f"Phase 2 (REAL Llama 3.2): {email['id']}")
        
        # Prepare content for LLM
        subject = email.get('subject', '')
        body = email.get('body_content', '')
        sender = email.get('sender_email', '')
        
        # Real LLM system prompt
        system_prompt = """You are an expert email analyst. Extract business entities and insights from emails.
        
        Focus on identifying:
        - Business relationships (client, vendor, partner)
        - Financial information (prices, budgets, payments)
        - Technical requirements (systems, integrations, APIs)
        - Support requests and issues
        - Project information and deadlines
        
        Return your analysis as JSON with:
        {
          "entities": [{"type": "entity_type", "value": "extracted_value", "confidence": 0.0-1.0}],
          "workflow_type": "quote_request|order_processing|support_ticket|general_inquiry",
          "priority": "high|medium|low",
          "actionable_items": ["item1", "item2"],
          "summary": "brief summary"
        }"""
        
        # Create LLM prompt
        llm_prompt = f"""Analyze this email:

        From: {sender}
        Subject: {subject}
        
        Body: {body[:1000]}...
        
        Extract business entities and provide analysis:"""
        
        # Call REAL Llama 3.2
        llm_response = self.call_ollama("llama3.2:3b", llm_prompt, system_prompt)
        
        entities = []
        workflow_type = "general_inquiry"
        priority = "medium"
        actionable_items = []
        
        if llm_response:
            try:
                # Try to parse JSON response
                if '{' in llm_response and '}' in llm_response:
                    json_start = llm_response.find('{')
                    json_end = llm_response.rfind('}') + 1
                    json_str = llm_response[json_start:json_end]
                    llm_data = json.loads(json_str)
                    
                    entities = llm_data.get('entities', [])
                    workflow_type = llm_data.get('workflow_type', 'general_inquiry')
                    priority = llm_data.get('priority', 'medium')
                    actionable_items = llm_data.get('actionable_items', [])
                    
                    logger.info(f"Llama 3.2 extracted {len(entities)} entities")
                else:
                    # Fallback: extract key insights from text response
                    entities.append({
                        'type': 'llm_analysis',
                        'value': llm_response[:200],
                        'confidence': 0.7
                    })
                    
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse Llama 3.2 JSON, using text response")
                entities.append({
                    'type': 'llm_analysis', 
                    'value': llm_response[:200],
                    'confidence': 0.6
                })
        else:
            # Fallback processing if LLM fails
            logger.warning("Llama 3.2 failed, using fallback")
            entities.append({'type': 'fallback_analysis', 'confidence': 0.3})
        
        return {
            'entities': entities,
            'phase': 2,
            'method': 'llama_3_2_real',
            'confidence': 0.85 if llm_response else 0.3,
            'llm_used': 'llama3.2:3b',
            'workflow_type': workflow_type,
            'priority': priority,
            'actionable_items': actionable_items
        }
    
    def process_phase3(self, email: Dict) -> Dict[str, Any]:
        """REAL Phi-4 processing for low completeness/broken chains"""
        logger.info(f"Phase 3 (REAL Phi-4): {email['id']}")
        
        # Prepare content for LLM
        subject = email.get('subject', '')
        body = email.get('body_content', '')
        sender = email.get('sender_email', '')
        completeness_score = email.get('chain_completeness_score', 0.0)
        
        # Real Phi-4 system prompt for complex analysis
        system_prompt = """You are an expert email workflow analyst specializing in incomplete or broken email chains.
        
        Your task is to analyze fragmented emails and reconstruct missing context:
        - Identify what information is missing from the conversation
        - Infer the original request or issue being discussed
        - Suggest what actions are needed to complete the workflow
        - Identify escalation requirements
        - Extract complex business relationships and dependencies
        
        Return detailed JSON analysis:
        {
          "missing_context": ["what's missing from conversation"],
          "inferred_workflow": "description of likely workflow",
          "entities": [{"type": "entity_type", "value": "extracted_value", "confidence": 0.0-1.0}],
          "reconstruction_confidence": 0.0-1.0,
          "required_actions": ["action1", "action2"],
          "escalation_needed": true/false,
          "business_impact": "high|medium|low"
        }"""
        
        # Create complex LLM prompt
        llm_prompt = f"""Analyze this incomplete/broken email chain (completeness: {completeness_score:.2f}):

        From: {sender}
        Subject: {subject}
        
        Body: {body[:1500]}...
        
        This email appears to be part of an incomplete conversation. Please reconstruct the missing context and provide analysis:"""
        
        # Call REAL Phi-4
        llm_response = self.call_ollama("doomgrave/phi-4:14b-tools-Q3_K_S", llm_prompt, system_prompt)
        
        entities = []
        missing_context = []
        required_actions = []
        escalation_needed = False
        
        if llm_response:
            try:
                # Try to parse JSON response
                if '{' in llm_response and '}' in llm_response:
                    json_start = llm_response.find('{')
                    json_end = llm_response.rfind('}') + 1
                    json_str = llm_response[json_start:json_end]
                    llm_data = json.loads(json_str)
                    
                    entities = llm_data.get('entities', [])
                    missing_context = llm_data.get('missing_context', [])
                    required_actions = llm_data.get('required_actions', [])
                    escalation_needed = llm_data.get('escalation_needed', False)
                    
                    logger.info(f"Phi-4 reconstructed context with {len(entities)} entities")
                else:
                    # Fallback: extract key insights from text response
                    entities.append({
                        'type': 'complex_analysis',
                        'value': llm_response[:300],
                        'confidence': 0.8
                    })
                    
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse Phi-4 JSON, using text response")
                entities.append({
                    'type': 'complex_analysis',
                    'value': llm_response[:300],
                    'confidence': 0.7
                })
        else:
            # Fallback processing if LLM fails
            logger.warning("Phi-4 failed, using fallback")
            entities.append({'type': 'fallback_complex_analysis', 'confidence': 0.4})
        
        return {
            'entities': entities,
            'phase': 3,
            'method': 'phi_4_real',
            'confidence': 0.9 if llm_response else 0.4,
            'llm_used': 'doomgrave/phi-4:14b-tools-Q3_K_S',
            'missing_context': missing_context,
            'required_actions': required_actions,
            'escalation_needed': escalation_needed
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
        """Update database with REAL processing results"""
        if not results:
            return 0
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                update_data = []
                
                for result in results:
                    if not result:
                        continue
                        
                    analysis_metadata = {
                        'method': result['method'],
                        'confidence': result['confidence'],
                        'completeness_score': result['completeness_score'],
                        'llm_used': result.get('llm_used'),
                        'workflow_type': result.get('workflow_type'),
                        'priority': result.get('priority'),
                        'actionable_items': result.get('actionable_items', []),
                        'missing_context': result.get('missing_context', []),
                        'required_actions': result.get('required_actions', []),
                        'escalation_needed': result.get('escalation_needed', False)
                    }
                    
                    update_data.append((
                        'analyzed',  # status
                        result['phase'],  # phase_completed
                        json.dumps(result['entities']),  # extracted_entities
                        json.dumps(analysis_metadata),  # workflow_state
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
    
    def run_processing_pipeline(self, batch_size: int = 10):
        """Run the REAL LLM processing pipeline"""
        logger.info("Starting REAL LLM adaptive email processing pipeline")
        logger.info("This will make actual API calls to Ollama with Llama 3.2 and Phi-4")
        
        total_processed = 0
        batch_count = 0
        
        while True:
            # Get pending emails (smaller batches for LLM processing)
            emails = self.get_pending_emails(batch_size)
            if not emails:
                logger.info("No more pending emails to process")
                break
                
            logger.info(f"Processing batch {batch_count + 1}: {len(emails)} emails with REAL LLMs")
            
            # Process emails with REAL LLMs
            results = []
            for i, email in enumerate(emails):
                logger.info(f"Processing email {i+1}/{len(emails)} (ID: {email['id']})")
                result = self.process_email(email)
                if result:
                    results.append(result)
                
                # Small delay between LLM calls to avoid overwhelming
                if result and result.get('llm_used'):
                    time.sleep(1)
            
            # Update database
            updated = self.update_database(results)
            total_processed += updated
            
            # Show batch stats
            phase_dist = {}
            llm_calls = 0
            for result in results:
                if result:
                    phase = result['phase']
                    phase_dist[phase] = phase_dist.get(phase, 0) + 1
                    if result.get('llm_used'):
                        llm_calls += 1
            
            logger.info(f"Batch {batch_count + 1} complete: {updated} emails processed")
            logger.info(f"Phase distribution: {phase_dist}")
            logger.info(f"REAL LLM calls made: {llm_calls}")
            logger.info(f"Total LLM calls so far: {self.stats['llm_calls']}")
            
            batch_count += 1
            
            # Brief pause between batches
            time.sleep(2)
        
        # Final statistics
        logger.info("REAL LLM processing pipeline completed!")
        logger.info(f"Total processed: {self.stats['processed']}")
        logger.info(f"Phase 1 (Rule-based): {self.stats['phase1']}")
        logger.info(f"Phase 2 (REAL Llama 3.2): {self.stats['phase2']}")
        logger.info(f"Phase 3 (REAL Phi-4): {self.stats['phase3']}")
        logger.info(f"REAL LLM calls made: {self.stats['llm_calls']}")
        logger.info(f"LLM failures: {self.stats['llm_failures']}")
        logger.info(f"Errors: {self.stats['errors']}")
        
        return total_processed

def main():
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    processor = RealLLMProcessor(db_path)
    
    # Process with smaller batches due to LLM overhead
    total_processed = processor.run_processing_pipeline(batch_size=5)
    
    logger.info(f"\nREAL LLM processing completed: {total_processed} emails processed")

if __name__ == '__main__':
    main()