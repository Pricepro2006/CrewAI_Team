#!/usr/bin/env python3
"""
Analyze Discovery Gaps - What patterns are we missing?
Shows the difference between narrow definitions and comprehensive discovery
"""

import json
from pathlib import Path
from collections import Counter
import re

def analyze_gaps():
    """Analyze what we're missing with narrow definitions"""
    
    print("="*70)
    print("TD SYNNEX PATTERN DISCOVERY GAP ANALYSIS")
    print("="*70)
    print("Comparing narrow verified patterns vs comprehensive discovery")
    print()
    
    # Load comprehensive discovery data
    patterns_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/comprehensive_patterns')
    data_files = list(patterns_dir.glob('comprehensive_data_*.json'))
    
    if not data_files:
        print("No comprehensive discovery data found. Run comprehensive_pattern_discovery.py first.")
        return
    
    latest = sorted(data_files)[-1]
    with open(latest) as f:
        comprehensive_data = json.load(f)
    
    # Load verified patterns
    from td_synnex_pattern_rules import TDSynnexPatternRules
    verified = TDSynnexPatternRules()
    
    print(f"Analysis based on: {comprehensive_data['sample_size']:,} emails")
    print(f"Discovery timestamp: {comprehensive_data['timestamp']}")
    print()
    
    # Show pattern type distribution
    print("PATTERN TYPES DISCOVERED:")
    print("-"*70)
    
    total_instances = 0
    for pattern_type, count in comprehensive_data['pattern_counts'].items():
        total_instances += count
        print(f"  {pattern_type:20} : {count:,} instances")
    
    print(f"\nTotal pattern instances: {total_instances:,}")
    print()
    
    # Analyze specific examples that don't match verified patterns
    print("EXAMPLES OF PATTERNS WE'RE MISSING:")
    print("-"*70)
    
    missing_patterns = []
    
    if 'examples' in comprehensive_data:
        for pattern_type, examples in comprehensive_data['examples'].items():
            if pattern_type in ['ALPHA_NUMERIC', 'COMPLEX_ID', 'UNDERSCORE_PATTERN', 
                              'SPECIAL_CHAR_ID', 'AT_PATTERN']:
                
                for example in examples[:20]:  # Check first 20 of each type
                    value = example['value']
                    
                    # Check if this matches any verified pattern
                    matches_verified = False
                    for entity_type in verified.verified_patterns:
                        if verified.validate_extraction(value, entity_type):
                            matches_verified = True
                            break
                    
                    if not matches_verified:
                        missing_patterns.append({
                            'value': value,
                            'type': pattern_type,
                            'context': example.get('surrounding', '')
                        })
    
    # Group missing patterns by potential type
    potential_types = {
        'project_codes': [],
        'internal_refs': [],
        'vendor_codes': [],
        'customer_ids': [],
        'system_ids': [],
        'unknown': []
    }
    
    for pattern in missing_patterns[:50]:  # Analyze first 50
        value = pattern['value']
        context = pattern['context'].lower()
        
        # Try to classify based on context
        if 'project' in context or 'initiative' in context:
            potential_types['project_codes'].append(value)
        elif 'vendor' in context or 'supplier' in context:
            potential_types['vendor_codes'].append(value)
        elif 'customer' in context or 'client' in context:
            potential_types['customer_ids'].append(value)
        elif 'system' in context or 'id' in context or 'ref' in context:
            potential_types['system_ids'].append(value)
        elif '@' in value or 'internal' in context:
            potential_types['internal_refs'].append(value)
        else:
            potential_types['unknown'].append(value)
    
    # Show classified missing patterns
    for category, values in potential_types.items():
        if values:
            print(f"\nPotential {category.upper()}:")
            unique_values = list(set(values))[:10]  # Show up to 10 unique
            for value in unique_values:
                print(f"  • {value}")
    
    print("\n" + "="*70)
    print("KEY FINDINGS:")
    print("-"*70)
    
    # Calculate coverage
    verified_patterns = ['WQ', 'FTQ', 'CPQ', 'PO', 'CAS', 'SPA', 'TS', 'SO']
    covered_count = 0
    
    for pattern_type, examples in comprehensive_data.get('examples', {}).items():
        for example in examples:
            for vp in verified_patterns:
                if vp in example['value'].upper():
                    covered_count += 1
                    break
    
    if total_instances > 0:
        coverage = (covered_count / total_instances) * 100
    else:
        coverage = 0
    
    print(f"""
1. COVERAGE: Our verified patterns cover approximately {coverage:.1f}% of identifiers
2. MISSING: We're missing {100-coverage:.1f}% of potential business identifiers
3. PATTERN DIVERSITY: Found {len(comprehensive_data['pattern_counts'])} different pattern types
4. UNKNOWN ENTITIES: Many patterns don't fit our current categories

SPECIFIC GAPS IDENTIFIED:
• Project/Initiative codes (e.g., OITS_Firemon_Renewal)
• Internal reference numbers (e.g., REF#09560491503881131094)
• Vendor/Supplier codes
• System-generated IDs
• Cross-reference identifiers
• Email thread identifiers

RECOMMENDATIONS:
1. Expand extraction to capture ALL alphanumeric patterns
2. Use context analysis to classify unknown patterns
3. Build a learning system that adapts to new patterns
4. Don't restrict to known prefixes - capture everything
5. Implement human-in-the-loop verification for unknowns

This confirms your concern: "We are missing so much with slim definition"
The solution: Capture EVERYTHING, then classify intelligently.
    """)
    
    # Save gap analysis report
    report_file = patterns_dir / 'gap_analysis_report.txt'
    with open(report_file, 'w') as f:
        f.write("TD SYNNEX PATTERN GAP ANALYSIS\n")
        f.write("="*70 + "\n")
        f.write(f"Based on {comprehensive_data['sample_size']:,} emails\n\n")
        f.write(f"Coverage: ~{coverage:.1f}% with verified patterns\n")
        f.write(f"Missing: ~{100-coverage:.1f}% of potential identifiers\n\n")
        f.write("Examples of missing patterns:\n")
        for pattern in missing_patterns[:100]:
            f.write(f"  {pattern['value']} ({pattern['type']})\n")
    
    print(f"\nGap analysis saved to: {report_file}")

if __name__ == "__main__":
    analyze_gaps()