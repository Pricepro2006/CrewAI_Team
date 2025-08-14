#!/usr/bin/env python3
"""
Enhanced Training Monitor for Phi-2 Fine-tuning
Shows real-time progress with estimated completion time
"""

import os
import sys
import time
import psutil
import subprocess
from datetime import datetime, timedelta

def format_time(seconds):
    """Format seconds into readable time"""
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        return f"{seconds/60:.1f}m"
    else:
        return f"{seconds/3600:.1f}h"

def get_training_progress():
    """Extract progress from log files"""
    progress_info = {
        'current_step': 0,
        'total_steps': 63,
        'loss': None,
        'last_update': None
    }
    
    # Check progress log
    if os.path.exists('phi2_training_progress.log'):
        result = subprocess.run(['tail', '-10', 'phi2_training_progress.log'], 
                              capture_output=True, text=True)
        for line in result.stdout.split('\n'):
            if 'Step' in line and '/' in line:
                parts = line.split()
                for part in parts:
                    if '/' in part:
                        try:
                            current, total = part.split('/')
                            progress_info['current_step'] = int(current)
                            progress_info['total_steps'] = int(total)
                        except:
                            pass
            if 'Loss:' in line:
                parts = line.split('Loss:')
                if len(parts) > 1:
                    try:
                        progress_info['loss'] = float(parts[1].split()[0])
                    except:
                        pass
    
    # Check live log for tqdm progress
    if os.path.exists('phi2_training_live_fixed.log'):
        result = subprocess.run(['tail', '-5', 'phi2_training_live_fixed.log'], 
                              capture_output=True, text=True)
        for line in result.stdout.split('\n'):
            if '%|' in line and '[' in line:
                # Parse tqdm progress bar
                try:
                    if '/' in line:
                        parts = line.split('[')[1].split(',')[0]
                        if '/' in parts:
                            current = int(parts.split('/')[0].strip())
                            progress_info['current_step'] = current
                except:
                    pass
    
    return progress_info

def monitor_training():
    """Monitor the training process with enhanced display"""
    
    # Find training process
    training_pid = None
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['cmdline'] and 'train_phi2_fixed.py' in ' '.join(proc.info['cmdline']):
                training_pid = proc.info['pid']
                break
        except:
            continue
    
    if not training_pid:
        print("❌ No training process found!")
        print("Start training with: python3 train_phi2_fixed.py")
        return
    
    print(f"✅ Found training process: PID {training_pid}")
    process = psutil.Process(training_pid)
    start_time = process.create_time()
    
    # Monitoring loop
    iteration = 0
    last_step = 0
    step_times = []
    
    while True:
        try:
            # Check if process still exists
            if not psutil.pid_exists(training_pid):
                print("\n🏁 Training process completed!")
                break
            
            # Get process info
            cpu_percent = process.cpu_percent(interval=0.5)
            memory_gb = process.memory_info().rss / 1e9
            memory_percent = process.memory_percent()
            elapsed = time.time() - start_time
            
            # Get training progress
            progress = get_training_progress()
            
            # Calculate speed and ETA
            if progress['current_step'] > last_step:
                step_time = elapsed / progress['current_step'] if progress['current_step'] > 0 else 0
                step_times.append(step_time)
                last_step = progress['current_step']
                
            avg_step_time = sum(step_times) / len(step_times) if step_times else 0
            remaining_steps = progress['total_steps'] - progress['current_step']
            eta_seconds = remaining_steps * avg_step_time if avg_step_time > 0 else 0
            
            # Clear screen for clean display
            os.system('clear' if os.name == 'posix' else 'cls')
            
            # Display header
            print("="*70)
            print("🔥 PHI-2 FINE-TUNING MONITOR 🔥")
            print("="*70)
            
            # Process info
            print(f"📍 PID: {training_pid} | Status: {'🟢 RUNNING' if cpu_percent > 0 else '🟡 IDLE'}")
            print(f"⏱️  Elapsed: {format_time(elapsed)} | Started: {datetime.fromtimestamp(start_time).strftime('%H:%M:%S')}")
            print(f"💾 Memory: {memory_gb:.1f}GB ({memory_percent:.1f}%)")
            print(f"⚡ CPU: {cpu_percent:.1f}%")
            
            # Training progress
            print("="*70)
            percent_complete = (progress['current_step'] / progress['total_steps'] * 100) if progress['total_steps'] > 0 else 0
            
            # Progress bar
            bar_length = 40
            filled = int(bar_length * percent_complete / 100)
            bar = '█' * filled + '░' * (bar_length - filled)
            
            print(f"📊 Progress: [{bar}] {percent_complete:.1f}%")
            print(f"📈 Step: {progress['current_step']}/{progress['total_steps']}")
            
            if progress['loss'] is not None:
                print(f"📉 Loss: {progress['loss']:.4f}")
            
            if avg_step_time > 0:
                print(f"⚡ Speed: {1/avg_step_time:.2f} steps/min")
                print(f"⏳ ETA: {format_time(eta_seconds)}")
            else:
                print(f"⏳ Calculating speed... (gradient accumulation in progress)")
            
            print("="*70)
            print(f"💡 Note: First step takes longer due to gradient accumulation (8 batches)")
            print(f"🔄 Refreshing every 5 seconds... Press Ctrl+C to stop monitoring")
            
            time.sleep(5)
            iteration += 1
            
        except KeyboardInterrupt:
            print("\n👋 Monitoring stopped by user")
            break
        except psutil.NoSuchProcess:
            print("\n🏁 Training process completed!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    monitor_training()
