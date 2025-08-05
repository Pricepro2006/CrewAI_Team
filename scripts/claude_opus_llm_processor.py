#!/usr/bin/env python3
"""
Claude Opus-Level Email Processing with Optimized Llama 3.2:3b Prompts
Implements business intelligence extraction with maximum actionable insights
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

class ClaudeOpusLLMProcessor:
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
            'llm_failures': 0,
            'json_parse_success': 0,
            'json_parse_failures': 0,
            'business_insights_extracted': 0
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
                logger.info(f"🚀 Ollama connected. Available models: {available_models}")
                
                # Check for required models
                if 'llama3.2:3b' not in available_models:
                    logger.warning("⚠️  llama3.2:3b not found - Phase 2 will use fallback")
                if 'doomgrave/phi-4:14b-tools-Q3_K_S' not in available_models:
                    logger.warning("⚠️  phi-4 not found - Phase 3 will use fallback")
            else:
                logger.error("❌ Ollama not responding properly")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Ollama: {e}")
    
    def get_system_prompt(self) -> str:
        """Claude Opus-optimized system prompt for business intelligence"""
        return """You are an expert business email analyst for TD SYNNEX, specializing in extracting maximum actionable intelligence from email communications. You excel at identifying business patterns, financial opportunities, and workflow states with precision.

CORE COMPETENCIES:
- Business entity extraction (POs, quotes, SKUs, amounts, dates)
- Workflow state detection (quote→order→delivery chains)  
- Priority assessment based on business impact
- Relationship mapping between stakeholders
- Risk and opportunity identification

RESPONSE FORMAT: Always respond with valid JSON containing these exact fields:
{
  "priority": "Critical|High|Medium|Low",
  "workflow_type": "Quote Request|Order Processing|Support Ticket|General Inquiry|Escalation",
  "workflow_state": "START_POINT|IN_PROGRESS|COMPLETION",
  "business_entities": {
    "po_numbers": [],
    "quote_numbers": [],
    "order_numbers": [],
    "tracking_numbers": [],
    "amounts": [{"value": 0, "currency": "USD"}],
    "products": [],
    "customers": [],
    "dates": [{"date": "string", "context": "string"}]
  },
  "actionable_items": [
    {
      "action": "string",
      "owner": "string", 
      "deadline": "string|null",
      "business_impact": "High|Medium|Low"
    }
  ],
  "financial_intelligence": {
    "estimated_value": 0,
    "revenue_opportunity": "High|Medium|Low|None",
    "risk_level": "High|Medium|Low|None",
    "budget_mentioned": false
  },
  "stakeholders": {
    "decision_makers": [],
    "technical_contacts": [],
    "procurement_contacts": []
  },
  "summary": "string - 2 sentence max",
  "confidence": 0.0,
  "chain_completeness": 0.0
}

BUSINESS PRIORITY RULES:
- Critical: Return requests, system outages, expiring deals (<7 days), urgent orders
- High: Quote requests, PO processing, important customer escalations
- Medium: Order updates, shipping notifications, routine inquiries  
- Low: Reports, newsletters, FYI communications

WORKFLOW DETECTION PATTERNS:
- Quote Request: "quote", "pricing", "rfq", "request for quote", "need pricing"
- Order Processing: "po ", "purchase order", "order #", tracking numbers
- Support Ticket: "issue", "problem", "not working", "help with"
- Escalation: "urgent", "management", "escalate", "critical"

Extract maximum business value from every email with precision and efficiency."""

    def create_optimized_prompt(self, email: Dict, email_type: str) -> str:
        """Create optimized prompt based on email type and business context"""
        
        subject = email.get('subject', '')
        body_content = email.get('body_content', '')
        sender_email = email.get('sender_email', '')
        received_date = email.get('received_date_time', '')
        completeness_score = email.get('chain_completeness_score', 0.0)
        
        # Detect email type based on content if not provided
        if not email_type:
            email_type = self.detect_email_type(subject, body_content)
        
        base_context = f"""SUBJECT: {subject}
