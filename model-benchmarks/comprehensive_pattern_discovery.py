#!/usr/bin/env python3
"""
Comprehensive Pattern Discovery for TD SYNNEX
Captures ALL potential identifiers and learns their types from context
"""

import sqlite3
import re
from collections import defaultdict, Counter
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Set, Tuple
import numpy as np

class ComprehensivePatternDiscovery:
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        self.output_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/comprehensive_patterns')
        self.output_dir.mkdir(exist_ok=True)
        
        # MUCH broader patterns to catch everything
        self.identifier_patterns = [
            # Any letter-number combination
            (r'\b([A-Z]{1,10}[-#\s]?\d{4,15})\b', 'ALPHA_NUMERIC'),
            
            # Pure numbers that could be identifiers (6+ digits)
            (r'\b(\d{6,15})\b', 'PURE_NUMERIC'),
            
            # Numbers with prefixes/suffixes
            (r'\b([A-Z]{1,5}[-#\s]?\d{4,12}[-#\s]?[A-Z0-9]{1,10})\b', 'COMPLEX_ID'),
            
            # Dot notation (like version numbers or hierarchical IDs)
            (r'\b(\d+\.\d+(?:\.\d+)*)\b', 'DOT_NOTATION'),
            
            # Slash separated
            (r'\b([A-Z0-9]+/[A-Z0-9]+(?:/[A-Z0-9]+)*)\b', 'SLASH_SEPARATED'),
            
            # Underscore patterns (like US_COM_...)
            (r'\b([A-Z]+(?:_[A-Z0-9]+){2,})\b', 'UNDERSCORE_PATTERN'),
            
            # Email-like patterns that might be IDs
            (r'\b([A-Z0-9]+@[A-Z0-9]+)\b', 'AT_PATTERN'),
            
            # Parenthetical numbers
            (r'\((\d{4,12})\)', 'PARENTHETICAL'),
            
            # Square bracket IDs
            (r'\[([A-Z0-9]{4,20})\]', 'BRACKETED'),
            
            # Colon separated
            (r'\b([A-Z]+:\d{4,12})\b', 'COLON_PATTERN'),
            
            # Mixed case with numbers
            (r'\b([A-Za-z]+\d+[A-Za-z0-9]*)\b', 'MIXED_CASE_NUMERIC'),
            
            # Hyphenated sequences
            (r'\b(\d{2,4}-\d{2,4}-\d{2,4}(?:-\d{2,4})*)\b', 'HYPHEN_SEQUENCE'),
            
            # Any sequence with special chars
            (r'\b([A-Z0-9]{2,}[-#@/\\_:.]+[A-Z0-9]{2,}(?:[-#@/\\_:.]+[A-Z0-9]+)*)\b', 'SPECIAL_CHAR_ID'),
        ]
        
        # Context words that help classify (expanded)
        self.context_indicators = {
            'quote': ['quote', 'pricing', 'proposal', 'quotation', 'bid', 'estimate', 'rfq', 'rfi', 'offer'],
            'order': ['order', 'po', 'purchase', 'buy', 'procure', 'requisition', 'vendor', 'supplier'],
            'spa': ['spa', 'agreement', 'contract', 'special', 'pricing', 'discount', 'terms', 'rebate'],
            'ticket': ['ticket', 'case', 'issue', 'problem', 'support', 'incident', 'help', 'trouble', 'error'],
            'invoice': ['invoice', 'bill', 'payment', 'remit', 'due', 'amount', 'charge'],
            'shipping': ['ship', 'deliver', 'track', 'freight', 'carrier', 'ups', 'fedex', 'dhl'],
            'customer': ['customer', 'client', 'account', 'company', 'partner', 'reseller'],
            'product': ['product', 'item', 'sku', 'part', 'model', 'catalog', 'inventory'],
            'project': ['project', 'initiative', 'program', 'milestone', 'phase', 'deliverable'],
            'reference': ['ref', 'reference', 'regarding', 're:', 'about', 'concerning'],
            'approval': ['approve', 'approved', 'authorization', 'authorize', 'confirm', 'accept'],
            'deal': ['deal', 'opportunity', 'prospect', 'lead', 'registration', 'win'],
            'return': ['return', 'rma', 'refund', 'exchange', 'credit', 'replace'],
            'backorder': ['backorder', 'bo', 'back order', 'pending', 'waitlist', 'shortage'],
            'sales': ['sales', 'so', 'sale', 'sold', 'revenue', 'commission'],
            'request': ['request', 'req', 'ask', 'need', 'require', 'want', 'inquiry'],
            'notification': ['notify', 'notification', 'alert', 'inform', 'update', 'announce'],
            'confirmation': ['confirm', 'confirmation', 'acknowledge', 'verify', 'validate'],
            'escalation': ['escalate', 'escalation', 'urgent', 'priority', 'critical', 'asap'],
        }
        
    def extract_all_identifiers(self, text: str) -> Dict[str, List[Tuple[str, str, str]]]:
        """
        Extract ALL potential identifiers from text
        Returns: {pattern_type: [(value, position_context, surrounding_words)]}
        """
        if not text:
            return {}
        
        # Normalize text but keep structure
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        identifiers = defaultdict(list)
        
        # Track what we've already found to avoid duplicates
        found_spans = set()
        
        for pattern, pattern_type in self.identifier_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
                span = (match.start(), match.end())
                
                # Skip if this span overlaps with something already found
                if any(s[0] <= span[0] < s[1] or s[0] < span[1] <= s[1] for s in found_spans):
                    continue
                
                found_spans.add(span)
                value = match.group(1) if match.groups() else match.group(0)
                
                # Get context
                start = max(0, match.start() - 100)
                end = min(len(text), match.end() + 100)
                context = text[start:end]
                
                # Get surrounding words
                words_before = text[max(0, match.start()-50):match.start()].split()[-5:]
                words_after = text[match.end():min(len(text), match.end()+50)].split()[:5]
                surrounding = ' '.join(words_before + ['[ID]'] + words_after)
                
                identifiers[pattern_type].append((value, context, surrounding))
        
        return identifiers
    
    def classify_by_context(self, context: str) -> Dict[str, float]:
        """
        Classify identifier type based on surrounding context
        Returns confidence scores for each type
        """
        context_lower = context.lower()
        scores = defaultdict(float)
        
        for id_type, keywords in self.context_indicators.items():
            for keyword in keywords:
                if keyword in context_lower:
                    # Weight by proximity to the identifier (assumed to be in middle)
                    mid = len(context) // 2
                    pos = context_lower.find(keyword)
                    distance = abs(pos - mid) / mid if mid > 0 else 1
                    weight = 1.0 - (distance * 0.5)  # Closer = higher weight
                    scores[id_type] += weight
        
        # Normalize scores
        total = sum(scores.values())
        if total > 0:
            for key in scores:
                scores[key] = scores[key] / total
        
        return dict(scores)
    
    def analyze_patterns(self, sample_size: int = 10000):
        """
        Comprehensive analysis of patterns in emails
        """
        print(f"Analyzing {sample_size:,} emails comprehensively...")
        print("This will capture ALL potential identifiers, not just known patterns")
        print("="*70)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get diverse sample
        query = """
        SELECT id, subject, body_content 
        FROM emails_enhanced 
        WHERE LENGTH(COALESCE(subject, '') || COALESCE(body_content, '')) > 100
        ORDER BY RANDOM()
        LIMIT ?
        """
        
        cursor.execute(query, (sample_size,))
        
        # Comprehensive collectors
        pattern_examples = defaultdict(list)
        pattern_contexts = defaultdict(lambda: defaultdict(int))
        pattern_formats = defaultdict(Counter)
        pattern_lengths = defaultdict(list)
        co_occurrences = defaultdict(lambda: defaultdict(int))
        
        for i, (email_id, subject, body) in enumerate(cursor):
            if i % 1000 == 0:
                print(f"  Processed {i:,} emails...")
            
            text = f"{subject or ''}\n{body or ''}"
            
            # Extract ALL identifiers
            identifiers = self.extract_all_identifiers(text)
            
            # Analyze each identifier
            for pattern_type, id_list in identifiers.items():
                for value, context, surrounding in id_list:
                    # Store example
                    if len(pattern_examples[pattern_type]) < 1000:  # Keep up to 1000 examples
                        pattern_examples[pattern_type].append({
                            'value': value,
                            'email_id': email_id,
                            'surrounding': surrounding
                        })
                    
                    # Classify by context
                    context_scores = self.classify_by_context(context)
                    for ctx_type, score in context_scores.items():
                        pattern_contexts[pattern_type][ctx_type] += score
                    
                    # Analyze format
                    format_str = self.get_format_string(value)
                    pattern_formats[pattern_type][format_str] += 1
                    
                    # Track length
                    pattern_lengths[pattern_type].append(len(value))
                    
                    # Track co-occurrences
                    for other_type, other_list in identifiers.items():
                        if other_type != pattern_type:
                            co_occurrences[pattern_type][other_type] += len(other_list)
        
        conn.close()
        
        # Generate comprehensive report
        self.generate_comprehensive_report(
            pattern_examples,
            pattern_contexts,
            pattern_formats,
            pattern_lengths,
            co_occurrences,
            sample_size
        )
        
        return pattern_examples, pattern_contexts
    
    def get_format_string(self, value: str) -> str:
        """Convert value to format pattern"""
        format_str = value
        # Replace consecutive digits with N
        format_str = re.sub(r'\d+', 'N', format_str)
        # Replace consecutive letters with L
        format_str = re.sub(r'[A-Z]+', 'L', format_str, flags=re.IGNORECASE)
        return format_str
    
    def generate_comprehensive_report(self, examples, contexts, formats, lengths, 
                                     co_occurrences, sample_size):
        """Generate detailed report of ALL patterns found"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.output_dir / f"comprehensive_report_{timestamp}.txt"
        
        with open(report_file, 'w') as f:
            f.write("="*70 + "\n")
            f.write("COMPREHENSIVE TD SYNNEX PATTERN DISCOVERY REPORT\n")
            f.write("="*70 + "\n")
            f.write(f"Emails Analyzed: {sample_size:,}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            # Summary of all pattern types found
            f.write("PATTERN TYPES DISCOVERED:\n")
            f.write("-"*70 + "\n")
            
            pattern_summary = []
            for pattern_type in sorted(examples.keys()):
                count = len(examples[pattern_type])
                pattern_summary.append((pattern_type, count))
            
            # Sort by frequency
            pattern_summary.sort(key=lambda x: x[1], reverse=True)
            
            for pattern_type, count in pattern_summary:
                f.write(f"\n{pattern_type}: {count} instances found\n")
                
                # Top contexts for this pattern
                if pattern_type in contexts:
                    top_contexts = sorted(contexts[pattern_type].items(), 
                                        key=lambda x: x[1], reverse=True)[:3]
                    if top_contexts:
                        f.write("  Likely types: ")
                        ctx_strs = [f"{ctx} ({score:.1f})" for ctx, score in top_contexts]
                        f.write(", ".join(ctx_strs) + "\n")
                
                # Length statistics
                if pattern_type in lengths and lengths[pattern_type]:
                    lens = lengths[pattern_type]
                    f.write(f"  Lengths: {min(lens)}-{max(lens)} chars (avg: {np.mean(lens):.1f})\n")
                
                # Top formats
                if pattern_type in formats:
                    top_formats = formats[pattern_type].most_common(3)
                    if top_formats:
                        f.write("  Top formats: ")
                        fmt_strs = [f"{fmt} ({cnt})" for fmt, cnt in top_formats]
                        f.write(", ".join(fmt_strs) + "\n")
                
                # Examples
                if pattern_type in examples:
                    unique_values = list(set(ex['value'] for ex in examples[pattern_type]))[:5]
                    f.write(f"  Examples: {', '.join(unique_values)}\n")
                
                # Co-occurrences
                if pattern_type in co_occurrences:
                    top_cooccur = sorted(co_occurrences[pattern_type].items(),
                                       key=lambda x: x[1], reverse=True)[:2]
                    if top_cooccur:
                        f.write("  Often appears with: ")
                        co_strs = [f"{other}" for other, _ in top_cooccur]
                        f.write(", ".join(co_strs) + "\n")
            
            # Unknown or ambiguous patterns that need human review
            f.write("\n" + "="*70 + "\n")
            f.write("PATTERNS NEEDING HUMAN CLASSIFICATION:\n")
            f.write("-"*70 + "\n")
            
            for pattern_type, count in pattern_summary:
                # If context classification is weak, flag for review
                if pattern_type in contexts:
                    max_score = max(contexts[pattern_type].values()) if contexts[pattern_type] else 0
                    if max_score < 5:  # Low confidence
                        f.write(f"\n{pattern_type}:\n")
                        f.write(f"  Found {count} times but unclear type\n")
                        if pattern_type in examples:
                            samples = examples[pattern_type][:3]
                            for sample in samples:
                                f.write(f"    '{sample['value']}' in: ...{sample['surrounding'][:80]}...\n")
        
        print(f"\nComprehensive report saved to: {report_file}")
        
        # Also save raw data as JSON for further analysis
        data_file = self.output_dir / f"comprehensive_data_{timestamp}.json"
        
        data_to_save = {
            'sample_size': sample_size,
            'timestamp': timestamp,
            'pattern_counts': {pt: len(ex) for pt, ex in examples.items()},
            'examples': {pt: ex[:100] for pt, ex in examples.items()},  # Save top 100 of each
            'contexts': {pt: dict(ctx) for pt, ctx in contexts.items()},
            'formats': {pt: dict(fmt.most_common(20)) for pt, fmt in formats.items()},
        }
        
        with open(data_file, 'w') as f:
            json.dump(data_to_save, f, indent=2)
        
        print(f"Raw data saved to: {data_file}")
    
    def find_unknown_patterns(self, examples, contexts):
        """
        Identify patterns that don't match any known category
        These are candidates for new entity types
        """
        unknown = []
        
        for pattern_type, pattern_examples in examples.items():
            if pattern_type in contexts:
                # Check if this pattern has weak classification
                max_confidence = max(contexts[pattern_type].values()) if contexts[pattern_type] else 0
                
                if max_confidence < 3:  # Very low confidence in all categories
                    unique_values = list(set(ex['value'] for ex in pattern_examples))
                    unknown.append({
                        'pattern_type': pattern_type,
                        'count': len(pattern_examples),
                        'examples': unique_values[:10],
                        'weak_classification': dict(contexts[pattern_type]) if contexts[pattern_type] else {}
                    })
        
        # Sort by frequency
        unknown.sort(key=lambda x: x['count'], reverse=True)
        
        return unknown

if __name__ == "__main__":
    discovery = ComprehensivePatternDiscovery()
    
    # Analyze a good sample
    examples, contexts = discovery.analyze_patterns(sample_size=10000)
    
    # Find unknown patterns
    unknown = discovery.find_unknown_patterns(examples, contexts)
    
    print("\n" + "="*70)
    print("UNKNOWN PATTERNS DISCOVERED (Need Classification):")
    print("="*70)
    
    for pattern in unknown[:10]:  # Top 10 unknown patterns
        print(f"\nPattern Type: {pattern['pattern_type']}")
        print(f"Found: {pattern['count']} times")
        print(f"Examples: {', '.join(pattern['examples'][:5])}")
        if pattern['weak_classification']:
            print(f"Weak matches: {pattern['weak_classification']}")
    
    print("\n" + "="*70)
    print("RECOMMENDATION:")
    print("="*70)
    print("""
1. This comprehensive scan found MANY more patterns than our narrow definitions
2. Review the report to identify missed entity types
3. Use human verification to classify unknown patterns
4. Update extraction rules based on discoveries
5. Don't limit to known patterns - capture everything and learn!
    """)