#!/usr/bin/env python3
"""
LiquidAI LFM2-1.2B Fine-tuning - Working Version
Using standard Trainer for compatibility
"""

import os
import sys
import json
import torch
import logging
from datetime import datetime, timedelta
from pathlib import Path
import subprocess

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_working.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def install_deps():
    """Install required packages"""
    packages = ['torch', 'transformers', 'datasets', 'peft', 'accelerate', 'bitsandbytes']
    
    for package in packages:
        try:
            __import__(package)
            logger.info(f"✅ {package} ready")
        except ImportError:
            logger.info(f"Installing {package}...")
            subprocess.run([
                sys.executable, '-m', 'pip', 'install',
                '--break-system-packages', '-q', package
            ], check=False)

def main():
    logger.info("="*60)
    logger.info("🚀 LFM2-1.2B TRAINING - WORKING VERSION")
    logger.info("Model: LiquidAI/LFM2-1.2B")
    logger.info("Dataset: 2,351 business intelligence examples")
    logger.info("="*60)
    
    install_deps()
    
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
    
    # Model name
    model_name = "LiquidAI/LFM2-1.2B"
    
    # Load with 4-bit quantization
    logger.info("Loading LFM2-1.2B with 4-bit quantization...")
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16
    )
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    # Load model
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.float16
    )
    
    # Prepare for training
    model = prepare_model_for_kbit_training(model)
    
    # Add LoRA
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        bias="none"
    )
    
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    
    # Load dataset
    logger.info("Loading dataset...")
    dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    
    examples = []
    with open(dataset_path, 'r') as f:
        for i, line in enumerate(f):
            if i >= 2351:
                break
            try:
                data = json.loads(line)
                messages = data["messages"]
                
                # Format text
                text = f"### Instruction:\nAnalyze this business communication.\n\n### Input:\n{messages[0]['content'][:1000]}\n\n### Response:\n{messages[1]['content'][:1000]}"
                examples.append({"text": text})
                
                if (i + 1) % 500 == 0:
                    logger.info(f"Loaded {i + 1} examples...")
            except:
                continue
    
    logger.info(f"✅ Loaded {len(examples)} examples")
    
    # Create dataset
    dataset = Dataset.from_list(examples)
    
    # Tokenize
    def tokenize_function(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=512,
            padding="max_length"
        )
    
    tokenized_dataset = dataset.map(tokenize_function, batched=True)
    
    # Split dataset
    train_size = int(0.95 * len(tokenized_dataset))
    train_dataset = tokenized_dataset.select(range(train_size))
    eval_dataset = tokenized_dataset.select(range(train_size, len(tokenized_dataset)))
    
    logger.info(f"Train: {len(train_dataset)}, Eval: {len(eval_dataset)}")
    
    # Training arguments
    output_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_output"
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=4,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=6,
        warmup_steps=50,
        learning_rate=3e-4,
        logging_steps=10,
        save_steps=50,
        eval_steps=25,
        eval_strategy="steps",
        save_strategy="steps",
        load_best_model_at_end=True,
        save_total_limit=3,
        fp16=False,
        report_to="none",
        remove_unused_columns=False,
        dataloader_num_workers=2
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        data_collator=data_collator
    )
    
    # Start training
    logger.info("🚀 Starting training...")
    start_time = datetime.now()
    logger.info(f"Start time: {start_time}")
    logger.info(f"Expected completion: {start_time + timedelta(hours=4.5)}")
    
    # Train
    trainer.train()
    
    # Save model
    trainer.save_model()
    tokenizer.save_pretrained(output_dir)
    
    end_time = datetime.now()
    logger.info(f"✅ Training completed in {end_time - start_time}")
    logger.info(f"Model saved to: {output_dir}")
    
    # Test the model
    logger.info("Testing model...")
    test_text = "### Instruction:\nAnalyze this business communication.\n\n### Input:\nQ4 revenue projections show 23% growth.\n\n### Response:"
    
    inputs = tokenizer(test_text, return_tensors="pt", truncation=True)
    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=100, temperature=0.3)
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    logger.info(f"Test response: {response[:200]}")
    
    logger.info("🎉 TRAINING COMPLETE!")
    return True

if __name__ == "__main__":
    with open("/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_working.pid", "w") as f:
        f.write(str(os.getpid()))
    
    success = main()
    sys.exit(0 if success else 1)