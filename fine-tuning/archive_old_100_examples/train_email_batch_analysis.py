#!/usr/bin/env python3
"""
Train LFM2-1.2B to return Claude's analysis for specific email batch numbers
Based on the plan to map batch numbers to their comprehensive analysis
"""

import os
import json
import re
import torch
import logging
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_batch_analyses(md_file_path):
    """Extract individual batch analyses from the Claude MD file"""
    with open(md_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to find batch sections
    pattern = r'## Batch (\d+) Analysis\n\n(.*?)(?=## Batch \d+ Analysis|$)'
    matches = re.findall(pattern, content, re.DOTALL)
    
    batch_analyses = {}
    for batch_num, analysis in matches:
        # Clean up the analysis text
        analysis = analysis.strip()
        # Remove TextBlock artifacts if present
        analysis = re.sub(r'\[TextBlock\(citations=None, text=[\'"]', '', analysis)
        analysis = re.sub(r'[\'"], type=[\'"]text[\'"]?\)\]', '', analysis)
        batch_analyses[int(batch_num)] = analysis
    
    logger.info(f"Extracted {len(batch_analyses)} batch analyses from MD file")
    return batch_analyses

def load_email_batch(batch_file_path):
    """Load email batch JSON file"""
    try:
        with open(batch_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None

def create_training_dataset(email_batches_dir, md_file_path, max_examples=None):
    """Create training dataset from email batches and Claude analysis"""
    
    # Extract all batch analyses from MD file
    batch_analyses = extract_batch_analyses(md_file_path)
    
    training_examples = []
    batch_files = sorted(Path(email_batches_dir).glob("emails_batch_*.json"))
    
    for batch_file in batch_files:
        # Extract batch number from filename
        match = re.search(r'emails_batch_(\d+)\.json', batch_file.name)
        if not match:
            continue
            
        batch_num = int(match.group(1))
        
        # Skip if we don't have analysis for this batch
        if batch_num not in batch_analyses:
            continue
        
        # Load email batch data
        batch_data = load_email_batch(batch_file)
        if not batch_data:
            continue
        
        # Create training example
        # Input: Request to analyze batch number
        instruction = f"Analyze email batch #{batch_num}"
        
        # Add context about what's in the batch (optional, for better training)
        email_count = len(batch_data) if isinstance(batch_data, list) else 1
        input_context = f"This batch contains {email_count} emails from TD SYNNEX communications."
        
        # Output: The Claude analysis for this batch
        output = batch_analyses[batch_num]
        
        training_examples.append({
            "instruction": instruction,
            "input": input_context,
            "output": output,
            "batch_number": batch_num
        })
        
        if max_examples and len(training_examples) >= max_examples:
            break
    
    logger.info(f"Created {len(training_examples)} training examples")
    return training_examples

def format_for_training(examples):
    """Format examples for LFM2 training"""
    formatted = []
    
    for ex in examples:
        # Create a conversational format
        text = f"""### Instruction:
{ex['instruction']}

### Context:
{ex['input']}

### Analysis:
{ex['output'][:2000]}...  # Truncate very long analyses for training
"""
        formatted.append(text)
    
    return formatted

def main():
    logger.info("="*60)
    logger.info("Email Batch Analysis Training - LFM2-1.2B")
    logger.info("="*60)
    
    # Paths
    email_batches_dir = "/home/pricepro2006/CrewAI_Team/email_batches"
    md_file_path = "/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md"
    output_dir = "./models/email_batch_analyzer"
    
    # Create training dataset
    logger.info("Creating training dataset...")
    training_examples = create_training_dataset(
        email_batches_dir, 
        md_file_path,
        max_examples=100  # Start with 100 for testing
    )
    
    if not training_examples:
        logger.error("No training examples created!")
        return
    
    # Format for training
    formatted_examples = format_for_training(training_examples)
    
    # Now train the model
    logger.info("Loading model and starting training...")
    
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
        Trainer,
        DataCollatorForLanguageModeling
    )
    from peft import LoraConfig, get_peft_model, TaskType
    import datasets
    
    # Load model and tokenizer
    model_name = "LiquidAI/LFM2-1.2B"
    
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    
    # Add LoRA
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=8,  # Slightly higher rank for this specific task
        lora_alpha=16,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"]
    )
    
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    
    # Prepare dataset
    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            padding=True,
            truncation=True,
            max_length=512
        )
    
    # Create dataset
    dataset = datasets.Dataset.from_dict({"text": formatted_examples})
    tokenized_dataset = dataset.map(tokenize_function, batched=True)
    
    # Split dataset
    split_dataset = tokenized_dataset.train_test_split(test_size=0.1, seed=42)
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=2,  # More epochs for this specific task
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=3e-4,
        warmup_steps=20,
        logging_steps=10,
        save_steps=50,
        eval_strategy="steps",
        eval_steps=25,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="loss",
        report_to="none",
        fp16=False,
        max_steps=200,  # Limit for testing
        dataloader_num_workers=0
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=split_dataset["train"],
        eval_dataset=split_dataset["test"],
        tokenizer=tokenizer,
        data_collator=data_collator
    )
    
    # Train
    logger.info("Starting training...")
    logger.info(f"Training on {len(split_dataset['train'])} examples")
    logger.info(f"Evaluating on {len(split_dataset['test'])} examples")
    
    try:
        trainer.train()
        
        # Save model
        logger.info("Saving model...")
        trainer.save_model()
        tokenizer.save_pretrained(output_dir)
        
        # Test the model
        logger.info("Testing model...")
        test_prompt = "### Instruction:\nAnalyze email batch #1\n\n### Context:\nThis batch contains emails from TD SYNNEX communications.\n\n### Analysis:\n"
        
        inputs = tokenizer(test_prompt, return_tensors="pt", truncation=True)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=200,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        logger.info(f"Test response:\n{response}")
        
        logger.info(f"✅ Training completed! Model saved to {output_dir}")
        
        # Save example mappings for reference
        mapping_file = Path(output_dir) / "batch_mappings.json"
        with open(mapping_file, 'w') as f:
            json.dump({
                "total_batches": len(training_examples),
                "batch_numbers": [ex["batch_number"] for ex in training_examples],
                "training_complete": datetime.now().isoformat()
            }, f, indent=2)
        
        logger.info(f"Batch mappings saved to {mapping_file}")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()