#!/usr/bin/env python3
"""
Monitor Phi-3.5-mini training progress
"""

import time
import subprocess
import psutil
from pathlib import Path

def check_training_status():
    """Check if training is running and get stats"""
    try:
        # Check for training process
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'cpu_percent', 'memory_info']):
            if 'python3' in proc.info['name'] and 'train_phi3_adaptive.py' in ' '.join(proc.info['cmdline']):
                return {
                    'running': True,
                    'pid': proc.info['pid'],
                    'cpu': proc.info['cpu_percent'],
                    'memory_mb': proc.info['memory_info'].rss / 1024 / 1024,
                    'runtime': time.time() - proc.create_time()
                }
    except:
        pass
    
    return {'running': False}

def check_model_download():
    """Check model download progress"""
    model_dir = Path("model_cache/models--microsoft--Phi-3.5-mini-instruct")
    if not model_dir.exists():
        return 0, 0
    
    total_size = sum(f.stat().st_size for f in model_dir.rglob('*') if f.is_file())
    size_gb = total_size / (1024**3)
    
    # Phi-3.5 is roughly 7.6GB
    progress = min((size_gb / 7.6) * 100, 100)
    
    return size_gb, progress

def get_recent_log_lines():
    """Get recent log entries"""
    log_file = Path("phi3_5_training.log")
    if not log_file.exists():
        return []
    
    try:
        with open(log_file, 'r') as f:
            lines = f.readlines()
        return [line.strip() for line in lines[-5:] if line.strip()]
    except:
        return []

def main():
    """Main monitoring loop"""
    print("PHI-3.5-MINI TRAINING MONITOR")
    print("=" * 50)
    
    start_time = time.time()
    last_size = 0
    
    while True:
        try:
            # Check training status
            status = check_training_status()
            
            if not status['running']:
                print("❌ Training process not found")
                break
            
            # Check download progress
            size_gb, progress = check_model_download()
            
            # Calculate download speed
            if size_gb > last_size:
                elapsed = time.time() - start_time
                speed_mbps = ((size_gb - last_size) * 1024) / max(30, elapsed) if elapsed > 0 else 0
                speed_text = f"({speed_mbps:.1f} MB/s)" if speed_mbps > 0 else ""
            else:
                speed_text = ""
            
            last_size = size_gb
            
            # Display status
            print(f"\r⏳ PID {status['pid']} | "
                  f"Download: {size_gb:.2f}GB ({progress:.1f}%) {speed_text} | "
                  f"CPU: {status['cpu']:.1f}% | "
                  f"RAM: {status['memory_mb']:.0f}MB | "
                  f"Runtime: {status['runtime']/60:.1f}min", end="", flush=True)
            
            # Check if download is complete and training has started
            if progress > 95:
                print(f"\n✅ Model download complete! Checking training progress...")
                
                # Look for training-specific log entries
                recent_logs = get_recent_log_lines()
                training_started = any('Loading datasets' in log or 'Training on' in log for log in recent_logs)
                
                if training_started:
                    print("🚀 Training has started! Monitoring progress...")
                    # Show recent log entries
                    for log in recent_logs[-3:]:
                        print(f"   {log}")
                
                # Continue monitoring but less frequently
                time.sleep(60)
            else:
                time.sleep(10)
                
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped by user")
            break
        except Exception as e:
            print(f"\nError: {e}")
            time.sleep(10)
    
    # Final status
    print("\n" + "=" * 50)
    status = check_training_status()
    if status['running']:
        print(f"Training still running (PID {status['pid']})")
        print("Check logs: tail -f phi3_5_training.log")
    else:
        print("Training process stopped")
        print("Check results in: ./phi3-mini-finetuned/")

if __name__ == "__main__":
    main()