#!/usr/bin/env python3
"""
Pre-Test Validation Script
Verifies everything is ready before running the full test suite
"""

import os
import sqlite3
from pathlib import Path
from datetime import datetime

def validate_environment():
    """Check all prerequisites"""
    
    print("=" * 60)
    print("🔍 PRE-TEST VALIDATION")
    print("=" * 60)
    
    all_good = True
    
    # 1. Check llama.cpp binary
    binary_path = "./llama.cpp/build/bin/llama-cli"
    if Path(binary_path).exists():
        print("✅ llama.cpp binary found")
    else:
        print("❌ llama.cpp binary NOT found at:", binary_path)
        all_good = False
        
    # 2. Check models directory
    models_dir = Path("./models")
    if models_dir.exists():
        gguf_files = list(models_dir.glob("*.gguf"))
        print(f"✅ Models directory found with {len(gguf_files)} GGUF files")
        
        # List the specific models we need
        required_models = [
            'Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf',
            'Qwen3-4B-Thinking-2507-Q4_K_M.gguf',
            'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
            'Qwen3-4B-Q4_K_M.gguf',
            'DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf',
            'Mistral-7B-Instruct-v0.3.Q4_K_M.gguf',
            'phi-2.Q4_K_M.gguf'
        ]
        
        print("\n📦 Required Models Check:")
        for model in required_models:
            model_path = models_dir / model
            if model_path.exists():
                size_mb = model_path.stat().st_size / (1024 * 1024)
                print(f"  ✅ {model} ({size_mb:.1f} MB)")
            else:
                # Check for case variations
                similar = [f for f in gguf_files if model.lower() in f.name.lower()]
                if similar:
                    print(f"  ⚠️ {model} - Similar found: {similar[0].name}")
                else:
                    print(f"  ❌ {model} - NOT FOUND")
                    all_good = False
    else:
        print("❌ Models directory NOT found")
        all_good = False
        
    # 3. Check database
    db_path = "./data/crewai_enhanced.db"
    if Path(db_path).exists():
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Count available emails
            result = cursor.execute("""
                SELECT COUNT(*) 
                FROM emails_enhanced 
                WHERE body_content IS NOT NULL 
                AND LENGTH(body_content) > 100
                AND LENGTH(body_content) < 3000
            """).fetchone()
            
            email_count = result[0] if result else 0
            print(f"✅ Database found with {email_count:,} testable emails")
            
            if email_count < 20:
                print("  ⚠️ Warning: Less than 20 emails available for testing")
                all_good = False
                
            conn.close()
        except Exception as e:
            print(f"❌ Database error: {e}")
            all_good = False
    else:
        print("❌ Database NOT found at:", db_path)
        all_good = False
        
    # 4. Check test scripts
    scripts = [
        'test_quantized_models_incremental.py',
        'download_models.py'
    ]
    
    print("\n📜 Test Scripts:")
    for script in scripts:
        if Path(script).exists():
            print(f"  ✅ {script}")
        else:
            print(f"  ❌ {script} - NOT FOUND")
            all_good = False
            
    # 5. Check output directories
    dirs_to_check = [
        './model_test_reports',
        './test_logs'
    ]
    
    print("\n📁 Output Directories:")
    for dir_path in dirs_to_check:
        dir_obj = Path(dir_path)
        if dir_obj.exists():
            files = list(dir_obj.glob("*"))
            print(f"  ✅ {dir_path} ({len(files)} files)")
        else:
            print(f"  ℹ️ {dir_path} - Will be created")
            
    # Summary
    print("\n" + "=" * 60)
    if all_good:
        print("✅ ALL CHECKS PASSED - Ready to test!")
        print("\nTo run the test:")
        print("  python3 test_quantized_models_incremental.py")
        print("\nReports will be saved to:")
        print("  ./model_test_reports/incremental_report_*.md")
    else:
        print("❌ SOME CHECKS FAILED - Please fix issues above")
        print("\nIf models are missing, run:")
        print("  python3 download_models.py")
        
    print("=" * 60)
    
    return all_good

if __name__ == "__main__":
    validate_environment()