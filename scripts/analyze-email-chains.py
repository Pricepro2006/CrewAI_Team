#!/usr/bin/env python3
"""
Email Chain Analysis System
Analyzes 143k consolidated emails to identify complete email chains,
extract workflow patterns, and prepare for adaptive pipeline processing.
"""

import json
import os
import sqlite3
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime, timedelta
import re
import hashlib
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, asdict
from enum import Enum

# Workflow detection patterns
class WorkflowType(Enum):
    QUOTE_REQUEST = "quote_request"
    ORDER_PROCESSING = "order_processing" 
    SUPPORT_TICKET = "support_ticket"
    RETURN_MERCHANDISE = "return_merchandise"
    GENERAL_INQUIRY = "general_inquiry"
    ESCALATION = "escalation"
    QUOTE_TO_ORDER = "quote_to_order"

class ChainCompleteness(Enum):
    COMPLETE = "complete"      # 70%+ - Full workflow with resolution
    PARTIAL = "partial"        # 30-70% - Some back and forth but incomplete
    BROKEN = "broken"          # <30% - Single emails or very incomplete

@dataclass
class EmailEntity:
    """Extracted entities from email content"""
    po_numbers: List[str]
    quote_numbers: List[str] 
    order_numbers: List[str]
    case_numbers: List[str]
    part_numbers: List[str]
    dollar_amounts: List[float]
    contact_names: List[str]
    companies: List[str]

@dataclass
class EmailChain:
    """Represents a complete email conversation thread"""
    chain_id: str
    subject_normalized: str
    conversation_id: Optional[str]
    emails: List[Dict]
    participants: Set[str]
    start_date: datetime
    end_date: datetime
    workflow_type: WorkflowType
    completeness: ChainCompleteness
    completeness_score: float
    entities: EmailEntity
    actionable_items: List[str]
    resolution_indicators: List[str]
    business_value: float

