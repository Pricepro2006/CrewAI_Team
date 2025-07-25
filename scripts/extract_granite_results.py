#!/usr/bin/env python3
"""
Extract Granite3.3:2b analysis results for comparison test emails
"""

import sqlite3
import json
import csv

# Test email IDs
test_emails = [
    'email-8ef42296-42ba-4e7d-90be-0db338a66daf',
    'email-caa27fb2-eb96-4a20-b007-3891e38263af',
    'email-9bc600d9-a47a-4cef-8972-d05dea17b9ef',
    'email-9cc82b32-7e12-4012-b41a-83757a77f210',
    'email-ff0620c2-1900-4808-a12e-51db1a7ba6ea',
    'email-0b7ae5b6-5246-49c5-aed5-c06e56c9f3a9',
    'email-d534d622-7058-4422-9111-9f8c8fd249fc',
    'email-98dc5793-e04e-4597-8299-d2194105aff5',
    'email-b69eaf2d-1c09-4051-9cb5-b1a707b7b707',
    'email-41bdb30a-ee78-4c20-9afa-5448275be868'
]

def extract_granite_results():
    conn = sqlite3.connect('data/app.db')
    conn.row_factory = sqlite3.Row
    
    results = []
    
    for email_id in test_emails:
        # Get email and analysis data
        row = conn.execute("""
            SELECT 
                e.id,
                e.subject,
                e.body,
                e.sender_email,
                ea.contextual_summary,
                ea.action_summary,
                ea.action_details,
                ea.action_sla_status,
                ea.business_impact_revenue,
                ea.business_impact_satisfaction,
                ea.business_impact_urgency_reason,
                ea.suggested_response,
                ea.deep_model,
                ea.deep_confidence,
                ea.entities_po_numbers,
                ea.entities_quote_numbers,
                ea.entities_case_numbers,
                ea.entities_part_numbers,
                ea.entities_order_references,
                ea.entities_contacts,
                ea.quick_workflow
            FROM emails e
            JOIN email_analysis ea ON e.id = ea.email_id
            WHERE e.id = ?
        """, (email_id,)).fetchone()
        
        if row:
            result = {
                'email_id': row['id'],
                'subject': row['subject'],
                'body': row['body'][:500],  # First 500 chars
                'sender': row['sender_email'],
                'workflow': row['quick_workflow'],
                'granite_analysis': {
                    'model': row['deep_model'],
                    'contextual_summary': row['contextual_summary'],
                    'action_summary': row['action_summary'],
                    'action_details': json.loads(row['action_details']) if row['action_details'] else [],
                    'sla_status': row['action_sla_status'],
                    'business_impact': {
                        'revenue': row['business_impact_revenue'],
                        'satisfaction': row['business_impact_satisfaction'],
                        'urgency_reason': row['business_impact_urgency_reason']
                    },
                    'suggested_response': row['suggested_response'],
                    'confidence': row['deep_confidence']
                },
                'entities': {
                    'po_numbers': json.loads(row['entities_po_numbers']),
                    'quote_numbers': json.loads(row['entities_quote_numbers']),
                    'case_numbers': json.loads(row['entities_case_numbers']),
                    'part_numbers': json.loads(row['entities_part_numbers']),
                    'order_references': json.loads(row['entities_order_references']),
                    'contacts': json.loads(row['entities_contacts'])
                }
            }
            results.append(result)
        else:
            print(f"Warning: Email {email_id} not found")
    
    # Save results
    with open('granite_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Create summary CSV
    with open('granite_results_summary.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Email ID', 'Subject', 'Model', 'Summary', 'Actions Count', 'SLA Status', 'Confidence'])
        
        for r in results:
            actions_count = len(r['granite_analysis']['action_details']) if r['granite_analysis']['action_details'] else 0
            writer.writerow([
                r['email_id'],
                r['subject'][:50],
                r['granite_analysis']['model'],
                r['granite_analysis']['contextual_summary'][:100] if r['granite_analysis']['contextual_summary'] else 'N/A',
                actions_count,
                r['granite_analysis']['sla_status'],
                r['granite_analysis']['confidence']
            ])
    
    conn.close()
    print(f"Extracted {len(results)} Granite analysis results")
    print("Saved to: granite_results.json and granite_results_summary.csv")

if __name__ == "__main__":
    extract_granite_results()