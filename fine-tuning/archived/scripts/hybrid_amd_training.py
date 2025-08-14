#!/usr/bin/env python3
"""
Hybrid AMD Training: CPU + Radeon 780M + NPU Optimization
Designed for AMD Ryzen 7 7840H + 64GB RAM system
"""

import torch
import json
import logging
from pathlib import Path
from dataclasses import dataclass
from typing import Dict, List
import multiprocessing as mp
import os

# AMD ROCm detection and setup
try:
    # Check if ROCm is available
    if torch.cuda.is_available():
        device = "cuda"  # ROCm presents as CUDA
        logger.info("ROCm detected - using AMD GPU acceleration")
    else:
        device = "cpu"
        logger.info("No GPU acceleration detected - using CPU")
except:
    device = "cpu"

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class HybridAMDTrainingConfig:
    """Configuration optimized for AMD Ryzen 7 7840H system"""
    model_name: str = "meta-llama/Llama-3.2-3B-Instruct"
    dataset_path: str = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    output_dir: str = "./llama-3.2-3b-business-intelligence-amd"
    
    # Optimized for 64GB RAM + Radeon 780M (8GB shared VRAM)
    max_length: int = 3072           # Reduced for VRAM constraints
    batch_size: int = 2 if device == "cuda" else 1  # Larger batch on GPU
    gradient_accumulation_steps: int = 8 if device == "cuda" else 16
    learning_rate: float = 2e-4 if device == "cuda" else 1e-4
    num_epochs: int = 3
    warmup_steps: int = 50
    logging_steps: int = 10
    save_steps: int = 100
    eval_steps: int = 50
    
    # LoRA settings optimized for integrated GPU
    lora_r: int = 16 if device == "cuda" else 8
    lora_alpha: int = 32 if device == "cuda" else 16
    
    # AMD-specific optimizations
    use_amp: bool = device == "cuda"  # Automatic Mixed Precision for GPU
    dataloader_workers: int = 8       # Utilize all CPU cores

class OptimizedBusinessIntelligenceDataset(Dataset):
    """Memory-efficient dataset class"""
    
    def __init__(self, examples: List[Dict], tokenizer, max_length: int = 3072):
        self.examples = examples
        self.tokenizer = tokenizer
        self.max_length = max_length
        
        # Pre-compute tokenization to reduce training overhead
        logger.info("Pre-tokenizing dataset for efficiency...")
        self.tokenized_examples = []
        
        for i, example in enumerate(examples):
            if i % 100 == 0:
                logger.info(f"Pre-tokenizing example {i}/{len(examples)}")
                
            tokenized = self._tokenize_example(example)
            self.tokenized_examples.append(tokenized)
        
        logger.info("Pre-tokenization complete!")
        
    def _tokenize_example(self, example):
        """Tokenize a single example efficiently"""
        user_content = example["messages"][0]["content"]
        assistant_content = example["messages"][1]["content"]
        
        # Truncate if too long to fit context
        if len(user_content) > 6000:  # Rough character limit
            user_content = user_content[:6000] + "...\n[Content truncated for training efficiency]"
        
        if len(assistant_content) > 2000:
            assistant_content = assistant_content[:2000] + "...\n[Analysis truncated for training efficiency]"
        
        # Create conversation format
        conversation = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{user_content}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{assistant_content}<|eot_id|>"
        
        # Tokenize
        encoding = self.tokenizer(
            conversation,
            truncation=True,
            max_length=self.max_length,
            padding=False,  # Don't pad during pre-processing
            return_tensors="pt"
        )
        
        # Create labels
        labels = encoding["input_ids"].clone()
        
        # Find assistant start
        user_part = f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{user_content}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"
        user_tokens = self.tokenizer(user_part, add_special_tokens=False)["input_ids"]
        
        if len(user_tokens) < self.max_length:
            labels[0, :len(user_tokens)] = -100
        
        return {
            "input_ids": encoding["input_ids"].squeeze(),
            "attention_mask": encoding["attention_mask"].squeeze(),
            "labels": labels.squeeze()
        }
    
    def __len__(self):
        return len(self.tokenized_examples)
    
    def __getitem__(self, idx):
        return self.tokenized_examples[idx]

