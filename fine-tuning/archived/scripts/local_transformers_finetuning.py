#!/usr/bin/env python3
"""
Local Transformers Fine-tuning for Business Intelligence
Uses alternative models that don't require authentication
"""

import os
import json
import torch
import logging
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import Dataset
import multiprocessing
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Optimize for CPU training
torch.set_num_threads(multiprocessing.cpu_count())
os.environ["OMP_NUM_THREADS"] = str(multiprocessing.cpu_count())
os.environ["MKL_NUM_THREADS"] = str(multiprocessing.cpu_count())

class LocalTransformersConfig:
    """Configuration for local Transformers fine-tuning"""
    
    def __init__(self):
        # Use open-source models that don't require authentication
        self.model_options = [
            "microsoft/DialoGPT-medium",           # 354M - good for testing
            "microsoft/DialoGPT-large",            # 762M - more capable
            "facebook/opt-1.3b",                   # 1.3B - good balance
            "EleutherAI/gpt-neo-1.3B"             # 1.3B - alternative
        ]
        
        self.model_name = "microsoft/DialoGPT-medium"  # Start with smallest for testing
        self.dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
        self.output_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/local-transformers-output"
        
        # Training parameters optimized for CPU
        self.learning_rate = 2e-4
        self.batch_size = 1
        self.gradient_accumulation_steps = 8
        self.num_epochs = 1
        self.max_seq_length = 1024
        self.warmup_steps = 50
        
        # LoRA configuration
        self.lora_r = 16
        self.lora_alpha = 32
        self.lora_dropout = 0.1
        self.lora_target_modules = ["c_attn", "c_proj"]  # DialoGPT specific
        
        # Memory optimization
        self.dataloader_num_workers = 2

class LocalBusinessDataProcessor:
    """Process business intelligence data for local models"""
    
    def __init__(self, config: LocalTransformersConfig):
        self.config = config
        self.tokenizer = None
        
    def load_tokenizer(self):
        """Load and configure tokenizer"""
        logger.info(f"Loading tokenizer: {self.config.model_name}")
        
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.config.model_name,
                trust_remote_code=True,
                use_fast=True
            )
            
            # Add padding token if needed
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
                self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
            
            logger.info(f"✅ Tokenizer loaded: {len(self.tokenizer)} vocab size")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load tokenizer: {e}")
            return False
    
    def load_and_process_dataset(self, max_examples=500):
        """Load and process the JSONL dataset"""
        logger.info(f"Loading dataset: {self.config.dataset_path}")
        
        try:
            data = []
            with open(self.config.dataset_path, 'r') as f:
                for i, line in enumerate(f):
                    if max_examples and i >= max_examples:
                        logger.info(f"Limited to {max_examples} examples for testing")
                        break
                    
                    if i % 100 == 0:
                        logger.info(f"Processing example {i}...")
                    
                    try:
                        example = json.loads(line)
                        formatted = self.format_conversation(example)
                        if formatted:
                            data.append(formatted)
                    except json.JSONDecodeError:
                        continue
            
            logger.info(f"✅ Loaded {len(data)} valid examples")
            
            # Create dataset
            dataset = Dataset.from_list(data)
            
            # Tokenize
            logger.info("Tokenizing dataset...")
            tokenized_dataset = dataset.map(
                self.tokenize_function,
                batched=True,
                remove_columns=dataset.column_names,
                desc="Tokenizing"
            )
            
            return tokenized_dataset
            
        except Exception as e:
            logger.error(f"❌ Dataset processing failed: {e}")
            return None
    
    def format_conversation(self, example):
        """Format conversation for DialoGPT style"""
        try:
            messages = example["messages"]
            user_content = messages[0]["content"]
            assistant_content = messages[1]["content"]
            
            # Truncate if too long
            if len(user_content) > 1500:
                user_content = user_content[:1500] + "..."
            if len(assistant_content) > 1500:
                assistant_content = assistant_content[:1500] + "..."
            
            # Simple format for DialoGPT
            formatted_text = f"Human: {user_content}\n\nAssistant: {assistant_content}{self.tokenizer.eos_token}"
            
            return {"text": formatted_text}
            
        except Exception as e:
            logger.warning(f"Failed to format example: {e}")
            return None
    
    def tokenize_function(self, examples):
        """Tokenize the examples"""
        return self.tokenizer(
            examples['text'],
            truncation=True,
            max_length=self.config.max_seq_length,
            padding="max_length"
        )

