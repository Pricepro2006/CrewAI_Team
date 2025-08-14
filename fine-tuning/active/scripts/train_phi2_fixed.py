#!/usr/bin/env python3
"""
Fixed Phi-2 Training Script with Proper Progress Monitoring
"""

import os
import json
import torch
import logging
import psutil
import gc
import sys
from datetime import datetime
from pathlib import Path
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    TrainerCallback
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import Dataset
import warnings
warnings.filterwarnings('ignore')

# Force output buffering off
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__

# Setup logging with immediate output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('phi2_training_progress.log')
    ],
    force=True
)
logger = logging.getLogger(__name__)

class ProgressCallback(TrainerCallback):
    """Custom callback for progress monitoring"""
    
    def __init__(self):
        self.start_time = datetime.now()
        
    def on_log(self, args, state, control, logs=None, **kwargs):
        if state.global_step > 0:
            elapsed = (datetime.now() - self.start_time).total_seconds()
            steps_per_sec = state.global_step / elapsed if elapsed > 0 else 0
            
            # Calculate ETA
            remaining_steps = state.max_steps - state.global_step
            eta_seconds = remaining_steps / steps_per_sec if steps_per_sec > 0 else 0
            
            # Get current loss
            loss = logs.get('loss', 0) if logs else 0
            
            # Log progress
            logger.info(f"Step {state.global_step}/{state.max_steps} | "
                       f"Loss: {loss:.4f} | "
                       f"Speed: {steps_per_sec:.2f} steps/sec | "
                       f"ETA: {eta_seconds/60:.1f} min")
            
            # Force flush output
            sys.stdout.flush()
            
    def on_train_begin(self, args, state, control, **kwargs):
        logger.info("🚀 Training started!")
        logger.info(f"Total steps: {state.max_steps}")
        self.start_time = datetime.now()
        
    def on_train_end(self, args, state, control, **kwargs):
        elapsed = (datetime.now() - self.start_time).total_seconds()
        logger.info(f"✅ Training completed in {elapsed/60:.1f} minutes!")

def get_memory_usage():
    """Get current memory usage"""
    mem = psutil.virtual_memory()
    return f"{mem.percent:.1f}% ({mem.used/1e9:.1f}GB / {mem.total/1e9:.1f}GB)"

