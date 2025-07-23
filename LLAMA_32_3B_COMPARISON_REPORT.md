# Three-Way Model Comparison Report: Llama 3.2:3b vs Granite vs Iteration Script

## Executive Summary

Testing completed on the same 10 test emails used for previous Granite and iteration script analysis. Llama 3.2:3b demonstrates significant improvements over Granite while maintaining reasonable processing times on CPU hardware.

### Overall Performance Scores (1-10 Scale)
- **Llama 3.2:3b**: 6.56/10 ⭐⭐⭐⭐⭐⭐½
- **Granite (Qwen)**: 5.08/10 ⭐⭐⭐⭐⭐
- **Iteration Script**: 4.6/10 ⭐⭐⭐⭐½
- **Opus-4 Reference**: 8.5/10 (baseline target)

### Key Findings

1. **Success Rate**
   - Llama 3.2:3b: 100% (10/10 emails)
   - Granite: 73% (7/10 emails, 3 timeouts)
   - Iteration Script: 100% (10/10 emails)

2. **Processing Speed**
   - Llama 3.2:3b: 9.35 seconds average
   - Granite: 28.0 seconds average
   - Iteration Script: 0.1 seconds average

3. **Quality Metrics**
   - Llama 3.2:3b excels in context understanding (7.5/10) and response suggestions (8.6/10)
   - All approaches show similar business process recognition (8.5-9.0/10)
   - Entity extraction remains challenging for all approaches (1.6-3.8/10)

## Detailed Metric Comparison

| Metric | Llama 3.2:3b | Granite | Iteration | Notes |
|--------|--------------|---------|-----------|-------|
| Context Understanding | 7.5 | 5.9 | 7.0 | Llama provides richer summaries |
| Entity Extraction | 3.8 | 2.0 | 1.6 | All struggle with complex patterns |
| Business Process | 9.0 | 8.0 | 8.5 | All identify processes well |
| Action Items | 3.9 | 3.0 | 3.0 | Llama extracts more actions |
| Response Suggestions | 8.6 | 6.5 | 2.9 | Llama provides best guidance |

## Entity Extraction Performance

Total entities extracted across 10 emails:
- Llama 3.2:3b: 19 entities
- Granite: 38 entities (but with lower precision)
- Iteration Script: 12 entities

### Example: Email "Insight PO 505729474"
- **Llama 3.2:3b**: Correctly extracted PO number and company
- **Granite**: Over-extracted with false positives
- **Iteration**: Extracted PO number only

## Processing Time Analysis

On AMD Ryzen 7 PRO 7840HS (CPU-only):
- Llama 3.2:3b is **3x faster** than Granite
- Llama 3.2:3b is **93x slower** than iteration script
- Trade-off: Significantly better quality for 9.35s vs 0.1s

## Strengths and Weaknesses

### Llama 3.2:3b Strengths
- ✅ 100% reliability (no timeouts)
- ✅ Best contextual understanding
- ✅ Excellent response suggestions
- ✅ Structured JSON output
- ✅ 3x faster than Granite

### Llama 3.2:3b Weaknesses
- ❌ Still 93x slower than patterns
- ❌ Entity extraction needs improvement
- ❌ 9.35s per email for real-time use

### Iteration Script Strengths
- ✅ Lightning fast (0.1s)
- ✅ 100% reliable
- ✅ Good workflow detection

### Iteration Script Weaknesses
- ❌ Limited entity extraction
- ❌ Poor response suggestions
- ❌ No contextual understanding

## Recommendations

### For Immediate Production Use
**Hybrid Approach**: Use iteration script for initial triage, then Llama 3.2:3b for priority emails
- Stage 1: Pattern-based (0.1s) for all 33,797 emails
- Stage 2: Llama 3.2:3b (9.35s) for ~3,000 high-priority emails

### For Achieving 8.5/10 Target
Implement the Advanced Email Analysis System (see ADVANCED_EMAIL_ANALYSIS_SYSTEM_2025.md) which combines:
1. Enhanced preprocessing with spaCy
2. Llama 3.2:3b as primary model
3. Specialized embedding models
4. RAG for context enhancement
5. Ensemble methods for entity extraction

## Test Configuration

- **Hardware**: AMD Ryzen 7 PRO 7840HS, 64GB RAM
- **Models**: 
  - Llama 3.2:3b (via Ollama)
  - Granite3.3:2b (mislabeled as qwen in results)
  - Pattern-based iteration script
- **Test Set**: 10 representative business emails
- **Metrics**: 5 quality dimensions, processing time, success rate

## Next Steps

1. **Immediate**: Test Phi-4 14B model (user pulling doomgrave/phi-4:14b-tools-Q3_K_S)
2. **Short-term**: Implement hybrid pipeline for production
3. **Medium-term**: Deploy Advanced Email Analysis System
4. **Long-term**: Fine-tune models on business email corpus

## Conclusion

Llama 3.2:3b represents a significant improvement over Granite, offering:
- 29% higher overall quality (6.56 vs 5.08)
- 3x faster processing
- 100% reliability

While still below the 8.5/10 target, it's a viable foundation for the hybrid approach and future enhancements outlined in the Advanced Email Analysis System plan.