class LocalTransformersFinetuner:
    """Main fine-tuning class for local models"""
    
    def __init__(self, config: LocalTransformersConfig):
        self.config = config
        self.processor = LocalBusinessDataProcessor(config)
        self.model = None
        self.tokenizer = None
        
    def prepare_model(self):
        """Load and prepare model for LoRA fine-tuning"""
        logger.info(f"Loading model: {self.config.model_name}")
        
        try:
            # Load model
            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                device_map="cpu",
                torch_dtype=torch.float32,  # Use FP32 for CPU
                trust_remote_code=True
            )
            
            # LoRA configuration - adjust target modules based on model
            if "DialoGPT" in self.config.model_name:
                target_modules = ["c_attn", "c_proj"]
            elif "opt" in self.config.model_name:
                target_modules = ["q_proj", "v_proj", "k_proj", "out_proj"]
            elif "gpt-neo" in self.config.model_name:
                target_modules = ["c_attn", "c_proj"]
            else:
                target_modules = ["c_attn", "c_proj"]  # Default
            
            peft_config = LoraConfig(
                task_type=TaskType.CAUSAL_LM,
                inference_mode=False,
                r=self.config.lora_r,
                lora_alpha=self.config.lora_alpha,
                lora_dropout=self.config.lora_dropout,
                target_modules=target_modules,
                bias="none"
            )
            
            # Apply LoRA
            self.model = get_peft_model(self.model, peft_config)
            self.model.print_trainable_parameters()
            
            logger.info("✅ Model prepared with LoRA")
            return True
            
        except Exception as e:
            logger.error(f"❌ Model preparation failed: {e}")
            return False
    
    def run_finetuning(self):
        """Execute the complete fine-tuning pipeline"""
        logger.info("🚀 Starting Local Transformers Fine-tuning")
        
        try:
            # Step 1: Load tokenizer
            if not self.processor.load_tokenizer():
                return False
            self.tokenizer = self.processor.tokenizer
            
            # Step 2: Prepare model
            if not self.prepare_model():
                return False
            
            # Step 3: Load and process dataset
            dataset = self.processor.load_and_process_dataset(max_examples=300)  # Small subset
            if dataset is None:
                return False
            
            # Step 4: Split dataset
            train_size = int(0.9 * len(dataset))
            train_dataset = dataset.select(range(train_size))
            eval_dataset = dataset.select(range(train_size, len(dataset)))
            
            logger.info(f"Train size: {len(train_dataset)}, Eval size: {len(eval_dataset)}")
            
            # Step 5: Data collator
            data_collator = DataCollatorForLanguageModeling(
                tokenizer=self.tokenizer,
                mlm=False
            )
            
            # Step 6: Training arguments
            training_args = TrainingArguments(
                output_dir=self.config.output_dir,
                num_train_epochs=self.config.num_epochs,
                per_device_train_batch_size=self.config.batch_size,
                per_device_eval_batch_size=self.config.batch_size,
                gradient_accumulation_steps=self.config.gradient_accumulation_steps,
                warmup_steps=self.config.warmup_steps,
                learning_rate=self.config.learning_rate,
                logging_steps=5,
                save_steps=50,
                eval_steps=25,
                evaluation_strategy="steps",
                save_strategy="steps",
                load_best_model_at_end=True,
                fp16=False,  # Disable for CPU
                dataloader_num_workers=self.config.dataloader_num_workers,
                remove_unused_columns=False,
                report_to=None,  # Disable wandb
                optim="adamw_torch"
            )
            
            # Step 7: Initialize trainer
            trainer = Trainer(
                model=self.model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                tokenizer=self.tokenizer,
                data_collator=data_collator
            )
            
            # Step 8: Start training
            logger.info("🏃 Starting training...")
            start_time = datetime.now()
            
            trainer.train()
            
            end_time = datetime.now()
            training_time = end_time - start_time
            logger.info(f"✅ Training completed in {training_time}")
            
            # Step 9: Save model
            logger.info("💾 Saving model...")
            trainer.save_model()
            self.tokenizer.save_pretrained(self.config.output_dir)
            
            # Step 10: Test inference
            self.test_inference()
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Fine-tuning failed: {e}")
            return False
    
    def test_inference(self):
        """Quick inference test"""
        logger.info("🧪 Testing inference...")
        
        try:
            test_prompt = """Human: Analyze the business intelligence from this email:

Subject: Q3 Revenue Update
From: sales@company.com
Body: Q3 revenue exceeded expectations by 12%. Key growth drivers include enterprise accounts and new product launches.

Please provide insights: