#!/usr/bin/env python3
"""
Generate Training Dataset from Claude's Analysis
Converts Claude's ground truth analyses into training examples for Phi-3.5-mini
"""

import json
import re
import random
from pathlib import Path
from typing import Dict, List, Tuple
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ClaudeToTrainingConverter:
    def __init__(self):
        self.claude_file = Path("/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md")
        self.email_batches_dir = Path("/home/pricepro2006/CrewAI_Team/email_batches")
        self.output_dir = Path("./datasets")
        self.output_dir.mkdir(exist_ok=True)
        
    def load_claude_analyses(self) -> Dict[int, str]:
        """Load and parse all Claude analyses"""
        logger.info("Loading Claude's analyses...")
        
        with open(self.claude_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract batch analyses
        pattern = r'## Batch (\d+) Analysis\n\n\[TextBlock\(citations=None, text=["\'](.+?)["\']\], type'
        matches = re.findall(pattern, content, re.DOTALL)
        
        analyses = {}
        for batch_num, analysis_text in matches:
            # Clean up the analysis text
            analysis = analysis_text.replace('\\n', '\n').replace('\\t', '\t')
            analysis = analysis.replace('\\"', '"').replace("\\'", "'")
            analyses[int(batch_num)] = analysis
            
        logger.info(f"Loaded {len(analyses)} analyses from Claude")
        return analyses
        
    def load_email_batch(self, batch_num: int) -> List[Dict]:
        """Load email batch data"""
        batch_file = self.email_batches_dir / f"emails_batch_{batch_num}.json"
        
        if not batch_file.exists():
            return None
            
        with open(batch_file, 'r') as f:
            return json.load(f)
            
    def create_training_example(self, batch_num: int, analysis: str) -> Dict:
        """Create a training example in Phi-3.5 format"""
        emails = self.load_email_batch(batch_num)
        
        if not emails:
            return None
            
        # Create email context summary
        email_context = self.create_email_context(emails, batch_num)
        
        # Create the instruction (what we want the model to do)
        instruction = f"""Analyze this batch of TD SYNNEX emails and provide a comprehensive business intelligence report.

Focus on:
1. Workflow State Identification (START, IN-PROGRESS, COMPLETION)
2. Entity Extraction (PO numbers, quotes, customers, amounts)
3. Action Items and Priority Assessment
4. Communication Patterns and Stakeholders
5. Business Risks and Opportunities
6. Strategic Recommendations

Email Batch #{batch_num} Context:
{email_context}"""
        
        # Format for Phi-3.5-mini chat template
        formatted_input = f"""<|user|>
{instruction}<|end|>
<|assistant|>"""
        
        # The expected output is Claude's analysis
        formatted_output = analysis
        
        return {
            "input": formatted_input,
            "output": formatted_output,
            "batch_number": batch_num,
            "email_count": len(emails)
        }
        
    def create_email_context(self, emails: List[Dict], batch_num: int) -> str:
        """Create a concise context from emails"""
        context_parts = []
        
        # Add batch summary
        context_parts.append(f"Total Emails: {len(emails)}")
        
        # Extract key information from first few emails
        for i, email in enumerate(emails[:5], 1):  # Limit to first 5 for context
            subject = email.get('subject', 'No subject')[:100]
            sender = email.get('from', 'Unknown')
            recipient = email.get('to', 'Unknown')
            
            # Extract key entities from body
            body = email.get('body', '')[:500]
            
            # Look for PO numbers
            po_matches = re.findall(r'PO[#\s]*(\d{6,10})', body)
            quote_matches = re.findall(r'Quote[#\s]*(\d{6,})', body)
            
            email_summary = f"""
Email {i}:
- From: {sender}
- To: {recipient}
- Subject: {subject}"""
            
            if po_matches:
                email_summary += f"\n- PO Numbers: {', '.join(po_matches[:3])}"
            if quote_matches:
                email_summary += f"\n- Quote Numbers: {', '.join(quote_matches[:3])}"
                
            context_parts.append(email_summary)
            
        # Add remaining count
        if len(emails) > 5:
            context_parts.append(f"\n[{len(emails) - 5} additional emails in batch...]")
            
        return "\n".join(context_parts)
        
    def generate_dataset(self, train_ratio: float = 0.8):
        """Generate complete training and validation datasets"""
        logger.info("Generating training dataset from Claude's analyses...")
        
        # Load all analyses
        analyses = self.load_claude_analyses()
        
        # Create training examples
        training_examples = []
        failed_batches = []
        
        for batch_num, analysis in analyses.items():
            example = self.create_training_example(batch_num, analysis)
            
            if example:
                training_examples.append(example)
            else:
                failed_batches.append(batch_num)
                
        logger.info(f"Created {len(training_examples)} training examples")
        if failed_batches:
            logger.warning(f"Failed to load email data for {len(failed_batches)} batches")
            
        # Shuffle and split
        random.shuffle(training_examples)
        split_point = int(len(training_examples) * train_ratio)
        
        train_data = training_examples[:split_point]
        val_data = training_examples[split_point:]
        
        # Save datasets
        train_file = self.output_dir / "claude_train.json"
        val_file = self.output_dir / "claude_val.json"
        
        with open(train_file, 'w', encoding='utf-8') as f:
            json.dump({
                "examples": train_data,
                "metadata": {
                    "total_examples": len(train_data),
                    "source": "Claude analysis",
                    "model": "Phi-3.5-mini target"
                }
            }, f, indent=2)
            
        with open(val_file, 'w', encoding='utf-8') as f:
            json.dump({
                "examples": val_data,
                "metadata": {
                    "total_examples": len(val_data),
                    "source": "Claude analysis",
                    "model": "Phi-3.5-mini target"
                }
            }, f, indent=2)
            
        logger.info(f"Saved {len(train_data)} training examples to {train_file}")
        logger.info(f"Saved {len(val_data)} validation examples to {val_file}")
        
        # Generate statistics
        self.generate_statistics(train_data, val_data)
        
        return train_data, val_data
        
    def generate_statistics(self, train_data: List[Dict], val_data: List[Dict]):
        """Generate dataset statistics"""
        stats = {
            "training": {
                "total_examples": len(train_data),
                "avg_input_length": sum(len(ex["input"]) for ex in train_data) / len(train_data) if train_data else 0,
                "avg_output_length": sum(len(ex["output"]) for ex in train_data) / len(train_data) if train_data else 0,
                "total_emails": sum(ex["email_count"] for ex in train_data)
            },
            "validation": {
                "total_examples": len(val_data),
                "avg_input_length": sum(len(ex["input"]) for ex in val_data) / len(val_data) if val_data else 0,
                "avg_output_length": sum(len(ex["output"]) for ex in val_data) / len(val_data) if val_data else 0,
                "total_emails": sum(ex["email_count"] for ex in val_data)
            }
        }
        
        stats_file = self.output_dir / "dataset_statistics.json"
        with open(stats_file, 'w') as f:
            json.dump(stats, f, indent=2)
            
        print("\n" + "="*60)
        print("DATASET STATISTICS")
        print("="*60)
        print(f"Training Examples: {stats['training']['total_examples']}")
        print(f"  Avg Input Length: {stats['training']['avg_input_length']:.0f} chars")
        print(f"  Avg Output Length: {stats['training']['avg_output_length']:.0f} chars")
        print(f"  Total Emails Covered: {stats['training']['total_emails']}")
        print(f"\nValidation Examples: {stats['validation']['total_examples']}")
        print(f"  Avg Input Length: {stats['validation']['avg_input_length']:.0f} chars")
        print(f"  Avg Output Length: {stats['validation']['avg_output_length']:.0f} chars")
        print(f"  Total Emails Covered: {stats['validation']['total_emails']}")
        print("="*60)

def main():
    converter = ClaudeToTrainingConverter()
    train_data, val_data = converter.generate_dataset(train_ratio=0.8)
    
    print(f"\n✅ Dataset generation complete!")
    print(f"Ready for fine-tuning with Phi-3.5-mini")
    print(f"\nNext step: Run the training script")
    print(f"Command: python3 train_phi3_adaptive.py")

if __name__ == "__main__":
    main()