#!/usr/bin/env python3
"""
Phase 2: Adaptive Dataset Generator
Creates dynamic training datasets that evolve based on model performance
NO HARDCODING - All decisions based on learned patterns
"""

import os
import json
import re
import random
import logging
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime
import numpy as np
from typing import Dict, List, Tuple, Any

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AdaptiveDatasetGenerator:
    """
    Generates training datasets that adapt based on:
    1. Error patterns from previous training
    2. Quality scores from analysis
    3. Curriculum learning principles
    4. Performance metrics
    """
    
    def __init__(self, email_batches_dir: str, analysis_file: str, phase1_results_dir: str):
        self.email_batches_dir = Path(email_batches_dir)
        self.analysis_file = Path(analysis_file)
        self.phase1_results_dir = Path(phase1_results_dir)
        
        # Load Phase 1 analysis results
        self.quality_scores = self._load_quality_scores()
        self.pattern_library = self._load_pattern_library()
        self.data_report = self._load_data_report()
        
        # Initialize adaptive components
        self.learning_history = []
        self.error_patterns = defaultdict(list)
        self.success_patterns = defaultdict(list)
        self.curriculum_level = 0
        self.difficulty_scores = {}
        
        # Adaptive thresholds (learned, not hardcoded)
        self.quality_thresholds = self._compute_quality_thresholds()
        self.sampling_weights = self._initialize_sampling_weights()
        
        # Load Claude's analysis
        self.batch_analyses = self._load_claude_analysis()
        
        logger.info(f"Initialized with {len(self.quality_scores)} quality scores")
        logger.info(f"Quality thresholds: {self.quality_thresholds}")
        
    def _load_quality_scores(self) -> Dict:
        """Load quality scores from Phase 1"""
        file_path = self.phase1_results_dir / "quality_metrics.json"
        with open(file_path, 'r') as f:
            data = json.load(f)
        return {int(k): v for k, v in data['quality_scores'].items()}
    
    def _load_pattern_library(self) -> Dict:
        """Load pattern library from Phase 1"""
        file_path = self.phase1_results_dir / "pattern_library.json"
        with open(file_path, 'r') as f:
            return json.load(f)
    
    def _load_data_report(self) -> Dict:
        """Load data analysis report from Phase 1"""
        file_path = self.phase1_results_dir / "data_analysis_report.json"
        with open(file_path, 'r') as f:
            return json.load(f)
    
    def _compute_quality_thresholds(self) -> Dict:
        """Compute adaptive quality thresholds based on distribution"""
        scores = list(self.quality_scores.values())
        if not scores:
            return {'excellent': 80, 'good': 60, 'fair': 40}
        
        # Use percentiles instead of hardcoded values
        return {
            'excellent': np.percentile(scores, 75),  # Top 25%
            'good': np.percentile(scores, 50),       # Top 50%
            'fair': np.percentile(scores, 25),       # Top 75%
            'poor': np.percentile(scores, 10)        # Bottom 10%
        }
    
    def _initialize_sampling_weights(self) -> Dict:
        """Initialize adaptive sampling weights"""
        # Start with uniform weights, will adapt based on performance
        return {
            'high_quality': 0.4,
            'medium_quality': 0.3,
            'low_quality': 0.2,
            'error_focused': 0.1
        }
    
    def _load_claude_analysis(self) -> Dict:
        """Load and parse Claude's analysis file"""
        with open(self.analysis_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract batch analyses
        pattern = r'## Batch (\d+) Analysis\n\n(.*?)(?=## Batch \d+ Analysis|$)'
        matches = re.findall(pattern, content, re.DOTALL)
        
        batch_analyses = {}
        for batch_num, analysis in matches:
            batch_analyses[int(batch_num)] = analysis.strip()
        
        logger.info(f"Loaded {len(batch_analyses)} batch analyses from Claude's file")
        return batch_analyses
    
    def calculate_difficulty_score(self, batch_num: int) -> float:
        """Calculate difficulty score for a batch based on multiple factors"""
        quality = self.quality_scores.get(batch_num, 50)
        analysis = self.batch_analyses.get(batch_num, "")
        
        # Adaptive difficulty calculation
        factors = {
            'length': len(analysis) / 1000,  # Normalized by 1000 chars
            'quality': (100 - quality) / 100,  # Inverse quality
            'entities': analysis.count('PO') + analysis.count('Quote'),
            'workflow_complexity': len(re.findall(r'(START|PROGRESS|COMPLETE)', analysis)),
            'has_actions': 1.0 if 'ACTION' in analysis else 0.5,
            'has_financial': 1.0 if '$' in analysis else 0.5
        }
        
        # Weighted sum (weights will adapt based on errors)
        weights = self._get_adaptive_weights('difficulty')
        difficulty = sum(factors[k] * weights.get(k, 1.0) for k in factors)
        
        return min(max(difficulty, 0.0), 10.0)  # Normalize to 0-10
    
    def _get_adaptive_weights(self, weight_type: str) -> Dict:
        """Get adaptive weights based on learning history"""
        if not self.learning_history:
            # Initial weights
            return {
                'length': 0.2,
                'quality': 0.3,
                'entities': 0.2,
                'workflow_complexity': 0.15,
                'has_actions': 0.1,
                'has_financial': 0.05
            }
        
        # Compute weights based on error patterns
        weights = {}
        error_counts = Counter()
        
        for entry in self.learning_history[-10:]:  # Last 10 iterations
            if 'errors' in entry:
                for error_type in entry['errors']:
                    error_counts[error_type] += 1
        
        # Increase weight for areas with more errors
        total_errors = sum(error_counts.values()) or 1
        for key in ['length', 'quality', 'entities', 'workflow_complexity', 'has_actions', 'has_financial']:
            error_rate = error_counts.get(key, 0) / total_errors
            weights[key] = 0.15 + (error_rate * 0.35)  # Adaptive range: 0.15-0.5
        
        # Normalize weights to sum to 1
        total = sum(weights.values())
        return {k: v/total for k, v in weights.items()}
    
    def generate_curriculum_batch(self, batch_size: int = 32) -> List[Dict]:
        """Generate a batch following curriculum learning principles"""
        
        # Calculate difficulty for all batches if not done
        if not self.difficulty_scores:
            for batch_num in self.quality_scores.keys():
                self.difficulty_scores[batch_num] = self.calculate_difficulty_score(batch_num)
        
        # Sort batches by difficulty
        sorted_batches = sorted(self.difficulty_scores.items(), key=lambda x: x[1])
        
        # Determine sampling range based on curriculum level
        level_ranges = self._get_curriculum_ranges(len(sorted_batches))
        current_range = level_ranges[min(self.curriculum_level, len(level_ranges)-1)]
        
        # Sample from appropriate difficulty range
        available_batches = sorted_batches[current_range[0]:current_range[1]]
        
        if len(available_batches) < batch_size:
            # Expand range if needed
            available_batches = sorted_batches
        
        # Adaptive sampling based on performance
        samples = self._adaptive_sampling(available_batches, batch_size)
        
        # Create training examples
        training_batch = []
        for batch_num, difficulty in samples:
            if batch_num in self.batch_analyses:
                example = self._create_training_example(batch_num)
                if example:
                    example['difficulty'] = difficulty
                    training_batch.append(example)
        
        logger.info(f"Generated curriculum batch: {len(training_batch)} examples, "
                   f"level {self.curriculum_level}, "
                   f"avg difficulty: {np.mean([e['difficulty'] for e in training_batch]):.2f}")
        
        return training_batch
    
    def _get_curriculum_ranges(self, total_batches: int) -> List[Tuple[int, int]]:
        """Get adaptive curriculum ranges"""
        # Dynamic curriculum levels based on data distribution
        num_levels = 10
        batch_per_level = total_batches // num_levels
        
        ranges = []
        for i in range(num_levels):
            start = i * batch_per_level
            end = min((i + 2) * batch_per_level, total_batches)  # Overlap for smooth transition
            ranges.append((start, end))
        
        return ranges
    
    def _adaptive_sampling(self, available_batches: List[Tuple], batch_size: int) -> List[Tuple]:
        """Adaptive sampling based on error patterns and success patterns"""
        
        # Categorize batches
        high_error = []
        medium_error = []
        low_error = []
        unseen = []
        
        for batch_num, difficulty in available_batches:
            if batch_num in self.error_patterns:
                error_count = len(self.error_patterns[batch_num])
                if error_count > 5:
                    high_error.append((batch_num, difficulty))
                elif error_count > 2:
                    medium_error.append((batch_num, difficulty))
                else:
                    low_error.append((batch_num, difficulty))
            else:
                unseen.append((batch_num, difficulty))
        
        # Adaptive distribution
        distribution = self._compute_adaptive_distribution(
            len(high_error), len(medium_error), len(low_error), len(unseen)
        )
        
        samples = []
        for category, count in distribution.items():
            if category == 'high_error' and high_error:
                samples.extend(random.sample(high_error, min(count, len(high_error))))
            elif category == 'medium_error' and medium_error:
                samples.extend(random.sample(medium_error, min(count, len(medium_error))))
            elif category == 'low_error' and low_error:
                samples.extend(random.sample(low_error, min(count, len(low_error))))
            elif category == 'unseen' and unseen:
                samples.extend(random.sample(unseen, min(count, len(unseen))))
        
        # Fill remaining with random samples if needed
        while len(samples) < batch_size and available_batches:
            remaining = [b for b in available_batches if b not in samples]
            if remaining:
                samples.append(random.choice(remaining))
            else:
                break
        
        return samples[:batch_size]
    
    def _compute_adaptive_distribution(self, high: int, medium: int, low: int, unseen: int) -> Dict:
        """Compute adaptive distribution for sampling"""
        total = high + medium + low + unseen
        if total == 0:
            return {'high_error': 8, 'medium_error': 8, 'low_error': 8, 'unseen': 8}
        
        # Adaptive weights based on availability and performance
        if len(self.learning_history) > 0:
            recent_accuracy = self.learning_history[-1].get('accuracy', 0.5)
            
            if recent_accuracy < 0.6:
                # Focus on easier examples
                weights = {'high_error': 0.1, 'medium_error': 0.2, 'low_error': 0.3, 'unseen': 0.4}
            elif recent_accuracy < 0.8:
                # Balanced approach
                weights = {'high_error': 0.3, 'medium_error': 0.3, 'low_error': 0.2, 'unseen': 0.2}
            else:
                # Focus on harder examples
                weights = {'high_error': 0.4, 'medium_error': 0.3, 'low_error': 0.2, 'unseen': 0.1}
        else:
            # Initial balanced distribution
            weights = {'high_error': 0.25, 'medium_error': 0.25, 'low_error': 0.25, 'unseen': 0.25}
        
        # Convert to counts
        batch_size = 32
        distribution = {
            'high_error': int(batch_size * weights['high_error']),
            'medium_error': int(batch_size * weights['medium_error']),
            'low_error': int(batch_size * weights['low_error']),
            'unseen': int(batch_size * weights['unseen'])
        }
        
        return distribution
    
    def _create_training_example(self, batch_num: int) -> Dict:
        """Create a training example with augmentation"""
        
        # Load email batch data
        batch_file = self.email_batches_dir / f"emails_batch_{batch_num}.json"
        try:
            with open(batch_file, 'r', encoding='utf-8') as f:
                batch_data = json.load(f)
        except:
            return None
        
        # Get analysis
        analysis = self.batch_analyses.get(batch_num, "")
        if not analysis:
            return None
        
        # Create base example
        email_count = len(batch_data) if isinstance(batch_data, list) else 1
        
        # Apply adaptive augmentation
        instruction_variants = [
            f"Analyze email batch #{batch_num}",
            f"Process batch {batch_num} from TD SYNNEX emails",
            f"Provide analysis for email batch number {batch_num}",
            f"Extract insights from batch #{batch_num}",
            f"Review and analyze batch {batch_num}"
        ]
        
        context_variants = [
            f"This batch contains {email_count} emails from TD SYNNEX communications.",
            f"Batch {batch_num} includes {email_count} business emails.",
            f"{email_count} emails in this batch require analysis.",
            f"Processing {email_count} TD SYNNEX email{'s' if email_count > 1 else ''}."
        ]
        
        # Select variants based on learned preferences
        instruction = self._select_variant(instruction_variants, 'instruction')
        context = self._select_variant(context_variants, 'context')
        
        # Optionally augment the output
        output = self._augment_output(analysis) if random.random() < 0.2 else analysis
        
        return {
            "instruction": instruction,
            "input": context,
            "output": output,
            "batch_number": batch_num,
            "quality_score": self.quality_scores.get(batch_num, 0),
            "email_count": email_count
        }
    
    def _select_variant(self, variants: List[str], variant_type: str) -> str:
        """Select variant based on learned preferences"""
        if not self.success_patterns.get(variant_type):
            return random.choice(variants)
        
        # Use success patterns to weight selection
        variant_scores = []
        for variant in variants:
            score = sum(1 for pattern in self.success_patterns[variant_type] 
                       if variant in pattern.get('text', ''))
            variant_scores.append(score)
        
        if sum(variant_scores) == 0:
            return random.choice(variants)
        
        # Weighted random selection
        weights = [s/sum(variant_scores) for s in variant_scores]
        return np.random.choice(variants, p=weights)
    
    def _augment_output(self, analysis: str) -> str:
        """Apply controlled augmentation to output"""
        # Simple augmentations that preserve meaning
        augmentations = [
            ('START POINTS', 'INITIAL WORKFLOWS'),
            ('IN-PROGRESS', 'ONGOING PROCESSES'),
            ('COMPLETION', 'COMPLETED WORKFLOWS'),
            ('HIGH PRIORITY', 'CRITICAL PRIORITY'),
            ('ACTION ITEM', 'ACTION REQUIRED')
        ]
        
        augmented = analysis
        # Apply only one augmentation to maintain consistency
        if augmentations and random.random() < 0.3:
            old, new = random.choice(augmentations)
            augmented = augmented.replace(old, new)
        
        return augmented
    
    def update_from_training(self, training_results: Dict):
        """Update generator based on training results"""
        
        # Record in learning history
        self.learning_history.append({
            'timestamp': datetime.now().isoformat(),
            'iteration': len(self.learning_history) + 1,
            **training_results
        })
        
        # Update error and success patterns
        for batch_id, result in training_results.get('batch_results', {}).items():
            if result['loss'] > training_results.get('avg_loss', 1.0) * 1.5:
                self.error_patterns[batch_id].append(result)
            elif result['loss'] < training_results.get('avg_loss', 1.0) * 0.5:
                self.success_patterns[batch_id].append(result)
        
        # Adjust curriculum level
        accuracy = training_results.get('accuracy', 0.5)
        if accuracy > 0.85 and self.curriculum_level < 9:
            self.curriculum_level += 1
            logger.info(f"Advancing curriculum to level {self.curriculum_level}")
        elif accuracy < 0.5 and self.curriculum_level > 0:
            self.curriculum_level -= 1
            logger.info(f"Reducing curriculum to level {self.curriculum_level}")
        
        # Update sampling weights
        self._update_sampling_weights(training_results)
        
        logger.info(f"Updated from training: accuracy={accuracy:.2f}, "
                   f"curriculum_level={self.curriculum_level}")
    
    def _update_sampling_weights(self, results: Dict):
        """Update sampling weights based on performance"""
        # Adaptive weight adjustment
        accuracy = results.get('accuracy', 0.5)
        
        if accuracy < 0.6:
            # Need more easy examples
            self.sampling_weights['high_quality'] *= 1.1
            self.sampling_weights['low_quality'] *= 0.9
        elif accuracy > 0.85:
            # Need more challenging examples
            self.sampling_weights['low_quality'] *= 1.1
            self.sampling_weights['error_focused'] *= 1.2
            self.sampling_weights['high_quality'] *= 0.9
        
        # Normalize
        total = sum(self.sampling_weights.values())
        self.sampling_weights = {k: v/total for k, v in self.sampling_weights.items()}
    
    def save_dataset(self, dataset: List[Dict], output_path: str):
        """Save generated dataset"""
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output, 'w', encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'created': datetime.now().isoformat(),
                    'curriculum_level': self.curriculum_level,
                    'total_examples': len(dataset),
                    'avg_difficulty': np.mean([e.get('difficulty', 5) for e in dataset]),
                    'quality_distribution': Counter([
                        'excellent' if e.get('quality_score', 0) > self.quality_thresholds['excellent']
                        else 'good' if e.get('quality_score', 0) > self.quality_thresholds['good']
                        else 'fair' if e.get('quality_score', 0) > self.quality_thresholds['fair']
                        else 'poor'
                        for e in dataset
                    ])
                },
                'examples': dataset
            }, f, indent=2)
        
        logger.info(f"Saved dataset with {len(dataset)} examples to {output}")
    
    def generate_full_dataset(self, train_size: int = 1000, val_size: int = 200):
        """Generate complete train and validation datasets"""
        
        logger.info(f"Generating full dataset: train={train_size}, val={val_size}")
        
        # Generate training batches
        train_examples = []
        while len(train_examples) < train_size:
            batch = self.generate_curriculum_batch(
                min(32, train_size - len(train_examples))
            )
            train_examples.extend(batch)
        
        # Advance curriculum for validation
        self.curriculum_level = min(self.curriculum_level + 2, 9)
        
        # Generate validation examples (slightly harder)
        val_examples = []
        while len(val_examples) < val_size:
            batch = self.generate_curriculum_batch(
                min(32, val_size - len(val_examples))
            )
            val_examples.extend(batch)
        
        # Save datasets
        self.save_dataset(train_examples, "./datasets/adaptive_train.json")
        self.save_dataset(val_examples, "./datasets/adaptive_val.json")
        
        # Generate statistics report
        self._generate_dataset_report(train_examples, val_examples)
        
        return train_examples, val_examples
    
    def _generate_dataset_report(self, train: List[Dict], val: List[Dict]):
        """Generate comprehensive dataset report"""
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'curriculum_level': self.curriculum_level,
            'statistics': {
                'train': {
                    'total': len(train),
                    'avg_difficulty': np.mean([e.get('difficulty', 5) for e in train]),
                    'avg_quality': np.mean([e.get('quality_score', 50) for e in train]),
                    'unique_batches': len(set(e['batch_number'] for e in train))
                },
                'validation': {
                    'total': len(val),
                    'avg_difficulty': np.mean([e.get('difficulty', 5) for e in val]),
                    'avg_quality': np.mean([e.get('quality_score', 50) for e in val]),
                    'unique_batches': len(set(e['batch_number'] for e in val))
                }
            },
            'quality_thresholds': self.quality_thresholds,
            'sampling_weights': self.sampling_weights,
            'learning_history_summary': {
                'total_iterations': len(self.learning_history),
                'last_accuracy': self.learning_history[-1].get('accuracy', 0) if self.learning_history else 0,
                'error_patterns_count': len(self.error_patterns),
                'success_patterns_count': len(self.success_patterns)
            }
        }
        
        with open("./datasets/dataset_report.json", 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info("Generated dataset report")
        
        # Print summary
        print("\n" + "="*60)
        print("ADAPTIVE DATASET GENERATION COMPLETE")
        print("="*60)
        print(f"Training examples: {len(train)}")
        print(f"  - Avg difficulty: {report['statistics']['train']['avg_difficulty']:.2f}")
        print(f"  - Avg quality: {report['statistics']['train']['avg_quality']:.1f}")
        print(f"  - Unique batches: {report['statistics']['train']['unique_batches']}")
        print(f"\nValidation examples: {len(val)}")
        print(f"  - Avg difficulty: {report['statistics']['validation']['avg_difficulty']:.2f}")
        print(f"  - Avg quality: {report['statistics']['validation']['avg_quality']:.1f}")
        print(f"  - Unique batches: {report['statistics']['validation']['unique_batches']}")
        print(f"\nCurriculum level: {self.curriculum_level}")
        print("="*60)

def main():
    # Configuration
    email_batches_dir = "/home/pricepro2006/CrewAI_Team/email_batches"
    analysis_file = "/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md"
    phase1_results_dir = "/home/pricepro2006/CrewAI_Team/fine-tuning/phase1_results"
    
    # Initialize generator
    generator = AdaptiveDatasetGenerator(
        email_batches_dir,
        analysis_file,
        phase1_results_dir
    )
    
    # Generate full dataset
    train, val = generator.generate_full_dataset(train_size=500, val_size=100)
    
    # Simulate training feedback loop (for testing)
    if False:  # Set to True to test update mechanism
        mock_results = {
            'accuracy': 0.72,
            'avg_loss': 2.5,
            'batch_results': {
                1: {'loss': 3.2},
                2: {'loss': 1.8},
                3: {'loss': 2.9}
            }
        }
        generator.update_from_training(mock_results)
        
        # Generate next batch based on feedback
        next_batch = generator.generate_curriculum_batch(32)
        generator.save_dataset(next_batch, "./datasets/adaptive_next_batch.json")

if __name__ == "__main__":
    main()