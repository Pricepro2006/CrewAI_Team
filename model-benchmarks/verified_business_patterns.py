#!/usr/bin/env python3
"""
Verified Business Patterns for TD SYNNEX
Based on user confirmation and domain knowledge
"""

VERIFIED_PATTERNS = {
    'microsoft_part_numbers': {
        'description': 'Microsoft vendor part numbers',
        'patterns': [
            'XHU-00001',  # 551 occurrences
            'ZDW-00001',  # 297 occurrences
            'ZJW-00001',  # 232 occurrences
            'ZDT-00001',  # 218 occurrences
            'XGT-00001',  # 215 occurrences
        ],
        'pattern_regex': r'\b[XZ][A-Z]{2}-\d{5}\b',
        'vendor': 'Microsoft'
    },
    
    'edi_references': {
        'description': 'EDI transaction references',
        'patterns': [
            'CUST850',  # 5,353 occurrences - EDI 850 Purchase Order
            'CDW856',   # 5,051 occurrences - EDI 856 Advance Ship Notice
        ],
        'pattern_regex': r'\b(CUST|CDW)\d{3}\b',
        'type': 'EDI'
    },
    
    'email_aliases': {
        'description': 'TD SYNNEX email aliases (without @domain)',
        'patterns': [
            'sales4460',  # 6,063 occurrences -> sales4460@tdsynnex.com
            'team4401',   # 1,054 occurrences -> team4401@tdsynnex.com
            'Team4401',   # 481 occurrences -> Team4401@tdsynnex.com
            'sales4406',  # 231 occurrences -> likely sales4406@tdsynnex.com
        ],
        'pattern_regex': r'\b(sales|team)\d{4}\b',
        'domain': '@tdsynnex.com'
    },
    
    'spa_patterns': {
        'description': 'Special Pricing Agreements',
        'patterns': [
            'CAS-091284-B0C6Q4',  # 309 occurrences
            'CAS-082509-Z5C9V7',  # 258 occurrences
            'CAS-067390-R3B9Z3',  # 236 occurrences
        ],
        'pattern_regex': r'\bCAS-\d{6}(?:-[A-Z0-9]+)?\b',
        'type': 'SPA'
    }
}

def classify_pattern(pattern: str) -> dict:
    """
    Classify a pattern based on verified business rules
    """
    import re
    
    # Check Microsoft part numbers
    if re.match(r'^[XZ][A-Z]{2}-\d{5}$', pattern):
        return {
            'type': 'microsoft_part_number',
            'vendor': 'Microsoft',
            'confidence': 0.95
        }
    
    # Check EDI references
    if re.match(r'^(CUST|CDW)\d{3}$', pattern):
        edi_type = {
            '850': 'Purchase Order',
            '856': 'Advance Ship Notice',
            '810': 'Invoice',
            '855': 'PO Acknowledgment'
        }
        number = pattern[-3:]
        return {
            'type': 'edi_reference',
            'edi_type': edi_type.get(number, f'EDI {number}'),
            'confidence': 0.95
        }
    
    # Check email aliases
    if re.match(r'^(sales|team)\d{4}$', pattern, re.IGNORECASE):
        return {
            'type': 'email_alias',
            'full_email': f'{pattern.lower()}@tdsynnex.com',
            'confidence': 0.90
        }
    
    # Check CAS/SPA patterns
    if re.match(r'^CAS-\d{6}', pattern):
        return {
            'type': 'spa',
            'category': 'special_pricing_agreement',
            'confidence': 1.00
        }
    
    return {'type': 'unknown', 'confidence': 0.0}

# Now let's analyze what we actually found
if __name__ == "__main__":
    import json
    
    print("VERIFIED TD SYNNEX BUSINESS PATTERNS")
    print("="*60)
    
    # Load discovery data
    with open('full_discovery/discovery_state.json', 'r') as f:
        state = json.load(f)
    
    # Categorize patterns
    categorized = {
        'microsoft_parts': [],
        'edi_references': [],
        'email_aliases': [],
        'spa_agreements': [],
        'quotes': [],
        'purchase_orders': [],
        'unknown_high_freq': []
    }
    
    # Check all high-frequency patterns
    for pattern_type, patterns in state['patterns_found'].items():
        for pattern, count in patterns.items():
            if count >= 50:  # Focus on patterns appearing 50+ times
                classification = classify_pattern(pattern)
                
                if classification['type'] == 'microsoft_part_number':
                    categorized['microsoft_parts'].append((pattern, count))
                elif classification['type'] == 'edi_reference':
                    categorized['edi_references'].append((pattern, count))
                elif classification['type'] == 'email_alias':
                    categorized['email_aliases'].append((pattern, count))
                elif classification['type'] == 'spa':
                    categorized['spa_agreements'].append((pattern, count))
                elif 'WQ' in pattern or 'FTQ' in pattern:
                    categorized['quotes'].append((pattern, count))
                elif 'PO' in pattern:
                    categorized['purchase_orders'].append((pattern, count))
                elif count >= 100:  # Unknown but frequent
                    categorized['unknown_high_freq'].append((pattern, count))
    
    # Display results
    for category, items in categorized.items():
        if items:
            print(f"\n{category.upper().replace('_', ' ')}:")
            print("-" * 40)
            for pattern, count in sorted(items, key=lambda x: x[1], reverse=True)[:10]:
                print(f"  {pattern}: {count:,} occurrences")
    
    # Summary
    total_verified = sum(len(items) for items in categorized.values())
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"  Total verified business patterns: {total_verified}")
    print(f"  Microsoft part numbers: {len(categorized['microsoft_parts'])}")
    print(f"  EDI references: {len(categorized['edi_references'])}")
    print(f"  Email aliases: {len(categorized['email_aliases'])}")
    print(f"  SPA agreements: {len(categorized['spa_agreements'])}")
    print(f"  Quotes: {len(categorized['quotes'])}")
    print(f"  Purchase Orders: {len(categorized['purchase_orders'])}")
    print(f"  Unknown (needs classification): {len(categorized['unknown_high_freq'])}")