FROM: {sender_email}
RECEIVED: {received_date}
CHAIN_COMPLETENESS: {completeness_score:.3f}
BODY: {body_content[:1200]}..."""
        
        if email_type == "Quote Request":
            return f"""Analyze this quote request email for maximum business intelligence extraction:

{base_context}

FOCUS AREAS:
1. Extract specific product requirements and quantities
2. Identify budget indicators and timeline constraints  
3. Assess deal size and revenue potential
4. Map stakeholder roles and decision-making authority
5. Detect competitive pressures or alternatives mentioned
6. Identify technical requirements or constraints
7. Assess urgency signals and response timeline expectations

Provide comprehensive JSON analysis optimized for sales team action."""

        elif email_type == "Order Processing":
            return f"""Analyze this order-related email for operational intelligence:

{base_context}

OPERATIONAL FOCUS:
1. Track order progression state and next steps
2. Identify delivery expectations and constraints
3. Extract shipping/logistics requirements
4. Detect potential fulfillment issues or delays
5. Map approval chains and authorization levels
6. Assess customer satisfaction indicators
7. Flag escalation triggers or service level risks

Return JSON with detailed operational workflow mapping."""

        elif email_type == "Support Ticket":
            return f"""Analyze this support email for issue resolution intelligence:

{base_context}

SUPPORT FOCUS:
1. Categorize issue type and technical severity
2. Extract system/product details and error conditions
3. Assess business impact and affected user count
4. Identify required expertise and escalation paths
5. Map customer environment and configuration details
6. Estimate resolution complexity and timeline
7. Detect relationship to ongoing cases or known issues

Provide JSON with detailed support workflow and resource allocation guidance."""

        elif email_type == "Escalation":
            return f"""Analyze this escalation email for urgent resolution intelligence:

{base_context}

ESCALATION FOCUS:
1. Identify root cause and escalation triggers
2. Assess business impact and affected stakeholders
3. Map decision-making authority and approval chains
4. Extract timeline constraints and SLA requirements
5. Identify required resources and expertise
6. Assess relationship risk and customer satisfaction impact
7. Flag executive communication and update requirements

Return JSON with executive-level escalation management guidance."""

        else:  # General Inquiry
            return f"""Analyze this business email for strategic intelligence extraction:

{base_context}

STRATEGIC FOCUS:
1. Identify business development opportunities
2. Extract partnership or vendor relationship insights  
3. Assess competitive intelligence and market signals
4. Map organizational changes and personnel updates
5. Detect policy changes or process modifications
6. Identify knowledge sharing or training opportunities
7. Flag strategic risks or compliance considerations

