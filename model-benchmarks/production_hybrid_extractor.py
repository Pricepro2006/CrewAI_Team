#!/usr/bin/env python3
"""
Production-Ready Hybrid Extraction System
Combines verified patterns, discovered patterns, and LLM enhancement
Ready for deployment with monitoring and metrics
"""

import json
import re
import time
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
import logging
from collections import defaultdict
import subprocess

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ExtractedEntity:
    """Data class for extracted entities"""
    value: str
    type: str
    confidence: float
    source: str  # 'verified', 'discovered', 'llm'
    context: str
    classification: Optional[str] = None
    metadata: Optional[Dict] = None

@dataclass
class ExtractionResult:
    """Complete extraction result for an email"""
    email_id: str
    entities: List[ExtractedEntity]
    purpose: str
    workflow: Optional[str]
    processing_time: float
    llm_used: bool
    metrics: Dict[str, Any]

class ProductionHybridExtractor:
    """Production-ready extraction system with monitoring"""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or self.default_config()
        
        # Load pattern sources
        self.verified_patterns = self.load_verified_patterns()
        self.discovered_patterns = self.load_discovered_patterns()
        self.human_verified = self.load_human_verified_patterns()
        
        # Initialize LLM if configured
        self.llm_model = None
        if self.config['use_llm']:
            self.initialize_llm()
        
        # Metrics tracking
        self.metrics = {
            'total_processed': 0,
            'verified_extractions': 0,
            'discovered_extractions': 0,
            'llm_extractions': 0,
            'processing_times': [],
            'confidence_scores': [],
            'error_count': 0
        }
        
        # Cache for performance
        self.cache = {}
        self.cache_hits = 0
        
        logger.info("Production Hybrid Extractor initialized")
    
    def default_config(self) -> Dict:
        """Default configuration"""
        return {
            'use_llm': True,
            'llm_model_path': '/home/pricepro2006/CrewAI_Team/models/qwen3-4b-instruct-q4_k_m.gguf',
            'llm_timeout': 30,
            'cache_enabled': True,
            'cache_size': 1000,
            'confidence_threshold': 0.7,
            'parallel_processing': True,
            'monitoring_enabled': True
        }
    
    def load_verified_patterns(self) -> Dict:
        """Load verified TD SYNNEX patterns"""
        from td_synnex_pattern_rules import TDSynnexPatternRules
        return TDSynnexPatternRules()
    
    def load_discovered_patterns(self) -> Dict:
        """Load patterns from discovery process"""
        discovery_file = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/comprehensive_patterns')
        data_files = list(discovery_file.glob('comprehensive_data_*.json'))
        
        if data_files:
            latest = sorted(data_files)[-1]
            with open(latest, 'r') as f:
                return json.load(f)
        return {}
    
    def load_human_verified_patterns(self) -> Dict:
        """Load human-verified patterns"""
        verified_file = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/human_verification/verified_patterns.json')
        
        if verified_file.exists():
            with open(verified_file, 'r') as f:
                return json.load(f)
        return {}
    
    def initialize_llm(self):
        """Initialize LLM for enhanced extraction"""
        model_path = self.config['llm_model_path']
        if Path(model_path).exists():
            self.llm_model = model_path
            logger.info(f"LLM initialized: {model_path}")
        else:
            logger.warning(f"LLM model not found: {model_path}")
            self.config['use_llm'] = False
    
    def extract_entities(self, text: str, email_id: str = None) -> ExtractionResult:
        """Main extraction method - production ready"""
        start_time = time.time()
        
        # Check cache
        if self.config.get('cache_enabled', True) and email_id in self.cache:
            self.cache_hits += 1
            logger.debug(f"Cache hit for email {email_id}")
            return self.cache[email_id]
        
        try:
            # Phase 1: Verified patterns (highest confidence)
            verified_entities = self.extract_verified_patterns(text)
            
            # Phase 2: Discovered patterns (medium confidence)
            discovered_entities = self.extract_discovered_patterns(text)
            
            # Phase 3: LLM enhancement (if needed)
            llm_entities = []
            llm_used = False
            
            if self.should_use_llm(verified_entities, discovered_entities, text):
                llm_entities = self.extract_with_llm(text)
                llm_used = True
            
            # Combine and deduplicate
            all_entities = self.combine_entities(
                verified_entities, 
                discovered_entities, 
                llm_entities
            )
            
            # Classify purpose and workflow
            purpose = self.classify_purpose(text, all_entities)
            workflow = self.identify_workflow(all_entities, purpose)
            
            # Calculate metrics
            processing_time = time.time() - start_time
            metrics = self.calculate_metrics(all_entities, processing_time)
            
            # Create result
            result = ExtractionResult(
                email_id=email_id or self.generate_id(),
                entities=all_entities,
                purpose=purpose,
                workflow=workflow,
                processing_time=processing_time,
                llm_used=llm_used,
                metrics=metrics
            )
            
            # Update cache
            if self.config.get('cache_enabled', True):
                self.update_cache(email_id, result)
            
            # Update global metrics
            self.update_metrics(result)
            
            return result
            
        except Exception as e:
            logger.error(f"Extraction error: {e}")
            self.metrics['error_count'] += 1
            
            # Return partial result on error
            return ExtractionResult(
                email_id=email_id or self.generate_id(),
                entities=[],
                purpose='error',
                workflow=None,
                processing_time=time.time() - start_time,
                llm_used=False,
                metrics={'error': str(e)}
            )
    
    def extract_verified_patterns(self, text: str) -> List[ExtractedEntity]:
        """Extract using verified patterns"""
        entities = []
        
        try:
            results = self.verified_patterns.extract_entities(text)
            
            for entity_type, instances in results.items():
                for instance in instances:
                    entity = ExtractedEntity(
                        value=instance['value'],
                        type=entity_type,
                        confidence=instance.get('confidence', 1.0),
                        source='verified',
                        context=instance.get('context', '')[:200],
                        classification=entity_type
                    )
                    entities.append(entity)
                    
        except Exception as e:
            logger.error(f"Verified pattern extraction error: {e}")
        
        return entities
    
    def extract_discovered_patterns(self, text: str) -> List[ExtractedEntity]:
        """Extract using discovered patterns"""
        entities = []
        
        # Comprehensive pattern matching
        patterns = [
            (r'\b([A-Z]{2,10}[-#\s]?\d{4,15})\b', 'ALPHA_NUMERIC'),
            (r'\b([A-Z]+(?:_[A-Z0-9]+){2,})\b', 'UNDERSCORE_PATTERN'),
            (r'\b(Deal\s+\d{15,25})\b', 'LONG_DEAL'),
            (r'\b(Ref#\d{15,25})\b', 'LONG_REF'),
            (r'\b([A-Z0-9]{2,}[-#@/\\_:.]+[A-Z0-9]{2,})\b', 'SPECIAL_COMPOUND'),
        ]
        
        for pattern_regex, pattern_type in patterns:
            for match in re.finditer(pattern_regex, text, re.IGNORECASE):
                value = match.group(1)
                
                # Check if already captured by verified patterns
                if not self.is_duplicate(value, entities):
                    # Classify based on human verification if available
                    classification = self.get_human_classification(value)
                    
                    entity = ExtractedEntity(
                        value=value,
                        type=pattern_type,
                        confidence=0.7 if classification else 0.5,
                        source='discovered',
                        context=text[max(0, match.start()-50):match.end()+50],
                        classification=classification
                    )
                    entities.append(entity)
        
        return entities
    
    def extract_with_llm(self, text: str) -> List[ExtractedEntity]:
        """Enhanced extraction using LLM"""
        entities = []
        
        if not self.llm_model:
            return entities
        
        try:
            # Prepare prompt
            prompt = self.create_llm_prompt(text)
            
            # Call LLM
            cmd = [
                '/home/pricepro2006/CrewAI_Team/llama.cpp/build/bin/llama-cli',
                '-m', self.llm_model,
                '-p', prompt,
                '-n', '300',
                '--temp', '0.1',
                '--no-display-prompt'
            ]
            
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                timeout=self.config['llm_timeout']
            )
            
            # Parse LLM response
            response = result.stdout.strip()
            entities = self.parse_llm_response(response)
            
        except subprocess.TimeoutExpired:
            logger.warning("LLM timeout")
        except Exception as e:
            logger.error(f"LLM extraction error: {e}")
        
        return entities
    
    def create_llm_prompt(self, text: str) -> str:
        """Create prompt for LLM extraction"""
        prompt = f"""<|im_start|>system
You are an expert at extracting business identifiers from TD SYNNEX emails.
<|im_end|>
<|im_start|>user
Extract ALL identifiers from this email. Include any codes, IDs, or references.

Email:
{text[:1500]}

List each identifier found with its type:
<|im_end|>
<|im_start|>assistant
"""
        return prompt
    
    def parse_llm_response(self, response: str) -> List[ExtractedEntity]:
        """Parse LLM response into entities"""
        entities = []
        
        # Simple parsing - can be enhanced
        lines = response.split('\n')
        for line in lines:
            if ':' in line:
                parts = line.split(':', 1)
                if len(parts) == 2:
                    entity_type = parts[0].strip()
                    value = parts[1].strip()
                    
                    if value and len(value) > 3:  # Basic validation
                        entity = ExtractedEntity(
                            value=value,
                            type='llm_extracted',
                            confidence=0.6,
                            source='llm',
                            context='',
                            classification=entity_type.lower()
                        )
                        entities.append(entity)
        
        return entities
    
    def should_use_llm(self, verified: List, discovered: List, text: str) -> bool:
        """Determine if LLM enhancement is needed"""
        if not self.config['use_llm']:
            return False
        
        # Use LLM if few entities found
        total_found = len(verified) + len(discovered)
        if total_found < 3:
            return True
        
        # Use LLM for complex emails
        if len(text) > 2000 and total_found < 10:
            return True
        
        # Use LLM if low confidence
        avg_confidence = sum(e.confidence for e in verified + discovered) / max(1, total_found)
        if avg_confidence < self.config.get('confidence_threshold', 0.7):
            return True
        
        return False
    
    def combine_entities(self, *entity_lists) -> List[ExtractedEntity]:
        """Combine and deduplicate entities"""
        all_entities = []
        seen_values = set()
        
        # Priority: verified > discovered > llm
        for entities in entity_lists:
            for entity in entities:
                if entity.value not in seen_values:
                    all_entities.append(entity)
                    seen_values.add(entity.value)
        
        return all_entities
    
    def classify_purpose(self, text: str, entities: List[ExtractedEntity]) -> str:
        """Classify email purpose"""
        text_lower = text.lower()
        
        # Purpose keywords
        purposes = {
            'quote_request': ['quote', 'pricing', 'proposal', 'rfq'],
            'order_processing': ['order', 'po', 'purchase'],
            'support_ticket': ['ticket', 'issue', 'problem', 'support'],
            'contract_update': ['spa', 'agreement', 'contract'],
            'shipment_tracking': ['ship', 'deliver', 'track'],
            'invoice': ['invoice', 'bill', 'payment'],
            'notification': ['notify', 'alert', 'inform'],
            'escalation': ['urgent', 'critical', 'escalate']
        }
        
        scores = {}
        for purpose, keywords in purposes.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[purpose] = score
        
        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]
        
        return 'general'
    
    def identify_workflow(self, entities: List[ExtractedEntity], purpose: str) -> Optional[str]:
        """Identify workflow based on entities and purpose"""
        entity_types = set(e.classification for e in entities if e.classification)
        
        # Workflow patterns
        if 'quote' in entity_types and 'purchase_order' in entity_types:
            return 'quote_to_order'
        elif 'ticket' in entity_types and 'escalation' in purpose:
            return 'support_escalation'
        elif 'spa' in entity_types and 'order' in entity_types:
            return 'spa_order_processing'
        elif 'tracking' in entity_types:
            return 'shipment_tracking'
        
        return None
    
    def is_duplicate(self, value: str, entities: List[ExtractedEntity]) -> bool:
        """Check if value is duplicate"""
        return any(e.value == value for e in entities)
    
    def get_human_classification(self, value: str) -> Optional[str]:
        """Get human-verified classification if available"""
        if self.human_verified and 'patterns' in self.human_verified:
            pattern_info = self.human_verified['patterns'].get(value)
            if pattern_info:
                return pattern_info.get('classification')
        return None
    
    def calculate_metrics(self, entities: List[ExtractedEntity], processing_time: float) -> Dict:
        """Calculate extraction metrics"""
        metrics = {
            'total_entities': len(entities),
            'verified_count': sum(1 for e in entities if e.source == 'verified'),
            'discovered_count': sum(1 for e in entities if e.source == 'discovered'),
            'llm_count': sum(1 for e in entities if e.source == 'llm'),
            'avg_confidence': sum(e.confidence for e in entities) / max(1, len(entities)),
            'processing_time': processing_time,
            'entity_types': list(set(e.type for e in entities))
        }
        return metrics
    
    def update_cache(self, email_id: str, result: ExtractionResult):
        """Update cache with size management"""
        if len(self.cache) >= self.config.get('cache_size', 1000):
            # Remove oldest entry (simple FIFO)
            self.cache.pop(next(iter(self.cache)))
        
        self.cache[email_id] = result
    
    def update_metrics(self, result: ExtractionResult):
        """Update global metrics"""
        self.metrics['total_processed'] += 1
        self.metrics['processing_times'].append(result.processing_time)
        
        for entity in result.entities:
            if entity.source == 'verified':
                self.metrics['verified_extractions'] += 1
            elif entity.source == 'discovered':
                self.metrics['discovered_extractions'] += 1
            elif entity.source == 'llm':
                self.metrics['llm_extractions'] += 1
            
            self.metrics['confidence_scores'].append(entity.confidence)
    
    def generate_id(self) -> str:
        """Generate unique ID"""
        return f"email_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{time.time_ns() % 1000000}"
    
    def get_metrics_summary(self) -> Dict:
        """Get metrics summary"""
        if self.metrics['processing_times']:
            avg_time = sum(self.metrics['processing_times']) / len(self.metrics['processing_times'])
        else:
            avg_time = 0
        
        if self.metrics['confidence_scores']:
            avg_confidence = sum(self.metrics['confidence_scores']) / len(self.metrics['confidence_scores'])
        else:
            avg_confidence = 0
        
        return {
            'total_processed': self.metrics['total_processed'],
            'avg_processing_time': avg_time,
            'avg_confidence': avg_confidence,
            'cache_hit_rate': self.cache_hits / max(1, self.metrics['total_processed']),
            'error_rate': self.metrics['error_count'] / max(1, self.metrics['total_processed']),
            'extraction_sources': {
                'verified': self.metrics['verified_extractions'],
                'discovered': self.metrics['discovered_extractions'],
                'llm': self.metrics['llm_extractions']
            }
        }
    
    def export_results(self, results: List[ExtractionResult], output_file: str):
        """Export results to file"""
        data = []
        for result in results:
            data.append({
                'email_id': result.email_id,
                'entities': [asdict(e) for e in result.entities],
                'purpose': result.purpose,
                'workflow': result.workflow,
                'processing_time': result.processing_time,
                'llm_used': result.llm_used,
                'metrics': result.metrics
            })
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"Results exported to {output_file}")

