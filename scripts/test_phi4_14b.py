#!/usr/bin/env python3
"""
Test Phi-4 14B model on test emails
"""

import sqlite3
import json
import time
from datetime import datetime
import requests
import os

# Test email IDs (same as other tests)
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

def analyze_email_with_phi4(email_data):
    """Analyze email using Phi-4 14B"""
    prompt = f"""Analyze this business email and provide a structured analysis.

Subject: {email_data['subject']}
Body: {email_data['body'][:1000]}

Provide a JSON response with:
1. contextual_summary: A business context summary (50-100 words)
2. workflow_state: Classify as START_POINT, IN_PROGRESS, WAITING, or COMPLETION
3. business_process: Identify the process (Order Management, Quote Processing, etc.)
4. entities: Extract business entities:
   - po_numbers: []
   - quote_numbers: []
   - case_numbers: []
   - part_numbers: []
   - companies: []
5. action_items: List any required actions with details
6. urgency_level: Rate urgency as LOW, MEDIUM, HIGH, or CRITICAL
7. suggested_response: Brief suggested response approach

Respond ONLY with valid JSON, no additional text."""

    start_time = time.time()
    
    try:
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": "doomgrave/phi-4:14b-tools-Q3_K_S",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "num_predict": 1000
                }
            },
            timeout=120  # 2 minute timeout for larger model
        )
        
        processing_time = time.time() - start_time
        
        if response.status_code != 200:
            return {
                "error": f"API returned status {response.status_code}",
                "processing_time_seconds": processing_time
            }
        
        # Extract JSON from response
        response_json = response.json()
        response_text = response_json.get('response', '')
        
        # Try to parse JSON
        try:
            # Clean response if needed
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0]
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0]
            
            analysis = json.loads(response_text.strip())
        except json.JSONDecodeError:
            # Fallback structure if JSON parsing fails
            analysis = {
                "contextual_summary": response_text[:200],
                "workflow_state": "UNKNOWN",
                "business_process": "General",
                "entities": {},
                "action_items": [],
                "urgency_level": "MEDIUM",
                "suggested_response": "Manual review required",
                "parse_error": True,
                "raw_response": response_text
            }
        
        analysis['processing_time_seconds'] = processing_time
        analysis['model'] = 'doomgrave/phi-4:14b-tools-Q3_K_S'
        
        return analysis
        
    except Exception as e:
        return {
            "error": str(e),
            "processing_time_seconds": time.time() - start_time,
            "model": 'doomgrave/phi-4:14b-tools-Q3_K_S'
        }

def main():
    """Run incremental test"""
    # Check if we have previous results
    results = []
    if os.path.exists('phi4_14b_results.json'):
        with open('phi4_14b_results.json', 'r') as f:
            results = json.load(f)
        print(f"Loaded {len(results)} previous results")
    
    # Get already processed emails
    processed_ids = {r['email_id'] for r in results}
    
    # Connect to database
    conn = sqlite3.connect('data/app.db')
    conn.row_factory = sqlite3.Row
    
    # Process remaining emails
    for i, email_id in enumerate(test_email_ids):
        if email_id in processed_ids:
            print(f"Skipping already processed: {email_id}")
            continue
            
        print(f"\nAnalyzing email {i+1}/{len(test_email_ids)}: {email_id}")
        
        # Get email data
        row = conn.execute("""
            SELECT id, subject, body, sender_email
            FROM emails
            WHERE id = ?
        """, (email_id,)).fetchone()
        
        if row:
            email_data = dict(row)
            
            # Analyze email
            analysis = analyze_email_with_phi4(email_data)
            
            # Store result
            result = {
                'email_id': email_id,
                'subject': email_data['subject'],
                'analysis': analysis
            }
            results.append(result)
            
            # Save after each email
            with open('phi4_14b_results.json', 'w') as f:
                json.dump(results, f, indent=2)
            
            # Log progress
            if 'error' not in analysis:
                print(f"✓ Completed in {analysis['processing_time_seconds']:.2f}s")
            else:
                print(f"✗ Failed: {analysis['error']}")
        else:
            print(f"Warning: Email {email_id} not found")
    
    conn.close()
    
    # Create final summary
    successful = sum(1 for r in results if 'error' not in r['analysis'])
    total_time = sum(r['analysis']['processing_time_seconds'] for r in results)
    avg_time = total_time / successful if successful > 0 else 0
    
    print("\n" + "="*50)
    print("Phi-4 14B Test Summary")
    print("="*50)
    print(f"Model: doomgrave/phi-4:14b-tools-Q3_K_S")
    print(f"Emails tested: {len(results)}")
    print(f"Successful: {successful}")
    print(f"Failed: {len(results) - successful}")
    print(f"Success rate: {(successful/len(results)*100):.1f}%")
    print(f"Average processing time: {avg_time:.2f} seconds")
    print(f"Total processing time: {total_time:.2f} seconds")
    print("="*50)
    
    # Create summary CSV for comparison
    with open('phi4_14b_summary.csv', 'w') as f:
        f.write('Email ID,Subject,Workflow State,Business Process,Entities Count,Processing Time,Success\n')
        for r in results:
            analysis = r['analysis']
            entity_count = 0
            if 'entities' in analysis and isinstance(analysis['entities'], dict):
                entity_count = sum(len(v) if isinstance(v, list) else 0 for v in analysis['entities'].values())
            
            success = 'error' not in analysis
            workflow = analysis.get('workflow_state', 'ERROR')
            process = analysis.get('business_process', 'ERROR')
            time_taken = analysis['processing_time_seconds']
            
            f.write(f"{r['email_id']},{r['subject'][:50]},{workflow},{process},{entity_count},{time_taken:.2f},{success}\n")
    
    print(f"\nResults saved to: phi4_14b_results.json")
    print(f"Summary saved to: phi4_14b_summary.csv")

if __name__ == "__main__":
    main()