Return comprehensive JSON with business intelligence insights and strategic recommendations."""

    def detect_email_type(self, subject: str, body: str) -> str:
        """Detect email type based on content patterns"""
        content = f"{subject} {body}".lower()
        
        # Quote patterns
        if any(word in content for word in ['quote', 'pricing', 'rfq', 'request for quote', 'need pricing', 'price list']):
            return "Quote Request"
        
        # Order patterns  
        if any(word in content for word in ['po ', 'purchase order', 'order #', 'tracking', 'delivery', 'shipment']):
            return "Order Processing"
            
        # Support patterns
        if any(word in content for word in ['issue', 'problem', 'not working', 'help with', 'support', 'error', 'bug']):
            return "Support Ticket"
            
        # Escalation patterns
        if any(word in content for word in ['urgent', 'critical', 'escalate', 'management', 'asap', 'emergency']):
            return "Escalation"
        
        return "General Inquiry"

    def call_ollama(self, model: str, prompt: str, system: str = None) -> Optional[str]:
        """Make actual API call to Ollama with optimized settings"""
        try:
            self.stats['llm_calls'] += 1
            
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2,  # Lower for consistent business analysis
                    "top_p": 0.8,
                    "num_predict": 800,   # Enough for detailed JSON response
                    "repeat_penalty": 1.1,
                    "stop": ["\n\n---", "Human:", "Assistant:"]
                }
            }
            
            if system:
                payload["system"] = system
            
            logger.debug(f"🤖 Calling {model} with {len(prompt)} chars")
            
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=300  # 5 minutes for complex analysis - no timeouts
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '').strip()
            else:
                logger.error(f"❌ Ollama API error: {response.status_code}")
                self.stats['llm_failures'] += 1
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to call {model}: {e}")
            self.stats['llm_failures'] += 1
            return None

    def parse_llm_response(self, response: str) -> Optional[Dict]:
        """Parse LLM response with robust JSON extraction"""
        if not response:
            return None
            
        try:
            # Try to find JSON in response
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                parsed_data = json.loads(json_str)
                self.stats['json_parse_success'] += 1
                return parsed_data
            else:
                logger.warning("No JSON found in LLM response")
                self.stats['json_parse_failures'] += 1
                return None
                
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}")
            self.stats['json_parse_failures'] += 1
            
            # Try to extract partial data from text response
            return self.extract_partial_data(response)
    
    def extract_partial_data(self, response: str) -> Dict:
        """Extract partial data when JSON parsing fails"""
        # Create basic structure with extracted insights
        partial_data = {
            "priority": "Medium",
            "workflow_type": "General Inquiry", 
            "workflow_state": "IN_PROGRESS",
            "business_entities": {
                "po_numbers": [],
                "quote_numbers": [],
                "order_numbers": [],
                "tracking_numbers": [],
                "amounts": [],
                "products": [],
                "customers": [],
                "dates": []
            },
            "actionable_items": [
                {
                    "action": "Review and process email manually",
                    "owner": "Operations Team",
                    "deadline": "24 hours",
                    "business_impact": "Medium"
                }
            ],
            "financial_intelligence": {
                "estimated_value": 0,
                "revenue_opportunity": "None",
                "risk_level": "Low",
                "budget_mentioned": False
            },
            "stakeholders": {
                "decision_makers": [],
                "technical_contacts": [],
                "procurement_contacts": []
            },
            "summary": response[:150],
            "confidence": 0.3,
            "chain_completeness": 0.5
        }
        
        return partial_data

    def get_pending_emails(self, limit: int = 20) -> List[Dict]:
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
            logger.error(f"❌ Failed to get pending emails: {e}")
            return []

    def determine_phase(self, completeness_score: float) -> int:
        """Determine processing phase based on completeness score"""
        if completeness_score >= 0.7:
            return 2  # High completeness - Llama 3.2 processing (MAXIMUM ANALYSIS)
        elif completeness_score >= 0.3:
            return 2  # Medium completeness - Llama 3.2 processing  
        else:
            return 3  # Low completeness - Phi-4 processing (COMPLEX RECONSTRUCTION)

    def process_phase1(self, email: Dict) -> Dict[str, Any]:
        """Rule-based processing for high completeness emails"""
        logger.debug(f"📋 Phase 1 (Rule-based): {email['id']}")
        
        entities = []
        content = f"{email.get('subject', '')} {email.get('body_content', '')}".lower()
        
        # Enhanced rule-based extraction
        if any(word in content for word in ['meeting', 'call', 'schedule', 'calendar']):
            entities.append({'type': 'meeting', 'confidence': 0.8, 'value': 'meeting_scheduled'})
        
        if any(word in content for word in ['price', 'quote', 'cost', '$', 'budget']):
            entities.append({'type': 'financial', 'confidence': 0.9, 'value': 'financial_discussion'})
            
        if any(word in content for word in ['urgent', 'asap', 'deadline', 'critical']):
            entities.append({'type': 'urgent', 'confidence': 0.8, 'value': 'time_sensitive'})
            
        if any(word in content for word in ['order', 'purchase', 'po', 'procurement']):
            entities.append({'type': 'order', 'confidence': 0.9, 'value': 'order_related'})

        # Business intelligence for rule-based
        estimated_value = 0
        if 'quote' in content or 'pricing' in content:
            estimated_value = 5000  # Default quote value
        
        return {
            'entities': entities,
            'phase': 1,
            'method': 'rule_based_enhanced',
            'confidence': 0.8 if entities else 0.4,
            'llm_used': None,
            'business_intelligence': {
                'estimated_value': estimated_value,
                'actionable_items': len([e for e in entities if e['type'] in ['urgent', 'financial', 'order']])
            }
        }

    def process_phase2(self, email: Dict) -> Dict[str, Any]:
        """REAL Llama 3.2 processing with Claude Opus-level prompts"""
        logger.info(f"🦙 Phase 2 (REAL Llama 3.2): {email['id']}")
        
        # Detect email type for optimized prompting
        email_type = self.detect_email_type(email.get('subject', ''), email.get('body_content', ''))
        logger.info(f"📧 Detected email type: {email_type}")
        
        # Create optimized prompt
        system_prompt = self.get_system_prompt()
        user_prompt = self.create_optimized_prompt(email, email_type)
        
        # Call REAL Llama 3.2
        start_time = datetime.now()
        llm_response = self.call_ollama("llama3.2:3b", user_prompt, system_prompt)
        end_time = datetime.now()
        
        processing_time = (end_time - start_time).total_seconds()
        
        if llm_response:
            logger.info(f"✅ Llama 3.2 responded in {processing_time:.1f}s with {len(llm_response)} chars")
            
            # Parse JSON response
            parsed_data = self.parse_llm_response(llm_response)
            
            if parsed_data:
                self.stats['business_insights_extracted'] += 1
                entities = parsed_data.get('business_entities', {})
                actionable_items = parsed_data.get('actionable_items', [])
                
                logger.info(f"🎯 Extracted: {len(actionable_items)} actionable items, ${parsed_data.get('financial_intelligence', {}).get('estimated_value', 0)} estimated value")
                
                return {
                    'entities': entities,
                    'phase': 2,
                    'method': 'llama_3_2_claude_opus',
                    'confidence': parsed_data.get('confidence', 0.85),
                    'llm_used': 'llama3.2:3b',
                    'processing_time': processing_time,
                    'business_intelligence': parsed_data.get('financial_intelligence', {}),
                    'actionable_items': actionable_items,
                    'workflow_analysis': {
                        'type': parsed_data.get('workflow_type'),
                        'state': parsed_data.get('workflow_state'),
                        'priority': parsed_data.get('priority')
                    },
                    'stakeholders': parsed_data.get('stakeholders', {}),
                    'summary': parsed_data.get('summary', ''),
                    'email_type': email_type
                }
            else:
                logger.warning("❌ Failed to parse Llama 3.2 JSON response")
                # Fallback with basic analysis
                return {
                    'entities': [{'type': 'llm_analysis', 'value': llm_response[:200]}],
                    'phase': 2,
                    'method': 'llama_3_2_fallback',
                    'confidence': 0.4,
                    'llm_used': 'llama3.2:3b',
                    'processing_time': processing_time,
                    'email_type': email_type
                }
        else:
            logger.error("❌ Llama 3.2 call failed")
            return {
                'entities': [{'type': 'llm_failure', 'value': 'Llama 3.2 processing failed'}],
                'phase': 2,
                'method': 'llm_failure_fallback', 
                'confidence': 0.2,
                'llm_used': None,
                'processing_time': processing_time,
                'email_type': email_type
            }

    def process_phase3(self, email: Dict) -> Dict[str, Any]:
        """REAL Phi-4 processing for complex analysis"""
        logger.info(f"🔥 Phase 3 (REAL Phi-4): {email['id']}")
        
        # Enhanced Phi-4 system prompt for complex analysis
        phi4_system = """You are an expert email workflow analyst specializing in incomplete or broken email chains for TD SYNNEX.

