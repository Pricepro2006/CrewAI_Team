#!/usr/bin/env python3
"""
Phase 4: Comprehensive Evaluation Framework for Phi-3.5-mini
Compares model outputs against Claude's ground truth analysis
Scores on multiple factors for each email batch
"""

import json
import re
import time
import torch
import logging
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class EvaluationMetrics:
    """Comprehensive evaluation metrics for email batch analysis"""
    # Entity Extraction (30% weight)
    po_numbers_recall: float = 0.0
    po_numbers_precision: float = 0.0
    quote_numbers_recall: float = 0.0
    quote_numbers_precision: float = 0.0
    customer_names_accuracy: float = 0.0
    financial_amounts_accuracy: float = 0.0
    
    # Workflow Detection (25% weight)
    workflow_states_accuracy: float = 0.0
    start_points_detected: float = 0.0
    in_progress_detected: float = 0.0
    completion_markers_detected: float = 0.0
    
    # Business Intelligence (25% weight)
    action_items_recall: float = 0.0
    priority_assessment_accuracy: float = 0.0
    risk_identification: float = 0.0
    opportunity_identification: float = 0.0
    
    # Communication Analysis (10% weight)
    stakeholder_identification: float = 0.0
    interaction_patterns: float = 0.0
    urgency_detection: float = 0.0
    
    # Structural Quality (10% weight)
    completeness_score: float = 0.0
    organization_score: float = 0.0
    detail_depth_score: float = 0.0
    
    # Performance Metrics
    inference_time: float = 0.0
    tokens_generated: int = 0
    
    # Overall Score
    overall_score: float = 0.0
    batch_number: int = 0

