#!/usr/bin/env python3
"""
Stable Transformers-based Fine-tuning for Llama 3.2:3B
Alternative to llama.cpp with better stability and memory management
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
    DataCollatorForLanguageModeling,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
from datasets import Dataset
import multiprocessing
from datetime import datetime
from pathlib import Path
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Optimize for CPU training
torch.set_num_threads(multiprocessing.cpu_count())
os.environ["OMP_NUM_THREADS"] = str(multiprocessing.cpu_count())
os.environ["MKL_NUM_THREADS"] = str(multiprocessing.cpu_count())

class StableTransformersConfig:
    """Configuration optimized for AMD Ryzen 7 with 64GB RAM"""
    
    def __init__(self):
        # Model configuration
        self.model_name = "meta-llama/Llama-3.2-3B-Instruct"
        self.dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
        self.output_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/transformers-output"
        
        # Training parameters optimized for stability
        self.learning_rate = 2e-4           # Standard LoRA learning rate
        self.batch_size = 1                 # Small for CPU training
        self.gradient_accumulation_steps = 8  # Simulate larger batch
        self.num_epochs = 1                 # Single epoch for testing
        self.max_seq_length = 1024          # Manageable sequence length
        self.warmup_steps = 100
        
        # LoRA configuration for memory efficiency
        self.lora_r = 16
        self.lora_alpha = 32
        self.lora_dropout = 0.1
        self.lora_target_modules = ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
        
        # Memory optimization
        self.use_8bit = True                # Use 8-bit quantization
        self.max_memory = {0: "32GB"}       # Reserve memory
        self.dataloader_num_workers = min(4, multiprocessing.cpu_count() // 2)

class BusinessIntelligenceDataProcessor:
    """Process the business intelligence dataset for training"""
    
    def __init__(self, config: StableTransformersConfig):
        self.config = config
        self.tokenizer = None
        
    def load_tokenizer(self):
        """Load and configure tokenizer"""
        logger.info("Loading tokenizer...")
        
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
    
    def load_and_process_dataset(self, max_examples=1000):
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
        """Format conversation for Llama 3.2 chat template"""
        try:
            messages = example["messages"]
            user_content = messages[0]["content"]
            assistant_content = messages[1]["content"]
            
            # Truncate if too long
            if len(user_content) > 2000:
                user_content = user_content[:2000] + "..."
            if len(assistant_content) > 2000:
                assistant_content = assistant_content[:2000] + "..."
            
            # Format for Llama 3.2 chat template
            formatted_text = self.tokenizer.apply_chat_template(
                [
                    {"role": "user", "content": user_content},
                    {"role": "assistant", "content": assistant_content}
                ],
                tokenize=False
            )
            
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

class StableTransformersFinetuner:
    """Main fine-tuning class using Transformers + LoRA"""
    
    def __init__(self, config: StableTransformersConfig):
        self.config = config
        self.processor = BusinessIntelligenceDataProcessor(config)
        self.model = None
        self.tokenizer = None
        
    def prepare_model(self):
        """Load and prepare model for LoRA fine-tuning"""
        logger.info("Loading model...")
        
        try:
            # Quantization config for memory efficiency
            bnb_config = BitsAndBytesConfig(
                load_in_8bit=self.config.use_8bit,
                bnb_8bit_quant_type="nf4",
                bnb_8bit_compute_dtype=torch.float16,
                bnb_8bit_use_double_quant=True,
            )
            
            # Load model
            self.model = AutoModelForCausalLM.from_pretrained(
                self.config.model_name,
                quantization_config=bnb_config,
                device_map="cpu",  # Force CPU
                torch_dtype=torch.float16,
                trust_remote_code=True,
                max_memory=self.config.max_memory
            )
            
            # Prepare for k-bit training
            self.model = prepare_model_for_kbit_training(self.model)
            
            # LoRA configuration
            peft_config = LoraConfig(
                task_type=TaskType.CAUSAL_LM,
                inference_mode=False,
                r=self.config.lora_r,
                lora_alpha=self.config.lora_alpha,
                lora_dropout=self.config.lora_dropout,
                target_modules=self.config.lora_target_modules,
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
        logger.info("🚀 Starting Stable Transformers Fine-tuning")
        
        try:
            # Step 1: Load tokenizer
            if not self.processor.load_tokenizer():
                return False
            self.tokenizer = self.processor.tokenizer
            
            # Step 2: Prepare model
            if not self.prepare_model():
                return False
            
            # Step 3: Load and process dataset
            dataset = self.processor.load_and_process_dataset(max_examples=500)  # Start small
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
                logging_steps=10,
                save_steps=100,
                eval_steps=50,
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
            test_prompt = """<|begin_of_text|><|start_header_id|>user<|end_header_id|>

Analyze this business intelligence from the following emails:

EMAIL 1:
Subject: Quarterly Sales Review
From: sales@company.com
Body: Q3 revenue exceeded targets by 15%. Key accounts driving growth.

Please provide insights:<|eot_id|><|start_header_id|>assistant<|end_header_id|>

"""
            
            inputs = self.tokenizer(test_prompt, return_tensors="pt")
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=100,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=self.tokenizer.pad_token_id
                )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            logger.info("✅ Inference test successful!")
            logger.info(f"Sample output: {response[-200:]}")  # Last 200 chars
            
        except Exception as e:
            logger.warning(f"Inference test failed: {e}")

def main():
    """Main execution function"""
    config = StableTransformersConfig()
    
    logger.info("🚀 Starting Stable Transformers Fine-tuning Pipeline")
    logger.info(f"Model: {config.model_name}")
    logger.info(f"Dataset: Business Intelligence (500 examples)")
    logger.info(f"CPU Threads: {multiprocessing.cpu_count()}")
    logger.info(f"Output: {config.output_dir}")
    
    # Create output directory
    Path(config.output_dir).mkdir(parents=True, exist_ok=True)
    
    # Run fine-tuning
    finetuner = StableTransformersFinetuner(config)
    
    try:
        success = finetuner.run_finetuning()
        
        if success:
            logger.info("🎉 Fine-tuning pipeline completed successfully!")
            logger.info(f"📁 Model saved to: {config.output_dir}")
            logger.info("📊 Next: Convert to GGUF format for production use")
        else:
            logger.error("❌ Fine-tuning pipeline failed")
            
    except KeyboardInterrupt:
        logger.info("⏸️ Fine-tuning interrupted by user")
    except Exception as e:
        logger.error(f"❌ Pipeline error: {e}")

if __name__ == "__main__":
    main()