#!/usr/bin/env python3
"""
CPU-Optimized Training for Phi-2 Model
Designed for systems without GPU (54GB RAM, CPU-only)
"""

import os
import sys
import json
import logging
import torch
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cpu_phi2_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# CPU optimizations
torch.set_num_threads(8)  # Adjust based on your CPU cores
os.environ['OMP_NUM_THREADS'] = '8'
os.environ['MKL_NUM_THREADS'] = '8'

@dataclass
class CPUTrainingConfig:
    """Configuration optimized for CPU training"""
    
    # Model selection (CPU-friendly)
    model_name: str = "microsoft/phi-2"  # 2.7B params, CPU-friendly
    # Alternative: "microsoft/phi-1_5" (1.3B params, even lighter)
    # Alternative: "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    
    # Training parameters (CPU-optimized)
    learning_rate: float = 5e-5
    train_batch_size: int = 1  # Small batch for CPU
    eval_batch_size: int = 2
    gradient_accumulation_steps: int = 16  # Simulate larger batch
    num_epochs: int = 2  # Fewer epochs for CPU
    max_seq_length: int = 512  # Shorter sequences for CPU
    
    # LoRA configuration (memory efficient)
    use_lora: bool = True
    lora_r: int = 8  # Very low rank for CPU
    lora_alpha: int = 16
    lora_dropout: float = 0.1
    lora_target_modules: List[str] = field(default_factory=lambda: [
        "q_proj", "v_proj"  # Target fewer modules on CPU
    ])
    
    # CPU-specific settings
    use_cpu: bool = True
    fp16: bool = False  # No FP16 on CPU
    bf16: bool = False  # Check CPU support
    gradient_checkpointing: bool = True  # Save memory
    
    # Dataset
    dataset_path: str = "datasets/adaptive_train.json"
    val_dataset_path: str = "datasets/adaptive_val.json"
    
    # Output
    output_dir: str = "./phi2-cpu-finetuned"
    save_steps: int = 100
    logging_steps: int = 10
    
    # Memory management
    max_memory_gb: int = 40  # Leave some RAM for system
    
    def __post_init__(self):
        """Validate CPU configuration"""
        if torch.cuda.is_available():
            logger.info("GPU detected but running in CPU mode as configured")
        
        # Check CPU features
        if hasattr(torch, 'backends') and hasattr(torch.backends, 'mkldnn'):
            if torch.backends.mkldnn.is_available():
                logger.info("✅ Intel MKL-DNN optimizations available")
        
        # Check if CPU supports bf16
        try:
            test_tensor = torch.tensor([1.0], dtype=torch.bfloat16)
            self.bf16 = True
            logger.info("✅ BF16 support detected on CPU")
        except:
            self.bf16 = False
            logger.info("❌ BF16 not supported on this CPU")


