#!/usr/bin/env python3
"""
Business Intelligence Dataset Creator
Creates fine-tuning dataset based on high-quality TD SYNNEX analysis patterns
"""

import os
import json
import sqlite3
import pandas as pd
import re
from pathlib import Path
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class WorkflowPattern:
    """Defines a workflow pattern template"""
    name: str
    indicators: List[str]
    avg_timeline: float
    stakeholders: int
    response_time: float
    resolution_rate: float
    
@dataclass
class TrainingExample:
    """Structure for training examples"""
    prompt: str
    completion: str
    workflow_type: str
    complexity_score: float
    quality_tier: str  # gold, silver, bronze

class BusinessIntelligenceDatasetCreator:
    def __init__(self, 
                 analysis_file_path: str,
                 iems_db_path: str = "/home/pricepro2006/CrewAI_Team/data/crewai_enhanced.db",
                 output_dir: str = "/home/pricepro2006/CrewAI_Team/fine-tuning/data/bi_dataset"):
        
        self.analysis_file_path = analysis_file_path
        self.iems_db_path = iems_db_path
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Define workflow patterns based on key findings
        self.workflow_patterns = {
            "quote_processing": WorkflowPattern(
                name="Quote Request/Processing",
                indicators=["quote", "pricing", "RFQ", "proposal"],
                avg_timeline=3.7,
                stakeholders=3.2,
                response_time=4.3,
                resolution_rate=0.38
            ),
            "order_management": WorkflowPattern(
                name="Order Management", 
                indicators=["PO", "order", "shipment", "delivery"],
                avg_timeline=2.3,
                stakeholders=2.8,
                response_time=4.3,
                resolution_rate=0.45
            ),
            "approval_workflow": WorkflowPattern(
                name="Approval Workflows",
                indicators=["approval", "authorize", "sign-off", "manager"],
                avg_timeline=4.2,
                stakeholders=3.2,
                response_time=6.1,
                resolution_rate=0.32
            ),
            "support_resolution": WorkflowPattern(
                name="Support/Issue Resolution", 
                indicators=["issue", "problem", "support", "help"],
                avg_timeline=2.8,
                stakeholders=2.1,
                response_time=3.2,
                resolution_rate=0.41
            ),
            "deal_registration": WorkflowPattern(
                name="Deal Registration",
                indicators=["deal", "registration", "SPA", "special pricing"],
                avg_timeline=5.1,
                stakeholders=3.8,
                response_time=5.7,
                resolution_rate=0.28
            ),
            "pricing_approval": WorkflowPattern(
                name="Special Pricing Approvals",
                indicators=["SPA", "discount", "special price", "pricing exception"],
                avg_timeline=4.8,
                stakeholders=4.1,
                response_time=7.2,
                resolution_rate=0.25
            )
        }
        
        # Communication metrics from findings
        self.communication_metrics = {
            "avg_response_time": 4.3,
            "first_contact_resolution": 0.38,
            "avg_thread_length": 6.3,
            "cross_team_percentage": 0.42
        }
        
        # Organizational patterns
        self.org_patterns = {
            "T119889C": {"sophistication": 29, "type": "sophisticated"},
            "US.Insightsurface": {"storage_focused": 0.586, "type": "storage-centric"},
            "InsightHPI": {"workflow_tracking": True, "type": "workflow-tracked"},
            "Team4401": {"archived": 0.947, "type": "archive-focused"}
        }
    
    def extract_analysis_patterns(self) -> Dict[str, List[str]]:
        """Extract analysis patterns from the high-quality reference file"""
        logger.info("Extracting analysis patterns from reference file...")
        
        patterns = {
            "workflow_states": [],
            "entity_extraction": [], 
            "business_process": [],
            "communication_patterns": [],
            "efficiency_insights": [],
            "recommendations": []
        }
        
        try:
            with open(self.analysis_file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Extract workflow state patterns
            workflow_matches = re.findall(r'#### 🔴 START POINTS.*?(?=####|$)', content, re.DOTALL)
            patterns["workflow_states"].extend(workflow_matches[:10])  # Limit for processing
            
            # Extract entity patterns
            entity_matches = re.findall(r'#### REFERENCE NUMBERS.*?(?=####|$)', content, re.DOTALL)
            patterns["entity_extraction"].extend(entity_matches[:10])
            
            # Extract business process patterns
            process_matches = re.findall(r'#### WORKFLOW PATTERNS.*?(?=####|$)', content, re.DOTALL)
            patterns["business_process"].extend(process_matches[:10])
            
            # Extract communication patterns
            comm_matches = re.findall(r'#### COMMUNICATION.*?(?=####|$)', content, re.DOTALL)
            patterns["communication_patterns"].extend(comm_matches[:10])
            
            logger.info(f"Extracted {sum(len(v) for v in patterns.values())} patterns")
            return patterns
            
        except Exception as e:
            logger.error(f"Error extracting patterns: {e}")
            return patterns
    
    def get_sample_emails(self, limit: int = 100) -> List[Dict]:
        """Get sample emails from IEMS database"""
        logger.info(f"Fetching {limit} sample emails from database...")
        
        try:
            conn = sqlite3.connect(self.iems_db_path)
            
            query = """
            SELECT 
                id, 
                subject, 
                body_content as body, 
                sender_email as sender,
                received_date_time as date_received,
                chain_id,
                phase1_result as workflow_state
            FROM emails_enhanced 
            WHERE body_content IS NOT NULL 
                AND LENGTH(body_content) > 100
                AND LENGTH(body_content) < 5000  -- Manageable size for training
                AND subject IS NOT NULL
                AND body_content NOT LIKE '%unsubscribe%'  -- Filter out promotional emails
            ORDER BY RANDOM()
            LIMIT ?
            """
            
            df = pd.read_sql_query(query, conn, params=[limit])
            conn.close()
            
            emails = df.to_dict('records')
            logger.info(f"Retrieved {len(emails)} emails")
            return emails
            
        except Exception as e:
            logger.error(f"Error fetching emails: {e}")
            return []
    
    def classify_email_workflow(self, email: Dict) -> str:
        """Classify email into workflow type based on content"""
        subject = email.get('subject', '').lower()
        body = email.get('body', '').lower()
        
        content = f"{subject} {body}"
        
        # Score each workflow pattern
        scores = {}
        for workflow_name, pattern in self.workflow_patterns.items():
            score = 0
            for indicator in pattern.indicators:
                score += content.count(indicator.lower())
            scores[workflow_name] = score
        
        # Return highest scoring workflow
        if max(scores.values()) > 0:
            return max(scores, key=scores.get)
        else:
            return "general_inquiry"
    
    def generate_business_intelligence_analysis(self, email: Dict, workflow_type: str) -> str:
        """Generate business intelligence analysis based on workflow patterns"""
        
        pattern = self.workflow_patterns.get(workflow_type)
        if not pattern:
            pattern = self.workflow_patterns["order_management"]  # Default
        
        # Extract entities from email
        entities = self.extract_entities(email)
        
        # Generate analysis following the high-quality template
        analysis = f"""# TD SYNNEX Email Workflow Analysis

## 🔍 WORKFLOW STATE IDENTIFICATION

#### 🔴 START POINTS DETECTED
- {pattern.name} initiated
- Reference Numbers: {', '.join(entities.get('references', ['None detected']))}
- Priority Level: {self.assess_priority(email)}

#### 🟡 IN-PROGRESS INDICATORS
- Average Timeline: {pattern.avg_timeline} days
- Stakeholders Involved: {pattern.stakeholders} (average)
- Communication Stage: Active

#### 🟢 COMPLETION MARKERS
- Expected Resolution Rate: {pattern.resolution_rate:.1%}
- Estimated Response Time: {pattern.response_time} hours

## 2. DEEP ENTITY EXTRACTION

#### REFERENCE NUMBERS
{self.format_entities(entities)}

#### KEY PARTICIPANTS
- Internal Teams: {', '.join(entities.get('internal_teams', ['Support Team']))}
- External Contacts: {', '.join(entities.get('external_contacts', ['Customer']))}

## 3. BUSINESS PROCESS ANALYSIS

#### WORKFLOW PATTERNS
- Primary Process: {pattern.name}
- Communication Frequency: {self.calculate_frequency(email)}
- Cross-Team Coordination: {'High' if 'team' in email.get('body', '').lower() else 'Medium'}

## 4. EFFICIENCY INSIGHTS

#### PERFORMANCE METRICS
- Expected Thread Length: {self.communication_metrics['avg_thread_length']} emails
- Cross-Team Communication Likelihood: {self.communication_metrics['cross_team_percentage']:.1%}
- First Contact Resolution Probability: {pattern.resolution_rate:.1%}

## 5. RECOMMENDATIONS

1. Monitor for escalation after {pattern.response_time} hours
2. Engage {int(pattern.stakeholders)} stakeholders for optimal resolution
3. Track completion within {pattern.avg_timeline} day timeline
4. Implement efficiency improvements for {(1-pattern.resolution_rate)*100:.0f}% improvement potential

---

**Analysis Confidence**: High
**Workflow Type**: {pattern.name}
**Processing Time**: {pattern.avg_timeline} days (average)
"""

        return analysis
    
    def extract_entities(self, email: Dict) -> Dict[str, List[str]]:
        """Extract entities from email content"""
        content = f"{email.get('subject', '')} {email.get('body', '')}"
        
        entities = {
            'references': [],
            'internal_teams': [],
            'external_contacts': []
        }
        
        # Extract PO numbers
        po_matches = re.findall(r'PO[#\s]*(\d{5,})', content, re.IGNORECASE)
        entities['references'].extend([f"PO#{po}" for po in po_matches])
        
        # Extract quote numbers  
        quote_matches = re.findall(r'quote[#\s]*(\d{5,})', content, re.IGNORECASE)
        entities['references'].extend([f"Quote#{quote}" for quote in quote_matches])
        
        # Extract SPA codes
        spa_matches = re.findall(r'(CAS-[\w\d-]+)', content, re.IGNORECASE)
        entities['references'].extend(spa_matches)
        
        # Extract team references
        team_matches = re.findall(r'(team\d+|support|sales|procurement)', content, re.IGNORECASE)
        entities['internal_teams'].extend(team_matches)
        
        return entities
    
    def format_entities(self, entities: Dict[str, List[str]]) -> str:
        """Format entities for output"""
        formatted = []
        
        if entities['references']:
            formatted.append(f"- Reference Numbers: {', '.join(entities['references'][:5])}")
        
        if entities['internal_teams']:
            formatted.append(f"- Internal Teams: {', '.join(entities['internal_teams'][:3])}")
            
        return '\n'.join(formatted) if formatted else "- No specific entities detected"
    
    def assess_priority(self, email: Dict) -> str:
        """Assess email priority based on content"""
        content = f"{email.get('subject', '')} {email.get('body', '')}".lower()
        
        if any(word in content for word in ['urgent', 'asap', 'critical', 'emergency']):
            return "HIGH"
        elif any(word in content for word in ['soon', 'quickly', 'priority']):
            return "MEDIUM"
        else:
            return "NORMAL"
    
    def calculate_frequency(self, email: Dict) -> str:
        """Calculate communication frequency indicator"""
        # Simplified - would need email chain analysis for real calculation
        return "Standard"
    
    def create_training_examples(self, emails: List[Dict], patterns: Dict) -> List[TrainingExample]:
        """Create training examples from emails and patterns"""
        logger.info("Creating training examples...")
        
        examples = []
        
        for email in emails:
            # Classify workflow
            workflow_type = self.classify_email_workflow(email)
            
            # Generate analysis
            analysis = self.generate_business_intelligence_analysis(email, workflow_type)
            
            # Create training prompt
            prompt = f"Analyze this business email and provide comprehensive workflow intelligence:\n\n"
            prompt += f"Subject: {email.get('subject', 'N/A')}\n"
            prompt += f"From: {email.get('sender', 'N/A')}\n" 
            prompt += f"Body: {email.get('body', 'N/A')[:1000]}...\n\n"
            prompt += "Please provide detailed workflow analysis including state identification, entity extraction, process analysis, and efficiency insights."
            
            # Determine quality tier
            quality_tier = self.determine_quality_tier(email, workflow_type)
            
            # Calculate complexity score
            complexity_score = self.calculate_complexity_score(email)
            
            example = TrainingExample(
                prompt=prompt,
                completion=analysis,
                workflow_type=workflow_type,
                complexity_score=complexity_score,
                quality_tier=quality_tier
            )
            
            examples.append(example)
        
        logger.info(f"Created {len(examples)} training examples")
        return examples
    
    def determine_quality_tier(self, email: Dict, workflow_type: str) -> str:
        """Determine quality tier for training example"""
        # Gold: Complex workflows with multiple entities
        entities = self.extract_entities(email)
        entity_count = sum(len(v) for v in entities.values())
        
        body_length = len(email.get('body', ''))
        
        if entity_count >= 3 and body_length > 500:
            return "gold"
        elif entity_count >= 1 and body_length > 200:
            return "silver"
        else:
            return "bronze"
    
    def calculate_complexity_score(self, email: Dict) -> float:
        """Calculate complexity score for email"""
        score = 0.0
        
        # Length factor
        body_length = len(email.get('body', ''))
        score += min(body_length / 1000, 1.0) * 0.3
        
        # Entity factor
        entities = self.extract_entities(email)
        entity_count = sum(len(v) for v in entities.values())
        score += min(entity_count / 5, 1.0) * 0.4
        
        # Cross-team factor
        if any(team in email.get('body', '').lower() for team in ['team', 'support', 'sales']):
            score += 0.3
        
        return min(score, 1.0)
    
    def save_dataset(self, examples: List[TrainingExample]) -> None:
        """Save training dataset in multiple formats"""
        logger.info("Saving training dataset...")
        
        # Save as JSONL for training
        jsonl_path = self.output_dir / "business_intelligence_training.jsonl"
        with open(jsonl_path, 'w') as f:
            for example in examples:
                training_obj = {
                    "prompt": example.prompt,
                    "completion": example.completion,
                    "metadata": {
                        "workflow_type": example.workflow_type,
                        "complexity_score": example.complexity_score,
                        "quality_tier": example.quality_tier
                    }
                }
                f.write(json.dumps(training_obj) + '\n')
        
        # Save statistics
        stats = {
            "total_examples": len(examples),
            "workflow_distribution": {},
            "quality_distribution": {},
            "avg_complexity": sum(ex.complexity_score for ex in examples) / len(examples),
            "created_at": datetime.now().isoformat()
        }
        
        # Calculate distributions
        for example in examples:
            # Workflow distribution
            stats["workflow_distribution"][example.workflow_type] = \
                stats["workflow_distribution"].get(example.workflow_type, 0) + 1
            
            # Quality distribution  
            stats["quality_distribution"][example.quality_tier] = \
                stats["quality_distribution"].get(example.quality_tier, 0) + 1
        
        stats_path = self.output_dir / "dataset_statistics.json"
        with open(stats_path, 'w') as f:
            json.dump(stats, f, indent=2)
        
        logger.info(f"Dataset saved to {jsonl_path}")
        logger.info(f"Statistics saved to {stats_path}")
        
        # Print summary
        print("\n" + "="*60)
        print("BUSINESS INTELLIGENCE DATASET CREATED")
        print("="*60)
        print(f"Total Examples: {stats['total_examples']}")
        print(f"Average Complexity: {stats['avg_complexity']:.2f}")
        print("\nWorkflow Distribution:")
        for workflow, count in stats["workflow_distribution"].items():
            print(f"  {workflow}: {count}")
        print("\nQuality Distribution:")  
        for quality, count in stats["quality_distribution"].items():
            print(f"  {quality}: {count}")
        print("="*60)
    
    def run(self, email_limit: int = 200) -> None:
        """Run the complete dataset creation process"""
        logger.info("Starting Business Intelligence Dataset Creation...")
        
        # Extract patterns from reference analysis
        patterns = self.extract_analysis_patterns()
        
        # Get sample emails
        emails = self.get_sample_emails(email_limit)
        
        if not emails:
            logger.error("No emails found. Cannot create dataset.")
            return
        
        # Create training examples
        examples = self.create_training_examples(emails, patterns)
        
        # Save dataset
        self.save_dataset(examples)
        
        logger.info("Business Intelligence Dataset Creation completed!")

def main():
    """Main entry point"""
    # Paths
    analysis_file = "/home/pricepro2006/iems_project/claude_final_analysis_20250601_083919.md"
    
    if not os.path.exists(analysis_file):
        print(f"Error: Analysis file not found at {analysis_file}")
        return
    
    # Create dataset
    creator = BusinessIntelligenceDatasetCreator(analysis_file)
    creator.run(email_limit=300)  # Create 300 high-quality examples

if __name__ == "__main__":
    main()