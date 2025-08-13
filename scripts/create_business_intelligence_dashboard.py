#!/usr/bin/env python3
"""
Business Intelligence Dashboard for Email Analysis
Generates comprehensive reports and visualizations from processed emails
"""

import sqlite3
import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict
import os

class BusinessIntelligenceDashboard:
    def __init__(self, db_path: str = './data/crewai_enhanced.db'):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        
    def get_processed_emails_data(self) -> pd.DataFrame:
        """Get all processed emails with business intelligence"""
        query = """
        SELECT 
            id, subject, sender_email, received_date_time,
            phase2_result, workflow_state, extracted_entities,
            chain_completeness_score, analyzed_at
        FROM emails_enhanced
        WHERE phase2_result LIKE '%llama_3_2%'
        ORDER BY analyzed_at DESC
        """
        return pd.read_sql_query(query, self.conn)
    
    def extract_business_metrics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Extract key business metrics from processed emails"""
        metrics = {
            'total_processed': len(df),
            'processing_dates': {
                'first': df['analyzed_at'].min(),
                'last': df['analyzed_at'].max()
            },
            'workflow_distribution': defaultdict(int),
            'priority_distribution': defaultdict(int),
            'business_value': {
                'total': 0,
                'by_workflow': defaultdict(float),
                'by_priority': defaultdict(float),
                'by_customer': defaultdict(float)
            },
            'actionable_items': {
                'total': 0,
                'by_type': defaultdict(int),
                'by_owner': defaultdict(int)
            },
            'entity_extraction': {
                'po_numbers': [],
                'quote_numbers': [],
                'customers': defaultdict(int),
                'products': defaultdict(int)
            },
            'processing_performance': {
                'avg_confidence': 0,
                'high_priority_rate': 0,
                'avg_processing_time': 0
            }
        }
        
        # Process each email
        for _, row in df.iterrows():
            # Parse workflow state
            try:
                workflow = json.loads(row['workflow_state'])
                workflow_type = workflow.get('type', 'Unknown')
                priority = workflow.get('priority', 'Unknown')
                
                metrics['workflow_distribution'][workflow_type] += 1
                metrics['priority_distribution'][priority] += 1
                
                # Extract business intelligence if stored in full format
                if 'business_intelligence' in str(row['workflow_state']):
                    bi = workflow.get('business_intelligence', {})
                    value = bi.get('estimated_value', 0)
                    if value:
                        metrics['business_value']['total'] += value
                        metrics['business_value']['by_workflow'][workflow_type] += value
                        metrics['business_value']['by_priority'][priority] += value
                
                # Extract entities
                entities = json.loads(row['extracted_entities'])
                if 'po_numbers' in entities:
                    metrics['entity_extraction']['po_numbers'].extend(entities['po_numbers'])
                if 'quote_numbers' in entities:
                    metrics['entity_extraction']['quote_numbers'].extend(entities['quote_numbers'])
                if 'customers' in entities:
                    if isinstance(entities['customers'], list):
                        for customer in entities['customers']:
                            metrics['entity_extraction']['customers'][customer] += 1
                    elif isinstance(entities['customers'], dict):
                        name = entities['customers'].get('name', 'Unknown')
                        metrics['entity_extraction']['customers'][name] += 1
                        
            except Exception as e:
                print(f"Error processing row {row['id']}: {e}")
                
        # Calculate aggregates
        if len(df) > 0:
            # Parse phase2_result for performance metrics
            confidences = []
            processing_times = []
            
            for _, row in df.iterrows():
                try:
                    phase2 = json.loads(row['phase2_result'])
                    confidences.append(phase2.get('confidence', 0))
                    processing_times.append(phase2.get('processing_time', 0))
                except:
                    pass
                    
            if confidences:
                metrics['processing_performance']['avg_confidence'] = sum(confidences) / len(confidences)
            if processing_times:
                metrics['processing_performance']['avg_processing_time'] = sum(processing_times) / len(processing_times)
                
            high_priority_count = (metrics['priority_distribution'].get('High', 0) + 
                                 metrics['priority_distribution'].get('Critical', 0))
            metrics['processing_performance']['high_priority_rate'] = high_priority_count / len(df)
            
        return metrics
    
    def generate_visualizations(self, metrics: Dict[str, Any], output_dir: str = './reports'):
        """Generate visualization charts"""
        os.makedirs(output_dir, exist_ok=True)
        
        # Set style
        plt.style.use('seaborn-v0_8-darkgrid')
        sns.set_palette("husl")
        
        # 1. Workflow Distribution Pie Chart
        if metrics['workflow_distribution']:
            plt.figure(figsize=(10, 8))
            workflows = list(metrics['workflow_distribution'].keys())
            counts = list(metrics['workflow_distribution'].values())
            plt.pie(counts, labels=workflows, autopct='%1.1f%%', startangle=90)
            plt.title('Email Workflow Distribution')
            plt.savefig(f'{output_dir}/workflow_distribution.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 2. Priority Distribution Bar Chart
        if metrics['priority_distribution']:
            plt.figure(figsize=(10, 6))
            priorities = list(metrics['priority_distribution'].keys())
            counts = list(metrics['priority_distribution'].values())
            bars = plt.bar(priorities, counts)
            
            # Color code by priority
            colors = {'Critical': 'red', 'High': 'orange', 'Medium': 'yellow', 'Low': 'green'}
            for bar, priority in zip(bars, priorities):
                bar.set_color(colors.get(priority, 'blue'))
                
            plt.title('Email Priority Distribution')
            plt.xlabel('Priority Level')
            plt.ylabel('Count')
            
            # Add value labels on bars
            for bar in bars:
                height = bar.get_height()
                plt.text(bar.get_x() + bar.get_width()/2., height,
                        f'{int(height)}',
                        ha='center', va='bottom')
                        
            plt.savefig(f'{output_dir}/priority_distribution.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 3. Top Customers by Email Count
        customers = metrics['entity_extraction']['customers']
        if customers:
            plt.figure(figsize=(12, 8))
            top_customers = dict(sorted(customers.items(), key=lambda x: x[1], reverse=True)[:20])
            
            plt.barh(list(top_customers.keys()), list(top_customers.values()))
            plt.title('Top 20 Customers by Email Volume')
            plt.xlabel('Number of Emails')
            plt.tight_layout()
            plt.savefig(f'{output_dir}/top_customers.png', dpi=300, bbox_inches='tight')
            plt.close()
        
        # 4. Processing Timeline
        df = self.get_processed_emails_data()
        if len(df) > 0:
            df['analyzed_at'] = pd.to_datetime(df['analyzed_at'])
            df['hour'] = df['analyzed_at'].dt.floor('H')
            
            hourly_counts = df.groupby('hour').size()
            
            plt.figure(figsize=(15, 6))
            plt.plot(hourly_counts.index, hourly_counts.values, marker='o')
            plt.title('Email Processing Timeline')
            plt.xlabel('Time')
            plt.ylabel('Emails Processed')
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.savefig(f'{output_dir}/processing_timeline.png', dpi=300, bbox_inches='tight')
            plt.close()
    
    def generate_text_report(self, metrics: Dict[str, Any]) -> str:
        """Generate comprehensive text report"""
        report = []
        report.append("="*80)
        report.append("📊 BUSINESS INTELLIGENCE REPORT - EMAIL ANALYSIS")
        report.append("="*80)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Executive Summary
        report.append("📈 EXECUTIVE SUMMARY")
        report.append("-"*40)
        report.append(f"Total Emails Analyzed: {metrics['total_processed']:,}")
        report.append(f"Total Business Value Identified: ${metrics['business_value']['total']:,.2f}")
        report.append(f"High Priority Rate: {metrics['processing_performance']['high_priority_rate']:.1%}")
        report.append(f"Average Confidence Score: {metrics['processing_performance']['avg_confidence']:.2f}")
        report.append("")
        
        # Workflow Analysis
        report.append("📋 WORKFLOW DISTRIBUTION")
        report.append("-"*40)
        total = sum(metrics['workflow_distribution'].values())
        for workflow, count in sorted(metrics['workflow_distribution'].items(), 
                                     key=lambda x: x[1], reverse=True):
            percentage = (count / total * 100) if total > 0 else 0
            report.append(f"{workflow:.<30} {count:>6} ({percentage:>5.1f}%)")
        report.append("")
        
        # Priority Analysis
        report.append("🎯 PRIORITY DISTRIBUTION")
        report.append("-"*40)
        for priority, count in sorted(metrics['priority_distribution'].items(), 
                                     key=lambda x: ['Critical', 'High', 'Medium', 'Low'].index(x[0]) 
                                     if x[0] in ['Critical', 'High', 'Medium', 'Low'] else 99):
            percentage = (count / metrics['total_processed'] * 100) if metrics['total_processed'] > 0 else 0
            report.append(f"{priority:.<30} {count:>6} ({percentage:>5.1f}%)")
        report.append("")
        
        # Entity Extraction Summary
        report.append("🔍 ENTITY EXTRACTION SUMMARY")
        report.append("-"*40)
        report.append(f"Unique PO Numbers: {len(set(metrics['entity_extraction']['po_numbers'])):,}")
        report.append(f"Unique Quote Numbers: {len(set(metrics['entity_extraction']['quote_numbers'])):,}")
        report.append(f"Unique Customers: {len(metrics['entity_extraction']['customers']):,}")
        report.append("")
        
        # Top Customers
        report.append("👥 TOP 10 CUSTOMERS BY EMAIL VOLUME")
        report.append("-"*40)
        top_customers = sorted(metrics['entity_extraction']['customers'].items(), 
                             key=lambda x: x[1], reverse=True)[:10]
        for customer, count in top_customers:
            report.append(f"{customer[:40]:.<40} {count:>6} emails")
        report.append("")
        
        # Performance Metrics
        report.append("⚡ PROCESSING PERFORMANCE")
        report.append("-"*40)
        report.append(f"Average Processing Time: {metrics['processing_performance']['avg_processing_time']:.1f} seconds")
        report.append(f"Average Confidence Score: {metrics['processing_performance']['avg_confidence']:.3f}")
        report.append(f"Processing Period: {metrics['processing_dates']['first']} to {metrics['processing_dates']['last']}")
        
        # Processing rate calculation
        if metrics['processing_dates']['first'] and metrics['processing_dates']['last']:
            try:
                start = pd.to_datetime(metrics['processing_dates']['first'])
                end = pd.to_datetime(metrics['processing_dates']['last'])
                duration = (end - start).total_seconds() / 60  # minutes
                if duration > 0:
                    rate = metrics['total_processed'] / duration
                    report.append(f"Processing Rate: {rate:.1f} emails/minute")
            except:
                pass
                
        report.append("")
        report.append("="*80)
        
        return "\n".join(report)
    
    def generate_full_report(self, output_dir: str = './reports'):
        """Generate complete business intelligence report"""
        print("📊 Generating Business Intelligence Dashboard...")
        
        # Get data and extract metrics
        df = self.get_processed_emails_data()
        metrics = self.extract_business_metrics(df)
        
        # Generate visualizations
        print("📈 Creating visualizations...")
        self.generate_visualizations(metrics, output_dir)
        
        # Generate text report
        print("📝 Generating text report...")
        text_report = self.generate_text_report(metrics)
        
        # Save text report
        report_path = f"{output_dir}/business_intelligence_report.txt"
        with open(report_path, 'w') as f:
            f.write(text_report)
            
        # Also print to console
        print("\n" + text_report)
        
        # Generate CSV exports
        print("💾 Exporting data...")
        
        # Export workflow summary
        workflow_df = pd.DataFrame(list(metrics['workflow_distribution'].items()), 
                                 columns=['Workflow Type', 'Count'])
        workflow_df.to_csv(f"{output_dir}/workflow_summary.csv", index=False)
        
        # Export customer summary
        customer_df = pd.DataFrame(list(metrics['entity_extraction']['customers'].items()), 
                                 columns=['Customer', 'Email Count'])
        customer_df = customer_df.sort_values('Email Count', ascending=False)
        customer_df.to_csv(f"{output_dir}/customer_summary.csv", index=False)
        
        print(f"\n✅ Dashboard generated successfully in {output_dir}/")
        
        return metrics

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate business intelligence dashboard')
    parser.add_argument('--db', type=str, default='./data/crewai_enhanced.db',
                       help='Database path')
    parser.add_argument('--output', type=str, default='./reports',
                       help='Output directory for reports')
    
    args = parser.parse_args()
    
    dashboard = BusinessIntelligenceDashboard(args.db)
    dashboard.generate_full_report(args.output)