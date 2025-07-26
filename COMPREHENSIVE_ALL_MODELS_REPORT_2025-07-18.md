# COMPREHENSIVE MODEL COMPARISON REPORT - 4-Step Confidence RAG

**Date**: 2025-07-18
**Models Tested**: 11
**Test Queries**: 6
**Total Test Runs**: 66
**Successful Tests**: 59
**Failed Tests**: 7
**Overall Success Rate**: 89.4%

## Executive Summary

- **Average Confidence**: 86.7%
- **Average Response Time**: 31.98 seconds
- **Average Response Length**: 281 words

## Model Performance Comparison

| Model | Success Rate | Avg Confidence | Avg Time (s) | Avg Words | Best Category | Performance Grade |
|-------|--------------|----------------|--------------|-----------|---------------|-------------------|
| Meta-Llama-3.1-8B-Instruct-GGUF | 100.0% | 87.3% | 47.64 | 258 | factual | A |
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 100.0% | 86.9% | 57.36 | 307 | factual | A |
| qwen3:0.6b | 100.0% | 86.8% | 7.41 | 314 | factual | A |
| gemma3n:e2b | 100.0% | 86.1% | 24.46 | 249 | practical_search | A |
| gemma3n:e4b | 100.0% | 86.1% | 35.65 | 243 | practical_search | A |
| phi4-mini-reasoning:3.8b | 100.0% | 87.4% | 35.53 | 322 | practical_search | A |
| qwen3:1.7b | 100.0% | 87.4% | 15.83 | 324 | factual | A |
| qwen3:4b | 100.0% | 87.5% | 31.05 | 325 | programming | A |
| granite3.3:8b | 100.0% | 84.8% | 51.36 | 235 | programming | A |
| granite3.3:2b | 100.0% | 86.3% | 16.77 | 223 | factual | A |

## Query Performance Analysis

### irrigation_specialist (medium complexity, practical_search category)

**Query**: "Find irrigation specialists for 278 Wycliff Dr. Spartanburg, SC 29301. Issue: Cracked, leaking sprin..."

**Overall Performance**: 89.1% confidence, 43.25s average

| Model | Confidence | Time (s) | Words | Processing Path | Grade |
|-------|------------|----------|-------|-----------------|-------|
| phi4-mini-reasoning:3.8b | 90.0% | 46.80 | 397 | high-confidence | A |
| qwen3:0.6b | 89.5% | 10.71 | 352 | high-confidence | A |
| gemma3n:e2b | 89.5% | 48.24 | 341 | high-confidence | A |
| gemma3n:e4b | 89.5% | 56.85 | 310 | high-confidence | A |
| qwen3:1.7b | 89.5% | 23.82 | 363 | high-confidence | A |
| qwen3:4b | 89.5% | 40.40 | 419 | high-confidence | A |
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 88.6% | 77.51 | 375 | high-confidence | A |
| Meta-Llama-3.1-8B-Instruct-GGUF | 88.1% | 59.04 | 302 | high-confidence | A |
| granite3.3:2b | 87.2% | 25.89 | 320 | high-confidence | A |

### simple_date (simple complexity, factual category)

**Query**: "What is the current date?..."

**Overall Performance**: 89.1% confidence, 3.60s average

| Model | Confidence | Time (s) | Words | Processing Path | Grade |
|-------|------------|----------|-------|-----------------|-------|
| granite3.3:2b | 91.0% | 2.30 | 40 | high-confidence | A |
| Meta-Llama-3.1-8B-Instruct-GGUF | 90.5% | 6.49 | 38 | high-confidence | A |
| qwen3:0.6b | 90.0% | 0.79 | 42 | high-confidence | A |
| qwen3:1.7b | 90.0% | 1.75 | 41 | high-confidence | A |
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 89.6% | 6.89 | 42 | high-confidence | A |
| phi4-mini-reasoning:3.8b | 89.2% | 4.22 | 41 | high-confidence | A |
| qwen3:4b | 89.1% | 3.76 | 42 | high-confidence | A |
| granite3.3:8b | 88.1% | 7.21 | 25 | high-confidence | A |
| gemma3n:e2b | 86.6% | 1.02 | 4 | high-confidence | C |
| gemma3n:e4b | 86.6% | 1.57 | 4 | high-confidence | C |

### complex_research (complex complexity, analytical category)

**Query**: "Research the latest developments in quantum computing and explain how they might impact enterprise A..."

**Overall Performance**: 83.2% confidence, 39.15s average

| Model | Confidence | Time (s) | Words | Processing Path | Grade |
|-------|------------|----------|-------|-----------------|-------|
| qwen3:0.6b | 84.4% | 8.28 | 393 | standard-complex | B |
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 83.9% | 67.70 | 379 | standard-complex | B |
| qwen3:1.7b | 83.9% | 16.96 | 388 | standard-complex | B |
| qwen3:4b | 83.9% | 35.53 | 391 | standard-complex | B |
| phi4-mini-reasoning:3.8b | 83.5% | 40.91 | 407 | standard-complex | B |
| gemma3n:e2b | 83.2% | 25.93 | 359 | standard-complex | B |
| gemma3n:e4b | 83.2% | 42.51 | 326 | standard-complex | B |
| Meta-Llama-3.1-8B-Instruct-GGUF | 82.3% | 62.65 | 337 | standard-complex | B |
| granite3.3:8b | 82.1% | 68.39 | 309 | standard-complex | B |
| granite3.3:2b | 81.4% | 22.62 | 319 | standard-complex | B |

