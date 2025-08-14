#!/usr/bin/env python3
"""
LiquidAI LFM2-1.2B Fine-tuning for Business Intelligence
Optimized for AMD Ryzen 7 7840H with 64GB RAM
Dataset: 2,351 business intelligence examples
Expected training time: 4-5 hours
"""

import os
import sys
import json
import torch
import logging
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
from typing import Dict, List, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class LFM2Trainer:
    """Fine-tune LiquidAI LFM2-1.2B on business intelligence data"""
    
    def __init__(self):
        self.model_name = "LiquidAI/LFM2-1.2B"
        self.dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
        self.output_dir = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_finetuned")
        self.output_dir.mkdir(exist_ok=True)
        
        # Optimal configuration for LFM2-1.2B on your hardware
        self.training_config = {
            "batch_size": 6,
            "gradient_accumulation_steps": 4,
            "learning_rate": 3e-4,
            "num_epochs": 4,
            "warmup_ratio": 0.05,
            "max_seq_length": 2048,  # LFM2 supports up to 32k
            "lora_r": 16,
            "lora_alpha": 32,
            "lora_dropout": 0.05,
            "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
            "save_steps": 50,
            "eval_steps": 25,
            "logging_steps": 10,
            "seed": 42
        }
        
        self.model = None
        self.tokenizer = None
        self.trainer = None
        
    def install_dependencies(self):
        """Install required packages"""
        packages = [
            'torch',
            'transformers>=4.40.0',
            'datasets',
            'peft',
            'accelerate',
            'bitsandbytes',
            'trl',
            'scipy'
        ]
        
        logger.info("Installing/verifying dependencies...")
        for package in packages:
            try:
                if '>' in package:
                    pkg_name = package.split('>')[0]
                    __import__(pkg_name)
                else:
                    __import__(package)
                logger.info(f"✅ {package} ready")
            except ImportError:
                logger.info(f"Installing {package}...")
                subprocess.run([
                    sys.executable, '-m', 'pip', 'install',
                    '--break-system-packages', '-q', package
                ], check=False)
        
        return True
    
    def load_model_and_tokenizer(self):
        """Load LFM2-1.2B model with 4-bit quantization for efficiency"""
        logger.info(f"Loading LiquidAI LFM2-1.2B model...")
        
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
            from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
            
            # 4-bit quantization config for memory efficiency
            bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float16
            )
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                trust_remote_code=True,
                use_fast=True
            )
            
            # Set padding token
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            self.tokenizer.padding_side = "right"
            
            # Load model with quantization
            logger.info("Loading model with 4-bit quantization...")
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
                torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float16
            )
            
            # Prepare for k-bit training
            self.model = prepare_model_for_kbit_training(self.model)
            
            # Configure LoRA
            lora_config = LoraConfig(
                task_type=TaskType.CAUSAL_LM,
                r=self.training_config["lora_r"],
                lora_alpha=self.training_config["lora_alpha"],
                lora_dropout=self.training_config["lora_dropout"],
                target_modules=self.training_config["target_modules"],
                bias="none"
            )
            
            # Apply LoRA
            self.model = get_peft_model(self.model, lora_config)
            
            # Print trainable parameters
            trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            total_params = sum(p.numel() for p in self.model.parameters())
            
            logger.info(f"✅ Model loaded successfully!")
            logger.info(f"Total parameters: {total_params:,}")
            logger.info(f"Trainable parameters: {trainable_params:,}")
            logger.info(f"Trainable: {100 * trainable_params / total_params:.2f}%")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def load_and_prepare_dataset(self):
        """Load and format the business intelligence dataset"""
        logger.info("Loading business intelligence dataset...")
        
        try:
            examples = []
            with open(self.dataset_path, 'r') as f:
                for i, line in enumerate(f):
                    if i >= 2351:  # Use full dataset
                        break
                    try:
                        data = json.loads(line)
                        examples.append(data)
                        if (i + 1) % 500 == 0:
                            logger.info(f"Loaded {i + 1} examples...")
                    except Exception as e:
                        logger.warning(f"Skipped line {i}: {e}")
                        continue
            
            logger.info(f"✅ Loaded {len(examples)} examples")
            
            # Format for LFM2's instruction format
            formatted_examples = self.format_examples_for_lfm2(examples)
            
            # Create train/eval split (95/5)
            split_idx = int(0.95 * len(formatted_examples))
            train_data = formatted_examples[:split_idx]
            eval_data = formatted_examples[split_idx:]
            
            logger.info(f"Train examples: {len(train_data)}")
            logger.info(f"Eval examples: {len(eval_data)}")
            
            return train_data, eval_data
            
        except Exception as e:
            logger.error(f"Dataset loading failed: {e}")
            return None, None
    
    def format_examples_for_lfm2(self, examples):
        """Format examples for LFM2's preferred instruction format"""
        formatted = []
        
        # LFM2 prefers this format based on their documentation
        template = """### Instruction:
Analyze the following business communication and provide comprehensive business intelligence insights.

### Input:
{input}

### Response:
{output}"""
        
        for ex in examples:
            try:
                messages = ex["messages"]
                user_content = messages[0]["content"]
                assistant_content = messages[1]["content"]
                
                # Truncate if needed but keep meaningful content
                if len(user_content) > 1500:
                    user_content = user_content[:1500] + "..."
                if len(assistant_content) > 1500:
                    assistant_content = assistant_content[:1500] + "..."
                
                formatted_text = template.format(
                    input=user_content,
                    output=assistant_content
                )
                
                formatted.append({"text": formatted_text})
                
            except Exception as e:
                logger.warning(f"Failed to format example: {e}")
                continue
        
        return formatted
    
    def setup_trainer(self, train_data, eval_data):
        """Setup the SFTTrainer for fine-tuning"""
        logger.info("Setting up trainer...")
        
        try:
            from trl import SFTTrainer
            from transformers import TrainingArguments
            from datasets import Dataset
            
            # Convert to Dataset format
            train_dataset = Dataset.from_list(train_data)
            eval_dataset = Dataset.from_list(eval_data)
            
            # Calculate steps for ~4-5 hour training
            effective_batch_size = self.training_config["batch_size"] * self.training_config["gradient_accumulation_steps"]
            steps_per_epoch = len(train_data) // effective_batch_size
            total_steps = steps_per_epoch * self.training_config["num_epochs"]
            
            logger.info(f"Training calculation:")
            logger.info(f"  Effective batch size: {effective_batch_size}")
            logger.info(f"  Steps per epoch: {steps_per_epoch}")
            logger.info(f"  Total epochs: {self.training_config['num_epochs']}")
            logger.info(f"  Total steps: {total_steps}")
            logger.info(f"  Estimated time: 4-5 hours")
            
            # Training arguments optimized for LFM2
            training_args = TrainingArguments(
                output_dir=str(self.output_dir),
                num_train_epochs=self.training_config["num_epochs"],
                per_device_train_batch_size=self.training_config["batch_size"],
                per_device_eval_batch_size=self.training_config["batch_size"],
                gradient_accumulation_steps=self.training_config["gradient_accumulation_steps"],
                learning_rate=self.training_config["learning_rate"],
                warmup_ratio=self.training_config["warmup_ratio"],
                logging_steps=self.training_config["logging_steps"],
                save_steps=self.training_config["save_steps"],
                eval_steps=self.training_config["eval_steps"],
                eval_strategy="steps",
                save_strategy="steps",
                load_best_model_at_end=True,
                save_total_limit=3,
                fp16=not torch.cuda.is_available(),
                bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
                optim="adamw_torch",
                lr_scheduler_type="cosine",
                seed=self.training_config["seed"],
                report_to="none",
                remove_unused_columns=True,
                dataloader_num_workers=4,
                ddp_find_unused_parameters=False if torch.cuda.device_count() > 1 else None
            )
            
            # Initialize SFTTrainer (updated API)
            self.trainer = SFTTrainer(
                model=self.model,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                dataset_text_field="text",
                max_seq_length=self.training_config["max_seq_length"],
                packing=False,  # Don't pack sequences for clarity
                args=training_args,
                formatting_func=None  # Use dataset_text_field instead
            )
            
            logger.info("✅ Trainer setup complete")
            return True
            
        except Exception as e:
            logger.error(f"Trainer setup failed: {e}")
            return False
    
    def run_training(self):
        """Execute the training session"""
        logger.info("🚀 Starting LFM2-1.2B fine-tuning session")
        start_time = datetime.now()
        expected_end = start_time + timedelta(hours=4.5)
        
        logger.info(f"Start time: {start_time}")
        logger.info(f"Expected completion: {expected_end}")
        logger.info("="*60)
        
        try:
            # Train
            train_result = self.trainer.train()
            
            # Save final model
            logger.info("💾 Saving fine-tuned model...")
            self.trainer.save_model()
            self.tokenizer.save_pretrained(str(self.output_dir))
            
            # Save training metrics
            metrics = train_result.metrics
            self.trainer.log_metrics("train", metrics)
            self.trainer.save_metrics("train", metrics)
            
            # Calculate actual duration
            end_time = datetime.now()
            duration = end_time - start_time
            
            logger.info(f"✅ Training completed successfully!")
            logger.info(f"Duration: {duration}")
            logger.info(f"Final loss: {metrics.get('train_loss', 'N/A')}")
            logger.info(f"Model saved to: {self.output_dir}")
            
            # Save metadata
            metadata = {
                "model_name": self.model_name,
                "dataset_size": 2351,
                "training_duration": str(duration),
                "final_loss": metrics.get('train_loss', 'N/A'),
                "timestamp": datetime.now().isoformat(),
                "config": self.training_config
            }
            
            with open(self.output_dir / "training_metadata.json", "w") as f:
                json.dump(metadata, f, indent=2)
            
            return True
            
        except Exception as e:
            logger.error(f"Training failed: {e}")
            
            # Save checkpoint on failure
            if self.trainer:
                checkpoint_path = str(self.output_dir / "error_checkpoint")
                self.trainer.save_model(checkpoint_path)
                logger.info(f"Checkpoint saved to: {checkpoint_path}")
            
            return False
    
    def test_model(self):
        """Test the fine-tuned model with a sample query"""
        logger.info("🧪 Testing fine-tuned model...")
        
        test_prompt = """### Instruction:
Analyze the following business communication and provide comprehensive business intelligence insights.

### Input:
Email from CFO regarding Q4 2024 projections: Revenue target of $12.5M represents 23% YoY growth. 
Key drivers include enterprise expansion in APAC and new AI analytics suite launch. 
Concerns about competitive pressure from NewCorp's pricing strategy.

### Response:"""
        
        try:
            inputs = self.tokenizer(test_prompt, return_tensors="pt", truncation=True, max_length=512)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=256,
                    temperature=0.3,  # LFM2 recommended
                    min_p=0.15,       # LFM2 recommended
                    repetition_penalty=1.05,  # LFM2 recommended
                    do_sample=True
                )
            
            response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Extract response part
            if "### Response:" in response:
                response = response.split("### Response:")[-1].strip()
            
            logger.info("Generated response:")
            logger.info(response[:500])
            
            return True
            
        except Exception as e:
            logger.error(f"Testing failed: {e}")
            return False
    
    def run(self):
        """Main execution pipeline"""
        logger.info("="*60)
        logger.info("🚀 LiquidAI LFM2-1.2B FINE-TUNING SESSION")
        logger.info("Model: LiquidAI/LFM2-1.2B (1.17B parameters)")
        logger.info("Dataset: 2,351 business intelligence examples")
        logger.info("Expected duration: 4-5 hours")
        logger.info("="*60)
        
        # Install dependencies
        if not self.install_dependencies():
            logger.error("Failed to install dependencies")
            return False
        
        # Load model
        if not self.load_model_and_tokenizer():
            logger.error("Failed to load model")
            return False
        
        # Load dataset
        train_data, eval_data = self.load_and_prepare_dataset()
        if not train_data:
            logger.error("Failed to load dataset")
            return False
        
        # Setup trainer
        if not self.setup_trainer(train_data, eval_data):
            logger.error("Failed to setup trainer")
            return False
        
        # Run training
        if not self.run_training():
            logger.error("Training failed")
            return False
        
        # Test model
        self.test_model()
        
        logger.info("="*60)
        logger.info("🎉 LFM2-1.2B FINE-TUNING COMPLETED!")
        logger.info(f"Fine-tuned model: {self.output_dir}")
        logger.info("Ready for business intelligence tasks!")
        logger.info("="*60)
        
        return True

def main():
    """Main entry point"""
    # Write PID for monitoring
    with open("/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_training.pid", "w") as f:
        f.write(str(os.getpid()))
    
    trainer = LFM2Trainer()
    success = trainer.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()