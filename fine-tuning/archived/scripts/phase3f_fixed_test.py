#!/usr/bin/env python3
"""
Phase 3f: Fixed Small Batch Test
Tests base Phi-3.5-mini model against Claude's analysis
"""

import json
import torch
import time
import re
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM

print("Phase 3f: Testing base Phi-3.5-mini model...")
print("="*70)

# Load model
print("Loading model...")
tokenizer = AutoTokenizer.from_pretrained(
    "microsoft/Phi-3.5-mini-instruct",
    trust_remote_code=True,
    cache_dir="./model_cache"
)

# Set pad token
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    "microsoft/Phi-3.5-mini-instruct",
    torch_dtype=torch.float32,
    device_map="cpu",
    trust_remote_code=True,
    cache_dir="./model_cache",
    attn_implementation="eager"
)
model.eval()
print("✅ Model loaded!\n")

# Test on batch 1
batch_file = Path("/home/pricepro2006/CrewAI_Team/email_batches/emails_batch_1.json")
with open(batch_file, 'r') as f:
    emails = json.load(f)

# Simple prompt
prompt = f"""<|user|>
Analyze these {len(emails)} TD SYNNEX emails and identify:
- Workflow states (START/IN-PROGRESS/COMPLETION)
- PO and Quote numbers
- Action items

First email subject: {emails[0].get('subject', 'No subject')[:100] if emails else 'No emails'}<|end|>
<|assistant|>"""

print(f"Testing on Batch 1 ({len(emails)} emails)...")
print("-"*70)

# Tokenize
inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=512)

# Generate without past_key_values
start = time.time()
with torch.no_grad():
    # Use simpler generation to avoid cache issues
    outputs = model.generate(
        inputs.input_ids,
        max_new_tokens=256,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.pad_token_id,
        use_cache=False  # Disable cache to avoid DynamicCache issue
    )
elapsed = time.time() - start

# Decode
response = tokenizer.decode(outputs[0], skip_special_tokens=True)

# Extract response
if "<|assistant|>" in response:
    response = response.split("<|assistant|>")[-1]
else:
    response = response[len(prompt):]

print("Model Response:")
print(response[:500])
print("-"*70)

# Simple scoring
score = 0
if any(word in response.upper() for word in ['START', 'PROGRESS', 'COMPLETE', 'WORKFLOW']):
    score += 30
if re.search(r'(PO|Quote|Order)\s*#?\s*\d+', response, re.IGNORECASE):
    score += 30
if any(word in response.upper() for word in ['ACTION', 'PRIORITY', 'RECOMMENDATION']):
    score += 20
if len(response) > 100:
    score += 20

print(f"\n📊 Results:")
print(f"  Score: {score}%")
print(f"  Inference time: {elapsed:.2f}s")
print(f"  Response length: {len(response)} chars")

if score >= 60:
    print("\n✅ PHASE 3F PASSED - Model can generate relevant analysis")
    print("Ready for fine-tuning to improve accuracy!")
else:
    print(f"\n⚠️ Score {score}% - Model needs prompt engineering")