#!/usr/bin/env python3
"""
Simple Business Intelligence Report Generator
No external dependencies required
"""

import sqlite3
import json
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any

class SimpleBusinessIntelligenceReport:
    def __init__(self, db_path: str = './data/crewai_enhanced.db'):
        self.db_path = db_path
        
    def generate_report(self) -> str:
        """Generate comprehensive BI report from processed emails"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        # Get processed emails
        cursor = conn.execute("""
            SELECT 
                id, subject, sender_email, received_date_time,
                phase2_result, workflow_state, extracted_entities,
                chain_completeness_score, analyzed_at
            FROM emails_enhanced
            WHERE phase2_result LIKE '%llama_3_2%'
            ORDER BY analyzed_at DESC
        """)
        
        emails = cursor.fetchall()
        
        # Initialize metrics
        metrics = {
            'total': len(emails),
            'workflow_types': defaultdict(int),
            'priorities': defaultdict(int),
            'customers': defaultdict(int),
            'po_numbers': set(),
            'quote_numbers': set(),
            'total_value': 0,
            'high_priority_count': 0,
            'confidences': [],
            'processing_times': [],
            'actionable_items': 0,
            'first_processed': None,
            'last_processed': None
        }
        
        # Process each email
        for email in emails:
            try:
                # Update timestamps
                if not metrics['first_processed'] or email['analyzed_at'] < metrics['first_processed']:
                    metrics['first_processed'] = email['analyzed_at']
                if not metrics['last_processed'] or email['analyzed_at'] > metrics['last_processed']:
                    metrics['last_processed'] = email['analyzed_at']
                
                # Parse workflow state
                workflow = json.loads(email['workflow_state'])
                workflow_type = workflow.get('type', 'Unknown')
                priority = workflow.get('priority', 'Unknown')
                
                metrics['workflow_types'][workflow_type] += 1
                metrics['priorities'][priority] += 1
                
                if priority in ['High', 'Critical']:
                    metrics['high_priority_count'] += 1
                
                # Parse entities
                entities = json.loads(email['extracted_entities'])
                
                # Extract PO numbers
                if 'po_numbers' in entities and entities['po_numbers']:
                    for po in entities['po_numbers']:
                        if po and po != 'None':
                            metrics['po_numbers'].add(po)
                
                # Extract quote numbers
                if 'quote_numbers' in entities and entities['quote_numbers']:
                    for quote in entities['quote_numbers']:
                        if quote and quote != 'None':
                            metrics['quote_numbers'].add(quote)
                
                # Extract customers
                if 'customers' in entities:
                    if isinstance(entities['customers'], list):
                        for customer in entities['customers']:
                            if customer:
                                metrics['customers'][customer] += 1
                    elif isinstance(entities['customers'], dict):
                        name = entities['customers'].get('name')
                        if name:
                            metrics['customers'][name] += 1
                
                # Parse phase2 result for performance metrics
                phase2 = json.loads(email['phase2_result'])
                if 'confidence' in phase2:
                    metrics['confidences'].append(phase2['confidence'])
                if 'processing_time' in phase2:
                    metrics['processing_times'].append(phase2['processing_time'])
                    
                # Count actionable items from entities
                if 'amounts' in entities and entities['amounts']:
                    for amount in entities['amounts']:
                        if isinstance(amount, dict) and amount.get('value', 0) > 0:
                            metrics['total_value'] += amount['value']
                            
            except Exception as e:
                print(f"Error processing email {email['id']}: {e}")
                continue
        
        conn.close()
        
        # Generate report
        report = []
        report.append("="*80)
        report.append("📊 BUSINESS INTELLIGENCE REPORT - EMAIL ANALYSIS")
        report.append("="*80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Executive Summary
        report.append("📈 EXECUTIVE SUMMARY")
        report.append("-"*40)
        report.append(f"Total Emails Analyzed: {metrics['total']:,}")
        
        if metrics['total'] > 0:
            high_priority_rate = metrics['high_priority_count'] / metrics['total'] * 100
            report.append(f"High Priority Rate: {high_priority_rate:.1f}%")
            
            if metrics['confidences']:
                avg_confidence = sum(metrics['confidences']) / len(metrics['confidences'])
                report.append(f"Average Confidence Score: {avg_confidence:.3f}")
            
            if metrics['processing_times']:
                avg_time = sum(metrics['processing_times']) / len(metrics['processing_times'])
                report.append(f"Average Processing Time: {avg_time:.1f} seconds")
        
        report.append(f"Unique PO Numbers: {len(metrics['po_numbers']):,}")
        report.append(f"Unique Quote Numbers: {len(metrics['quote_numbers']):,}")
        report.append(f"Unique Customers: {len(metrics['customers']):,}")
        
        if metrics['total_value'] > 0:
            report.append(f"Total Business Value: ${metrics['total_value']:,.2f}")
        
        report.append("")
        
        # Workflow Distribution
        report.append("📋 WORKFLOW DISTRIBUTION")
        report.append("-"*40)
        for workflow, count in sorted(metrics['workflow_types'].items(), 
                                    key=lambda x: x[1], reverse=True):
            percentage = (count / metrics['total'] * 100) if metrics['total'] > 0 else 0
            report.append(f"{workflow:.<30} {count:>6} ({percentage:>5.1f}%)")
        report.append("")
        
        # Priority Distribution
        report.append("🎯 PRIORITY DISTRIBUTION")
        report.append("-"*40)
        priority_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
        for priority, count in sorted(metrics['priorities'].items(),
                                    key=lambda x: priority_order.get(x[0], 99)):
            percentage = (count / metrics['total'] * 100) if metrics['total'] > 0 else 0
            report.append(f"{priority:.<30} {count:>6} ({percentage:>5.1f}%)")
        report.append("")
        
        # Top Customers
        if metrics['customers']:
            report.append("👥 TOP 20 CUSTOMERS BY EMAIL VOLUME")
            report.append("-"*40)
            top_customers = sorted(metrics['customers'].items(), 
                                 key=lambda x: x[1], reverse=True)[:20]
            for customer, count in top_customers:
                customer_display = customer[:40] if len(customer) > 40 else customer
                report.append(f"{customer_display:.<40} {count:>6} emails")
            report.append("")
        
        # Processing Timeline
        if metrics['first_processed'] and metrics['last_processed']:
            report.append("⏱️ PROCESSING TIMELINE")
            report.append("-"*40)
            report.append(f"First Email Processed: {metrics['first_processed']}")
            report.append(f"Last Email Processed: {metrics['last_processed']}")
            
            # Calculate processing rate
            try:
                start = datetime.fromisoformat(metrics['first_processed'].replace(' ', 'T'))
                end = datetime.fromisoformat(metrics['last_processed'].replace(' ', 'T'))
                duration_minutes = (end - start).total_seconds() / 60
                
                if duration_minutes > 0:
                    rate = metrics['total'] / duration_minutes
                    report.append(f"Processing Rate: {rate:.1f} emails/minute")
                    report.append(f"Processing Duration: {duration_minutes/60:.1f} hours")
            except:
                pass
            report.append("")
        
        # Sample PO and Quote Numbers
        if metrics['po_numbers']:
            report.append("📦 SAMPLE PO NUMBERS")
            report.append("-"*40)
            sample_pos = list(metrics['po_numbers'])[:10]
            for po in sample_pos:
                report.append(f"  • {po}")
            if len(metrics['po_numbers']) > 10:
                report.append(f"  ... and {len(metrics['po_numbers']) - 10} more")
            report.append("")
        
        if metrics['quote_numbers']:
            report.append("📄 SAMPLE QUOTE NUMBERS")  
            report.append("-"*40)
            sample_quotes = list(metrics['quote_numbers'])[:10]
            for quote in sample_quotes:
                report.append(f"  • {quote}")
            if len(metrics['quote_numbers']) > 10:
                report.append(f"  ... and {len(metrics['quote_numbers']) - 10} more")
            report.append("")
        
        report.append("="*80)
        report.append("📌 NOTE: Business value extraction is limited due to simplified workflow_state storage.")
        report.append("Full business intelligence will be available after fixing the storage format.")
        report.append("="*80)
        
        return "\n".join(report)

if __name__ == "__main__":
    import sys
    
    # Check if database exists
    import os
    db_path = './data/crewai_enhanced.db'
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        sys.exit(1)
    
    # Generate report
    reporter = SimpleBusinessIntelligenceReport(db_path)
    report = reporter.generate_report()
    
    # Print report
    print(report)
    
    # Save to file
    report_path = './reports/business_intelligence_report.txt'
    os.makedirs('./reports', exist_ok=True)
    
    with open(report_path, 'w') as f:
        f.write(report)
    
    print(f"\n✅ Report saved to: {report_path}")