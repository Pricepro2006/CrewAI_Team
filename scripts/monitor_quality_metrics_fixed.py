#!/usr/bin/env python3
"""
Fixed Quality Monitoring for Email Processing
Correctly reads metrics from workflow_state JSON structure
"""

import sqlite3
import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Tuple
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/logs/quality_monitoring_fixed.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class QualityMonitor:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.quality_thresholds = {
            'min_response_length': 50,  # Lowered - summaries are short
            'min_confidence': 0.7,
            'min_actions_per_email': 0.5,  # Lowered - not all emails need actions
            'min_entity_extraction': 0.3,  # Lowered - entities vary by email type
            'max_error_rate': 0.05,
            'min_priority_detection': 0.5,
            'min_business_value_rate': 0.1  # At least 10% should have value
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
                AND workflow_state IS NOT NULL
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
        """Calculate comprehensive quality metrics from workflow_state"""
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
            'errors': 0,
            'has_business_value': 0
        }
        
        for result in results:
            try:
                workflow = result.get('workflow_state', {})
                
                # Get confidence and processing time
                confidence = workflow.get('confidence', 0)
                if confidence:
                    metrics['confidence_scores'].append(confidence)
                
                processing_time = workflow.get('processing_time', 0)
                if processing_time:
                    metrics['processing_times'].append(processing_time)
                
                # Get summary for response length
                summary = workflow.get('summary', '')
                if summary:
                    metrics['response_lengths'].append(len(summary))
                
                # Workflow analysis
                workflow_analysis = workflow.get('workflow_analysis', {})
                if workflow_analysis:
                    # Workflow type
                    wf_type = workflow_analysis.get('type', 'Unknown')
                    metrics['workflow_types'][wf_type] = metrics['workflow_types'].get(wf_type, 0) + 1
                    
                    # Priority
                    priority = workflow_analysis.get('priority', 'Unknown')
                    metrics['priority_classifications'][priority] = metrics['priority_classifications'].get(priority, 0) + 1
                
                # Business intelligence
                bi = workflow.get('business_intelligence', {})
                if bi:
                    value = bi.get('estimated_value', 0)
                    if value and value > 0:
                        metrics['business_values'].append(value)
                        metrics['has_business_value'] += 1
                
                # Actionable items
                actions = workflow.get('actionable_items', [])
                metrics['action_counts'].append(len(actions))
                
                # Entity extraction from multiple sources
                entity_count = 0
                
                # From business_entities in workflow
                business_entities = workflow.get('business_entities', {})
                if business_entities:
                    entity_count += sum(len(v) if isinstance(v, list) else 1 
                                     for v in business_entities.values() if v)
                
                # From stakeholders
                stakeholders = workflow.get('stakeholders', {})
                if stakeholders:
                    for key, value in stakeholders.items():
                        if isinstance(value, list):
                            entity_count += len(value)
                
                # From entities in result
                entities = result.get('entities', {})
                if entities:
                    entity_count += sum(len(v) if isinstance(v, list) else 1 
                                     for v in entities.values() if v)
                
                metrics['entity_counts'].append(entity_count)
                
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
            'business_value_rate': metrics['has_business_value'] / len(results) if results else 0,
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
        
        if aggregates['business_value_rate'] < self.quality_thresholds['min_business_value_rate']:
            issues.append(f"⚠️  Business value extraction below threshold: {aggregates['business_value_rate']:.2%} < {self.quality_thresholds['min_business_value_rate']:.2%}")
        
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
        print("📊 EMAIL PROCESSING QUALITY REPORT (FIXED)")
        print("="*80)
        print(f"Time Period: Last {hours} hour(s)")
        print(f"Total Emails Analyzed: {metrics.get('total_analyzed', 0)}")
        
        if metrics.get('status') == 'NO_DATA':
            print("\n❌ No recent processing data found")
            return quality_ok, metrics
        
        aggregates = metrics['aggregates']
        
        print("\n📈 Quality Metrics:")
        print(f"  Average Summary Length: {aggregates['avg_response_length']:,.0f} characters")
        print(f"  Average Confidence: {aggregates['avg_confidence']:.2f}")
        print(f"  Average Actions/Email: {aggregates['avg_actions']:.2f}")
        print(f"  Average Entities/Email: {aggregates['avg_entities']:.2f}")
        print(f"  Average Processing Time: {aggregates['avg_processing_time']:.1f} seconds")
        print(f"  High Priority Rate: {aggregates['high_priority_rate']:.1%}")
        print(f"  Business Value Rate: {aggregates['business_value_rate']:.1%}")
        print(f"  Error Rate: {aggregates['error_rate']:.1%}")
        
        print(f"\n💰 Business Intelligence:")
        print(f"  Total Business Value: ${aggregates['total_business_value']:,.2f}")
        print(f"  Emails with Value: {metrics['has_business_value']} ({aggregates['business_value_rate']:.1%})")
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
        
        # Processing rate analysis
        if metrics['total_analyzed'] > 0 and results:
            # Calculate actual processing rate
            first_time = datetime.fromisoformat(results[-1]['analyzed_at'])
            last_time = datetime.fromisoformat(results[0]['analyzed_at'])
            time_span = (last_time - first_time).total_seconds() / 60  # minutes
            
            if time_span > 0:
                current_rate = metrics['total_analyzed'] / time_span
                print(f"\n📊 Processing Performance:")
                print(f"  Current Rate: {current_rate:.1f} emails/minute")
                print(f"  Emails in {hours} hour(s): {metrics['total_analyzed']}")
                print(f"  Average Processing Time: {aggregates['avg_processing_time']:.1f}s per email")
                
                # Estimate completion time for remaining emails
                total_emails = 143850
                processed_count_query = "SELECT COUNT(*) FROM emails_enhanced WHERE workflow_state IS NOT NULL"
                with sqlite3.connect(self.db_path) as conn:
                    processed = conn.execute(processed_count_query).fetchone()[0]
                
                remaining = total_emails - processed
                if current_rate > 0:
                    eta_hours = remaining / (current_rate * 60)
                    print(f"\n📅 Completion Estimate:")
                    print(f"  Total Emails: {total_emails:,}")
                    print(f"  Processed: {processed:,} ({processed/total_emails*100:.1f}%)")
                    print(f"  Remaining: {remaining:,}")
                    print(f"  ETA: {eta_hours:.1f} hours ({eta_hours/24:.1f} days) at current rate")
        
        print("="*80 + "\n")
        
        # Log the quality status
        if quality_ok:
            logger.info("✅ Quality metrics within acceptable thresholds")
        else:
            logger.warning(f"⚠️ Quality issues detected: {len(issues)} problems found")
        
        return quality_ok, metrics

def continuous_monitoring(db_path: str, check_interval: int = 300):
    """Continuously monitor quality every N seconds"""
    monitor = QualityMonitor(db_path)
    
    logger.info(f"🔍 Starting FIXED continuous quality monitoring (checking every {check_interval}s)")
    
    while True:
        try:
            quality_ok, metrics = monitor.generate_report(hours=1)
            
            if not quality_ok:
                logger.warning("⚠️  QUALITY ISSUES DETECTED! Review the report above.")
            else:
                logger.info("✅ Quality maintained within thresholds")
            
            # Wait before next check
            import time
            time.sleep(check_interval)
            
        except KeyboardInterrupt:
            logger.info("Monitoring stopped by user")
            break
        except Exception as e:
            logger.error(f"Monitoring error: {e}")
            import traceback
            traceback.print_exc()
            import time
            time.sleep(60)  # Wait a minute before retrying

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Monitor email processing quality (FIXED)')
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