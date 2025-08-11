#!/usr/bin/env python3
"""
Human Verification Interface for Pattern Classification
Interactive system for validating and classifying discovered patterns
"""

import json
import sqlite3
from pathlib import Path
from datetime import datetime
import random
from typing import Dict, List, Optional
import pickle

class PatternVerificationInterface:
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        self.output_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/human_verification')
        self.output_dir.mkdir(exist_ok=True)
        
        # Verification state
        self.state_file = self.output_dir / 'verification_state.pkl'
        self.verified_patterns_file = self.output_dir / 'verified_patterns.json'
        
        # Pattern categories for classification
        self.categories = {
            '1': 'quote',
            '2': 'purchase_order',
            '3': 'spa',
            '4': 'ticket',
            '5': 'sales_order',
            '6': 'project',
            '7': 'customer_id',
            '8': 'internal_ref',
            '9': 'tracking',
            '10': 'invoice',
            '11': 'product',
            '12': 'deal',
            '13': 'vendor',
            '14': 'system_id',
            '15': 'other',
            's': 'skip',
            'q': 'quit'
        }
        
        # Load state
        self.state = self.load_state()
        self.verified_patterns = self.load_verified_patterns()
    
    def load_state(self) -> Dict:
        """Load previous verification state"""
        if self.state_file.exists():
            with open(self.state_file, 'rb') as f:
                return pickle.load(f)
        return {
            'verified_count': 0,
            'skipped_count': 0,
            'session_count': 0,
            'last_pattern_index': 0
        }
    
    def save_state(self):
        """Save current state"""
        with open(self.state_file, 'wb') as f:
            pickle.dump(self.state, f)
    
    def load_verified_patterns(self) -> Dict:
        """Load previously verified patterns"""
        if self.verified_patterns_file.exists():
            with open(self.verified_patterns_file, 'r') as f:
                return json.load(f)
        return {
            'patterns': {},
            'rules': {},
            'statistics': {}
        }
    
    def save_verified_patterns(self):
        """Save verified patterns"""
        with open(self.verified_patterns_file, 'w') as f:
            json.dump(self.verified_patterns, f, indent=2)
    
    def load_unverified_patterns(self) -> List[Dict]:
        """Load patterns that need verification"""
        # Load from discovery results
        discovery_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/full_discovery')
        
        # Find latest discovery results
        data_files = list(discovery_dir.glob('final_data_*.json'))
        if not data_files:
            # Use comprehensive discovery results as fallback
            discovery_dir = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/comprehensive_patterns')
            data_files = list(discovery_dir.glob('comprehensive_data_*.json'))
        
        if not data_files:
            print("No discovery data found. Run pattern discovery first.")
            return []
        
        latest = sorted(data_files)[-1]
        with open(latest, 'r') as f:
            data = json.load(f)
        
        # Extract patterns needing verification
        unverified = []
        
        if 'examples' in data:  # Comprehensive format
            for pattern_type, examples in data['examples'].items():
                for example in examples:
                    if example['value'] not in self.verified_patterns.get('patterns', {}):
                        unverified.append({
                            'value': example['value'],
                            'type': pattern_type,
                            'context': example.get('surrounding', ''),
                            'email_id': example.get('email_id', '')
                        })
        
        return unverified
    
    def get_email_context(self, email_id: str) -> str:
        """Get full email context for a pattern"""
        if not email_id:
            return "No email context available"
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT subject, body_content FROM emails_enhanced WHERE id = ?",
            (email_id,)
        )
        result = cursor.fetchone()
        conn.close()
        
        if result:
            subject, body = result
            return f"Subject: {subject or 'N/A'}\n\nBody excerpt:\n{(body or '')[:500]}..."
        return "Email not found"
    
    def display_pattern_for_verification(self, pattern: Dict):
        """Display pattern with context for verification"""
        print("\n" + "="*70)
        print("PATTERN VERIFICATION")
        print("="*70)
        
        print(f"\nPattern Value: {pattern['value']}")
        print(f"Discovered Type: {pattern['type']}")
        print(f"\nContext: {pattern['context']}")
        
        if pattern.get('email_id'):
            print(f"\nFull Email Context:")
            print("-"*70)
            print(self.get_email_context(pattern['email_id']))
        
        print("\n" + "-"*70)
        print("CLASSIFY THIS PATTERN:")
        print("-"*70)
        
        for key, category in sorted(self.categories.items()):
            if key.isdigit():
                print(f"  [{key:>2}] {category.replace('_', ' ').title()}")
        
        print("\n  [s] Skip this pattern")
        print("  [q] Quit and save progress")
        print("-"*70)
    
    def get_user_classification(self) -> Optional[str]:
        """Get classification from user"""
        while True:
            choice = input("\nEnter classification: ").strip().lower()
            
            if choice in self.categories:
                return self.categories[choice]
            else:
                print("Invalid choice. Please try again.")
    
    def add_verification_rule(self, pattern: Dict, classification: str):
        """Add rule based on verification"""
        pattern_value = pattern['value']
        
        # Extract pattern prefix if applicable
        prefix = ''
        if '-' in pattern_value:
            prefix = pattern_value.split('-')[0]
        elif '#' in pattern_value:
            prefix = pattern_value.split('#')[0]
        elif '_' in pattern_value:
            parts = pattern_value.split('_')
            if len(parts) > 1 and parts[0].isupper():
                prefix = parts[0]
        
        # Store verification
        self.verified_patterns['patterns'][pattern_value] = {
            'classification': classification,
            'type': pattern['type'],
            'verified_at': datetime.now().isoformat(),
            'prefix': prefix
        }
        
        # Update rules
        if prefix and prefix not in self.verified_patterns.get('rules', {}):
            self.verified_patterns.setdefault('rules', {})[prefix] = classification
        
        # Update statistics
        stats = self.verified_patterns.setdefault('statistics', {})
        stats[classification] = stats.get(classification, 0) + 1
    
    def run_verification_session(self, max_patterns: int = 50):
        """Run an interactive verification session"""
        print("="*70)
        print("TD SYNNEX PATTERN VERIFICATION INTERFACE")
        print("="*70)
        print(f"Session started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Previously verified: {self.state['verified_count']} patterns")
        print()
        
        # Load unverified patterns
        unverified = self.load_unverified_patterns()
        
        if not unverified:
            print("No patterns to verify!")
            return
        
        print(f"Patterns needing verification: {len(unverified)}")
        print(f"This session will verify up to {max_patterns} patterns")
        print()
        
        # Shuffle for variety
        random.shuffle(unverified)
        
        session_verified = 0
        session_skipped = 0
        
        for i, pattern in enumerate(unverified[:max_patterns]):
            # Display pattern
            self.display_pattern_for_verification(pattern)
            
            # Get classification
            classification = self.get_user_classification()
            
            if classification == 'quit':
                print("\nSaving progress and exiting...")
                break
            elif classification == 'skip':
                session_skipped += 1
                self.state['skipped_count'] += 1
                print("Pattern skipped.")
            else:
                # Add verification
                self.add_verification_rule(pattern, classification)
                session_verified += 1
                self.state['verified_count'] += 1
                print(f"Pattern classified as: {classification}")
            
            # Progress update
            if (i + 1) % 10 == 0:
                print(f"\nProgress: {i + 1}/{max_patterns} patterns reviewed")
                print(f"Session stats: {session_verified} verified, {session_skipped} skipped")
        
        # Save state
        self.state['session_count'] += 1
        self.save_state()
        self.save_verified_patterns()
        
        # Session summary
        print("\n" + "="*70)
        print("SESSION SUMMARY")
        print("="*70)
        print(f"Patterns verified: {session_verified}")
        print(f"Patterns skipped: {session_skipped}")
        print(f"Total verified (all time): {self.state['verified_count']}")
        print()
        
        # Show classification distribution
        if self.verified_patterns.get('statistics'):
            print("Classification Distribution:")
            for category, count in sorted(
                self.verified_patterns['statistics'].items(),
                key=lambda x: x[1],
                reverse=True
            ):
                print(f"  {category}: {count}")
        
        print(f"\nVerification data saved to: {self.verified_patterns_file}")
    
    def generate_verification_report(self):
        """Generate report of verified patterns"""
        report_file = self.output_dir / f'verification_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
        
        with open(report_file, 'w') as f:
            f.write("="*70 + "\n")
            f.write("PATTERN VERIFICATION REPORT\n")
            f.write("="*70 + "\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total patterns verified: {self.state['verified_count']}\n")
            f.write(f"Total sessions: {self.state['session_count']}\n\n")
            
            # Classification summary
            f.write("CLASSIFICATION SUMMARY:\n")
            f.write("-"*70 + "\n")
            
            if self.verified_patterns.get('statistics'):
                for category, count in sorted(
                    self.verified_patterns['statistics'].items(),
                    key=lambda x: x[1],
                    reverse=True
                ):
                    f.write(f"{category:20} : {count:5} patterns\n")
            
            # Discovered rules
            f.write("\n" + "="*70 + "\n")
            f.write("DISCOVERED PREFIX RULES:\n")
            f.write("-"*70 + "\n")
            
            if self.verified_patterns.get('rules'):
                for prefix, classification in sorted(self.verified_patterns['rules'].items()):
                    f.write(f"{prefix:15} → {classification}\n")
            
            # Sample verified patterns
            f.write("\n" + "="*70 + "\n")
            f.write("SAMPLE VERIFIED PATTERNS:\n")
            f.write("-"*70 + "\n")
            
            if self.verified_patterns.get('patterns'):
                # Group by classification
                by_class = {}
                for pattern, info in self.verified_patterns['patterns'].items():
                    classification = info['classification']
                    by_class.setdefault(classification, []).append(pattern)
                
                for classification, patterns in sorted(by_class.items()):
                    f.write(f"\n{classification.upper()}:\n")
                    for pattern in patterns[:5]:  # Show first 5 of each
                        f.write(f"  • {pattern}\n")
        
        print(f"\nReport generated: {report_file}")

if __name__ == "__main__":
    interface = PatternVerificationInterface()
    
    # Run verification session
    interface.run_verification_session(max_patterns=30)
    
    # Generate report
    interface.generate_verification_report()