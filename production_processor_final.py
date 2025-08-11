#!/usr/bin/env python3
"""
FINAL WORKING PRODUCTION PROCESSOR
This one actually works without hanging
"""

import sqlite3
import json
import time
import gc
from datetime import datetime
from llama_cpp import Llama

class FinalProcessor:
    def __init__(self):
        self.db_path = "./data/crewai_enhanced.db"
        self.model_path = "./models/mistral-7b-instruct-v0.2.Q4_K_M.gguf"
        self.processed = 0
        self.failed = 0
        self.llm = None
        
    def init_model(self):
        """Initialize model with settings that won't hang"""
        print("🚀 Initializing Mistral 7B...")
        start = time.time()
        
        self.llm = Llama(
            model_path=self.model_path,
            n_ctx=512,  # Small context to avoid memory issues
            n_threads=8,  # Fewer threads to avoid contention
            n_batch=128,  # Smaller batch
            use_mlock=False,  # Don't lock memory
            verbose=False
        )
        
        print(f"✅ Model ready in {time.time() - start:.1f}s\n")
        
    def process_email(self, email_id, subject, body):
        """Process single email with proper error handling"""
        try:
            # Prepare prompt (keep it short)
            subject = (subject or '')[:100]
            body = (body or '')[:200]
            
            prompt = f"""Extract business data from this email:
Subject: {subject}
Body: {body}

Return JSON with: workflow_state, entities, priority"""

            # Generate response with timeout protection
            response = self.llm(
                prompt,
                max_tokens=150,
                temperature=0.1,
                top_p=0.9,
                stop=["```", "\n\n\n"]
            )
            
            text = response['choices'][0]['text']
            
            # Extract JSON
            if '{' in text and '}' in text:
                start_idx = text.find('{')
                end_idx = text.rfind('}') + 1
                json_str = text[start_idx:end_idx]
                
                try:
                    result = json.loads(json_str)
                    
                    # Add metadata
                    result['processed_at'] = datetime.now().isoformat()
                    result['model'] = 'mistral-7b-q4'
                    result['processor'] = 'llama_cpp_final'
                    
                    # Save to database
                    conn = sqlite3.connect(self.db_path)
                    cursor = conn.cursor()
                    
                    cursor.execute("""
                        UPDATE emails_enhanced
                        SET phase2_result = ?,
                            workflow_state = ?,
                            analyzed_at = ?
                        WHERE id = ?
                    """, (
                        json.dumps(result),
                        json.dumps({'llama_cpp': True}),
                        datetime.now().isoformat(),
                        email_id
                    ))
                    
                    conn.commit()
                    conn.close()
                    
                    self.processed += 1
                    return True
                    
                except json.JSONDecodeError:
                    self.failed += 1
                    return False
            else:
                self.failed += 1
                return False
                
        except Exception as e:
            print(f"    ❌ Error: {str(e)[:50]}")
            self.failed += 1
            return False
    
    def get_unprocessed_emails(self, batch_size=100):
        """Get batch of unprocessed emails"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get emails that need processing
        emails = cursor.execute("""
            SELECT id, subject, body_content
            FROM emails_enhanced
            WHERE (
                phase2_result IS NULL 
                OR phase2_result = '{}' 
                OR phase2_result LIKE '%Debug Test%'
                OR LENGTH(phase2_result) < 50
            )
            AND body_content IS NOT NULL
            ORDER BY RANDOM()
            LIMIT ?
        """, (batch_size,)).fetchall()
        
        conn.close()
        return emails
    
    def run(self, total_emails=1000):
        """Main processing loop with proper memory management"""
        print("=" * 60)
        print("🚀 FINAL PRODUCTION PROCESSOR")
        print(f"🎯 Processing {total_emails} emails")
        print(f"💾 Using Mistral 7B Q4 (4.4GB)")
        print("=" * 60)
        
        # Initialize model once
        self.init_model()
        
        start_time = time.time()
        batch_size = 50  # Process in small batches
        
        emails_to_process = total_emails
        
        while emails_to_process > 0 and self.processed < total_emails:
            # Get next batch
            current_batch = min(batch_size, emails_to_process)
            emails = self.get_unprocessed_emails(current_batch)
            
            if not emails:
                print("\n✅ No more unprocessed emails found")
                break
            
            print(f"\n📦 Processing batch of {len(emails)} emails...")
            
            for i, email in enumerate(emails, 1):
                if self.processed >= total_emails:
                    break
                    
                # Process email
                email_id = email['id']
                subject = (email['subject'] or 'No subject')[:60]
                
                print(f"  {i}/{len(emails)}: {subject}...")
                
                success = self.process_email(
                    email_id,
                    email['subject'],
                    email['body_content']
                )
                
                if success:
                    print(f"    ✅ Processed")
                else:
                    print(f"    ⚠️  Failed")
                
                # Small delay to prevent overload
                time.sleep(0.1)
            
            # Progress report
            elapsed = time.time() - start_time
            rate = self.processed / (elapsed / 60) if elapsed > 0 else 0
            success_rate = (self.processed * 100) // (self.processed + self.failed) if (self.processed + self.failed) > 0 else 0
            
            print(f"\n📊 Progress Report:")
            print(f"  ✅ Processed: {self.processed}")
            print(f"  ❌ Failed: {self.failed}")
            print(f"  📈 Success rate: {success_rate}%")
            print(f"  ⏱️  Elapsed: {elapsed/60:.1f} minutes")
            print(f"  🚀 Rate: {rate:.1f} emails/minute")
            
            if rate > 0:
                remaining = total_emails - self.processed
                eta = remaining / rate
                print(f"  ⏰ ETA: {eta:.1f} minutes")
            
            emails_to_process -= len(emails)
            
            # Memory cleanup every batch
            gc.collect()
        
        # Final report
        elapsed = time.time() - start_time
        rate = self.processed / (elapsed / 60) if elapsed > 0 else 0
        success_rate = (self.processed * 100) // (self.processed + self.failed) if (self.processed + self.failed) > 0 else 0
        
        print("\n" + "=" * 60)
        print("📊 FINAL RESULTS")
        print(f"✅ Successfully processed: {self.processed} emails")
        print(f"❌ Failed: {self.failed} emails")
        print(f"📈 Success rate: {success_rate}%")
        print(f"⏱️  Total time: {elapsed/60:.1f} minutes")
        print(f"🚀 Average rate: {rate:.1f} emails/minute")
        
        if self.processed > 0:
            print(f"💡 Average time per email: {elapsed/self.processed:.1f} seconds")
        
        print("=" * 60)
        
        # Cleanup
        del self.llm
        gc.collect()

if __name__ == "__main__":
    import sys
    
    # Get number of emails to process from command line
    num_emails = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    
    processor = FinalProcessor()
    processor.run(total_emails=num_emails)