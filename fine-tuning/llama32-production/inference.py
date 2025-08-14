#!/usr/bin/env python3
"""
Llama 3.2:3B Business Intelligence Inference
Using few-shot learning instead of fine-tuning
"""

import json
import subprocess
from pathlib import Path

class BusinessIntelligenceInference:
    def __init__(self):
        self.model_path = "/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
        self.llama_cpp_path = "/home/pricepro2006/CrewAI_Team/llama.cpp"
        
        # Load few-shot examples
        with open("/home/pricepro2006/CrewAI_Team/fine-tuning/llama32-production/few_shot_examples.json", 'r') as f:
            self.few_shot_examples = json.load(f)
    
    def analyze(self, input_text):
        """Analyze business intelligence using few-shot learning"""
        
        # Build few-shot prompt
        prompt = self._build_few_shot_prompt(input_text)
        
        # Run inference
        cmd = [
            str(Path(self.llama_cpp_path) / "build" / "bin" / "llama-cli"),
            "-m", self.model_path,
            "-p", prompt,
            "-n", "500",
            "--threads", "8",
            "--temp", "0.7",
            "--ctx-size", "4096"
        ]
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            if result.returncode == 0:
                return self._extract_response(result.stdout)
            else:
                return f"Error: {result.stderr}"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _build_few_shot_prompt(self, input_text):
        """Build prompt with few-shot examples"""
        
        prompt = "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n"
        prompt += "You are a business intelligence analyst. Here are examples of analysis:\n\n"
        
        # Add 2-3 few-shot examples
        for ex in self.few_shot_examples[:2]:
            prompt += f"Example {ex['id']}:\n"
            prompt += f"Input: {ex['input'][:200]}...\n"
            prompt += f"Analysis: {ex['output'][:200]}...\n\n"
        
        # Add actual query
        prompt += f"Now analyze this:\n"
        prompt += f"Input: {input_text}\n"
        prompt += f"<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\nAnalysis:"
        
        return prompt
    
    def _extract_response(self, output):
        """Extract the analysis from model output"""
        # Find the analysis part after "Analysis:"
        if "Analysis:" in output:
            parts = output.split("Analysis:")
            if len(parts) > 1:
                return parts[-1].strip()
        return output.strip()

def main():
    """Test the inference system"""
    bi = BusinessIntelligenceInference()
    
    test_input = """
    Email batch for analysis:
    Subject: Q4 Revenue Projections
    From: cfo@company.com
    Body: Based on current pipeline, Q4 revenue projected at $4.2M, 
    representing 18% YoY growth. Key drivers include enterprise 
    expansion and new product adoption.
    """
    
    print("Analyzing business intelligence...")
    result = bi.analyze(test_input)
    print(f"\nAnalysis Result:\n{result}")

if __name__ == "__main__":
    main()
