#!/usr/bin/env python3
"""
Deep Email Analysis Script
Implements LLM-powered analysis for business insights using local models
Based on 2025 best practices research
"""

import os
import sys
import sqlite3
import json
import time
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import asyncio
from dataclasses import dataclass
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('deep_analysis.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Analysis Models
class ActionItem(BaseModel):
    """Action item extracted from email"""
    task: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    priority: str = "medium"
    confidence: float = 0.0

class SLARisk(BaseModel):
    """SLA risk assessment"""
    risk_level: str  # high, medium, low
    deadline: Optional[str] = None
    hours_remaining: Optional[float] = None
    reason: str
    confidence: float = 0.0

class BusinessImpact(BaseModel):
    """Business impact assessment"""
    revenue_impact: Optional[float] = None
    satisfaction_impact: str  # positive, negative, neutral
    urgency_reason: Optional[str] = None
    business_value: str  # high, medium, low
    confidence: float = 0.0

class DeepEmailAnalysis(BaseModel):
    """Complete deep analysis result"""
    contextual_summary: str
    action_items: List[ActionItem]
    sla_risks: List[SLARisk]
    business_impact: BusinessImpact
    suggested_response: str
    confidence_score: float
    processing_time_ms: int
    model_used: str

class DeepEmailAnalyzer:
    """Performs deep LLM-powered email analysis"""
    
    def __init__(self, db_path: str, model_name: str = "granite3.3:2b"):
        self.db_path = db_path
        self.model_name = model_name
        self.ollama_url = "http://localhost:11434"
        self.conn = None
        self.stats = {
            'total_analyzed': 0,
            'successful': 0,
            'failed': 0,
            'total_time': 0,
            'action_items_found': 0,
            'sla_risks_found': 0
        }
        
        # Model selection based on task complexity
        self.model_selection = {
            'simple': 'qwen3:0.6b',     # Fastest for simple analysis
            'medium': 'qwen3:1.7b',     # Balanced for most tasks
            'complex': 'granite3.3:2b'   # Most accurate for complex analysis
        }
        
    def connect_database(self) -> bool:
        """Connect to the database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row
            
            # Apply performance optimizations
            self.conn.execute("PRAGMA journal_mode = WAL")
            self.conn.execute("PRAGMA synchronous = NORMAL")
            self.conn.execute("PRAGMA cache_size = 10000")
            
            logger.info(f"Connected to database: {self.db_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False
            
    def determine_complexity(self, email_content: str, entities: Dict) -> str:
        """Determine email complexity for model selection"""
        # Simple heuristics for complexity
        word_count = len(email_content.split())
        entity_count = sum(len(v) for v in entities.values() if isinstance(v, list))
        
        if word_count < 100 and entity_count < 5:
            return 'simple'
        elif word_count < 500 and entity_count < 15:
            return 'medium'
        else:
            return 'complex'
            
    async def call_ollama(self, prompt: str, model: str = None) -> Optional[str]:
        """Call Ollama API with proper error handling"""
        import aiohttp
        
        if model is None:
            model = self.model_name
            
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "seed": 42  # For reproducibility
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.ollama_url}/api/generate",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=300)  # 5 minutes timeout
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('response', '')
                    else:
                        logger.error(f"Ollama API error: {response.status}")
                        return None
        except Exception as e:
            logger.error(f"Error calling Ollama: {e}")
            return None
            
    def build_analysis_prompt(self, email: Dict, entities: Dict) -> str:
        """Build comprehensive analysis prompt using CoT reasoning"""
        # Simplify body to first 500 chars
        body = email.get('body', '')[:500].replace('\n', ' ').strip()
        
        prompt = f"""Analyze this email and return JSON.

Subject: {email.get('subject', 'N/A')}
Body: {body}

Return JSON:
{{
    "contextual_summary": "What is this email about",
    "action_items": [
        {{
            "task": "What needs to be done",
            "owner": "Who should do it",
            "deadline": "When",
            "priority": "high",
            "confidence": 0.8
        }}
    ],
    "sla_risks": [],
    "business_impact": {{
        "revenue_impact": null,
        "satisfaction_impact": "neutral",
        "urgency_reason": "Not urgent",
        "business_value": "medium",
        "confidence": 0.7
    }},
    "suggested_response": "How to respond",
    "confidence_score": 0.8
}}"""
        
        return prompt
        
    async def analyze_email(self, email_data: Dict) -> Optional[DeepEmailAnalysis]:
        """Perform deep analysis on a single email"""
        start_time = time.time()
        
        try:
            # Get existing entities from analysis
            entities = {
                'po_numbers': json.loads(email_data.get('entities_po_numbers', '[]')),
                'quote_numbers': json.loads(email_data.get('entities_quote_numbers', '[]')),
                'companies': json.loads(email_data.get('entities_contacts', '[]')),
                'part_numbers': json.loads(email_data.get('entities_part_numbers', '[]'))
            }
            
            # Determine complexity and select model
            complexity = self.determine_complexity(
                email_data.get('body', ''),
                entities
            )
            selected_model = self.model_selection[complexity]
            
            # Build and execute prompt
            prompt = self.build_analysis_prompt(email_data, entities)
            response = await self.call_ollama(prompt, selected_model)
            
            if not response:
                logger.error(f"No response from LLM for email {email_data['id']}")
                return None
                
            # Parse JSON response
            try:
                # Clean response - remove thinking tags and markdown
                if '<think>' in response:
                    # Extract only the JSON part after thinking
                    parts = response.split('</think>')
                    if len(parts) > 1:
                        response = parts[-1].strip()
                    else:
                        # No closing tag, try to find JSON
                        response = response.split('<think>')[-1]
                
                # Remove markdown if present
                if response.startswith('```json'):
                    response = response[7:]
                if response.endswith('```'):
                    response = response[:-3]
                
                # Try to extract JSON if mixed with other text
                import re
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
                if json_match:
                    response = json_match.group(0)
                    
                analysis_data = json.loads(response.strip())
                
                # Create analysis object
                analysis = DeepEmailAnalysis(
                    contextual_summary=analysis_data.get('contextual_summary', ''),
                    action_items=[ActionItem(**item) for item in analysis_data.get('action_items', [])],
                    sla_risks=[SLARisk(**risk) for risk in analysis_data.get('sla_risks', [])],
                    business_impact=BusinessImpact(**analysis_data.get('business_impact', {})),
                    suggested_response=analysis_data.get('suggested_response', ''),
                    confidence_score=analysis_data.get('confidence_score', 0.8),
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    model_used=selected_model
                )
                
                # Update stats
                self.stats['action_items_found'] += len(analysis.action_items)
                self.stats['sla_risks_found'] += len(analysis.sla_risks)
                
                return analysis
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM response: {e}")
                logger.error(f"Response was: {response[:500]}...")  # Show first 500 chars
                return None
                
        except Exception as e:
            logger.error(f"Error analyzing email {email_data.get('id')}: {e}")
            return None
            
    def save_analysis(self, email_id: str, analysis: DeepEmailAnalysis) -> bool:
        """Save deep analysis results to database"""
        try:
            # Update email_analysis table
            self.conn.execute("""
                UPDATE email_analysis
                SET 
                    contextual_summary = ?,
                    action_summary = ?,
                    action_details = ?,
                    action_sla_status = ?,
                    business_impact_revenue = ?,
                    business_impact_satisfaction = ?,
                    business_impact_urgency_reason = ?,
                    contextual_summary = ?,
                    suggested_response = ?,
                    deep_workflow_primary = ?,
                    deep_workflow_secondary = ?,
                    deep_model = ?,
                    deep_processing_time = ?,
                    deep_confidence = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email_id = ?
            """, (
                analysis.contextual_summary,
                f"Found {len(analysis.action_items)} action items",
                json.dumps([item.dict() for item in analysis.action_items]),
                'at_risk' if any(r.risk_level == 'high' for r in analysis.sla_risks) else 'on_track',
                analysis.business_impact.revenue_impact,
                analysis.business_impact.satisfaction_impact,
                analysis.business_impact.urgency_reason,
                analysis.contextual_summary,
                analysis.suggested_response,
                'Order Management' if 'order' in analysis.contextual_summary.lower() else 'General',  # Primary workflow
                'Quote Processing' if 'quote' in analysis.contextual_summary.lower() else None,  # Secondary workflow
                analysis.model_used,
                analysis.processing_time_ms,
                analysis.confidence_score,
                email_id
            ))
            
            self.conn.commit()
            return True
            
        except Exception as e:
            logger.error(f"Failed to save analysis for email {email_id}: {e}")
            return False
            
    async def analyze_batch(self, limit: int = 100) -> int:
        """Analyze a batch of emails"""
        # Get emails that need deep analysis
        emails = self.conn.execute("""
            SELECT 
                e.id, e.subject, e.body, e.sender_email,
                ea.entities_po_numbers, ea.entities_quote_numbers,
                ea.entities_contacts, ea.entities_part_numbers,
                ea.workflow_state, ea.quick_workflow
            FROM emails e
            JOIN email_analysis ea ON e.id = ea.email_id
            WHERE ea.contextual_summary IS NULL
            OR ea.deep_model IS NULL
            ORDER BY e.received_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
        
        logger.info(f"Found {len(emails)} emails to analyze")
        
        analyzed = 0
        for email in emails:
            self.stats['total_analyzed'] += 1
            
            analysis = await self.analyze_email(dict(email))
            if analysis:
                if self.save_analysis(email['id'], analysis):
                    analyzed += 1
                    self.stats['successful'] += 1
                    logger.info(f"Analyzed email {email['id']}: {len(analysis.action_items)} actions, "
                              f"{len(analysis.sla_risks)} SLA risks")
                else:
                    self.stats['failed'] += 1
            else:
                self.stats['failed'] += 1
                
            # Progress update
            if self.stats['total_analyzed'] % 10 == 0:
                self.print_progress()
                
        return analyzed
        
    def print_progress(self):
        """Print analysis progress"""
        success_rate = (self.stats['successful'] / self.stats['total_analyzed'] * 100 
                       if self.stats['total_analyzed'] > 0 else 0)
        
        logger.info(f"""
Progress Update:
- Emails Analyzed: {self.stats['total_analyzed']}
- Successful: {self.stats['successful']} ({success_rate:.1f}%)
- Failed: {self.stats['failed']}
- Action Items Found: {self.stats['action_items_found']}
- SLA Risks Found: {self.stats['sla_risks_found']}
""")
        
    async def run_analysis(self, batch_size: int = 100, max_emails: int = None):
        """Run the complete analysis process"""
        logger.info("=" * 80)
        logger.info("Starting Deep Email Analysis")
        logger.info("=" * 80)
        
        if not self.connect_database():
            return False
            
        try:
            # Get total count
            total_count = self.conn.execute("""
                SELECT COUNT(*) 
                FROM email_analysis 
                WHERE contextual_summary IS NULL
            """).fetchone()[0]
            
            logger.info(f"Found {total_count} emails needing deep analysis")
            
            if max_emails:
                total_count = min(total_count, max_emails)
                
            # Process in batches
            processed = 0
            while processed < total_count:
                batch_count = await self.analyze_batch(batch_size)
                processed += batch_count
                
                if batch_count == 0:
                    break
                    
                logger.info(f"Progress: {processed}/{total_count} emails analyzed")
                
            # Final statistics
            logger.info("=" * 80)
            logger.info("Analysis Complete!")
            self.print_progress()
            logger.info("=" * 80)
            
            return True
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return False
            
        finally:
            if self.conn:
                self.conn.close()

async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Deep Email Analysis with LLM")
    parser.add_argument("--db", default="data/app.db", help="Database path")
    parser.add_argument("--model", default="granite3.3:2b", 
                       choices=["granite3.3:2b", "qwen3:1.7b", "qwen3:0.6b"],
                       help="Default model to use")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size")
    parser.add_argument("--max-emails", type=int, help="Maximum emails to process")
    
    args = parser.parse_args()
    
    analyzer = DeepEmailAnalyzer(args.db, args.model)
    success = await analyzer.run_analysis(args.batch_size, args.max_emails)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())