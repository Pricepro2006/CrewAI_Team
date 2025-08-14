#!/usr/bin/env python3
"""
Download or prepare F16/F32 model for fine-tuning
Non-quantized models work better for fine-tuning
"""

import os
import logging
from pathlib import Path
import subprocess

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_available_models():
    """Check what models we can work with"""
    logger.info("Checking available options for non-quantized models...")
    
    options = []
    
    # Option 1: Use smaller open models that don't require auth
    open_models = [
        ("TinyLlama/TinyLlama-1.1B-Chat-v1.0", "1.1B", "No auth required"),
        ("microsoft/phi-2", "2.7B", "No auth required"),
        ("stabilityai/stablelm-3b-4e1t", "3B", "No auth required"),
    ]
    
    logger.info("\n=== Available Open Models (No Auth Required) ===")
    for model, size, note in open_models:
        logger.info(f"  • {model} ({size}) - {note}")
        options.append(model)
    
    # Option 2: Convert existing Q4_K_M to F16 (not ideal but possible)
    logger.info("\n=== Conversion Option ===")
    logger.info("  • Convert Q4_K_M to F16 (lossy, not recommended)")
    
    # Option 3: Use llama.cpp to download models
    logger.info("\n=== Direct Download Options ===")
    logger.info("  • Use Hugging Face CLI to download GGUF models")
    
    return options

def download_tinyllama_gguf():
    """Download TinyLlama GGUF model (F16 version)"""
    logger.info("Downloading TinyLlama F16 GGUF model...")
    
    model_dir = Path("/home/pricepro2006/CrewAI_Team/models")
    model_dir.mkdir(exist_ok=True)
    
    # TinyLlama GGUF URL (F16 version for better fine-tuning)
    model_url = "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.fp16.gguf"
    model_path = model_dir / "tinyllama-1.1b-chat-v1.0.fp16.gguf"
    
    if model_path.exists():
        logger.info(f"✅ Model already exists: {model_path}")
        return str(model_path)
    
    try:
        # Download using wget
        cmd = ["wget", "-O", str(model_path), model_url, "--show-progress"]
        logger.info(f"Downloading from: {model_url}")
        
        result = subprocess.run(cmd, check=True)
        
        if model_path.exists():
            size_mb = model_path.stat().st_size / (1024 * 1024)
            logger.info(f"✅ Downloaded successfully: {size_mb:.1f} MB")
            return str(model_path)
        else:
            logger.error("❌ Download failed - file not found")
            return None
            
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Download failed: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return None

def download_phi2_gguf():
    """Download Phi-2 GGUF model (F16 version)"""
    logger.info("Downloading Phi-2 F16 GGUF model...")
    
    model_dir = Path("/home/pricepro2006/CrewAI_Team/models")
    model_dir.mkdir(exist_ok=True)
    
    # Phi-2 GGUF URL (F16 version)
    model_url = "https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.fp16.gguf"
    model_path = model_dir / "phi-2.fp16.gguf"
    
    if model_path.exists():
        logger.info(f"✅ Model already exists: {model_path}")
        return str(model_path)
    
    try:
        # Download using wget
        cmd = ["wget", "-O", str(model_path), model_url, "--show-progress"]
        logger.info(f"Downloading from: {model_url}")
        
        result = subprocess.run(cmd, check=True)
        
        if model_path.exists():
            size_mb = model_path.stat().st_size / (1024 * 1024)
            logger.info(f"✅ Downloaded successfully: {size_mb:.1f} MB")
            return str(model_path)
        else:
            logger.error("❌ Download failed - file not found")
            return None
            
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Download failed: {e}")
        return None

def main():
    """Main execution"""
    logger.info("🚀 Setting up non-quantized model for fine-tuning")
    
    # Check options
    options = check_available_models()
    
    # Try to download models
    logger.info("\n📥 Attempting to download F16 models...")
    
    # Try TinyLlama first (smaller, faster)
    tinyllama_path = download_tinyllama_gguf()
    
    if tinyllama_path:
        logger.info(f"✅ TinyLlama F16 ready: {tinyllama_path}")
        logger.info("This model is better for fine-tuning than quantized models")
        
        # Save path for fine-tuning script
        config = {
            "model_path": tinyllama_path,
            "model_type": "tinyllama-fp16",
            "precision": "F16",
            "size": "1.1B"
        }
        
        import json
        with open("/home/pricepro2006/CrewAI_Team/fine-tuning/f16_model_config.json", "w") as f:
            json.dump(config, f, indent=2)
        
        logger.info("💾 Configuration saved to f16_model_config.json")
        return True
    
    # Try Phi-2 as backup
    phi2_path = download_phi2_gguf()
    
    if phi2_path:
        logger.info(f"✅ Phi-2 F16 ready: {phi2_path}")
        return True
    
    logger.error("❌ Could not download F16 models")
    logger.info("Alternative: Use Transformers library with CPU-optimized models")
    return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)