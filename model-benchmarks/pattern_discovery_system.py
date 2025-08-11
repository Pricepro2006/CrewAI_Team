#!/usr/bin/env python3
"""
TD SYNNEX Pattern Discovery System
Processes 143k emails to discover and learn entity extraction patterns
Includes human verification interface for pattern confirmation
"""

import os
import json
import sqlite3
import re
from datetime import datetime
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict, Counter
import hashlib
from pathlib import Path
import time

class PatternDiscoverySystem:
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        self.patterns_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/discovered_patterns')
        self.patterns_dir.mkdir(exist_ok=True)
        
        # Pattern storage files
        self.patterns_file = self.patterns_dir / 'entity_patterns.json'
        self.verified_file = self.patterns_dir / 'verified_patterns.json'
        self.context_file = self.patterns_dir / 'context_patterns.json'
        self.statistics_file = self.patterns_dir / 'pattern_statistics.json'
        
        # Load existing patterns if available
        self.entity_patterns = self.load_patterns(self.patterns_file)
        self.verified_patterns = self.load_patterns(self.verified_file)
        self.context_patterns = self.load_patterns(self.context_file)
        
        # Statistics tracking
        self.stats = {
            'total_emails': 0,
            'processed_emails': 0,
            'patterns_found': defaultdict(int),
            'entity_counts': defaultdict(int),
            'confidence_scores': defaultdict(list),
            'processing_time': 0,
            'last_processed_id': None
        }
        
        # Load existing stats
        if self.statistics_file.exists():
            with open(self.statistics_file, 'r') as f:
                saved_stats = json.load(f)
                self.stats.update(saved_stats)
                self.stats['patterns_found'] = defaultdict(int, self.stats['patterns_found'])
                self.stats['entity_counts'] = defaultdict(int, self.stats['entity_counts'])
                self.stats['confidence_scores'] = defaultdict(list, self.stats['confidence_scores'])
    
    def load_patterns(self, filepath: Path) -> Dict:
        """Load patterns from file or initialize empty"""
        if filepath.exists():
            with open(filepath, 'r') as f:
                return json.load(f)
        return self.initialize_patterns()
    
    def initialize_patterns(self) -> Dict:
        """Initialize pattern structure"""
        return {
            'quote_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'length_ranges': {'min': 99, 'max': 0},
                'examples': []
            },
            'po_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'length_ranges': {'min': 99, 'max': 0},
                'examples': []
            },
            'ticket_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'examples': []
            },
            'spa_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'examples': []
            },
            'bid_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'examples': []
            },
            'so_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'examples': []
            },
            'deal_patterns': {
                'prefixes': set(),
                'formats': [],
                'regex_patterns': [],
                'examples': []
            },
            'customer_patterns': {
                'common_domains': set(),
                'name_patterns': [],
                'examples': []
            }
        }
    
    def extract_potential_entities(self, text: str) -> Dict[str, List[Tuple[str, int, str]]]:
        """
        Extract ALL potential entities without filtering
        Returns: {entity_type: [(value, position, context)]}
        """
        entities = defaultdict(list)
        
        if not text:
            return entities
        
        # Clean text for processing
        text = text.replace('\n', ' ').replace('\r', ' ')
        
        # 1. Quote patterns (very flexible)
        quote_patterns = [
            # Standard formats
            (r'\b(?:WQ|wq)\s*[-#]?\s*(\d{8,12})\b', 'WQ'),
            (r'\b(?:FTQ|ftq)\s*[-#]?\s*(\d{6,10})\b', 'FTQ'),
            (r'\bQ-(\d{6,10}(?:-\d{1,3})?)\b', 'Q-'),
            # Variations observed
            (r'\bQuote\s*#?\s*(\d{8,12})\b', 'Quote'),
            (r'\bQUOTE\s*[:=]?\s*(\d{8,12})\b', 'QUOTE'),
            # Catch any Q followed by numbers
            (r'\b[Qq](\d{8,12})\b', 'Q'),
            # With special characters
            (r'(?:WQ|FTQ|Q)([0-9]{8,12})', 'Mixed'),
        ]
        
        for pattern, prefix in quote_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['quotes'].append((full_match, pos, context))
        
        # 2. PO patterns (very flexible)
        po_patterns = [
            # Standard formats
            (r'\bPO\s*#?\s*(\d{8,10})\b', 'PO'),
            (r'\bP\.O\.\s*#?\s*(\d{8,10})\b', 'P.O.'),
            # Just numbers that could be POs
            (r'\b(\d{9,10})\b(?=.*(?:order|purchase|PO))', 'Numeric'),
            # With specific prefixes
            (r'\b(?:505|681|708|370|361|362|368|369)(\d{6,7})\b', 'Prefix'),
            # Customer PO patterns
            (r'Customer\s*PO\s*#?\s*(\d{6,10})', 'CustomerPO'),
            # Vendor PO
            (r'Vendor\s*PO\s*#?\s*(\d{6,10})', 'VendorPO'),
        ]
        
        for pattern, prefix in po_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['pos'].append((full_match, pos, context))
        
        # 3. Ticket/Case patterns
        ticket_patterns = [
            (r'\b(?:TS|ts)-(\d{5,10})\b', 'TS'),
            (r'\b(?:TASK|task)(\d{5,10})\b', 'TASK'),
            (r'\b(?:CAS|cas)-(\d{5,10})(?:-[A-Z0-9]{5,10})?\b', 'CAS'),
            (r'\b(?:Ticket|TICKET)\s*#?\s*(\d{5,10})\b', 'Ticket'),
            (r'\b(?:Case|CASE)\s*#?\s*(\d{5,10})\b', 'Case'),
            (r'\b(?:SR|sr)-(\d{5,10})\b', 'SR'),
            (r'\b(?:INC|inc)(\d{5,10})\b', 'INC'),
        ]
        
        for pattern, prefix in ticket_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['tickets'].append((full_match, pos, context))
        
        # 4. SPA patterns
        spa_patterns = [
            (r'\bSPA\s*#?\s*(\d{6,10})\b', 'SPA'),
            (r'\bSPA\s*[:=]\s*([A-Z0-9_]+)\b', 'SPA_Code'),
            (r'US_COM_[A-Z]+_FY\d{2}Q\d_\d{4}', 'SPA_Full'),
        ]
        
        for pattern, prefix in spa_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['spas'].append((full_match, pos, context))
        
        # 5. SO patterns
        so_patterns = [
            (r'\bSO\s*#?\s*(\d{8,10})\b', 'SO'),
            (r'\bS\.O\.\s*#?\s*(\d{8,10})\b', 'S.O.'),
            (r'Sales\s*Order\s*#?\s*(\d{8,10})', 'SalesOrder'),
        ]
        
        for pattern, prefix in so_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['sos'].append((full_match, pos, context))
        
        # 6. Bid patterns
        bid_patterns = [
            (r'\bBID\s*#?\s*(\d{6,10})\b', 'BID'),
            (r'\bBid\s*#?\s*(\d{6,10})\b', 'Bid'),
        ]
        
        for pattern, prefix in bid_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['bids'].append((full_match, pos, context))
        
        # 7. Deal Registration patterns
        deal_patterns = [
            (r'\bDR(\d{6,10})\b', 'DR'),
            (r'Deal\s*Reg\s*#?\s*(\d{6,10})', 'DealReg'),
            (r'Deal\s*#?\s*(\d{6,10})', 'Deal'),
        ]
        
        for pattern, prefix in deal_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                full_match = match.group(0)
                entities['deals'].append((full_match, pos, context))
        
        # 8. Any alphanumeric identifiers that might be important
        # This catches things we might have missed
        identifier_pattern = r'\b([A-Z]{2,5}[-#]?\d{6,12})\b'
        for match in re.finditer(identifier_pattern, text):
            identifier = match.group(1)
            # Skip if already captured
            already_captured = False
            for entity_list in entities.values():
                if any(identifier in item[0] for item in entity_list):
                    already_captured = True
                    break
            
            if not already_captured:
                pos = match.start()
                context = text[max(0, pos-30):min(len(text), pos+50)]
                entities['unknown_identifiers'].append((identifier, pos, context))
        
        return entities
    
    def analyze_pattern_structure(self, values: List[str], entity_type: str) -> Dict:
        """Analyze the structure of entity values to learn patterns"""
        analysis = {
            'prefixes': Counter(),
            'lengths': Counter(),
            'has_letters': 0,
            'has_numbers': 0,
            'has_special': 0,
            'common_formats': Counter(),
            'position_patterns': defaultdict(Counter)
        }
        
        for value in values:
            # Length
            analysis['lengths'][len(value)] += 1
            
            # Character composition
            if re.search(r'[A-Za-z]', value):
                analysis['has_letters'] += 1
            if re.search(r'\d', value):
                analysis['has_numbers'] += 1
            if re.search(r'[-#_/]', value):
                analysis['has_special'] += 1
            
            # Extract prefix
            prefix_match = re.match(r'^([A-Z]+)', value, re.IGNORECASE)
            if prefix_match:
                analysis['prefixes'][prefix_match.group(1).upper()] += 1
            
            # Format pattern (replace numbers with N, letters with L)
            format_pattern = re.sub(r'\d', 'N', value)
            format_pattern = re.sub(r'[A-Za-z]', 'L', format_pattern)
            analysis['common_formats'][format_pattern] += 1
            
            # Position-based patterns
            for i, char in enumerate(value[:10]):  # First 10 positions
                if char.isalpha():
                    analysis['position_patterns'][i]['letter'] += 1
                elif char.isdigit():
                    analysis['position_patterns'][i]['digit'] += 1
                else:
                    analysis['position_patterns'][i]['special'] += 1
        
        return analysis
    
    def process_batch(self, start_id: Optional[str] = None, batch_size: int = 1000) -> Tuple[int, Dict]:
        """Process a batch of emails"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Build query
        if start_id:
            query = """
            SELECT id, subject, body_content 
            FROM emails_enhanced 
            WHERE id > ?
            ORDER BY id
            LIMIT ?
            """
            params = (start_id, batch_size)
        else:
            query = """
            SELECT id, subject, body_content 
            FROM emails_enhanced 
            ORDER BY id
            LIMIT ?
            """
            params = (batch_size,)
        
        cursor.execute(query, params)
        emails = cursor.fetchall()
        
        batch_entities = defaultdict(list)
        last_id = None
        
        for email_id, subject, body in emails:
            last_id = email_id
            
            # Combine subject and body
            full_text = f"{subject or ''} {body or ''}"
            
            # Extract entities
            entities = self.extract_potential_entities(full_text)
            
            # Store unique values
            for entity_type, entity_list in entities.items():
                for value, pos, context in entity_list:
                    batch_entities[entity_type].append({
                        'value': value,
                        'email_id': email_id,
                        'position': pos,
                        'context': context
                    })
        
        conn.close()
        return len(emails), batch_entities, last_id
    
    def update_patterns(self, batch_entities: Dict):
        """Update pattern database with new discoveries"""
        for entity_type, entities in batch_entities.items():
            if not entities:
                continue
            
            # Get unique values
            values = list(set(e['value'] for e in entities))
            
            # Analyze patterns
            analysis = self.analyze_pattern_structure(values, entity_type)
            
            # Update pattern database
            if entity_type == 'quotes':
                pattern_db = self.entity_patterns['quote_patterns']
            elif entity_type == 'pos':
                pattern_db = self.entity_patterns['po_patterns']
            elif entity_type == 'tickets':
                pattern_db = self.entity_patterns['ticket_patterns']
            elif entity_type == 'spas':
                pattern_db = self.entity_patterns['spa_patterns']
            elif entity_type == 'bids':
                pattern_db = self.entity_patterns['bid_patterns']
            elif entity_type == 'sos':
                pattern_db = self.entity_patterns['so_patterns']
            elif entity_type == 'deals':
                pattern_db = self.entity_patterns['deal_patterns']
            else:
                continue
            
            # Update prefixes
            if 'prefixes' not in pattern_db:
                pattern_db['prefixes'] = set()
            else:
                pattern_db['prefixes'] = set(pattern_db['prefixes'])
            
            for prefix, count in analysis['prefixes'].most_common(10):
                if count > 2:  # Seen at least 3 times
                    pattern_db['prefixes'].add(prefix)
            
            # Update examples (keep top 100)
            if 'examples' not in pattern_db:
                pattern_db['examples'] = []
            
            for entity in entities[:10]:  # Add up to 10 new examples
                example = {
                    'value': entity['value'],
                    'email_id': entity['email_id'],
                    'context': entity['context']
                }
                if example not in pattern_db['examples']:
                    pattern_db['examples'].append(example)
            
            # Keep only most recent 100 examples
            pattern_db['examples'] = pattern_db['examples'][-100:]
            
            # Update length ranges
            if 'length_ranges' not in pattern_db:
                pattern_db['length_ranges'] = {'min': 99, 'max': 0}
            
            for length, count in analysis['lengths'].items():
                pattern_db['length_ranges']['min'] = min(pattern_db['length_ranges']['min'], length)
                pattern_db['length_ranges']['max'] = max(pattern_db['length_ranges']['max'], length)
            
            # Update format patterns
            if 'formats' not in pattern_db:
                pattern_db['formats'] = []
            
            for format_pattern, count in analysis['common_formats'].most_common(20):
                if count > 5 and format_pattern not in pattern_db['formats']:
                    pattern_db['formats'].append(format_pattern)
            
            # Convert sets back to lists for JSON serialization
            pattern_db['prefixes'] = list(pattern_db['prefixes'])
            
            # Update statistics
            self.stats['entity_counts'][entity_type] += len(entities)
            self.stats['patterns_found'][entity_type] = len(pattern_db.get('formats', []))
    
    def save_patterns(self):
        """Save all patterns to files"""
        # Save entity patterns
        with open(self.patterns_file, 'w') as f:
            json.dump(self.entity_patterns, f, indent=2)
        
        # Save statistics
        stats_to_save = dict(self.stats)
        stats_to_save['patterns_found'] = dict(stats_to_save['patterns_found'])
        stats_to_save['entity_counts'] = dict(stats_to_save['entity_counts'])
        stats_to_save['confidence_scores'] = dict(stats_to_save['confidence_scores'])
        
        with open(self.statistics_file, 'w') as f:
            json.dump(stats_to_save, f, indent=2)
    
    def generate_pattern_report(self) -> str:
        """Generate a human-readable report of discovered patterns"""
        report = []
        report.append("="*70)
        report.append("TD SYNNEX ENTITY PATTERN DISCOVERY REPORT")
        report.append("="*70)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Emails Processed: {self.stats['processed_emails']:,}")
        report.append("")
        
        for entity_type in ['quote_patterns', 'po_patterns', 'ticket_patterns', 
                           'spa_patterns', 'bid_patterns', 'so_patterns', 'deal_patterns']:
            
            pattern_db = self.entity_patterns.get(entity_type, {})
            if not pattern_db:
                continue
            
            report.append("-"*70)
            report.append(f"{entity_type.replace('_patterns', '').upper()} PATTERNS")
            report.append("-"*70)
            
            # Prefixes
            prefixes = pattern_db.get('prefixes', [])
            if prefixes:
                report.append(f"Common Prefixes: {', '.join(sorted(prefixes[:10]))}")
            
            # Length ranges
            length_range = pattern_db.get('length_ranges', {})
            if length_range.get('min', 99) < 99:
                report.append(f"Length Range: {length_range['min']}-{length_range['max']} characters")
            
            # Format patterns
            formats = pattern_db.get('formats', [])
            if formats:
                report.append(f"Common Formats ({len(formats)} discovered):")
                for fmt in formats[:5]:
                    report.append(f"  - {fmt}")
            
            # Examples
            examples = pattern_db.get('examples', [])
            if examples:
                report.append(f"Recent Examples ({len(examples)} stored):")
                for ex in examples[-5:]:
                    report.append(f"  - {ex['value']} (from email {ex['email_id'][:20]}...)")
            
            # Statistics
            entity_key = entity_type.replace('_patterns', 's')
            count = self.stats['entity_counts'].get(entity_key, 0)
            if count:
                report.append(f"Total Found: {count:,}")
            
            report.append("")
        
        return "\n".join(report)
    
    def run_discovery(self, target_emails: int = 143000, batch_size: int = 1000):
        """Run the pattern discovery process"""
        print("="*70)
        print("STARTING TD SYNNEX PATTERN DISCOVERY")
        print("="*70)
        print(f"Target: {target_emails:,} emails")
        print(f"Batch Size: {batch_size:,}")
        print(f"Starting from: {self.stats.get('last_processed_id', 'beginning')}")
        print("="*70)
        
        start_time = time.time()
        total_processed = self.stats.get('processed_emails', 0)
        last_id = self.stats.get('last_processed_id')
        
        try:
            while total_processed < target_emails:
                # Process batch
                batch_count, batch_entities, new_last_id = self.process_batch(
                    start_id=last_id,
                    batch_size=batch_size
                )
                
                if batch_count == 0:
                    print("\nNo more emails to process")
                    break
                
                # Update patterns
                self.update_patterns(batch_entities)
                
                # Update statistics
                total_processed += batch_count
                self.stats['processed_emails'] = total_processed
                self.stats['last_processed_id'] = new_last_id
                last_id = new_last_id
                
                # Save progress every 10 batches
                if (total_processed // batch_size) % 10 == 0:
                    self.save_patterns()
                    elapsed = time.time() - start_time
                    rate = total_processed / elapsed if elapsed > 0 else 0
                    
                    print(f"\nProgress: {total_processed:,}/{target_emails:,} emails")
                    print(f"Rate: {rate:.1f} emails/sec")
                    print(f"Patterns discovered:")
                    for entity_type, count in self.stats['patterns_found'].items():
                        print(f"  {entity_type}: {count} patterns")
                
                # Show progress indicator
                if total_processed % 100 == 0:
                    print(".", end="", flush=True)
        
        except KeyboardInterrupt:
            print("\n\nProcess interrupted by user")
        except Exception as e:
            print(f"\n\nError occurred: {str(e)}")
        finally:
            # Save final state
            self.stats['processing_time'] += time.time() - start_time
            self.save_patterns()
            
            # Generate and save report
            report = self.generate_pattern_report()
            report_file = self.patterns_dir / f"discovery_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            with open(report_file, 'w') as f:
                f.write(report)
            
            print("\n" + "="*70)
            print("PATTERN DISCOVERY COMPLETE")
            print("="*70)
            print(f"Total Processed: {self.stats['processed_emails']:,} emails")
            print(f"Total Time: {self.stats['processing_time']:.1f} seconds")
            print(f"Patterns File: {self.patterns_file}")
            print(f"Report File: {report_file}")
            print("\n" + report)

class HumanVerificationInterface:
    """Interface for human verification of discovered patterns"""
    
    def __init__(self, patterns_dir: Path):
        self.patterns_dir = patterns_dir
        self.patterns_file = patterns_dir / 'entity_patterns.json'
        self.verified_file = patterns_dir / 'verified_patterns.json'
        self.verification_log = patterns_dir / 'verification_log.json'
        
        # Load patterns
        with open(self.patterns_file, 'r') as f:
            self.patterns = json.load(f)
        
        # Load or initialize verified patterns
        if self.verified_file.exists():
            with open(self.verified_file, 'r') as f:
                self.verified = json.load(f)
        else:
            self.verified = {}
        
        # Load or initialize verification log
        if self.verification_log.exists():
            with open(self.verification_log, 'r') as f:
                self.log = json.load(f)
        else:
            self.log = []
    
    def verify_examples(self, entity_type: str, num_examples: int = 10):
        """Present examples for human verification"""
        pattern_key = f"{entity_type}_patterns"
        if pattern_key not in self.patterns:
            print(f"No patterns found for {entity_type}")
            return
        
        examples = self.patterns[pattern_key].get('examples', [])
        if not examples:
            print(f"No examples found for {entity_type}")
            return
        
        print(f"\n{'='*70}")
        print(f"VERIFYING {entity_type.upper()} PATTERNS")
        print(f"{'='*70}")
        print(f"Found {len(examples)} examples. Showing up to {num_examples} for verification.")
        print("For each example, indicate if it's correct (y/n/s to skip):\n")
        
        verified_count = 0
        for i, example in enumerate(examples[:num_examples], 1):
            print(f"\nExample {i}/{min(num_examples, len(examples))}:")
            print(f"Value: {example['value']}")
            print(f"Context: ...{example['context']}...")
            
            while True:
                response = input("Is this correct? (y/n/s/q to quit): ").lower()
                if response in ['y', 'n', 's', 'q']:
                    break
                print("Please enter y (yes), n (no), s (skip), or q (quit)")
            
            if response == 'q':
                break
            elif response == 'y':
                verified_count += 1
                self.log_verification(entity_type, example['value'], True, example['context'])
            elif response == 'n':
                self.log_verification(entity_type, example['value'], False, example['context'])
                # Ask for correction
                correction = input("What should it be? (or press Enter to skip): ")
                if correction:
                    self.log_correction(entity_type, example['value'], correction, example['context'])
        
        print(f"\nVerified {verified_count} out of {i} examples")
        self.save_verification()
    
    def log_verification(self, entity_type: str, value: str, is_correct: bool, context: str):
        """Log a verification decision"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'entity_type': entity_type,
            'value': value,
            'is_correct': is_correct,
            'context': context
        }
        self.log.append(entry)
    
    def log_correction(self, entity_type: str, incorrect_value: str, correct_value: str, context: str):
        """Log a correction"""
        entry = {
            'timestamp': datetime.now().isoformat(),
            'entity_type': entity_type,
            'incorrect_value': incorrect_value,
            'correct_value': correct_value,
            'context': context,
            'is_correction': True
        }
        self.log.append(entry)
    
    def save_verification(self):
        """Save verification results"""
        with open(self.verification_log, 'w') as f:
            json.dump(self.log, f, indent=2)
        print(f"Verification log saved to {self.verification_log}")
    
    def generate_verified_patterns(self):
        """Generate verified pattern rules from human feedback"""
        verified_patterns = {}
        
        # Analyze verification log
        for entry in self.log:
            if entry.get('is_correct', False):
                entity_type = entry['entity_type']
                value = entry['value']
                
                if entity_type not in verified_patterns:
                    verified_patterns[entity_type] = {
                        'verified_examples': [],
                        'verified_prefixes': set(),
                        'verified_formats': set()
                    }
                
                verified_patterns[entity_type]['verified_examples'].append(value)
                
                # Extract prefix
                prefix_match = re.match(r'^([A-Z]+)', value, re.IGNORECASE)
                if prefix_match:
                    verified_patterns[entity_type]['verified_prefixes'].add(prefix_match.group(1).upper())
                
                # Extract format
                format_pattern = re.sub(r'\d', 'N', value)
                format_pattern = re.sub(r'[A-Za-z]', 'L', format_pattern)
                verified_patterns[entity_type]['verified_formats'].add(format_pattern)
        
        # Convert sets to lists for JSON
        for entity_type in verified_patterns:
            verified_patterns[entity_type]['verified_prefixes'] = list(
                verified_patterns[entity_type]['verified_prefixes']
            )
            verified_patterns[entity_type]['verified_formats'] = list(
                verified_patterns[entity_type]['verified_formats']
            )
        
        # Save verified patterns
        with open(self.verified_file, 'w') as f:
            json.dump(verified_patterns, f, indent=2)
        
        print(f"Verified patterns saved to {self.verified_file}")
        return verified_patterns

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        # Human verification mode
        patterns_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/discovered_patterns')
        verifier = HumanVerificationInterface(patterns_dir)
        
        print("HUMAN VERIFICATION MODE")
        print("="*70)
        print("Available entity types:")
        print("1. quotes")
        print("2. pos")
        print("3. tickets")
        print("4. spas")
        print("5. bids")
        print("6. sos")
        print("7. deals")
        
        entity_type = input("\nWhich entity type to verify? ")
        num_examples = input("How many examples to verify? (default 10): ")
        
        try:
            num_examples = int(num_examples) if num_examples else 10
        except:
            num_examples = 10
        
        verifier.verify_examples(entity_type, num_examples)
        verifier.generate_verified_patterns()
    
    else:
        # Pattern discovery mode
        discovery = PatternDiscoverySystem()
        
        # Check if we should resume or start fresh
        if discovery.stats['processed_emails'] > 0:
            print(f"Found existing progress: {discovery.stats['processed_emails']:,} emails processed")
            resume = input("Resume from last position? (y/n): ").lower()
            if resume != 'y':
                # Reset statistics
                discovery.stats = {
                    'total_emails': 0,
                    'processed_emails': 0,
                    'patterns_found': defaultdict(int),
                    'entity_counts': defaultdict(int),
                    'confidence_scores': defaultdict(list),
                    'processing_time': 0,
                    'last_processed_id': None
                }
        
        # Run discovery
        discovery.run_discovery(target_emails=143000, batch_size=1000)