# LFM2-1.2B Adaptive Fine-Tuning for Email Batch Analysis
**Zero-Hardcoding Methodology with Curriculum Learning**

---

## 🚀 Current Project: LFM2-1.2B Adaptive Training
**Status**: Phase 3 - Baseline Training (Fixing gradient checkpointing issue)  
**Last Updated**: August 13, 2025

### ⚠️ IMPORTANT: Active vs Archived Files
- **USE**: Scripts in main `fine-tuning/` directory
- **DO NOT USE**: Files in `archive_old_100_examples/` (outdated, hardcoded)

---

## Project Overview

This project implements an **adaptive, zero-hardcoding training pipeline** to fine-tune the LiquidAI/LFM2-1.2B model (1.17B parameters) for mapping email batch numbers to Claude's comprehensive analysis of TD SYNNEX emails.

### Key Innovation: Zero-Hardcoding Philosophy
- All thresholds computed dynamically from data distributions
- Adaptive curriculum learning with 10 difficulty levels
- Error-focused resampling that prioritizes problematic examples
- No hardcoded values - everything data-driven

### Model Architecture
- **Base Model**: LiquidAI/LFM2-1.2B (1.17B parameters)
- **Training Method**: LoRA (r=8, alpha=16, dropout=0.05)
- **Trainable Parameters**: 442,368 (0.038% of total)
- **Hardware**: CPU-only (AMD Ryzen 7 PRO, 54GB RAM)

---

## 📊 Current Training Status

### Completed Phases ✅
| Phase | Description | Status | Key Outputs |
|-------|-------------|--------|-------------|
| **Phase 1** | Data Analysis | ✅ Complete | 4,124 batch analyses extracted, 82.2% avg quality |
| **Phase 2** | Adaptive Dataset Generation | ✅ Complete | 500 train / 100 validation examples |

### In Progress 🔄
| Phase | Description | Status | Current Issue |
|-------|-------------|--------|---------------|
| **Phase 3** | Baseline Training | ⚠️ Blocked | Gradient checkpointing incompatibility |

### Pending Phases ⏳
- **Phase 4**: Evaluation Framework
- **Phase 5**: Iterative Improvement  
- **Phase 6**: Production Deployment

---

## Dataset Details

### Source Data
- **Primary**: `/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md` (13MB)
  - Claude's comprehensive analysis of all email batches
- **Email Batches**: `/home/pricepro2006/CrewAI_Team/email_batches/`
  - 3,380 JSON files containing TD SYNNEX emails

### Adaptive Dataset Statistics
| Metric | Training | Validation |
|--------|----------|------------|
| **Total Examples** | 500 | 100 |
| **Unique Batches** | 350 | 97 |
| **Avg Difficulty** | 0.91 | 2.12 |
| **Curriculum Level** | 2 | 2 |
| **Quality Distribution** | 351 poor, 86 fair, 63 good | 45 good, 33 fair, 22 poor |

---

## Training Pipeline

### Phase 1: Data Analysis ✅
```bash
python3 phase1_data_analysis.py
```
**Outputs**:
- `phase1_results/data_analysis_report.json` - Overall statistics
- `phase1_results/quality_metrics.json` - Quality scores for all batches
- `phase1_results/pattern_library.json` - Extracted patterns

### Phase 2: Adaptive Dataset Generation ✅
```bash
python3 phase2_adaptive_dataset_generator.py
```
**Key Feature - Zero Hardcoding**:
```python
# Dynamic threshold computation (no hardcoded values)
quality_thresholds = {
    'excellent': np.percentile(scores, 75),  # Top 25%
    'good': np.percentile(scores, 50),       # Top 50%
    'fair': np.percentile(scores, 25)        # Top 75%
}
```
**Outputs**:
- `datasets/adaptive_train.json` - 500 training examples
- `datasets/adaptive_val.json` - 100 validation examples
- `datasets/dataset_report.json` - Generation metadata

### Phase 3: Baseline Training 🔄
```bash
python3 train_adaptive_lfm2.py
```
**Current Issue**: Gradient checkpointing incompatibility with LFM2
```python
# Fix needed in train_adaptive_lfm2.py line 184:
gradient_checkpointing=False  # Was True, causes conv1d tensor error
```

---

## Directory Structure

```
fine-tuning/
├── 📊 Active Training Pipeline
│   ├── phase1_data_analysis.py                 # Analyzes email batches
│   ├── phase2_adaptive_dataset_generator.py    # Creates adaptive datasets
│   ├── train_adaptive_lfm2.py                 # Main training script (500 examples)
│   ├── training_progress_monitor.py           # Real-time progress visualization
│   │
│   ├── phase1_results/                        # Analysis outputs
│   │   ├── data_analysis_report.json
│   │   ├── quality_metrics.json
│   │   └── pattern_library.json
│   │
│   ├── datasets/                               # Adaptive datasets
│   │   ├── adaptive_train.json (500 examples)
│   │   ├── adaptive_val.json (100 examples)
│   │   └── dataset_report.json
│   │
│   └── models/
│       └── lfm2_adaptive_curriculum/          # Target for trained model
│
├── 📚 Documentation
│   ├── README.md                              # This file
│   ├── ADAPTIVE_TRAINING_PLAN.md              # Original 6-phase plan
│   ├── COMPREHENSIVE_ADAPTIVE_TRAINING_PLAN.md # Enhanced zero-hardcoding plan
│   └── FILE_INVENTORY_COMPLETE.md             # Complete file listing
│
├── 📝 Logs
│   ├── adaptive_training.log                  # Current training log
│   └── adaptive_training_live.log             # Live output
│
└── ⚠️ ARCHIVED - DO NOT USE
    └── archive_old_100_examples/
        ├── train_email_batch_analysis.py      # OLD: Only 100 examples, hardcoded
        ├── email_batch_training.log           # OLD: Wrong dataset
        └── email_batch_analyzer/              # OLD: Incomplete checkpoint
```