class CPUOptimizedTrainer:
    """Trainer optimized for CPU-only systems"""
    
    def __init__(self, config: CPUTrainingConfig):
        self.config = config
        self.model = None
        self.tokenizer = None
        self.train_dataset = None
        self.val_dataset = None
        
    def setup_model(self):
        """Load model optimized for CPU"""
        logger.info(f"Loading {self.config.model_name} for CPU training...")
        
        try:
            from transformers import (
                AutoModelForCausalLM, 
                AutoTokenizer,
                TrainingArguments,
                Trainer,
                DataCollatorForLanguageModeling
            )
            from peft import LoraConfig, get_peft_model, TaskType
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.config.model_name,
                trust_remote_code=True
            )
            
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load model with CPU optimizations
            model_kwargs = {
                "trust_remote_code": True,
                "device_map": "cpu",
                "torch_dtype": torch.float32,  # Full precision on CPU
                "low_cpu_mem_usage": True
            }
            
            # Try to use bf16 if supported
            if self.config.bf16:
                model_kwargs["torch_dtype"] = torch.bfloat16
                logger.info("Using BF16 precision")
            
            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                **model_kwargs
            )
            
            # Apply LoRA for memory efficiency
            if self.config.use_lora:
                logger.info("Applying LoRA configuration...")
                peft_config = LoraConfig(
                    task_type=TaskType.CAUSAL_LM,
                    r=self.config.lora_r,
                    lora_alpha=self.config.lora_alpha,
                    lora_dropout=self.config.lora_dropout,
                    target_modules=self.config.lora_target_modules,
                    bias="none"
                )
                self.model = get_peft_model(self.model, peft_config)
                self.model.print_trainable_parameters()
            
            # Enable gradient checkpointing
            if self.config.gradient_checkpointing:
                self.model.gradient_checkpointing_enable()
                logger.info("✅ Gradient checkpointing enabled")
            
            logger.info(f"✅ Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def load_datasets(self):
        """Load and prepare datasets"""
        logger.info("Loading datasets...")
        
        try:
            from datasets import Dataset
            
            # Load training data
            with open(self.config.dataset_path, 'r') as f:
                train_data = json.load(f)
            
            # Load validation data  
            with open(self.config.val_dataset_path, 'r') as f:
                val_data = json.load(f)
            
            # Format for training
            def format_example(example):
                """Format example for Phi-2"""
                if isinstance(example, dict):
                    input_text = example.get('input', '')
                    output_text = example.get('output', '')
                    text = f"Instruct: {input_text}\nOutput: {output_text}"
                else:
                    text = str(example)
                return {"text": text}
            
            # Create datasets
            train_texts = [format_example(ex) for ex in train_data]
            val_texts = [format_example(ex) for ex in val_data]
            
            self.train_dataset = Dataset.from_list(train_texts)
            self.val_dataset = Dataset.from_list(val_texts)
            
            # Tokenize datasets
            def tokenize_function(examples):
                return self.tokenizer(
                    examples["text"],
                    truncation=True,
                    padding="max_length",
                    max_length=self.config.max_seq_length
                )
            
            self.train_dataset = self.train_dataset.map(
                tokenize_function,
                batched=True,
                num_proc=4,  # Use multiple CPU cores
                remove_columns=["text"]
            )
            
            self.val_dataset = self.val_dataset.map(
                tokenize_function,
                batched=True,
                num_proc=4,
                remove_columns=["text"]
            )
            
            logger.info(f"✅ Loaded {len(self.train_dataset)} training examples")
            logger.info(f"✅ Loaded {len(self.val_dataset)} validation examples")
            
        except Exception as e:
            logger.error(f"Failed to load datasets: {e}")
            raise
    
    def train(self):
        """Run CPU-optimized training"""
        logger.info("Starting CPU-optimized training...")
        
        try:
            from transformers import (
                TrainingArguments,
                Trainer,
                DataCollatorForLanguageModeling
            )
            
            # CPU-optimized training arguments
            training_args = TrainingArguments(
                output_dir=self.config.output_dir,
                overwrite_output_dir=True,
                num_train_epochs=self.config.num_epochs,
                per_device_train_batch_size=self.config.train_batch_size,
                per_device_eval_batch_size=self.config.eval_batch_size,
                gradient_accumulation_steps=self.config.gradient_accumulation_steps,
                gradient_checkpointing=self.config.gradient_checkpointing,
                warmup_steps=50,
                logging_steps=self.config.logging_steps,
                save_steps=self.config.save_steps,
                evaluation_strategy="steps",
                eval_steps=50,
                save_total_limit=2,
                load_best_model_at_end=True,
                metric_for_best_model="eval_loss",
                greater_is_better=False,
                learning_rate=self.config.learning_rate,
                weight_decay=0.01,
                adam_epsilon=1e-8,
                max_grad_norm=1.0,
                logging_dir=f"{self.config.output_dir}/logs",
                report_to=["tensorboard"],
                dataloader_num_workers=4,  # Use multiple CPU cores
                fp16=False,  # No FP16 on CPU
                bf16=self.config.bf16,  # Use if available
                optim="adamw_torch",  # CPU-friendly optimizer
                group_by_length=True,  # Efficiency optimization
                length_column_name="input_ids_length",
                ddp_find_unused_parameters=False,
                dataloader_pin_memory=False,  # CPU doesn't benefit from pinned memory
                no_cuda=True,  # Force CPU usage
            )
            
            # Data collator
            data_collator = DataCollatorForLanguageModeling(
                tokenizer=self.tokenizer,
                mlm=False,
                pad_to_multiple_of=8  # Efficiency on CPU
            )
            
            # Initialize trainer
            trainer = Trainer(
                model=self.model,
                args=training_args,
                data_collator=data_collator,
                train_dataset=self.train_dataset,
                eval_dataset=self.val_dataset,
                tokenizer=self.tokenizer,
            )
            
            # Start training
            logger.info("🚀 Starting training...")
            train_result = trainer.train()
            
            # Save the model
            logger.info("💾 Saving model...")
            trainer.save_model()
            trainer.save_state()
            
            # Save training metrics
            with open(f"{self.config.output_dir}/training_results.json", "w") as f:
                json.dump(train_result.metrics, f, indent=2)
            
            logger.info("✅ Training completed successfully!")
            return train_result
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise
    
    def test_model(self, prompt: str):
        """Test the trained model"""
        logger.info(f"Testing with prompt: {prompt}")
        
        try:
            inputs = self.tokenizer(prompt, return_tensors="pt")
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.7,
                    do_sample=True,
                    top_p=0.95
                )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            logger.info(f"Response: {response}")
            return response
            
        except Exception as e:
            logger.error(f"Testing failed: {e}")
            return None


def main():
    """Main training pipeline"""
    logger.info("="*60)
    logger.info("CPU-OPTIMIZED PHI-2 TRAINING FOR EMAIL ANALYSIS")
    logger.info("="*60)
    
    # Check system
    logger.info(f"Python: {sys.version}")
    logger.info(f"PyTorch: {torch.__version__}")
    logger.info(f"CPU cores: {os.cpu_count()}")
    logger.info(f"Available threads: {torch.get_num_threads()}")
    
    # Initialize configuration
    config = CPUTrainingConfig()
    
    # Initialize trainer
    trainer = CPUOptimizedTrainer(config)
    
    try:
        # Setup
        trainer.setup_model()
        trainer.load_datasets()
        
        # Train
        result = trainer.train()
        
        # Test
        test_prompt = "Instruct: Analyze this email for key action items.\nOutput:"
        trainer.test_model(test_prompt)
        
        logger.info("🎉 Training pipeline completed successfully!")
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()