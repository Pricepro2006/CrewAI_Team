# Llama 3.2:3b Fine-Tuning for TD SYNNEX Email Intelligence

## Project Overview
Fine-tuning Llama 3.2:3b on 143,221 TD SYNNEX emails to create a domain-specific model that understands business terminology, workflows, and patterns.

## Dataset
- **Source**: 143,221 emails from crewai_enhanced.db
- **Patterns Discovered**: 2,308 business patterns
- **Key Entities**: SPAs (CAS-*), EDI (CUST850, CDW856), Teams (sales4460)
- **Workflows**: Quote requests, Purchase orders, Support tickets

## Approach

### Phase 1: Data Preparation
- [ ] Extract emails from database
- [ ] Clean and preprocess text
- [ ] Create instruction-tuning pairs
- [ ] Split into train/validation sets

### Phase 2: Model Setup
- [ ] Download Llama 3.2:3b base model
- [ ] Set up LoRA/QLoRA configuration
- [ ] Configure training parameters
- [ ] Set up evaluation metrics

### Phase 3: Fine-Tuning
- [ ] Run initial training with small subset
- [ ] Validate model outputs
- [ ] Full training on complete dataset
- [ ] Monitor loss and performance

### Phase 4: Evaluation
- [ ] Test on held-out emails
- [ ] Compare with base model
- [ ] Measure accuracy on key patterns
- [ ] Validate business logic understanding

## Training Data Format
```json
{
  "instruction": "Analyze this email and identify the business intent, entities, and required actions.",
  "input": "Subject: PO 12345678 - Urgent\nBody: Please process attached purchase order for 100 units of XHU-00001. Apply SPA CAS-091284-B0C6Q4.",
  "output": {
    "intent": "purchase_order",
    "entities": {
      "po_number": "12345678",
      "product": "XHU-00001",
      "quantity": 100,
      "spa_code": "CAS-091284-B0C6Q4"
    },
    "actions": ["validate_po", "apply_spa", "process_order"],
    "urgency": "high"
  }
}
```

## Key Business Patterns to Learn
1. **SPAs (Special Pricing Agreements)**: CAS-XXXXXX-XXXXXX format
2. **EDI References**: CUST850 (PO), CDW856 (Ship Notice)
3. **Team Routing**: sales4460@tdsynnex.com patterns
4. **Quote Workflows**: Quote-FTQ patterns
5. **Product Identifiers**: Microsoft (XHU-*), various formats

## Success Metrics
- Intent classification accuracy: >95%
- Entity extraction F1 score: >0.9
- Action recommendation accuracy: >90%
- Processing speed: <100ms per email

## Technical Stack
- **Base Model**: Llama 3.2:3b
- **Framework**: Hugging Face Transformers
- **Training**: LoRA/QLoRA for efficiency
- **Hardware**: GPU with 24GB+ VRAM recommended
- **Quantization**: 4-bit for deployment

## Directory Structure
```
fine-tuning/
├── data/
│   ├── raw/           # Original emails
│   ├── processed/     # Cleaned and formatted
│   └── splits/        # Train/val/test splits
├── models/
│   ├── base/          # Original Llama 3.2:3b
│   ├── checkpoints/   # Training checkpoints
│   └── final/         # Fine-tuned model
├── scripts/
│   ├── prepare_data.py
│   ├── train.py
│   └── evaluate.py
└── configs/
    └── training_config.yaml
```

## Next Steps
1. Set up data preparation pipeline
2. Create training configuration
3. Implement evaluation framework
4. Begin iterative training

## References
- Pattern Discovery Report: `/model-benchmarks/TRUE_PATTERN_DISCOVERY_REPORT.md`
- Email Analysis: `/model-benchmarks/FINAL_ANALYSIS_REPORT.md`
- Implementation Guide: `/model-benchmarks/IMPLEMENTATION_SUMMARY.md`

---
*Branch: feat/llama32-fine-tuning*
*Created: August 11, 2025*