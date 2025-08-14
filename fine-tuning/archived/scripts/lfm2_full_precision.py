#!/usr/bin/env python3
"""
LFM2-1.2B FULL PRECISION TRAINING
Training the actual model without quantization
Better quality, still fits in 64GB RAM
"""

import os
import sys
import json
import torch
import logging
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_full_precision.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    logger.info("="*60)
    logger.info("🚀 LFM2-1.2B FULL PRECISION TRAINING")
    logger.info("Training the ACTUAL model - No quantization!")
    logger.info("Better training quality with full float32 precision")
    logger.info("="*60)
    
    from transformers import (
        AutoModelForCausalLM, 
        AutoTokenizer,
        TrainingArguments,
        Trainer
    )
    from peft import LoraConfig, get_peft_model, TaskType
    from datasets import Dataset
    import torch
    
    # Model configuration
    model_name = "LiquidAI/LFM2-1.2B"
    output_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_full_precision_output"
    
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    logger.info("Loading LFM2-1.2B model in FULL PRECISION...")
    logger.info("This will use ~5GB of RAM for the model")
    
    # Load model WITHOUT quantization - full precision
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32,  # Full precision
        device_map="cpu",  # Explicitly use CPU
        trust_remote_code=True,
        low_cpu_mem_usage=True  # Efficient loading
    )
    
    logger.info("✅ Model loaded in full precision!")
    
    # Configure LoRA for efficient training
    # We can use higher rank since we're not memory constrained
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=32,  # Higher rank for better quality
        lora_alpha=64,
        lora_dropout=0.1,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        bias="none"
    )
    
    model = get_peft_model(model, peft_config)
    
    # Log trainable parameters
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"Model configuration:")
    logger.info(f"  Total parameters: {total:,}")
    logger.info(f"  Trainable parameters: {trainable:,}")
    logger.info(f"  Trainable percentage: {100*trainable/total:.2f}%")
    logger.info(f"  Estimated memory usage: ~{(total * 4) / (1024**3):.1f}GB")
    
    # Load and prepare dataset
    logger.info("Loading business intelligence dataset...")
    dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    
    texts = []
    with open(dataset_path, 'r') as f:
        for i, line in enumerate(f):
            if i >= 2351:
                break
            try:
                data = json.loads(line)
                messages = data["messages"]
                
                # Format for instruction tuning
                instruction = "Analyze the following business communication and provide comprehensive insights."
                text = f"### Instruction:\n{instruction}\n\n### Input:\n{messages[0]['content'][:1000]}\n\n### Response:\n{messages[1]['content'][:1000]}"
                texts.append(text)
                
                if (i + 1) % 500 == 0:
                    logger.info(f"  Loaded {i + 1} examples...")
            except Exception as e:
                logger.warning(f"Skipped example {i}: {e}")
                continue
    
    logger.info(f"✅ Loaded {len(texts)} training examples")
    
    # Tokenize dataset
    logger.info("Tokenizing dataset...")
    
    def tokenize_function(texts):
        # Tokenize with consistent settings
        encodings = tokenizer(
            texts,
            truncation=True,
            padding="max_length",
            max_length=1024,  # Longer context since we have memory
            return_tensors=None
        )
        
        # Set labels for causal LM
        encodings["labels"] = encodings["input_ids"].copy()
        
        return encodings
    
    # Create dataset
    tokenized = tokenize_function(texts)
    dataset = Dataset.from_dict(tokenized)
    
    # Split dataset
    train_size = int(0.95 * len(dataset))
    train_dataset = dataset.select(range(train_size))
    eval_dataset = dataset.select(range(train_size, len(dataset)))
    
    logger.info(f"Dataset split: Train={len(train_dataset)}, Eval={len(eval_dataset)}")
    
    # Training arguments optimized for full precision
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=5,  # More epochs since we have better precision
        per_device_train_batch_size=8,  # Larger batch size
        gradient_accumulation_steps=2,
        warmup_steps=100,
        learning_rate=5e-4,  # Slightly higher LR for full precision
        weight_decay=0.01,
        logging_steps=10,
        save_steps=50,
        eval_steps=50,
        eval_strategy="steps",
        save_strategy="steps",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        save_total_limit=3,
        fp16=False,  # No mixed precision
        bf16=False,  # No bfloat16
        torch_compile=False,  # Disable for compatibility
        dataloader_drop_last=True,
        report_to="none",
        remove_unused_columns=False,
        dataloader_num_workers=0,
        prediction_loss_only=True,
        gradient_checkpointing=False,  # Full precision doesn't need this
        optim="adamw_torch",  # Standard AdamW
        adam_beta1=0.9,
        adam_beta2=0.999,
        adam_epsilon=1e-8
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset
    )
    
    # Calculate expected training time
    total_steps = len(train_dataset) // (training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps) * training_args.num_train_epochs
    estimated_time_hours = (total_steps * 30) / 3600  # ~30 seconds per step on CPU
    
    logger.info("="*60)
    logger.info("🚀 STARTING FULL PRECISION TRAINING")
    logger.info(f"Total training steps: {total_steps}")
    logger.info(f"Estimated time: {estimated_time_hours:.1f} hours")
    logger.info("="*60)
    
    start_time = datetime.now()
    logger.info(f"Start time: {start_time}")
    logger.info(f"Expected completion: {start_time + timedelta(hours=estimated_time_hours)}")
    
    try:
        # Train the model
        train_result = trainer.train()
        
        # Save the final model
        logger.info("Saving fine-tuned model...")
        trainer.save_model()
        tokenizer.save_pretrained(output_dir)
        
        # Save training metrics
        with open(f"{output_dir}/training_results.json", "w") as f:
            json.dump(train_result.metrics, f, indent=2)
        
        end_time = datetime.now()
        actual_duration = end_time - start_time
        
        logger.info("="*60)
        logger.info("✅ TRAINING COMPLETED SUCCESSFULLY!")
        logger.info(f"Actual duration: {actual_duration}")
        logger.info(f"Final loss: {train_result.metrics.get('train_loss', 'N/A')}")
        logger.info(f"Model saved to: {output_dir}")
        logger.info("="*60)
        
        # Test the model
        logger.info("Testing fine-tuned model...")
        test_prompt = "### Instruction:\nAnalyze the following business communication and provide comprehensive insights.\n\n### Input:\nOur Q4 revenue projections show 23% YoY growth driven by enterprise expansion in APAC.\n\n### Response:"
        
        inputs = tokenizer(test_prompt, return_tensors="pt", truncation=True)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=100,
                temperature=0.3,
                do_sample=True,
                top_p=0.9
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        logger.info("Test response:")
        logger.info(response)
        
        return True
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    # Write PID for monitoring
    with open("/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_full_precision.pid", "w") as f:
        f.write(str(os.getpid()))
    
    # Ensure dependencies
    import subprocess
    logger.info("Checking dependencies...")
    for pkg in ['torch', 'transformers', 'datasets', 'peft', 'accelerate']:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--break-system-packages', '-q', pkg], check=False)
    
    success = main()
    sys.exit(0 if success else 1)