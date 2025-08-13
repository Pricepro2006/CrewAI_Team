#!/usr/bin/env python3
"""
True Pattern Discovery - Finding Real Patterns in Unknown Emails
No assumptions about content, just statistical pattern discovery
"""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TruePatternDiscovery:
    """Discover patterns without domain assumptions"""
    
    def __init__(self):
        self.min_frequency = 50  # Must appear 50+ times to be a pattern
        self.min_pattern_ratio = 0.0003  # Must be in 0.03% of emails (43 emails for 143K)
        
        # Noise filters - things we know are NOT business patterns
        self.noise_patterns = {
            'html_css': [
                r'^(font|margin|padding|color|size|style|text|div|span|class|id)',
                r'^(px|pt|em|rem|\d+\.\d+pt)$',
                r'^#[0-9A-Fa-f]{6}$',  # Hex colors
                r'^(top|bottom|left|right|center):\d+',
            ],
            'mime_headers': [
                r'^(Content-Type|Content-Transfer|MIME-Version|charset)',
                r'^(text/html|text/plain|multipart)',
            ],
            'common_words': [
                r'^(the|and|for|with|from|this|that|have|will|your|been)$',
            ]
        }
        
    def is_noise(self, pattern: str) -> bool:
        """Check if a pattern is noise"""
        pattern_lower = pattern.lower()
        
        # Check against noise patterns
        for category, regexes in self.noise_patterns.items():
            for regex in regexes:
                if re.match(regex, pattern_lower):
                    return True
        
        # Filter out single characters or very short
        if len(pattern) < 3:
            return True
            
        # Filter out pure HTML tags
        if pattern.startswith('<') and pattern.endswith('>'):
            return True
            
        return False
    
    def extract_structural_patterns(self, patterns_data: dict) -> dict:
        """Find structural patterns (formats that repeat with different values)"""
        
        structural_patterns = defaultdict(list)
        
        for pattern_type, patterns in patterns_data.items():
            for pattern, count in patterns.items():
                if count < self.min_frequency:
                    continue
                    
                if self.is_noise(pattern):
                    continue
                
                # Identify structure
                structure = self.get_pattern_structure(pattern)
                if structure:
                    structural_patterns[structure].append({
                        'value': pattern,
                        'count': count,
                        'type': pattern_type
                    })
        
        return structural_patterns
    
    def get_pattern_structure(self, pattern: str) -> str:
        """Extract the structure of a pattern"""
        
        # Replace numbers with #
        structure = re.sub(r'\d+', '#', pattern)
        
        # Replace lowercase letters with @
        structure = re.sub(r'[a-z]+', '@', structure)
        
        # Replace uppercase letters with A
        structure = re.sub(r'[A-Z]+', 'A', structure)
        
        # Only return if it's a meaningful structure
        if '#' in structure or 'A' in structure:
            # Avoid too generic structures
            if structure not in ['#', 'A', '@', 'A#', '#A', '@#']:
                return structure
        
        return None
    
    def analyze_patterns(self, json_file: str):
        """Analyze patterns from discovery JSON"""
        
        logger.info("Loading pattern data...")
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        total_emails = data.get('processed_count', 143000)
        patterns_data = data.get('patterns_found', {})
        
        print("="*70)
        print("TRUE PATTERN DISCOVERY ANALYSIS")
        print("="*70)
        print(f"Total emails analyzed: {total_emails:,}")
        print()
        
        # 1. Find high-frequency non-noise patterns
        real_patterns = defaultdict(list)
        total_unique = 0
        total_occurrences = 0
        
        for pattern_type, patterns in patterns_data.items():
            for pattern, count in patterns.items():
                total_unique += 1
                total_occurrences += count
                
                if count >= self.min_frequency and not self.is_noise(pattern):
                    real_patterns[pattern_type].append({
                        'pattern': pattern,
                        'count': count,
                        'frequency': count / total_emails
                    })
        
        # 2. Sort and display real patterns
        print("HIGH-FREQUENCY PATTERNS (50+ occurrences, excluding noise):")
        print("-"*70)
        
        all_patterns = []
        for pattern_type, patterns in real_patterns.items():
            for p in patterns:
                all_patterns.append((p['pattern'], p['count'], pattern_type))
        
        # Sort by frequency
        all_patterns.sort(key=lambda x: x[1], reverse=True)
        
        # Group by frequency ranges
        ranges = {
            '10,000+': [],
            '1,000-9,999': [],
            '500-999': [],
            '100-499': [],
            '50-99': []
        }
        
        for pattern, count, ptype in all_patterns:
            if count >= 10000:
                ranges['10,000+'].append((pattern, count, ptype))
            elif count >= 1000:
                ranges['1,000-9,999'].append((pattern, count, ptype))
            elif count >= 500:
                ranges['500-999'].append((pattern, count, ptype))
            elif count >= 100:
                ranges['100-499'].append((pattern, count, ptype))
            else:
                ranges['50-99'].append((pattern, count, ptype))
        
        for range_name, items in ranges.items():
            if items:
                print(f"\n{range_name} occurrences ({len(items)} patterns):")
                for pattern, count, ptype in items[:10]:  # Show top 10 per range
                    pct = (count / total_emails) * 100
                    print(f"  {pattern:<30} {count:>7,} times ({pct:>5.2f}%) [{ptype}]")
        
        # 3. Find structural patterns
        print("\n" + "="*70)
        print("STRUCTURAL PATTERNS (formats that repeat):")
        print("-"*70)
        
        structural = self.extract_structural_patterns(patterns_data)
        
        # Sort by number of instances
        sorted_structures = sorted(structural.items(), 
                                 key=lambda x: len(x[1]), 
                                 reverse=True)
        
        shown = 0
        for structure, instances in sorted_structures[:20]:
            if len(instances) >= 3:  # At least 3 different values with same structure
                total_count = sum(i['count'] for i in instances)
                print(f"\nStructure: {structure}")
                print(f"  Total occurrences: {total_count:,}")
                print(f"  Unique values: {len(instances)}")
                print(f"  Examples:")
                for inst in instances[:5]:
                    print(f"    - {inst['value']} ({inst['count']:,} times)")
                shown += 1
                if shown >= 10:
                    break
        
        # 4. Statistical summary
        print("\n" + "="*70)
        print("STATISTICAL SUMMARY:")
        print("-"*70)
        
        real_pattern_count = sum(len(p) for p in real_patterns.values())
        noise_filtered = total_unique - real_pattern_count
        
        print(f"Total unique strings found: {total_unique:,}")
        print(f"Filtered as noise: {noise_filtered:,} ({noise_filtered/total_unique*100:.1f}%)")
        print(f"Real patterns (50+ frequency): {real_pattern_count:,}")
        print(f"Pattern discovery rate: {real_pattern_count/total_emails*100:.3f}%")
        
        # 5. Pattern categories
        print("\nPATTERN CATEGORIES:")
        for ptype, patterns in real_patterns.items():
            if patterns:
                total = sum(p['count'] for p in patterns)
                print(f"  {ptype}: {len(patterns)} patterns, {total:,} total occurrences")
        
        return real_patterns, structural

