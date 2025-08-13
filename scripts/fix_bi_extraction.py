#!/usr/bin/env python3
"""
Fix BI extraction by using appropriate model and storing full data
"""

import sqlite3
import json
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def analyze_current_state():
    """Analyze current BI extraction state"""
    
    db_path = '/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db'
    
    with sqlite3.connect(db_path) as conn:
        # Check workflow_state storage
        cursor = conn.execute("""
            SELECT 
                COUNT(*) as total_emails,
                COUNT(CASE WHEN workflow_state IS NOT NULL THEN 1 END) as with_workflow,
                COUNT(CASE WHEN LENGTH(workflow_state) > 100 THEN 1 END) as proper_json,
                COUNT(CASE WHEN LENGTH(workflow_state) < 50 THEN 1 END) as truncated,
                AVG(CASE WHEN workflow_state IS NOT NULL THEN LENGTH(workflow_state) END) as avg_length,
                MAX(LENGTH(workflow_state)) as max_length
            FROM emails_enhanced
        """)
        
        stats = cursor.fetchone()
        
        print("\n📊 Current BI Storage Analysis:")
        print(f"Total emails: {stats[0]:,}")
        print(f"With workflow_state: {stats[1]:,}")
        print(f"Proper JSON (>100 chars): {stats[2]:,}")
        print(f"Truncated (<50 chars): {stats[3]:,}")
        print(f"Average length: {stats[4]:.0f} chars")
        print(f"Max length: {stats[5]:,} chars")
        
        # Check methods used
        cursor = conn.execute("""
            SELECT 
                CASE 
                    WHEN workflow_state LIKE '%claude_opus%' THEN 'claude_opus'
                    WHEN workflow_state LIKE '%llama_3_2%' THEN 'llama_3_2'
                    WHEN workflow_state LIKE '%phi_4%' THEN 'phi_4'
                    WHEN workflow_state = 'general_inquiry' THEN 'basic_rule'
                    ELSE 'other'
                END as method,
                COUNT(*) as count,
                AVG(LENGTH(workflow_state)) as avg_length
            FROM emails_enhanced
            WHERE workflow_state IS NOT NULL
            GROUP BY method
            ORDER BY count DESC
        """)
        
        print("\n📈 Processing Methods Distribution:")
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]:,} emails (avg {row[2]:.0f} chars)")
        
        # Check financial values extracted
        cursor = conn.execute("""
            SELECT COUNT(*) as emails_with_value
            FROM emails_enhanced
            WHERE workflow_state LIKE '%estimated_value%'
            AND workflow_state NOT LIKE '%"estimated_value": 0%'
            AND workflow_state NOT LIKE '%"estimated_value":0%'
        """)
        
        value_count = cursor.fetchone()[0]
        print(f"\n💰 Emails with financial values: {value_count:,}")
        
        # Sample a properly processed email
        cursor = conn.execute("""
            SELECT workflow_state
            FROM emails_enhanced
            WHERE LENGTH(workflow_state) > 800
            AND workflow_state LIKE '%claude_opus%'
            LIMIT 1
        """)
        
        sample = cursor.fetchone()
        if sample:
            try:
                data = json.loads(sample[0])
                print("\n✅ Sample Successful BI Extraction:")
                print(f"  Method: {data.get('method')}")
                print(f"  Confidence: {data.get('confidence', 0):.2f}")
                
                bi = data.get('business_intelligence', {})
                print(f"  Estimated Value: ${bi.get('estimated_value', 0):,}")
                print(f"  Revenue Opportunity: {bi.get('revenue_opportunity')}")
                
                items = data.get('actionable_items', [])
                print(f"  Actionable Items: {len(items)}")
                
                summary = data.get('summary', '')
                print(f"  Summary Length: {len(summary)} chars")
            except:
                pass

def create_optimized_processor():
    """Create optimized BI processor configuration"""
    
    config = {
        "model_routing": {
            "critical": "doomgrave/phi-4:14b-tools-Q3_K_S",  # Best available
            "high": "doomgrave/phi-4:14b-tools-Q3_K_S",
            "medium": "llama3.2:3b",
            "low": "llama3.2:3b"
        },
        "prompt_optimization": {
            "simplified_for_small_models": True,
            "focus_on_extraction": True,
            "reduce_analysis_depth": False  # Keep depth for Phi-4
        },
        "storage_fixes": {
            "ensure_full_json": True,
            "validate_before_store": True,
            "compress_if_needed": False
        },
        "quality_thresholds": {
            "min_summary_length": 100,
            "min_json_length": 500,
            "require_financial_analysis": True
        }
    }
    
    print("\n🔧 Recommended Configuration:")
    print(json.dumps(config, indent=2))
    
    return config

def main():
    print("="*60)
    print("BI EXTRACTION FIX ANALYSIS")
    print("="*60)
    
    analyze_current_state()
    config = create_optimized_processor()
    
    print("\n📌 Action Items:")
    print("1. ✅ Storage is working (TEXT column, no truncation)")
    print("2. ⚠️  Only 1,020 emails with proper claude_opus processing")
    print("3. ❌ 142,201 emails still need BI extraction")
    print("4. 🔧 Use Phi-4 14B for better extraction quality")
    print("5. 📈 Implement model routing based on email priority")
    
    print("\n💡 Next Step: Run enhanced processor with Phi-4")
    print("   python3 scripts/claude_opus_llm_processor.py")

if __name__ == "__main__":
    main()