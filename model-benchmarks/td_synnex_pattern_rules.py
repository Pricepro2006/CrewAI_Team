#!/usr/bin/env python3
"""
TD SYNNEX Pattern Rules - Verified Entity Patterns
Based on domain knowledge and pattern analysis
"""

import re
from typing import Dict, List, Tuple, Optional

class TDSynnexPatternRules:
    """
    Verified pattern rules for TD SYNNEX entity extraction
    Incorporates human feedback and domain knowledge
    """
    
    def __init__(self):
        # VERIFIED PATTERNS FROM HUMAN FEEDBACK
        self.verified_patterns = {
            'quotes': {
                'patterns': [
                    (r'\bWQ\s*[-#]?\s*(\d{9,10})\b', 'WQ', 0.95),  # WQ1234567890
                    (r'\bFTQ\s*[-#]?\s*(\d{6,10})\b', 'FTQ', 0.93),  # FTQ-3661265
                    (r'\bQ-(\d{6,10}(?:-\d{1,3})?)\b', 'Q-', 0.85),  # Q-510257-1
                    (r'\bCPQ\s*[-#]?\s*(\d{7,8})\b', 'CPQ', 0.77),  # CPQ-2360749
                    (r'\bOPP\s*[-#]?\s*(\d{7,9})\b', 'OPP', 0.74),  # OPP-1591375
                    (r'Quote\s*#?\s*(\d{8,12})\b', 'Quote', 0.70),
                ],
                'examples': [
                    'WQ1234567890', 'WQ 1234567890', 'WQ#1234567890',
                    'FTQ-430585', 'FTQ-3661265', 'FTQ 3661265',
                    'Q-510257-1', 'Q-530486',
                    'CPQ-2360749', 'OPP-1591375'
                ]
            },
            
            'pos': {
                'patterns': [
                    # Standard PO patterns (with optional leading zeros)
                    (r'\bPO\s*#?\s*0*(\d{8,10})\b', 'PO', 1.00),  # PO 505671969, PO 0505671969
                    
                    # Numeric patterns with optional leading zeros
                    (r'\b0*(505\d{6,7})\b', '505-prefix', 0.90),  # 505915850, 0505915850
                    (r'\b0*(681\d{5,7})\b', '681-prefix', 0.90),  # 68159850
                    (r'\b0*(68\d{6,7})\b', '68-prefix', 0.90),  # 68159850, 0068159850
                    (r'\b0*(708\d{5,7})\b', '708-prefix', 0.90),  # 70888585
                    (r'\b0*(70\d{6,7})\b', '70-prefix', 0.90),  # 70888585, 0070888585
                    
                    # 10-digit numbers that could be POs (with leading zero)
                    (r'\b(0\d{9})\b', 'Leading-zero', 0.85),  # 0505915850, 0068159850
                    
                    # BO patterns
                    (r'\bBO\s*#?\s*0*(\d{9,10})\b', 'BO', 0.80),  # BO#159451044, BO#0159451044
                    
                    # Vendor/Customer PO patterns
                    (r'Vendor\s*PO\s*#?\s*0*(\d{8,10})', 'VendorPO', 0.90),
                    (r'Customer\s*PO\s*#?\s*0*(\d{6,10})', 'CustomerPO', 0.90),
                ],
                'examples': [
                    # Standard formats
                    'PO 505671969', 'PO#505671969', 'PO505671969',
                    # With leading zeros
                    'PO 0505915850', 'PO 0068159850', 'PO 0070888585',
                    # Numeric only
                    '505915850', '0505915850',
                    '68159850', '0068159850', 
                    '70888585', '0070888585',
                    # BO formats
                    'BO#159451044', 'BO 159351641'
                ]
            },
            
            'spas': {  # VERIFIED: Multiple SPA formats confirmed
                'patterns': [
                    # CAS patterns - CONFIRMED SPAs
                    (r'\bCAS-(\d{6})(?:-[A-Z0-9]{5,10})?\b', 'CAS', 1.00),  # CAS-107073-B4P8K8, CAS-101607-M2L2G3
                    
                    # Standard SPA patterns
                    (r'\bSPA\s*#?\s*(\d{6,10})\b', 'SPA', 1.00),  # SPA#6605041
                    
                    # US_COM patterns - CONFIRMED SPAs
                    (r'US_COM_[A-Z]+_FY\d{2}Q\d_\d{4}', 'US_COM', 1.00),  # US_COM_SSKU_FY25Q2_3857
                    
                    # SP patterns - CONFIRMED SPAs
                    (r'\bSP-(\d{8})\b', 'SP', 1.00),  # SP-00179998
                    
                    # SCM patterns (likely SPAs based on context)
                    (r'\bSCM\s*#?\s*(\d{8})\b', 'SCM', 0.90),  # SCM#13798217
                    
                    # REF patterns that often appear with SPAs
                    (r'REF\s*#?\s*US_COM_[A-Z]+_FY\d{2}Q\d_\d{4}', 'REF_SPA', 0.95),
                ],
                'examples': [
                    # Confirmed CAS SPAs
                    'CAS-107073-B4P8K8', 'CAS-038704-B4P8K8', 'CAS-101607-M2L2G3',
                    # Standard SPAs
                    'SPA#6605041', 'SPA 6423990',
                    # US_COM SPAs
                    'US_COM_SSKU_FY25Q2_3857', 'US_COM_SSKU_FY25Q3_3972',
                    # SP SPAs
                    'SP-00179998', 'SP-00193446',
                    # SCM SPAs
                    'SCM#13798217', 'SCM 13809776'
                ]
            },
            
            'tickets': {
                'patterns': [
                    (r'\bTS-(\d{7})\b', 'TS', 0.95),  # TS-1818562
                    (r'\bTASK(\d{7})\b', 'TASK', 0.90),  # TASK1928784
                    (r'\bINC(\d{7,10})\b', 'INC', 0.85),  # INC0123456
                    (r'\bSR-(\d{6,10})\b', 'SR', 0.85),  # SR-123456
                    (r'Ticket\s*#?\s*(\d{6,10})', 'Ticket', 0.80),
                    (r'Case\s*#?\s*(\d{6,10})', 'Case', 0.80),
                ],
                'examples': [
                    'TS-1818562', 'TS-1784667',
                    'TASK1928784', 'TASK1234567',
                    'INC0123456', 'SR-123456'
                ]
            },
            
            'sos': {
                'patterns': [
                    (r'\bSO\s*#?\s*(\d{9,10})\b', 'SO', 0.80),  # SO 157370165
                    (r'\bMSO\s*#?\s*(\d{9})\b', 'MSO', 0.75),  # MSO#156578632
                    (r'Sales\s*Order\s*#?\s*(\d{9,10})', 'SalesOrder', 0.85),
                ],
                'examples': [
                    'SO 157370165', 'SO#160581697',
                    'MSO#156578632', 'MSO 162397185'
                ]
            },
            
            'bids': {
                'patterns': [
                    (r'\bBID\s*[-#]?\s*(\d{6,10})\b', 'BID', 0.85),
                    (r'\bRFQ\s*[-#]?\s*(\d{6,10})\b', 'RFQ', 0.80),
                ],
                'examples': [
                    'BID-2345678', 'BID#1234567',
                    'RFQ-1234567'
                ]
            },
            
            'deals': {
                'patterns': [
                    (r'\bDR(\d{6,10})\b', 'DR', 0.75),  # DR9140302
                    (r'Deal\s*Reg\s*#?\s*(\d{6,10})', 'DealReg', 0.80),
                    (r'Deal\s*#?\s*(\d{6,10})', 'Deal', 0.70),
                ],
                'examples': [
                    'DR9140302', 'DR-051513',
                    'Deal Reg #123456'
                ]
            }
        }
        
        # Context keywords that help identify entity types
        self.context_keywords = {
            'quotes': ['quote', 'pricing', 'quotation', 'proposal', 'wq', 'ftq'],
            'pos': ['po', 'purchase', 'order', 'vendor', 'customer po'],
            'spas': ['spa', 'special', 'pricing', 'agreement', 'cas-', 'scm'],
            'tickets': ['ticket', 'case', 'issue', 'problem', 'support', 'ts-', 'task'],
            'sos': ['sales order', 'so#', 'so ', 'mso'],
            'bids': ['bid', 'rfq', 'request for quote'],
            'deals': ['deal', 'registration', 'dr', 'opportunity']
        }
    
    def extract_entities(self, text: str) -> Dict[str, List[Dict]]:
        """
        Extract entities using verified patterns
        Returns detailed extraction with confidence scores
        """
        if not text:
            return {}
        
        results = {}
        
        for entity_type, type_patterns in self.verified_patterns.items():
            extracted = []
            
            for pattern, prefix, confidence in type_patterns['patterns']:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                
                for match in matches:
                    # Get the full matched text
                    full_match = match.group(0)
                    position = match.start()
                    
                    # Get context (50 chars before and after)
                    context_start = max(0, position - 50)
                    context_end = min(len(text), position + 50)
                    context = text[context_start:context_end]
                    
                    # Check context for additional confidence
                    context_boost = 0
                    context_lower = context.lower()
                    for keyword in self.context_keywords.get(entity_type, []):
                        if keyword in context_lower:
                            context_boost = 0.1
                            break
                    
                    extracted.append({
                        'value': full_match,
                        'prefix': prefix,
                        'confidence': min(1.0, confidence + context_boost),
                        'position': position,
                        'context': context.strip()
                    })
            
            # Remove duplicates, keeping highest confidence
            unique_values = {}
            for item in extracted:
                value = item['value']
                if value not in unique_values or item['confidence'] > unique_values[value]['confidence']:
                    unique_values[value] = item
            
            if unique_values:
                results[entity_type] = list(unique_values.values())
        
        return results
    
    def generate_extraction_prompt(self) -> str:
        """
        Generate an LLM prompt with explicit patterns
        """
        prompt = """Extract entities using these EXACT patterns found in TD SYNNEX emails:

QUOTES (High Priority):
- WQ followed by 9-10 digits: WQ1234567890, WQ#1234567890, WQ 1234567890
- FTQ followed by 6-10 digits: FTQ-3661265, FTQ-430585
- Q- followed by numbers: Q-510257-1, Q-530486
- CPQ- followed by 7-8 digits: CPQ-2360749
- OPP- followed by 7-9 digits: OPP-1591375

PURCHASE ORDERS (High Priority):
- PO followed by 8-10 digits: PO 505671969, PO#505671969
- PO with leading zeros: PO 0505915850, PO 0068159850, PO 0070888585
- Numbers starting with 505, 681, 68, 708, 70: 505915850, 68159850, 70888585
- 10-digit numbers with leading zero: 0505915850, 0068159850, 0070888585
- BO followed by 9-10 digits: BO#159451044

SPECIAL PRICING AGREEMENTS (SPAs) - VERIFIED PATTERNS:
- CAS- followed by 6 digits and suffix: CAS-107073-B4P8K8, CAS-038704-B4P8K8, CAS-101607-M2L2G3
- US_COM_ patterns: US_COM_SSKU_FY25Q2_3857, US_COM_SSKU_FY25Q3_3972
- SP- followed by 8 digits: SP-00179998, SP-00193446
- SPA# followed by 7 digits: SPA#6605041
- SCM# followed by 8 digits: SCM#13798217
- REF# with US_COM patterns: REF#US_COM_SSKU_FY25Q3_3972

TICKETS/CASES:
- TS- followed by 7 digits: TS-1818562
- TASK followed by 7 digits: TASK1928784

SALES ORDERS:
- SO followed by 9-10 digits: SO 157370165, SO#160581697
- MSO# followed by 9 digits: MSO#156578632

IMPORTANT: 
- CAS-XXXXXX patterns are SPAs, not deals
- List the ACTUAL values you find, not just "found"
- Include the complete identifier with prefix"""
        
        return prompt
    
    def validate_extraction(self, extracted_value: str, entity_type: str) -> bool:
        """
        Validate if an extracted value matches known patterns
        """
        for pattern, _, _ in self.verified_patterns[entity_type]['patterns']:
            if re.match(pattern, extracted_value, re.IGNORECASE):
                return True
        return False
    
    def get_pattern_summary(self) -> str:
        """
        Get a human-readable summary of patterns
        """
        summary = ["TD SYNNEX Entity Patterns (Verified):\n"]
        
        for entity_type, patterns in self.verified_patterns.items():
            summary.append(f"\n{entity_type.upper()}:")
            
            # Show top patterns
            for pattern, prefix, confidence in patterns['patterns'][:3]:
                summary.append(f"  {prefix}: {confidence:.0%} confidence")
            
            # Show examples
            summary.append(f"  Examples: {', '.join(patterns['examples'][:3])}")
        
        return "\n".join(summary)

def test_extraction():
    """Test the extraction with sample text"""
    
    test_text = """
    RE: Quote request WQ1234567890 and FTQ-3661265
    
    Customer PO 505915850 received for CAS-107073-B4P8K8 (SPA agreement)
    Please process order with SPA#6605041 pricing.
    
    Ticket TS-1818562 opened for issue with SO 157370165
    Reference: TASK1928784 for Quote CPQ-2360749
    """
    
    extractor = TDSynnexPatternRules()
    results = extractor.extract_entities(test_text)
    
    print("Extraction Test Results:")
    print("="*70)
    
    for entity_type, entities in results.items():
        print(f"\n{entity_type.upper()}:")
        for entity in entities:
            print(f"  {entity['value']} (confidence: {entity['confidence']:.0%})")
    
    print("\n" + "="*70)
    print(extractor.get_pattern_summary())

if __name__ == "__main__":
    test_extraction()