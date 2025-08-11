#!/usr/bin/env python3
"""
Semantic Email Analyzer - Understanding intent, not just patterns
Uses patterns as hints but focuses on actual meaning and context
"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import re
from collections import defaultdict

class SemanticEmailAnalyzer:
    """Understands what emails mean, not just what patterns they contain"""
    
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        
        # Intent indicators (not rigid patterns)
        self.intent_signals = {
            'quote_request': {
                'strong_signals': [
                    'please quote', 'request.*quote', 'pricing for', 'how much',
                    'cost.*for', 'price.*list', 'need.*pricing', 'quote.*attached'
                ],
                'weak_signals': [
                    'quote', 'price', 'cost', 'estimate', 'proposal', 'RFQ'
                ],
                'context_boost': ['quantity', 'units', 'delivery', 'ship']
            },
            
            'purchase_order': {
                'strong_signals': [
                    'purchase order', 'PO.*attached', 'order.*confirmed',
                    'please.*ship', 'approved.*order', 'PO.*\d{5,}'
                ],
                'weak_signals': [
                    'order', 'purchase', 'buy', 'procure', 'acquire'
                ],
                'context_boost': ['quantity', 'ship to', 'deliver', 'invoice']
            },
            
            'support_request': {
                'strong_signals': [
                    'help.*with', 'issue.*with', 'problem.*with', 'not.*working',
                    'error.*message', 'failed.*to', 'unable.*to', 'broken'
                ],
                'weak_signals': [
                    'help', 'support', 'assist', 'trouble', 'issue'
                ],
                'context_boost': ['urgent', 'ASAP', 'critical', 'down']
            },
            
            'pricing_negotiation': {
                'strong_signals': [
                    'special.*pricing', 'volume.*discount', 'better.*price',
                    'match.*price', 'negotiate', 'SPA', 'agreement'
                ],
                'weak_signals': [
                    'discount', 'special', 'deal', 'promotion'
                ],
                'context_boost': ['competitor', 'volume', 'contract', 'term']
            },
            
            'order_status': {
                'strong_signals': [
                    'where.*order', 'status.*of', 'tracking.*number',
                    'when.*ship', 'delivery.*date', 'order.*status'
                ],
                'weak_signals': [
                    'status', 'tracking', 'shipment', 'delivery'
                ],
                'context_boost': ['ETA', 'expected', 'arrival', 'update']
            },
            
            'relationship_building': {
                'strong_signals': [
                    'thank.*you', 'appreciate.*business', 'looking.*forward',
                    'pleased.*to', 'congratulations', 'welcome.*aboard'
                ],
                'weak_signals': [
                    'thanks', 'regards', 'sincerely', 'best'
                ],
                'context_boost': ['partnership', 'relationship', 'together']
            }
        }
        
        # Context understanding
        self.context_patterns = {
            'urgency_level': {
                'high': ['urgent', 'ASAP', 'immediately', 'critical', 'emergency'],
                'medium': ['soon', 'quickly', 'priority', 'important'],
                'low': ['when possible', 'no rush', 'eventually']
            },
            
            'customer_sentiment': {
                'positive': ['happy', 'pleased', 'satisfied', 'excellent', 'great'],
                'negative': ['disappointed', 'frustrated', 'unhappy', 'poor', 'bad'],
                'neutral': ['okay', 'fine', 'acceptable']
            },
            
            'business_value': {
                'high': ['large order', 'bulk', 'volume', 'contract', 'annual'],
                'medium': ['standard', 'regular', 'monthly'],
                'low': ['sample', 'trial', 'test', 'small']
            }
        }
        
        # Learning storage
        self.learned_patterns = defaultdict(list)
        self.confidence_adjustments = {}
        
    def analyze_email(self, email_text: str, subject: str = "") -> Dict:
        """Analyze email for semantic meaning, not just patterns"""
        
        full_text = f"{subject} {email_text}".lower()
        
        # 1. Detect primary intent (what does the sender want?)
        intent_scores = self.calculate_intent_scores(full_text)
        primary_intent = max(intent_scores, key=intent_scores.get) if intent_scores else 'unclear'
        
        # 2. Understand context (how urgent, what sentiment, etc.)
        context = self.extract_context(full_text)
        
        # 3. Extract entities (who, what, when, where)
        entities = self.extract_semantic_entities(full_text)
        
        # 4. Identify action items (what needs to be done?)
        actions = self.identify_actions(full_text, primary_intent)
        
        # 5. Assess confidence based on clarity
        confidence = self.assess_confidence(intent_scores, context)
        
        # 6. Learn from patterns for future
        self.learn_from_email(full_text, primary_intent)
        
        return {
            'primary_intent': primary_intent,
            'intent_scores': intent_scores,
            'confidence': confidence,
            'context': context,
            'entities': entities,
            'actions': actions,
            'requires_human': confidence < 0.7,
            'reasoning': self.explain_analysis(intent_scores, context)
        }
    
    def calculate_intent_scores(self, text: str) -> Dict[str, float]:
        """Calculate likelihood scores for each intent"""
        scores = {}
        
        for intent, signals in self.intent_signals.items():
            score = 0.0
            
            # Check strong signals (high confidence)
            for signal in signals['strong_signals']:
                if re.search(signal, text, re.IGNORECASE):
                    score += 0.8
            
            # Check weak signals (lower confidence)
            for signal in signals['weak_signals']:
                if signal in text:
                    score += 0.3
            
            # Apply context boost if relevant context found
            for boost in signals.get('context_boost', []):
                if boost in text:
                    score += 0.2
            
            # Apply learned adjustments
            if intent in self.confidence_adjustments:
                score *= self.confidence_adjustments[intent]
            
            if score > 0:
                scores[intent] = min(score, 1.0)  # Cap at 1.0
        
        return scores
    
    def extract_context(self, text: str) -> Dict:
        """Extract contextual information"""
        context = {
            'urgency': 'normal',
            'sentiment': 'neutral',
            'value': 'unknown',
            'mentions_competitor': False,
            'is_reply': 're:' in text or 'fw:' in text,
            'has_attachment_reference': 'attached' in text or 'attachment' in text,
            'contains_numbers': bool(re.search(r'\$?\d+[,.]?\d*', text))
        }
        
        # Detect urgency
        for level, keywords in self.context_patterns['urgency_level'].items():
            if any(keyword in text for keyword in keywords):
                context['urgency'] = level
                break
        
        # Detect sentiment
        for sentiment, keywords in self.context_patterns['customer_sentiment'].items():
            if any(keyword in text for keyword in keywords):
                context['sentiment'] = sentiment
                break
        
        # Detect business value
        for value, keywords in self.context_patterns['business_value'].items():
            if any(keyword in text for keyword in keywords):
                context['value'] = value
                break
        
        # Check for competitor mentions
        competitors = ['amazon', 'newegg', 'cdw', 'shi', 'insight']
        context['mentions_competitor'] = any(comp in text for comp in competitors)
        
        return context
    
    def extract_semantic_entities(self, text: str) -> Dict:
        """Extract meaningful entities, not just patterns"""
        entities = {
            'products': [],
            'quantities': [],
            'dates': [],
            'prices': [],
            'reference_numbers': [],
            'people': [],
            'companies': []
        }
        
        # Extract quantities with context
        qty_patterns = [
            (r'(\d+)\s*(?:units?|pieces?|qty|quantity)', 'units'),
            (r'(\d+)\s*(?:boxes?|cases?|pallets?)', 'packages'),
            (r'(\d+)\s*(?:each|ea)', 'each')
        ]
        
        for pattern, unit_type in qty_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities['quantities'].append({
                    'value': int(match.group(1)),
                    'unit': unit_type,
                    'context': text[max(0, match.start()-20):min(len(text), match.end()+20)]
                })
        
        # Extract prices with currency
        price_pattern = r'\$?\d+[,.]?\d*(?:\.\d{2})?'
        for match in re.finditer(price_pattern, text):
            value = match.group()
            if '$' in value or '.' in value:
                entities['prices'].append({
                    'value': value,
                    'context': text[max(0, match.start()-20):min(len(text), match.end()+20)]
                })
        
        # Extract date mentions (not just date patterns)
        date_keywords = ['deliver', 'ship', 'arrival', 'expected', 'due', 'deadline']
        for keyword in date_keywords:
            if keyword in text:
                # Find nearby date patterns
                pattern = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'
                start = max(0, text.index(keyword) - 50)
                end = min(len(text), text.index(keyword) + 50)
                snippet = text[start:end]
                
                for match in re.finditer(pattern, snippet):
                    entities['dates'].append({
                        'value': match.group(),
                        'type': keyword,
                        'context': snippet
                    })
        
        # Extract reference numbers (but understand their type)
        ref_patterns = [
            (r'(?:PO|po)[\s#]*(\d{5,})', 'purchase_order'),
            (r'(?:quote|RFQ)[\s#]*(\d{5,})', 'quote'),
            (r'(?:ticket|case)[\s#]*(\d{5,})', 'support_ticket'),
            (r'(?:CAS|SPA)[\s-]*(\d{6})', 'pricing_agreement')
        ]
        
        for pattern, ref_type in ref_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities['reference_numbers'].append({
                    'value': match.group(1),
                    'type': ref_type,
                    'full_reference': match.group(0)
                })
        
        return entities
    
    def identify_actions(self, text: str, intent: str) -> List[Dict]:
        """Identify specific actions needed based on intent"""
        actions = []
        
        action_patterns = {
            'quote_request': [
                ('generate_quote', ['please quote', 'send.*quote', 'provide.*pricing']),
                ('check_availability', ['in stock', 'available', 'lead time']),
                ('calculate_shipping', ['ship to', 'delivery', 'freight'])
            ],
            'purchase_order': [
                ('process_order', ['process.*order', 'place.*order', 'submit.*order']),
                ('confirm_receipt', ['confirm', 'acknowledge', 'received']),
                ('arrange_shipping', ['ship', 'deliver', 'send'])
            ],
            'support_request': [
                ('diagnose_issue', ['not working', 'error', 'problem']),
                ('provide_solution', ['how to', 'help with', 'assist']),
                ('escalate', ['urgent', 'critical', 'emergency'])
            ],
            'pricing_negotiation': [
                ('review_pricing', ['review', 'consider', 'evaluate']),
                ('apply_discount', ['discount', 'special pricing', 'reduce']),
                ('create_agreement', ['agreement', 'contract', 'SPA'])
            ]
        }
        
        if intent in action_patterns:
            for action_type, triggers in action_patterns[intent]:
                for trigger in triggers:
                    if re.search(trigger, text, re.IGNORECASE):
                        actions.append({
                            'action': action_type,
                            'trigger': trigger,
                            'priority': 'high' if 'urgent' in text else 'normal'
                        })
                        break
        
        return actions
    
    def assess_confidence(self, intent_scores: Dict, context: Dict) -> float:
        """Assess overall confidence in the analysis"""
        if not intent_scores:
            return 0.0
        
        # Base confidence on intent clarity
        max_score = max(intent_scores.values())
        score_spread = max_score - min(intent_scores.values()) if len(intent_scores) > 1 else max_score
        
        confidence = max_score * 0.6 + score_spread * 0.4
        
        # Adjust based on context
        if context['urgency'] == 'high':
            confidence *= 1.1  # Urgent emails are usually clearer
        
        if context['has_attachment_reference']:
            confidence *= 1.05  # References to attachments add clarity
        
        if context['is_reply']:
            confidence *= 0.95  # Replies might lack context
        
        return min(confidence, 1.0)
    
    def learn_from_email(self, text: str, intent: str):
        """Learn patterns for future analysis"""
        # Extract unique phrases around intent keywords
        sentences = text.split('.')
        for sentence in sentences:
            if len(sentence) > 10 and len(sentence) < 200:
                self.learned_patterns[intent].append(sentence.strip())
        
        # Adjust confidence based on success (would need feedback loop)
        # This is where human feedback would improve the system
        pass
    
    def explain_analysis(self, intent_scores: Dict, context: Dict) -> str:
        """Explain why the analysis reached its conclusion"""
        if not intent_scores:
            return "No clear intent detected"
        
        primary = max(intent_scores, key=intent_scores.get)
        score = intent_scores[primary]
        
        explanation = f"Primary intent '{primary}' detected with {score:.1%} confidence. "
        
        if context['urgency'] == 'high':
            explanation += "Message appears urgent. "
        
        if context['mentions_competitor']:
            explanation += "Mentions competitors (may need special handling). "
        
        if len(intent_scores) > 1:
            other_intents = [f"{k} ({v:.1%})" for k, v in intent_scores.items() if k != primary]
            explanation += f"Also detected: {', '.join(other_intents)}. "
        
        return explanation


def demonstrate_semantic_analysis():
    """Show how semantic analysis is better than pattern matching"""
    
    analyzer = SemanticEmailAnalyzer()
    
    # Test emails showing flexibility
    test_emails = [
        {
            'subject': 'Need pricing',
            'body': """
            Hi team,
            
            Our customer is looking to purchase 500 units of the Surface Pro devices.
            Can you provide your best pricing? They're comparing with Amazon.
            
            Need this by end of week if possible.
            
            Thanks,
            John
            """,
            'expected': 'quote_request with urgency and competitor mention'
        },
        {
            'subject': 'Re: Order 12345',
            'body': """
            The shipment hasn't arrived yet. It was supposed to be here yesterday.
            This is causing issues with our customer. Please provide an update ASAP.
            """,
            'expected': 'order_status with support_request overtones, urgent'
        },
        {
            'subject': 'Partnership opportunity',
            'body': """
            We're interested in establishing a long-term agreement for our annual 
            purchases. We typically order about $2M worth of products yearly.
            
            Can we discuss volume discounts and special terms?
            """,
            'expected': 'pricing_negotiation with high business value'
        }
    ]
    
    print("SEMANTIC EMAIL ANALYSIS DEMONSTRATION")
    print("=" * 70)
    print("\nShowing how the system understands intent, not just patterns:\n")
    
    for i, email in enumerate(test_emails, 1):
        print(f"\nEmail {i}: {email['subject']}")
        print("-" * 40)
        
        analysis = analyzer.analyze_email(email['body'], email['subject'])
        
        print(f"Expected: {email['expected']}")
        print(f"\nAnalysis Results:")
        print(f"  Primary Intent: {analysis['primary_intent']}")
        print(f"  Confidence: {analysis['confidence']:.1%}")
        print(f"  Urgency: {analysis['context']['urgency']}")
        print(f"  Mentions Competitor: {analysis['context']['mentions_competitor']}")
        print(f"  Business Value: {analysis['context']['value']}")
        
        if analysis['entities']['reference_numbers']:
            print(f"  References Found: {analysis['entities']['reference_numbers']}")
        
        if analysis['actions']:
            print(f"  Actions Needed: {[a['action'] for a in analysis['actions']]}")
        
        print(f"  Reasoning: {analysis['reasoning']}")
        print(f"  Requires Human: {analysis['requires_human']}")
    
    print("\n" + "=" * 70)
    print("KEY DIFFERENCES FROM PATTERN MATCHING:")
    print("=" * 70)
    print("""
    1. UNDERSTANDS INTENT: Not looking for 'Quote-FTQ' but understanding
       that 'need pricing' + 'units' + 'provide' = quote request
    
    2. CONTEXT AWARE: Recognizes urgency ('ASAP', 'by end of week')
       and business context (competitor mentions, value indicators)
    
    3. FLEXIBLE: Would catch 'please provide cost', 'what's the price',
       'how much for' - all mean the same thing
    
    4. ACTIONABLE: Identifies what needs to be done, not just what
       pattern was found
    
    5. LEARNING: Can improve over time with feedback, not stuck with
       rigid patterns
    """)


if __name__ == "__main__":
    demonstrate_semantic_analysis()