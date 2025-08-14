#!/usr/bin/env python3
"""
Phase 3f: Small Batch Test Against Claude's Analysis
Tests Phi-3.5-mini on 3 email batches and compares to ground truth
"""

import json
import torch
import time
import re
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM

class Phase3fTester:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.claude_analysis = {}
        
    def load_model(self):
        """Load Phi-3.5-mini model"""
        print("📥 Loading Phi-3.5-mini-instruct model...")
        
        self.tokenizer = AutoTokenizer.from_pretrained(
            "microsoft/Phi-3.5-mini-instruct",
            trust_remote_code=True,
            cache_dir="./model_cache"
        )
        
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
            
        self.model = AutoModelForCausalLM.from_pretrained(
            "microsoft/Phi-3.5-mini-instruct",
            torch_dtype=torch.float32,
            device_map="cpu",
            trust_remote_code=True,
            cache_dir="./model_cache",
            attn_implementation="eager"  # Fix for window_size issue
        )
        self.model.eval()
        print("✅ Model loaded successfully!")
        
    def load_claude_analysis(self, batch_num: int):
        """Load Claude's analysis for a specific batch"""
        analysis_file = Path("/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md")
        
        with open(analysis_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract specific batch analysis
        pattern = rf'## Batch {batch_num} Analysis\n\n(.*?)(?=## Batch \d+ Analysis|$)'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            return match.group(1).strip()
        return None
        
    def generate_analysis(self, batch_num: int):
        """Generate analysis for a batch"""
        # Load email batch
        batch_file = Path(f"/home/pricepro2006/CrewAI_Team/email_batches/emails_batch_{batch_num}.json")
        
        if not batch_file.exists():
            return None
            
        with open(batch_file, 'r') as f:
            emails = json.load(f)
            
        # Create prompt
        email_summary = f"Batch {batch_num} contains {len(emails)} TD SYNNEX emails"
        
        prompt = f"""<|user|>
Analyze this TD SYNNEX email batch and identify:
1. Workflow states (START, IN-PROGRESS, COMPLETION)
2. Key entities (PO numbers, quotes, customers)
3. Action items and priorities
4. Business insights

{email_summary}

Key subjects: {', '.join([e.get('subject', 'No subject')[:50] for e in emails[:3]])}...<|end|>
<|assistant|>"""
        
        # Generate
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=1024)
        
        start_time = time.time()
        with torch.no_grad():
            outputs = self.model.generate(
                inputs.input_ids,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
                attention_mask=inputs.attention_mask
            )
        inference_time = time.time() - start_time
        
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract assistant response
        if "<|assistant|>" in response:
            response = response.split("<|assistant|>")[-1].strip()
        else:
            response = response[len(prompt):].strip()
            
        return response, inference_time
        
    def calculate_score(self, predicted: str, ground_truth: str):
        """Calculate similarity score between predicted and ground truth"""
        score = 0.0
        
        # Check for key patterns
        patterns = {
            'workflow_states': ['START', 'IN-PROGRESS', 'COMPLETION', '🔴', '🟡', '🟢'],
            'entities': [r'PO\s*#?\d+', r'Quote\s*#?\d+', r'Order\s*#?\d+'],
            'action_items': ['ACTION', 'RECOMMENDATION', 'Priority'],
            'structure': ['##', '###', '-', '*']
        }
        
        for category, items in patterns.items():
            category_score = 0
            for pattern in items:
                if re.search(pattern, predicted, re.IGNORECASE):
                    category_score += 1
                if re.search(pattern, ground_truth, re.IGNORECASE):
                    category_score += 0.5  # Bonus if also in ground truth
            
            score += min(category_score / len(items), 1.0) * 25  # 25% per category
            
        return min(score, 100)
        
    def run_test(self):
        """Run Phase 3f test on 3 batches"""
        print("\n" + "="*70)
        print("PHASE 3F: SMALL BATCH TEST")
        print("="*70)
        
        # Load model
        self.load_model()
        
        # Test on batches 1, 2, 3
        test_batches = [1, 2, 3]
        results = []
        
        for batch_num in test_batches:
            print(f"\n📊 Testing Batch {batch_num}...")
            
            # Get ground truth
            ground_truth = self.load_claude_analysis(batch_num)
            if not ground_truth:
                print(f"  ⚠️ No ground truth found for batch {batch_num}")
                continue
                
            # Generate analysis
            predicted, inference_time = self.generate_analysis(batch_num)
            
            if not predicted:
                print(f"  ❌ Failed to generate analysis")
                continue
                
            # Calculate score
            score = self.calculate_score(predicted, ground_truth)
            
            results.append({
                'batch': batch_num,
                'score': score,
                'inference_time': inference_time,
                'predicted_length': len(predicted),
                'ground_truth_length': len(ground_truth)
            })
            
            print(f"  ✅ Score: {score:.1f}%")
            print(f"  ⏱️ Inference: {inference_time:.2f}s")
            print(f"  📝 Generated: {len(predicted)} chars (Ground truth: {len(ground_truth)} chars)")
            
        # Summary
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        
        if results:
            avg_score = sum(r['score'] for r in results) / len(results)
            avg_time = sum(r['inference_time'] for r in results) / len(results)
            
            print(f"Average Score: {avg_score:.1f}%")
            print(f"Average Inference Time: {avg_time:.2f}s")
            
            if avg_score >= 70:
                print("\n✅ PHASE 3F PASSED - Ready for full training (Phase 3g)")
                return True
            else:
                print(f"\n⚠️ PHASE 3F NEEDS IMPROVEMENT - Score {avg_score:.1f}% < 70%")
                print("Recommendations:")
                print("1. Fine-tune the model with more training data")
                print("2. Adjust prompt templates for better alignment")
                print("3. Consider using a larger model or different architecture")
                return False
        else:
            print("❌ No successful tests completed")
            return False

if __name__ == "__main__":
    tester = Phase3fTester()
    success = tester.run_test()
    
    if success:
        print("\n🚀 Next Step: Run Phase 3g full adaptive training")
        print("Command: python3 train_phi3_adaptive.py")
    else:
        print("\n🔧 Next Step: Review and improve the model/prompts")