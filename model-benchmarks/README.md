# Model Benchmarks

This directory contains all model testing and benchmarking infrastructure for the CrewAI Team project.

## Directory Structure

```
model-benchmarks/
├── processors/        # Various processor implementations for testing
├── test-results/      # Benchmark results and performance metrics  
├── configs/          # Model configurations and test parameters
└── model_test_reports/ # Detailed test reports
```

## Models Being Tested

| Model | Size | Quantization | Purpose |
|-------|------|--------------|---------|
| phi-2.Q4_K_M | 1.7GB | 4-bit | Lightweight inference |
| Qwen3-4B-Instruct | 2.4GB | 4-bit | Instruction following |
| Qwen3-4B-Thinking | 2.4GB | 4-bit | Reasoning tasks |
| DeepSeek-R1-Qwen3-8B | 4.7GB | 4-bit | Advanced reasoning |
| Llama-3.2-3B-Instruct | 1.9GB | 4-bit | General purpose |
| Mistral-7B-Instruct | 4.1GB | 4-bit | Complex tasks |

## Usage

Test results and benchmarks are generated during model evaluation runs. Results are stored in the `test-results/` directory with timestamps.

## Note

All files in this directory are excluded from version control as they contain testing infrastructure and intermediate results.