---

## How to Run

### Prerequisites
```bash
pip install transformers peft datasets torch
```

### Step 1: Verify Adaptive Datasets Exist
```bash
ls -la datasets/adaptive_*.json
# Should show adaptive_train.json (500) and adaptive_val.json (100)
```

### Step 2: Fix Gradient Checkpointing Issue
Edit `train_adaptive_lfm2.py` line 184:
```python
gradient_checkpointing=False  # Change from True
```

### Step 3: Launch Training
```bash
cd /home/pricepro2006/CrewAI_Team/fine-tuning
python3 train_adaptive_lfm2.py
```

### Step 4: Monitor Progress
```bash
# Real-time monitoring
python3 training_progress_monitor.py --live

# Check logs
tail -f adaptive_training.log
```

---

## ⚠️ Common Issues & Solutions

### 1. Gradient Checkpointing Error
**Error**: `Expected 2D (unbatched) or 3D (batched) input to conv1d`  
**Fix**: Set `gradient_checkpointing=False` in training arguments

### 2. TensorBoard Missing
**Error**: `TensorBoardCallback requires tensorboard`  
**Fix**: Set `report_to=[]` in training arguments

### 3. Wrong Dataset Size
**Issue**: Training on 100 examples instead of 500  
**Fix**: Use `train_adaptive_lfm2.py` NOT the archived scripts

---

## Training Data Format

### Input Format (Adaptive Dataset)
```json
{
  "batch_number": 2435,
  "instruction": "Analyze email batch #2435",
  "input": "This batch contains 5 emails from TD SYNNEX communications.",
  "output": "## Batch 2435 Analysis\n\n[Claude's comprehensive analysis...]",
  "difficulty": 0.85,
  "quality_score": 78.5,
  "curriculum_level": 2
}
```

### Key Patterns Being Learned
1. **Email Chain Workflows**: START → IN-PROGRESS → COMPLETION states
2. **Business Entities**: SPAs (CAS-*), POs, Quote IDs
3. **Action Sequences**: Order processing, quote generation, support tickets
4. **Temporal Patterns**: Email threading and response patterns
5. **Urgency Classification**: Priority determination from context

---

## Success Metrics

### Training Targets
- [ ] Complete 5 epochs on 500 examples
- [ ] Achieve training loss < 2.0
- [ ] Validation loss convergence
- [ ] Save best model checkpoint

### Production Goals
- [ ] Zero errors on 2,000+ test queries
- [ ] Accurate batch-to-analysis mapping
- [ ] Synonym learning capability
- [ ] Sub-second inference time

---

## Important Notes

### ⚠️ DO NOT USE These Old Files
| File | Problem | Location |
|------|---------|----------|
| `train_email_batch_analysis.py` | Hardcoded to 100 examples | `archive_old_100_examples/` |
| Old training logs | Wrong dataset, incomplete | `archive_old_100_examples/` |
| Old model checkpoints | Trained on wrong data | `archive_old_100_examples/` |

### ✅ USE These Current Files
| File | Purpose | Examples |
|------|---------|----------|
| `train_adaptive_lfm2.py` | Main training script | 500 train / 100 val |
| `datasets/adaptive_*.json` | Adaptive datasets | Zero-hardcoding |
| `training_progress_monitor.py` | Progress visualization | Real-time updates |

---

## Next Steps

1. **Immediate**: Fix gradient checkpointing in `train_adaptive_lfm2.py`
2. **Today**: Complete Phase 3 baseline training with 500 examples
3. **Tomorrow**: Implement Phase 4 evaluation framework
4. **This Week**: Begin Phase 5 iterative improvements
5. **Next Week**: Deploy to production (Phase 6)

---

## References

### Project Documents
- Adaptive Training Plan: `ADAPTIVE_TRAINING_PLAN.md`
- Comprehensive Plan: `COMPREHENSIVE_ADAPTIVE_TRAINING_PLAN.md`
- File Inventory: `FILE_INVENTORY_COMPLETE.md`

### Original Llama 3.2 Work (Archived)
- Pattern Discovery: `/model-benchmarks/TRUE_PATTERN_DISCOVERY_REPORT.md`
- Email Analysis: `/model-benchmarks/FINAL_ANALYSIS_REPORT.md`
- Original attempt with 143,221 emails (replaced by LFM2 approach)

---

*Branch: feat/llama32-fine-tuning*  
*Model: LiquidAI/LFM2-1.2B*  
*Created: August 11, 2025*  
*Updated: August 13, 2025 - Adaptive Pipeline v2.0*