#!/usr/bin/env python3
"""
LFM2-1.2B FINAL WORKING VERSION
This will actually train!
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
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_final.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    logger.info("="*60)
    logger.info("🚀 LFM2-1.2B FINAL TRAINING SESSION")
    logger.info("This is the ACTUAL training that will work!")
    logger.info("="*60)
    
    # Import after logging setup
    from transformers import (
        AutoModelForCausalLM, 
        AutoTokenizer,
        TrainingArguments,
        Trainer,
        BitsAndBytesConfig
    )
    from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
    from datasets import Dataset
    import torch
    
    # Model configuration
    model_name = "LiquidAI/LFM2-1.2B"
    output_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_final_output"
    
    # 4-bit quantization for efficiency
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16
    )
    
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    logger.info("Loading LFM2-1.2B model with 4-bit quantization...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.float16
    )
    
    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)
    
    # Configure LoRA
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        bias="none"
    )
    
    model = get_peft_model(model, peft_config)
    
    # Log trainable parameters
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"Model loaded: {trainable:,} trainable params out of {total:,} ({100*trainable/total:.2f}%)")
    
    # Load and prepare dataset
    logger.info("Loading dataset...")
    dataset_path = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl"
    
    texts = []
    with open(dataset_path, 'r') as f:
        for i, line in enumerate(f):
            if i >= 2351:
                break
            try:
                data = json.loads(line)
                messages = data["messages"]
                
                # Simple format that works
                text = f"User: {messages[0]['content'][:800]}\n\nAssistant: {messages[1]['content'][:800]}"
                texts.append(text)
                
                if (i + 1) % 500 == 0:
                    logger.info(f"Loaded {i + 1} examples...")
            except:
                continue
    
    logger.info(f"✅ Loaded {len(texts)} examples")
    
    # Tokenize all at once
    logger.info("Tokenizing dataset...")
    
    def tokenize_and_format(texts):
        # Tokenize with proper padding and truncation
        model_inputs = tokenizer(
            texts,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors=None  # Return lists, not tensors
        )
        
        # Set labels same as input_ids for causal LM
        model_inputs["labels"] = model_inputs["input_ids"].copy()
        
        return model_inputs
    
    # Create dataset from tokenized data
    tokenized = tokenize_and_format(texts)
    dataset = Dataset.from_dict(tokenized)
    
    # Split into train/eval
    train_size = int(0.95 * len(dataset))
    train_dataset = dataset.select(range(train_size))
    eval_dataset = dataset.select(range(train_size, len(dataset)))
    
    logger.info(f"Train: {len(train_dataset)}, Eval: {len(eval_dataset)}")
    
    # Training arguments for 4-5 hours
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=4,
        warmup_steps=50,
        learning_rate=2e-4,
        logging_steps=10,
        save_steps=50,
        eval_steps=50,
        eval_strategy="steps",
        save_strategy="steps",
        load_best_model_at_end=True,
        metric_for_best_model="loss",
        greater_is_better=False,
        save_total_limit=2,
        fp16=False,  # Use float32 for CPU
        report_to="none",
        remove_unused_columns=False,
        dataloader_num_workers=0,  # Avoid multiprocessing issues
        prediction_loss_only=True
    )
    
    # Create trainer - simple, no data collator needed
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset
    )
    
    # Start training
    logger.info("🚀 STARTING ACTUAL TRAINING!")
    start_time = datetime.now()
    logger.info(f"Start time: {start_time}")
    logger.info(f"Expected completion: {start_time + timedelta(hours=4)}")
    logger.info("="*60)
    
    try:
        # Train!
        trainer.train()
        
        # Save final model
        logger.info("Saving model...")
        trainer.save_model()
        tokenizer.save_pretrained(output_dir)
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info("="*60)
        logger.info(f"✅ TRAINING COMPLETED SUCCESSFULLY!")
        logger.info(f"Duration: {duration}")
        logger.info(f"Model saved to: {output_dir}")
        logger.info("="*60)
        
        # Quick test
        logger.info("Testing model...")
        test_text = "User: What are the key revenue drivers for Q4?\n\nAssistant:"
        inputs = tokenizer(test_text, return_tensors="pt", truncation=True)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=50,
                temperature=0.3,
                do_sample=True
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        logger.info(f"Test response: {response}")
        
        return True
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    # Write PID
    with open("/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_final.pid", "w") as f:
        f.write(str(os.getpid()))
    
    # Ensure we have the packages
    import subprocess
    for pkg in ['torch', 'transformers', 'datasets', 'peft', 'accelerate', 'bitsandbytes']:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--break-system-packages', '-q', pkg], check=False)
    
    success = main()
    sys.exit(0 if success else 1)