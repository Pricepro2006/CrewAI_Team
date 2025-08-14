#!/usr/bin/env python3
"""
Production 7.5-Hour Fine-tuning for Llama 3.2:3B using Unsloth
Optimized for AMD Ryzen 7 7840H with 64GB RAM
Uses the full 2,351 business intelligence examples dataset
"""

import os
import json
import torch
import logging
from pathlib import Path
from datetime import datetime, timedelta
import subprocess
import sys
import time
import signal
import gc
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/production_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ProductionUnslothFinetuner:
    """Production-grade 7.5 hour fine-tuning using Unsloth"""
    
    def __init__(self):
        self.base_model = "unsloth/llama-3.2-3b-instruct-bnb-4bit"
        self.dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
        self.output_dir = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/production-7hour-output")
        self.output_dir.mkdir(exist_ok=True)
        
        # System configuration
        self.system_config = {
            "cpu_cores": 16,
            "ram_gb": 64,
            "cpu_model": "AMD Ryzen 7 7840H",
            "training_duration_hours": 7.5
        }
        
        # Optimized training parameters for 7.5 hour session
        self.training_config = {
            "max_seq_length": 2048,
            "batch_size": 4,
            "gradient_accumulation_steps": 4,
            "learning_rate": 2e-4,
            "warmup_ratio": 0.03,
            "num_train_epochs": 3,  # Will be adjusted based on time
            "lora_r": 16,
            "lora_alpha": 16,
            "lora_dropout": 0.05,
            "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", 
                             "gate_proj", "up_proj", "down_proj"],
            "save_steps": 100,
            "logging_steps": 10,
            "eval_steps": 50,
            "gradient_checkpointing": True,
            "optim": "adamw_8bit",
            "lr_scheduler_type": "cosine",
            "seed": 42
        }
        
        self.start_time = None
        self.model = None
        self.tokenizer = None
        self.trainer = None
        
    def install_unsloth(self):
        """Install Unsloth if not already installed"""
        logger.info("Checking Unsloth installation...")
        
        try:
            import unsloth
            logger.info("✅ Unsloth already installed")
            return True
        except ImportError:
            logger.info("Installing Unsloth...")
            
            commands = [
                ["pip", "install", "--upgrade", "pip"],
                ["pip", "install", "unsloth[colab-new]", "-q"],
                ["pip", "install", "--no-deps", "trl", "peft", "accelerate", "bitsandbytes"]
            ]
            
            for cmd in commands:
                try:
                    logger.info(f"Running: {' '.join(cmd)}")
                    subprocess.run(cmd, check=True, capture_output=True, text=True)
                except subprocess.CalledProcessError as e:
                    logger.error(f"Installation failed: {e}")
                    return False
            
            # Verify installation
            try:
                import unsloth
                logger.info("✅ Unsloth installed successfully")
                return True
            except ImportError:
                logger.error("❌ Unsloth installation verification failed")
                return False
    
    def load_model_and_tokenizer(self):
        """Load Llama 3.2:3B with Unsloth optimizations"""
        logger.info("Loading Llama 3.2:3B with Unsloth...")
        
        try:
            from unsloth import FastLanguageModel
            
            # Load 4-bit quantized model
            self.model, self.tokenizer = FastLanguageModel.from_pretrained(
                model_name=self.base_model,
                max_seq_length=self.training_config["max_seq_length"],
                dtype=None,  # Auto-detect
                load_in_4bit=True,
            )
            
            # Add LoRA adapters
            self.model = FastLanguageModel.get_peft_model(
                self.model,
                r=self.training_config["lora_r"],
                target_modules=self.training_config["target_modules"],
                lora_alpha=self.training_config["lora_alpha"],
                lora_dropout=self.training_config["lora_dropout"],
                bias="none",
                use_gradient_checkpointing=self.training_config["gradient_checkpointing"],
                random_state=self.training_config["seed"],
                use_rslora=False,
                loftq_config=None,
            )
            
            logger.info("✅ Model and tokenizer loaded successfully")
            self.log_model_info()
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            # Fallback to manual download and setup
            return self.fallback_model_setup()
    
    def fallback_model_setup(self):
        """Fallback method using transformers directly"""
        logger.info("Using fallback model setup with transformers...")
        
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
            from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
            
            # Quantization config
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16
            )
            
            # Load model
            model_name = "meta-llama/Llama-3.2-3B-Instruct"
            
            # Try local path first
            local_model_path = "/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct"
            if Path(local_model_path).exists():
                model_name = local_model_path
                logger.info(f"Using local model: {model_name}")
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True,
                use_fast=True
            )
            
            # Add padding token
            self.tokenizer.pad_token = self.tokenizer.eos_token
            self.tokenizer.padding_side = "right"
            
            self.model = AutoModelForCausalLM.from_pretrained(
                model_name,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True
            )
            
            # Prepare for k-bit training
            self.model = prepare_model_for_kbit_training(self.model)
            
            # Add LoRA
            lora_config = LoraConfig(
                r=self.training_config["lora_r"],
                lora_alpha=self.training_config["lora_alpha"],
                target_modules=self.training_config["target_modules"],
                lora_dropout=self.training_config["lora_dropout"],
                bias="none",
                task_type="CAUSAL_LM"
            )
            
            self.model = get_peft_model(self.model, lora_config)
            
            logger.info("✅ Fallback model setup successful")
            self.log_model_info()
            return True
            
        except Exception as e:
            logger.error(f"❌ Fallback setup failed: {e}")
            return False
    
    def log_model_info(self):
        """Log model information"""
        if self.model:
            trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            total_params = sum(p.numel() for p in self.model.parameters())
            
            logger.info(f"Model info:")
            logger.info(f"  Total parameters: {total_params:,}")
            logger.info(f"  Trainable parameters: {trainable_params:,}")
            logger.info(f"  Trainable %: {100 * trainable_params / total_params:.2f}%")
    
    def load_and_prepare_dataset(self):
        """Load the full 2,351 example dataset"""
        logger.info(f"Loading dataset from {self.dataset_path}")
        
        try:
            examples = []
            with open(self.dataset_path, 'r') as f:
                for i, line in enumerate(f):
                    try:
                        data = json.loads(line)
                        examples.append(data)
                        
                        if (i + 1) % 500 == 0:
                            logger.info(f"Loaded {i + 1} examples...")
                    except json.JSONDecodeError:
                        logger.warning(f"Skipping invalid JSON at line {i + 1}")
                        continue
            
            logger.info(f"✅ Loaded {len(examples)} examples")
            
            # Format for training
            formatted_examples = self.format_examples(examples)
            
            # Create train/eval split
            split_idx = int(0.95 * len(formatted_examples))
            train_data = formatted_examples[:split_idx]
            eval_data = formatted_examples[split_idx:]
            
            logger.info(f"Train examples: {len(train_data)}")
            logger.info(f"Eval examples: {len(eval_data)}")
            
            return train_data, eval_data
            
        except Exception as e:
            logger.error(f"❌ Dataset loading failed: {e}")
            return None, None
    
    def format_examples(self, examples):
        """Format examples for Llama 3.2 instruction format"""
        formatted = []
        
        alpaca_prompt = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
{}

