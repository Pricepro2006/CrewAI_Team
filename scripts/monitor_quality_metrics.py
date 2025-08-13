#!/usr/bin/env python3
"""
Quality Monitoring for Optimized Email Processing
Ensures no quality degradation during parallel processing
"""

import sqlite3
import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class QualityMonitor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.quality_thresholds = {
            'min_response_length': 1000,  # Minimum characters
            'min_confidence': 0.7,
            'min_actions_per_email': 0.8,
            'min_entity_extraction': 0.5,
            'max_error_rate': 0.05,
            'min_priority_detection': 0.5
        }
    
    def get_recent_results(self, hours: int = 1) -> List[Dict]:
        """Get emails processed in the last N hours"""
        cutoff_time = (datetime.now() - timedelta(hours=hours)).isoformat()
        
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("""
                SELECT 
                    id, subject, phase2_result, workflow_state,
                    extracted_entities, analyzed_at
                FROM emails_enhanced
                WHERE analyzed_at > ?
                AND phase2_result LIKE '%llama_3_2%'
                ORDER BY analyzed_at DESC
            """, (cutoff_time,))
            
            results = []
            for row in cursor:
                try:
                    phase2 = json.loads(row['phase2_result']) if row['phase2_result'] else {}
                    workflow = json.loads(row['workflow_state']) if row['workflow_state'] else {}
                    entities = json.loads(row['extracted_entities']) if row['extracted_entities'] else {}
                    
                    results.append({
                        'id': row['id'],
                        'subject': row['subject'],
                        'analyzed_at': row['analyzed_at'],
                        'phase2_result': phase2,
                        'workflow_state': workflow,
                        'entities': entities
                    })
                except Exception as e:
                    logger.warning(f"Error parsing result for {row['id']}: {e}")
            
            return results
    
    def calculate_quality_metrics(self, results: List[Dict]) -> Dict:
        """Calculate comprehensive quality metrics"""
        if not results:
            return {
                'status': 'NO_DATA',
                'message': 'No recent results to analyze'
            }
        
        metrics = {
            'total_analyzed': len(results),
            'time_period': 'Last hour',
            'response_lengths': [],
            'confidence_scores': [],
            'action_counts': [],
            'entity_counts': [],
            'priority_classifications': {},
            'workflow_types': {},
            'processing_times': [],
            'business_values': [],
            'errors': 0
        }
        
        for result in results:
            try:
                # Response length (from phase2_result)
                phase2 = result.get('phase2_result', {})
                if phase2:
                    # Estimate response length from processing metadata
                    metrics['processing_times'].append(phase2.get('processing_time', 0))
                    metrics['confidence_scores'].append(phase2.get('confidence', 0))
                
                # Workflow analysis
                workflow = result.get('workflow_state', {})
                if isinstance(workflow, dict):
                    # Count workflow types
                    wf_type = workflow.get('workflow_type', 'Unknown')
                    metrics['workflow_types'][wf_type] = metrics['workflow_types'].get(wf_type, 0) + 1
                    
                    # Count priorities
                    priority = workflow.get('priority', 'Unknown')
                    metrics['priority_classifications'][priority] = metrics['priority_classifications'].get(priority, 0) + 1
                    
                    # Business intelligence
                    bi = workflow.get('business_intelligence', {})
                    if bi:
                        value = bi.get('estimated_value', 0)
                        if value:
                            metrics['business_values'].append(value)
                    
                    # Actionable items
                    actions = workflow.get('actionable_items', [])
                    metrics['action_counts'].append(len(actions))
                    
                    # Entity extraction
                    entities = workflow.get('business_entities', {})
                    entity_count = sum(len(v) if isinstance(v, list) else 1 
                                     for v in entities.values() if v)
                    metrics['entity_counts'].append(entity_count)
                    
                    # Estimate response length
                    summary = workflow.get('summary', '')
                    if summary:
                        # Rough estimate: summary is usually 1/10th of full response
                        metrics['response_lengths'].append(len(summary) * 10)
                
            except Exception as e:
                logger.warning(f"Error processing metrics for {result['id']}: {e}")
                metrics['errors'] += 1
        
        # Calculate aggregates
        aggregates = {
            'avg_response_length': statistics.mean(metrics['response_lengths']) if metrics['response_lengths'] else 0,
            'avg_confidence': statistics.mean(metrics['confidence_scores']) if metrics['confidence_scores'] else 0,
            'avg_actions': statistics.mean(metrics['action_counts']) if metrics['action_counts'] else 0,
            'avg_entities': statistics.mean(metrics['entity_counts']) if metrics['entity_counts'] else 0,
            'avg_processing_time': statistics.mean(metrics['processing_times']) if metrics['processing_times'] else 0,
            'total_business_value': sum(metrics['business_values']),
            'high_priority_rate': (metrics['priority_classifications'].get('High', 0) + 
                                  metrics['priority_classifications'].get('Critical', 0)) / len(results) if results else 0,
            'error_rate': metrics['errors'] / len(results) if results else 0
        }
        
        metrics['aggregates'] = aggregates
        return metrics
    
    def validate_quality(self, metrics: Dict) -> Tuple[bool, List[str]]:
        """Validate quality against thresholds"""
        if metrics.get('status') == 'NO_DATA':
            return True, ['No data to validate']
        
        issues = []
        aggregates = metrics.get('aggregates', {})
        
        # Check each threshold
        if aggregates['avg_response_length'] < self.quality_thresholds['min_response_length']:
            issues.append(f"⚠️  Response length below threshold: {aggregates['avg_response_length']:.0f} < {self.quality_thresholds['min_response_length']}")
        
        if aggregates['avg_confidence'] < self.quality_thresholds['min_confidence']:
            issues.append(f"⚠️  Confidence below threshold: {aggregates['avg_confidence']:.2f} < {self.quality_thresholds['min_confidence']}")
        
        if aggregates['avg_actions'] < self.quality_thresholds['min_actions_per_email']:
            issues.append(f"⚠️  Actions per email below threshold: {aggregates['avg_actions']:.2f} < {self.quality_thresholds['min_actions_per_email']}")
        
        if aggregates['avg_entities'] < self.quality_thresholds['min_entity_extraction']:
            issues.append(f"⚠️  Entity extraction below threshold: {aggregates['avg_entities']:.2f} < {self.quality_thresholds['min_entity_extraction']}")
        
        if aggregates['error_rate'] > self.quality_thresholds['max_error_rate']:
            issues.append(f"⚠️  Error rate above threshold: {aggregates['error_rate']:.2%} > {self.quality_thresholds['max_error_rate']:.2%}")
        
        if aggregates['high_priority_rate'] < self.quality_thresholds['min_priority_detection']:
            issues.append(f"⚠️  Priority detection below threshold: {aggregates['high_priority_rate']:.2%} < {self.quality_thresholds['min_priority_detection']:.2%}")
        
        return len(issues) == 0, issues
    
    def generate_report(self, hours: int = 1):
        """Generate comprehensive quality report"""
        logger.info(f"📊 Generating quality report for last {hours} hour(s)...")
        
        # Get recent results
        results = self.get_recent_results(hours)
        
        # Calculate metrics
        metrics = self.calculate_quality_metrics(results)
        
        # Validate quality
        quality_ok, issues = self.validate_quality(metrics)
        
        # Generate report
        print("\n" + "="*80)
        print("📊 EMAIL PROCESSING QUALITY REPORT")
        print("="*80)
        print(f"Time Period: Last {hours} hour(s)")
        print(f"Total Emails Analyzed: {metrics.get('total_analyzed', 0)}")
        
        if metrics.get('status') == 'NO_DATA':
            print("\n❌ No recent processing data found")
            return
        
        aggregates = metrics['aggregates']
        
        print("\n📈 Quality Metrics:")
        print(f"  Average Response Length: {aggregates['avg_response_length']:,.0f} characters")
        print(f"  Average Confidence: {aggregates['avg_confidence']:.2f}")
        print(f"  Average Actions/Email: {aggregates['avg_actions']:.2f}")
        print(f"  Average Entities/Email: {aggregates['avg_entities']:.2f}")
        print(f"  Average Processing Time: {aggregates['avg_processing_time']:.1f} seconds")
        print(f"  High Priority Rate: {aggregates['high_priority_rate']:.1%}")
        print(f"  Error Rate: {aggregates['error_rate']:.1%}")
        
        print(f"\n💰 Business Intelligence:")
        print(f"  Total Business Value: ${aggregates['total_business_value']:,.2f}")
        print(f"  Average Value/Email: ${aggregates['total_business_value']/metrics['total_analyzed']:,.2f}" if metrics['total_analyzed'] > 0 else "  Average Value/Email: $0.00")
        
        print(f"\n📊 Workflow Distribution:")
        for wf_type, count in sorted(metrics['workflow_types'].items(), key=lambda x: x[1], reverse=True):
            percentage = count / metrics['total_analyzed'] * 100
            print(f"  {wf_type}: {count} ({percentage:.1f}%)")
        
        print(f"\n🎯 Priority Distribution:")
        for priority, count in sorted(metrics['priority_classifications'].items(), key=lambda x: x[1], reverse=True):
            percentage = count / metrics['total_analyzed'] * 100
            print(f"  {priority}: {count} ({percentage:.1f}%)")
        
        print(f"\n✅ Quality Validation:")
        if quality_ok:
            print("  ✅ All quality metrics within acceptable thresholds")
        else:
            print("  ⚠️  Quality issues detected:")
            for issue in issues:
                print(f"    {issue}")
        
        print("\n" + "="*80)
        
        # Compare with baseline (7-hour run)
        print("\n📊 Comparison with Baseline (7-hour sequential run):")
        print("  Baseline: 1.8 emails/minute, 62.7% high priority, $807M total")
        
        if metrics['total_analyzed'] > 0:
            # Estimate current rate
            time_span = datetime.now() - datetime.fromisoformat(results[-1]['analyzed_at'])
            current_rate = metrics['total_analyzed'] / (time_span.total_seconds() / 60)
            print(f"  Current Rate: {current_rate:.1f} emails/minute")
            print(f"  Speedup: {current_rate/1.8:.1f}x")
            print(f"  Quality Status: {'✅ MAINTAINED' if quality_ok else '⚠️  DEGRADED'}")
        
        print("="*80 + "\n")
        
        return quality_ok, metrics