def main():
    logger.info("="*60)
    logger.info("PHI-2 TRAINING WITH FIXES")
    logger.info("="*60)
    logger.info(f"Initial Memory: {get_memory_usage()}")
    
    # Load dataset
    logger.info("Loading dataset...")
    with open('./datasets/claude_train.json', 'r') as f:
        train_data = json.load(f)
    with open('./datasets/claude_val.json', 'r') as f:
        val_data = json.load(f)
    
    train_examples = train_data['examples'][:500]  # Use subset for faster training
    val_examples = val_data['examples'][:100]
    
    logger.info(f"Using {len(train_examples)} training examples")
    logger.info(f"Using {len(val_examples)} validation examples")
    
    # Load tokenizer
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        "microsoft/phi-2",
        trust_remote_code=True,
        padding_side='left'
    )
    
    # Set padding token
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    
    # Load model
    logger.info("Loading Phi-2 model...")
    model = AutoModelForCausalLM.from_pretrained(
        "microsoft/phi-2",
        torch_dtype=torch.float32,
        device_map='cpu',
        trust_remote_code=True,
        use_cache=False  # Disable cache for training
    )
    
    # Enable gradient checkpointing to save memory
    model.gradient_checkpointing_enable()
    logger.info("Gradient checkpointing enabled")
    
    # Configure LoRA
    logger.info("Configuring LoRA...")
    lora_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.1,
        target_modules=["q_proj", "v_proj", "k_proj", "dense"],
        task_type=TaskType.CAUSAL_LM
    )
    
    model = get_peft_model(model, lora_config)
    
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    logger.info(f"LoRA: {trainable_params:,} trainable params ({100*trainable_params/total_params:.2f}%)")
    logger.info(f"Memory after model load: {get_memory_usage()}")
    
    # Prepare datasets
    logger.info("Preparing datasets...")
    
    def format_example(example):
        # Combine input and output for training
        text = f"{example['input']}\n{example['output']}"
        return {"text": text}
    
    train_texts = [format_example(ex) for ex in train_examples]
    val_texts = [format_example(ex) for ex in val_examples]
    
    def tokenize_function(examples):
        # Tokenize
        outputs = tokenizer(
            examples["text"],
            truncation=True,
            padding="max_length",
            max_length=1024,  # Reduced for memory
            return_tensors=None
        )
        # Set labels (same as input_ids for causal LM)
        outputs["labels"] = outputs["input_ids"].copy()
        return outputs
    
    # Create datasets
    train_dataset = Dataset.from_list(train_texts)
    val_dataset = Dataset.from_list(val_texts)
    
    # Tokenize
    logger.info("Tokenizing datasets...")
    train_dataset = train_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"],
        desc="Tokenizing training data"
    )
    
    val_dataset = val_dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=["text"],
        desc="Tokenizing validation data"
    )
    
    # Set format
    train_dataset.set_format("torch")
    val_dataset.set_format("torch")
    
    logger.info(f"Dataset preparation complete!")
    logger.info(f"Memory after tokenization: {get_memory_usage()}")
    
    # Training arguments
    logger.info("Creating trainer...")
    training_args = TrainingArguments(
        output_dir="./phi2-finetuned",
        num_train_epochs=1,  # Start with 1 epoch
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,  # Reduced for faster updates
        warmup_steps=50,
        learning_rate=2e-4,
        logging_dir="./logs",
        logging_steps=5,  # Log every 5 steps
        save_strategy="steps",
        save_steps=50,
        eval_strategy="steps",
        eval_steps=50,
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to=[],  # No external reporting
        remove_unused_columns=False,
        dataloader_num_workers=0,
        disable_tqdm=False,  # Enable progress bar
        log_level="info",
        logging_first_step=True,
        seed=42
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,  # Causal LM
        pad_to_multiple_of=8
    )
    
    # Create trainer with progress callback
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
        callbacks=[ProgressCallback()]
    )
    
    # Start training
    logger.info("="*60)
    logger.info("STARTING TRAINING")
    logger.info("="*60)
    logger.info(f"Training examples: {len(train_dataset)}")
    logger.info(f"Validation examples: {len(val_dataset)}")
    logger.info(f"Batch size: 1")
    logger.info(f"Gradient accumulation: 8")
    logger.info(f"Effective batch size: 8")
    logger.info(f"Total optimization steps: {trainer.args.max_steps}")
    logger.info("="*60)
    
    try:
        # Train
        train_result = trainer.train()
        
        # Save model
        logger.info("Saving model...")
        trainer.save_model()
        tokenizer.save_pretrained("./phi2-finetuned")
        
        # Log results
        logger.info("="*60)
        logger.info("TRAINING COMPLETE!")
        logger.info("="*60)
        logger.info(f"Final training loss: {train_result.training_loss:.4f}")
        logger.info(f"Model saved to: ./phi2-finetuned")
        
        # Evaluate
        logger.info("Running evaluation...")
        eval_results = trainer.evaluate()
        logger.info(f"Evaluation loss: {eval_results['eval_loss']:.4f}")
        
    except KeyboardInterrupt:
        logger.info("\n⚠️ Training interrupted by user")
        logger.info("Saving checkpoint...")
        trainer.save_model("./phi2-checkpoint-interrupted")
        
    except Exception as e:
        logger.error(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        logger.info(f"Final memory usage: {get_memory_usage()}")
        
        # Cleanup
        del model
        del trainer
        gc.collect()
        torch.cuda.empty_cache() if torch.cuda.is_available() else None

if __name__ == "__main__":
    main()