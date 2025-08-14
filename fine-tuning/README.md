# Fine-Tuning Pipeline for TD SYNNEX Email Intelligence

## 🚀 Overview

This directory contains the fine-tuning pipeline for training language models to analyze TD SYNNEX email chains with business intelligence extraction capabilities. Currently training **Microsoft Phi-2 (2.7B)** to match Claude's comprehensive analysis quality.

## 📊 Current Status

| Metric | Status |
|--------|--------|
| **Active Model** | Microsoft Phi-2 (2.7B parameters) |
| **Training Status** | 🟢 ACTIVE - Step 2/63 (3.17%) |
| **Dataset** | 2,974 train / 744 validation examples |
| **Target Accuracy** | 70% threshold for deployment |
| **ETA** | ~6.5 hours (CPU training) |

## 🎯 Project Objectives

Train a local LLM to accurately:
1. **Extract Entities** - PO numbers, quotes, customers, products
2. **Detect Workflows** - START, IN-PROGRESS, COMPLETION states
3. **Generate Business Intelligence** - Financial insights, strategic recommendations
4. **Identify Action Items** - Next steps, follow-ups, decisions needed

## 🏗️ Directory Structure

```
fine-tuning/
├── active/                    # Current training files
│   ├── scripts/              # Training & evaluation scripts
│   ├── data/                 # Active datasets
│   ├── models/               # Trained model checkpoints
│   └── logs/                 # Training logs
├── archived/                  # Historical experiments
│   ├── models/               # Previous model attempts
│   ├── scripts/              # Old training scripts
│   └── docs/                 # Historical documentation
├── datasets/                  # Source datasets
│   └── claude_final_analysis_20250601_083919.md
├── docs/                      # Current documentation
│   └── PHI2_TRAINING_STATUS.md
└── utils/                     # Utility scripts
    ├── evaluation/
    ├── monitoring/
    └── data_processing/
```

## 🚦 Quick Start

### Monitor Current Training
```bash
# Check training status
cd /home/pricepro2006/CrewAI_Team/fine-tuning
python3 active/scripts/monitor_training.py

# View live logs
tail -f phi2_training_live_fixed.log

# Check process
ps aux | grep train_phi2_fixed
```

### Start New Training
```bash
# Activate environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run training
cd active/scripts
python3 train_phi2_adaptive.py

# Or use the fixed version for debugging
python3 train_phi2_fixed.py
```

### Evaluate Model
```bash
# After training completes
python3 active/scripts/phase4_evaluation_phi2.py \
    --model-path active/models/phi2-finetuned \
    --test-data datasets/claude_val.json
```

## 📈 Training Configuration

### Phi-2 Settings
```python
Model: microsoft/phi-2
Total Parameters: 2.7B
Trainable (LoRA): 5.2M (0.19%)

Hyperparameters:
- Batch Size: 1
- Gradient Accumulation: 8
- Learning Rate: 2e-4
- Max Length: 1024 tokens
- Epochs: 1 (can increase if needed)

LoRA Configuration:
- r: 8
- alpha: 16
- dropout: 0.1
- targets: ["q_proj", "v_proj", "k_proj", "dense"]
```

### Hardware Requirements
- **Minimum RAM:** 32GB
- **Recommended RAM:** 54GB+ (current setup)
- **CPU:** Multi-core (6+ cores recommended)
- **Storage:** 20GB free space

## 📝 Dataset Format

### Training Data Structure
```json
{
  "examples": [
    {
      "input": "<|user|>\nAnalyze the following TD SYNNEX email batch and extract...<|end|>\n<|assistant|>",
      "output": "## Email Batch Analysis\n\n### Workflow State: IN-PROGRESS\n..."
    }
  ]
}
```

### Ground Truth Source
- **Claude's Analysis:** 4,124 email batches analyzed
- **Located at:** `/claude_final_analysis_20250601_083919.md`
- **Quality:** Professional TD SYNNEX business intelligence

## 🧪 Evaluation Metrics

| Category | Weight | Description |
|----------|--------|-------------|
| **Entity Extraction** | 30% | PO numbers, quotes, customers |
| **Workflow Detection** | 25% | State identification, chain completeness |
| **Business Intelligence** | 25% | Insights, recommendations, risks |
| **Summary Quality** | 20% | Conciseness, accuracy, relevance |

**Deployment Threshold:** 70% overall accuracy

## 🛠️ Key Scripts

### Active Training Scripts
- **train_phi2_adaptive.py** - Main adaptive training pipeline
- **train_phi2_fixed.py** - Fixed version with progress monitoring
- **cpu_optimized_phi2_training.py** - CPU-optimized trainer
- **monitor_training.py** - Real-time training monitor
- **phase4_evaluation_phi2.py** - Evaluation framework

