#!/usr/bin/env python3
"""
LiquidAI LFM2-1.2B Fine-tuning - Fixed Version
Optimized for CPU training with 54GB RAM
"""

import os
import sys
import json
import torch
import logging
import gc
from datetime import datetime, timedelta
from pathlib import Path
import signal
import psutil

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_fixed.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Signal handler for graceful shutdown
def signal_handler(sig, frame):
    logger.info('Training interrupted! Saving checkpoint...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

def check_memory():
    """Monitor memory usage"""
    mem = psutil.virtual_memory()
    logger.info(f"Memory: {mem.percent}% used ({mem.used/1e9:.1f}GB/{mem.total/1e9:.1f}GB)")
    if mem.percent > 90:
        logger.warning("High memory usage! Clearing cache...")
        gc.collect()
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
    return mem.percent < 95

def load_dataset(path, limit=None):
    """Load business intelligence dataset"""
    examples = []
    data_path = Path(path)
    
    if not data_path.exists():
        # Fallback to creating simple dataset
        logger.warning(f"Dataset not found at {path}, creating sample dataset")
        for i in range(100):
            examples.append({
                "text": f"Query: Analyze email about {['quote', 'order', 'support'][i%3]} request. Response: This is a {['quote', 'order', 'support'][i%3]} request requiring action."
            })
    else:
        with open(data_path, 'r') as f:
            for i, line in enumerate(f):
                if limit and i >= limit:
                    break
                try:
                    item = json.loads(line)
                    # Format for training
                    text = f"Instruction: {item.get('instruction', '')}\nInput: {item.get('input', '')}\nResponse: {item.get('output', '')}"
                    examples.append({"text": text})
                    
                    if (i + 1) % 500 == 0:
                        logger.info(f"  Loaded {i+1} examples...")
                except:
                    continue
    
    logger.info(f"✅ Loaded {len(examples)} training examples")
    return examples

def main():
    logger.info("="*60)
    logger.info("🚀 LFM2-1.2B FIXED TRAINING SESSION")
    logger.info("Optimized for CPU with memory management")
    logger.info("="*60)
    
    # Check initial memory
    if not check_memory():
        logger.error("Insufficient memory to start training!")
        return
    
    # Import libraries
    try:
        from transformers import (
            AutoModelForCausalLM, 
            AutoTokenizer,
            TrainingArguments,
            Trainer,
            DataCollatorForLanguageModeling
        )
        from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
        from datasets import Dataset
        import torch
        logger.info("✅ All libraries imported successfully")
    except ImportError as e:
        logger.error(f"Import error: {e}")
        logger.info("Installing missing packages...")
        os.system("pip install transformers datasets peft accelerate --break-system-packages")
        return
    
    # Configuration
    model_name = "LiquidAI/LFM2-1.2B"
    output_dir = "./models/lfm2_finetuned"
    
    # Training hyperparameters optimized for CPU
    batch_size = 1  # Minimal batch size
    gradient_accumulation = 8  # Accumulate gradients
    learning_rate = 2e-4
    num_epochs = 1  # Start with just 1 epoch
    max_steps = 100  # Limit steps for testing
    
    logger.info("Loading tokenizer...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "right"
        logger.info("✅ Tokenizer loaded")
    except Exception as e:
        logger.error(f"Failed to load tokenizer: {e}")
        return
    
    logger.info("Loading model (this may take a few minutes)...")
    try:
        # Load model without quantization first for CPU
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float32,  # Use float32 for CPU
            low_cpu_mem_usage=True,
            trust_remote_code=True
        )
        logger.info("✅ Model loaded successfully")
        
        # Log model size
        total_params = sum(p.numel() for p in model.parameters())
        logger.info(f"Total parameters: {total_params:,}")
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return
    
    # Add LoRA for efficient training
    logger.info("Adding LoRA adapters...")
    try:
        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=8,  # Reduced rank for CPU
            lora_alpha=16,
            lora_dropout=0.1,
            target_modules=["q_proj", "v_proj"],  # Fewer target modules
            bias="none"
        )
        
        model = get_peft_model(model, peft_config)
        model.print_trainable_parameters()
        
    except Exception as e:
        logger.error(f"Failed to add LoRA: {e}")
        return
    
    # Load dataset
    logger.info("Loading dataset...")
    dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    
    # Load limited examples for CPU training
    examples = load_dataset(dataset_path, limit=500)  # Start with just 500 examples
    
    if not examples:
        logger.error("No training examples loaded!")
        return
    
    # Tokenize dataset
    logger.info("Tokenizing dataset...")
    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            padding="max_length",
            max_length=256  # Shorter sequences for CPU
        )
    
    dataset = Dataset.from_list(examples)
    tokenized_dataset = dataset.map(tokenize_function, batched=True)
    
    # Split dataset
    split_dataset = tokenized_dataset.train_test_split(test_size=0.05)
    train_dataset = split_dataset["train"]
    eval_dataset = split_dataset["test"]
    
    logger.info(f"Train: {len(train_dataset)}, Eval: {len(eval_dataset)}")
    
    # Training arguments optimized for CPU
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=num_epochs,
        max_steps=max_steps,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation,
        gradient_checkpointing=True,  # Save memory
        optim="adamw_torch",  # Use PyTorch optimizer
        learning_rate=learning_rate,
        warmup_steps=10,
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_strategy="steps",
        save_steps=50,
        save_total_limit=2,
        load_best_model_at_end=False,
        report_to="none",
        fp16=False,  # Disable fp16 for CPU
        dataloader_num_workers=0,  # Avoid multiprocessing issues
        remove_unused_columns=False,
        label_names=["input_ids"]
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Initialize trainer
    logger.info("Initializing trainer...")
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        data_collator=data_collator
    )
    
    # Start training
    logger.info("="*60)
    logger.info("🚀 STARTING TRAINING")
    logger.info(f"Start time: {datetime.now()}")
    logger.info(f"Max steps: {max_steps}")
    logger.info(f"Estimated time: {max_steps * 30 / 60:.1f} minutes")
    logger.info("="*60)
    
    try:
        # Monitor memory during training
        trainer.train()
        
        logger.info("✅ Training completed successfully!")
        
        # Save model
        logger.info("Saving model...")
        trainer.save_model(output_dir)
        tokenizer.save_pretrained(output_dir)
        logger.info(f"✅ Model saved to {output_dir}")
        
        # Test inference
        logger.info("Testing inference...")
        test_text = "Analyze this email about a purchase order request."
        inputs = tokenizer(test_text, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(**inputs, max_length=100, temperature=0.7)
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)
            logger.info(f"Test input: {test_text}")
            logger.info(f"Model response: {response}")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        logger.info("Attempting to save checkpoint...")
        try:
            trainer.save_model(f"{output_dir}_checkpoint")
            logger.info("Checkpoint saved")
        except:
            pass
    
    finally:
        # Cleanup
        logger.info("Cleaning up...")
        del model
        del trainer
        gc.collect()

if __name__ == "__main__":
    main()