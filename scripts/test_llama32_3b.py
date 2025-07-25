#!/usr/bin/env python3
"""
Test Llama 3.2:3b model on the same 10 test emails used for Granite comparison
"""

import sqlite3
import json
import time
from datetime import datetime
import requests
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/llama32_3b_test.log'),
        logging.StreamHandler()
    ]
)

# Test email IDs (same as Granite test)
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

class Llama32Analyzer:
    def __init__(self):
        self.model = 'llama3.2:3b'
        self.api_url = 'http://localhost:11434/api/generate'
        
    def test_model_availability(self):
        """Test if model is available"""
        try:
            # Test with simple prompt
            response = requests.post(
                self.api_url,
                json={
                    "model": self.model,
                    "prompt": "Respond with OK if you're working.",
                    "stream": False,
                    "options": {"temperature": 0.1}
                }
            )
            if response.status_code == 200:
                logging.info(f"Model {self.model} is available and responding")
                return True
            else:
                logging.error(f"Model API returned status {response.status_code}")
                return False
        except Exception as e:
            logging.error(f"Model {self.model} not available: {e}")
            return False
    
    def analyze_email(self, email_data):
        """Analyze email using Llama 3.2:3b"""
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
                self.api_url,
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 1000
                    }
                },
                timeout=300  # 5 minute timeout
            )
            
            processing_time = time.time() - start_time
            
            if response.status_code != 200:
                raise Exception(f"API returned status {response.status_code}: {response.text}")
            
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
                    "parse_error": True
                }
            
            analysis['processing_time_seconds'] = processing_time
            analysis['model'] = self.model
            
            return analysis
            
        except Exception as e:
            logging.error(f"Error analyzing email {email_data['id']}: {e}")
            return {
                "error": str(e),
                "processing_time_seconds": time.time() - start_time,
                "model": self.model
            }

def run_llama32_test():
    """Run Llama 3.2:3b test on 10 emails"""
    analyzer = Llama32Analyzer()
    
    # First test model availability
    if not analyzer.test_model_availability():
        logging.error("Model not available. Please ensure llama3.2:3b is pulled.")
        return
    
    # Connect to database
    conn = sqlite3.connect('data/app.db')
    conn.row_factory = sqlite3.Row
    
    results = []
    total_time = 0
    successful = 0
    
    logging.info(f"Starting analysis of {len(test_email_ids)} test emails")
    
    for i, email_id in enumerate(test_email_ids, 1):
        logging.info(f"Analyzing email {i}/{len(test_email_ids)}: {email_id}")
        
        # Get email data
        row = conn.execute("""
            SELECT id, subject, body, sender_email
            FROM emails
            WHERE id = ?
        """, (email_id,)).fetchone()
        
        if row:
            email_data = dict(row)
            
            # Analyze email
            analysis = analyzer.analyze_email(email_data)
            
            # Track success
            if 'error' not in analysis:
                successful += 1
                total_time += analysis['processing_time_seconds']
            
            # Store result
            result = {
                'email_id': email_id,
                'subject': email_data['subject'],
                'analysis': analysis
            }
            results.append(result)
            
            # Log progress
            if 'error' not in analysis:
                logging.info(f"Completed in {analysis['processing_time_seconds']:.2f}s")
            else:
                logging.error(f"Failed: {analysis['error']}")
        else:
            logging.warning(f"Email {email_id} not found")
    
    conn.close()
    
    # Save results
    with open('llama32_3b_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Create summary
    avg_time = total_time / successful if successful > 0 else 0
    success_rate = (successful / len(test_email_ids)) * 100
    
    summary = {
        "model": "llama3.2:3b",
        "test_date": datetime.now().isoformat(),
        "emails_tested": len(test_email_ids),
        "successful": successful,
        "failed": len(test_email_ids) - successful,
        "success_rate": f"{success_rate:.1f}%",
        "average_processing_time": f"{avg_time:.2f} seconds",
        "total_processing_time": f"{total_time:.2f} seconds"
    }
    
    with open('llama32_3b_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    # Print summary
    logging.info("\n" + "="*50)
    logging.info("Llama 3.2:3b Test Summary")
    logging.info("="*50)
    logging.info(f"Model: {summary['model']}")
    logging.info(f"Emails tested: {summary['emails_tested']}")
    logging.info(f"Success rate: {summary['success_rate']}")
    logging.info(f"Average processing time: {summary['average_processing_time']}")
    logging.info(f"Total processing time: {summary['total_processing_time']}")
    logging.info("="*50)
    
    logging.info(f"Results saved to: llama32_3b_results.json")
    logging.info(f"Summary saved to: llama32_3b_summary.json")

if __name__ == "__main__":
    run_llama32_test()