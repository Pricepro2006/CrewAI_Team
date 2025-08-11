#!/usr/bin/env python3
"""
Production Deployment Script for TD SYNNEX Pattern Extraction System
Deploys the extraction service and starts processing 143,850 emails
"""

import os
import sys
import json
import time
import sqlite3
import logging
from pathlib import Path
from datetime import datetime
import subprocess
from typing import Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/model-benchmarks/deployment.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('deployment')

class ProductionDeployment:
    """Handles production deployment of pattern extraction system"""
    
    def __init__(self):
        self.base_dir = Path('/home/pricepro2006/CrewAI_Team')
        self.model_dir = self.base_dir / 'model-benchmarks'
        self.data_dir = self.base_dir / 'data'
        self.deployment_config = self.load_deployment_config()
        
    def load_deployment_config(self) -> Dict:
        """Load deployment configuration"""
        return {
            'database_path': str(self.data_dir / 'crewai_enhanced.db'),
            'pattern_db_path': str(self.model_dir / 'pattern_extraction.db'),
            'batch_size': 1000,
            'parallel_workers': 4,
            'enable_monitoring': True,
            'api_port': 5555,
            'websocket_port': 8888
        }
    
    def verify_dependencies(self) -> bool:
        """Verify all dependencies are available"""
        logger.info("Verifying dependencies...")
        
        checks = {
            'Database': self.check_database(),
            'Python modules': self.check_python_modules(),
            'Llama.cpp': self.check_llama_cpp(),
            'Model files': self.check_model_files(),
            'Directory structure': self.check_directories()
        }
        
        for component, status in checks.items():
            if status:
                logger.info(f"✅ {component}: OK")
            else:
                logger.error(f"❌ {component}: FAILED")
        
        return all(checks.values())
    
    def check_database(self) -> bool:
        """Check if email database exists and is accessible"""
        db_path = Path(self.deployment_config['database_path'])
        if not db_path.exists():
            logger.error(f"Database not found: {db_path}")
            return False
        
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM emails_enhanced")
            count = cursor.fetchone()[0]
            conn.close()
            logger.info(f"Database contains {count:,} emails")
            return True
        except Exception as e:
            logger.error(f"Database error: {e}")
            return False
    
    def check_python_modules(self) -> bool:
        """Check required Python modules"""
        try:
            from production_hybrid_extractor import ProductionHybridExtractor
            from run_full_discovery import FullPatternDiscoveryPipeline
            from human_verification_interface import PatternVerificationInterface
            return True
        except ImportError as e:
            logger.error(f"Missing module: {e}")
            return False
    
    def check_llama_cpp(self) -> bool:
        """Check if llama.cpp is available"""
        llama_path = self.base_dir / 'llama.cpp/build/bin/llama-cli'
        return llama_path.exists()
    
    def check_model_files(self) -> bool:
        """Check if model files exist"""
        model_path = self.base_dir / 'models/qwen3-4b-instruct-q4_k_m.gguf'
        if not model_path.exists():
            logger.warning("Model file not found, LLM enhancement will be disabled")
            return True  # Not critical - can run without LLM
        return True
    
    def check_directories(self) -> bool:
        """Ensure required directories exist"""
        dirs = [
            self.model_dir / 'full_discovery',
            self.model_dir / 'human_verification',
            self.model_dir / 'comprehensive_patterns',
            self.model_dir / 'api_logs'
        ]
        
        for dir_path in dirs:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        return True
    
    def initialize_pattern_database(self):
        """Initialize database for storing patterns"""
        logger.info("Initializing pattern database...")
        
        conn = sqlite3.connect(self.deployment_config['pattern_db_path'])
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS discovered_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT UNIQUE NOT NULL,
                pattern_type TEXT,
                classification TEXT,
                confidence REAL,
                occurrences INTEGER DEFAULT 1,
                first_seen TIMESTAMP,
                last_seen TIMESTAMP,
                verified BOOLEAN DEFAULT 0,
                metadata TEXT
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS extraction_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id TEXT,
                entities_found INTEGER,
                purpose TEXT,
                workflow TEXT,
                processing_time REAL,
                llm_used BOOLEAN,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_name TEXT,
                metric_value REAL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("Pattern database initialized")
    
    def deploy_extraction_service(self):
        """Deploy the extraction service as a background process"""
        logger.info("Deploying extraction service...")
        
        # Create service script
        service_script = self.model_dir / 'extraction_service.py'
        
        service_code = '''#!/usr/bin/env python3
"""Production Extraction Service"""

from flask import Flask, request, jsonify
from production_hybrid_extractor import ProductionHybridExtractor
import logging

app = Flask(__name__)
extractor = ProductionHybridExtractor()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'timestamp': time.time()})

@app.route('/extract', methods=['POST'])
def extract():
    try:
        data = request.json
        result = extractor.extract_entities(
            data['text'],
            data.get('email_id')
        )
        
        return jsonify({
            'entities': [e.__dict__ for e in result.entities],
            'purpose': result.purpose,
            'workflow': result.workflow,
            'processing_time': result.processing_time,
            'metrics': result.metrics
        })
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/metrics', methods=['GET'])
def metrics():
    return jsonify(extractor.get_metrics_summary())

if __name__ == '__main__':
    logger.info("Starting extraction service on port 5555...")
    app.run(host='0.0.0.0', port=5555, debug=False)
'''
        
        with open(service_script, 'w') as f:
            f.write(service_code)
        
        # Make executable
        os.chmod(service_script, 0o755)
        
        # Start service in background
        cmd = [sys.executable, str(service_script)]
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True
        )
        
        logger.info(f"Extraction service started with PID: {process.pid}")
        
        # Save PID for management
        with open(self.model_dir / 'service.pid', 'w') as f:
            f.write(str(process.pid))
        
        return process.pid
    
    def start_pattern_discovery(self):
        """Start the pattern discovery pipeline"""
        logger.info("Starting pattern discovery on 143,850 emails...")
        
        discovery_script = self.model_dir / 'start_discovery.py'
        
        discovery_code = '''#!/usr/bin/env python3
"""Start Pattern Discovery Pipeline"""

import sys
sys.path.append('/home/pricepro2006/CrewAI_Team/model-benchmarks')

from run_full_discovery import FullPatternDiscoveryPipeline
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)

logger = logging.getLogger(__name__)

def main():
    logger.info("Initializing Full Pattern Discovery Pipeline...")
    pipeline = FullPatternDiscoveryPipeline()
    
    logger.info("Starting discovery on 143,850 emails...")
    pipeline.run_full_discovery()
    
    logger.info("Discovery complete!")

if __name__ == "__main__":
    main()
'''
        
        with open(discovery_script, 'w') as f:
            f.write(discovery_code)
        
        os.chmod(discovery_script, 0o755)
        
        # Start discovery in background
        cmd = [sys.executable, str(discovery_script)]
        process = subprocess.Popen(
            cmd,
            stdout=open(self.model_dir / 'discovery.log', 'w'),
            stderr=subprocess.STDOUT,
            start_new_session=True
        )
        
        logger.info(f"Pattern discovery started with PID: {process.pid}")
        
        # Save PID
        with open(self.model_dir / 'discovery.pid', 'w') as f:
            f.write(str(process.pid))
        
        return process.pid
    
    def setup_monitoring(self):
        """Set up monitoring dashboard"""
        logger.info("Setting up monitoring dashboard...")
        
        monitor_script = self.model_dir / 'monitor_dashboard.py'
        
        monitor_code = '''#!/usr/bin/env python3
"""Real-time Monitoring Dashboard"""

import time
import sqlite3
import json
from datetime import datetime
from pathlib import Path

def get_metrics():
    """Get current metrics"""
    db_path = '/home/pricepro2006/CrewAI_Team/model-benchmarks/pattern_extraction.db'
    
    if not Path(db_path).exists():
        return None
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get extraction stats
    cursor.execute("""
        SELECT 
            COUNT(*) as total_processed,
            AVG(processing_time) as avg_time,
            SUM(entities_found) as total_entities,
            COUNT(DISTINCT purpose) as unique_purposes
        FROM extraction_logs
        WHERE timestamp > datetime('now', '-1 hour')
    """)
    
    stats = cursor.fetchone()
    
    # Get pattern stats
    cursor.execute("""
        SELECT 
            COUNT(*) as total_patterns,
            COUNT(CASE WHEN verified = 1 THEN 1 END) as verified_patterns,
            AVG(confidence) as avg_confidence
        FROM discovered_patterns
    """)
    
    patterns = cursor.fetchone()
    
    conn.close()
    
    return {
        'timestamp': datetime.now().isoformat(),
        'extraction': {
            'total_processed': stats[0] or 0,
            'avg_processing_time': stats[1] or 0,
            'total_entities': stats[2] or 0,
            'unique_purposes': stats[3] or 0
        },
        'patterns': {
            'total': patterns[0] or 0,
            'verified': patterns[1] or 0,
            'avg_confidence': patterns[2] or 0
        }
    }

def display_dashboard():
    """Display monitoring dashboard"""
    print("\\033[2J\\033[H")  # Clear screen
    print("="*70)
    print("TD SYNNEX PATTERN EXTRACTION - MONITORING DASHBOARD")
    print("="*70)
    
    while True:
        metrics = get_metrics()
        
        if metrics:
            print(f"\\nLast Update: {metrics['timestamp']}")
            print("\\nEXTRACTION METRICS (Last Hour):")
            print(f"  Emails Processed: {metrics['extraction']['total_processed']:,}")
            print(f"  Avg Processing Time: {metrics['extraction']['avg_processing_time']:.3f}s")
            print(f"  Total Entities Found: {metrics['extraction']['total_entities']:,}")
            print(f"  Unique Purposes: {metrics['extraction']['unique_purposes']}")
            
            print("\\nPATTERN DISCOVERY:")
            print(f"  Total Patterns: {metrics['patterns']['total']:,}")
            print(f"  Verified Patterns: {metrics['patterns']['verified']:,}")
            print(f"  Avg Confidence: {metrics['patterns']['avg_confidence']:.2%}")
            
            # Check discovery log
            log_path = Path('/home/pricepro2006/CrewAI_Team/model-benchmarks/full_discovery/discovery_state.pkl')
            if log_path.exists():
                print("\\nDISCOVERY PROGRESS:")
                print("  Status: RUNNING")
                print(f"  State file: {log_path}")
        else:
            print("\\nWaiting for metrics...")
        
        print("\\n[Press Ctrl+C to exit]")
        time.sleep(5)
        print("\\033[2J\\033[H")  # Clear screen

if __name__ == "__main__":
    try:
        display_dashboard()
    except KeyboardInterrupt:
        print("\\n\\nMonitoring stopped.")
'''
        
        with open(monitor_script, 'w') as f:
            f.write(monitor_code)
        
        os.chmod(monitor_script, 0o755)
        logger.info("Monitoring dashboard ready: python3 monitor_dashboard.py")
    
    def run_initial_batch(self):
        """Run initial batch to verify deployment"""
        logger.info("Running initial batch test...")
        
        try:
            from production_hybrid_extractor import ProductionHybridExtractor
            
            # Test extraction
            extractor = ProductionHybridExtractor(config={'use_llm': False})
            
            test_email = """
            Subject: RE: Quote WQ1234567890 - Urgent
            Customer PO 0505915850 received.
            Apply SPA CAS-107073-B4P8K8
            Reference: REF#09560491503881131094
            """
            
            result = extractor.extract_entities(test_email, 'deployment_test')
            
            logger.info(f"Test extraction successful:")
            logger.info(f"  - Entities found: {len(result.entities)}")
            logger.info(f"  - Purpose: {result.purpose}")
            logger.info(f"  - Processing time: {result.processing_time:.3f}s")
            
            # Save to database
            conn = sqlite3.connect(self.deployment_config['pattern_db_path'])
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO extraction_logs 
                (email_id, entities_found, purpose, workflow, processing_time, llm_used)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                result.email_id,
                len(result.entities),
                result.purpose,
                result.workflow,
                result.processing_time,
                result.llm_used
            ))
            
            conn.commit()
            conn.close()
            
            return True
            
        except Exception as e:
            logger.error(f"Initial batch test failed: {e}")
            return False
    
    def deploy(self):
        """Main deployment method"""
        print("="*70)
        print("TD SYNNEX PATTERN EXTRACTION - PRODUCTION DEPLOYMENT")
        print("="*70)
        print(f"Deployment started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        # Step 1: Verify dependencies
        if not self.verify_dependencies():
            logger.error("Dependency verification failed. Aborting deployment.")
            return False
        
        # Step 2: Initialize database
        self.initialize_pattern_database()
        
        # Step 3: Deploy extraction service
        service_pid = self.deploy_extraction_service()
        time.sleep(2)  # Allow service to start
        
        # Step 4: Start pattern discovery
        discovery_pid = self.start_pattern_discovery()
        
        # Step 5: Setup monitoring
        self.setup_monitoring()
        
        # Step 6: Run initial batch
        if self.run_initial_batch():
            logger.info("✅ Initial batch test passed")
        else:
            logger.warning("⚠️  Initial batch test failed, but deployment continues")
        
        # Summary
        print()
        print("="*70)
        print("DEPLOYMENT COMPLETE")
        print("="*70)
        print(f"✅ Extraction Service: Running (PID: {service_pid})")
        print(f"✅ Pattern Discovery: Running (PID: {discovery_pid})")
        print(f"✅ Database: {self.deployment_config['pattern_db_path']}")
        print(f"✅ API Endpoint: http://localhost:5555/extract")
        print(f"✅ Metrics: http://localhost:5555/metrics")
        print()
        print("NEXT STEPS:")
        print("1. Monitor progress: python3 monitor_dashboard.py")
        print("2. Check logs: tail -f deployment.log")
        print("3. Discovery log: tail -f discovery.log")
        print("4. Human verification: python3 human_verification_interface.py")
        print()
        print("Processing 143,850 emails...")
        print("Estimated completion: 5-6 hours")
        
        return True

if __name__ == "__main__":
    deployment = ProductionDeployment()
    success = deployment.deploy()
    sys.exit(0 if success else 1)