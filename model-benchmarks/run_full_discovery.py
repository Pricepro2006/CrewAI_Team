#!/usr/bin/env python3
"""
Full Pattern Discovery Pipeline for TD SYNNEX
Processes all 143,850 emails to discover ALL patterns
Includes progress tracking, resumability, and comprehensive reporting
"""

import sqlite3
import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict, Counter
import time
import pickle
import numpy as np
from typing import Dict, List, Tuple, Set

class FullPatternDiscoveryPipeline:
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        self.output_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/full_discovery')
        self.output_dir.mkdir(exist_ok=True)
        
        # State management for resumability
        self.state_file = self.output_dir / 'discovery_state.pkl'
        self.batch_size = 1000
        
        # Comprehensive pattern definitions
        self.pattern_definitions = [
            # Core business identifiers
            (r'\b([A-Z]{2,10}[-#\s]?\d{4,15})\b', 'ALPHA_NUMERIC', 'Standard business codes'),
            (r'\b(\d{6,15})\b', 'PURE_NUMERIC', 'Numeric identifiers'),
            (r'\b([A-Z]{1,5}[-#\s]?\d{4,12}[-#\s]?[A-Z0-9]{1,10})\b', 'COMPLEX_ID', 'Multi-part identifiers'),
            
            # Structured patterns
            (r'\b([A-Z]+(?:_[A-Z0-9]+){2,})\b', 'UNDERSCORE_PATTERN', 'Underscore-separated codes'),
            (r'\b([A-Z0-9]+/[A-Z0-9]+(?:/[A-Z0-9]+)*)\b', 'SLASH_SEPARATED', 'Slash-separated paths'),
            (r'\b(\d+\.\d+(?:\.\d+)*)\b', 'DOT_NOTATION', 'Version or hierarchical numbers'),
            
            # Special formats
            (r'\b([A-Z0-9]+@[A-Z0-9]+)\b', 'AT_PATTERN', 'At-sign patterns'),
            (r'\((\d{4,12})\)', 'PARENTHETICAL', 'Numbers in parentheses'),
            (r'\[([A-Z0-9]{4,20})\]', 'BRACKETED', 'Bracketed identifiers'),
            (r'\b([A-Z]+:\d{4,12})\b', 'COLON_PATTERN', 'Colon-separated codes'),
            
            # Compound patterns
            (r'\b(Deal\s+\d{15,25})\b', 'LONG_DEAL', 'Extended deal numbers'),
            (r'\b(Ref#\d{15,25})\b', 'LONG_REF', 'Extended reference numbers'),
            (r'\b([A-Z]{2,4}\d{2,4}[A-Z]{2,4}\d{2,4})\b', 'ALTERNATING', 'Letter-number alternating'),
            
            # Email and system patterns
            (r'\b([a-z]+_[a-z]+_\d+)\b', 'LOWERCASE_SYSTEM', 'System-generated lowercase'),
            (r'\b([A-Z]{3,10}_\d{8}_[A-Z0-9]+)\b', 'TIMESTAMPED', 'Timestamped identifiers'),
            
            # Hash-like patterns
            (r'\b([a-f0-9]{8,40})\b', 'HASH_LIKE', 'Hash or hex identifiers'),
            (r'\b(0x[0-9a-fA-F]{4,16})\b', 'HEX_PREFIX', 'Hexadecimal with prefix'),
            
            # Compound with special chars
            (r'\b([A-Z0-9]{2,}[-#@/\\_:.]+[A-Z0-9]{2,}(?:[-#@/\\_:.]+[A-Z0-9]+)*)\b', 
             'SPECIAL_COMPOUND', 'Complex multi-part with special chars'),
        ]
        
        # Context classification keywords (expanded)
        self.context_map = {
            'quote': ['quote', 'pricing', 'proposal', 'quotation', 'bid', 'estimate', 'rfq', 'rfi'],
            'order': ['order', 'po', 'purchase', 'buy', 'procure', 'vendor', 'supplier'],
            'spa': ['spa', 'agreement', 'contract', 'special', 'pricing', 'discount', 'rebate'],
            'ticket': ['ticket', 'case', 'issue', 'problem', 'support', 'incident', 'trouble'],
            'project': ['project', 'initiative', 'program', 'milestone', 'phase', 'task'],
            'customer': ['customer', 'client', 'account', 'company', 'partner', 'reseller'],
            'internal': ['internal', 'ref', 'reference', 'system', 'generated', 'auto'],
            'tracking': ['track', 'tracking', 'shipment', 'delivery', 'carrier', 'freight'],
            'invoice': ['invoice', 'bill', 'payment', 'remit', 'due', 'amount'],
            'product': ['product', 'item', 'sku', 'part', 'model', 'catalog'],
            'deal': ['deal', 'opportunity', 'prospect', 'registration', 'win'],
            'approval': ['approve', 'approved', 'authorization', 'confirm', 'accept'],
            'notification': ['notify', 'alert', 'inform', 'update', 'announce', 'reminder'],
            'return': ['return', 'rma', 'refund', 'exchange', 'credit', 'replace'],
            'escalation': ['escalate', 'urgent', 'priority', 'critical', 'asap', 'important'],
        }
        
        # Initialize or load state
        self.state = self.load_state()
    
    def load_state(self) -> Dict:
        """Load previous state for resumability"""
        if self.state_file.exists():
            with open(self.state_file, 'rb') as f:
                state = pickle.load(f)
                print(f"Resuming from batch {state['current_batch']}/{state['total_batches']}")
                return state
        else:
            return {
                'current_batch': 0,
                'total_batches': 0,
                'patterns_found': defaultdict(list),
                'pattern_contexts': defaultdict(lambda: defaultdict(float)),
                'pattern_frequencies': defaultdict(int),
                'unique_values': set(),
                'processing_times': [],
                'start_time': datetime.now().isoformat()
            }
    
    def save_state(self):
        """Save current state for resumability"""
        with open(self.state_file, 'wb') as f:
            pickle.dump(self.state, f)
    
    def extract_comprehensive_patterns(self, text: str) -> Dict[str, List[Tuple]]:
        """Extract all patterns from text with context"""
        if not text:
            return {}
        
        patterns_found = defaultdict(list)
        found_spans = set()  # Avoid overlaps
        
        for pattern_regex, pattern_type, description in self.pattern_definitions:
            for match in re.finditer(pattern_regex, text, re.IGNORECASE | re.MULTILINE):
                span = (match.start(), match.end())
                
                # Skip overlapping matches
                if any(s[0] <= span[0] < s[1] or s[0] < span[1] <= s[1] for s in found_spans):
                    continue
                
                found_spans.add(span)
                value = match.group(1) if match.groups() else match.group(0)
                
                # Extract context window
                context_start = max(0, match.start() - 100)
                context_end = min(len(text), match.end() + 100)
                context = text[context_start:context_end]
                
                # Get surrounding words for classification
                words_before = text[max(0, match.start()-50):match.start()].split()[-5:]
                words_after = text[match.end():min(len(text), match.end()+50)].split()[:5]
                
                patterns_found[pattern_type].append({
                    'value': value,
                    'context': context,
                    'words_before': words_before,
                    'words_after': words_after,
                    'position': match.start()
                })
        
        return patterns_found
    
    def classify_pattern_context(self, context: str, words_before: List[str], words_after: List[str]) -> Dict[str, float]:
        """Classify pattern based on context with confidence scores"""
        scores = defaultdict(float)
        
        # Combine all context
        full_context = ' '.join(words_before + words_after).lower()
        context_lower = context.lower()
        
        for category, keywords in self.context_map.items():
            for keyword in keywords:
                # Check in immediate context
                if keyword in full_context:
                    scores[category] += 2.0  # Higher weight for immediate context
                
                # Check in wider context
                if keyword in context_lower:
                    scores[category] += 1.0
        
        # Normalize scores
        total = sum(scores.values())
        if total > 0:
            for key in scores:
                scores[key] = scores[key] / total
        
        return dict(scores)
    
    def process_batch(self, emails: List[Tuple]) -> Dict:
        """Process a batch of emails"""
        batch_results = {
            'patterns': defaultdict(list),
            'classifications': defaultdict(lambda: defaultdict(float)),
            'unique_values': set(),
            'email_count': len(emails)
        }
        
        for email_id, subject, body in emails:
            text = f"{subject or ''}\n{body or ''}"
            
            # Extract patterns
            patterns = self.extract_comprehensive_patterns(text)
            
            # Process each pattern
            for pattern_type, instances in patterns.items():
                for instance in instances:
                    value = instance['value']
                    
                    # Store unique value
                    batch_results['unique_values'].add(value)
                    
                    # Classify context
                    classification = self.classify_pattern_context(
                        instance['context'],
                        instance['words_before'],
                        instance['words_after']
                    )
                    
                    # Aggregate classifications
                    for category, score in classification.items():
                        batch_results['classifications'][pattern_type][category] += score
                    
                    # Store pattern instance (limit storage)
                    if len(batch_results['patterns'][pattern_type]) < 100:
                        batch_results['patterns'][pattern_type].append({
                            'value': value,
                            'email_id': email_id,
                            'classification': classification
                        })
        
        return batch_results
    
    def run_full_discovery(self):
        """Run discovery on entire email dataset"""
        print("="*70)
        print("FULL TD SYNNEX PATTERN DISCOVERY PIPELINE")
        print("="*70)
        print(f"Starting at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM emails_enhanced")
        total_emails = cursor.fetchone()[0]
        self.state['total_batches'] = (total_emails // self.batch_size) + 1
        
        print(f"Total emails to process: {total_emails:,}")
        print(f"Batch size: {self.batch_size}")
        print(f"Total batches: {self.state['total_batches']}")
        print()
        
        # Process in batches
        for batch_num in range(self.state['current_batch'], self.state['total_batches']):
            batch_start = time.time()
            
            # Get batch of emails
            offset = batch_num * self.batch_size
            query = """
            SELECT id, subject, body_content 
            FROM emails_enhanced 
            LIMIT ? OFFSET ?
            """
            cursor.execute(query, (self.batch_size, offset))
            emails = cursor.fetchall()
            
            if not emails:
                break
            
            # Process batch
            batch_results = self.process_batch(emails)
            
            # Update state
            for pattern_type, instances in batch_results['patterns'].items():
                self.state['patterns_found'][pattern_type].extend(instances[:10])  # Limit storage
            
            for pattern_type, classifications in batch_results['classifications'].items():
                for category, score in classifications.items():
                    self.state['pattern_contexts'][pattern_type][category] += score
            
            self.state['unique_values'].update(batch_results['unique_values'])
            
            # Update progress
            self.state['current_batch'] = batch_num + 1
            batch_time = time.time() - batch_start
            self.state['processing_times'].append(batch_time)
            
            # Save state periodically
            if batch_num % 10 == 0:
                self.save_state()
            
            # Progress report
            progress = (batch_num + 1) / self.state['total_batches'] * 100
            avg_time = np.mean(self.state['processing_times'][-10:])
            remaining_batches = self.state['total_batches'] - batch_num - 1
            eta = remaining_batches * avg_time / 60  # in minutes
            
            print(f"Batch {batch_num + 1}/{self.state['total_batches']} ({progress:.1f}%) - "
                  f"Time: {batch_time:.1f}s - ETA: {eta:.1f} min")
            
            # Generate intermediate report every 50 batches
            if batch_num % 50 == 0 and batch_num > 0:
                self.generate_intermediate_report(batch_num)
        
        conn.close()
        
        # Generate final report
        self.generate_final_report()
        
        print("\n" + "="*70)
        print("DISCOVERY COMPLETE!")
        print(f"Unique patterns found: {len(self.state['unique_values']):,}")
        print(f"Reports saved to: {self.output_dir}")
    
    def generate_intermediate_report(self, batch_num: int):
        """Generate intermediate progress report"""
        report_file = self.output_dir / f'intermediate_report_batch_{batch_num}.json'
        
        report = {
            'batch_number': batch_num,
            'timestamp': datetime.now().isoformat(),
            'unique_patterns': len(self.state['unique_values']),
            'pattern_types': {
                pt: len(instances) for pt, instances in self.state['patterns_found'].items()
            },
            'top_classifications': {}
        }
        
        # Get top classifications for each pattern type
        for pattern_type, classifications in self.state['pattern_contexts'].items():
            if classifications:
                top_3 = sorted(classifications.items(), key=lambda x: x[1], reverse=True)[:3]
                report['top_classifications'][pattern_type] = top_3
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"  Intermediate report saved: {report_file.name}")
    
    def generate_final_report(self):
        """Generate comprehensive final report"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Text report
        text_report = self.output_dir / f'final_report_{timestamp}.txt'
        with open(text_report, 'w') as f:
            f.write("="*70 + "\n")
            f.write("TD SYNNEX COMPREHENSIVE PATTERN DISCOVERY - FINAL REPORT\n")
            f.write("="*70 + "\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Emails processed: {self.state['current_batch'] * self.batch_size:,}\n")
            f.write(f"Unique patterns discovered: {len(self.state['unique_values']):,}\n\n")
            
            # Pattern type summary
            f.write("PATTERN TYPES SUMMARY:\n")
            f.write("-"*70 + "\n")
            
            for pattern_type, instances in sorted(self.state['patterns_found'].items()):
                f.write(f"\n{pattern_type}:\n")
                f.write(f"  Instances found: {len(instances)}\n")
                
                # Top classifications
                if pattern_type in self.state['pattern_contexts']:
                    classifications = self.state['pattern_contexts'][pattern_type]
                    if classifications:
                        top_5 = sorted(classifications.items(), key=lambda x: x[1], reverse=True)[:5]
                        f.write("  Likely categories:\n")
                        for category, score in top_5:
                            f.write(f"    - {category}: {score:.1f}\n")
                
                # Example values
                if instances:
                    unique_examples = list(set(inst['value'] for inst in instances))[:10]
                    f.write("  Examples:\n")
                    for example in unique_examples:
                        f.write(f"    - {example}\n")
            
            # Unknown patterns needing classification
            f.write("\n" + "="*70 + "\n")
            f.write("PATTERNS NEEDING HUMAN CLASSIFICATION:\n")
            f.write("-"*70 + "\n")
            
            for pattern_type, classifications in self.state['pattern_contexts'].items():
                if classifications:
                    max_score = max(classifications.values()) if classifications else 0
                    if max_score < 5:  # Low confidence patterns
                        f.write(f"\n{pattern_type}: (Low confidence - needs review)\n")
                        if pattern_type in self.state['patterns_found']:
                            examples = self.state['patterns_found'][pattern_type][:5]
                            for ex in examples:
                                f.write(f"  - {ex['value']}\n")
        
        # JSON data file
        json_report = self.output_dir / f'final_data_{timestamp}.json'
        with open(json_report, 'w') as f:
            json.dump({
                'summary': {
                    'total_emails_processed': self.state['current_batch'] * self.batch_size,
                    'unique_patterns': len(self.state['unique_values']),
                    'pattern_types': len(self.state['patterns_found']),
                    'processing_time_hours': sum(self.state['processing_times']) / 3600
                },
                'pattern_types': {
                    pt: {
                        'count': len(instances),
                        'examples': [inst['value'] for inst in instances[:20]],
                        'classifications': dict(self.state['pattern_contexts'].get(pt, {}))
                    }
                    for pt, instances in self.state['patterns_found'].items()
                },
                'timestamp': timestamp
            }, f, indent=2)
        
        print(f"\nFinal reports generated:")
        print(f"  Text report: {text_report}")
        print(f"  JSON data: {json_report}")

if __name__ == "__main__":
    pipeline = FullPatternDiscoveryPipeline()
    pipeline.run_full_discovery()