class ClaudeAnalysisParser:
    """Parse and extract key elements from Claude's analysis"""
    
    def __init__(self, analysis_file_path: str):
        self.analysis_file = Path(analysis_file_path)
        self.batch_analyses = self._load_and_parse_analysis()
        
    def _load_and_parse_analysis(self) -> Dict[int, Dict]:
        """Load and parse Claude's analysis file"""
        with open(self.analysis_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract batch analyses
        pattern = r'## Batch (\d+) Analysis\n\n\[TextBlock\(citations=None, text=["\'](.+?)["\'], type'
        matches = re.findall(pattern, content, re.DOTALL)
        
        batch_data = {}
        for batch_num, analysis_text in matches:
            batch_data[int(batch_num)] = self._extract_analysis_components(analysis_text)
        
        logger.info(f"Parsed {len(batch_data)} batch analyses from Claude's file")
        return batch_data
    
    def _extract_analysis_components(self, analysis_text: str) -> Dict:
        """Extract structured components from analysis text"""
        components = {
            'raw_text': analysis_text,
            'workflow_states': self._extract_workflow_states(analysis_text),
            'entities': self._extract_entities(analysis_text),
            'action_items': self._extract_action_items(analysis_text),
            'priorities': self._extract_priorities(analysis_text),
            'stakeholders': self._extract_stakeholders(analysis_text),
            'metrics': self._extract_metrics(analysis_text),
            'recommendations': self._extract_recommendations(analysis_text)
        }
        return components
    
    def _extract_workflow_states(self, text: str) -> Dict:
        """Extract workflow state information"""
        states = {
            'start_points': [],
            'in_progress': [],
            'completion_markers': []
        }
        
        # Extract START POINTS
        start_pattern = r'(?:START POINTS?|🔴[^🟡🟢]*?)(?:.*?)\n((?:[-•]\s*.+\n?)+)'
        start_matches = re.findall(start_pattern, text, re.MULTILINE)
        for match in start_matches:
            states['start_points'].extend([line.strip('- •\n') for line in match.split('\n') if line.strip()])
        
        # Extract IN-PROGRESS
        progress_pattern = r'(?:IN-PROGRESS|🟡[^🔴🟢]*?)(?:.*?)\n((?:[-•]\s*.+\n?)+)'
        progress_matches = re.findall(progress_pattern, text, re.MULTILINE)
        for match in progress_matches:
            states['in_progress'].extend([line.strip('- •\n') for line in match.split('\n') if line.strip()])
        
        # Extract COMPLETION
        complete_pattern = r'(?:COMPLETION|🟢[^🔴🟡]*?)(?:.*?)\n((?:[-•]\s*.+\n?)+)'
        complete_matches = re.findall(complete_pattern, text, re.MULTILINE)
        for match in complete_matches:
            states['completion_markers'].extend([line.strip('- •\n') for line in match.split('\n') if line.strip()])
        
        return states
    
    def _extract_entities(self, text: str) -> Dict:
        """Extract business entities from text"""
        entities = {
            'po_numbers': re.findall(r'PO[#\s]*(\d{6,10})', text),
            'quote_numbers': re.findall(r'Quote[#\s]*(\d{6,})', text),
            'order_numbers': re.findall(r'Order[#\s]*(\d{6,})', text),
            'case_numbers': re.findall(r'(?:Case|Ticket)[#\s]*([A-Z0-9-]+)', text),
            'financial_amounts': re.findall(r'\$[\d,]+(?:\.\d{2})?', text),
            'product_ids': re.findall(r'[A-Z0-9]{3,}-[A-Z0-9]+', text)
        }
        return entities
    
    def _extract_action_items(self, text: str) -> List[str]:
        """Extract action items from analysis"""
        action_section = re.search(r'ACTION ITEM.*?\n((?:[-•\d]\s*.+\n?)+)', text, re.MULTILINE)
        if action_section:
            items = [line.strip('- •\n1234567890. ') for line in action_section.group(1).split('\n') if line.strip()]
            return items
        return []
    
    def _extract_priorities(self, text: str) -> Dict:
        """Extract priority and urgency information"""
        priorities = {
            'high': [],
            'medium': [],
            'low': [],
            'urgent': []
        }
        
        # Look for priority indicators
        high_pattern = r'(?:HIGH|CRITICAL|URGENT).*?:\s*(.+?)(?:\n|$)'
        medium_pattern = r'(?:MEDIUM|MODERATE).*?:\s*(.+?)(?:\n|$)'
        
        for match in re.findall(high_pattern, text, re.IGNORECASE):
            priorities['high'].append(match.strip())
        
        for match in re.findall(medium_pattern, text, re.IGNORECASE):
            priorities['medium'].append(match.strip())
        
        return priorities
    
    def _extract_stakeholders(self, text: str) -> List[str]:
        """Extract stakeholder names"""
        # Look for participant/stakeholder sections
        stakeholder_pattern = r'(?:Participants?|Stakeholders?|Contacts?).*?\n((?:[-•]\s*.+\n?)+)'
        matches = re.findall(stakeholder_pattern, text, re.MULTILINE | re.IGNORECASE)
        
        stakeholders = []
        for match in matches:
            names = [line.strip('- •\n') for line in match.split('\n') if line.strip()]
            stakeholders.extend(names)
        
        # Also extract names from email pattern
        email_names = re.findall(r'([A-Z][a-z]+ [A-Z][a-z]+)', text)
        stakeholders.extend(email_names)
        
        return list(set(stakeholders))  # Unique names
    
    def _extract_metrics(self, text: str) -> Dict:
        """Extract performance metrics and scores"""
        metrics = {}
        
        # Look for workflow health score
        score_match = re.search(r'(?:SCORE|Rating).*?(\d+(?:\.\d+)?)/10', text, re.IGNORECASE)
        if score_match:
            metrics['workflow_health'] = float(score_match.group(1))
        
        # Response times
        time_match = re.search(r'(?:Response|Resolution).*?(\d+)\s*(?:hours?|days?)', text, re.IGNORECASE)
        if time_match:
            metrics['response_time'] = time_match.group(1)
        
        return metrics
    
    def _extract_recommendations(self, text: str) -> List[str]:
        """Extract recommendations"""
        rec_pattern = r'RECOMMENDATION.*?\n((?:[-•\d]\s*.+\n?)+)'
        matches = re.findall(rec_pattern, text, re.MULTILINE | re.IGNORECASE)
        
        recommendations = []
        for match in matches:
            items = [line.strip('- •\n1234567890. ') for line in match.split('\n') if line.strip()]
            recommendations.extend(items)
        
        return recommendations

class Phi35EvaluationFramework:
    """Evaluation framework for Phi-3.5-mini against Claude's analysis"""
    
    def __init__(self, model_path: str = None):
        self.model_path = model_path or "./phi3-mini-finetuned"
        self.claude_parser = ClaudeAnalysisParser("/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md")
        self.email_batches_dir = Path("email_batches")
        self.results_dir = Path("evaluation_results")
        self.results_dir.mkdir(exist_ok=True)
        
        # Model components (will be loaded when needed)
        self.tokenizer = None
        self.model = None
        
        # Evaluation weights
        self.category_weights = {
            'entity_extraction': 0.30,
            'workflow_detection': 0.25,
            'business_intelligence': 0.25,
            'communication_analysis': 0.10,
            'structural_quality': 0.10
        }
        
    def load_model(self):
        """Load Phi-3.5-mini model with LoRA weights"""
        logger.info(f"Loading model from {self.model_path}")
        
        try:
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                "microsoft/Phi-3.5-mini-instruct",
                trust_remote_code=True
            )
            
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Check if fine-tuned model exists
            if Path(self.model_path).exists():
                # Load fine-tuned model
                self.model = AutoModelForCausalLM.from_pretrained(
                    self.model_path,
                    torch_dtype=torch.float32,
                    device_map="cpu",
                    trust_remote_code=True
                )
            else:
                # Load base model for testing
                logger.warning(f"Fine-tuned model not found at {self.model_path}, loading base model")
                self.model = AutoModelForCausalLM.from_pretrained(
                    "microsoft/Phi-3.5-mini-instruct",
                    torch_dtype=torch.float32,
                    device_map="cpu",
                    trust_remote_code=True,
                    cache_dir="./model_cache"
                )
            
            self.model.eval()
            logger.info("Model loaded successfully")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    def load_email_batch(self, batch_number: int) -> Dict:
        """Load email batch data"""
        batch_file = self.email_batches_dir / f"emails_batch_{batch_number}.json"
        
        if not batch_file.exists():
            logger.error(f"Batch file not found: {batch_file}")
            return None
        
        with open(batch_file, 'r') as f:
            return json.load(f)
    
    def generate_analysis(self, batch_number: int, max_tokens: int = 2048) -> str:
        """Generate analysis for an email batch using the model"""
        
        # Load email batch
        batch_data = self.load_email_batch(batch_number)
        if not batch_data:
            return ""
        
        # Prepare prompt
        prompt = self._create_analysis_prompt(batch_data)
        
        # Tokenize
        inputs = self.tokenizer(
            prompt,
            return_tensors="pt",
            truncation=True,
            max_length=4096  # Use larger context for Phi-3.5
        )
        
        # Generate
        start_time = time.time()
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=0.7,
                do_sample=True,
                top_p=0.9,
                pad_token_id=self.tokenizer.pad_token_id,
                eos_token_id=self.tokenizer.eos_token_id
            )
        
        inference_time = time.time() - start_time
        
        # Decode
        generated_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # Extract just the model's response
        if "<|assistant|>" in generated_text:
            generated_text = generated_text.split("<|assistant|>")[-1].strip()
        
        return generated_text, inference_time
    
    def _create_analysis_prompt(self, batch_data: Dict) -> str:
        """Create analysis prompt for Phi-3.5"""
        
        # Extract email contents
        emails_text = ""
        for i, email in enumerate(batch_data.get('emails', [])[:10], 1):  # Limit to 10 emails
            emails_text += f"\nEmail {i}:\n"
            emails_text += f"From: {email.get('from', 'Unknown')}\n"
            emails_text += f"To: {email.get('to', 'Unknown')}\n"
            emails_text += f"Subject: {email.get('subject', 'No subject')}\n"
            emails_text += f"Body: {email.get('body', '')[:500]}...\n"  # Truncate long bodies
        
        prompt = f"""<|user|>
Analyze the following TD SYNNEX email batch and provide a comprehensive business intelligence report.

Focus on:
1. Workflow State Identification (START, IN-PROGRESS, COMPLETION)
2. Entity Extraction (PO numbers, quotes, customers, amounts)
3. Action Items and Priority Assessment
4. Communication Patterns and Stakeholders
5. Business Risks and Opportunities
6. Strategic Recommendations

Email Batch Content:
{emails_text}

Provide a detailed analysis following the structure used in professional business intelligence reports.<|end|>
<|assistant|>"""
        
        return prompt
    
    def evaluate_batch(self, batch_number: int) -> EvaluationMetrics:
        """Evaluate model performance on a single batch"""
        
        logger.info(f"Evaluating batch {batch_number}")
        
        # Get Claude's ground truth
        if batch_number not in self.claude_parser.batch_analyses:
            logger.warning(f"No ground truth found for batch {batch_number}")
            return None
        
        ground_truth = self.claude_parser.batch_analyses[batch_number]
        
        # Generate model analysis
        model_output, inference_time = self.generate_analysis(batch_number)
        
        # Parse model output
        model_components = self._parse_model_output(model_output)
        
        # Calculate metrics
        metrics = self._calculate_metrics(ground_truth, model_components)
        metrics.batch_number = batch_number
        metrics.inference_time = inference_time
        metrics.tokens_generated = len(self.tokenizer.encode(model_output))
        
        # Calculate overall score
        metrics.overall_score = self._calculate_overall_score(metrics)
        
        # Save detailed results
        self._save_evaluation_results(batch_number, ground_truth, model_output, metrics)
        
        return metrics
    
    def _parse_model_output(self, output: str) -> Dict:
        """Parse model output to extract components"""
        # Reuse Claude parser methods for consistency
        parser = ClaudeAnalysisParser.__new__(ClaudeAnalysisParser)
        
        components = {
            'raw_text': output,
            'workflow_states': parser._extract_workflow_states(output),
            'entities': parser._extract_entities(output),
            'action_items': parser._extract_action_items(output),
            'priorities': parser._extract_priorities(output),
            'stakeholders': parser._extract_stakeholders(output),
            'metrics': parser._extract_metrics(output),
            'recommendations': parser._extract_recommendations(output)
        }
        
        return components
    
    def _calculate_metrics(self, ground_truth: Dict, model_output: Dict) -> EvaluationMetrics:
        """Calculate detailed metrics comparing model output to ground truth"""
        
        metrics = EvaluationMetrics()
        
        # Entity Extraction Metrics
        metrics.po_numbers_recall = self._calculate_recall(
            ground_truth['entities']['po_numbers'],
            model_output['entities']['po_numbers']
        )
        metrics.po_numbers_precision = self._calculate_precision(
            ground_truth['entities']['po_numbers'],
            model_output['entities']['po_numbers']
        )
        
        metrics.quote_numbers_recall = self._calculate_recall(
            ground_truth['entities']['quote_numbers'],
            model_output['entities']['quote_numbers']
        )
        metrics.quote_numbers_precision = self._calculate_precision(
            ground_truth['entities']['quote_numbers'],
            model_output['entities']['quote_numbers']
        )
        
        # Workflow Detection Metrics
        metrics.start_points_detected = self._calculate_overlap(
            ground_truth['workflow_states']['start_points'],
            model_output['workflow_states']['start_points']
        )
        metrics.in_progress_detected = self._calculate_overlap(
            ground_truth['workflow_states']['in_progress'],
            model_output['workflow_states']['in_progress']
        )
        metrics.completion_markers_detected = self._calculate_overlap(
            ground_truth['workflow_states']['completion_markers'],
            model_output['workflow_states']['completion_markers']
        )
        
        # Business Intelligence Metrics
        metrics.action_items_recall = self._calculate_recall(
            ground_truth['action_items'],
            model_output['action_items']
        )
        
        # Communication Analysis
        metrics.stakeholder_identification = self._calculate_overlap(
            ground_truth['stakeholders'],
            model_output['stakeholders']
        )
        
        # Structural Quality
        metrics.completeness_score = self._calculate_completeness(model_output)
        metrics.detail_depth_score = len(model_output['raw_text']) / max(len(ground_truth['raw_text']), 1)
        metrics.detail_depth_score = min(metrics.detail_depth_score, 1.0)  # Cap at 1.0
        
        return metrics
    
    def _calculate_recall(self, ground_truth: List, predicted: List) -> float:
        """Calculate recall score"""
        if not ground_truth:
            return 1.0 if not predicted else 0.0
        
        found = sum(1 for item in ground_truth if item in predicted)
        return found / len(ground_truth)
    
    def _calculate_precision(self, ground_truth: List, predicted: List) -> float:
        """Calculate precision score"""
        if not predicted:
            return 1.0 if not ground_truth else 0.0
        
        correct = sum(1 for item in predicted if item in ground_truth)
        return correct / len(predicted)
    
    def _calculate_overlap(self, ground_truth: List, predicted: List) -> float:
        """Calculate overlap/similarity between two lists"""
        if not ground_truth and not predicted:
            return 1.0
        if not ground_truth or not predicted:
            return 0.0
        
        # Use Jaccard similarity
        set_gt = set(str(item).lower() for item in ground_truth)
        set_pred = set(str(item).lower() for item in predicted)
        
        intersection = len(set_gt & set_pred)
        union = len(set_gt | set_pred)
        
        return intersection / union if union > 0 else 0.0
    
    def _calculate_completeness(self, output: Dict) -> float:
        """Calculate how complete the analysis is"""
        expected_sections = [
            'workflow_states', 'entities', 'action_items',
            'priorities', 'stakeholders', 'recommendations'
        ]
        
        score = 0.0
        for section in expected_sections:
            if section in output and output[section]:
                # Check if section has meaningful content
                if isinstance(output[section], dict):
                    has_content = any(v for v in output[section].values())
                elif isinstance(output[section], list):
                    has_content = len(output[section]) > 0
                else:
                    has_content = bool(output[section])
                
                if has_content:
                    score += 1.0
        
        return score / len(expected_sections)
    
    def _calculate_overall_score(self, metrics: EvaluationMetrics) -> float:
        """Calculate weighted overall score"""
        
        # Entity Extraction Score (30%)
        entity_score = np.mean([
            metrics.po_numbers_recall,
            metrics.po_numbers_precision,
            metrics.quote_numbers_recall,
            metrics.quote_numbers_precision,
            metrics.customer_names_accuracy,
            metrics.financial_amounts_accuracy
        ])
        
        # Workflow Detection Score (25%)
        workflow_score = np.mean([
            metrics.workflow_states_accuracy,
            metrics.start_points_detected,
            metrics.in_progress_detected,
            metrics.completion_markers_detected
        ])
        
        # Business Intelligence Score (25%)
        bi_score = np.mean([
            metrics.action_items_recall,
            metrics.priority_assessment_accuracy,
            metrics.risk_identification,
            metrics.opportunity_identification
        ])
        
        # Communication Analysis Score (10%)
        comm_score = np.mean([
            metrics.stakeholder_identification,
            metrics.interaction_patterns,
            metrics.urgency_detection
        ])
        
        # Structural Quality Score (10%)
        struct_score = np.mean([
            metrics.completeness_score,
            metrics.organization_score,
            metrics.detail_depth_score
        ])
        
        # Calculate weighted overall score
        overall = (
            entity_score * self.category_weights['entity_extraction'] +
            workflow_score * self.category_weights['workflow_detection'] +
            bi_score * self.category_weights['business_intelligence'] +
            comm_score * self.category_weights['communication_analysis'] +
            struct_score * self.category_weights['structural_quality']
        )
        
        return overall * 100  # Convert to percentage
    
    def _save_evaluation_results(self, batch_number: int, ground_truth: Dict, 
                                 model_output: str, metrics: EvaluationMetrics):
        """Save detailed evaluation results"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_file = self.results_dir / f"batch_{batch_number}_eval_{timestamp}.json"
        
        results = {
            'batch_number': batch_number,
            'timestamp': timestamp,
            'metrics': asdict(metrics),
            'model_output': model_output,
            'ground_truth_summary': {
                'num_entities': len(ground_truth['entities']['po_numbers']) + 
                               len(ground_truth['entities']['quote_numbers']),
                'num_action_items': len(ground_truth['action_items']),
                'num_stakeholders': len(ground_truth['stakeholders']),
                'has_recommendations': len(ground_truth['recommendations']) > 0
            }
        }
        
        with open(result_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Saved evaluation results to {result_file}")
    
    def evaluate_multiple_batches(self, batch_numbers: List[int]) -> Dict:
        """Evaluate multiple batches and generate summary report"""
        
        all_metrics = []
        
        for batch_num in batch_numbers:
            try:
                metrics = self.evaluate_batch(batch_num)
                if metrics:
                    all_metrics.append(metrics)
                    logger.info(f"Batch {batch_num} - Overall Score: {metrics.overall_score:.2f}%")
            except Exception as e:
                logger.error(f"Error evaluating batch {batch_num}: {e}")
        
        # Generate summary report
        if all_metrics:
            summary = self._generate_summary_report(all_metrics)
            self._save_summary_report(summary)
            return summary
        
        return {}
    
    def _generate_summary_report(self, metrics_list: List[EvaluationMetrics]) -> Dict:
        """Generate summary report across all evaluated batches"""
        
        summary = {
            'total_batches': len(metrics_list),
            'average_scores': {},
            'category_scores': {},
            'best_performing_batch': None,
            'worst_performing_batch': None,
            'average_inference_time': 0,
            'total_tokens_generated': 0
        }
        
        # Calculate averages
        for metric_name in asdict(metrics_list[0]).keys():
            if metric_name not in ['batch_number', 'inference_time', 'tokens_generated']:
                values = [getattr(m, metric_name) for m in metrics_list]
                summary['average_scores'][metric_name] = np.mean(values)
        
        # Category scores
        for category in self.category_weights.keys():
            summary['category_scores'][category] = self._calculate_category_average(
                metrics_list, category
            )
        
        # Best and worst
        scores = [(m.batch_number, m.overall_score) for m in metrics_list]
        summary['best_performing_batch'] = max(scores, key=lambda x: x[1])
        summary['worst_performing_batch'] = min(scores, key=lambda x: x[1])
        
        # Performance metrics
        summary['average_inference_time'] = np.mean([m.inference_time for m in metrics_list])
        summary['total_tokens_generated'] = sum(m.tokens_generated for m in metrics_list)
        
        return summary
    
    def _calculate_category_average(self, metrics_list: List[EvaluationMetrics], 
                                   category: str) -> float:
        """Calculate average score for a category"""
        
        if category == 'entity_extraction':
            scores = []
            for m in metrics_list:
                score = np.mean([
                    m.po_numbers_recall, m.po_numbers_precision,
                    m.quote_numbers_recall, m.quote_numbers_precision
                ])
                scores.append(score)
            return np.mean(scores) * 100
        
        # Add other categories as needed
        return 0.0
    
    def _save_summary_report(self, summary: Dict):
        """Save summary report"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = self.results_dir / f"evaluation_summary_{timestamp}.json"
        
        with open(report_file, 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Also create a human-readable report
        report_text = self._format_summary_report(summary)
        text_file = self.results_dir / f"evaluation_summary_{timestamp}.txt"
        
        with open(text_file, 'w') as f:
            f.write(report_text)
        
        logger.info(f"Saved summary report to {report_file}")
    
    def _format_summary_report(self, summary: Dict) -> str:
        """Format summary report for human reading"""
        
        report = "=" * 80 + "\n"
        report += "PHI-3.5-MINI EVALUATION REPORT\n"
        report += "Comparison Against Claude's Ground Truth Analysis\n"
        report += "=" * 80 + "\n\n"
        
        report += f"Total Batches Evaluated: {summary['total_batches']}\n"
        report += f"Average Inference Time: {summary['average_inference_time']:.2f} seconds\n"
        report += f"Total Tokens Generated: {summary['total_tokens_generated']:,}\n\n"
        
        report += "CATEGORY SCORES:\n"
        report += "-" * 40 + "\n"
        for category, score in summary['category_scores'].items():
            report += f"{category.replace('_', ' ').title()}: {score:.2f}%\n"
        
        report += "\nTOP METRICS:\n"
        report += "-" * 40 + "\n"
        for metric, value in list(summary['average_scores'].items())[:10]:
            report += f"{metric.replace('_', ' ').title()}: {value:.3f}\n"
        
        report += f"\nBest Performing Batch: #{summary['best_performing_batch'][0]} "
        report += f"(Score: {summary['best_performing_batch'][1]:.2f}%)\n"
        report += f"Worst Performing Batch: #{summary['worst_performing_batch'][0]} "
        report += f"(Score: {summary['worst_performing_batch'][1]:.2f}%)\n"
        
        return report

def main():
    """Main evaluation pipeline"""
    
    # Initialize framework
    evaluator = Phi35EvaluationFramework()
    
    # Load model
    evaluator.load_model()
    
    # Test on specific batches that have Claude's analysis
    test_batches = [1, 2, 3, 4, 5]  # Start with first 5 batches
    
    logger.info("Starting evaluation against Claude's ground truth...")
    summary = evaluator.evaluate_multiple_batches(test_batches)
    
    # Print summary
    print("\n" + "=" * 60)
    print("EVALUATION COMPLETE")
    print("=" * 60)
    print(f"Average Overall Score: {np.mean([s for _, s in [summary['best_performing_batch'], summary['worst_performing_batch']]]):.2f}%")
    print(f"Best Batch Score: {summary['best_performing_batch'][1]:.2f}%")
    print(f"Worst Batch Score: {summary['worst_performing_batch'][1]:.2f}%")
    print(f"Results saved to: evaluation_results/")

if __name__ == "__main__":
    main()