class EmailChainAnalyzer:
    """Analyzes email chains for workflow completeness and business intelligence"""
    
    def __init__(self):
        self.chains: Dict[str, EmailChain] = {}
        self.subject_patterns = self._load_subject_patterns()
        self.workflow_keywords = self._load_workflow_keywords()
        self.resolution_indicators = self._load_resolution_indicators()
        
    def _load_subject_patterns(self) -> Dict[str, re.Pattern]:
        """Compile regex patterns for subject line normalization"""
        return {
            'reply_prefix': re.compile(r'^(re:|fwd?:|fw:)\s*', re.IGNORECASE),
            'bracket_content': re.compile(r'\[[^\]]*\]'),
            'case_numbers': re.compile(r'case[#\s]*(\d+)', re.IGNORECASE),
            'quote_numbers': re.compile(r'quote[#\s]*([a-z0-9-]+)', re.IGNORECASE),
            'po_numbers': re.compile(r'po[#\s]*([a-z0-9-]+)', re.IGNORECASE),
            'order_numbers': re.compile(r'order[#\s]*([a-z0-9-]+)', re.IGNORECASE),
        }
    
    def _load_workflow_keywords(self) -> Dict[WorkflowType, List[str]]:
        """Keywords that indicate specific workflow types"""
        return {
            WorkflowType.QUOTE_REQUEST: [
                'quote', 'pricing', 'price list', 'rfq', 'request for quote',
                'quotation', 'estimate', 'proposal'
            ],
            WorkflowType.ORDER_PROCESSING: [
                'order', 'purchase', 'po number', 'delivery', 'ship',
                'tracking', 'invoice', 'receipt'
            ],
            WorkflowType.SUPPORT_TICKET: [
                'support', 'help', 'issue', 'problem', 'trouble', 'bug',
                'error', 'not working', 'broken'
            ],
            WorkflowType.RETURN_MERCHANDISE: [
                'return', 'rma', 'refund', 'exchange', 'defective',
                'warranty', 'damaged'
            ],
            WorkflowType.ESCALATION: [
                'escalate', 'manager', 'supervisor', 'urgent', 'critical',
                'complaint', 'dissatisfied'
            ]
        }
    
    def _load_resolution_indicators(self) -> List[str]:
        """Phrases that indicate a workflow was resolved"""
        return [
            'resolved', 'completed', 'finished', 'done', 'closed',
            'shipped', 'delivered', 'received', 'confirmed',
            'thank you', 'thanks', 'perfect', 'great', 'excellent',
            'no further action', 'case closed', 'ticket closed'
        ]
    
    def normalize_subject(self, subject: str) -> str:
        """Normalize email subject for chain grouping"""
        if not subject:
            return ""
            
        # Remove reply prefixes
        normalized = self.subject_patterns['reply_prefix'].sub('', subject)
        
        # Remove bracket content but preserve case/quote numbers
        normalized = self.subject_patterns['bracket_content'].sub('', normalized)
        
        # Clean up whitespace
        normalized = ' '.join(normalized.split())
        
        return normalized.lower().strip()
    
    def extract_conversation_threads(self, emails: List[Dict]) -> Dict[str, List[Dict]]:
        """Group emails into conversation threads"""
        threads = defaultdict(list)
        
        # Group by conversation_id first if available
        for email in emails:
            conv_id = email.get('conversationId') or email.get('conversation_id_ref')
            if conv_id:
                threads[f"conv_{conv_id}"].append(email)
                continue
                
            # Fall back to subject-based grouping
            subject = email.get('subject', '')
            normalized_subject = self.normalize_subject(subject)
            
            if normalized_subject:
                threads[f"subj_{normalized_subject}"].append(email)
            else:
                # Single email without subject
                email_id = email.get('internet_message_id', email.get('id', 'unknown'))
                threads[f"single_{email_id}"].append(email)
        
        return dict(threads)
    
    def extract_entities_from_email(self, email: Dict) -> EmailEntity:
        """Extract business entities from email content"""
        subject = email.get('subject', '')
        body_text = email.get('body_text', '')
        body = email.get('body', '')
        
        # Handle dict body content
        if isinstance(body, dict):
            body = body.get('content', '')
        if isinstance(body_text, dict):
            body_text = body_text.get('content', '')
        
        content = f"{subject} {body_text} {body}"
        
        # Extract various entity types
        po_numbers = self._extract_pattern(content, r'po[#\s]*([a-z0-9-]+)', re.IGNORECASE)
        quote_numbers = self._extract_pattern(content, r'quote[#\s]*([a-z0-9-]+)', re.IGNORECASE)
        order_numbers = self._extract_pattern(content, r'order[#\s]*([a-z0-9-]+)', re.IGNORECASE)
        case_numbers = self._extract_pattern(content, r'case[#\s]*(\d+)', re.IGNORECASE)
        
        # Part numbers (common formats)
        part_numbers = self._extract_pattern(
            content, 
            r'\b[A-Z0-9]{2,}-?[A-Z0-9]{2,}-?[A-Z0-9]*\b',
            re.IGNORECASE
        )
        
        # Dollar amounts
        dollar_amounts = []
        for match in re.finditer(r'\$[\d,]+\.?\d*', content):
            try:
                amount_str = match.group().replace('$', '').replace(',', '')
                dollar_amounts.append(float(amount_str))
            except ValueError:
                continue
        
        # Contact names (simplified - could be enhanced with NLP)
        contact_names = self._extract_pattern(
            content,
            r'\b[A-Z][a-z]+ [A-Z][a-z]+\b'
        )
        
        # Companies (ending with Inc, LLC, Corp, etc.)
        companies = self._extract_pattern(
            content,
            r'\b[A-Z][A-Za-z\s&]+(?:Inc|LLC|Corp|Corporation|Company|Co\.)\b'
        )
        
        return EmailEntity(
            po_numbers=po_numbers,
            quote_numbers=quote_numbers,
            order_numbers=order_numbers,
            case_numbers=case_numbers,
            part_numbers=part_numbers,
            dollar_amounts=dollar_amounts,
            contact_names=contact_names,
            companies=companies
        )
    
    def _extract_pattern(self, text: str, pattern: str, flags: int = 0) -> List[str]:
        """Extract unique matches for a regex pattern"""
        matches = re.findall(pattern, text, flags)
        return list(set(matches)) if matches else []
    
    def detect_workflow_type(self, emails: List[Dict]) -> WorkflowType:
        """Detect the primary workflow type for an email chain"""
        all_content = ""
        for email in emails:
            subject = email.get('subject', '')
            body_text = email.get('body_text', '')
            body = email.get('body', '')
            
            # Handle dict body content
            if isinstance(body, dict):
                body = body.get('content', '')
            if isinstance(body_text, dict):
                body_text = body_text.get('content', '')
                
            content = f"{subject} {body_text} {body}"
            all_content += content.lower() + " "
        
        workflow_scores = {}
        for workflow_type, keywords in self.workflow_keywords.items():
            score = sum(all_content.count(keyword) for keyword in keywords)
            workflow_scores[workflow_type] = score
        
        if not any(workflow_scores.values()):
            return WorkflowType.GENERAL_INQUIRY
            
        return max(workflow_scores, key=workflow_scores.get)
    
    def calculate_completeness_score(self, emails: List[Dict]) -> Tuple[float, ChainCompleteness]:
        """Calculate how complete an email chain workflow appears to be"""
        if len(emails) == 1:
            return 0.1, ChainCompleteness.BROKEN
        
        score = 0.0
        
        # Participants diversity (more participants = more complete workflow)
        participants = set()
        for email in emails:
            sender = email.get('sender_email', email.get('from', ''))
            if isinstance(sender, dict):
                sender = sender.get('emailAddress', {}).get('address', '') or sender.get('address', '')
            if sender and isinstance(sender, str):
                participants.add(sender.lower())
        
        participant_score = min(len(participants) * 0.15, 0.3)
        score += participant_score
        
        # Email count (more back-and-forth typically means more complete)
        count_score = min(len(emails) * 0.05, 0.25)
        score += count_score
        
        # Time span (workflows spread over time are often more complete)
        dates = []
        for email in emails:
            date_str = email.get('received_at') or email.get('receivedDateTime') or email.get('ReceivedDateTime')
            if date_str:
                try:
                    if 'T' in date_str:
                        date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                    else:
                        date = datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S')
                    dates.append(date)
                except:
                    continue
        
        if len(dates) >= 2:
            time_span = (max(dates) - min(dates)).days
            time_score = min(time_span * 0.02, 0.15)
            score += time_score
        
        # Resolution indicators
        all_content = ""
        for email in emails:
            subject = email.get('subject', '')
            body_text = email.get('body_text', '')
            body = email.get('body', '')
            
            # Handle dict body content
            if isinstance(body, dict):
                body = body.get('content', '')
            if isinstance(body_text, dict):
                body_text = body_text.get('content', '')
                
            content = f"{subject} {body_text} {body}"
            all_content += content.lower() + " "
        
        resolution_count = sum(1 for indicator in self.resolution_indicators 
                             if indicator in all_content)
        resolution_score = min(resolution_count * 0.1, 0.3)
        score += resolution_score
        
        # Determine completeness category
        if score >= 0.7:
            completeness = ChainCompleteness.COMPLETE
        elif score >= 0.3:
            completeness = ChainCompleteness.PARTIAL
        else:
            completeness = ChainCompleteness.BROKEN
            
        return min(score, 1.0), completeness
    
    def extract_actionable_items(self, emails: List[Dict]) -> List[str]:
        """Extract actionable items from email chain"""
        actionable_patterns = [
            r'please\s+(.{10,100})',
            r'can you\s+(.{10,100})',
            r'need to\s+(.{10,100})',
            r'action required:?\s*(.{10,100})',
            r'follow up\s+(.{10,100})',
            r'next steps?:?\s*(.{10,100})'
        ]
        
        actionable_items = []
        for email in emails:
            content = email.get('body_text', '') or email.get('body', '')
            if isinstance(content, dict):
                content = content.get('content', '')
            if not content or not isinstance(content, str):
                continue
                
            for pattern in actionable_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE | re.DOTALL)
                for match in matches:
                    # Clean up the match
                    item = match.strip()[:200]  # Limit length
                    if len(item) > 20 and item not in actionable_items:
                        actionable_items.append(item)
        
        return actionable_items[:10]  # Limit to top 10
    
    def calculate_business_value(self, chain: EmailChain) -> float:
        """Calculate estimated business value of email chain"""
        value = 0.0
        
        # Dollar amounts mentioned
        if chain.entities.dollar_amounts:
            value += max(chain.entities.dollar_amounts)
        
        # Number of part numbers (indicates product interest)
        value += len(chain.entities.part_numbers) * 100
        
        # Workflow type multipliers
        workflow_multipliers = {
            WorkflowType.QUOTE_TO_ORDER: 3.0,
            WorkflowType.ORDER_PROCESSING: 2.5,
            WorkflowType.QUOTE_REQUEST: 2.0,
            WorkflowType.RETURN_MERCHANDISE: 1.5,
            WorkflowType.SUPPORT_TICKET: 1.2,
            WorkflowType.GENERAL_INQUIRY: 1.0,
            WorkflowType.ESCALATION: 0.8
        }
        
        multiplier = workflow_multipliers.get(chain.workflow_type, 1.0)
        value *= multiplier
        
        # Completeness bonus
        if chain.completeness == ChainCompleteness.COMPLETE:
            value *= 1.5
        elif chain.completeness == ChainCompleteness.PARTIAL:
            value *= 1.2
            
        return round(value, 2)
    
    def analyze_email_chains(self, emails: List[Dict]) -> Dict[str, EmailChain]:
        """Main analysis function - processes all emails into chains"""
        print(f"Analyzing {len(emails):,} emails for chain completeness...")
        
        # Group emails into threads
        threads = self.extract_conversation_threads(emails)
        print(f"Identified {len(threads):,} conversation threads")
        
        chains = {}
        
        for thread_id, thread_emails in threads.items():
            if not thread_emails:
                continue
                
            # Sort emails by date
            sorted_emails = sorted(thread_emails, key=lambda x: x.get('received_at', x.get('receivedDateTime', '')))
            
            # Create email chain
            chain_id = f"chain_{hashlib.md5(thread_id.encode()).hexdigest()[:12]}"
            
            # Get participants
            participants = set()
            for email in sorted_emails:
                sender = email.get('sender_email', email.get('from', ''))
                if isinstance(sender, dict):
                    sender = sender.get('emailAddress', {}).get('address', '') or sender.get('address', '')
                if sender and isinstance(sender, str):
                    participants.add(sender.lower())
            
            # Get date range
            start_date = end_date = datetime.now()
            if sorted_emails:
                try:
                    first_date_str = sorted_emails[0].get('received_at') or sorted_emails[0].get('receivedDateTime', '')
                    last_date_str = sorted_emails[-1].get('received_at') or sorted_emails[-1].get('receivedDateTime', '')
                    
                    if first_date_str:
                        start_date = datetime.fromisoformat(first_date_str.replace('Z', '+00:00'))
                    if last_date_str:
                        end_date = datetime.fromisoformat(last_date_str.replace('Z', '+00:00'))
                except:
                    pass
            
            # Analyze workflow
            workflow_type = self.detect_workflow_type(sorted_emails)
            completeness_score, completeness = self.calculate_completeness_score(sorted_emails)
            
            # Extract entities
            all_entities = EmailEntity([], [], [], [], [], [], [], [])
            for email in sorted_emails:
                email_entities = self.extract_entities_from_email(email)
                all_entities.po_numbers.extend(email_entities.po_numbers)
                all_entities.quote_numbers.extend(email_entities.quote_numbers)
                all_entities.order_numbers.extend(email_entities.order_numbers)
                all_entities.case_numbers.extend(email_entities.case_numbers)
                all_entities.part_numbers.extend(email_entities.part_numbers)
                all_entities.dollar_amounts.extend(email_entities.dollar_amounts)
                all_entities.contact_names.extend(email_entities.contact_names)
                all_entities.companies.extend(email_entities.companies)
            
            # Deduplicate entity lists
            all_entities.po_numbers = list(set(all_entities.po_numbers))
            all_entities.quote_numbers = list(set(all_entities.quote_numbers))
            all_entities.order_numbers = list(set(all_entities.order_numbers))
            all_entities.case_numbers = list(set(all_entities.case_numbers))
            all_entities.part_numbers = list(set(all_entities.part_numbers))
            all_entities.contact_names = list(set(all_entities.contact_names))
            all_entities.companies = list(set(all_entities.companies))
            all_entities.dollar_amounts = list(set(all_entities.dollar_amounts))
            
            # Create chain object
            chain = EmailChain(
                chain_id=chain_id,
                subject_normalized=self.normalize_subject(sorted_emails[0].get('subject', '')),
                conversation_id=sorted_emails[0].get('conversationId'),
                emails=sorted_emails,
                participants=participants,
                start_date=start_date,
                end_date=end_date,
                workflow_type=workflow_type,
                completeness=completeness,
                completeness_score=completeness_score,
                entities=all_entities,
                actionable_items=self.extract_actionable_items(sorted_emails),
                resolution_indicators=[],
                business_value=0.0
            )
            
            # Calculate business value
            chain.business_value = self.calculate_business_value(chain)
            
            chains[chain_id] = chain
        
        return chains

