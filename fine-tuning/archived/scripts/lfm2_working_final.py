#!/usr/bin/env python3
"""
LFM2-1.2B Working Training Script
Fixed tokenization and dataset issues
"""

import os
import json
import torch
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting LFM2-1.2B Training - Fixed Version")
    
    from transformers import (
        AutoModelForCausalLM, 
        AutoTokenizer,
        Trainer,
        TrainingArguments,
        DataCollatorForLanguageModeling
    )
    from peft import LoraConfig, get_peft_model, TaskType
    import datasets
    
    # Model setup
    model_name = "LiquidAI/LFM2-1.2B"
    output_dir = "./models/lfm2_finetuned_working"
    
    # Load tokenizer
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    # Load model
    logger.info("Loading model (this will take a minute)...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float32,  # CPU compatible
        low_cpu_mem_usage=True,
        trust_remote_code=True
    )
    
    # Configure LoRA with minimal parameters
    logger.info("Configuring LoRA...")
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=4,  # Very low rank for memory efficiency
        lora_alpha=8,
        lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"],  # Minimal targets
        bias="none"
    )
    
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()
    
    # Prepare dataset
    logger.info("Preparing dataset...")
    
    # Load examples from JSONL
    examples = []
    dataset_path = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl")
    
    if dataset_path.exists():
        with open(dataset_path, 'r') as f:
            for i, line in enumerate(f):
                if i >= 50:  # Start with just 50 examples
                    break
                try:
                    item = json.loads(line)
                    # Format as conversation
                    text = f"### Instruction:\n{item.get('instruction', 'Analyze this')}\n\n### Input:\n{item.get('input', '')}\n\n### Response:\n{item.get('output', 'Analysis complete.')}"
                    examples.append(text)
                except:
                    continue
    
    # Fallback if no data
    if len(examples) < 10:
        logger.warning("Using fallback dataset")
        examples = [
            "### Instruction:\nAnalyze this purchase order\n\n### Input:\nPO#12345 for 100 units\n\n### Response:\nThis is a purchase order for 100 units.",
            "### Instruction:\nFind the SPA code\n\n### Input:\nEmail mentions SPA CAS-091284\n\n### Response:\nThe SPA code is CAS-091284.",
            "### Instruction:\nIdentify the customer\n\n### Input:\nFrom: john@acme.com\n\n### Response:\nThe customer is ACME.",
        ] * 5
    
    logger.info(f"Loaded {len(examples)} training examples")
    
    # Tokenize the dataset properly
    def preprocess_function(examples):
        # Tokenize the text
        model_inputs = tokenizer(
            examples["text"],
            max_length=256,
            truncation=True,
            padding="max_length"
        )
        # Set labels to be the same as input_ids for language modeling
        model_inputs["labels"] = model_inputs["input_ids"].copy()
        return model_inputs
    
    # Create dataset
    raw_dataset = datasets.Dataset.from_dict({"text": examples})
    
    # Tokenize
    tokenized_dataset = raw_dataset.map(
        preprocess_function,
        batched=True,
        remove_columns=["text"]
    )
    
    # Split for training and evaluation
    split_dataset = tokenized_dataset.train_test_split(test_size=0.1, seed=42)
    train_dataset = split_dataset["train"]
    eval_dataset = split_dataset["test"]
    
    logger.info(f"Train size: {len(train_dataset)}, Eval size: {len(eval_dataset)}")
    
    # Training arguments - optimized for CPU
    training_args = TrainingArguments(
        output_dir=output_dir,
        overwrite_output_dir=True,
        num_train_epochs=1,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=4,
        eval_strategy="steps",
        eval_steps=10,
        save_steps=20,
        warmup_steps=5,
        learning_rate=2e-4,
        fp16=False,  # No fp16 on CPU
        logging_steps=5,
        logging_dir=f"{output_dir}/logs",
        save_total_limit=1,
        load_best_model_at_end=False,
        metric_for_best_model="loss",
        greater_is_better=False,
        report_to="none",
        push_to_hub=False,
        max_steps=30,  # Limit to 30 steps for testing
        dataloader_num_workers=0,  # Avoid multiprocessing issues
        remove_unused_columns=True,
        label_names=["labels"]
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,  # Causal LM, not masked LM
        pad_to_multiple_of=None
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        data_collator=data_collator,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer
    )
    
    # Start training
    logger.info("="*60)
    logger.info("Starting training...")
    logger.info(f"Total steps: 30")
    logger.info(f"Batch size: 1, Gradient accumulation: 4")
    logger.info("="*60)
    
    try:
        # Train
        train_result = trainer.train()
        
        # Save the model
        logger.info("Saving model...")
        trainer.save_model()
        tokenizer.save_pretrained(output_dir)
        
        # Log metrics
        logger.info(f"Training completed!")
        logger.info(f"Training loss: {train_result.training_loss:.4f}")
        
        # Quick test
        logger.info("\nTesting the model...")
        prompt = "### Instruction:\nAnalyze this purchase order\n\n### Input:\nPO#98765 for 50 units of Microsoft Surface\n\n### Response:\n"
        
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=256)
        
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=50,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        logger.info(f"Generated response:\n{response}")
        
        logger.info("\n✅ Training completed successfully!")
        logger.info(f"Model saved to: {output_dir}")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
        
        # Try to save checkpoint
        try:
            logger.info("Saving emergency checkpoint...")
            trainer.save_model(f"{output_dir}_checkpoint")
        except:
            pass

if __name__ == "__main__":
    main()