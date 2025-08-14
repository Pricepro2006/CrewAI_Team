# llama.cpp Fine-Tuning for Business Intelligence

## System Optimization for AMD Ryzen 7 + 64GB RAM

### **Why llama.cpp Over Other Methods**

1. **✅ Native CPU Optimization** - Utilizes all 16 threads efficiently
2. **✅ Memory Efficient** - Works perfectly with your 64GB RAM
3. **✅ Existing Infrastructure** - Uses your built llama.cpp binaries
4. **✅ GGUF Native** - Direct quantized model output
5. **✅ Production Ready** - Same inference pipeline you already use

### **Performance Expectations**

| Metric | Expected Value |
|--------|----------------|
| Training Time | 4-6 hours |
| Memory Usage | ~35GB peak |
| CPU Utilization | 95%+ on all 16 threads |
| Final Model Size | ~2GB (Q4_K_M quantized) |
| Processing Speed | 60+ emails/hour after training |

## Pre-Flight Checklist

### ✅ **Verify Prerequisites**
```bash
# 1. Check base model exists
ls -lh /home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf

# 2. Verify llama-finetune binary
ls -la /home/pricepro2006/CrewAI_Team/llama.cpp/build/bin/llama-finetune

# 3. Check dataset
wc -l /home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset/robust_business_intelligence_training.jsonl

# 4. Verify disk space (need ~15GB)
df -h /home/pricepro2006/CrewAI_Team/

# 5. Check available RAM
free -h
```

### ✅ **Expected Output**
```
✅ Base model: 2.0GB Llama-3.2-3B-Instruct-Q4_K_M.gguf
✅ llama-finetune: Present and executable
✅ Dataset: 2,351 training examples
✅ Disk space: 15GB+ available
✅ RAM: 43GB+ available
```

## Execution Steps

### **Step 1: Start Fine-Tuning**
```bash
cd /home/pricepro2006/CrewAI_Team/fine-tuning/
python3 llama_cpp_finetuning.py
```

### **Step 2: Monitor Progress**
```bash
# In another terminal, monitor system resources
htop

# Watch log files (if created)
tail -f /home/pricepro2006/CrewAI_Team/fine-tuning/llama-cpp-output/training.log

# Check checkpoint progress
ls -la /home/pricepro2006/CrewAI_Team/fine-tuning/llama-cpp-output/
```

### **Step 3: Timeline Expectations**

| Phase | Duration | Description |
|-------|----------|-------------|
| **Setup** | 2-3 minutes | Dataset conversion, verification |
| **Training** | 4-5 hours | Core fine-tuning with LoRA |
| **Conversion** | 10-15 minutes | Convert to GGUF + quantization |
| **Testing** | 2-3 minutes | Validation test |
| **Total** | ~5 hours | Complete pipeline |

## Advanced Configuration Options

### **Memory Optimization**
If you encounter memory issues (unlikely with 64GB), edit the config:

```python
# In llama_cpp_finetuning.py, modify:
batch_size: int = 2              # Reduce from 4
ctx_size: int = 3072             # Reduce context window
use_checkpointing: bool = True   # Enable gradient checkpointing
```

### **CPU Performance Tuning**
```bash
# Set CPU governor to performance
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Disable swap to force RAM usage
sudo swapoff -a

# Set process priority (run before fine-tuning)
sudo nice -n -10 python3 llama_cpp_finetuning.py
```

### **Training Parameter Tuning**

For more aggressive training (if initial results are good):
```python
learning_rate: float = 2e-4      # Increase learning rate
epochs: int = 5                  # More epochs
lora_r: int = 32                 # Higher rank LoRA
```

For more conservative training (if overfitting):
```python
learning_rate: float = 5e-5      # Decrease learning rate
epochs: int = 2                  # Fewer epochs  
lora_r: int = 8                  # Lower rank LoRA
```

## Output Files

After successful completion, you'll have:

```
/home/pricepro2006/CrewAI_Team/fine-tuning/llama-cpp-output/
├── train.txt                           # Converted training data
├── checkpoint/                         # LoRA checkpoint files
├── business-intelligence-3b-q4.gguf   # Final quantized model
└── training.log                        # Training logs
```

## Integration with Existing System

### **Replace Current Model**
```bash
# Backup current model
cp /home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf \
   /home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf.backup

# Deploy fine-tuned model
cp /home/pricepro2006/CrewAI_Team/fine-tuning/llama-cpp-output/business-intelligence-3b-q4.gguf \
   /home/pricepro2006/CrewAI_Team/models/business-intelligence-3b-q4.gguf
```

### **Test with Existing Pipeline**
```bash
# Test with your existing email processor
cd /home/pricepro2006/CrewAI_Team/
python3 test_quantized_models_incremental.py
```

## Troubleshooting

### **Common Issues & Solutions**

| Issue | Solution |
|-------|----------|
| `llama-finetune not found` | Rebuild llama.cpp: `cd llama.cpp && make clean && make -j16` |
| `Out of memory` | Reduce batch_size to 2 or ctx_size to 2048 |
| `Training stalls` | Check system resources with `htop`, ensure no other processes consuming CPU |
| `GGUF conversion fails` | Verify convert_lora_to_gguf.py exists in llama.cpp directory |

### **Performance Optimization**
```bash
# If training is slow, check CPU frequency
cat /proc/cpuinfo | grep MHz

# Ensure all cores are active
nproc --all
```

## Expected Results

After fine-tuning, your model should:

1. **Understand TD SYNNEX Workflows** - Recognize specific business processes
2. **Extract Entities Accurately** - PO numbers, order IDs, participant names
3. **Generate Structured Analysis** - Consistent format matching training data
4. **Maintain Context** - Handle email chains and complex communications
5. **Business Intelligence Output** - Strategic insights and recommendations

## Success Metrics

- **Training Loss**: Should decrease consistently to < 1.5
- **Validation Accuracy**: >85% on held-out examples  
- **Entity Extraction**: >90% F1 score on business entities
- **Format Compliance**: >95% adherence to analysis structure
- **Business Value**: Demonstrable improvement over rule-based extraction

## Next Steps After Training

1. **Benchmark Against Current System** - Compare with rule-based extraction
2. **A/B Testing** - Run parallel processing with old/new models
3. **Production Deployment** - Replace current model in email pipeline
4. **Continuous Learning** - Collect feedback for further fine-tuning iterations

---

🚀 **Ready to transform your email analysis with custom business intelligence!**