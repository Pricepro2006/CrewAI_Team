#!/usr/bin/env python3
"""
LFM2-1.2B Simple Training Script
Minimal setup for CPU training
"""

import os
import json
import torch
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting LFM2-1.2B Simple Training")
    
    from transformers import (
        AutoModelForCausalLM, 
        AutoTokenizer,
        TrainingArguments,
        Trainer
    )
    from peft import LoraConfig, get_peft_model, TaskType
    from datasets import Dataset
    
    # Model setup
    model_name = "LiquidAI/LFM2-1.2B"
    
    # Load tokenizer
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    
    # Load model in float32 for CPU
    logger.info("Loading model...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32,
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    
    # Add LoRA
    logger.info("Adding LoRA...")
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=4,  # Very small rank
        lora_alpha=8,
        lora_dropout=0.1,
        target_modules=["q_proj", "v_proj"]
    )
    
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    
    # Create simple dataset
    logger.info("Creating dataset...")
    texts = []
    
    # Load from JSONL if available
    dataset_path = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl")
    
    if dataset_path.exists():
        with open(dataset_path, 'r') as f:
            for i, line in enumerate(f):
                if i >= 100:  # Only use 100 examples
                    break
                try:
                    item = json.loads(line)
                    text = f"User: {item.get('input', 'Analyze this email')}\nAssistant: {item.get('output', 'This is a business email.')}"
                    texts.append(text)
                except:
                    continue
    
    # Fallback dataset if needed
    if len(texts) < 10:
        texts = [
            "User: Analyze this purchase order.\nAssistant: This is a purchase order requiring processing.",
            "User: What is the SPA code?\nAssistant: The SPA code is CAS-091284-B0C6Q4.",
            "User: Check this quote request.\nAssistant: This is a quote request for Microsoft products.",
        ] * 10
    
    logger.info(f"Dataset size: {len(texts)}")
    
    # Tokenize
    def tokenize_function(examples):
        return tokenizer(examples["text"], padding=True, truncation=True, max_length=256)
    
    dataset = Dataset.from_dict({"text": texts})
    tokenized_dataset = dataset.map(tokenize_function, batched=True)
    
    # Training arguments - minimal for CPU
    training_args = TrainingArguments(
        output_dir="./models/lfm2_simple",
        num_train_epochs=1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        logging_steps=5,
        save_steps=50,
        max_steps=20,  # Very limited steps
        report_to="none",
        remove_unused_columns=False,
        dataloader_num_workers=0
    )
    
    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        tokenizer=tokenizer
    )
    
    # Train
    logger.info("Starting training (20 steps)...")
    try:
        trainer.train()
        logger.info("✅ Training completed!")
        
        # Save
        trainer.save_model("./models/lfm2_simple")
        tokenizer.save_pretrained("./models/lfm2_simple")
        logger.info("Model saved!")
        
        # Test
        test_input = "User: Analyze this email about a purchase order.\nAssistant:"
        inputs = tokenizer(test_input, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs, 
                max_new_tokens=50,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
            response = tokenizer.decode(outputs[0], skip_special_tokens=True)
            logger.info(f"\nTest generation:\n{response}")
            
    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()