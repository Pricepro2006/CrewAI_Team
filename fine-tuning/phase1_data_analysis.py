#!/usr/bin/env python3
"""
Phase 1: Data Understanding & Analysis
Comprehensive analysis of email batches and Claude's analysis patterns
"""

import os
import json
import re
import logging
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime
import statistics

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmailBatchAnalyzer:
    """Analyze email batch structure and patterns"""
    
    def __init__(self, email_batches_dir, analysis_file_path):
        self.email_batches_dir = Path(email_batches_dir)
        self.analysis_file_path = Path(analysis_file_path)
        self.batch_stats = defaultdict(dict)
        self.patterns = defaultdict(list)
        self.quality_scores = {}
        
    def analyze_email_structure(self, batch_file):
        """Analyze structure of a single email batch"""
        try:
            with open(batch_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Extract batch number
            batch_num = int(re.search(r'emails_batch_(\d+)\.json', batch_file.name).group(1))
            
            # Analyze structure
            if isinstance(data, list):
                email_count = len(data)
                fields = set()
                for email in data:
                    if isinstance(email, dict):
                        fields.update(email.keys())
            elif isinstance(data, dict):
                email_count = 1
                fields = set(data.keys())
            else:
                email_count = 0
                fields = set()
            
            return {
                'batch_number': batch_num,
                'email_count': email_count,
                'fields': list(fields),
                'file_size': batch_file.stat().st_size,
                'has_data': email_count > 0
            }
        except Exception as e:
            logger.error(f"Error analyzing {batch_file}: {e}")
            return None
    
    def extract_analysis_patterns(self):
        """Extract patterns from Claude's analysis file"""
        logger.info("Extracting patterns from Claude's analysis...")
        
        with open(self.analysis_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern categories to identify
        pattern_categories = {
            'workflow_states': r'(START POINTS|IN-PROGRESS|COMPLETION)',
            'entities': r'(PO Numbers?|Quote Numbers?|Order Numbers?|Reference Numbers?)',
            'priorities': r'(HIGH PRIORITY|MEDIUM|LOW|CRITICAL|URGENT)',
            'actions': r'(ACTION ITEM|Key Actions?|Immediate Actions?)',
            'participants': r'(Key Participants?|Stakeholders?|Teams?)',
            'financial': r'(Financial|Pricing|Cost|Payment)',
            'products': r'(Product|SKU|Part Number)',
            'recommendations': r'(Recommendation|Suggestion|Improvement)'
        }
        
        patterns_found = defaultdict(Counter)
        
        # Find all batch analyses
        batch_pattern = r'## Batch (\d+) Analysis\n\n(.*?)(?=## Batch \d+ Analysis|$)'
        batch_analyses = re.findall(batch_pattern, content, re.DOTALL)
        
        for batch_num, analysis in batch_analyses:
            batch_num = int(batch_num)
            
            # Check for each pattern category
            for category, pattern in pattern_categories.items():
                matches = re.findall(pattern, analysis, re.IGNORECASE)
                patterns_found[category][batch_num] = len(matches)
            
            # Extract structure elements
            self.patterns['has_workflow_states'].append(
                batch_num if 'START POINTS' in analysis else None
            )
            self.patterns['has_entities'].append(
                batch_num if re.search(r'(PO|Order|Quote).*\d+', analysis) else None
            )
            self.patterns['has_priorities'].append(
                batch_num if re.search(r'(HIGH|MEDIUM|LOW|CRITICAL)', analysis) else None
            )
            
            # Calculate analysis quality score
            quality_score = self._calculate_quality_score(analysis)
            self.quality_scores[batch_num] = quality_score
        
        return patterns_found
    
    def _calculate_quality_score(self, analysis_text):
        """Calculate quality score for an analysis"""
        score = 0
        max_score = 100
        
        # Check for key components (each worth points)
        components = {
            'workflow_states': 15,
            'entities': 15,
            'priorities': 10,
            'action_items': 10,
            'participants': 10,
            'recommendations': 10,
            'financial_data': 10,
            'structured_format': 10,
            'comprehensive': 10
        }
        
        # Check each component
        if re.search(r'START POINTS|IN-PROGRESS|COMPLETION', analysis_text):
            score += components['workflow_states']
        
        if re.search(r'(PO|Order|Quote).*\d{5,}', analysis_text):
            score += components['entities']
        
        if re.search(r'(HIGH|MEDIUM|LOW|CRITICAL|PRIORITY)', analysis_text):
            score += components['priorities']
        
        if re.search(r'ACTION|Actions?|TODO', analysis_text, re.IGNORECASE):
            score += components['action_items']
        
        if re.search(r'Participants?|Teams?|Contacts?', analysis_text, re.IGNORECASE):
            score += components['participants']
        
        if re.search(r'Recommendation|Improvement|Suggestion', analysis_text, re.IGNORECASE):
            score += components['recommendations']
        
        if re.search(r'\$[\d,]+|\d+\.\d+%|Financial|Price', analysis_text):
            score += components['financial_data']
        
        if len(re.findall(r'#{2,3}\s+\w+', analysis_text)) > 3:
            score += components['structured_format']
        
        if len(analysis_text) > 1000:
            score += components['comprehensive']
        
        return score
    
    def identify_best_examples(self, top_n=50):
        """Identify the best examples for initial training"""
        sorted_batches = sorted(
            self.quality_scores.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        best_examples = []
        for batch_num, score in sorted_batches[:top_n]:
            if batch_num in self.batch_stats:
                best_examples.append({
                    'batch_number': batch_num,
                    'quality_score': score,
                    'email_count': self.batch_stats[batch_num].get('email_count', 0),
                    'has_complete_analysis': score >= 70
                })
        
        return best_examples
    
    def generate_report(self):
        """Generate comprehensive analysis report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_batches_analyzed': len(self.batch_stats),
            'total_with_analysis': len(self.quality_scores),
            'statistics': {
                'avg_emails_per_batch': statistics.mean(
                    [s.get('email_count', 0) for s in self.batch_stats.values()]
                ) if self.batch_stats else 0,
                'avg_quality_score': statistics.mean(
                    self.quality_scores.values()
                ) if self.quality_scores else 0,
                'quality_distribution': {
                    'excellent (>80)': sum(1 for s in self.quality_scores.values() if s > 80),
                    'good (60-80)': sum(1 for s in self.quality_scores.values() if 60 <= s <= 80),
                    'fair (40-60)': sum(1 for s in self.quality_scores.values() if 40 <= s < 60),
                    'poor (<40)': sum(1 for s in self.quality_scores.values() if s < 40)
                }
            },
            'patterns_identified': {
                'workflow_capable': len([x for x in self.patterns['has_workflow_states'] if x]),
                'entity_extraction': len([x for x in self.patterns['has_entities'] if x]),
                'priority_assessment': len([x for x in self.patterns['has_priorities'] if x])
            },
            'recommendations': self._generate_recommendations()
        }
        
        return report
    
    def _generate_recommendations(self):
        """Generate training recommendations based on analysis"""
        recommendations = []
        
        avg_quality = statistics.mean(self.quality_scores.values()) if self.quality_scores else 0
        
        if avg_quality < 60:
            recommendations.append({
                'priority': 'HIGH',
                'action': 'Focus on improving analysis structure',
                'reason': f'Average quality score is {avg_quality:.1f}, below acceptable threshold'
            })
        
        workflow_coverage = len([x for x in self.patterns['has_workflow_states'] if x]) / len(self.quality_scores) * 100
        if workflow_coverage < 80:
            recommendations.append({
                'priority': 'MEDIUM',
                'action': 'Enhance workflow state detection',
                'reason': f'Only {workflow_coverage:.1f}% of analyses include workflow states'
            })
        
        # Check for balance in training data
        quality_dist = Counter(
            'high' if s > 70 else 'medium' if s > 40 else 'low'
            for s in self.quality_scores.values()
        )
        
        if quality_dist['high'] < len(self.quality_scores) * 0.3:
            recommendations.append({
                'priority': 'HIGH',
                'action': 'Need more high-quality training examples',
                'reason': 'Less than 30% of examples are high quality'
            })
        
        return recommendations
    
    def run_complete_analysis(self):
        """Run the complete Phase 1 analysis"""
        logger.info("Starting Phase 1: Data Understanding & Analysis")
        
        # Analyze all email batches
        logger.info("Analyzing email batch files...")
        batch_files = sorted(self.email_batches_dir.glob("emails_batch_*.json"))
        
        for i, batch_file in enumerate(batch_files):
            if i % 100 == 0:
                logger.info(f"Processed {i}/{len(batch_files)} batch files...")
            
            stats = self.analyze_email_structure(batch_file)
            if stats:
                self.batch_stats[stats['batch_number']] = stats
        
        # Extract patterns from Claude's analysis
        patterns = self.extract_analysis_patterns()
        
        # Identify best examples
        best_examples = self.identify_best_examples()
        
        # Generate report
        report = self.generate_report()
        
        # Save results
        output_dir = Path("./phase1_results")
        output_dir.mkdir(exist_ok=True)
        
        # Save detailed statistics
        with open(output_dir / "data_analysis_report.json", 'w') as f:
            json.dump(report, f, indent=2)
        
        # Save pattern library
        with open(output_dir / "pattern_library.json", 'w') as f:
            json.dump({
                'patterns': {k: v for k, v in patterns.items()},
                'pattern_counts': {
                    category: dict(counter.most_common(20))
                    for category, counter in patterns.items()
                }
            }, f, indent=2)
        
        # Save quality metrics
        with open(output_dir / "quality_metrics.json", 'w') as f:
            json.dump({
                'quality_scores': self.quality_scores,
                'best_examples': best_examples,
                'quality_thresholds': {
                    'excellent': 80,
                    'good': 60,
                    'acceptable': 40,
                    'poor': 0
                }
            }, f, indent=2)
        
        logger.info(f"Phase 1 analysis complete. Results saved to {output_dir}")
        
        return report, best_examples

def main():
    # Configuration
    email_batches_dir = "/home/pricepro2006/CrewAI_Team/email_batches"
    analysis_file_path = "/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md"
    
    # Run analysis
    analyzer = EmailBatchAnalyzer(email_batches_dir, analysis_file_path)
    report, best_examples = analyzer.run_complete_analysis()
    
    # Print summary
    print("\n" + "="*60)
    print("PHASE 1 ANALYSIS COMPLETE")
    print("="*60)
    print(f"Total batches analyzed: {report['total_batches_analyzed']}")
    print(f"Average quality score: {report['statistics']['avg_quality_score']:.1f}")
    print(f"Best examples identified: {len(best_examples)}")
    print("\nRecommendations:")
    for rec in report['recommendations']:
        print(f"  [{rec['priority']}] {rec['action']}")
        print(f"    Reason: {rec['reason']}")
    print("="*60)

if __name__ == "__main__":
    main()