#!/usr/bin/env python3
"""
Adaptive Training Plan Progress Monitor
Real-time visualization of the 6-phase training pipeline
"""

import os
import re
import json
import time
import psutil
from pathlib import Path
from datetime import datetime, timedelta
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn
from rich.table import Table
from rich.panel import Panel
from rich.layout import Layout
from rich.live import Live
from rich.text import Text
from typing import Dict, List, Tuple

class AdaptiveTrainingProgressMonitor:
    def __init__(self):
        self.console = Console()
        self.base_dir = Path("/home/pricepro2006/CrewAI_Team/fine-tuning")
        self.log_file = self.base_dir / "email_batch_training.log"
        self.phase1_dir = self.base_dir / "phase1_results"
        self.datasets_dir = self.base_dir / "datasets"
        
        # Phase definitions with weights
        self.phases = {
            1: {"name": "Data Analysis", "weight": 10, "status": "completed"},
            2: {"name": "Dataset Design", "weight": 15, "status": "completed"},
            3: {"name": "Baseline Training", "weight": 30, "status": "in_progress"},
            4: {"name": "Evaluation Framework", "weight": 15, "status": "pending"},
            5: {"name": "Iterative Improvement", "weight": 20, "status": "pending"},
            6: {"name": "Production Deployment", "weight": 10, "status": "pending"}
        }
        
        self.current_training_stats = {}
        self.start_time = datetime.now()
        
    def parse_training_log(self) -> Dict:
        """Parse the current training log for progress"""
        if not self.log_file.exists():
            return {"current_step": 0, "total_steps": 200, "loss": 0, "epoch": 0}
        
        with open(self.log_file, 'r') as f:
            content = f.read()
        
        # Extract current step from progress bar
        step_matches = re.findall(r'(\d+)%\|.*?\| (\d+)/(\d+)', content)
        if step_matches:
            percent, current, total = step_matches[-1]
            current_step = int(current)
            total_steps = int(total)
        else:
            current_step = 0
            total_steps = 200
        
        # Extract loss values
        loss_matches = re.findall(r"'loss': ([\d.]+)", content)
        current_loss = float(loss_matches[-1]) if loss_matches else 0
        
        # Extract epoch
        epoch_matches = re.findall(r"'epoch': ([\d.]+)", content)
        current_epoch = float(epoch_matches[-1]) if epoch_matches else 0
        
        # Calculate ETA based on time per step
        time_matches = re.findall(r'(\d+):(\d+)<.*?, ([\d.]+)s/it', content)
        if time_matches:
            hours, minutes, seconds_per_it = time_matches[-1]
            remaining_steps = total_steps - current_step
            eta_seconds = remaining_steps * float(seconds_per_it)
            eta = timedelta(seconds=int(eta_seconds))
        else:
            eta = timedelta(hours=2, minutes=30)  # Default estimate
        
        return {
            "current_step": current_step,
            "total_steps": total_steps,
            "loss": current_loss,
            "epoch": current_epoch,
            "eta": eta,
            "percent": (current_step / total_steps * 100) if total_steps > 0 else 0
        }
    
    def check_process_status(self) -> bool:
        """Check if training process is running"""
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and 'train_email_batch_analysis.py' in ' '.join(cmdline):
                    return True
            except:
                continue
        return False
    
    def calculate_overall_progress(self, training_stats: Dict) -> float:
        """Calculate overall project progress across all phases"""
        total_weight = sum(p["weight"] for p in self.phases.values())
        completed_weight = 0
        
        for phase_num, phase in self.phases.items():
            if phase["status"] == "completed":
                completed_weight += phase["weight"]
            elif phase["status"] == "in_progress" and phase_num == 3:
                # Phase 3 is partially complete based on training progress
                phase_progress = training_stats["percent"] / 100
                completed_weight += phase["weight"] * phase_progress
        
        return (completed_weight / total_weight) * 100
    
    def create_progress_display(self) -> Layout:
        """Create the full progress display layout"""
        layout = Layout()
        
        # Get current stats
        training_stats = self.parse_training_log()
        is_running = self.check_process_status()
        overall_progress = self.calculate_overall_progress(training_stats)
        
        # Create main sections
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="phases", size=12),
            Layout(name="current", size=10),
            Layout(name="stats", size=8)
        )
        
        # Header
        header_text = Text("🚀 ADAPTIVE TRAINING PROGRESS MONITOR", style="bold cyan")
        layout["header"].update(Panel(header_text, title="LFM2-1.2B Fine-Tuning"))
        
        # Phase Progress
        phase_table = Table(title="Training Phases", show_header=True, header_style="bold magenta")
        phase_table.add_column("Phase", style="cyan", width=5)
        phase_table.add_column("Name", style="white", width=25)
        phase_table.add_column("Status", width=15)
        phase_table.add_column("Progress", width=30)
        
        for phase_num, phase in self.phases.items():
            status_style = {
                "completed": "green",
                "in_progress": "yellow",
                "pending": "dim"
            }.get(phase["status"], "white")
            
            if phase["status"] == "completed":
                progress_bar = "[green]" + "█" * 25 + "[/green] 100%"
            elif phase["status"] == "in_progress" and phase_num == 3:
                filled = int(training_stats["percent"] / 4)  # 25 chars max
                empty = 25 - filled
                progress_bar = f"[yellow]{'█' * filled}{'░' * empty}[/yellow] {training_stats['percent']:.1f}%"
            else:
                progress_bar = "[dim]" + "░" * 25 + "[/dim] 0%"
            
            phase_table.add_row(
                f"#{phase_num}",
                phase["name"],
                f"[{status_style}]{phase['status'].upper()}[/{status_style}]",
                progress_bar
            )
        
        layout["phases"].update(phase_table)
        
        # Current Training Progress
        if is_running:
            current_panel = Panel(
                f"""[bold green]▶ TRAINING ACTIVE[/bold green]
                
Step: {training_stats['current_step']}/{training_stats['total_steps']} ({training_stats['percent']:.1f}%)
Epoch: {training_stats['epoch']:.2f} / 5.0
Loss: {training_stats['loss']:.4f}
ETA: {training_stats['eta']}

[yellow]{'█' * int(training_stats['percent']/2)}{'░' * (50-int(training_stats['percent']/2))}[/yellow]
""",
                title="Phase 3: Baseline Training",
                border_style="green"
            )
        else:
            current_panel = Panel(
                "[bold red]⏸ TRAINING PAUSED/STOPPED[/bold red]\n\nRun train_email_batch_analysis.py to continue",
                title="Phase 3: Baseline Training",
                border_style="red"
            )
        
        layout["current"].update(current_panel)
        
        # Statistics
        stats_text = f"""[bold]Overall Progress:[/bold] {overall_progress:.1f}%
[bold]Active Phase:[/bold] Phase 3 - Baseline Training
[bold]Model:[/bold] LiquidAI/LFM2-1.2B (1.17B params)
[bold]Dataset:[/bold] 500 train / 100 validation examples
[bold]Training Device:[/bold] CPU (AMD Ryzen 7 PRO)
[bold]Started:[/bold] {self.start_time.strftime('%Y-%m-%d %H:%M')}
[bold]Process Status:[/bold] {'[green]Running[/green]' if is_running else '[red]Not Running[/red]'}
"""
        
        layout["stats"].update(Panel(stats_text, title="Statistics", border_style="blue"))
        
        return layout
    
    def create_file_inventory(self) -> str:
        """Create comprehensive file inventory"""
        inventory = """
# 📁 COMPLETE FILE INVENTORY - LFM2-1.2B Email Batch Analysis Project

## 🎯 Core Data Files
- `/home/pricepro2006/CrewAI_Team/claude_final_analysis_20250601_083919.md` (13MB)
  └─ Claude's comprehensive analysis of all email batches
- `/home/pricepro2006/CrewAI_Team/email_batches/` 
  └─ 3,380 files: `emails_batch_1.json` to `emails_batch_4124.json`

## 📊 Phase 1: Data Analysis
- `/home/pricepro2006/CrewAI_Team/fine-tuning/phase1_data_analysis.py`
  └─ Main analysis script
- `/home/pricepro2006/CrewAI_Team/fine-tuning/phase1_results/`
  ├─ `data_analysis_report.json` - Overall statistics
  ├─ `quality_metrics.json` - Quality scores for all batches
  ├─ `pattern_library.json` - Extracted patterns
  └─ `sample_analyses.json` - Sample batch analyses

## 🔄 Phase 2: Dataset Generation
- `/home/pricepro2006/CrewAI_Team/fine-tuning/phase2_adaptive_dataset_generator.py`
  └─ Adaptive dataset generator with zero hardcoding
- `/home/pricepro2006/CrewAI_Team/fine-tuning/datasets/`
  ├─ `adaptive_train.json` - 500 training examples
  ├─ `adaptive_val.json` - 100 validation examples
  ├─ `dataset_report.json` - Generation statistics
  └─ `adaptive_next_batch.json` - Next curriculum batch (if generated)

## 🚀 Phase 3: Training Scripts
- `/home/pricepro2006/CrewAI_Team/fine-tuning/train_email_batch_analysis.py`
  └─ Main training script (currently running)
- `/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_working_final.py`
  └─ Validated working script with 50 examples
- `/home/pricepro2006/CrewAI_Team/fine-tuning/training_progress_monitor.py`
  └─ Real-time progress visualization (this file)

## 📝 Training Logs
- `/home/pricepro2006/CrewAI_Team/fine-tuning/email_batch_training.log`
  └─ Current training progress (58/200 steps)
- `/home/pricepro2006/CrewAI_Team/fine-tuning/lfm2_training_output.log`
  └─ Previous successful training log
- `/home/pricepro2006/CrewAI_Team/fine-tuning/training.log`
  └─ Historical training attempts

## 🤖 Model Checkpoints
- `/home/pricepro2006/CrewAI_Team/fine-tuning/models/`
  ├─ `lfm2_finetuned_working/` - Previous successful checkpoint
  │   ├─ `adapter_config.json`
  │   ├─ `adapter_model.safetensors`
  │   └─ `training_args.bin`
  └─ `email_batch_analyzer/` - Target for current training

## 📋 Planning Documents
- `/home/pricepro2006/CrewAI_Team/fine-tuning/ADAPTIVE_TRAINING_PLAN.md`
  └─ Original 6-phase training plan
- `/home/pricepro2006/CrewAI_Team/fine-tuning/COMPREHENSIVE_ADAPTIVE_TRAINING_PLAN.md`
  └─ Enhanced zero-hardcoding plan with Bayesian optimization

## 🧪 Testing & Evaluation (Phase 4 - Pending)
- `/home/pricepro2006/CrewAI_Team/fine-tuning/phase4_evaluation.py` (to be created)
- `/home/pricepro2006/CrewAI_Team/fine-tuning/test_results/` (to be created)

## 🔧 Utility Scripts
- `/home/pricepro2006/CrewAI_Team/fine-tuning/utils/`
  └─ Helper functions and utilities (if created)

## 📦 Failed/Deprecated Attempts
- `/home/pricepro2006/CrewAI_Team/fine-tuning/train_llama3.py` - Failed (auth required)
- `/home/pricepro2006/CrewAI_Team/fine-tuning/train_phi2.py` - Failed (memory issues)
- Various test scripts in root directory

## 🔍 Process IDs
- Training Process: PID 615949 (if still running)
- Previous PIDs: 614790, 615265, 615598 (terminated)

## 📊 Current Statistics
- Total Email Batches: 3,380
- Analyzed Batches: 4,124 (includes non-existent)
- Training Examples: 500
- Validation Examples: 100
- Current Training Step: 58/200 (29%)
- Estimated Completion: ~2 hours remaining
"""
        return inventory
    
    def run_live_monitor(self):
        """Run the live monitoring display"""
        self.console.clear()
        
        with Live(self.create_progress_display(), refresh_per_second=1, console=self.console) as live:
            try:
                while True:
                    time.sleep(1)
                    live.update(self.create_progress_display())
            except KeyboardInterrupt:
                self.console.print("\n[yellow]Monitoring stopped by user[/yellow]")
    
    def run_once(self):
        """Run a single update and display"""
        self.console.clear()
        self.console.print(self.create_progress_display())
        
        # Also print file inventory
        self.console.print("\n" + "="*80)
        self.console.print(self.create_file_inventory())

def main():
    monitor = AdaptiveTrainingProgressMonitor()
    
    # Check if we want live monitoring or single display
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--live":
        monitor.run_live_monitor()
    else:
        monitor.run_once()

if __name__ == "__main__":
    main()