### code_generation (medium complexity, programming category)

**Query**: "Write a Python function to calculate the Fibonacci sequence..."

**Overall Performance**: 88.7% confidence, 37.52s average

| Model | Confidence | Time (s) | Words | Processing Path | Grade |
|-------|------------|----------|-------|-----------------|-------|
| phi4-mini-reasoning:3.8b | 89.9% | 40.26 | 376 | high-confidence | A |
| qwen3:4b | 89.9% | 35.62 | 341 | high-confidence | A |
| Meta-Llama-3.1-8B-Instruct-GGUF | 89.4% | 57.35 | 316 | high-confidence | A |
| granite3.3:8b | 88.9% | 66.04 | 337 | high-confidence | A |
| granite3.3:2b | 88.9% | 14.83 | 184 | high-confidence | A |
| gemma3n:e2b | 88.8% | 25.55 | 247 | high-confidence | A |
| gemma3n:e4b | 88.4% | 40.95 | 265 | high-confidence | A |
| qwen3:0.6b | 87.9% | 8.19 | 395 | high-confidence | A |
| qwen3:1.7b | 87.9% | 17.14 | 416 | high-confidence | A |
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 87.5% | 69.31 | 370 | high-confidence | A |

### creative_writing (medium complexity, creative category)

**Query**: "Write a short story about a robot who discovers emotions..."

**Overall Performance**: 84.6% confidence, 37.65s average

| Model | Confidence | Time (s) | Words | Processing Path | Grade |
|-------|------------|----------|-------|-----------------|-------|
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 88.1% | 60.16 | 405 | high-confidence | A |
| phi4-mini-reasoning:3.8b | 88.1% | 40.24 | 396 | high-confidence | A |
| qwen3:4b | 88.1% | 35.15 | 416 | high-confidence | A |
| qwen3:1.7b | 87.9% | 17.34 | 397 | high-confidence | A |
| qwen3:0.6b | 84.6% | 8.22 | 400 | standard | B |
| Meta-Llama-3.1-8B-Instruct-GGUF | 83.7% | 61.13 | 376 | standard | B |
| granite3.3:2b | 82.1% | 22.02 | 312 | standard | B |
| gemma3n:e2b | 81.1% | 25.78 | 327 | standard | B |
| gemma3n:e4b | 81.1% | 40.74 | 338 | standard | B |
| granite3.3:8b | 80.7% | 65.75 | 317 | standard | B |

### mathematical_problem (medium complexity, mathematical category)

**Query**: "Solve this equation step by step: 3x^2 + 5x - 2 = 0..."

**Overall Performance**: 85.6% confidence, 31.84s average

| Model | Confidence | Time (s) | Words | Processing Path | Grade |
|-------|------------|----------|-------|-----------------|-------|
| Meta-Llama-3.1-8B-Instruct-GGUF | 89.9% | 39.17 | 181 | high-confidence | A |
| gemma3n:e4b | 87.4% | 31.26 | 216 | high-confidence | A |
| gemma3n:e2b | 87.0% | 20.25 | 216 | high-confidence | A |
| granite3.3:2b | 87.0% | 12.94 | 165 | high-confidence | A |
| qwen3:1.7b | 84.7% | 17.94 | 341 | standard | B |
| qwen3:4b | 84.2% | 35.83 | 342 | standard | B |
| DeepSeek-R1-0528-Qwen3-8B-GGUF | 84.0% | 62.59 | 269 | standard | B |
| qwen3:0.6b | 84.0% | 8.25 | 302 | standard | B |
| granite3.3:8b | 84.0% | 49.42 | 187 | standard | B |
| phi4-mini-reasoning:3.8b | 83.5% | 40.75 | 313 | standard | B |

## 4-Step Methodology Analysis

**Step Completion Rates**:
- Step 1 (Query Analysis): 100.0%
- Step 2 (Response Generation): 89.4%
- Step 3 (Evaluation): 89.4%
- Step 4 (Adaptive Delivery): 89.4%

## Recommendations

### Top Performing Models:

1. **granite3.3:2b** - 91.0% confidence
   - Best for: factual queries
   - Performance: fast/high/high

2. **Meta-Llama-3.1-8B-Instruct-GGUF** - 90.5% confidence
   - Best for: factual queries
   - Performance: fast/high/high

3. **qwen3:0.6b** - 90.0% confidence
   - Best for: factual queries
   - Performance: fast/high/high

### Use Case Recommendations:

- **For Speed**: Choose models with <10s response times
- **For Accuracy**: Choose models with >85% confidence scores
- **For Complex Queries**: Use high-confidence-complex processing path
- **For Production**: Consider models with 'A' performance grades

## Conclusion

The comprehensive testing demonstrates successful implementation of the 4-step confidence RAG methodology across 11 diverse models. The system successfully evaluated 66 total interactions with a 89.4% success rate.

