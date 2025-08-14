#!/usr/bin/env python3
"""
Adaptive Training Pipeline for Microsoft Phi-2
Optimized for CPU-based fine-tuning with 54GB RAM
"""

import os
import json
import torch
import logging
import psutil
import gc
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from pathlib import Path
import numpy as np

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    EarlyStoppingCallback,
    set_seed
)
from peft import (
    LoraConfig,
    get_peft_model,
    TaskType
)
from datasets import Dataset, DatasetDict
import warnings
warnings.filterwarnings('ignore')

# Set environment variables for CPU optimization
os.environ['OMP_NUM_THREADS'] = '16'
os.environ['MKL_NUM_THREADS'] = '16'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('phi2_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class Phi2Config:
    """Configuration for Phi-2 training"""
    model_name: str = "microsoft/phi-2"
    output_dir: str = "./phi2-email-finetuned"
    
    # Training hyperparameters (optimized for CPU)
    per_device_train_batch_size: int = 1
    per_device_eval_batch_size: int = 1
    gradient_accumulation_steps: int = 16
    num_train_epochs: int = 3
    learning_rate: float = 2e-4
    warmup_steps: int = 100
    
    # Model configuration
    max_seq_length: int = 2048  # Phi-2 supports 2048
    
    # LoRA configuration
    lora_r: int = 8
    lora_alpha: int = 16
    lora_dropout: float = 0.1
    
    # Memory optimization
    gradient_checkpointing: bool = True
    fp16: bool = False  # CPU doesn't support fp16 well
    
    # Adaptive settings
    early_stopping_patience: int = 3
    save_total_limit: int = 2
    save_strategy: str = "steps"
    save_steps: int = 100
    eval_steps: int = 100
    logging_steps: int = 10
    
    # Data paths
    train_data_path: str = "./datasets/claude_train.json"
    val_data_path: str = "./datasets/claude_val.json"
    
    # Seed for reproducibility
    seed: int = 42

class Phi2Trainer:
    """Adaptive trainer for Phi-2"""
    
    def __init__(self, config: Phi2Config):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.peft_model = None
        self.train_dataset = None
        self.val_dataset = None
        
        # Set seed for reproducibility
        set_seed(config.seed)
        
        # Create output directory
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)
        
    def get_memory_usage(self):
        """Get current memory usage"""
        mem = psutil.virtual_memory()
        return f"{mem.percent:.1f}% ({mem.used/1e9:.1f}GB / {mem.total/1e9:.1f}GB)"
        
    def load_model_and_tokenizer(self):
        """Load Phi-2 model and tokenizer"""
        logger.info(f"Loading model: {self.config.model_name}")
        logger.info(f"Memory Usage: {self.get_memory_usage()}")
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.config.model_name,
            trust_remote_code=True,
            padding_side='left'
        )
        
        # Set padding token
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
            self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
        
        # Load model with memory optimization
        logger.info("Loading model with CPU optimization...")
        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            torch_dtype=torch.float32,  # Use FP32 for CPU
            device_map='cpu',
            trust_remote_code=True,
            use_cache=False if self.config.gradient_checkpointing else True
        )
        
        # Enable gradient checkpointing
        if self.config.gradient_checkpointing:
            self.model.gradient_checkpointing_enable()
            logger.info("Gradient checkpointing enabled")
        
        # Configure LoRA
        self.setup_lora()
        
        logger.info(f"Model loaded successfully!")
        logger.info(f"Memory Usage: {self.get_memory_usage()}")
        
    def setup_lora(self):
        """Setup LoRA for efficient fine-tuning"""
        logger.info("Configuring LoRA...")
        
        lora_config = LoraConfig(
            r=self.config.lora_r,
            lora_alpha=self.config.lora_alpha,
            lora_dropout=self.config.lora_dropout,
            target_modules=["q_proj", "v_proj", "k_proj", "dense"],  # Phi-2 specific
            task_type=TaskType.CAUSAL_LM
        )
        
        self.peft_model = get_peft_model(self.model, lora_config)
        
        # Print trainable parameters
        trainable_params = sum(p.numel() for p in self.peft_model.parameters() if p.requires_grad)
        total_params = sum(p.numel() for p in self.peft_model.parameters())
        logger.info(f"LoRA configured: {trainable_params:,} trainable parameters out of {total_params:,} total")
        logger.info(f"Trainable: {100 * trainable_params / total_params:.2f}%")
        
    def load_datasets(self):
        """Load and prepare datasets"""
        logger.info("Loading datasets for Phi-2...")
        
        # Load training data
        with open(self.config.train_data_path, 'r') as f:
            train_data = json.load(f)
        
        # Load validation data
        with open(self.config.val_data_path, 'r') as f:
            val_data = json.load(f)
        
        # Extract examples
        train_examples = train_data['examples']
        val_examples = val_data['examples']
        
        logger.info(f"Loaded {len(train_examples)} training examples")
        logger.info(f"Loaded {len(val_examples)} validation examples")
        
        # Format for Phi-2 (simple format, no special tokens needed)
        def format_example(example):
            # Phi-2 works well with simple prompt-response format
            text = f"{example['input']}\n{example['output']}"
            return {"text": text}
        
        # Create datasets
        train_texts = [format_example(ex) for ex in train_examples]
        val_texts = [format_example(ex) for ex in val_examples]
        
        self.train_dataset = Dataset.from_list(train_texts)
        self.val_dataset = Dataset.from_list(val_texts)
        
        # Tokenize datasets
        self.tokenize_datasets()
        
    def tokenize_datasets(self):
        """Tokenize the datasets"""
        logger.info("Tokenizing datasets...")
        
        def tokenize_function(examples):
            # Tokenize the text
            outputs = self.tokenizer(
                examples["text"],
                truncation=True,
                padding="max_length",
                max_length=self.config.max_seq_length,
                return_tensors=None
            )
            # For causal LM, labels are the same as input_ids
            outputs["labels"] = outputs["input_ids"].copy()
            return outputs
        
        # Tokenize in batches
        self.train_dataset = self.train_dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=["text"],
            desc="Tokenizing training data"
        )
        
        self.val_dataset = self.val_dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=["text"],
            desc="Tokenizing validation data"
        )
        
        # Set format for PyTorch
        self.train_dataset.set_format("torch")
        self.val_dataset.set_format("torch")
        
        logger.info(f"Tokenization complete!")
        
    def create_trainer(self):
        """Create the Hugging Face Trainer"""
        logger.info("Creating trainer...")
        
        # Training arguments
        training_args = TrainingArguments(
            output_dir=self.config.output_dir,
            num_train_epochs=self.config.num_train_epochs,
            per_device_train_batch_size=self.config.per_device_train_batch_size,
            per_device_eval_batch_size=self.config.per_device_eval_batch_size,
            gradient_accumulation_steps=self.config.gradient_accumulation_steps,
            warmup_steps=self.config.warmup_steps,
            learning_rate=self.config.learning_rate,
            logging_dir=f"{self.config.output_dir}/logs",
            logging_steps=self.config.logging_steps,
            save_strategy=self.config.save_strategy,
            save_steps=self.config.save_steps,
            eval_strategy="steps",  # Fixed parameter name
            eval_steps=self.config.eval_steps,
            save_total_limit=self.config.save_total_limit,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            fp16=self.config.fp16,
            gradient_checkpointing=self.config.gradient_checkpointing,
            report_to=[],  # Disabled reporting to avoid tensorboard dependency
            seed=self.config.seed,
            data_seed=self.config.seed,
            remove_unused_columns=False,
            dataloader_num_workers=0,  # CPU optimization
            ddp_find_unused_parameters=False,
        )
        
        # Data collator - removed pad_to_multiple_of for CPU stability
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False,  # Causal LM, not masked LM
            pad_to_multiple_of=None  # Avoid padding issues on CPU
        )
        
        # Create trainer
        self.trainer = Trainer(
            model=self.peft_model,
            args=training_args,
            train_dataset=self.train_dataset,
            eval_dataset=self.val_dataset,
            data_collator=data_collator,
            tokenizer=self.tokenizer,
            callbacks=[
                EarlyStoppingCallback(
                    early_stopping_patience=self.config.early_stopping_patience
                )
            ]
        )
        
        logger.info("Trainer created successfully!")
        
    def train(self):
        """Run the training"""
        logger.info("="*80)
        logger.info("STARTING PHI-2 ADAPTIVE TRAINING")
        logger.info("="*80)
        logger.info(f"Model: {self.config.model_name}")
        logger.info(f"Train examples: {len(self.train_dataset)}")
        logger.info(f"Val examples: {len(self.val_dataset)}")
        logger.info(f"Batch size: {self.config.per_device_train_batch_size}")
        logger.info(f"Gradient accumulation: {self.config.gradient_accumulation_steps}")
        logger.info(f"Effective batch size: {self.config.per_device_train_batch_size * self.config.gradient_accumulation_steps}")
        logger.info(f"Learning rate: {self.config.learning_rate}")
        logger.info(f"Epochs: {self.config.num_train_epochs}")
        logger.info("="*80)
        
        # Start training
        logger.info("Starting training...")
        start_time = datetime.now()
        
        try:
            train_result = self.trainer.train()
            
            # Log results
            logger.info(f"Training completed in {datetime.now() - start_time}")
            logger.info(f"Final training loss: {train_result.training_loss:.4f}")
            
            # Save the model
            logger.info(f"Saving model to {self.config.output_dir}")
            self.trainer.save_model()
            self.tokenizer.save_pretrained(self.config.output_dir)
            
            # Save training results
            with open(f"{self.config.output_dir}/training_results.json", 'w') as f:
                json.dump({
                    "training_loss": train_result.training_loss,
                    "training_time": str(datetime.now() - start_time),
                    "model": self.config.model_name,
                    "config": self.config.__dict__
                }, f, indent=2)
            
            logger.info("✅ Training complete and model saved!")
            
            return train_result
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise
        
    def evaluate(self):
        """Evaluate the model"""
        logger.info("Evaluating model...")
        
        eval_results = self.trainer.evaluate()
        
        logger.info(f"Evaluation loss: {eval_results['eval_loss']:.4f}")
        
        # Save evaluation results
        with open(f"{self.config.output_dir}/eval_results.json", 'w') as f:
            json.dump(eval_results, f, indent=2)
        
        return eval_results

def main():
    # Create configuration
    config = Phi2Config()
    
    # Create trainer
    trainer = Phi2Trainer(config)
    
    try:
        # Load model and tokenizer
        trainer.load_model_and_tokenizer()
        
        # Load datasets
        trainer.load_datasets()
        
        # Create trainer
        trainer.create_trainer()
        
        # Train
        train_result = trainer.train()
        
        # Evaluate
        eval_result = trainer.evaluate()
        
        logger.info("="*80)
        logger.info("🎉 PHI-2 TRAINING COMPLETE!")
        logger.info(f"Model saved to: {config.output_dir}")
        logger.info(f"Final eval loss: {eval_result['eval_loss']:.4f}")
        logger.info("="*80)
        logger.info("Next steps:")
        logger.info("1. Test the model with phase4_evaluation_framework.py")
        logger.info("2. Compare results against Claude's ground truth")
        logger.info("3. Deploy if accuracy > 70%")
        
    except Exception as e:
        logger.error(f"Training pipeline failed: {e}")
        raise

if __name__ == "__main__":
    main()