def load_consolidated_emails(file_path: str) -> List[Dict]:
    """Load emails from consolidated JSON file"""
    print(f"Loading emails from {file_path}...")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        emails = json.load(f)
    
    print(f"Loaded {len(emails):,} emails")
    return emails

def save_chain_analysis(chains: Dict[str, EmailChain], output_dir: str):
    """Save chain analysis results"""
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert chains to JSON-serializable format
    chains_data = {}
    for chain_id, chain in chains.items():
        chains_data[chain_id] = {
            'chain_id': chain.chain_id,
            'subject_normalized': chain.subject_normalized,
            'conversation_id': chain.conversation_id,
            'email_count': len(chain.emails),
            'participants': list(chain.participants),
            'start_date': chain.start_date.isoformat(),
            'end_date': chain.end_date.isoformat(),
            'workflow_type': chain.workflow_type.value,
            'completeness': chain.completeness.value,
            'completeness_score': chain.completeness_score,
            'entities': asdict(chain.entities),
            'actionable_items': chain.actionable_items,
            'business_value': chain.business_value,
            'emails': chain.emails  # Include full email data
        }
    
    # Save main analysis file
    analysis_file = os.path.join(output_dir, 'email_chain_analysis.json')
    with open(analysis_file, 'w', encoding='utf-8') as f:
        json.dump(chains_data, f, indent=2, ensure_ascii=False, default=str)
    
    # Save summary statistics
    stats = generate_analysis_stats(chains)
    stats_file = os.path.join(output_dir, 'chain_analysis_stats.json')
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    print(f"Analysis saved to {output_dir}/")
    print(f"- Main analysis: email_chain_analysis.json")
    print(f"- Statistics: chain_analysis_stats.json")

