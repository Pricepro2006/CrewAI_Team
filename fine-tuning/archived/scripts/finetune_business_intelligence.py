#!/usr/bin/env python3
"""
Business Intelligence Fine-Tuning Script
Fine-tunes Llama 3.2:3b on high-quality business intelligence patterns
"""

import os
import json
import torch
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    EarlyStoppingCallback
)
from datasets import Dataset
from peft import LoraConfig, get_peft_model, TaskType
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass 
class TrainingConfig:
    """Training configuration"""
    model_name: str = "meta-llama/Llama-3.2-3B-Instruct"
    max_length: int = 2048
    learning_rate: float = 2e-5  # Reduced from previous runs
    batch_size: int = 2
    gradient_accumulation_steps: int = 4
    num_epochs: int = 5  # Increased from 3
    warmup_steps: int = 100
    save_steps: int = 50
    eval_steps: int = 25
    logging_steps: int = 10
    
    # LoRA Configuration
    lora_r: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.1
    
    # Early stopping
    early_stopping_patience: int = 3
    early_stopping_threshold: float = 0.01

class BusinessIntelligenceTrainer:
    def __init__(self, config: TrainingConfig):
        self.config = config
        self.model_dir = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/models")
        self.data_dir = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset")
        self.output_dir = self.model_dir / "llama32_3b_business_intelligence"
        
        # Create directories
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize model and tokenizer
        self.tokenizer = None
        self.model = None
        
    def load_model_and_tokenizer(self):
        """Load model and tokenizer with optimizations"""
        logger.info(f"Loading model: {self.config.model_name}")
        
        try:
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.config.model_name,
                trust_remote_code=True,
                use_fast=True
            )
            
            # Add padding token if not present
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
                self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
            
            # Load model with CPU fallback
            device_map = "auto" if torch.cuda.is_available() else None
            torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
            
            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                torch_dtype=torch_dtype,
                device_map=device_map,
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
            
            # Apply LoRA
            lora_config = LoraConfig(
                task_type=TaskType.CAUSAL_LM,
                inference_mode=False,
                r=self.config.lora_r,
                lora_alpha=self.config.lora_alpha,
                lora_dropout=self.config.lora_dropout,
                target_modules=["q_proj", "v_proj", "k_proj", "o_proj", 
                               "gate_proj", "up_proj", "down_proj"]
            )
            
            self.model = get_peft_model(self.model, lora_config)
            self.model.print_trainable_parameters()
            
            logger.info("Model and tokenizer loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    def load_dataset(self) -> Dataset:
        """Load the business intelligence dataset"""
        logger.info("Loading business intelligence dataset...")
        
        dataset_path = self.data_dir / "business_intelligence_training.jsonl"
        
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset not found at {dataset_path}")
        
        # Load examples
        examples = []
        with open(dataset_path, 'r') as f:
            for line in f:
                example = json.loads(line.strip())
                examples.append(example)
        
        logger.info(f"Loaded {len(examples)} training examples")
        
        # Create dataset
        dataset = Dataset.from_list(examples)
        
        # Split into train/validation (90/10)
        dataset = dataset.train_test_split(test_size=0.1, seed=42)
        
        logger.info(f"Training examples: {len(dataset['train'])}")
        logger.info(f"Validation examples: {len(dataset['test'])}")
        
        return dataset
    
    def preprocess_function(self, examples):
        """Preprocess examples for training"""
        # Format as conversation
        inputs = []
        for prompt, completion in zip(examples["prompt"], examples["completion"]):
            # Format as instruction-following conversation
            conversation = f"""<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are a business intelligence analyst specializing in TD SYNNEX email workflow analysis. Provide comprehensive, structured analysis of business communications including workflow states, entity extraction, process analysis, and efficiency insights.<|eot_id|><|start_header_id|>user<|end_header_id|>

{prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

{completion}<|eot_id|>"""
            
            inputs.append(conversation)
        
        # Tokenize
        model_inputs = self.tokenizer(
            inputs,
            max_length=self.config.max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt"
        )
        
        # Set labels (copy of input_ids for causal LM)
        model_inputs["labels"] = model_inputs["input_ids"].clone()
        
        return model_inputs
    
    def compute_metrics(self, eval_preds):
        """Compute evaluation metrics"""
        predictions, labels = eval_preds
        
        # Calculate perplexity
        # predictions are logits, we need to compute loss
        shift_predictions = predictions[..., :-1, :].contiguous()
        shift_labels = labels[..., 1:].contiguous()
        
        # Flatten
        shift_predictions = shift_predictions.view(-1, shift_predictions.size(-1))
        shift_labels = shift_labels.view(-1)
        
        # Calculate loss (simplified)
        import torch.nn.functional as F
        loss = F.cross_entropy(
            shift_predictions, 
            shift_labels, 
            ignore_index=self.tokenizer.pad_token_id,
            reduction='mean'
        )
        
        try:
            perplexity = torch.exp(loss)
        except OverflowError:
            perplexity = float("inf")
        
        return {
            "perplexity": perplexity.item(),
            "eval_loss": loss.item()
        }
    
    def setup_training_args(self) -> TrainingArguments:
        """Setup training arguments"""
        return TrainingArguments(
            output_dir=str(self.output_dir),
            overwrite_output_dir=True,
            
            # Training parameters
            num_train_epochs=self.config.num_epochs,
            per_device_train_batch_size=self.config.batch_size,
            per_device_eval_batch_size=self.config.batch_size,
            gradient_accumulation_steps=self.config.gradient_accumulation_steps,
            learning_rate=self.config.learning_rate,
            weight_decay=0.01,
            warmup_steps=self.config.warmup_steps,
            
            # Logging and saving
            logging_steps=self.config.logging_steps,
            save_steps=self.config.save_steps,
            eval_steps=self.config.eval_steps,
            save_total_limit=3,
            
            # Evaluation
            evaluation_strategy="steps",
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,
            
            # Memory optimization
            fp16=torch.cuda.is_available(),
            dataloader_pin_memory=False,
            remove_unused_columns=True,
            
            # Reproducibility
            seed=42,
            data_seed=42,
            
            # Reporting
            report_to=None,  # Disable wandb/tensorboard
            run_name=f"business_intelligence_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
    
    def train(self):
        """Run the training process"""
        logger.info("Starting Business Intelligence Fine-tuning...")
        
        # Load model and tokenizer
        self.load_model_and_tokenizer()
        
        # Load dataset
        dataset = self.load_dataset()
        
        # Preprocess dataset
        logger.info("Preprocessing dataset...")
        train_dataset = dataset["train"].map(
            self.preprocess_function,
            batched=True,
            remove_columns=dataset["train"].column_names
        )
        
        eval_dataset = dataset["test"].map(
            self.preprocess_function,
            batched=True,
            remove_columns=dataset["test"].column_names
        )
        
        # Setup training arguments
        training_args = self.setup_training_args()
        
        # Create data collator
        data_collator = DataCollatorForLanguageModeling(
            tokenizer=self.tokenizer,
            mlm=False,  # Causal LM, not masked LM
        )
        
        # Create trainer
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            data_collator=data_collator,
            compute_metrics=self.compute_metrics,
            callbacks=[
                EarlyStoppingCallback(
                    early_stopping_patience=self.config.early_stopping_patience,
                    early_stopping_threshold=self.config.early_stopping_threshold
                )
            ]
        )
        
        # Training
        logger.info("Starting training...")
        start_time = datetime.now()
        
        try:
            trainer.train()
            
            # Save final model
            trainer.save_model()
            self.tokenizer.save_pretrained(self.output_dir)
            
            training_time = datetime.now() - start_time
            logger.info(f"Training completed in {training_time}")
            
            # Save training log
            self.save_training_log(trainer, training_time)
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            raise
    
    def save_training_log(self, trainer, training_time):
        """Save training log and statistics"""
        log_data = {
            "training_time": str(training_time),
            "final_train_loss": trainer.state.log_history[-1].get("train_loss", None),
            "final_eval_loss": trainer.state.log_history[-1].get("eval_loss", None),
            "total_steps": trainer.state.global_step,
            "config": {
                "learning_rate": self.config.learning_rate,
                "batch_size": self.config.batch_size,
                "num_epochs": self.config.num_epochs,
                "lora_r": self.config.lora_r,
                "lora_alpha": self.config.lora_alpha
            },
            "model_info": {
                "base_model": self.config.model_name,
                "output_dir": str(self.output_dir),
                "trained_at": datetime.now().isoformat()
            }
        }
        
        log_path = self.output_dir / "training_log.json"
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)
        
        logger.info(f"Training log saved to {log_path}")
        
        # Print summary
        print("\n" + "="*60)
        print("BUSINESS INTELLIGENCE FINE-TUNING COMPLETED")
        print("="*60)
        print(f"Training Time: {training_time}")
        print(f"Final Train Loss: {log_data.get('final_train_loss', 'N/A')}")
        print(f"Final Eval Loss: {log_data.get('final_eval_loss', 'N/A')}")
        print(f"Total Steps: {log_data['total_steps']}")
        print(f"Model saved to: {self.output_dir}")
        print("="*60)

def main():
    """Main entry point"""
    # Check for required dataset
    data_dir = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset")
    dataset_path = data_dir / "business_intelligence_training.jsonl"
    
    if not dataset_path.exists():
        print("Error: Business Intelligence dataset not found!")
        print("Please run create_business_intelligence_dataset.py first")
        return
    
    # Create config
    config = TrainingConfig()
    
    # Create trainer and run
    trainer = BusinessIntelligenceTrainer(config)
    trainer.train()

if __name__ == "__main__":
    main()