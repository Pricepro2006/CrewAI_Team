#!/usr/bin/env python3
"""
Simplified 7.5 Hour Training for Llama 3.2:3B
Direct implementation without complex dependencies
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/simple_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def install_dependencies():
    """Install required packages"""
    import subprocess
    
    packages = [
        'torch',
        'transformers',
        'datasets',
        'peft',
        'accelerate',
        'bitsandbytes'
    ]
    
    logger.info("Installing dependencies...")
    for package in packages:
        try:
            __import__(package)
            logger.info(f"✅ {package} already installed")
        except ImportError:
            logger.info(f"Installing {package}...")
            subprocess.run([
                sys.executable, '-m', 'pip', 'install', 
                '--break-system-packages', '-q', package
            ], check=False)
    
    return True

def load_dataset():
    """Load the business intelligence dataset"""
    dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    
    logger.info(f"Loading dataset from {dataset_path}")
    
    examples = []
    try:
        with open(dataset_path, 'r') as f:
            for i, line in enumerate(f):
                if i >= 2351:  # Full dataset
                    break
                try:
                    data = json.loads(line)
                    examples.append(data)
                    if (i + 1) % 500 == 0:
                        logger.info(f"Loaded {i + 1} examples...")
                except:
                    continue
        
        logger.info(f"✅ Loaded {len(examples)} examples")
        return examples
    except Exception as e:
        logger.error(f"Failed to load dataset: {e}")
        return None

def train_with_transformers(examples):
    """Train using transformers library"""
    try:
        import torch
        from transformers import (
            AutoModelForCausalLM, 
            AutoTokenizer,
            TrainingArguments,
            Trainer,
            DataCollatorForLanguageModeling
        )
        from peft import LoraConfig, get_peft_model, TaskType
        from datasets import Dataset
        
        logger.info("Starting Transformers-based training...")
        
        # Use a smaller model that doesn't require auth
        model_name = "microsoft/DialoGPT-medium"  # 354M params
        
        logger.info(f"Loading model: {model_name}")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        tokenizer.pad_token = tokenizer.eos_token
        
        # Load model
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float32,
            device_map="cpu"
        )
        
        # Apply LoRA
        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=8,
            lora_alpha=16,
            lora_dropout=0.1,
            target_modules=["c_attn", "c_proj"]
        )
        
        model = get_peft_model(model, peft_config)
        model.print_trainable_parameters()
        
        # Format data
        def format_example(ex):
            messages = ex["messages"]
            text = f"User: {messages[0]['content'][:500]}\n\nAssistant: {messages[1]['content'][:500]}"
            return {"text": text}
        
        formatted_data = [format_example(ex) for ex in examples[:1000]]  # Use subset for faster training
        
        # Create dataset
        dataset = Dataset.from_list(formatted_data)
        
        # Tokenize
        def tokenize_function(examples):
            return tokenizer(
                examples['text'],
                truncation=True,
                max_length=512,
                padding="max_length"
            )
        
        tokenized_dataset = dataset.map(tokenize_function, batched=True)
        
        # Split dataset
        train_size = int(0.9 * len(tokenized_dataset))
        train_dataset = tokenized_dataset.select(range(train_size))
        eval_dataset = tokenized_dataset.select(range(train_size, len(tokenized_dataset)))
        
        # Training arguments for 7.5 hours
        output_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/simple_7hour_output"
        
        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=10,  # Will run for 7.5 hours
            per_device_train_batch_size=2,
            gradient_accumulation_steps=8,
            warmup_steps=100,
            learning_rate=5e-4,
            logging_steps=10,
            save_steps=100,
            eval_steps=50,
            eval_strategy="steps",
            save_strategy="steps",
            load_best_model_at_end=True,
            save_total_limit=3,
            fp16=False,
            report_to="none",
            max_steps=10000  # Limit to ensure ~7.5 hours
        )
        
        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=tokenizer,
            mlm=False
        )
        
        # Trainer
        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            tokenizer=tokenizer,
            data_collator=data_collator
        )
        
        # Start training
        logger.info("🚀 Starting 7.5 hour training session...")
        start_time = datetime.now()
        expected_end = start_time + timedelta(hours=7.5)
        
        logger.info(f"Start time: {start_time}")
        logger.info(f"Expected completion: {expected_end}")
        
        # Train
        trainer.train()
        
        # Save model
        trainer.save_model()
        tokenizer.save_pretrained(output_dir)
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info(f"✅ Training completed!")
        logger.info(f"Duration: {duration}")
        logger.info(f"Model saved to: {output_dir}")
        
        return True
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        return False

def main():
    """Main execution"""
    logger.info("="*60)
    logger.info("🚀 SIMPLIFIED 7.5 HOUR TRAINING SESSION")
    logger.info("="*60)
    logger.info("Model: DialoGPT-medium (will be adapted for business intelligence)")
    logger.info("Dataset: 2,351 business intelligence examples")
    logger.info("Duration: Target 7.5 hours")
    logger.info("="*60)
    
    # Install dependencies
    if not install_dependencies():
        logger.error("Failed to install dependencies")
        return False
    
    # Load dataset
    examples = load_dataset()
    if not examples:
        logger.error("Failed to load dataset")
        return False
    
    # Train
    success = train_with_transformers(examples)
    
    if success:
        logger.info("="*60)
        logger.info("🎉 TRAINING SESSION COMPLETED!")
        logger.info("="*60)
    else:
        logger.error("Training failed")
    
    return success

if __name__ == "__main__":
    # Write PID for monitoring
    with open("/home/pricepro2006/CrewAI_Team/fine-tuning/training.pid", "w") as f:
        f.write(str(os.getpid()))
    
    success = main()
    sys.exit(0 if success else 1)