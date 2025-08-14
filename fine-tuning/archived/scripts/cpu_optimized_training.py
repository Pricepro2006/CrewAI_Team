#!/usr/bin/env python3
"""
CPU-Optimized Fine-Tuning for Llama 3.2:3b Business Intelligence
Designed for AMD Ryzen 7 + 64GB RAM system
"""

import torch
import json
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, List
import multiprocessing as mp

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer, 
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
from torch.utils.data import Dataset
from sklearn.model_selection import train_test_split

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CPUTrainingConfig:
    """Configuration optimized for CPU training"""
    model_name: str = "meta-llama/Llama-3.2-3B-Instruct"
    dataset_path: str = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    output_dir: str = "./llama-3.2-3b-business-intelligence-cpu"
    max_length: int = 4096  # Reduced for CPU efficiency
    batch_size: int = 1
    gradient_accumulation_steps: int = 16
    learning_rate: float = 1e-4
    num_epochs: int = 3
    warmup_steps: int = 50
    logging_steps: int = 10
    save_steps: int = 100
    eval_steps: int = 50
    lora_r: int = 8
    lora_alpha: int = 16

class BusinessIntelligenceDataset(Dataset):
    """Dataset class for business intelligence training"""
    
    def __init__(self, examples: List[Dict], tokenizer, max_length: int = 4096):
        self.examples = examples
        self.tokenizer = tokenizer
        self.max_length = max_length
        
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        example = self.examples[idx]
        
        # Format conversation
        user_content = example["messages"][0]["content"]
        assistant_content = example["messages"][1]["content"]
        
        # Create full conversation
        conversation = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{user_content}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{assistant_content}<|eot_id|>"
        
        # Tokenize
        encoding = self.tokenizer(
            conversation,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )
        
        # Create labels (only train on assistant response)
        labels = encoding["input_ids"].clone()
        
        # Find where assistant response starts
        user_tokens = self.tokenizer(
            f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{user_content}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
            add_special_tokens=False
        )["input_ids"]
        
        # Mask user tokens in loss calculation
        if len(user_tokens) < self.max_length:
            labels[0, :len(user_tokens)] = -100
        
        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "labels": labels.squeeze()
        }

def load_dataset(config: CPUTrainingConfig):
    """Load and split dataset"""
    logger.info(f"Loading dataset from {config.dataset_path}")
    
    examples = []
    with open(config.dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            examples.append(json.loads(line))
    
    logger.info(f"Loaded {len(examples)} examples")
    
    # Split into train/eval
    train_examples, eval_examples = train_test_split(
        examples, test_size=0.15, random_state=42
    )
    
    logger.info(f"Train: {len(train_examples)}, Eval: {len(eval_examples)}")
    return train_examples, eval_examples

def setup_model_and_tokenizer(config: CPUTrainingConfig):
    """Setup model and tokenizer for CPU training"""
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    
    # Add pad token if missing
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    
    logger.info("Loading model for CPU training...")
    model = AutoModelForCausalLM.from_pretrained(
        config.model_name,
        torch_dtype=torch.float32,  # Full precision for CPU
        device_map="cpu",
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    
    # Setup LoRA
    logger.info("Applying LoRA configuration...")
    lora_config = LoraConfig(
        r=config.lora_r,
        lora_alpha=config.lora_alpha,
        target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM
    )
    
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    return model, tokenizer

def main():
    """Main training function"""
    config = CPUTrainingConfig()
    
    # Set CPU threads for optimal performance
    torch.set_num_threads(mp.cpu_count())
    logger.info(f"Using {mp.cpu_count()} CPU threads")
    
    # Load data
    train_examples, eval_examples = load_dataset(config)
    
    # Setup model
    model, tokenizer = setup_model_and_tokenizer(config)
    
    # Create datasets
    train_dataset = BusinessIntelligenceDataset(train_examples, tokenizer, config.max_length)
    eval_dataset = BusinessIntelligenceDataset(eval_examples, tokenizer, config.max_length)
    
    # Training arguments optimized for CPU
    training_args = TrainingArguments(
        output_dir=config.output_dir,
        per_device_train_batch_size=config.batch_size,
        per_device_eval_batch_size=config.batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        learning_rate=config.learning_rate,
        num_train_epochs=config.num_epochs,
        warmup_steps=config.warmup_steps,
        logging_steps=config.logging_steps,
        save_steps=config.save_steps,
        eval_steps=config.eval_steps,
        evaluation_strategy="steps",
        save_strategy="steps",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        fp16=False,  # CPU doesn't support fp16
        bf16=False,  # CPU doesn't support bf16
        dataloader_num_workers=4,  # Use multiple cores for data loading
        remove_unused_columns=False,
        report_to=["tensorboard"],
        logging_dir=f"{config.output_dir}/logs",
        torch_compile=True,  # PyTorch 2.0 optimization
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
        pad_to_multiple_of=8
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
    )
    
    # Start training
    logger.info("Starting training... This will take 12-15 hours on CPU")
    logger.info("Monitor progress with: tensorboard --logdir=./llama-3.2-3b-business-intelligence-cpu/logs")
    
    try:
        trainer.train()
        
        # Save final model
        logger.info("Saving final model...")
        trainer.save_model()
        tokenizer.save_pretrained(config.output_dir)
        
        logger.info(f"Training complete! Model saved to {config.output_dir}")
        
    except KeyboardInterrupt:
        logger.info("Training interrupted. Saving checkpoint...")
        trainer.save_model(f"{config.output_dir}/checkpoint-interrupted")
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise

if __name__ == "__main__":
    main()