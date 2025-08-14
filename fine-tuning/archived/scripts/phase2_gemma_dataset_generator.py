#!/usr/bin/env python3
"""
Phase 2: Gemma-Optimized Dataset Generator
Converts existing adaptive datasets to Gemma 2B-IT format
"""

import json
import random
import logging
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GemmaDatasetConverter:
    """Convert existing datasets to Gemma format"""
    
    GEMMA_USER_START = "<start_of_turn>user"
    GEMMA_USER_END = "<end_of_turn>"
    GEMMA_MODEL_START = "<start_of_turn>model"
    GEMMA_MODEL_END = "<end_of_turn>"
    
    def __init__(self, 
                 input_dir: str = "./datasets",
                 output_dir: str = "./datasets/gemma_formatted"):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load Claude analysis for ground truth
        self.claude_analysis = self._load_claude_analysis()
        
    def _load_claude_analysis(self) -> Dict:
        """Load Claude's comprehensive analysis"""
        claude_path = Path("/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md")
        
        if not claude_path.exists():
            logger.warning(f"Claude analysis not found at {claude_path}")
            return {}
        
        with open(claude_path, 'r') as f:
            content = f.read()
        
        # Parse into sections by email batch
        analysis = {}
        current_batch = None
        current_content = []
        
        for line in content.split('\n'):
            if 'Email Batch' in line or 'Batch' in line:
                if current_batch and current_content:
                    analysis[current_batch] = '\n'.join(current_content)
                # Extract batch number
                try:
                    import re
                    batch_match = re.search(r'(\d+)', line)
                    if batch_match:
                        current_batch = batch_match.group(1)
                        current_content = [line]
                except:
                    pass
            elif current_batch:
                current_content.append(line)
        
        # Save last batch
        if current_batch and current_content:
            analysis[current_batch] = '\n'.join(current_content)
        
        logger.info(f"Loaded Claude analysis for {len(analysis)} batches")
        return analysis
    
    def convert_to_gemma_format(self, example: Dict) -> Dict:
        """Convert a single example to Gemma chat format"""
        
        instruction = example.get('instruction', '')
        input_text = example.get('input', '')
        output = example.get('output', '')
        
        # Create Gemma-formatted instruction
        if "email batch" in instruction.lower():
            # Extract batch number for better context
            import re
            batch_match = re.search(r'batch[^\d]*(\d+)', instruction.lower())
            if batch_match:
                batch_num = batch_match.group(1)
                
                # Enhance instruction with specific guidance
                enhanced_instruction = (
                    f"Analyze email batch {batch_num} and provide comprehensive insights.\n"
                    f"Focus on:\n"
                    f"1. Key business patterns and workflows\n"
                    f"2. Action items and decisions\n"
                    f"3. Strategic implications\n"
                    f"4. Stakeholder relationships\n"
                    f"5. Timeline and urgency indicators"
                )
                
                if input_text:
                    enhanced_instruction += f"\n\nEmail Content:\n{input_text[:1500]}"  # Limit context
            else:
                enhanced_instruction = instruction
                if input_text:
                    enhanced_instruction += f"\n\nContext:\n{input_text[:1500]}"
        else:
            enhanced_instruction = instruction
            if input_text:
                enhanced_instruction += f"\n\nInput:\n{input_text}"
        
        # Format with Gemma template
        gemma_formatted = {
            'text': (
                f"{self.GEMMA_USER_START}\n"
                f"{enhanced_instruction}\n"
                f"{self.GEMMA_USER_END}\n"
                f"{self.GEMMA_MODEL_START}\n"
                f"{output}\n"
                f"{self.GEMMA_MODEL_END}"
            ),
            'instruction': enhanced_instruction,
            'output': output,
            'metadata': example.get('metadata', {})
        }
        
        # Add unique ID
        text_hash = hashlib.md5(gemma_formatted['text'].encode()).hexdigest()[:8]
        gemma_formatted['id'] = f"gemma_{text_hash}"
        
        return gemma_formatted
    
    def optimize_for_cpu_training(self, examples: List[Dict], target_tokens: int = 1800) -> List[Dict]:
        """Optimize examples for CPU training efficiency"""
        
        optimized = []
        
        for example in examples:
            text = example.get('text', '')
            
            # Rough token estimation (1 token ≈ 4 chars for English)
            estimated_tokens = len(text) // 4
            
            if estimated_tokens > target_tokens:
                # Truncate intelligently
                lines = text.split('\n')
                truncated = []
                char_count = 0
                
                for line in lines:
                    if char_count + len(line) < target_tokens * 4:
                        truncated.append(line)
                        char_count += len(line)
                    else:
                        truncated.append("... [Content truncated for training efficiency]")
                        break
                
                example['text'] = '\n'.join(truncated)
                example['metadata']['truncated'] = True
                example['metadata']['original_tokens'] = estimated_tokens
            
            example['metadata']['estimated_tokens'] = min(estimated_tokens, target_tokens)
            optimized.append(example)
        
        return optimized
    
    def convert_dataset(self, split: str = "train"):
        """Convert entire dataset to Gemma format"""
        
        input_file = self.input_dir / f"adaptive_{split}.json"
        
        if not input_file.exists():
            logger.error(f"Input file not found: {input_file}")
            return
        
        # Load existing dataset
        with open(input_file, 'r') as f:
            data = json.load(f)
        
        # Extract examples from the structure
        if isinstance(data, dict) and 'examples' in data:
            examples = data['examples']
            logger.info(f"Found {len(examples)} examples in {split} dataset")
        elif isinstance(data, list):
            examples = data
        else:
            logger.error(f"Unexpected dataset format: {type(data)}")
            return
        
        logger.info(f"Converting {len(examples)} {split} examples to Gemma format...")
        
        # Convert each example
        converted = []
        for i, example in enumerate(examples):
            gemma_example = self.convert_to_gemma_format(example)
            converted.append(gemma_example)
            
            if (i + 1) % 100 == 0:
                logger.info(f"Converted {i + 1}/{len(examples)} examples")
        
        # Optimize for CPU
        logger.info("Optimizing for CPU training...")
        optimized = self.optimize_for_cpu_training(converted)
        
        # Calculate statistics
        stats = {
            'total_examples': len(optimized),
            'avg_tokens': sum(e['metadata'].get('estimated_tokens', 0) for e in optimized) / len(optimized),
            'truncated_count': sum(1 for e in optimized if e['metadata'].get('truncated', False)),
            'unique_batches': len(set(e['metadata'].get('batch_num', 'unknown') for e in optimized))
        }
        
        # Save converted dataset
        output_file = self.output_dir / f"gemma_{split}.json"
        with open(output_file, 'w') as f:
            json.dump(optimized, f, indent=2)
        
        # Save statistics
        stats_file = self.output_dir / f"gemma_{split}_stats.json"
        with open(stats_file, 'w') as f:
            json.dump(stats, f, indent=2)
        
        logger.info(f"✅ Saved Gemma-formatted {split} dataset to {output_file}")
        logger.info(f"   Statistics: {stats}")
        
        return optimized

def create_gemma_ready_datasets():
    """Create both train and validation datasets in Gemma format"""
    
    logger.info("="*60)
    logger.info("GEMMA DATASET CONVERSION PIPELINE")
    logger.info("="*60)
    
    converter = GemmaDatasetConverter()
    
    # Convert train dataset
    train_data = converter.convert_dataset("train")
    
    # Convert validation dataset
    val_data = converter.convert_dataset("val")
    
    # Create a small test set for quick validation
    if train_data and len(train_data) >= 10:
        test_data = random.sample(train_data, 10)
        test_file = converter.output_dir / "gemma_test.json"
        with open(test_file, 'w') as f:
            json.dump(test_data, f, indent=2)
        logger.info(f"✅ Created test set with 10 examples at {test_file}")
    
    logger.info("\n" + "="*60)
    logger.info("CONVERSION COMPLETE!")
    logger.info(f"Output directory: {converter.output_dir}")
    logger.info("Files created:")
    logger.info("  - gemma_train.json")
    logger.info("  - gemma_val.json")
    logger.info("  - gemma_test.json")
    logger.info("  - gemma_*_stats.json")
    logger.info("="*60)

if __name__ == "__main__":
    create_gemma_ready_datasets()