### Input:
{}

### Response:
{}"""
        
        for ex in examples:
            try:
                messages = ex["messages"]
                user_msg = messages[0]["content"]
                assistant_msg = messages[1]["content"]
                
                # Create instruction-style format
                instruction = "Analyze the following business emails and provide comprehensive business intelligence insights."
                
                formatted_text = alpaca_prompt.format(
                    instruction,
                    user_msg,
                    assistant_msg
                )
                
                formatted.append({"text": formatted_text})
                
            except Exception as e:
                logger.warning(f"Failed to format example: {e}")
                continue
        
        return formatted
    
    def calculate_training_steps(self, num_examples):
        """Calculate training steps for 7.5 hour duration"""
        batch_size = self.training_config["batch_size"]
        gradient_accumulation = self.training_config["gradient_accumulation_steps"]
        effective_batch_size = batch_size * gradient_accumulation
        
        # Estimate time per step (conservative estimate)
        seconds_per_step = 2.5  # Adjust based on your hardware
        
        # Total available seconds (7.5 hours minus overhead)
        total_seconds = 7.5 * 3600 - 600  # Reserve 10 minutes for setup/teardown
        
        # Calculate maximum steps
        max_steps = int(total_seconds / seconds_per_step)
        
        # Calculate steps per epoch
        steps_per_epoch = num_examples // effective_batch_size
        
        # Calculate number of epochs that fit in time
        max_epochs = max_steps // steps_per_epoch
        
        # Ensure at least 1 epoch, max 5 epochs
        num_epochs = max(1, min(5, max_epochs))
        
        logger.info(f"Training calculation:")
        logger.info(f"  Effective batch size: {effective_batch_size}")
        logger.info(f"  Steps per epoch: {steps_per_epoch}")
        logger.info(f"  Max steps in 7.5 hours: {max_steps}")
        logger.info(f"  Planned epochs: {num_epochs}")
        logger.info(f"  Total steps: {num_epochs * steps_per_epoch}")
        
        return num_epochs, max_steps
    
    def setup_trainer(self, train_data, eval_data):
        """Setup the training with SFTTrainer"""
        logger.info("Setting up trainer...")
        
        try:
            from trl import SFTTrainer
            from transformers import TrainingArguments
            from datasets import Dataset
            
            # Convert to Dataset format
            train_dataset = Dataset.from_list(train_data)
            eval_dataset = Dataset.from_list(eval_data)
            
            # Calculate training duration
            num_epochs, max_steps = self.calculate_training_steps(len(train_data))
            self.training_config["num_train_epochs"] = num_epochs
            
            # Training arguments
            training_args = TrainingArguments(
                output_dir=str(self.output_dir),
                num_train_epochs=num_epochs,
                per_device_train_batch_size=self.training_config["batch_size"],
                per_device_eval_batch_size=self.training_config["batch_size"],
                gradient_accumulation_steps=self.training_config["gradient_accumulation_steps"],
                learning_rate=self.training_config["learning_rate"],
                warmup_ratio=self.training_config["warmup_ratio"],
                logging_steps=self.training_config["logging_steps"],
                save_steps=self.training_config["save_steps"],
                eval_steps=self.training_config["eval_steps"],
                evaluation_strategy="steps",
                save_strategy="steps",
                load_best_model_at_end=True,
                save_total_limit=3,
                fp16=not torch.cuda.is_available(),  # FP16 only if no GPU
                bf16=False,
                optim=self.training_config["optim"],
                lr_scheduler_type=self.training_config["lr_scheduler_type"],
                seed=self.training_config["seed"],
                report_to="none",
                max_steps=max_steps if max_steps < num_epochs * len(train_data) // self.training_config["batch_size"] else -1,
                dataloader_num_workers=4,
                remove_unused_columns=True,
                label_names=["labels"]
            )
            
            # Initialize trainer
            self.trainer = SFTTrainer(
                model=self.model,
                tokenizer=self.tokenizer,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                dataset_text_field="text",
                max_seq_length=self.training_config["max_seq_length"],
                packing=False,
                args=training_args
            )
            
            logger.info("✅ Trainer setup complete")
            return True
            
        except Exception as e:
            logger.error(f"❌ Trainer setup failed: {e}")
            return False
    
    def run_training(self):
        """Execute the 7.5 hour training session"""
        logger.info("🚀 Starting 7.5 hour production training session")
        self.start_time = datetime.now()
        
        # Setup signal handler for graceful interruption
        def signal_handler(signum, frame):
            logger.info("⚠️ Training interrupted, saving checkpoint...")
            if self.trainer:
                self.trainer.save_model(str(self.output_dir / "interrupted_checkpoint"))
            logger.info("Checkpoint saved, exiting...")
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        
        try:
            # Start training
            logger.info("📊 Training started at: {}".format(self.start_time))
            logger.info("📊 Expected completion: {}".format(
                self.start_time + timedelta(hours=self.training_config["training_duration_hours"])
            ))
            
            # Train
            train_result = self.trainer.train()
            
            # Save final model
            logger.info("💾 Saving final model...")
            self.trainer.save_model()
            
            # Log metrics
            metrics = train_result.metrics
            self.trainer.log_metrics("train", metrics)
            self.trainer.save_metrics("train", metrics)
            
            # Calculate actual training time
            end_time = datetime.now()
            training_duration = end_time - self.start_time
            
            logger.info(f"✅ Training completed successfully!")
            logger.info(f"⏱️ Total training time: {training_duration}")
            logger.info(f"📊 Final loss: {metrics.get('train_loss', 'N/A')}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Training failed: {e}")
            
            # Save checkpoint on failure
            if self.trainer:
                checkpoint_path = str(self.output_dir / "error_checkpoint")
                self.trainer.save_model(checkpoint_path)
                logger.info(f"💾 Error checkpoint saved to: {checkpoint_path}")
            
            return False
    
    def test_fine_tuned_model(self):
        """Test the fine-tuned model"""
        logger.info("🧪 Testing fine-tuned model...")
        
        try:
            # Test prompt
            test_input = """Below is an instruction that describes a task, paired with an input that provides further context. Write a response that appropriately completes the request.

