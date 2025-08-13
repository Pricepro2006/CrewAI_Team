#!/usr/bin/env python3
"""
Quick Pattern Analysis for TD SYNNEX Emails
Fast initial analysis of 5000 emails to discover patterns
"""

import sqlite3
import re
from collections import Counter, defaultdict
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

class QuickPatternAnalyzer:
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        self.output_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/quick_patterns')
        self.output_dir.mkdir(exist_ok=True)
        
    def analyze_sample(self, sample_size: int = 5000):
        """Quick analysis of sample emails"""
        print(f"Analyzing {sample_size:,} emails for patterns...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get diverse sample
        query = """
        SELECT id, subject, body_content 
        FROM emails_enhanced 
        WHERE LENGTH(COALESCE(subject, '') || COALESCE(body_content, '')) > 50
        ORDER BY RANDOM()
        LIMIT ?
        """
        
        cursor.execute(query, (sample_size,))
        
        # Pattern collectors
        all_patterns = defaultdict(list)
        pattern_counts = defaultdict(Counter)
        context_words = defaultdict(Counter)
        
        for i, (email_id, subject, body) in enumerate(cursor):
            if i % 500 == 0:
                print(f"  Processed {i:,} emails...")
            
            text = f"{subject or ''} {body or ''}"
            
            # Find all potential identifiers
            # Format: PREFIX + numbers, with optional separators
            identifier_pattern = r'\b([A-Z]{1,5}[-#\s]?\d{6,12})\b'
            
            for match in re.finditer(identifier_pattern, text):
                identifier = match.group(1)
                position = match.start()
                
                # Get context (words around it)
                context_start = max(0, position - 50)
                context_end = min(len(text), position + 50)
                context = text[context_start:context_end]
                
                # Classify by prefix
                prefix = re.match(r'^([A-Z]+)', identifier)
                if prefix:
                    prefix_str = prefix.group(1)
                    all_patterns[prefix_str].append(identifier)
                    
                    # Count context words
                    context_lower = context.lower()
                    if 'quote' in context_lower:
                        context_words[prefix_str]['quote'] += 1
                    if 'order' in context_lower or 'po' in context_lower:
                        context_words[prefix_str]['order'] += 1
                    if 'ticket' in context_lower or 'case' in context_lower:
                        context_words[prefix_str]['ticket'] += 1
                    if 'bid' in context_lower:
                        context_words[prefix_str]['bid'] += 1
                    if 'spa' in context_lower:
                        context_words[prefix_str]['spa'] += 1
                    if 'deal' in context_lower:
                        context_words[prefix_str]['deal'] += 1
            
            # Also find pure number patterns
            number_pattern = r'\b(\d{8,10})\b'
            for match in re.finditer(number_pattern, text):
                number = match.group(1)
                position = match.start()
                
                # Check what's around it
                context_start = max(0, position - 30)
                context_end = min(len(text), position + 30)
                context = text[context_start:context_end].lower()
                
                # Classify by context
                if 'po' in context or 'order' in context:
                    all_patterns['NUMERIC_PO'].append(number)
                elif 'quote' in context or 'wq' in context:
                    all_patterns['NUMERIC_QUOTE'].append(number)
                elif 'so#' in context or 'sales order' in context:
                    all_patterns['NUMERIC_SO'].append(number)
        
        conn.close()
        
        # Analyze patterns
        print("\n" + "="*70)
        print("PATTERN ANALYSIS RESULTS")
        print("="*70)
        
        results = {}
        
        for prefix, examples in sorted(all_patterns.items()):
            if len(examples) < 3:  # Skip rare patterns
                continue
            
            # Get unique examples
            unique_examples = list(set(examples))
            
            # Analyze structure
            lengths = [len(e) for e in unique_examples]
            avg_length = sum(lengths) / len(lengths) if lengths else 0
            
            # Most common context
            contexts = context_words.get(prefix, Counter())
            top_context = contexts.most_common(1)[0] if contexts else ('unknown', 0)
            
            result = {
                'prefix': prefix,
                'count': len(examples),
                'unique_count': len(unique_examples),
                'avg_length': round(avg_length, 1),
                'min_length': min(lengths) if lengths else 0,
                'max_length': max(lengths) if lengths else 0,
                'likely_type': top_context[0],
                'context_confidence': top_context[1] / len(examples) if examples else 0,
                'examples': unique_examples[:10]  # Top 10 examples
            }
            
            results[prefix] = result
            
            # Print summary
            if len(examples) > 10:  # Only show common patterns
                print(f"\n{prefix}:")
                print(f"  Found: {len(examples)} instances ({len(unique_examples)} unique)")
                print(f"  Length: {result['min_length']}-{result['max_length']} chars")
                print(f"  Likely Type: {result['likely_type']} ({result['context_confidence']:.1%} confidence)")
                print(f"  Examples: {', '.join(unique_examples[:5])}")
        
        # Save results
        output_file = self.output_dir / f"quick_patterns_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\n\nResults saved to: {output_file}")
        
        # Generate extraction rules
        self.generate_extraction_rules(results)
        
        return results
    
    def generate_extraction_rules(self, results: Dict):
        """Generate extraction rules based on patterns"""
        rules = {
            'quotes': [],
            'orders': [],
            'tickets': [],
            'spas': [],
            'bids': [],
            'deals': []
        }
        
        # Map prefixes to entity types based on context
        for prefix, data in results.items():
            if data['count'] < 10:  # Skip rare patterns
                continue
            
            confidence = data['context_confidence']
            likely_type = data['likely_type']
            
            rule = {
                'pattern': f"{prefix}\\d{{{data['min_length']-len(prefix)},{data['max_length']-len(prefix)}}}",
                'prefix': prefix,
                'confidence': round(confidence, 2),
                'examples': data['examples'][:5]
            }
            
            # Assign to category
            if likely_type == 'quote' and confidence > 0.3:
                rules['quotes'].append(rule)
            elif likely_type == 'order' and confidence > 0.3:
                rules['orders'].append(rule)
            elif likely_type == 'ticket' and confidence > 0.3:
                rules['tickets'].append(rule)
            elif prefix in ['WQ', 'FTQ', 'Q'] or 'Q' in prefix:
                rules['quotes'].append(rule)
            elif prefix in ['PO', 'BO', 'SO']:
                rules['orders'].append(rule)
            elif prefix in ['TS', 'TASK', 'CAS', 'INC', 'SR']:
                rules['tickets'].append(rule)
            elif prefix == 'SPA':
                rules['spas'].append(rule)
            elif prefix in ['BID', 'RFQ']:
                rules['bids'].append(rule)
            elif prefix in ['DR', 'DEAL']:
                rules['deals'].append(rule)
        
        # Sort by confidence
        for category in rules:
            rules[category].sort(key=lambda x: x['confidence'], reverse=True)
        
        # Save rules
        rules_file = self.output_dir / f"extraction_rules_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(rules_file, 'w') as f:
            json.dump(rules, f, indent=2)
        
        # Print summary
        print("\n" + "="*70)
        print("EXTRACTION RULES GENERATED")
        print("="*70)
        
        for category, category_rules in rules.items():
            if category_rules:
                print(f"\n{category.upper()}:")
                for rule in category_rules[:3]:  # Top 3 rules
                    print(f"  Pattern: {rule['pattern']}")
                    print(f"  Confidence: {rule['confidence']:.1%}")
                    print(f"  Examples: {', '.join(rule['examples'][:3])}")
        
        print(f"\n\nRules saved to: {rules_file}")
        
        return rules
    
    def test_extraction(self, rules_file: str = None):
        """Test extraction rules on new emails"""
        if not rules_file:
            # Find most recent rules file
            rules_files = list(self.output_dir.glob("extraction_rules_*.json"))
            if not rules_files:
                print("No rules files found. Run analysis first.")
                return
            rules_file = max(rules_files)
        
        with open(rules_file, 'r') as f:
            rules = json.load(f)
        
        print(f"Testing rules from: {rules_file}")
        
        # Get test emails
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = """
        SELECT id, subject, body_content 
        FROM emails_enhanced 
        WHERE LENGTH(COALESCE(subject, '') || COALESCE(body_content, '')) > 50
        ORDER BY RANDOM()
        LIMIT 100
        """
        
        cursor.execute(query)
        
        total_found = defaultdict(int)
        
        for email_id, subject, body in cursor:
            text = f"{subject or ''} {body or ''}"
            
            for category, category_rules in rules.items():
                for rule in category_rules:
                    pattern = rule['pattern']
                    matches = re.findall(pattern, text)
                    if matches:
                        total_found[category] += len(matches)
        
        conn.close()
        
        print("\nExtraction Test Results (100 emails):")
        for category, count in total_found.items():
            print(f"  {category}: {count} found")

if __name__ == "__main__":
    analyzer = QuickPatternAnalyzer()
    
    # Run quick analysis
    results = analyzer.analyze_sample(sample_size=5000)
    
    # Test the extraction rules
    print("\n" + "="*70)
    print("TESTING EXTRACTION RULES")
    print("="*70)
    analyzer.test_extraction()