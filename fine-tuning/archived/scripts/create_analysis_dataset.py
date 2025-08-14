#!/usr/bin/env python3
"""
Create Business Intelligence Training Dataset
Pairs original email JSON content with high-quality analysis results.

Uses specific batch numbers referenced in claude_final_analysis_20250601_083919.md
to create training examples that bridge raw emails to structured BI output.
"""

import json
import re
import os
from pathlib import Path
from typing import Dict, List, Any
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AnalysisDatasetCreator:
    def __init__(self):
        self.analysis_file = "/home/pricepro2006/iems_project/claude_final_analysis_20250601_083919.md"
        self.email_batches_dir = "/home/pricepro2006/iems_project/db_backups/email_batches"
        self.output_file = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
        
        # Create output directory
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
        
        self.batch_analyses = {}
        self.successful_pairs = 0
        self.failed_pairs = 0

    def extract_batch_analyses(self) -> Dict[int, str]:
        """Extract analysis content for each batch from the analysis file, filtering out errors."""
        logger.info("Extracting batch analyses from reference file...")
        
        with open(self.analysis_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Split by batch sections
        batch_pattern = r'## Batch (\d+) Analysis\s*\n(.*?)(?=## Batch \d+ Analysis|\Z)'
        matches = re.findall(batch_pattern, content, re.DOTALL)
        
        batch_analyses = {}
        error_batches = 0
        
        for match in matches:
            batch_num = int(match[0])
            analysis_content = match[1].strip()
            
            # Check if this is an error batch
            error_indicators = [
                "Error processing with Claude",
                "Error code:",
                "overloaded_error",
                "rate_limit_error",
                "timeout_error",
                "connection_error"
            ]
            
            is_error = any(indicator in analysis_content for indicator in error_indicators)
            
            if is_error:
                error_batches += 1
                logger.debug(f"Skipping error batch {batch_num}")
                continue
            
            # Clean up the analysis content
            # Remove TextBlock wrappers and format properly
            analysis_content = re.sub(r'\[TextBlock\(citations=None, text=\'(.*?)\', type=\'text\'\)\]', r'\1', analysis_content, flags=re.DOTALL)
            analysis_content = re.sub(r'\[TextBlock\(citations=None, text="(.*?)", type=\'text\'\)\]', r'\1', analysis_content, flags=re.DOTALL)
            
            # Ensure substantial analysis content (not just error messages)
            if analysis_content and len(analysis_content) > 200:  # Increased threshold
                # Additional check for actual analysis content
                analysis_indicators = [
                    "WORKFLOW STATE",
                    "ENTITY EXTRACTION", 
                    "BUSINESS PROCESS",
                    "COMMUNICATION PATTERN",
                    "PRIORITY",
                    "ACTION ITEM",
                    "STRATEGIC INSIGHTS",
                    "WORKFLOW ANALYSIS"
                ]
                
                has_analysis_content = any(indicator in analysis_content for indicator in analysis_indicators)
                
                if has_analysis_content:
                    batch_analyses[batch_num] = analysis_content
                else:
                    error_batches += 1
                    logger.debug(f"Skipping batch {batch_num} - no substantial analysis content")
        
        logger.info(f"Extracted {len(batch_analyses)} valid batch analyses")
        logger.info(f"Skipped {error_batches} error/incomplete batches")
        return batch_analyses

    def load_email_batch(self, batch_num: int) -> List[Dict[str, Any]]:
        """Load emails from a specific batch file."""
        batch_file = f"{self.email_batches_dir}/emails_batch_{batch_num}.json"
        
        if not os.path.exists(batch_file):
            return None
            
        try:
            with open(batch_file, 'r', encoding='utf-8') as f:
                emails = json.load(f)
            return emails
        except Exception as e:
            logger.warning(f"Failed to load batch {batch_num}: {str(e)}")
            return None

    def format_email_content(self, emails: List[Dict[str, Any]]) -> str:
        """Format email batch into structured input text."""
        formatted_emails = []
        
        for i, email in enumerate(emails, 1):
            email_text = f"EMAIL {i}:\n"
            email_text += f"Subject: {email.get('Subject', 'N/A')}\n"
            email_text += f"From: {email.get('SenderEmail', 'N/A')}\n"
            email_text += f"To: {email.get('RecipientEmails', 'N/A')}\n"
            email_text += f"Date: {email.get('ReceivedTime', 'N/A')}\n"
            email_text += f"Body: {email.get('BodyText', '')[:1000]}{'...' if len(email.get('BodyText', '')) > 1000 else ''}\n"
            
            # Add workflow state if available
            if email.get('workflow_state'):
                email_text += f"Current Workflow State: {email.get('workflow_state')}\n"
            
            email_text += "\n" + "="*50 + "\n"
            formatted_emails.append(email_text)
        
        return "\n".join(formatted_emails)

    def create_training_example(self, batch_num: int, emails: List[Dict[str, Any]], analysis: str) -> Dict[str, Any]:
        """Create a single training example in the correct format."""
        
        # Format the input (original emails)
        input_text = f"# Email Batch Analysis Request\n\n"
        input_text += f"Please analyze the following batch of {len(emails)} emails for business intelligence insights:\n\n"
        input_text += self.format_email_content(emails)
        
        # Clean and format the analysis output
        analysis_text = analysis.replace('\\n', '\n').replace('\\"', '"').replace("\\'", "'")
        
        # Create the training example
        training_example = {
            "messages": [
                {
                    "role": "user",
                    "content": input_text
                },
                {
                    "role": "assistant", 
                    "content": analysis_text
                }
            ],
            "metadata": {
                "batch_number": batch_num,
                "email_count": len(emails),
                "analysis_source": "claude_final_analysis_20250601_083919.md",
                "data_type": "business_intelligence_extraction",
                "quality_tier": "gold"
            }
        }
        
        return training_example

    def create_dataset(self, max_examples: int = 100):
        """Create the complete training dataset using exact batch numbers from analysis."""
        logger.info(f"Creating training dataset with up to {max_examples} examples...")
        
        # Extract all batch analyses
        batch_analyses = self.extract_batch_analyses()
        logger.info(f"Found analyses for {len(batch_analyses)} batches")
        
        # Sort batch numbers to process in order
        batch_numbers = sorted(batch_analyses.keys())
        
        training_examples = []
        examples_created = 0
        
        # Process ALL available batches that have both analysis and email files
        for batch_num in batch_numbers:
            if examples_created >= max_examples:
                break
                
            if examples_created % 10 == 0:
                logger.info(f"Processing batch {batch_num} ({examples_created+1}/{max_examples})")
            
            # Check if email batch file exists
            batch_file = f"{self.email_batches_dir}/emails_batch_{batch_num}.json"
            if not os.path.exists(batch_file):
                self.failed_pairs += 1
                logger.debug(f"Email file missing for batch {batch_num}")
                continue
            
            # Load corresponding email batch
            emails = self.load_email_batch(batch_num)
            
            if emails is None:
                self.failed_pairs += 1
                logger.warning(f"Could not load emails for batch {batch_num}")
                continue
            
            if not emails or len(emails) == 0:
                self.failed_pairs += 1
                logger.warning(f"Batch {batch_num} contains no emails")
                continue
            
            # Get analysis for this batch
            analysis = batch_analyses[batch_num]
            
            # Create training example
            training_example = self.create_training_example(batch_num, emails, analysis)
            training_examples.append(training_example)
            self.successful_pairs += 1
            examples_created += 1
        
        # Save training dataset
        logger.info(f"Saving {len(training_examples)} training examples to {self.output_file}")
        
        with open(self.output_file, 'w', encoding='utf-8') as f:
            for example in training_examples:
                f.write(json.dumps(example, ensure_ascii=False) + '\n')
        
        # Print statistics
        logger.info(f"Dataset creation complete:")
        logger.info(f"  Successful pairs: {self.successful_pairs}")
        logger.info(f"  Failed pairs: {self.failed_pairs}")
        logger.info(f"  Total examples: {len(training_examples)}")
        logger.info(f"  Output file: {self.output_file}")
        
        return self.output_file

def main():
    creator = AnalysisDatasetCreator()
    
    # Create robust dataset based on research: 10K-15K examples for optimal results
    # Using 12,000 examples as optimal for business intelligence domain
    output_file = creator.create_dataset(max_examples=12000)
    
    print(f"\n✅ Business Intelligence training dataset created successfully!")
    print(f"📁 File: {output_file}")
    print(f"📊 Examples: {creator.successful_pairs}")
    print(f"❌ Failed: {creator.failed_pairs}")
    
    # Show sample of first training example
    if creator.successful_pairs > 0:
        print(f"\n📋 Sample training example structure:")
        with open(output_file, 'r', encoding='utf-8') as f:
            first_example = json.loads(f.readline())
            print(f"   Input length: {len(first_example['messages'][0]['content'])} chars")
            print(f"   Output length: {len(first_example['messages'][1]['content'])} chars") 
            print(f"   Batch number: {first_example['metadata']['batch_number']}")
            print(f"   Email count: {first_example['metadata']['email_count']}")

if __name__ == "__main__":
    main()