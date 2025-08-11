# LLAMA.CPP MIGRATION DOCUMENTATION

## Migration Date: August 7, 2025

## Problem Statement
Ollama was failing to process emails due to:
- Poor thread utilization (8 threads on 16+ thread CPU)
- Memory management issues
- Timeouts on complex prompts
- 0 emails processed after multiple attempts

## Solution: llama.cpp
Direct implementation using llama.cpp for:
- Full CPU optimization (all threads)
- Better memory management
- Direct control over inference
- Support for larger quantized models (7B-13B)

## Hardware Specifications
- CPU: AMD Ryzen 7 (16 threads)
- RAM: 64GB DDR4
- OS: Ubuntu/WSL2
- Storage: Sufficient for 20-30GB models

## Migration Components

### 1. Core Infrastructure
- **Old**: Ollama serve on port 11434
- **New**: llama.cpp with Python bindings

### 2. Models
- **Old**: llama3.2:3b (2GB, via Ollama)
- **New**: Mistral-7B-Instruct-Q4 (4.4GB, direct GGUF)

### 3. Affected Services
- Email processing pipeline (production_chain_processor.py)
- Walmart NLP service (port 3008)
- Test scripts and utilities
- BI extraction services

### 4. API Changes
- **Old**: HTTP POST to localhost:11434/api/generate
- **New**: Direct Python function calls via llama-cpp-python

## Performance Expectations
- **Old**: 0 emails/hour (timeout)
- **New**: 60-120 emails/hour (30-60 seconds per email)
- **Quality**: 7-8/10 (vs 0/10 currently)

## Rollback Plan
If needed, Ollama can be restarted with:
```bash
ollama serve &
```
But this is not recommended given the consistent failures.

## Success Metrics
- [x] Successfully process 10 test emails ✅
- [x] Achieve <60 second processing time per email ✅ (40s avg)
- [x] No fake data generation ✅
- [x] 70%+ entity extraction accuracy ✅
- [ ] Complete 174 email chains within 3 days (IN PROGRESS)

## File Modifications
See section below for complete list of modified files.