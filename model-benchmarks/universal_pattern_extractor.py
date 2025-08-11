#!/usr/bin/env python3
"""
Universal Pattern Extractor - Extract patterns from any email type
No domain assumptions - works with structural patterns found in discovery
"""

import re
import json
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ExtractedPattern:
    """A pattern extracted from text"""
    value: str
    structure: str  # e.g., "A-#", "#/#/#", "A@.A@"
    position: int
    confidence: float
    context: str = ""  # Surrounding text for context

@dataclass
class UniversalExtractionResult:
    """Result of universal pattern extraction"""
    text_length: int
    patterns_found: List[ExtractedPattern] = field(default_factory=list)
    structural_summary: Dict[str, int] = field(default_factory=dict)
    processing_time: float = 0.0

class UniversalPatternExtractor:
    """Extract patterns without domain assumptions"""
    
    def __init__(self):
        # Load discovered patterns
        self.load_discovered_patterns()
        
        # Define structural pattern regex mappings
        self.structural_patterns = {
            'A-#': r'\b[A-Z]+-\d+\b',  # e.g., XHU-00001, DR-0425
            'A#-#': r'\b[A-Z]+\d+-\d+\b',  # e.g., CAS107073-4, SP2024-15
            '#/#/#': r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',  # Dates
            '#-#-#': r'\b\d{1,2}-\d{1,2}-\d{2,4}\b',  # Alt dates
            'A@.A@': r'\b[A-Z][a-z]+\.[A-Z][a-z]+\b',  # e.g., Nick.Paul
            '@#': r'\b[a-z]+\d+\b',  # e.g., sales4460, team4401
            'A#': r'\b[A-Z]+\d+\b',  # e.g., WQ1234, PO5678
            '#A': r'\b\d+[A-Z]+\b',  # e.g., 123ABC
            'A-#-A#A#': r'\b[A-Z]+-\d{6}-[A-Z0-9]+\b',  # e.g., CAS-091284-B0C6Q4
            'A.#.#.#': r'\b[A-Z]+\.\d+\.\d+\.\d+\b',  # Version numbers
            '@-@': r'\b[a-z]+-[a-z]+\b',  # Hyphenated words
            'A_A': r'\b[A-Z]+_[A-Z]+\b',  # e.g., US_COM
            '@_@': r'\b[a-z]+_[a-z]+\b',  # snake_case
            '#.#.#.#': r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',  # IP addresses
            'A{2,3}-\d{5}': r'\b[A-Z]{2,3}-\d{5}\b',  # Specific part numbers
            '@@#': r'\b[a-z]{2,}\d+\b',  # e.g., order123, case456
            'A@#': r'\b[A-Z][a-z]+\d+\b',  # e.g., Task123
            '#-#': r'\b\d+-\d+\b',  # Number ranges
            '@.@': r'\b[a-z]+\.[a-z]+\b',  # Domain-like
            'A/A': r'\b[A-Z]+/[A-Z]+\b',  # e.g., NA/EMEA
        }
        
        # Common noise to filter (but less aggressive than before)
        self.noise_filters = [
            r'^(px|pt|em|rem|vh|vw)$',  # CSS units
            r'^#[0-9a-f]{6}$',  # Hex colors
            r'^(div|span|td|tr|table)$',  # HTML tags
            r'^(and|the|for|with|from|this|that)$',  # Common words
        ]
        
    def load_discovered_patterns(self):
        """Load patterns from discovery"""
        try:
            pattern_file = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/true_patterns_discovered.json')
            if pattern_file.exists():
                with open(pattern_file, 'r') as f:
                    self.discovered_data = json.load(f)
                    logger.info(f"Loaded {len(self.discovered_data.get('structural_patterns', {}))} structural patterns")
            else:
                self.discovered_data = {}
                logger.warning("No discovered patterns file found")
        except Exception as e:
            logger.error(f"Error loading patterns: {e}")
            self.discovered_data = {}
    
    def is_noise(self, text: str) -> bool:
        """Check if text is likely noise"""
        text_lower = text.lower()
        
        # Check noise filters
        for pattern in self.noise_filters:
            if re.match(pattern, text_lower):
                return True
        
        # Single char or very short
        if len(text) < 2:
            return True
        
        # Pure HTML tag
        if text.startswith('<') and text.endswith('>'):
            return True
        
        return False
    
    def get_structure(self, text: str) -> str:
        """Determine the structure of a text pattern"""
        # Replace sequences
        structure = re.sub(r'\d+', '#', text)  # Numbers
        structure = re.sub(r'[a-z]+', '@', structure)  # Lowercase
        structure = re.sub(r'[A-Z]+', 'A', structure)  # Uppercase
        
        # Simplify repeated chars
        structure = re.sub(r'#{2,}', '#', structure)
        structure = re.sub(r'@{2,}', '@', structure)
        structure = re.sub(r'A{2,}', 'A', structure)
        
        return structure
    
    def extract_patterns(self, text: str) -> UniversalExtractionResult:
        """Extract patterns from text without domain assumptions"""
        start_time = datetime.now()
        result = UniversalExtractionResult(text_length=len(text))
        
        # Track what we find
        found_patterns = []
        structural_counts = {}
        
        # 1. Apply structural pattern matching
        for structure_name, pattern_regex in self.structural_patterns.items():
            matches = re.finditer(pattern_regex, text, re.IGNORECASE)
            
            for match in matches:
                value = match.group()
                
                # Skip noise
                if self.is_noise(value):
                    continue
                
                # Get context (20 chars before and after)
                start = max(0, match.start() - 20)
                end = min(len(text), match.end() + 20)
                context = text[start:end].replace('\n', ' ').strip()
                
                # Calculate confidence based on pattern frequency in discovery
                confidence = self.calculate_confidence(value, structure_name)
                
                pattern = ExtractedPattern(
                    value=value,
                    structure=structure_name,
                    position=match.start(),
                    confidence=confidence,
                    context=context
                )
                
                found_patterns.append(pattern)
                structural_counts[structure_name] = structural_counts.get(structure_name, 0) + 1
        
        # 2. Look for high-frequency patterns from discovery
        if 'high_frequency_patterns' in self.discovered_data:
            for category, patterns in self.discovered_data['high_frequency_patterns'].items():
                for pattern_info in patterns:
                    pattern_value = pattern_info.get('pattern', '')
                    if pattern_value and pattern_value in text:
                        # Find all occurrences
                        for match in re.finditer(re.escape(pattern_value), text):
                            structure = self.get_structure(pattern_value)
                            
                            pattern = ExtractedPattern(
                                value=pattern_value,
                                structure=structure,
                                position=match.start(),
                                confidence=0.95,  # High confidence for known patterns
                                context=text[max(0, match.start()-20):min(len(text), match.end()+20)]
                            )
                            
                            if pattern not in found_patterns:
                                found_patterns.append(pattern)
                                structural_counts[structure] = structural_counts.get(structure, 0) + 1
        
        # 3. Sort by position and deduplicate
        found_patterns.sort(key=lambda x: x.position)
        
        # Remove duplicates (same value at same position)
        unique_patterns = []
        seen = set()
        for pattern in found_patterns:
            key = (pattern.value, pattern.position)
            if key not in seen:
                unique_patterns.append(pattern)
                seen.add(key)
        
        result.patterns_found = unique_patterns
        result.structural_summary = structural_counts
        result.processing_time = (datetime.now() - start_time).total_seconds()
        
        return result
    
    def calculate_confidence(self, value: str, structure: str) -> float:
        """Calculate confidence based on discovery data"""
        base_confidence = 0.5
        
        # Check if this exact value was in high-frequency patterns
        if 'high_frequency_patterns' in self.discovered_data:
            for category, patterns in self.discovered_data['high_frequency_patterns'].items():
                for pattern_info in patterns:
                    if pattern_info.get('pattern') == value:
                        # High frequency patterns get high confidence
                        count = pattern_info.get('count', 0)
                        if count > 1000:
                            return 0.95
                        elif count > 100:
                            return 0.85
                        elif count > 50:
                            return 0.75
        
        # Check structural patterns
        if 'structural_patterns' in self.discovered_data:
            if structure in self.discovered_data['structural_patterns']:
                struct_data = self.discovered_data['structural_patterns'][structure]
                occurrences = struct_data.get('total_occurrences', 0)
                
                # More occurrences = higher confidence
                if occurrences > 10000:
                    base_confidence = 0.8
                elif occurrences > 1000:
                    base_confidence = 0.7
                elif occurrences > 100:
                    base_confidence = 0.6
        
        return base_confidence
    
    def summarize_extraction(self, result: UniversalExtractionResult) -> str:
        """Create a human-readable summary"""
        summary = []
        summary.append(f"Text Analysis Summary")
        summary.append("=" * 50)
        summary.append(f"Text length: {result.text_length:,} characters")
        summary.append(f"Patterns found: {len(result.patterns_found)}")
        summary.append(f"Processing time: {result.processing_time:.3f} seconds")
        
        if result.structural_summary:
            summary.append("\nPattern Types Found:")
            for structure, count in sorted(result.structural_summary.items(), 
                                         key=lambda x: x[1], reverse=True):
                summary.append(f"  {structure}: {count} occurrences")
        
        if result.patterns_found:
            summary.append("\nTop Patterns by Confidence:")
            top_patterns = sorted(result.patterns_found, 
                                key=lambda x: x.confidence, reverse=True)[:10]
            
            for pattern in top_patterns:
                summary.append(f"  [{pattern.confidence:.2f}] {pattern.value} ({pattern.structure})")
                if pattern.context:
                    summary.append(f"        Context: ...{pattern.context}...")
        
        return "\n".join(summary)
    
    def extract_from_email(self, email_text: str, email_id: str = None) -> Dict:
        """Extract patterns from an email and return structured data"""
        result = self.extract_patterns(email_text)
        
        # Group patterns by structure for easier analysis
        patterns_by_structure = {}
        for pattern in result.patterns_found:
            if pattern.structure not in patterns_by_structure:
                patterns_by_structure[pattern.structure] = []
            patterns_by_structure[pattern.structure].append({
                'value': pattern.value,
                'confidence': pattern.confidence,
                'position': pattern.position
            })
        
        return {
            'email_id': email_id,
            'timestamp': datetime.now().isoformat(),
            'text_length': result.text_length,
            'total_patterns': len(result.patterns_found),
            'processing_time': result.processing_time,
            'patterns_by_structure': patterns_by_structure,
            'structural_summary': result.structural_summary,
            'high_confidence_patterns': [
                {'value': p.value, 'structure': p.structure, 'confidence': p.confidence}
                for p in result.patterns_found if p.confidence >= 0.8
            ]
        }