def generate_analysis_stats(chains: Dict[str, EmailChain]) -> Dict:
    """Generate summary statistics from chain analysis"""
    total_chains = len(chains)
    
    # Completeness breakdown
    completeness_counts = Counter(chain.completeness.value for chain in chains.values())
    workflow_counts = Counter(chain.workflow_type.value for chain in chains.values())
    
    # Business value analysis
    total_business_value = sum(chain.business_value for chain in chains.values())
    high_value_chains = [chain for chain in chains.values() if chain.business_value > 1000]
    
    # Entity statistics
    total_entities = {
        'po_numbers': sum(len(chain.entities.po_numbers) for chain in chains.values()),
        'quote_numbers': sum(len(chain.entities.quote_numbers) for chain in chains.values()),
        'order_numbers': sum(len(chain.entities.order_numbers) for chain in chains.values()),
        'case_numbers': sum(len(chain.entities.case_numbers) for chain in chains.values()),
        'part_numbers': sum(len(chain.entities.part_numbers) for chain in chains.values()),
        'dollar_amounts': sum(len(chain.entities.dollar_amounts) for chain in chains.values()),
    }
    
    # Actionable items
    total_actionable_items = sum(len(chain.actionable_items) for chain in chains.values())
    
    return {
        'analysis_timestamp': datetime.now().isoformat(),
        'total_chains': total_chains,
        'completeness_breakdown': dict(completeness_counts),
        'workflow_breakdown': dict(workflow_counts),
        'business_value': {
            'total_estimated_value': total_business_value,
            'high_value_chains': len(high_value_chains),
            'avg_value_per_chain': total_business_value / total_chains if total_chains > 0 else 0
        },
        'entities_extracted': total_entities,
        'total_actionable_items': total_actionable_items,
        'avg_emails_per_chain': sum(len(chain.emails) for chain in chains.values()) / total_chains if total_chains > 0 else 0
    }

