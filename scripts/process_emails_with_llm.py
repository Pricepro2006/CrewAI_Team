#!/usr/bin/env python3
"""
Process emails with Claude Opus-style Llama 3.2 prompts
Extracts business intelligence and actionable items
"""

import sys
import json
import sqlite3
from datetime import datetime
sys.path.append('scripts')
from claude_opus_llm_processor import ClaudeOpusLLMProcessor

def display_result(email, result):
    """Display extracted business intelligence"""
    print(f'\n{"="*80}')
    print(f'📧 Email Analysis Complete')
    print(f'{"="*80}')
    print(f'Subject: {email["subject"][:80]}...')
    print(f'From: {email["sender_email"]}')
    print(f'Date: {email["received_date_time"]}')
    print(f'Chain Score: {email["chain_completeness_score"]:.2f}')
    print(f'\n📊 Processing Results:')
    print(f'  Phase: {result["phase"]}')
    print(f'  Method: {result["method"]}')
    print(f'  Confidence: {result.get("confidence", 0):.2f}')
    
    if 'workflow_analysis' in result:
        wa = result['workflow_analysis']
        print(f'\n🔄 Workflow Analysis:')
        print(f'  Type: {wa.get("type")}')
        print(f'  State: {wa.get("state")}')
        print(f'  Priority: {wa.get("priority")}')
    
    if 'business_intelligence' in result:
        bi = result['business_intelligence']
        print(f'\n💰 Business Intelligence:')
        print(f'  Revenue Opportunity: {bi.get("revenue_opportunity")}')
        print(f'  Estimated Value: ${bi.get("estimated_value", 0):,.2f}')
        print(f'  Risk Level: {bi.get("risk_level")}')
        print(f'  Budget Mentioned: {bi.get("budget_mentioned")}')
    
    if 'business_entities' in result:
        entities = result.get('entities', result.get('business_entities', {}))
        if isinstance(entities, dict):
            print(f'\n🏢 Extracted Entities:')
            for entity_type, values in entities.items():
                if values and isinstance(values, list) and len(values) > 0:
                    print(f'  {entity_type}: {values}')
    
    if 'actionable_items' in result and result['actionable_items']:
        print(f'\n✅ Actionable Items ({len(result["actionable_items"])}):')
        for i, item in enumerate(result['actionable_items'], 1):
            print(f'  {i}. {item.get("action")}')
            print(f'     Owner: {item.get("owner")}')
            print(f'     Deadline: {item.get("deadline", "Not specified")}')
            print(f'     Impact: {item.get("business_impact")}')
    
    if 'stakeholders' in result:
        sh = result['stakeholders']
        print(f'\n👥 Stakeholders:')
        for role, people in sh.items():
            if people:
                print(f'  {role}: {people}')
    
    if 'summary' in result and result['summary']:
        print(f'\n📝 Summary:')
        print(f'  {result["summary"]}')

# Initialize processor
print("🚀 Initializing Claude Opus LLM Processor...")
processor = ClaudeOpusLLMProcessor('./data/crewai_enhanced.db')

# Get pending emails
batch_size = 5
emails = processor.get_pending_emails(limit=batch_size)
print(f'\n📬 Found {len(emails)} pending emails to process')

if not emails:
    print("No pending emails found. Checking for unprocessed emails...")
    # Try to get emails that haven't been processed with LLM
    import sqlite3
    with sqlite3.connect('./data/crewai_enhanced.db') as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.execute("""
            SELECT id, subject, body_content, chain_completeness_score,
                   sender_email, received_date_time
            FROM emails_enhanced 
            WHERE phase_completed >= 2
            AND phase2_result NOT LIKE '%llama_3_2%'
            LIMIT ?
        """, (batch_size,))
        emails = [dict(row) for row in cursor.fetchall()]
    print(f'Found {len(emails)} emails that need LLM processing')

# Process emails
results = []
for i, email in enumerate(emails, 1):
    print(f'\n🔄 Processing email {i}/{len(emails)}...')
    
    try:
        result = processor.process_email(email)
        if result:
            results.append(result)
            display_result(email, result)
            
            # Save individual result to database
            processor.update_database([result])
            
            # Save phase-specific results
            phase_result = {
                'method': result['method'],
                'confidence': result.get('confidence', 0),
                'processing_time': result.get('processing_time', 0),
                'timestamp': datetime.now().isoformat()
            }
            
            if result['phase'] == 2:
                phase_col = 'phase2_result'
            elif result['phase'] == 3:
                phase_col = 'phase3_result'
            else:
                phase_col = None
                
            if phase_col:
                with sqlite3.connect('./data/crewai_enhanced.db') as conn:
                    conn.execute(f"""
                        UPDATE emails_enhanced 
                        SET {phase_col} = ?
                        WHERE id = ?
                    """, (json.dumps(phase_result), email['id']))
                    conn.commit()
                    
    except Exception as e:
        print(f'❌ Error processing email: {e}')
        continue

# Final stats
print(f'\n\n{"="*80}')
print(f'📊 Processing Complete!')
print(f'{"="*80}')
print(f'Emails Processed: {len(results)}')
print(f'Processing Stats: {processor.stats}')

# Show aggregate stats
if results:
    total_value = sum(r.get('business_intelligence', {}).get('estimated_value', 0) for r in results)
    total_actions = sum(len(r.get('actionable_items', [])) for r in results)
    high_priority = sum(1 for r in results if r.get('workflow_analysis', {}).get('priority') == 'High')
    
    print(f'\n💼 Business Impact Summary:')
    print(f'  Total Estimated Value: ${total_value:,.2f}')
    print(f'  Total Actionable Items: {total_actions}')
    print(f'  High Priority Emails: {high_priority}')