### Data Processing
- **generate_training_from_claude_no_emails.py** - Dataset generator
- **phase2_adaptive_dataset_generator.py** - Adaptive dataset creation

## 📊 Training Progress Tracking

### Log Files
- `phi2_training_progress.log` - Detailed progress with losses
- `phi2_training_live_fixed.log` - Live output from training
- `phi2_training.log` - General training information

### Monitoring Commands
```bash
# Real-time GPU/CPU usage
htop

# Check memory usage
free -h

# Monitor specific process
top -p $(pgrep -f train_phi2)

# View training metrics
grep "Loss:" phi2_training_progress.log | tail -5
```

## 🚀 Deployment Pipeline

### 1. Training Completion
- Model saved to `active/models/phi2-finetuned/`
- Final evaluation metrics calculated

### 2. Accuracy Verification
- Must exceed 70% threshold
- Compare against Claude's ground truth

### 3. Model Export
```bash
# Convert to GGUF format for production
python3 utils/export_to_gguf.py \
    --model active/models/phi2-finetuned \
    --output models/phi2-td-synnex.gguf
```

### 4. Integration
- Deploy to email processing pipeline
- Set up inference server
- Configure API endpoints

## 📚 Historical Context

### Previous Attempts (Archived)
- **Llama 3.2 (3B)** - Memory constraints, training issues
- **Gemma 2B** - Authentication problems with Hugging Face
- **Qwen 2.5 (1.5B)** - Insufficient capacity for complex analysis
- **Phi-3.5-mini** - DynamicCache compatibility issues
- **LFM2** - Custom model, convergence problems

### Why Phi-2?
1. **Optimal Size** - 2.7B parameters fits in available RAM
2. **Architecture** - Proven transformer design
3. **LoRA Support** - Efficient fine-tuning
4. **Community** - Well-documented and supported
5. **Performance** - Good balance of quality and speed

## 🔧 Troubleshooting

### Common Issues

#### Training Stuck at 0%
- First step takes 5-10 minutes due to gradient accumulation
- Check CPU usage: should be 500-600%
- Verify with: `ps aux | grep train_phi2`

#### Out of Memory
- Reduce batch size in configuration
- Enable gradient checkpointing
- Clear cache: `rm -rf ~/.cache/huggingface`

#### Slow Training
- Normal: ~6.5 minutes per step on CPU
- Consider reducing max_length to 512
- Use fewer gradient accumulation steps

## 📋 Requirements

### Python Dependencies
```txt
torch>=2.0.0
transformers>=4.36.0
peft>=0.7.0
datasets>=2.14.0
accelerate>=0.25.0
bitsandbytes>=0.41.0
psutil>=5.9.0
numpy>=1.24.0
tqdm>=4.65.0
```

### System Dependencies
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3-dev python3-pip python3-venv

# Resource monitoring
sudo apt-get install htop iotop
```

## 🤝 Contributing

### Adding New Models
1. Create script in `active/scripts/train_[model]_adaptive.py`
2. Follow existing template structure
3. Add evaluation metrics
4. Document in this README

### Improving Datasets
1. Enhance `datasets/` with new examples
2. Maintain Claude analysis quality standard
3. Update data generators in `utils/data_processing/`

## 📞 Support

### Project Information
- **Project:** TD SYNNEX Email Intelligence System
- **Branch:** feat/llama32-fine-tuning
- **Lead:** CrewAI Team
- **Status:** Active Development

### Resources
- [Phi-2 Model Card](https://huggingface.co/microsoft/phi-2)
- [LoRA Paper](https://arxiv.org/abs/2106.09685)
- [TD SYNNEX Workflow Documentation](../docs/)

## 📅 Timeline

| Date | Milestone |
|------|-----------|
| Aug 11, 2025 | Initial experiments with Llama 3.2 |
| Aug 12, 2025 | Switched to alternative models |
| Aug 13, 2025 | Selected Phi-2, started training |
| Aug 14, 2025 | Expected training completion |
| Aug 15, 2025 | Evaluation and deployment (if >70%) |

## 🎯 Next Steps

1. **Immediate**
   - [x] Monitor current Phi-2 training
   - [ ] Prepare production deployment scripts
   - [ ] Document API integration points

2. **Post-Training**
   - [ ] Run comprehensive evaluation
   - [ ] Export to GGUF format
   - [ ] Benchmark inference speed
   - [ ] Create API wrapper

3. **Production**
   - [ ] Deploy to email pipeline
   - [ ] Set up monitoring
   - [ ] Create backup strategies
   - [ ] Document maintenance procedures

---

**Last Updated:** August 13, 2025 22:20 EST  
**Current Training:** Phi-2 Step 2/63 (PID: 1162222)  
**Estimated Completion:** ~6.5 hours

*For real-time updates, see [PHI2_TRAINING_STATUS.md](docs/PHI2_TRAINING_STATUS.md)*