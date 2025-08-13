#!/usr/bin/env python3
"""
Claude Opus Email Processing Status Monitor
Real-time monitoring of business intelligence extraction
"""

import sqlite3
import json
import time
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class ClaudeOpusMonitor:
    def __init__(self):
        self.db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
        
    def get_processing_status(self):
        """Get current processing status with business intelligence metrics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Overall status
                cursor = conn.execute("""
                    SELECT 
                        status,
                        COUNT(*) as count,
                        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced), 2) as percentage
                    FROM emails_enhanced 
                    GROUP BY status
                    ORDER BY count DESC
                """)
                
                status_results = cursor.fetchall()
                
                # Phase distribution
                cursor = conn.execute("""
                    SELECT 
                        phase_completed,
                        COUNT(*) as count
                    FROM emails_enhanced 
                    WHERE phase_completed IS NOT NULL
                    GROUP BY phase_completed
                """)
                
                phase_results = cursor.fetchall()
                
                # Business intelligence extraction
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_with_bi,
                        COUNT(CASE WHEN json_extract(workflow_state, '$.business_intelligence.estimated_value') > 0 THEN 1 END) as with_financial_data,
                        COUNT(CASE WHEN json_array_length(json_extract(workflow_state, '$.actionable_items')) > 0 THEN 1 END) as with_actions,
                        SUM(CAST(json_extract(workflow_state, '$.business_intelligence.estimated_value') as REAL)) as total_estimated_value,
                        AVG(CAST(json_extract(workflow_state, '$.confidence') as REAL)) as avg_confidence
                    FROM emails_enhanced 
                    WHERE workflow_state IS NOT NULL 
                    AND json_extract(workflow_state, '$.business_intelligence') IS NOT NULL
                """)
                
                bi_results = cursor.fetchone()
                
                # Recent processing activity (last hour)
                one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
                cursor = conn.execute("""
                    SELECT COUNT(*) 
                    FROM emails_enhanced 
                    WHERE analyzed_at > ? 
                    AND workflow_state IS NOT NULL
                """, (one_hour_ago,))
                
                recent_processed = cursor.fetchone()[0]
                
                # Workflow type distribution
                cursor = conn.execute("""
                    SELECT 
                        json_extract(workflow_state, '$.workflow_analysis.type') as workflow_type,
                        COUNT(*) as count
                    FROM emails_enhanced 
                    WHERE workflow_state IS NOT NULL 
                    AND json_extract(workflow_state, '$.workflow_analysis.type') IS NOT NULL
                    GROUP BY workflow_type
                    ORDER BY count DESC
                    LIMIT 10
                """)
                
                workflow_results = cursor.fetchall()
                
                # Priority distribution
                cursor = conn.execute("""
                    SELECT 
                        json_extract(workflow_state, '$.workflow_analysis.priority') as priority,
                        COUNT(*) as count
                    FROM emails_enhanced 
                    WHERE workflow_state IS NOT NULL 
                    AND json_extract(workflow_state, '$.workflow_analysis.priority') IS NOT NULL
                    GROUP BY priority
                    ORDER BY 
                        CASE priority 
                            WHEN 'Critical' THEN 1 
                            WHEN 'High' THEN 2 
                            WHEN 'Medium' THEN 3 
                            WHEN 'Low' THEN 4 
                            ELSE 5 
                        END
                """)
                
                priority_results = cursor.fetchall()
                
                return {
                    'status_distribution': status_results,
                    'phase_distribution': phase_results,
                    'business_intelligence': bi_results,
                    'recent_activity': recent_processed,
                    'workflow_types': workflow_results,
                    'priority_distribution': priority_results,
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Failed to get processing status: {e}")
            return None
            
    def display_dashboard(self, data):
        """Display comprehensive processing dashboard"""
        print("\n" + "="*80)
        print("🎯 CLAUDE OPUS EMAIL PROCESSING DASHBOARD")
        print("="*80)
        print(f"📅 Last Updated: {data['timestamp']}")
        print(f"⚡ Recent Activity: {data['recent_activity']} emails processed in last hour")
        
        print(f"\n📊 OVERALL STATUS DISTRIBUTION:")
        for status, count, percentage in data['status_distribution']:
            print(f"  {status:12} | {count:8,} emails ({percentage:5.1f}%)")
            
        print(f"\n🔄 PROCESSING PHASE DISTRIBUTION:")
        phase_total = sum(count for _, count in data['phase_distribution'])
        for phase, count in data['phase_distribution']:
            percentage = (count / phase_total * 100) if phase_total > 0 else 0
            phase_name = {1: "Rule-based", 2: "Llama 3.2", 3: "Phi-4"}.get(phase, f"Phase {phase}")
            print(f"  {phase_name:12} | {count:8,} emails ({percentage:5.1f}%)")
            
        bi_data = data['business_intelligence']
        if bi_data:
            total_bi, financial_data, with_actions, total_value, avg_confidence = bi_data
            
            print(f"\n💡 BUSINESS INTELLIGENCE EXTRACTION:")
            print(f"  Total Analyzed     | {total_bi:8,} emails")
            print(f"  Financial Data     | {financial_data:8,} emails")
            print(f"  Actionable Items   | {with_actions:8,} emails") 
            print(f"  Total Est. Value   | ${total_value:12,.2f}")
            print(f"  Avg Confidence     | {avg_confidence:8.3f}")
            
        print(f"\n🏷️  WORKFLOW TYPE DISTRIBUTION:")
        for workflow_type, count in data['workflow_types'][:5]:  # Top 5
            if workflow_type:
                print(f"  {workflow_type:20} | {count:8,} emails")
                
        print(f"\n⚡ PRIORITY DISTRIBUTION:")
        for priority, count in data['priority_distribution']:
            if priority:
                emoji = {"Critical": "🔥", "High": "⚡", "Medium": "📋", "Low": "📝"}.get(priority, "📄")
                print(f"  {emoji} {priority:12} | {count:8,} emails")
                
        print("="*80)
        
    def run_monitor(self, continuous=False):
        """Run the monitoring dashboard"""
        while True:
            data = self.get_processing_status()
            if data:
                self.display_dashboard(data)
            else:
                print("❌ Failed to retrieve processing status")
                
            if not continuous:
                break
                
            time.sleep(30)  # Update every 30 seconds
            
def main():
    monitor = ClaudeOpusMonitor()
    monitor.run_monitor(continuous=False)
    
if __name__ == '__main__':
    main()