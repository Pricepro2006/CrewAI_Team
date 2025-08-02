#!/usr/bin/env python3
"""
Analyze email chains to find complete workflows
"""

import sqlite3
from collections import defaultdict
from datetime import datetime

def analyze_email_chains():
    """Analyze email chains for completeness"""
    conn = sqlite3.connect('./data/crewai_enhanced.db')
    conn.row_factory = sqlite3.Row
    
    print("📊 Email Chain Completeness Analysis")
    print("=" * 50)
    
    # Get total counts
    total_emails = conn.execute("SELECT COUNT(*) FROM emails_enhanced").fetchone()[0]
    total_conversations = conn.execute("""
        SELECT COUNT(DISTINCT conversation_id) 
        FROM emails_enhanced 
        WHERE conversation_id IS NOT NULL
    """).fetchone()[0]
    
    print(f"Total emails: {total_emails:,}")
    print(f"Total conversations: {total_conversations:,}")
    
    # Analyze conversation lengths
    conv_lengths = conn.execute("""
        SELECT conversation_id, COUNT(*) as email_count
        FROM emails_enhanced
        WHERE conversation_id IS NOT NULL
        GROUP BY conversation_id
        ORDER BY email_count DESC
    """).fetchall()
    
    # Group by length
    length_buckets = defaultdict(int)
    complete_chains = []
    
    for conv in conv_lengths:
        length = conv['email_count']
        length_buckets[length] += 1
        
        # Consider chains with 3+ emails as potentially complete
        if length >= 3:
            # Get emails in this conversation
            emails = conn.execute("""
                SELECT subject, body_content, sender_email, created_date_time
                FROM emails_enhanced
                WHERE conversation_id = ?
                ORDER BY created_date_time
            """, (conv['conversation_id'],)).fetchall()
            
            # Check for workflow patterns
            has_request = False
            has_response = False
            has_resolution = False
            
            for email in emails:
                subject = (email['subject'] or '').lower()
                body = (email['body_content'] or '').lower()
                
                # Look for request patterns
                if any(word in subject + body for word in ['request', 'need', 'help', 'issue', 'problem']):
                    has_request = True
                
                # Look for response patterns  
                if any(word in subject + body for word in ['reply', 're:', 'response', 'working on', 'looking into']):
                    has_response = True
                    
                # Look for resolution patterns
                if any(word in subject + body for word in ['resolved', 'completed', 'done', 'fixed', 'closed']):
                    has_resolution = True
            
            # If has all three patterns, likely a complete workflow
            if has_request and has_response and has_resolution:
                complete_chains.append({
                    'conversation_id': conv['conversation_id'],
                    'email_count': length,
                    'first_subject': emails[0]['subject'] if emails else 'N/A'
                })
    
    print(f"\n📈 Conversation Length Distribution:")
    for length in sorted(length_buckets.keys()):
        count = length_buckets[length]
        percentage = (count / total_conversations) * 100
        print(f"  {length} emails: {count} conversations ({percentage:.1f}%)")
    
    print(f"\n✅ Potentially Complete Workflow Chains: {len(complete_chains)}")
    
    # Show top complete chains
    print("\n🔝 Top 10 Complete Workflow Chains:")
    for i, chain in enumerate(complete_chains[:10], 1):
        print(f"{i}. Conversation: {chain['conversation_id'][:50]}...")
        print(f"   Emails: {chain['email_count']}")
        print(f"   Subject: {chain['first_subject'][:80]}...")
    
    # Get some sample complete chains for verification
    print("\n📋 Sample Complete Chain Analysis:")
    if complete_chains:
        sample_conv = complete_chains[0]['conversation_id']
        emails = conn.execute("""
            SELECT subject, body_preview, sender_email, created_date_time
            FROM emails_enhanced
            WHERE conversation_id = ?
            ORDER BY created_date_time
        """, (sample_conv,)).fetchall()
        
        print(f"\nConversation: {sample_conv[:50]}...")
        for i, email in enumerate(emails, 1):
            print(f"\n  Email {i}:")
            print(f"    From: {email['sender_email']}")
            print(f"    Subject: {email['subject'][:80]}...")
            print(f"    Preview: {email['body_preview'][:100]}...")
    
    conn.close()
    
    return {
        'total_emails': total_emails,
        'total_conversations': total_conversations,
        'complete_chains': len(complete_chains),
        'completion_rate': (len(complete_chains) / total_conversations) * 100 if total_conversations > 0 else 0
    }

if __name__ == "__main__":
    results = analyze_email_chains()
    
    print("\n" + "=" * 50)
    print("📊 SUMMARY")
    print(f"Total Emails: {results['total_emails']:,}")
    print(f"Total Conversations: {results['total_conversations']:,}")
    print(f"Complete Workflow Chains: {results['complete_chains']:,}")
    print(f"Workflow Completion Rate: {results['completion_rate']:.1f}%")