### Instruction:
Analyze the following business emails and provide comprehensive business intelligence insights.

### Input:
Email batch for analysis:
Subject: Q4 2024 Revenue Projections
From: cfo@techcorp.com
Date: 2024-10-15
Body: Based on current pipeline analysis and market conditions, we're projecting Q4 revenue of $12.5M, representing a 23% YoY growth. Key drivers include the enterprise expansion in APAC region and successful launch of our AI-powered analytics suite. However, we need to monitor the competitive pressure from NewCorp's recent pricing changes.

### Response:"""
            
            # Generate response
            if hasattr(self, 'model') and self.model:
                inputs = self.tokenizer(test_input, return_tensors="pt", truncation=True, max_length=2048)
                
                with torch.no_grad():
                    outputs = self.model.generate(
                        **inputs,
                        max_new_tokens=512,
                        temperature=0.7,
                        top_p=0.9,
                        do_sample=True
                    )
                
                response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
                
                # Extract just the response part
                if "### Response:" in response:
                    response = response.split("### Response:")[-1].strip()
                
                logger.info("✅ Model inference successful!")
                logger.info(f"Generated response:\n{response[:500]}...")
                
                # Save test result
                test_result = {
                    "timestamp": datetime.now().isoformat(),
                    "test_input": test_input,
                    "generated_response": response,
                    "model_path": str(self.output_dir)
                }
                
                with open(self.output_dir / "test_result.json", "w") as f:
                    json.dump(test_result, f, indent=2)
                
                return True
            else:
                logger.warning("Model not available for testing")
                return False
                
        except Exception as e:
            logger.error(f"❌ Testing failed: {e}")
            return False
    
    def cleanup(self):
        """Cleanup resources"""
        logger.info("Cleaning up resources...")
        
        # Clear GPU cache if available
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Garbage collection
        gc.collect()
        
        logger.info("✅ Cleanup complete")
    
    def run(self):
        """Main execution pipeline"""
        logger.info("="*60)
        logger.info("🚀 PRODUCTION 7.5 HOUR FINE-TUNING SESSION")
        logger.info("="*60)
        logger.info(f"Model: Llama 3.2:3B")
        logger.info(f"Dataset: {self.dataset_path}")
        logger.info(f"System: {self.system_config['cpu_model']} with {self.system_config['ram_gb']}GB RAM")
        logger.info(f"Duration: {self.system_config['training_duration_hours']} hours")
        logger.info("="*60)
        
        try:
            # Step 1: Install dependencies
            if not self.install_unsloth():
                logger.warning("Unsloth installation failed, continuing with fallback...")
            
            # Step 2: Load model
            if not self.load_model_and_tokenizer():
                logger.error("Failed to load model")
                return False
            
            # Step 3: Load dataset
            train_data, eval_data = self.load_and_prepare_dataset()
            if not train_data:
                logger.error("Failed to load dataset")
                return False
            
            # Step 4: Setup trainer
            if not self.setup_trainer(train_data, eval_data):
                logger.error("Failed to setup trainer")
                return False
            
            # Step 5: Run training
            if not self.run_training():
                logger.error("Training failed")
                return False
            
            # Step 6: Test model
            self.test_fine_tuned_model()
            
            # Step 7: Cleanup
            self.cleanup()
            
            logger.info("="*60)
            logger.info("🎉 FINE-TUNING SESSION COMPLETED SUCCESSFULLY!")
            logger.info(f"📁 Model saved to: {self.output_dir}")
            logger.info("📊 Ready for business intelligence tasks")
            logger.info("="*60)
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Pipeline failed: {e}")
            self.cleanup()
            return False

def main():
    """Main entry point"""
    finetuner = ProductionUnslothFinetuner()
    success = finetuner.run()
    
    if success:
        logger.info("✅ Production fine-tuning completed successfully!")
        logger.info("Use the model at: /home/pricepro2006/CrewAI_Team/fine-tuning/production-7hour-output")
    else:
        logger.error("❌ Production fine-tuning failed")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()