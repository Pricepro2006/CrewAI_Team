#!/usr/bin/env python3
"""
Fixed Full Pattern Discovery Pipeline for TD SYNNEX Emails
Processes all 143,850 emails to discover patterns
Without pickle issues
"""

import json
import re
import time
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict, Counter
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FullPatternDiscoveryPipeline:
    """Comprehensive pattern discovery for full dataset"""
    
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        self.output_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/full_discovery')
        self.output_dir.mkdir(exist_ok=True)
        
        # Pattern definitions
        self.pattern_definitions = [
            (r'\b([A-Z]{2,10}[-#\s]?\d{4,15})\b', 'ALPHA_NUMERIC', 'Standard business codes'),
            (r'\b([A-Z]+(?:_[A-Z0-9]+){2,})\b', 'UNDERSCORE_PATTERN', 'Underscore-separated codes'),
            (r'\b([A-Z]{1,5}[-#\s]?\d{4,12}[-#\s]?[A-Z0-9]{1,10})\b', 'COMPLEX_ID', 'Multi-part identifiers'),
            (r'\b(Deal\s+\d{15,25})\b', 'LONG_DEAL', 'Extended deal numbers'),
            (r'\b(REF#\d{15,25})\b', 'LONG_REF', 'Long reference numbers'),
            (r'\b([A-Z0-9]{2,}[-#@/\\_:.]+[A-Z0-9]{2,})\b', 'SPECIAL_COMPOUND', 'Compound with special chars'),
            (r'\b(\w+@\w+)\b', 'AT_PATTERN', 'At-sign patterns'),
            (r'\b(\d+\.\d+\.\d+)\b', 'DOT_NOTATION', 'Version-like patterns'),
            (r'\b(\d{1,2}/\d{1,2}/\d{2,4})\b', 'DATE_SLASH', 'Date patterns'),
            (r'\b(\d{10,20})\b', 'LONG_NUMBER', 'Long numeric codes'),
            (r'\((\d{7,15})\)', 'PARENTHETICAL', 'Numbers in parentheses'),
            (r'\[([A-Z0-9]{5,20})\]', 'BRACKETED', 'Bracketed codes'),
            (r'\b([A-Z]+:\d+)\b', 'COLON_PATTERN', 'Colon-separated'),
            (r'\b(\d{3}-\d{3}-\d{4})\b', 'PHONE_LIKE', 'Phone-like patterns'),
            (r'\b([a-f0-9]{8,})\b', 'HASH_LIKE', 'Hash-like identifiers'),
            (r'\b(SP-\d{8})\b', 'SP_PATTERN', 'SP prefixed codes'),
            (r'\b(CAS-\d{6}(?:-[A-Z0-9]+)?)\b', 'CAS_PATTERN', 'CAS patterns'),
            (r'\b([A-Z]{2,5}\d{2,}[A-Z]{0,3}#?[A-Z]{0,3})\b', 'SKU_LIKE', 'SKU-like patterns')
        ]
        
        # State tracking
        self.state = {
            'processed_count': 0,
            'total_emails': 0,
            'current_batch': 0,
            'patterns_found': defaultdict(Counter),
            'pattern_contexts': defaultdict(list),
            'unique_patterns': set(),
            'classification_hints': defaultdict(Counter),
            'timestamp': datetime.now().isoformat()
        }
        
        # Load any existing state
        self.load_state()
    
    def load_state(self):
        """Load previous state if exists"""
        state_file = self.output_dir / 'discovery_state.json'
        
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    saved_state = json.load(f)
                    
                # Restore state
                self.state['processed_count'] = saved_state.get('processed_count', 0)
                self.state['current_batch'] = saved_state.get('current_batch', 0)
                self.state['unique_patterns'] = set(saved_state.get('unique_patterns', []))
                
                # Restore complex structures
                for pattern_type, patterns in saved_state.get('patterns_found', {}).items():
                    for pattern, count in patterns.items():
                        self.state['patterns_found'][pattern_type][pattern] = count
                
                logger.info(f"Resumed from batch {self.state['current_batch']}, {self.state['processed_count']} emails processed")
            except Exception as e:
                logger.warning(f"Could not load state: {e}, starting fresh")
    
    def save_state(self):
        """Save current state (JSON serializable)"""
        state_file = self.output_dir / 'discovery_state.json'
        
        # Convert to JSON-serializable format
        save_data = {
            'processed_count': self.state['processed_count'],
            'total_emails': self.state['total_emails'],
            'current_batch': self.state['current_batch'],
            'unique_patterns': list(self.state['unique_patterns']),
            'patterns_found': {
                k: dict(v) for k, v in self.state['patterns_found'].items()
            },
            'timestamp': datetime.now().isoformat()
        }
        
        with open(state_file, 'w') as f:
            json.dump(save_data, f, indent=2)
    
    def extract_patterns(self, text: str) -> Dict[str, List[Tuple[str, str]]]:
        """Extract all patterns from text"""
        results = defaultdict(list)
        
        for pattern_regex, pattern_type, description in self.pattern_definitions:
            matches = re.finditer(pattern_regex, text, re.IGNORECASE)
            
            for match in matches:
                value = match.group(1)
                
                # Get context
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 50)
                context = text[start:end]
                
                # Track pattern
                results[pattern_type].append((value, context))
                self.state['patterns_found'][pattern_type][value] += 1
                self.state['unique_patterns'].add(value)
                
                # Classify based on context
                self.classify_by_context(value, context)
        
        return results
    
    def classify_by_context(self, pattern: str, context: str):
        """Classify pattern based on surrounding context"""
        context_lower = context.lower()
        
        # Context keywords for classification
        classifications = {
            'quote': ['quote', 'rfq', 'proposal', 'pricing'],
            'purchase_order': ['po', 'purchase', 'order'],
            'spa': ['spa', 'agreement', 'special pricing'],
            'ticket': ['ticket', 'case', 'support', 'issue'],
            'deal': ['deal', 'registration', 'opportunity'],
            'project': ['project', 'initiative'],
            'customer': ['customer', 'client', 'account'],
            'reference': ['ref', 'reference', 'internal'],
            'tracking': ['track', 'ship', 'delivery'],
            'invoice': ['invoice', 'bill', 'payment']
        }
        
        for category, keywords in classifications.items():
            if any(kw in context_lower for kw in keywords):
                self.state['classification_hints'][pattern].update([category])
    
    def process_batch(self, emails: List[Tuple]) -> Dict:
        """Process a batch of emails"""
        batch_stats = {
            'emails_processed': 0,
            'patterns_found': 0,
            'new_patterns': 0,
            'errors': 0
        }
        
        for email_id, subject, body in emails:
            try:
                # Combine subject and body
                full_text = f"{subject or ''} {body or ''}"
                
                # Extract patterns
                patterns = self.extract_patterns(full_text)
                
                # Update stats
                batch_stats['emails_processed'] += 1
                batch_stats['patterns_found'] += sum(len(p) for p in patterns.values())
                
                self.state['processed_count'] += 1
                
                # Progress indicator
                if self.state['processed_count'] % 1000 == 0:
                    logger.info(f"Processed {self.state['processed_count']:,} emails, {len(self.state['unique_patterns']):,} unique patterns")
                    self.save_state()
                    
            except Exception as e:
                batch_stats['errors'] += 1
                logger.error(f"Error processing email {email_id}: {e}")
        
        return batch_stats
    
    def run_full_discovery(self):
        """Run discovery on full dataset"""
        print("="*70)
        print("FULL TD SYNNEX PATTERN DISCOVERY PIPELINE")
        print("="*70)
        print(f"Starting at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Connect to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM emails_enhanced")
        self.state['total_emails'] = cursor.fetchone()[0]
        
        print(f"Total emails to process: {self.state['total_emails']:,}")
        
        batch_size = 1000
        total_batches = (self.state['total_emails'] // batch_size) + 1
        
        print(f"Batch size: {batch_size}")
        print(f"Total batches: {total_batches}")
        print()
        
        # Save initial state
        self.save_state()
        
        # Process in batches
        for batch_num in range(self.state['current_batch'], total_batches):
            offset = batch_num * batch_size
            
            # Fetch batch
            cursor.execute("""
                SELECT id, subject, body_content 
                FROM emails_enhanced 
                LIMIT ? OFFSET ?
            """, (batch_size, offset))
            
            emails = cursor.fetchall()
            
            if not emails:
                break
            
            # Process batch
            logger.info(f"Processing batch {batch_num + 1}/{total_batches}")
            batch_stats = self.process_batch(emails)
            
            # Update state
            self.state['current_batch'] = batch_num + 1
            
            # Save intermediate results
            if (batch_num + 1) % 10 == 0:
                self.save_intermediate_report(batch_num + 1)
        
        conn.close()
        
        # Generate final report
        self.generate_final_report()
        
        print()
        print("="*70)
        print("DISCOVERY COMPLETE")
        print("="*70)
        print(f"Emails processed: {self.state['processed_count']:,}")
        print(f"Unique patterns discovered: {len(self.state['unique_patterns']):,}")
        print(f"Pattern types: {len(self.state['patterns_found'])}")
        print()
        print(f"Results saved to: {self.output_dir}")
    
    def save_intermediate_report(self, batch_num: int):
        """Save intermediate report"""
        report_file = self.output_dir / f"intermediate_report_{batch_num}.json"
        
        report = {
            'batch': batch_num,
            'timestamp': datetime.now().isoformat(),
            'processed_count': self.state['processed_count'],
            'unique_patterns': len(self.state['unique_patterns']),
            'pattern_types': {
                ptype: len(patterns) 
                for ptype, patterns in self.state['patterns_found'].items()
            },
            'top_patterns': self.get_top_patterns(20)
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"Intermediate report saved: {report_file}")
    
    def get_top_patterns(self, n: int = 50) -> Dict:
        """Get top N patterns by frequency"""
        top_patterns = {}
        
        for pattern_type, patterns in self.state['patterns_found'].items():
            # Get top patterns for this type
            top = patterns.most_common(n)
            if top:
                top_patterns[pattern_type] = [
                    {'pattern': p, 'count': c} for p, c in top
                ]
        
        return top_patterns
    
    def generate_final_report(self):
        """Generate comprehensive final report"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Text report
        report_file = self.output_dir / f"final_report_{timestamp}.txt"
        
        with open(report_file, 'w') as f:
            f.write("="*70 + "\n")
            f.write("TD SYNNEX PATTERN DISCOVERY - FINAL REPORT\n")
            f.write("="*70 + "\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Emails processed: {self.state['processed_count']:,}\n")
            f.write(f"Unique patterns: {len(self.state['unique_patterns']):,}\n")
            f.write("\n")
            
            # Pattern type summary
            f.write("PATTERN TYPE SUMMARY:\n")
            f.write("-"*50 + "\n")
            
            for pattern_type, patterns in sorted(self.state['patterns_found'].items()):
                f.write(f"\n{pattern_type}:\n")
                f.write(f"  Total unique: {len(patterns):,}\n")
                f.write(f"  Total occurrences: {sum(patterns.values()):,}\n")
                f.write("  Top 10:\n")
                
                for pattern, count in patterns.most_common(10):
                    # Get classification hints
                    hints = self.state['classification_hints'].get(pattern)
                    if hints:
                        hint_str = f" [{', '.join(hints.most_common(1)[0][0:1])}]"
                    else:
                        hint_str = ""
                    
                    f.write(f"    - {pattern}: {count:,} times{hint_str}\n")
        
        # JSON data file
        data_file = self.output_dir / f"final_data_{timestamp}.json"
        
        with open(data_file, 'w') as f:
            json.dump({
                'metadata': {
                    'timestamp': timestamp,
                    'emails_processed': self.state['processed_count'],
                    'unique_patterns': len(self.state['unique_patterns'])
                },
                'patterns': {
                    ptype: dict(patterns.most_common(100))
                    for ptype, patterns in self.state['patterns_found'].items()
                },
                'classifications': {
                    pattern: dict(hints.most_common(3))
                    for pattern, hints in list(self.state['classification_hints'].items())[:1000]
                }
            }, f, indent=2)
        
        logger.info(f"Final report saved: {report_file}")
        logger.info(f"Final data saved: {data_file}")

if __name__ == "__main__":
    pipeline = FullPatternDiscoveryPipeline()
    pipeline.run_full_discovery()