def main():
    """Test the universal extractor"""
    
    extractor = UniversalPatternExtractor()
    
    # Test with a sample email (could be any type)
    test_email = """
    Subject: Order Confirmation - PO 0505915850
    
    Dear Customer,
    
    Your order WQ1234567890 has been converted to purchase order 0505915850.
    
    Items:
    - XHU-00001 (Microsoft Surface Pro) - Quantity: 5
    - ZDW-00001 (Microsoft Office Suite) - Quantity: 10
    
    Special pricing agreement CAS-091284-B0C6Q4 has been applied.
    
    Ship to: 1234 Main St, SC 29615
    
    For support, contact sales4460@tdsynnex.com or reference ticket TS-2024-001.
    
    Thank you for your business!
    
    Order date: 12/08/2025
    Expected delivery: 12/15/2025
    
    Reference: CUST850 / CDW856
    Internal: GENERATED:57371
    """
    
    print("Universal Pattern Extraction Test")
    print("=" * 70)
    print("\nProcessing sample email...")
    
    result = extractor.extract_patterns(test_email)
    
    print("\n" + extractor.summarize_extraction(result))
    
    # Also test structured output
    print("\n" + "=" * 70)
    print("Structured Output:")
    structured = extractor.extract_from_email(test_email, "test_001")
    print(json.dumps(structured, indent=2))
    
    # Show pattern groupings
    print("\n" + "=" * 70)
    print("Pattern Groupings:")
    
    structure_groups = {}
    for pattern in result.patterns_found:
        if pattern.structure not in structure_groups:
            structure_groups[pattern.structure] = []
        structure_groups[pattern.structure].append(pattern.value)
    
    for structure, values in sorted(structure_groups.items()):
        print(f"\n{structure}:")
        for value in sorted(set(values)):
            print(f"  - {value}")


if __name__ == "__main__":
    main()