def setup_amd_environment():
    """Setup optimal environment for AMD hardware"""
    # CPU optimizations
    torch.set_num_threads(16)  # Use all CPU threads
    
    # Memory optimizations
    os.environ["OMP_NUM_THREADS"] = "16"
    os.environ["MKL_NUM_THREADS"] = "16"
    
    # AMD GPU optimizations if available
    if device == "cuda":
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        # Set memory fraction for shared VRAM
        torch.cuda.set_per_process_memory_fraction(0.8)  # Use 80% of available VRAM
    
    logger.info(f"Environment configured for device: {device}")

def load_optimized_model(config: HybridAMDTrainingConfig):
    """Load model with AMD-specific optimizations"""
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id
    
    logger.info(f"Loading model on {device}...")
    
    if device == "cuda":
        # GPU loading with VRAM optimization
        model = AutoModelForCausalLM.from_pretrained(
            config.model_name,
            torch_dtype=torch.float16,  # Use fp16 for VRAM efficiency
            device_map="auto",
            max_memory={0: "6GB"},  # Limit VRAM usage
            low_cpu_mem_usage=True,
            trust_remote_code=True
        )
    else:
        # CPU loading with RAM optimization  
        model = AutoModelForCausalLM.from_pretrained(
            config.model_name,
            torch_dtype=torch.float32,
            device_map="cpu",
            low_cpu_mem_usage=True,
            trust_remote_code=True
        )
    
    # LoRA configuration
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

def create_optimized_trainer(model, tokenizer, train_dataset, eval_dataset, config):
    """Create trainer with AMD-specific optimizations"""
    
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
        
        # AMD-specific settings
        fp16=config.use_amp and device == "cuda",
        bf16=False,  # AMD doesn't support bf16 well
        dataloader_num_workers=config.dataloader_workers,
        dataloader_pin_memory=device == "cuda",
        remove_unused_columns=False,
        
        # Monitoring
        report_to=["tensorboard"],
        logging_dir=f"{config.output_dir}/logs",
        
        # Optimization
        optim="adamw_torch",
        weight_decay=0.01,
        max_grad_norm=1.0,
        
        # Memory management
        dataloader_persistent_workers=True,
        torch_compile=True,  # PyTorch 2.0 compilation
    )
    
    # Custom data collator with padding
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,
        pad_to_multiple_of=8 if device == "cuda" else None
    )
    
    return Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
    )

def main():
    """Main training function"""
    config = HybridAMDTrainingConfig()
    
    # Setup environment
    setup_amd_environment()
    
    # Load dataset
    logger.info("Loading dataset...")
    examples = []
    with open(config.dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            examples.append(json.loads(line))
    
    train_examples, eval_examples = train_test_split(
        examples, test_size=0.15, random_state=42
    )
    
    logger.info(f"Train: {len(train_examples)}, Eval: {len(eval_examples)}")
    
    # Setup model
    model, tokenizer = load_optimized_model(config)
    
    # Create datasets
    train_dataset = OptimizedBusinessIntelligenceDataset(
        train_examples, tokenizer, config.max_length
    )
    eval_dataset = OptimizedBusinessIntelligenceDataset(
        eval_examples, tokenizer, config.max_length
    )
    
    # Create trainer
    trainer = create_optimized_trainer(
        model, tokenizer, train_dataset, eval_dataset, config
    )
    
    # Training time estimates
    if device == "cuda":
        estimated_time = "6-8 hours (with Radeon 780M acceleration)"
    else:
        estimated_time = "12-15 hours (CPU-only)"
    
    logger.info(f"Starting training... Estimated time: {estimated_time}")
    logger.info("Monitor with: tensorboard --logdir=./llama-3.2-3b-business-intelligence-amd/logs")
    
    try:
        # Train
        trainer.train()
        
        # Save
        logger.info("Saving model...")
        trainer.save_model()
        tokenizer.save_pretrained(config.output_dir)
        
        logger.info(f"✅ Training complete! Model saved to {config.output_dir}")
        
        # Test model
        logger.info("Testing model...")
        test_prompt = "Analyze these business emails for workflow intelligence..."
        
        model.eval()
        inputs = tokenizer.encode(test_prompt, return_tensors="pt")
        
        if device == "cuda":
            inputs = inputs.cuda()
        
        with torch.no_grad():
            outputs = model.generate(
                inputs, 
                max_length=1000, 
                temperature=0.7, 
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        logger.info(f"Sample output: {response[-200:]}")  # Show last 200 chars
        
    except KeyboardInterrupt:
        logger.info("Training interrupted by user")
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise

if __name__ == "__main__":
    main()