def main():
    """Run true pattern discovery"""
    
    discovery = TruePatternDiscovery()
    
    # Check for discovery state file
    state_file = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/full_discovery/discovery_state.json')
    
    if state_file.exists():
        real_patterns, structural = discovery.analyze_patterns(str(state_file))
        
        # Save clean patterns
        output = {
            'high_frequency_patterns': {},
            'structural_patterns': {},
            'statistics': {}
        }
        
        for ptype, patterns in real_patterns.items():
            output['high_frequency_patterns'][ptype] = [
                {
                    'pattern': p['pattern'],
                    'count': p['count'],
                    'frequency_pct': p['frequency'] * 100
                }
                for p in sorted(patterns, key=lambda x: x['count'], reverse=True)
            ]
        
        for structure, instances in structural.items():
            if len(instances) >= 3:
                output['structural_patterns'][structure] = {
                    'total_occurrences': sum(i['count'] for i in instances),
                    'unique_values': len(instances),
                    'examples': [
                        {'value': i['value'], 'count': i['count']} 
                        for i in instances[:10]
                    ]
                }
        
        # Save results
        output_file = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/true_patterns_discovered.json')
        with open(output_file, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(f"\nResults saved to: {output_file}")
        
    else:
        print("Discovery state file not found. Please run pattern discovery first.")

if __name__ == "__main__":
    main()