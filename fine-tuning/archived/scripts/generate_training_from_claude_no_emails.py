#!/usr/bin/env python3
"""
Generate Training Dataset from Claude's Analysis (No Email Files Needed)
Converts Claude's ground truth analyses into training examples for Phi-3.5-mini
Works without requiring the original email batch JSON files
"""

import json
import re
import random
from pathlib import Path
from typing import Dict, List, Tuple
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ClaudeToTrainingConverterNoEmails:
    def __init__(self):
        self.claude_file = Path("/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md")
        self.output_dir = Path("./datasets")
        self.output_dir.mkdir(exist_ok=True)
        
    def load_claude_analyses(self) -> Dict[int, str]:
        """Load and parse all Claude analyses"""
        logger.info("Loading Claude's analyses...")
        
        with open(self.claude_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract batch analyses using regex that captures the analysis text
        analyses = {}
        
        # Split by batch headers
        batch_sections = re.split(r'## Batch (\d+) Analysis\n', content)
        
        # Process each batch (skip first element which is header)
        for i in range(1, len(batch_sections), 2):
            if i < len(batch_sections) - 1:
                batch_num = int(batch_sections[i])
                analysis_section = batch_sections[i + 1]
                
                # Extract the actual analysis text from TextBlock
                text_match = re.search(r'\[TextBlock\(citations=None, text=["\'](.+?)["\'], type=', 
                                     analysis_section, re.DOTALL)
                
                if text_match:
                    analysis_text = text_match.group(1)
                    # Clean up escaped characters
                    analysis = analysis_text.replace('\\n', '\n').replace('\\t', '\t')
                    analysis = analysis.replace('\\"', '"').replace("\\'", "'")
                    analyses[batch_num] = analysis
                    
        logger.info(f"Loaded {len(analyses)} analyses from Claude")
        return analyses
    
    def extract_context_from_analysis(self, analysis: str, batch_num: int) -> str:
        """Extract context information from the analysis itself"""
        context_parts = []
        
        # Extract email count if mentioned
        email_count_match = re.search(r'(\d+)\s+emails?', analysis, re.IGNORECASE)
        if email_count_match:
            context_parts.append(f"Total Emails: {email_count_match.group(1)}")
        else:
            context_parts.append(f"Email Batch #{batch_num}")
        
        # Extract key entities mentioned
        po_numbers = re.findall(r'PO[#\s]*(\d{6,10})', analysis)
        if po_numbers:
            context_parts.append(f"Contains PO Numbers: {', '.join(po_numbers[:3])}")
            
        quote_numbers = re.findall(r'Quote[#\s]*(\d{6,})', analysis)
        if quote_numbers:
            context_parts.append(f"Contains Quote Numbers: {', '.join(quote_numbers[:3])}")
            
        # Check for workflow indicators
        if 'START' in analysis.upper() or 'INITIAL' in analysis.upper():
            context_parts.append("Contains workflow initiations")
        if 'PROGRESS' in analysis.upper() or 'ONGOING' in analysis.upper():
            context_parts.append("Contains in-progress workflows")
        if 'COMPLET' in analysis.upper() or 'RESOLV' in analysis.upper():
            context_parts.append("Contains completed workflows")
            
        return "\n".join(context_parts) if context_parts else f"Email Batch #{batch_num}"
        
    def create_training_example(self, batch_num: int, analysis: str) -> Dict:
        """Create a training example in Phi-3.5 format without email files"""
        
        # Extract context from the analysis itself
        email_context = self.extract_context_from_analysis(analysis, batch_num)
        
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
        
        # Estimate email count from analysis
        email_count_match = re.search(r'(\d+)\s+emails?', analysis, re.IGNORECASE)
        email_count = int(email_count_match.group(1)) if email_count_match else 1
        
        return {
            "input": formatted_input,
            "output": formatted_output,
            "batch_number": batch_num,
            "email_count": email_count
        }
        
    def generate_dataset(self, train_ratio: float = 0.8):
        """Generate complete training and validation datasets"""
        logger.info("Generating training dataset from Claude's analyses...")
        
        # Load all analyses
        analyses = self.load_claude_analyses()
        
        if not analyses:
            logger.error("No analyses found in Claude's file!")
            return [], []
        
        # Create training examples
        training_examples = []
        
        for batch_num, analysis in analyses.items():
            example = self.create_training_example(batch_num, analysis)
            if example:
                training_examples.append(example)
                
        logger.info(f"Created {len(training_examples)} training examples")
        
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
                    "source": "Claude analysis (no email files)",
                    "model": "Phi-3.5-mini target"
                }
            }, f, indent=2)
            
        with open(val_file, 'w', encoding='utf-8') as f:
            json.dump({
                "examples": val_data,
                "metadata": {
                    "total_examples": len(val_data),
                    "source": "Claude analysis (no email files)",
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
    converter = ClaudeToTrainingConverterNoEmails()
    train_data, val_data = converter.generate_dataset(train_ratio=0.8)
    
    if train_data:
        print(f"\n✅ Dataset generation complete!")
        print(f"Ready for fine-tuning with Phi-3.5-mini")
        print(f"\nNext step: Run the training script")
        print(f"Command: python3 train_phi3_adaptive.py")
    else:
        print(f"\n❌ Failed to generate dataset")
        print(f"Check the Claude analysis file format")

if __name__ == "__main__":
    main()