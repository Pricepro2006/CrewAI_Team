#!/usr/bin/env python3
"""
Robust training launcher with download retry and progress monitoring
"""

import os
import time
import psutil
import logging
from pathlib import Path
import subprocess
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_model_download():
    """Check if model is fully downloaded"""
    model_dir = Path("model_cache/models--microsoft--Phi-3-mini-4k-instruct")
    if not model_dir.exists():
        return False, 0
    
    # Get current size
    total_size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file())
    size_gb = total_size / (1024**3)
    
    # Check if download is complete (roughly 7.4GB expected)
    is_complete = size_gb > 7.0
    
    return is_complete, size_gb

def download_model_separately():
    """Pre-download the model to avoid training interruption"""
    logger.info("Pre-downloading Phi-3 model...")
    
    try:
        from transformers import AutoModelForCausalLM, AutoTokenizer
        
        # Download tokenizer first (smaller)
        logger.info("Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            "microsoft/Phi-3-mini-4k-instruct",
            trust_remote_code=True,
            cache_dir="./model_cache"
        )
        logger.info("✅ Tokenizer downloaded")
        
        # Download model config only first
        logger.info("Downloading model config...")
        from transformers import AutoConfig
        config = AutoConfig.from_pretrained(
            "microsoft/Phi-3-mini-4k-instruct",
            trust_remote_code=True,
            cache_dir="./model_cache"
        )
        logger.info("✅ Model config downloaded")
        
        # Now download the full model
        logger.info("Downloading full model (this may take 10-15 minutes)...")
        model = AutoModelForCausalLM.from_pretrained(
            "microsoft/Phi-3-mini-4k-instruct",
            trust_remote_code=True,
            cache_dir="./model_cache",
            torch_dtype="auto",  # Let it choose
            device_map="cpu",
            low_cpu_mem_usage=True
        )
        logger.info("✅ Model downloaded successfully")
        
        # Clean up to free memory
        del model
        del tokenizer
        import gc
        gc.collect()
        
        return True
        
    except Exception as e:
        logger.error(f"Model download failed: {e}")
        return False

def monitor_download_progress():
    """Monitor download progress with periodic updates"""
    logger.info("Monitoring download progress...")
    
    last_size = 0
    stall_count = 0
    
    while True:
        is_complete, size_gb = check_model_download()
        
        if is_complete:
            logger.info(f"✅ Model download complete! ({size_gb:.2f}GB)")
            break
        
        # Check for stalled download
        if abs(size_gb - last_size) < 0.01:  # Less than 10MB change
            stall_count += 1
            if stall_count > 10:  # Stalled for 5 minutes
                logger.warning("Download appears stalled. Retrying...")
                return False
        else:
            stall_count = 0
        
        last_size = size_gb
        progress = (size_gb / 7.4) * 100
        logger.info(f"Download progress: {size_gb:.2f}GB / 7.4GB ({progress:.1f}%)")
        
        time.sleep(30)  # Check every 30 seconds
    
    return True

def run_training():
    """Run the actual training"""
    logger.info("Starting training process...")
    
    try:
        # Run training script
        result = subprocess.run([
            "python3", "train_phi3_adaptive.py"
        ], capture_output=True, text=True, timeout=7200)  # 2 hour timeout
        
        if result.returncode == 0:
            logger.info("✅ Training completed successfully!")
            logger.info("Output:")
            logger.info(result.stdout)
        else:
            logger.error("❌ Training failed!")
            logger.error("Error output:")
            logger.error(result.stderr)
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("Training timed out after 2 hours")
        return False
    except Exception as e:
        logger.error(f"Training execution failed: {e}")
        return False
    
    return True

def main():
    """Main training launcher with retry logic"""
    
    logger.info("="*60)
    logger.info("PHI-3 ADAPTIVE TRAINING - ROBUST LAUNCHER")
    logger.info("="*60)
    
    # Check if model is already downloaded
    is_complete, size_gb = check_model_download()
    
    if is_complete:
        logger.info(f"✅ Model already downloaded ({size_gb:.2f}GB)")
    else:
        logger.info(f"Model download needed (current: {size_gb:.2f}GB)")
        
        # Try pre-downloading
        max_retries = 3
        for attempt in range(max_retries):
            logger.info(f"Download attempt {attempt + 1}/{max_retries}")
            
            if download_model_separately():
                break
            
            if attempt < max_retries - 1:
                logger.info("Retrying in 30 seconds...")
                time.sleep(30)
        else:
            logger.error("Failed to download model after all retries")
            return False
    
    # Now run training
    logger.info("Model ready. Starting training...")
    success = run_training()
    
    if success:
        logger.info("🎉 All done! Check output files.")
    else:
        logger.error("Training failed. Check logs for details.")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)