Your task is to analyze fragmented emails and reconstruct missing context:
- Identify what information is missing from the conversation
- Infer the original request or issue being discussed  
- Suggest what actions are needed to complete the workflow
- Identify escalation requirements
- Extract complex business relationships and dependencies

Return detailed JSON analysis with the same format as specified earlier, but focus on:
- missing_context: array of what's missing
- inferred_workflow: description of likely workflow
- reconstruction_confidence: 0.0-1.0
- required_actions: specific next steps
- escalation_needed: boolean
- business_impact: High|Medium|Low

Extract maximum business intelligence from incomplete information."""

        # Create Phi-4 optimized prompt
        subject = email.get('subject', '')
        body = email.get('body_content', '')
        completeness_score = email.get('chain_completeness_score', 0.0)
        
        phi4_prompt = f"""Analyze this incomplete/broken email chain (completeness: {completeness_score:.2f}):

SUBJECT: {subject}
BODY: {body[:1500]}...

This email appears to be part of an incomplete conversation. Please reconstruct the missing context and provide comprehensive business analysis with maximum actionable intelligence extraction."""

        # Call REAL Phi-4
        start_time = datetime.now()
        llm_response = self.call_ollama("doomgrave/phi-4:14b-tools-Q3_K_S", phi4_prompt, phi4_system)
        end_time = datetime.now()
        
        processing_time = (end_time - start_time).total_seconds()
        
        if llm_response:
            logger.info(f"✅ Phi-4 responded in {processing_time:.1f}s with {len(llm_response)} chars")
            
            # Parse complex analysis
            parsed_data = self.parse_llm_response(llm_response)
            
            if parsed_data:
                return {
                    'entities': parsed_data.get('business_entities', {}),
                    'phase': 3,
                    'method': 'phi_4_claude_opus',
                    'confidence': parsed_data.get('confidence', 0.9),
                    'llm_used': 'doomgrave/phi-4:14b-tools-Q3_K_S',
                    'processing_time': processing_time,
                    'complex_analysis': {
                        'missing_context': parsed_data.get('missing_context', []),
                        'required_actions': parsed_data.get('required_actions', []),
                        'escalation_needed': parsed_data.get('escalation_needed', False)
                    },
                    'business_intelligence': parsed_data.get('financial_intelligence', {}),
                    'reconstruction_confidence': parsed_data.get('chain_completeness', 0.7)
                }
            else:
                # Fallback for Phi-4
                return {
                    'entities': [{'type': 'complex_analysis', 'value': llm_response[:300]}],
                    'phase': 3,
                    'method': 'phi_4_fallback',
                    'confidence': 0.6,
                    'llm_used': 'doomgrave/phi-4:14b-tools-Q3_K_S',
                    'processing_time': processing_time
                }
        else:
            logger.error("❌ Phi-4 call failed")
            return {
                'entities': [{'type': 'phi4_failure', 'value': 'Phi-4 processing failed'}],
                'phase': 3,
                'method': 'phi4_failure_fallback',
                'confidence': 0.3,
                'llm_used': None,
                'processing_time': processing_time
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
            logger.error(f"❌ Failed to process email {email['id']}: {e}")
            self.stats['errors'] += 1
            return None

    def update_database(self, results: List[Dict]) -> int:
        """Update database with Claude Opus-level analysis results"""
        if not results:
            return 0
            
        try:
            with sqlite3.connect(self.db_path) as conn:
                update_data = []
                
                for result in results:
                    if not result:
                        continue
                        
                    # Enhanced metadata with business intelligence
                    analysis_metadata = {
                        'method': result['method'],
                        'confidence': result['confidence'],
                        'completeness_score': result['completeness_score'],
                        'llm_used': result.get('llm_used'),
                        'processing_time': result.get('processing_time'),
                        'business_intelligence': result.get('business_intelligence', {}),
                        'actionable_items': result.get('actionable_items', []),
                        'workflow_analysis': result.get('workflow_analysis', {}),
                        'stakeholders': result.get('stakeholders', {}),
                        'complex_analysis': result.get('complex_analysis', {}),
                        'email_type': result.get('email_type'),
                        'summary': result.get('summary', '')
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
            logger.error(f"❌ Failed to update database: {e}")
            return 0
        
        return 0

    def run_processing_pipeline(self, batch_size: int = 10):
        """Run the Claude Opus-level LLM processing pipeline"""
        logger.info("🚀 Starting Claude Opus-Level Email Processing Pipeline")
        logger.info("📧 Using optimized prompts for maximum business intelligence extraction")
        
        total_processed = 0
        batch_count = 0
        
        while True:
            # Get pending emails
            emails = self.get_pending_emails(batch_size)
            if not emails:
                logger.info("✅ No more pending emails to process")
                break
                
            logger.info(f"🔄 Processing batch {batch_count + 1}: {len(emails)} emails with Claude Opus-level analysis")
            
            # Process emails with optimized LLMs
            results = []
            for i, email in enumerate(emails):
                logger.info(f"📧 Processing email {i+1}/{len(emails)} (ID: {email['id'][:20]}...)")
                result = self.process_email(email)
                if result:
                    results.append(result)
                
                # Controlled delay between LLM calls
                if result and result.get('llm_used'):
                    time.sleep(2)
            
            # Update database
            updated = self.update_database(results)
            total_processed += updated
            
            # Show detailed batch stats
            phase_dist = {}
            llm_calls = 0
            business_insights = 0
            total_value = 0
            
            for result in results:
                if result:
                    phase = result['phase']
                    phase_dist[phase] = phase_dist.get(phase, 0) + 1
                    if result.get('llm_used'):
                        llm_calls += 1
                    if result.get('business_intelligence'):
                        business_insights += 1
                        total_value += result.get('business_intelligence', {}).get('estimated_value', 0)
            
            logger.info(f"✅ Batch {batch_count + 1} complete: {updated} emails processed")
            logger.info(f"📊 Phase distribution: {phase_dist}")
            logger.info(f"🤖 REAL LLM calls made: {llm_calls}")
            logger.info(f"💰 Business insights extracted: {business_insights}")
            logger.info(f"💵 Total estimated value: ${total_value:,.2f}")
            logger.info(f"🔢 Total LLM calls so far: {self.stats['llm_calls']}")
            
            batch_count += 1
            
            # Brief pause between batches
            time.sleep(3)
        
        # Final comprehensive statistics
        logger.info("🎉 Claude Opus-Level Processing Pipeline Completed!")
        logger.info(f"📊 FINAL STATISTICS:")
        logger.info(f"  📧 Total processed: {self.stats['processed']}")
        logger.info(f"  📋 Phase 1 (Rule-based): {self.stats['phase1']}")
        logger.info(f"  🦙 Phase 2 (REAL Llama 3.2): {self.stats['phase2']}")
        logger.info(f"  🔥 Phase 3 (REAL Phi-4): {self.stats['phase3']}")
        logger.info(f"  🤖 REAL LLM calls made: {self.stats['llm_calls']}")
        logger.info(f"  ✅ JSON parse success: {self.stats['json_parse_success']}")
        logger.info(f"  ❌ JSON parse failures: {self.stats['json_parse_failures']}")
        logger.info(f"  💡 Business insights extracted: {self.stats['business_insights_extracted']}")
        logger.info(f"  ❌ LLM failures: {self.stats['llm_failures']}")
        logger.info(f"  🔧 Processing errors: {self.stats['errors']}")
        
        return total_processed

def main():
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    processor = ClaudeOpusLLMProcessor(db_path)
    
    # Process with optimized batch size
    total_processed = processor.run_processing_pipeline(batch_size=8)
    
    logger.info(f"🎯 Claude Opus-Level processing completed: {total_processed} emails processed with maximum business intelligence extraction")

if __name__ == '__main__':
    main()