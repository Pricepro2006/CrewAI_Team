#!/usr/bin/env python3
"""
Debug version of Phi-2 training with immediate output
"""

import os
import json
import torch
import logging
import sys
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, TaskType
from datasets import Dataset

# Force output flushing
sys.stdout = sys.stderr

# Simple logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("Starting Phi-2 debug training...")
    
    # Load a tiny subset for testing
    logger.info("Loading dataset...")
    with open('./datasets/claude_train.json', 'r') as f:
        data = json.load(f)
    
    # Use only 10 examples for quick test
    examples = data['examples'][:10]
    logger.info(f"Loaded {len(examples)} examples for testing")
    
    # Load tokenizer
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained("microsoft/phi-2", trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load model
    logger.info("Loading Phi-2 model...")
    model = AutoModelForCausalLM.from_pretrained(
        "microsoft/phi-2",
        torch_dtype=torch.float32,
        device_map='cpu',
        trust_remote_code=True,
        use_cache=False
    )
    logger.info("Model loaded!")
    
    # Configure LoRA
    logger.info("Configuring LoRA...")
    lora_config = LoraConfig(
        r=4,  # Even smaller for testing
        lora_alpha=8,
        lora_dropout=0.1,
        target_modules=["q_proj", "v_proj"],  # Fewer modules
        task_type=TaskType.CAUSAL_LM
    )
    model = get_peft_model(model, lora_config)
    logger.info(f"LoRA configured: {model.get_nb_trainable_parameters()} trainable params")
    
    # Prepare dataset
    logger.info("Preparing dataset...")
    texts = [f"{ex['input']}\n{ex['output']}" for ex in examples]
    
    def tokenize(examples):
        return tokenizer(examples["text"], truncation=True, padding="max_length", max_length=512)
    
    dataset = Dataset.from_dict({"text": texts})
    dataset = dataset.map(tokenize, batched=True)
    dataset.set_format("torch")
    
    # Training arguments - MINIMAL
    logger.info("Creating trainer...")
    training_args = TrainingArguments(
        output_dir="./test-output",
        num_train_epochs=1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=1,
        logging_steps=1,  # Log every step
        save_steps=1000,  # Don't save
        warmup_steps=0,
        learning_rate=1e-4,
        eval_strategy="no",  # No evaluation
        report_to=[],
        disable_tqdm=False,  # Show progress bar
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        tokenizer=tokenizer
    )
    
    # Train
    logger.info("Starting training on 10 examples...")
    logger.info("This should take 1-2 minutes...")
    
    try:
        trainer.train()
        logger.info("✅ Training completed successfully!")
    except Exception as e:
        logger.error(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()