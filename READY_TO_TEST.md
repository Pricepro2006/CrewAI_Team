# 🚀 QUANTIZED MODEL TESTING - READY TO RUN

## ✅ Pre-Test Validation: PASSED
All prerequisites verified on 2025-08-09

## 📋 Test Configuration
- **Models to Test:** 7 quantized GGUF models
- **Emails per Model:** 20
- **Timeout per Email:** 180 seconds (3 minutes)
- **Total Test Time:** ~7.5 hours (worst case with all timeouts)
- **Expected Time:** ~2-3 hours (based on typical processing)

## 🎯 Success Criteria
Looking for a model that achieves:
1. **100% Success Rate** - No timeouts or failures
2. **7+/10 Quality Score** - High-quality BI extraction
3. **<180s per Email** - Within timeout limits

## 📦 Models Ready for Testing

| Model | Size | Type | Status |
|-------|------|------|--------|
| Qwen3-4B-Instruct | 2.4 GB | Instruct | ✅ Ready |
| Qwen3-4B-Thinking | 2.4 GB | Thinking | ✅ Ready |
| Llama-3.2-3B-Instruct | 1.9 GB | Instruct | ✅ Ready |
| Qwen3-4B-Unsloth | 2.4 GB | Base | ✅ Ready |
| DeepSeek-R1-Qwen3-8B | 4.8 GB | Reasoning | ✅ Ready |
| Mistral-7B-Instruct-v0.3 | 4.2 GB | Instruct | ✅ Ready |
| Phi-2 | 1.7 GB | Base | ✅ Ready |

## 🚦 How to Run

### Step 1: Shut Down CPU-Intensive Programs
```bash
# Check current CPU usage
top -bn1 | head -20

# Kill any unnecessary processes
pkill -f ollama
pkill -f chrome
```

### Step 2: Run the Test
```bash
# Run with incremental reporting (RECOMMENDED)
python3 test_quantized_models_incremental.py

# The script will:
# 1. Test each model with 20 emails
# 2. Save report after EACH model completes
# 3. Continue even if interrupted (reports saved)
```

### Step 3: Monitor Progress
```bash
# In another terminal, watch the reports directory
watch -n 10 ls -la ./model_test_reports/

# Or tail the latest report
tail -f ./model_test_reports/incremental_report_*.md
```

## 📊 Output Files

Reports will be generated in `./model_test_reports/`:
- `incremental_report_YYYYMMDD_HHMMSS.md` - Main markdown report (updates after each model)
- `incremental_report_YYYYMMDD_HHMMSS.json` - Raw JSON data
- `test_log_YYYYMMDD_HHMMSS.txt` - Detailed log file

## 🔄 Incremental Reporting Features
- **Auto-Save**: Report saved after EACH model completes
- **Interrupt Recovery**: If script crashes, you still have results for completed models
- **Progress Tracking**: Shows completion status (e.g., 3/7 models done)
- **Winner Detection**: Highlights when a model meets all requirements

## 📈 What to Expect

### During Testing
- Each model tests 20 emails sequentially
- Real-time output shows progress: `✅ Q:8/10 in 45.2s`
- Timeouts shown as: `⏱️ TIMEOUT (180.0s)`
- Errors shown as: `❌ ERROR`

### In the Report
- Summary table with all models
- Quality scores (0-10 scale)
- Success rates (percentage)
- Processing speed (emails/minute)
- Clear winner identification

## 🏆 Next Steps After Testing

Once testing completes and a winner is identified:

1. **Deploy Winner for Production**
   ```bash
   # The winning model will be clearly marked in the report
   # Use it for processing the 29,000 TD SYNNEX emails
   ```

2. **Review Detailed Results**
   - Check which models had best quality
   - Analyze timeout patterns
   - Compare processing speeds

3. **Production Pipeline**
   - Use the winning model in production scripts
   - Process the full email backlog
   - Extract real business intelligence

## ⚠️ Important Notes

1. **Resource Usage**: Testing will use significant CPU/RAM
2. **Interruption Safe**: Reports save incrementally - you won't lose progress
3. **Same Emails**: All models test the SAME 20 emails for fair comparison
4. **Claude Prompt**: Uses the proven prompt from lines 66-162 of claude_final_analyzer.py

## 🎉 Ready to Go!

Everything is set up and validated. When you're ready:
```bash
python3 test_quantized_models_incremental.py
```

Good luck finding the best model for TD SYNNEX BI extraction! 🚀