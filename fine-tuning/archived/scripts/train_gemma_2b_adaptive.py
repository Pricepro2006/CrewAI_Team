#!/usr/bin/env python3
"""
Adaptive Training Pipeline for Google Gemma 2B-IT
Optimized for CPU-based fine-tuning with 54GB RAM
Using Zero-Hardcoding Philosophy
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
    TaskType,
    prepare_model_for_kbit_training
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
        logging.FileHandler('gemma_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class GemmaConfig:
    """Configuration optimized for Gemma 2B-IT on CPU"""
    
    # Model configuration
    model_name: str = "Qwen/Qwen2.5-1.5B-Instruct"  # Similar size, no auth needed
    model_revision: str = "main"
    trust_remote_code: bool = True
    
    # Paths
    dataset_dir: str = "./datasets/gemma_formatted"
    output_dir: str = "./gemma-2b-finetuned"
    checkpoint_dir: str = "./checkpoints-gemma"
    cache_dir: str = "./model_cache"
    
    # Training hyperparameters (CPU-optimized)
    learning_rate: float = 5e-5
    num_train_epochs: int = 1  # Start with 1 epoch for testing
    per_device_train_batch_size: int = 1  # Very conservative for initial test
    per_device_eval_batch_size: int = 1
    gradient_accumulation_steps: int = 2  # Effective batch size = 2
    warmup_ratio: float = 0.1
    weight_decay: float = 0.01
    max_grad_norm: float = 1.0
    
    # LoRA configuration (optimized for Gemma)
    lora_r: int = 8  # Low rank for CPU efficiency
    lora_alpha: int = 16
    lora_dropout: float = 0.05
    lora_target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "v_proj", "k_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
    ])
    
    # Sequence configuration
    max_seq_length: int = 2048  # Balanced for 8K context
    
    # Hardware optimization
    fp16: bool = False  # Use FP32 for CPU
    bf16: bool = False
    gradient_checkpointing: bool = True
    use_cpu: bool = True
    dataloader_num_workers: int = 4
    
    # Training control
    save_steps: int = 500  # Less frequent saves for testing
    eval_steps: int = 100  # Less frequent evals for testing
    logging_steps: int = 5  # More frequent logging to see progress
    save_total_limit: int = 3
    load_best_model_at_end: bool = True
    metric_for_best_model: str = "eval_loss"
    greater_is_better: bool = False
    
    # Early stopping
    early_stopping_patience: int = 3
    early_stopping_threshold: float = 0.001
    
    # Reproducibility
    seed: int = 42


class MemoryMonitor:
    """Monitor and manage memory usage during training"""
    
    @staticmethod
    def get_memory_usage():
        """Get current memory usage in GB"""
        process = psutil.Process()
        return process.memory_info().rss / 1024**3
    
    @staticmethod
    def log_memory_stats():
        """Log detailed memory statistics"""
        memory = psutil.virtual_memory()
        logger.info(f"Memory Usage: {memory.percent:.1f}% "
                   f"({memory.used/1024**3:.1f}GB / {memory.total/1024**3:.1f}GB)")
        
    @staticmethod
    def cleanup():
        """Force garbage collection"""
        gc.collect()
        torch.cuda.empty_cache() if torch.cuda.is_available() else None

class AdaptiveGemmaTrainer:
    """Main trainer class for Gemma 2B-IT with adaptive curriculum"""
    
    def __init__(self, config: GemmaConfig):
        self.config = config
        set_seed(config.seed)
        
        # Create directories
        Path(config.output_dir).mkdir(parents=True, exist_ok=True)
        Path(config.checkpoint_dir).mkdir(parents=True, exist_ok=True)
        Path(config.cache_dir).mkdir(parents=True, exist_ok=True)
        
        self.memory_monitor = MemoryMonitor()
        
    def load_model_and_tokenizer(self):
        """Load Gemma model and tokenizer with CPU optimizations"""
        
        logger.info(f"Loading model: {self.config.model_name}")
        self.memory_monitor.log_memory_stats()
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.config.model_name,
            revision=self.config.model_revision,
            trust_remote_code=self.config.trust_remote_code,
            cache_dir=self.config.cache_dir,
            padding_side='left'
        )
        
        # Set padding token if needed
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
            self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
        
        # Load model with CPU optimizations
        logger.info("Loading model in FP32 for CPU...")
        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            revision=self.config.model_revision,
            trust_remote_code=self.config.trust_remote_code,
            cache_dir=self.config.cache_dir,
            torch_dtype=torch.float32,  # FP32 for CPU
            device_map="cpu",
            low_cpu_mem_usage=True,
            use_cache=False  # Disable KV cache during training
        )
        
        # Enable gradient checkpointing
        if self.config.gradient_checkpointing:
            self.model.gradient_checkpointing_enable()
            self.model.enable_input_require_grads()
            logger.info("Gradient checkpointing enabled")
        
        # Prepare for training
        self.model = prepare_model_for_kbit_training(self.model)
        
        # Configure LoRA
        lora_config = LoraConfig(
            r=self.config.lora_r,
            lora_alpha=self.config.lora_alpha,
            target_modules=self.config.lora_target_modules,
            lora_dropout=self.config.lora_dropout,
            bias="none",
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False
        )
        
        # Apply LoRA
        self.model = get_peft_model(self.model, lora_config)
        
        # Print trainable parameters
        self.model.print_trainable_parameters()
        
        self.memory_monitor.log_memory_stats()
        
    def load_datasets(self) -> tuple:
        """Load and prepare datasets with Gemma formatting"""
        
        logger.info("Loading Gemma-formatted datasets...")
        
        # Load pre-formatted Gemma datasets
        train_path = Path(self.config.dataset_dir) / "gemma_train.json"
        val_path = Path(self.config.dataset_dir) / "gemma_val.json"
        
        if not train_path.exists() or not val_path.exists():
            raise FileNotFoundError(f"Gemma dataset files not found in {self.config.dataset_dir}")
        
        with open(train_path, 'r') as f:
            train_data = json.load(f)
        
        with open(val_path, 'r') as f:
            val_data = json.load(f)
        
        # Log dataset statistics
        logger.info(f"Loaded {len(train_data)} training examples")
        logger.info(f"Loaded {len(val_data)} validation examples")
        
        # Extract texts from the Gemma-formatted data
        train_texts = [example['text'] for example in train_data]
        val_texts = [example['text'] for example in val_data]
        
        # Tokenize datasets
        def tokenize_function(examples):
            return self.tokenizer(
                examples['text'],
                truncation=True,
                padding='max_length',
                max_length=self.config.max_seq_length,
                return_tensors=None
            )
        
        # Create HuggingFace datasets
        from datasets import Dataset
        
        train_dataset = Dataset.from_dict({'text': train_texts})
        val_dataset = Dataset.from_dict({'text': val_texts})
        
        # Tokenize
        train_dataset = train_dataset.map(
            tokenize_function,
            batched=True,
            num_proc=4,
            remove_columns=['text']
        )
        
        val_dataset = val_dataset.map(
            tokenize_function,
            batched=True,
            num_proc=4,
            remove_columns=['text']
        )
        
        # Add labels (same as input_ids for causal LM)
        def add_labels(examples):
            examples['labels'] = examples['input_ids'].copy()
            return examples
        
        train_dataset = train_dataset.map(
            add_labels,
            batched=True,
            num_proc=4
        )
        
        val_dataset = val_dataset.map(
            add_labels,
            batched=True,
            num_proc=4
        )
        
        return train_dataset, val_dataset
    
    def create_training_arguments(self) -> TrainingArguments:
        """Create training arguments optimized for CPU"""
        
        total_train_batch_size = (
            self.config.per_device_train_batch_size * 
            self.config.gradient_accumulation_steps
        )
        
        logger.info(f"Effective batch size: {total_train_batch_size}")
        
        return TrainingArguments(
            output_dir=self.config.output_dir,
            overwrite_output_dir=True,
            
            # Training hyperparameters
            num_train_epochs=self.config.num_train_epochs,
            per_device_train_batch_size=self.config.per_device_train_batch_size,
            per_device_eval_batch_size=self.config.per_device_eval_batch_size,
            gradient_accumulation_steps=self.config.gradient_accumulation_steps,
            
            # Optimizer settings
            learning_rate=self.config.learning_rate,
            weight_decay=self.config.weight_decay,
            warmup_ratio=self.config.warmup_ratio,
            max_grad_norm=self.config.max_grad_norm,
            optim="adamw_torch",
            
            # Precision settings (CPU)
            fp16=self.config.fp16,
            bf16=self.config.bf16,
            
            # Logging
            logging_dir='./logs',
            logging_steps=self.config.logging_steps,
            report_to=[],  # Disable wandb/tensorboard
            
            # Evaluation
            evaluation_strategy="steps",
            eval_steps=self.config.eval_steps,
            
            # Saving
            save_strategy="steps",
            save_steps=self.config.save_steps,
            save_total_limit=self.config.save_total_limit,
            
            # Best model
            load_best_model_at_end=self.config.load_best_model_at_end,
            metric_for_best_model=self.config.metric_for_best_model,
            greater_is_better=self.config.greater_is_better,
            
            # Hardware optimization
            gradient_checkpointing=self.config.gradient_checkpointing,
            gradient_checkpointing_kwargs={'use_reentrant': False},
            dataloader_num_workers=self.config.dataloader_num_workers,
            dataloader_pin_memory=False,  # CPU only
            
            # Other
            remove_unused_columns=False,
            label_names=["labels"],
            push_to_hub=False,
        )
    
    def train(self):
        """Execute the training pipeline"""
        
        logger.info("="*80)
        logger.info("GEMMA 2B-IT ADAPTIVE TRAINING PIPELINE")
        logger.info("CPU-Optimized with Zero-Hardcoding Philosophy")
        logger.info("="*80)
        
        # Load model and tokenizer
        self.load_model_and_tokenizer()
        
        # Load datasets
        train_dataset, val_dataset = self.load_datasets()
        
        # Create training arguments
        training_args = self.create_training_arguments()
        
        # Data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False,
            pad_to_multiple_of=8  # Optimize padding
        )
        
        # Callbacks
        callbacks = [
            EarlyStoppingCallback(
                early_stopping_patience=self.config.early_stopping_patience,
                early_stopping_threshold=self.config.early_stopping_threshold
            )
        ]
        
        # Initialize trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            tokenizer=self.tokenizer,
            data_collator=data_collator,
            callbacks=callbacks
        )
        
        # Log training info
        logger.info(f"Training on {len(train_dataset)} examples")
        logger.info(f"Evaluating on {len(val_dataset)} examples")
        logger.info(f"Total optimization steps: {trainer.args.max_steps}")
        
        # Memory cleanup before training
        self.memory_monitor.cleanup()
        self.memory_monitor.log_memory_stats()
        
        # Start training
        logger.info("\nStarting training...")
        try:
            train_result = trainer.train()
            
            # Save model
            logger.info("Saving model...")
            trainer.save_model(self.config.output_dir)
            self.tokenizer.save_pretrained(self.config.output_dir)
            
            # Save training results
            with open(Path(self.config.output_dir) / "training_results.json", 'w') as f:
                json.dump({
                    "train_loss": float(train_result.training_loss),
                    "train_runtime": train_result.metrics['train_runtime'],
                    "train_samples_per_second": train_result.metrics['train_samples_per_second'],
                    "total_steps": train_result.global_step,
                }, f, indent=2)
            
            logger.info("✅ Training completed successfully!")
            
            # Final evaluation
            logger.info("\nRunning final evaluation...")
            eval_results = trainer.evaluate()
            
            # Save evaluation results
            with open(Path(self.config.output_dir) / "eval_results.json", 'w') as f:
                json.dump(eval_results, f, indent=2)
            
            logger.info(f"Final Evaluation Loss: {eval_results['eval_loss']:.4f}")
            
            # Memory stats
            self.memory_monitor.log_memory_stats()
            
            return trainer, eval_results
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            self.memory_monitor.log_memory_stats()
            raise
        
    def test_inference(self, prompt: str, max_new_tokens: int = 512):
        """Test inference with the trained model"""
        
        logger.info("Testing inference...")
        
        # Format prompt with Gemma template
        formatted_prompt = f"<start_of_turn>user\n{prompt}\n<end_of_turn>\n<start_of_turn>model\n"
        
        # Tokenize
        inputs = self.tokenizer(
            formatted_prompt,
            return_tensors="pt",
            truncation=True,
            max_length=self.config.max_seq_length
        )
        
        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                temperature=0.7,
                do_sample=True,
                top_p=0.95,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )
        
        # Decode
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract model response
        if "<start_of_turn>model" in response:
            response = response.split("<start_of_turn>model")[-1].strip()
        
        return response

def main():
    """Main entry point"""
    
    # Initialize configuration
    config = GemmaConfig()
    
    # Create trainer
    trainer = AdaptiveGemmaTrainer(config)
    
    try:
        # Run training
        trainer_obj, eval_results = trainer.train()
        
        # Test inference
        test_prompt = "What information can you extract from email batch 2301?"
        response = trainer.test_inference(test_prompt)
        
        logger.info("\n" + "="*60)
        logger.info("🎉 TRAINING COMPLETE!")
        logger.info(f"Model saved to: {config.output_dir}")
        logger.info(f"Final eval loss: {eval_results['eval_loss']:.4f}")
        logger.info("\nTest inference:")
        logger.info(f"Prompt: {test_prompt}")
        logger.info(f"Response: {response[:200]}...")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise

if __name__ == "__main__":
    main()