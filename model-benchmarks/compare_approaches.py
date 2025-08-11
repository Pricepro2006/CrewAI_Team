#!/usr/bin/env python3
"""
Compare rigid pattern matching vs semantic understanding on real emails
"""

import sqlite3
import json
from universal_pattern_extractor import UniversalPatternExtractor
from semantic_email_analyzer import SemanticEmailAnalyzer

def compare_approaches():
    """Compare both approaches on real emails"""
    
    # Initialize both systems
    pattern_extractor = UniversalPatternExtractor()
    semantic_analyzer = SemanticEmailAnalyzer()
    
    # Get some real emails
    conn = sqlite3.connect('/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, subject, body_content
        FROM emails_enhanced
        WHERE body_content IS NOT NULL
        AND LENGTH(body_content) > 100
        AND LENGTH(body_content) < 2000
        LIMIT 5
    """)
    
    emails = cursor.fetchall()
    conn.close()
    
    print("COMPARISON: RIGID PATTERNS vs SEMANTIC UNDERSTANDING")
    print("=" * 70)
    
    for idx, (email_id, subject, body) in enumerate(emails, 1):
        print(f"\n{'='*70}")
        print(f"Email {idx} (ID: {email_id})")
        print(f"Subject: {subject[:60]}..." if subject else "No subject")
        print("-" * 70)
        
        # Clean body for display
        clean_body = body.replace('\n', ' ').replace('\r', ' ')
        # Remove HTML tags
        import re
        clean_body = re.sub(r'<[^>]+>', '', clean_body)
        clean_body = re.sub(r'\s+', ' ', clean_body)[:200] + "..."
        print(f"Body preview: {clean_body}")
        
        # Pattern matching approach
        print("\n📊 PATTERN MATCHING APPROACH:")
        pattern_result = pattern_extractor.extract_from_email(body or "", email_id)
        
        # Count patterns by type
        pattern_counts = {}
        for structure, patterns in pattern_result['patterns_by_structure'].items():
            if structure not in pattern_counts:
                pattern_counts[structure] = 0
            pattern_counts[structure] += len(patterns)
        
        print(f"  Patterns found: {pattern_result['total_patterns']}")
        if pattern_counts:
            top_structures = sorted(pattern_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            print(f"  Top structures: {', '.join([f'{s} ({c})' for s, c in top_structures])}")
        
        # What would pattern matching conclude?
        pattern_conclusion = "unknown"
        if 'A-#-A#A#' in pattern_counts:
            pattern_conclusion = "Has agreement pattern"
        elif '#/#/#' in pattern_counts and pattern_counts['#/#/#'] >= 2:
            pattern_conclusion = "Has multiple dates"
        elif '@#' in pattern_counts:
            pattern_conclusion = "Has system identifiers"
        else:
            pattern_conclusion = "No clear classification"
        
        print(f"  Conclusion: {pattern_conclusion}")
        
        # Semantic approach
        print("\n🧠 SEMANTIC UNDERSTANDING APPROACH:")
        semantic_result = semantic_analyzer.analyze_email(body or "", subject or "")
        
        print(f"  Primary Intent: {semantic_result['primary_intent']}")
        print(f"  Confidence: {semantic_result['confidence']:.1%}")
        print(f"  Context: Urgency={semantic_result['context']['urgency']}, "
              f"Value={semantic_result['context']['value']}")
        
        if semantic_result['actions']:
            print(f"  Actions needed: {', '.join([a['action'] for a in semantic_result['actions']])}")
        
        print(f"  Explanation: {semantic_result['reasoning'][:100]}...")
        
        # Compare conclusions
        print("\n⚖️  COMPARISON:")
        print(f"  Pattern says: '{pattern_conclusion}'")
        print(f"  Semantic says: '{semantic_result['primary_intent']}' "
              f"({semantic_result['confidence']:.0%} confident)")
        
        if semantic_result['requires_human']:
            print("  ⚠️  Semantic analyzer recommends human review")
        else:
            print("  ✅ Semantic analyzer confident in automated handling")
    
    print("\n" + "=" * 70)
    print("SUMMARY: Why Semantic Understanding is Better")
    print("=" * 70)
    print("""
    Pattern Matching Problems:
    ❌ Only sees "A-#-A#A#" not "special pricing agreement"
    ❌ Counts patterns but doesn't understand meaning
    ❌ Can't adapt to new ways of saying the same thing
    ❌ No confidence scoring or uncertainty handling
    
    Semantic Understanding Benefits:
    ✅ Understands "need quote" = "pricing request" = "please provide cost"
    ✅ Identifies what needs to be done (actions)
    ✅ Provides confidence levels for decision making
    ✅ Considers context (urgency, value, sentiment)
    ✅ Can explain its reasoning
    ✅ Learns and improves over time
    """)

if __name__ == "__main__":
    compare_approaches()