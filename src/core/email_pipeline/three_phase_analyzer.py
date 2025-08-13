"""
Three-Phase Email Analyzer for Email Pipeline Project

This module implements a three-phase analysis system for processing email batches:
- Phase 1: Quick Classification
- Phase 2: Deep Analysis  
- Phase 3: Final Enrichment

Results are saved to the CrewAI database email_analysis table.
"""

import json
import logging
import os
import re
import shutil
import sqlite3
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ThreePhaseEmailAnalyzer:
    """
    Analyzes email batches through three phases and saves results to CrewAI database.
    """
    
    def __init__(self):
        self.batch_dir = Path("/home/pricepro2006/CrewAI_Team/test-email-batches")
        self.processed_dir = Path("/home/pricepro2006/CrewAI_Team/processed-test-email-batches")
        self.crewai_db_path = "/home/pricepro2006/CrewAI_Team/crewai.db"
        
        # Create processed directory if it doesn't exist
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        
        # Workflow patterns for classification
        self.workflow_patterns = {
            "Order Management": [
                r"order\s*#?\s*\d+", r"purchase\s*order", r"PO\s*#?\s*\d+",
                r"order\s*status", r"order\s*confirmation", r"shipping",
                r"delivery", r"tracking", r"invoice"
            ],
            "Quote Processing": [
                r"quote\s*#?\s*\d+", r"quotation", r"pricing",
                r"quote\s*request", r"RFQ", r"estimate", r"proposal",
                r"quote\s*status", r"quote\s*approval"
            ],
            "Customer Support": [
                r"case\s*#?\s*\d+", r"ticket\s*#?\s*\d+", r"issue",
                r"problem", r"help", r"support", r"complaint",
                r"resolution", r"escalation"
            ],
            "Product Information": [
                r"product\s*info", r"specification", r"datasheet",
                r"part\s*number", r"SKU", r"availability",
                r"stock", r"inventory"
            ],
            "Account Management": [
                r"account", r"billing", r"payment", r"credit",
                r"statement", r"balance", r"renewal", r"contract"
            ],
            "Technical Support": [
                r"technical", r"configuration", r"setup",
                r"installation", r"error", r"debug", r"troubleshoot"
            ]
        }
        
        # Priority indicators
        self.priority_indicators = {
            "Critical": [
                r"urgent", r"critical", r"emergency", r"immediate",
                r"asap", r"high\s*priority", r"escalate"
            ],
            "High": [
                r"important", r"priority", r"expedite", r"rush",
                r"deadline", r"time\s*sensitive"
            ],
            "Medium": [
                r"normal", r"standard", r"regular", r"routine"
            ],
            "Low": [
                r"low\s*priority", r"when\s*possible", r"no\s*rush",
                r"informational", r"fyi"
            ]
        }
        
        # Intent patterns
        self.intent_patterns = {
            "Request Information": [r"what", r"when", r"where", r"how", r"please\s*provide", r"need\s*info"],
            "Place Order": [r"order", r"purchase", r"buy", r"procure"],
            "Request Quote": [r"quote", r"pricing", r"cost", r"estimate"],
            "Report Issue": [r"problem", r"issue", r"error", r"not\s*working"],
            "Check Status": [r"status", r"update", r"progress", r"tracking"],
            "Request Support": [r"help", r"assist", r"support", r"guidance"],
            "Cancel/Change": [r"cancel", r"change", r"modify", r"update"],
            "Complaint": [r"complaint", r"dissatisfied", r"unhappy", r"disappointed"]
        }
        
        # Workflow states
        self.workflow_states = [
            "NEW", "IN_PROGRESS", "PENDING_RESPONSE", "ESCALATED",
            "ON_HOLD", "RESOLVED", "CLOSED"
        ]

    def process_batch_file(self, batch_file_path: str) -> bool:
        """
        Process a single batch file through all three phases.
        
        Args:
            batch_file_path: Path to the batch JSON file
            
        Returns:
            bool: True if processing successful, False otherwise
        """
        start_time = time.time()
        
        try:
            logger.info(f"Processing batch file: {batch_file_path}")
            
            # Load batch data
            with open(batch_file_path, 'r', encoding='utf-8') as f:
                batch_data = json.load(f)
            
            # Handle both formats: array directly or object with 'emails' key
            if isinstance(batch_data, list):
                emails = batch_data
            else:
                emails = batch_data.get('emails', [])
            if not emails:
                logger.warning(f"No emails found in batch: {batch_file_path}")
                return False
            
            logger.info(f"Processing {len(emails)} emails from batch")
            
            # Process each email through all phases
            analysis_results = []
            
            for email in emails:
                email_start_time = time.time()
                
                # Phase 1: Quick Classification
                phase1_results = self.analyze_batch_phase1(email)
                
                # Phase 2: Deep Analysis
                phase2_results = self.analyze_batch_phase2(email, phase1_results)
                
                # Phase 3: Final Enrichment
                phase3_results = self.analyze_batch_phase3(email, phase1_results, phase2_results)
                
                # Combine all results
                total_time = time.time() - email_start_time
                
                analysis_result = {
                    'id': str(uuid.uuid4()),
                    'email_id': email.get('id', str(uuid.uuid4())),
                    **phase1_results,
                    **phase2_results,
                    **phase3_results,
                    'total_processing_time': round(total_time, 3),
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                
                analysis_results.append(analysis_result)
            
            # Save all results to database
            success = self.save_to_crewai_database(analysis_results)
            
            if success:
                # Move batch file to processed directory
                batch_filename = os.path.basename(batch_file_path)
                processed_path = self.processed_dir / batch_filename
                shutil.move(batch_file_path, processed_path)
                logger.info(f"Moved batch file to: {processed_path}")
                
                total_time = time.time() - start_time
                logger.info(f"Successfully processed batch in {total_time:.2f} seconds")
                return True
            else:
                logger.error("Failed to save results to database")
                return False
                
        except Exception as e:
            logger.error(f"Error processing batch file: {e}", exc_info=True)
            return False

    def analyze_batch_phase1(self, email: Dict) -> Dict:
        """
        Phase 1: Quick Classification
        
        Args:
            email: Email data dictionary
            
        Returns:
            Dict with quick classification results
        """
        start_time = time.time()
        
        subject = email.get('subject', '').lower()
        body = email.get('body', '').lower()
        full_text = f"{subject} {body}"
        
        # Workflow classification
        workflow_scores = {}
        for workflow, patterns in self.workflow_patterns.items():
            score = sum(1 for pattern in patterns if re.search(pattern, full_text, re.I))
            if score > 0:
                workflow_scores[workflow] = score
        
        quick_workflow = max(workflow_scores.items(), key=lambda x: x[1])[0] if workflow_scores else "General"
        
        # Priority determination
        priority_scores = {}
        for priority, patterns in self.priority_indicators.items():
            score = sum(1 for pattern in patterns if re.search(pattern, full_text, re.I))
            if score > 0:
                priority_scores[priority] = score
        
        quick_priority = max(priority_scores.items(), key=lambda x: x[1])[0] if priority_scores else "Medium"
        
        # Intent extraction
        intent_scores = {}
        for intent, patterns in self.intent_patterns.items():
            score = sum(1 for pattern in patterns if re.search(pattern, full_text, re.I))
            if score > 0:
                intent_scores[intent] = score
        
        quick_intent = max(intent_scores.items(), key=lambda x: x[1])[0] if intent_scores else "General Inquiry"
        
        # Urgency assessment
        urgency_keywords = ["urgent", "asap", "immediate", "critical", "emergency"]
        quick_urgency = "High" if any(keyword in full_text for keyword in urgency_keywords) else "Normal"
        
        # Confidence score (based on pattern matches)
        total_matches = sum(workflow_scores.values()) + sum(priority_scores.values()) + sum(intent_scores.values())
        quick_confidence = min(0.95, 0.3 + (total_matches * 0.05))  # Base 0.3, cap at 0.95
        
        # Suggested workflow state
        if "new" in subject or email.get('is_read') is False:
            quick_suggested_state = "NEW"
        elif any(word in full_text for word in ["resolved", "closed", "completed"]):
            quick_suggested_state = "RESOLVED"
        else:
            quick_suggested_state = "IN_PROGRESS"
        
        processing_time = time.time() - start_time
        
        return {
            'quick_workflow': quick_workflow,
            'quick_priority': quick_priority,
            'quick_intent': quick_intent,
            'quick_urgency': quick_urgency,
            'quick_confidence': round(quick_confidence, 2),
            'quick_suggested_state': quick_suggested_state,
            'quick_model': 'rule-based-v1',
            'quick_processing_time': round(processing_time, 3)
        }

    def analyze_batch_phase2(self, email: Dict, phase1_results: Dict) -> Dict:
        """
        Phase 2: Deep Analysis
        
        Args:
            email: Email data dictionary
            phase1_results: Results from Phase 1
            
        Returns:
            Dict with deep analysis results
        """
        start_time = time.time()
        
        subject = email.get('subject', '')
        body = email.get('body', '')
        full_text = f"{subject} {body}"
        
        # Extract entities
        entities = self._extract_entities(full_text)
        
        # Identify action items
        action_items = self._extract_action_items(full_text, phase1_results['quick_priority'])
        
        # Determine workflow state
        workflow_state = self._determine_workflow_state(email, phase1_results, entities)
        
        # Assess business impact
        business_impact = self._assess_business_impact(phase1_results, entities, action_items)
        
        # Create contextual summary
        contextual_summary = self._create_contextual_summary(email, phase1_results, entities)
        
        # Generate suggested response
        suggested_response = self._generate_suggested_response(phase1_results, entities, workflow_state)
        
        # Find related emails (placeholder for now)
        related_emails = []
        
        # Deep workflow classification (more nuanced)
        deep_workflow_primary = phase1_results['quick_workflow']
        deep_workflow_secondary = self._find_secondary_workflow(full_text, deep_workflow_primary)
        deep_workflow_related = [deep_workflow_secondary] if deep_workflow_secondary else []
        
        # Deep confidence (adjusted based on entity extraction success)
        entity_count = sum(len(v) for v in entities.values() if isinstance(v, list))
        deep_confidence = min(0.95, phase1_results['quick_confidence'] + (entity_count * 0.02))
        
        processing_time = time.time() - start_time
        
        return {
            'deep_workflow_primary': deep_workflow_primary,
            'deep_workflow_secondary': deep_workflow_secondary,
            'deep_workflow_related': json.dumps(deep_workflow_related),
            'deep_confidence': round(deep_confidence, 2),
            'entities_po_numbers': json.dumps(entities['po_numbers']),
            'entities_quote_numbers': json.dumps(entities['quote_numbers']),
            'entities_case_numbers': json.dumps(entities['case_numbers']),
            'entities_part_numbers': json.dumps(entities['part_numbers']),
            'entities_order_references': json.dumps(entities['order_references']),
            'entities_contacts': json.dumps(entities['contacts']),
            'action_items': json.dumps(action_items),
            'workflow_state': workflow_state,
            'business_impact': business_impact,
            'contextual_summary': contextual_summary,
            'suggested_response': suggested_response,
            'related_emails': json.dumps(related_emails),
            'deep_processing_time': round(processing_time, 3)
        }

    def analyze_batch_phase3(self, email: Dict, phase1_results: Dict, phase2_results: Dict) -> Dict:
        """
        Phase 3: Final Enrichment
        
        Args:
            email: Email data dictionary
            phase1_results: Results from Phase 1
            phase2_results: Results from Phase 2
            
        Returns:
            Dict with final enrichment results
        """
        # Quality scoring
        quality_score = self._calculate_quality_score(email, phase1_results, phase2_results)
        
        # Confidence validation
        final_confidence = self._validate_confidence(phase1_results, phase2_results, quality_score)
        
        # Flag for review
        needs_review = self._needs_review(phase1_results, phase2_results, quality_score)
        
        return {
            'quality_score': round(quality_score, 2),
            'final_confidence': round(final_confidence, 2),
            'needs_review': needs_review
        }

    def _extract_entities(self, text: str) -> Dict[str, List]:
        """Extract various entities from email text."""
        entities = {
            'po_numbers': [],
            'quote_numbers': [],
            'case_numbers': [],
            'part_numbers': [],
            'order_references': [],
            'contacts': []
        }
        
        # PO Numbers (various formats)
        po_patterns = [
            r'PO\s*#?\s*(\d{4,})',
            r'Purchase\s*Order\s*#?\s*(\d{4,})',
            r'P\.O\.\s*(\d{4,})'
        ]
        for pattern in po_patterns:
            matches = re.findall(pattern, text, re.I)
            entities['po_numbers'].extend(matches)
        
        # Quote Numbers
        quote_patterns = [
            r'Quote\s*#?\s*(\d{4,})',
            r'Quotation\s*#?\s*(\d{4,})',
            r'RFQ\s*#?\s*(\d{4,})'
        ]
        for pattern in quote_patterns:
            matches = re.findall(pattern, text, re.I)
            entities['quote_numbers'].extend(matches)
        
        # Case Numbers
        case_patterns = [
            r'Case\s*#?\s*(\d{4,})',
            r'Ticket\s*#?\s*(\d{4,})',
            r'SR\s*#?\s*(\d{4,})'
        ]
        for pattern in case_patterns:
            matches = re.findall(pattern, text, re.I)
            entities['case_numbers'].extend(matches)
        
        # Part Numbers (alphanumeric)
        part_patterns = [
            r'Part\s*#?\s*([A-Z0-9]{4,})',
            r'SKU\s*:?\s*([A-Z0-9]{4,})',
            r'Item\s*#?\s*([A-Z0-9]{4,})'
        ]
        for pattern in part_patterns:
            matches = re.findall(pattern, text, re.I)
            entities['part_numbers'].extend(matches)
        
        # Order References
        order_patterns = [
            r'Order\s*#?\s*(\d{4,})',
            r'Ref\s*#?\s*(\d{4,})',
            r'Reference\s*:?\s*(\d{4,})'
        ]
        for pattern in order_patterns:
            matches = re.findall(pattern, text, re.I)
            entities['order_references'].extend(matches)
        
        # Email addresses as contacts
        email_pattern = r'[\w\.-]+@[\w\.-]+\.\w+'
        emails = re.findall(email_pattern, text)
        entities['contacts'].extend([{'email': email, 'type': 'email'} for email in emails])
        
        # Phone numbers as contacts
        phone_pattern = r'(?:\+?1[-.]?)?\(?(\d{3})\)?[-.]?(\d{3})[-.]?(\d{4})'
        phones = re.findall(phone_pattern, text)
        for phone in phones:
            phone_str = ''.join(phone)
            entities['contacts'].append({'phone': phone_str, 'type': 'phone'})
        
        # Remove duplicates
        for key in entities:
            if key == 'contacts':
                # For contacts, remove duplicates based on the value
                seen = set()
                unique_contacts = []
                for contact in entities[key]:
                    contact_str = json.dumps(contact, sort_keys=True)
                    if contact_str not in seen:
                        seen.add(contact_str)
                        unique_contacts.append(contact)
                entities[key] = unique_contacts
            else:
                entities[key] = list(set(entities[key]))
        
        return entities

    def _extract_action_items(self, text: str, priority: str) -> List[Dict]:
        """Extract action items from email text."""
        action_items = []
        
        # Action patterns
        action_patterns = [
            r'please\s+(.+?)(?:\.|$)',
            r'need\s+(?:you\s+)?to\s+(.+?)(?:\.|$)',
            r'could\s+you\s+(.+?)(?:\.|$)',
            r'can\s+you\s+(.+?)(?:\.|$)',
            r'(?:we|I)\s+need\s+(.+?)(?:\.|$)',
            r'action\s*required\s*:?\s*(.+?)(?:\.|$)'
        ]
        
        for pattern in action_patterns:
            matches = re.findall(pattern, text, re.I | re.MULTILINE)
            for match in matches:
                action = match.strip()
                if len(action) > 10 and len(action) < 200:  # Reasonable length
                    # Determine SLA based on priority
                    if priority == "Critical":
                        sla = "4 hours"
                    elif priority == "High":
                        sla = "1 business day"
                    elif priority == "Medium":
                        sla = "3 business days"
                    else:
                        sla = "5 business days"
                    
                    action_items.append({
                        'action': action,
                        'priority': priority,
                        'sla': sla
                    })
        
        # Limit to top 5 action items
        return action_items[:5]

    def _determine_workflow_state(self, email: Dict, phase1_results: Dict, entities: Dict) -> str:
        """Determine the workflow state based on email content and entities."""
        subject = email.get('subject', '').lower()
        body = email.get('body', '').lower()
        
        # Check for resolution indicators
        if any(word in subject + body for word in ['resolved', 'closed', 'completed', 'done']):
            return "RESOLVED"
        
        # Check for escalation
        if phase1_results['quick_priority'] == "Critical" or 'escalate' in subject + body:
            return "ESCALATED"
        
        # Check for pending indicators
        if any(word in subject + body for word in ['waiting', 'pending', 'hold']):
            return "PENDING_RESPONSE"
        
        # Check if it's a new email
        if email.get('is_read') is False:
            return "NEW"
        
        # Default to in progress
        return "IN_PROGRESS"

    def _assess_business_impact(self, phase1_results: Dict, entities: Dict, action_items: List) -> str:
        """Assess the business impact of the email."""
        impact_level = "Low"
        
        # High priority emails have higher impact
        if phase1_results['quick_priority'] in ["Critical", "High"]:
            impact_level = "High"
        
        # Multiple entities suggest higher impact
        entity_count = sum(len(v) for v in entities.values() if isinstance(v, list))
        if entity_count > 5:
            impact_level = "High"
        elif entity_count > 2:
            impact_level = "Medium"
        
        # Multiple action items suggest higher impact
        if len(action_items) > 3:
            impact_level = "High"
        elif len(action_items) > 1:
            impact_level = "Medium"
        
        return impact_level

    def _create_contextual_summary(self, email: Dict, phase1_results: Dict, entities: Dict) -> str:
        """Create a contextual summary of the email."""
        sender = email.get('sender_email', 'Unknown sender')
        workflow = phase1_results['quick_workflow']
        intent = phase1_results['quick_intent']
        
        # Build entity summary
        entity_parts = []
        if entities['po_numbers']:
            entity_parts.append(f"PO #{entities['po_numbers'][0]}")
        if entities['quote_numbers']:
            entity_parts.append(f"Quote #{entities['quote_numbers'][0]}")
        if entities['case_numbers']:
            entity_parts.append(f"Case #{entities['case_numbers'][0]}")
        
        entity_summary = " regarding " + ", ".join(entity_parts) if entity_parts else ""
        
        summary = f"{sender} sent a {workflow} email with intent to {intent}{entity_summary}."
        
        return summary

    def _generate_suggested_response(self, phase1_results: Dict, entities: Dict, workflow_state: str) -> str:
        """Generate a suggested response based on the analysis."""
        workflow = phase1_results['quick_workflow']
        intent = phase1_results['quick_intent']
        
        # Base templates for different scenarios
        if workflow_state == "NEW":
            response = "Thank you for your email. We have received your request and will process it shortly."
        elif workflow_state == "ESCALATED":
            response = "Your request has been escalated to our management team for immediate attention."
        elif workflow_state == "RESOLVED":
            response = "Thank you for your patience. This issue has been resolved."
        else:
            response = "We are currently working on your request."
        
        # Add specific details based on workflow
        if workflow == "Order Management" and entities['po_numbers']:
            response += f" Your order (PO #{entities['po_numbers'][0]}) is being processed."
        elif workflow == "Quote Processing" and entities['quote_numbers']:
            response += f" Quote #{entities['quote_numbers'][0]} is under review."
        elif workflow == "Customer Support" and entities['case_numbers']:
            response += f" Case #{entities['case_numbers'][0]} has been assigned to our support team."
        
        response += " We will update you as soon as we have more information."
        
        return response

    def _find_secondary_workflow(self, text: str, primary_workflow: str) -> Optional[str]:
        """Find a secondary workflow that might be relevant."""
        workflow_scores = {}
        
        for workflow, patterns in self.workflow_patterns.items():
            if workflow != primary_workflow:  # Skip the primary workflow
                score = sum(1 for pattern in patterns if re.search(pattern, text, re.I))
                if score > 0:
                    workflow_scores[workflow] = score
        
        if workflow_scores:
            return max(workflow_scores.items(), key=lambda x: x[1])[0]
        return None

    def _calculate_quality_score(self, email: Dict, phase1_results: Dict, phase2_results: Dict) -> float:
        """Calculate a quality score for the email analysis."""
        score = 0.0
        
        # Check for complete email data
        if email.get('subject') and email.get('body'):
            score += 0.2
        
        # Check confidence levels
        if phase1_results['quick_confidence'] > 0.7:
            score += 0.2
        if phase2_results['deep_confidence'] > 0.7:
            score += 0.2
        
        # Check entity extraction success
        entities_found = any(
            phase2_results.get(f'entities_{entity}') != '[]'
            for entity in ['po_numbers', 'quote_numbers', 'case_numbers', 'part_numbers']
        )
        if entities_found:
            score += 0.2
        
        # Check for action items
        if phase2_results.get('action_items') != '[]':
            score += 0.1
        
        # Check for meaningful summary
        if len(phase2_results.get('contextual_summary', '')) > 30:
            score += 0.1
        
        return min(1.0, score)

    def _validate_confidence(self, phase1_results: Dict, phase2_results: Dict, quality_score: float) -> float:
        """Validate and adjust confidence based on all analysis phases."""
        quick_conf = phase1_results['quick_confidence']
        deep_conf = phase2_results['deep_confidence']
        
        # Average the confidences with quality score influence
        base_confidence = (quick_conf + deep_conf) / 2
        adjusted_confidence = base_confidence * (0.7 + 0.3 * quality_score)
        
        return min(0.95, adjusted_confidence)

    def _needs_review(self, phase1_results: Dict, phase2_results: Dict, quality_score: float) -> bool:
        """Determine if the email needs manual review."""
        # Flag for review if:
        # 1. Low confidence
        if phase1_results['quick_confidence'] < 0.5 or phase2_results['deep_confidence'] < 0.5:
            return True
        
        # 2. Low quality score
        if quality_score < 0.4:
            return True
        
        # 3. Critical priority with low confidence
        if phase1_results['quick_priority'] == "Critical" and phase2_results['deep_confidence'] < 0.8:
            return True
        
        # 4. Conflicting workflow classifications
        if phase1_results['quick_workflow'] != phase2_results['deep_workflow_primary']:
            return True
        
        return False

    def save_to_crewai_database(self, analysis_results: List[Dict]) -> bool:
        """
        Save analysis results to CrewAI database.
        
        Args:
            analysis_results: List of analysis result dictionaries
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            conn = sqlite3.connect(self.crewai_db_path)
            cursor = conn.cursor()
            
            # Insert query for email_analysis table
            insert_query = """
            INSERT INTO email_analysis (
                id, email_id, 
                quick_workflow, quick_priority, quick_intent, quick_urgency, 
                quick_confidence, quick_suggested_state, quick_model, quick_processing_time,
                deep_workflow_primary, deep_workflow_secondary, deep_workflow_related, deep_confidence,
                entities_po_numbers, entities_quote_numbers, entities_case_numbers, 
                entities_part_numbers, entities_order_references, entities_contacts,
                action_items, workflow_state, business_impact, contextual_summary, 
                suggested_response, related_emails,
                deep_processing_time, total_processing_time,
                quality_score, final_confidence, needs_review,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            # Prepare data for insertion
            insert_data = []
            for result in analysis_results:
                data_tuple = (
                    result['id'],
                    result['email_id'],
                    result['quick_workflow'],
                    result['quick_priority'],
                    result['quick_intent'],
                    result['quick_urgency'],
                    result['quick_confidence'],
                    result['quick_suggested_state'],
                    result['quick_model'],
                    result['quick_processing_time'],
                    result['deep_workflow_primary'],
                    result['deep_workflow_secondary'],
                    result['deep_workflow_related'],
                    result['deep_confidence'],
                    result['entities_po_numbers'],
                    result['entities_quote_numbers'],
                    result['entities_case_numbers'],
                    result['entities_part_numbers'],
                    result['entities_order_references'],
                    result['entities_contacts'],
                    result['action_items'],
                    result['workflow_state'],
                    result['business_impact'],
                    result['contextual_summary'],
                    result['suggested_response'],
                    result['related_emails'],
                    result['deep_processing_time'],
                    result['total_processing_time'],
                    result.get('quality_score', 0.0),
                    result.get('final_confidence', 0.0),
                    result.get('needs_review', False),
                    result['created_at'],
                    result['updated_at']
                )
                insert_data.append(data_tuple)
            
            # Execute batch insert
            cursor.executemany(insert_query, insert_data)
            conn.commit()
            
            logger.info(f"Successfully saved {len(analysis_results)} analysis results to database")
            return True
            
        except Exception as e:
            logger.error(f"Error saving to database: {e}", exc_info=True)
            if conn:
                conn.rollback()
            return False
        finally:
            if conn:
                conn.close()


def main():
    """Main function for testing the analyzer."""
    analyzer = ThreePhaseEmailAnalyzer()
    
    # Process all batch files in the directory
    batch_files = list(analyzer.batch_dir.glob("*.json"))
    
    if not batch_files:
        logger.info("No batch files found to process")
        return
    
    logger.info(f"Found {len(batch_files)} batch files to process")
    
    success_count = 0
    for batch_file in batch_files:
        if analyzer.process_batch_file(str(batch_file)):
            success_count += 1
    
    logger.info(f"Processing complete. Successfully processed {success_count}/{len(batch_files)} batches")


if __name__ == "__main__":
    main()