def test_production_extractor():
    """Test the production extractor"""
    
    # Initialize extractor
    extractor = ProductionHybridExtractor()
    
    # Test emails
    test_emails = [
        {
            'id': 'test_001',
            'text': """Subject: RE: Quote WQ1234567890 - Project OITS_Firemon_Renewal_07
            
            Customer PO 0505915850 received. Please apply:
            - CAS-107073-B4P8K8 (SPA agreement)
            - REF#09560491503881131094 (internal reference)
            - Deal 09560465516829257762
            
            Ticket TS-1818562 for tracking."""
        },
        {
            'id': 'test_002',
            'text': """Subject: FTQ-3661265 Update
            
            Processing order PO 68159850.
            SPA#6605041 applied.
            Reference: US_COM_SSKU_FY25Q2_3857
            
            Unknown codes: R241300776Q3, JB250512783R"""
        }
    ]
    
    results = []
    
    print("="*70)
    print("TESTING PRODUCTION HYBRID EXTRACTOR")
    print("="*70)
    
    for email in test_emails:
        print(f"\nProcessing: {email['id']}")
        
        result = extractor.extract_entities(email['text'], email['id'])
        results.append(result)
        
        print(f"  Entities found: {len(result.entities)}")
        print(f"  Purpose: {result.purpose}")
        print(f"  Workflow: {result.workflow}")
        print(f"  Processing time: {result.processing_time:.3f}s")
        print(f"  LLM used: {result.llm_used}")
        
        print("\n  Extracted entities:")
        for entity in result.entities:
            print(f"    • {entity.value} ({entity.type}) - {entity.source} - {entity.confidence:.2f}")
    
    # Show metrics
    print("\n" + "="*70)
    print("METRICS SUMMARY")
    print("="*70)
    
    metrics = extractor.get_metrics_summary()
    for key, value in metrics.items():
        if isinstance(value, dict):
            print(f"{key}:")
            for k, v in value.items():
                print(f"  {k}: {v}")
        else:
            print(f"{key}: {value:.3f}" if isinstance(value, float) else f"{key}: {value}")
    
    # Export results
    output_file = f'/home/pricepro2006/CrewAI_Team/model-benchmarks/production_test_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    extractor.export_results(results, output_file)
    print(f"\nResults exported to: {output_file}")

if __name__ == "__main__":
    test_production_extractor()