def continuous_monitoring(db_path: str, check_interval: int = 300):
    """Continuously monitor quality every N seconds"""
    monitor = QualityMonitor(db_path)
    
    logger.info(f"🔍 Starting continuous quality monitoring (checking every {check_interval}s)")
    
    while True:
        try:
            quality_ok, metrics = monitor.generate_report(hours=1)
            
            if not quality_ok:
                logger.warning("⚠️  QUALITY DEGRADATION DETECTED! Consider reducing parallel workers.")
            
            # Wait before next check
            import time
            time.sleep(check_interval)
            
        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
            break
        except Exception as e:
            logger.error(f"Monitoring error: {e}")
            import time
            time.sleep(60)  # Wait a minute before retrying

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Monitor email processing quality')
    parser.add_argument('--db', type=str, default='./data/crewai_enhanced.db',
                       help='Database path')
    parser.add_argument('--hours', type=int, default=1,
                       help='Hours of history to analyze')
    parser.add_argument('--continuous', action='store_true',
                       help='Run continuous monitoring')
    parser.add_argument('--interval', type=int, default=300,
                       help='Check interval in seconds (for continuous mode)')
    
    args = parser.parse_args()
    
    if args.continuous:
        continuous_monitoring(args.db, args.interval)
    else:
        monitor = QualityMonitor(args.db)
        monitor.generate_report(args.hours)