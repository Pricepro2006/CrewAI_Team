#!/usr/bin/env python3
"""
Run iteration analysis (Opus-4 patterns from email-batch-processor) on test emails
for comparison with Granite3.3:2b results
"""

import sqlite3
import json
import re
from typing import Dict, List, Any

# Test email IDs to analyze (same as Granite test)
test_email_ids = [
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

class IterationAnalyzer:
    """Implements the same analysis patterns from email-batch-processor.ts (created with Opus-4)"""
    
    def analyze_workflow_content(self, subject: str, body_text: str) -> Dict[str, Any]:
        """Analyze workflow content - copied from email-batch-processor.ts"""
        content = f"{subject} {body_text}".lower()
        
        # Determine workflow state with enhanced patterns
        workflow_state = "NEW"
        
        # COMPLETION indicators (highest priority)
        if any(word in content for word in [
            "success", "approved", "completed", "processed", "created", 
            "confirmed", "sent to", "here are", "here is"
        ]):
            workflow_state = "COMPLETION"
        
        # IN_PROGRESS indicators
        elif any(word in content for word in [
            "working on", "in progress", "processing", "reviewing", 
            "investigating", "checking", "looking into"
        ]):
            workflow_state = "IN_PROGRESS"
        
        # START_POINT indicators
        elif any(word in content for word in [
            "request", "need", "please", "can you", "could you", "urgent"
        ]):
            workflow_state = "START_POINT"
        
        # WAITING indicators
        elif any(word in content for word in [
            "waiting", "pending", "hold", "delayed", "on hold"
        ]):
            workflow_state = "WAITING"
        
        # Determine business process
        business_process = "General"
        categories = []
        
        if any(word in content for word in ["quote", "pricing", "price"]):
            business_process = "Quote Processing"
            categories.append("Sales")
        elif any(word in content for word in ["order", "po", "purchase"]):
            business_process = "Order Management" 
            categories.append("Operations")
        elif any(word in content for word in ["deal", "registration", "partner"]):
            business_process = "Deal Registration"
            categories.append("Partner Management")
        elif any(word in content for word in ["briefing", "daily", "newsletter"]):
            business_process = "Information Distribution"
            categories.append("Communications")
        elif any(word in content for word in ["issue", "problem", "correct"]):
            business_process = "Issue Resolution"
            categories.append("Problem Management")
        elif any(word in content for word in ["verification", "address"]):
            business_process = "Verification Processing"
            categories.append("Data Management")
        
        # Identify urgency indicators
        urgency_indicators = []
        if any(word in content for word in [
            "may be deleted", "urgent", "expedite", "in a bind", "asap", "critical"
        ]):
            urgency_indicators.append("HIGH_PRIORITY")
        if "effective" in content and "2025" in content:
            urgency_indicators.append("DEADLINE_SENSITIVE")
        if any(word in content for word in ["price increase", "price change"]):
            urgency_indicators.append("PRICING_UPDATE")
        
        return {
            "workflow_state": workflow_state,
            "business_process": business_process,
            "categories": categories,
            "urgency_indicators": urgency_indicators
        }
    
    def extract_business_entities(self, subject: str, body_text: str) -> Dict[str, List[str]]:
        """Extract business entities - copied patterns from email-batch-processor.ts"""
        content = f"{subject} {body_text}"
        entities = {
            "orders": [],
            "skus": [],
            "companies": [],
            "vendors": [],
            "quotes": [],
            "locations": [],
            "amounts": []
        }
        
        # Extract order numbers
        order_patterns = [
            r'(?:bo#|order#|refuse order#|original order#)\s*:?\s*(\d{6,12})',
            r'(?:so#|so )\s*:?\s*(\d{6,12})',
            r'(?:lypo#|lyso#)\s*(\d{6,12})'
        ]
        
        for pattern in order_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                if match and match not in entities["orders"]:
                    entities["orders"].append(match)
        
        # Extract PO numbers as quotes
        po_patterns = [r'(?:po#|po )\s*:?\s*(\d{6,12})']
        for pattern in po_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                po_ref = f"PO-{match}"
                if po_ref not in entities["quotes"]:
                    entities["quotes"].append(po_ref)
        
        # Extract business reference numbers
        reference_patterns = [
            r'\b\d{7,10}\b',  # 7-10 digit reference numbers
            r'\bf5q-\d+',     # F5 quote numbers
            r'\bftq-\d+',     # FTQ quote numbers
            r'\bpo-\d+',      # Purchase order numbers
            r'\bq-\d+-\d+',   # Vendor quote numbers
            r'\bwq\d+',       # WQ reference numbers
            r'\bcpq-\d+',     # CPQ reference numbers
            r'\bdr\d+',       # Deal registration numbers
            r'\bcas-[a-z0-9]+-[a-z0-9]+',  # CAS case numbers
            r'\breg\s*#\s*([A-Z0-9]+)',    # REG# patterns
            r'\bbd#?\s*(\d+)',  # BD# patterns
            r'\bdb-\d+',      # DB- patterns
            r'\bpn#?\s*([A-Z0-9]+)'  # PN# patterns
        ]
        
        # Focus on subject line for reliability
        for pattern in reference_patterns:
            matches = re.findall(pattern, subject, re.IGNORECASE)
            for match in matches:
                clean_ref = str(match).strip().upper()
                
                # Skip HTML color codes
                if re.match(r'^[0-9A-F]{6}$', clean_ref):
                    continue
                if clean_ref == "0563C1":
                    continue
                
                # Handle BD numbers separately
                if "BD" in clean_ref:
                    clean_ref = re.sub(r'BD#?\s*', '', clean_ref, flags=re.IGNORECASE)
                    bd_ref = f"BD-{clean_ref}"
                    if bd_ref not in entities["quotes"]:
                        entities["quotes"].append(bd_ref)
                    continue
                
                # Add to SKUs if valid
                if len(clean_ref) >= 4 and clean_ref not in entities["skus"] and not clean_ref.isdigit():
                    entities["skus"].append(clean_ref)
        
        # Extract SKUs from subject (more reliable)
        sku_matches = re.findall(r'\b[A-Z0-9]{5,10}(?:#[A-Z0-9]{3})?\b', subject)
        for sku in sku_matches:
            clean_sku = sku.strip()
            if (clean_sku not in entities["skus"] and 
                not clean_sku.isdigit() and 
                not re.match(r'^(BD|PO|REG|DB)\d+$', clean_sku)):
                entities["skus"].append(clean_sku)
        
        return entities
    
    def analyze_email(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a single email using iteration patterns"""
        subject = email_data.get('subject', '')
        body = email_data.get('body', '')
        
        workflow_analysis = self.analyze_workflow_content(subject, body)
        entities = self.extract_business_entities(subject, body)
        
        return {
            "email_id": email_data['id'],
            "subject": subject,
            "body": body[:500],  # First 500 chars
            "sender": email_data.get('sender_email', ''),
            "iteration_analysis": {
                "workflow_state": workflow_analysis["workflow_state"],
                "business_process": workflow_analysis["business_process"],
                "categories": workflow_analysis["categories"], 
                "urgency_indicators": workflow_analysis["urgency_indicators"],
                "entities": entities,
                "entity_summary": {
                    "orders_count": len(entities["orders"]),
                    "skus_count": len(entities["skus"]),
                    "quotes_count": len(entities["quotes"]),
                    "total_entities": sum(len(v) for v in entities.values())
                }
            }
        }

def run_iteration_analysis():
    """Run iteration analysis on test emails"""
    conn = sqlite3.connect('data/app.db')
    conn.row_factory = sqlite3.Row
    analyzer = IterationAnalyzer()
    results = []
    
    for email_id in test_email_ids:
        try:
            # Get email from database
            row = conn.execute("""
                SELECT id, subject, body, sender_email, sender_name, received_at
                FROM emails
                WHERE id = ?
            """, (email_id,)).fetchone()
            
            if row:
                email_data = dict(row)
                result = analyzer.analyze_email(email_data)
                results.append(result)
                print(f"Analyzed: {email_id}")
            else:
                print(f"Warning: Email {email_id} not found")
        
        except Exception as error:
            print(f"Error analyzing {email_id}: {error}")
    
    # Save results
    with open('iteration_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Create summary CSV
    with open('iteration_results_summary.csv', 'w') as f:
        f.write('Email ID,Subject,Workflow State,Business Process,Categories,Total Entities,Orders,SKUs,Quotes\n')
        for r in results:
            analysis = r['iteration_analysis']
            f.write(f'{r["email_id"]},{r["subject"][:50]},{analysis["workflow_state"]},{analysis["business_process"]},"{";".join(analysis["categories"])}",'
                   f'{analysis["entity_summary"]["total_entities"]},{analysis["entity_summary"]["orders_count"]},'
                   f'{analysis["entity_summary"]["skus_count"]},{analysis["entity_summary"]["quotes_count"]}\n')
    
    conn.close()
    print(f"Analyzed {len(results)} emails with iteration script")
    print("Results saved to: iteration_results.json and iteration_results_summary.csv")

if __name__ == "__main__":
    run_iteration_analysis()