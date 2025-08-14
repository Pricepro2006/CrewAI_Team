#!/usr/bin/env python3
"""
Phase 4: Evaluation Framework for Phi-2
Compare Phi-2 outputs against Claude's ground truth analysis
"""

import json
import re
import time
import torch
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
import logging
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import numpy as np

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class EvaluationResult:
    """Result for a single batch evaluation"""
    batch_number: int
    workflow_score: float
    entity_score: float
    action_score: float
    business_intelligence_score: float
    communication_score: float
    structural_score: float
    overall_score: float
    inference_time: float
    model_output: str
    ground_truth: str

@dataclass 
class EvaluationReport:
    """Overall evaluation report"""
    model_name: str
    total_batches: int
    average_score: float
    workflow_accuracy: float
    entity_accuracy: float
    action_accuracy: float
    business_intelligence_accuracy: float
    communication_accuracy: float
    structural_accuracy: float
    average_inference_time: float
    batches_above_threshold: int
    threshold: float = 70.0
    timestamp: str = ""
    detailed_results: List[EvaluationResult] = None

class Phi2Evaluator:
    """Evaluator for Phi-2 fine-tuned model"""
    
    def __init__(self, model_path: str = None, use_lora: bool = True):
        self.model_path = model_path or "./phi2-email-finetuned"
        self.use_lora = use_lora
        self.model = None
        self.tokenizer = None
        self.claude_analyses = {}
        self.results = []
        
        # Scoring weights (same as original)
        self.category_weights = {
            'entity_extraction': 0.30,
            'workflow_detection': 0.25,
            'business_intelligence': 0.25,
            'communication_analysis': 0.10,
            'structural_quality': 0.10
        }
        
    def load_model(self):
        """Load Phi-2 model and tokenizer"""
        logger.info(f"Loading Phi-2 model from {self.model_path}")
        
        # Load tokenizer
        if self.use_lora:
            # If using LoRA, load base tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                "microsoft/phi-2",
                trust_remote_code=True,
                padding_side='left'
            )
        else:
            # Load from fine-tuned path
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_path,
                trust_remote_code=True,
                padding_side='left'
            )
        
        # Set padding token
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        
        # Load model
        if self.use_lora and Path(self.model_path).exists():
            # Load base model
            logger.info("Loading base Phi-2 model...")
            base_model = AutoModelForCausalLM.from_pretrained(
                "microsoft/phi-2",
                torch_dtype=torch.float32,
                device_map='cpu',
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
            
            # Load LoRA weights
            logger.info("Loading LoRA weights...")
            self.model = PeftModel.from_pretrained(base_model, self.model_path)
            self.model = self.model.merge_and_unload()  # Merge for faster inference
            
        else:
            # Load full model
            logger.info("Loading Phi-2 model...")
            self.model = AutoModelForCausalLM.from_pretrained(
                "microsoft/phi-2" if not Path(self.model_path).exists() else self.model_path,
                torch_dtype=torch.float32,
                device_map='cpu',
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
        
        # Set to eval mode
        self.model.eval()
        logger.info("Model loaded successfully!")
        
    def load_claude_analyses(self):
        """Load Claude's ground truth analyses"""
        analysis_file = Path("/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md")
        
        logger.info("Loading Claude's ground truth analyses...")
        
        with open(analysis_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract batch analyses
        batch_sections = re.split(r'## Batch (\d+) Analysis\n', content)
        
        for i in range(1, len(batch_sections), 2):
            if i < len(batch_sections) - 1:
                batch_num = int(batch_sections[i])
                analysis_section = batch_sections[i + 1]
                
                # Extract analysis text
                text_match = re.search(r'\[TextBlock\(citations=None, text=["\'](.+?)["\'], type=', 
                                     analysis_section, re.DOTALL)
                
                if text_match:
                    analysis_text = text_match.group(1)
                    analysis = analysis_text.replace('\\n', '\n').replace('\\t', '\t')
                    analysis = analysis.replace('\\"', '"').replace("\\'", "'")
                    self.claude_analyses[batch_num] = analysis
        
        logger.info(f"Loaded {len(self.claude_analyses)} Claude analyses")
        
    def create_prompt(self, batch_num: int) -> str:
        """Create evaluation prompt for Phi-2"""
        # Simple format for Phi-2
        prompt = f"""Analyze this batch of TD SYNNEX emails and provide a comprehensive business intelligence report.

Focus on:
1. Workflow State Identification (START, IN-PROGRESS, COMPLETION)
2. Entity Extraction (PO numbers, quotes, customers, amounts)
3. Action Items and Priority Assessment
4. Communication Patterns and Stakeholders
5. Business Risks and Opportunities
6. Strategic Recommendations

Email Batch #{batch_num} Context:
This batch contains business emails from TD SYNNEX communications.

Analysis:"""
        
        return prompt
        
    def generate_analysis(self, batch_num: int) -> Tuple[str, float]:
        """Generate analysis using Phi-2"""
        prompt = self.create_prompt(batch_num)
        
        # Tokenize
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=512
        )
        
        # Add attention mask
        inputs['attention_mask'] = torch.ones_like(inputs['input_ids'])
        
        start_time = time.time()
        
        # Generate
        with torch.no_grad():
            outputs = self.model.generate(
                inputs['input_ids'],
                attention_mask=inputs['attention_mask'],
                max_new_tokens=1024,
                temperature=0.3,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )
        
        inference_time = time.time() - start_time
        
        # Decode
        generated = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract only the generated part (after the prompt)
        if "Analysis:" in generated:
            analysis = generated.split("Analysis:")[-1].strip()
        else:
            analysis = generated[len(prompt):].strip()
        
        return analysis, inference_time
        
    def calculate_scores(self, predicted: str, ground_truth: str) -> Dict[str, float]:
        """Calculate detailed category scores"""
        scores = {}
        
        # 1. Workflow Detection (25%)
        workflow_keywords = {
            'start': ['START', 'INITIAL', 'BEGIN', 'NEW', 'INITIAT'],
            'progress': ['PROGRESS', 'ONGOING', 'PENDING', 'PROCESSING', 'ACTIVE'],
            'complete': ['COMPLET', 'RESOLV', 'CLOSED', 'FINISH', 'DONE']
        }
        
        workflow_score = 0
        for category, keywords in workflow_keywords.items():
            pred_has = any(kw in predicted.upper() for kw in keywords)
            truth_has = any(kw in ground_truth.upper() for kw in keywords)
            if pred_has == truth_has:
                workflow_score += 33.33
        
        scores['workflow'] = min(workflow_score, 100)
        
        # 2. Entity Extraction (30%)
        entity_patterns = {
            'po': r'PO[#\s]*\d{5,}',
            'quote': r'Quote[#\s]*\d{5,}',
            'customer': r'[A-Z][a-z]+\s+(Corp|Inc|LLC|Company)',
            'amount': r'\$[\d,]+\.?\d*'
        }
        
        entity_score = 0
        for entity_type, pattern in entity_patterns.items():
            pred_entities = set(re.findall(pattern, predicted, re.IGNORECASE))
            truth_entities = set(re.findall(pattern, ground_truth, re.IGNORECASE))
            
            if truth_entities:
                overlap = len(pred_entities & truth_entities)
                recall = overlap / len(truth_entities)
                entity_score += recall * 25
        
        scores['entity'] = min(entity_score, 100)
        
        # 3. Action Items (part of BI - 25%)
        action_keywords = ['ACTION', 'RECOMMEND', 'PRIORITY', 'FOLLOW', 'NEXT', 'REQUIRE', 'URGENT']
        action_found = sum(1 for kw in action_keywords if kw in predicted.upper())
        scores['action'] = min((action_found / len(action_keywords)) * 100, 100)
        
        # 4. Business Intelligence (25%)
        bi_keywords = ['RISK', 'OPPORTUNITY', 'EFFICIENCY', 'BOTTLENECK', 'TREND', 'PATTERN', 'INSIGHT']
        bi_found = sum(1 for kw in bi_keywords if kw in predicted.upper())
        scores['business_intelligence'] = min((bi_found / len(bi_keywords)) * 100, 100)
        
        # 5. Communication Analysis (10%)
        comm_keywords = ['STAKEHOLDER', 'COMMUNICATION', 'RESPONSE', 'DELAY', 'ESCALAT']
        comm_found = sum(1 for kw in comm_keywords if kw in predicted.upper())
        scores['communication'] = min((comm_found / len(comm_keywords)) * 100, 100)
        
        # 6. Structural Quality (10%)
        structural_score = 0
        if len(predicted) > 100:  # Minimum length
            structural_score += 25
        if '\n' in predicted:  # Has structure
            structural_score += 25
        if any(num in predicted for num in ['1.', '2.', '3.', '-', '•']):  # Has formatting
            structural_score += 25
        if len(predicted) > len(ground_truth) * 0.3:  # Reasonable length
            structural_score += 25
        
        scores['structural'] = min(structural_score, 100)
        
        # Calculate overall weighted score
        scores['overall'] = sum(
            scores.get(key, 0) * self.category_weights.get(key.replace('_score', ''), 0)
            for key in ['entity', 'workflow', 'action', 'business_intelligence', 'communication', 'structural']
        )
        
        return scores
        
    def evaluate_batch(self, batch_num: int) -> Optional[EvaluationResult]:
        """Evaluate a single batch"""
        if batch_num not in self.claude_analyses:
            logger.warning(f"No ground truth for batch {batch_num}")
            return None
        
        ground_truth = self.claude_analyses[batch_num]
        
        logger.info(f"Evaluating batch {batch_num}...")
        
        # Generate analysis
        predicted, inference_time = self.generate_analysis(batch_num)
        
        # Calculate scores
        scores = self.calculate_scores(predicted, ground_truth)
        
        result = EvaluationResult(
            batch_number=batch_num,
            workflow_score=scores['workflow'],
            entity_score=scores['entity'],
            action_score=scores['action'],
            business_intelligence_score=scores['business_intelligence'],
            communication_score=scores['communication'],
            structural_score=scores['structural'],
            overall_score=scores['overall'],
            inference_time=inference_time,
            model_output=predicted[:500],  # First 500 chars for logging
            ground_truth=ground_truth[:500]
        )
        
        logger.info(f"  Batch {batch_num}: Score={scores['overall']:.1f}%, Time={inference_time:.1f}s")
        
        return result
        
    def run_evaluation(self, num_batches: int = 25):
        """Run full evaluation"""
        logger.info("="*80)
        logger.info("PHI-2 EVALUATION FRAMEWORK")
        logger.info("="*80)
        
        # Load model and data
        self.load_model()
        self.load_claude_analyses()
        
        # Select test batches
        available_batches = list(self.claude_analyses.keys())[:100]
        step = max(1, len(available_batches) // num_batches)
        test_batches = available_batches[::step][:num_batches]
        
        logger.info(f"Testing {len(test_batches)} batches")
        
        # Evaluate each batch
        for batch_num in test_batches:
            result = self.evaluate_batch(batch_num)
            if result:
                self.results.append(result)
        
        # Generate report
        self.generate_report()
        
    def generate_report(self):
        """Generate evaluation report"""
        if not self.results:
            logger.error("No results to report")
            return
        
        # Calculate aggregates
        num_results = len(self.results)
        
        report = EvaluationReport(
            model_name="microsoft/phi-2",
            total_batches=num_results,
            average_score=np.mean([r.overall_score for r in self.results]),
            workflow_accuracy=np.mean([r.workflow_score for r in self.results]),
            entity_accuracy=np.mean([r.entity_score for r in self.results]),
            action_accuracy=np.mean([r.action_score for r in self.results]),
            business_intelligence_accuracy=np.mean([r.business_intelligence_score for r in self.results]),
            communication_accuracy=np.mean([r.communication_score for r in self.results]),
            structural_accuracy=np.mean([r.structural_score for r in self.results]),
            average_inference_time=np.mean([r.inference_time for r in self.results]),
            batches_above_threshold=sum(1 for r in self.results if r.overall_score >= 70),
            timestamp=datetime.now().isoformat(),
            detailed_results=self.results
        )
        
        # Print report
        print("\n" + "="*80)
        print("PHI-2 EVALUATION REPORT")
        print("="*80)
        print(f"Model: {report.model_name}")
        print(f"Total Batches: {report.total_batches}")
        print(f"Average Score: {report.average_score:.1f}%")
        print(f"Batches Above 70%: {report.batches_above_threshold}/{report.total_batches}")
        
        print("\n📊 CATEGORY SCORES:")
        print(f"  Workflow Detection: {report.workflow_accuracy:.1f}%")
        print(f"  Entity Extraction: {report.entity_accuracy:.1f}%")
        print(f"  Action Detection: {report.action_accuracy:.1f}%")
        print(f"  Business Intelligence: {report.business_intelligence_accuracy:.1f}%")
        print(f"  Communication Analysis: {report.communication_accuracy:.1f}%")
        print(f"  Structural Quality: {report.structural_accuracy:.1f}%")
        
        print(f"\n⏱️ PERFORMANCE:")
        print(f"  Average Inference Time: {report.average_inference_time:.1f}s")
        
        # Save report
        report_file = Path(f"phi2_evaluation_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        report_dict = asdict(report)
        report_dict['detailed_results'] = [asdict(r) for r in self.results]
        
        with open(report_file, 'w') as f:
            json.dump(report_dict, f, indent=2)
        
        print(f"\n📄 Report saved to: {report_file}")
        
        # Final verdict
        print("\n" + "="*80)
        print("VERDICT")
        print("="*80)
        
        if report.average_score >= 70:
            print(f"✅ SUCCESS: {report.average_score:.1f}% - Ready for deployment!")
        elif report.average_score >= 60:
            print(f"⚠️ NEEDS IMPROVEMENT: {report.average_score:.1f}% - More training needed")
        else:
            print(f"❌ INSUFFICIENT: {report.average_score:.1f}% - Significant training required")

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Evaluate Phi-2 model")
    parser.add_argument('--model-path', type=str, default="./phi2-email-finetuned",
                       help='Path to fine-tuned model')
    parser.add_argument('--num-batches', type=int, default=25,
                       help='Number of batches to test')
    parser.add_argument('--use-lora', action='store_true',
                       help='Model uses LoRA adapters')
    
    args = parser.parse_args()
    
    evaluator = Phi2Evaluator(
        model_path=args.model_path,
        use_lora=args.use_lora
    )
    
    evaluator.run_evaluation(num_batches=args.num_batches)

if __name__ == "__main__":
    main()