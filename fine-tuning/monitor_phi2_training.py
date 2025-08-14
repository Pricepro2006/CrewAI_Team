#!/usr/bin/env python3
"""
Real-time Training Progress Monitor for Phi-2
Shows progress bar, loss, and ETA
"""

import time
import re
import os
from pathlib import Path
from datetime import datetime, timedelta
import sys

class Phi2TrainingMonitor:
    def __init__(self):
        self.log_file = Path("/home/pricepro2006/CrewAI_Team/fine-tuning/phi2_training.log")
        self.total_steps = 558  # From training config
        self.total_epochs = 3
        self.current_step = 0
        self.current_epoch = 0
        self.current_loss = 0.0
        self.eval_loss = 0.0
        self.start_time = None
        self.last_update = None
        
    def parse_log_line(self, line):
        """Parse training log line for metrics"""
        # Look for step progress: "1%|▏         | 5/558"
        step_match = re.search(r'(\d+)%\|.*?\|\s*(\d+)/(\d+)', line)
        if step_match:
            self.current_step = int(step_match.group(2))
            self.total_steps = int(step_match.group(3))
            
        # Look for loss: "{'loss': 2.3456"
        loss_match = re.search(r"'loss':\s*([\d.]+)", line)
        if loss_match:
            self.current_loss = float(loss_match.group(1))
            
        # Look for eval loss
        eval_match = re.search(r"'eval_loss':\s*([\d.]+)", line)
        if eval_match:
            self.eval_loss = float(eval_match.group(1))
            
        # Look for epoch
        epoch_match = re.search(r"'epoch':\s*([\d.]+)", line)
        if epoch_match:
            self.current_epoch = float(epoch_match.group(1))
            
    def format_time(self, seconds):
        """Format seconds into readable time"""
        if seconds < 60:
            return f"{seconds:.0f}s"
        elif seconds < 3600:
            return f"{seconds/60:.0f}m {seconds%60:.0f}s"
        else:
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours:.0f}h {minutes:.0f}m"
            
    def draw_progress_bar(self, current, total, width=50):
        """Draw a progress bar"""
        if total == 0:
            return "[" + "?" * width + "]"
        
        percent = current / total
        filled = int(width * percent)
        bar = "█" * filled + "░" * (width - filled)
        return f"[{bar}] {percent*100:.1f}%"
        
    def display_status(self):
        """Display current training status"""
        os.system('clear' if os.name == 'posix' else 'cls')
        
        print("=" * 80)
        print("PHI-2 FINE-TUNING PROGRESS MONITOR")
        print("=" * 80)
        print(f"Model: microsoft/phi-2")
        print(f"Training Examples: 2,974 | Validation: 744")
        print(f"LoRA Parameters: 5.2M (0.19% trainable)")
        print("=" * 80)
        
        # Overall progress
        overall_progress = (self.current_epoch / self.total_epochs) if self.total_epochs > 0 else 0
        print(f"\n📊 OVERALL PROGRESS:")
        print(f"Epoch: {self.current_epoch:.2f} / {self.total_epochs}")
        print(self.draw_progress_bar(self.current_epoch, self.total_epochs))
        
        # Step progress
        print(f"\n📈 STEP PROGRESS:")
        print(f"Step: {self.current_step} / {self.total_steps}")
        print(self.draw_progress_bar(self.current_step, self.total_steps))
        
        # Loss metrics
        print(f"\n📉 METRICS:")
        print(f"Training Loss: {self.current_loss:.4f}")
        if self.eval_loss > 0:
            print(f"Validation Loss: {self.eval_loss:.4f}")
        
        # Time estimates
        if self.start_time and self.current_step > 0:
            elapsed = time.time() - self.start_time
            steps_per_second = self.current_step / elapsed
            remaining_steps = self.total_steps - self.current_step
            eta_seconds = remaining_steps / steps_per_second if steps_per_second > 0 else 0
            
            print(f"\n⏱️ TIME:")
            print(f"Elapsed: {self.format_time(elapsed)}")
            print(f"ETA: {self.format_time(eta_seconds)}")
            print(f"Speed: {steps_per_second:.2f} steps/sec")
        
        # Memory usage
        try:
            import psutil
            mem = psutil.virtual_memory()
            print(f"\n💾 MEMORY:")
            print(f"Usage: {mem.percent:.1f}% ({mem.used/1e9:.1f}GB / {mem.total/1e9:.1f}GB)")
        except:
            pass
        
        print("\n" + "=" * 80)
        print("Press Ctrl+C to stop monitoring (training will continue)")
        
    def monitor(self, refresh_interval=5):
        """Main monitoring loop"""
        print("Starting Phi-2 training monitor...")
        print(f"Reading from: {self.log_file}")
        
        if not self.log_file.exists():
            print(f"⚠️ Log file not found: {self.log_file}")
            print("Waiting for training to start...")
            while not self.log_file.exists():
                time.sleep(2)
        
        self.start_time = time.time()
        
        # Open log file and seek to end
        with open(self.log_file, 'r') as f:
            # Read existing content to get current state
            for line in f:
                self.parse_log_line(line)
            
            # Monitor new lines
            try:
                while True:
                    line = f.readline()
                    if line:
                        self.parse_log_line(line)
                        self.last_update = time.time()
                    
                    # Update display
                    if not self.last_update or (time.time() - self.last_update) < refresh_interval:
                        self.display_status()
                    
                    time.sleep(1)
                    
            except KeyboardInterrupt:
                print("\n\n✅ Monitoring stopped. Training continues in background.")
                print(f"Final status: Step {self.current_step}/{self.total_steps}, Loss: {self.current_loss:.4f}")

def main():
    monitor = Phi2TrainingMonitor()
    monitor.monitor()

if __name__ == "__main__":
    main()