def main():
    """Main execution function"""
    # Load consolidated emails
    email_file = '/home/pricepro2006/CrewAI_Team/data/consolidated_emails/all_unique_emails_original_format.json'
    emails = load_consolidated_emails(email_file)
    
    # Initialize analyzer
    analyzer = EmailChainAnalyzer()
    
    # Analyze chains
    chains = analyzer.analyze_email_chains(emails)
    
    # Save results
    output_dir = '/home/pricepro2006/CrewAI_Team/data/email_chain_analysis'
    save_chain_analysis(chains, output_dir)
    
    # Print summary
    stats = generate_analysis_stats(chains)
    print("\n" + "="*60)
    print("EMAIL CHAIN ANALYSIS COMPLETE")
    print("="*60)
    print(f"Total email chains identified: {stats['total_chains']:,}")
    print(f"\nChain completeness breakdown:")
    for completeness, count in stats['completeness_breakdown'].items():
        percentage = (count / stats['total_chains']) * 100
        print(f"  - {completeness.title()}: {count:,} ({percentage:.1f}%)")
    
    print(f"\nWorkflow type breakdown:")
    for workflow, count in stats['workflow_breakdown'].items():
        percentage = (count / stats['total_chains']) * 100
        print(f"  - {workflow.replace('_', ' ').title()}: {count:,} ({percentage:.1f}%)")
    
    print(f"\nBusiness intelligence:")
    print(f"  - Total estimated value: ${stats['business_value']['total_estimated_value']:,.2f}")
    print(f"  - High-value chains (>$1000): {stats['business_value']['high_value_chains']:,}")
    print(f"  - Average emails per chain: {stats['avg_emails_per_chain']:.1f}")
    print(f"  - Total actionable items: {stats['total_actionable_items']:,}")
    
    print(f"\nEntities extracted:")
    for entity_type, count in stats['entities_extracted'].items():
        print(f"  - {entity_type.replace('_', ' ').title()}: {count:,}")

if __name__ == "__main__":
    main()