#!/usr/bin/env python3
"""
IEMS to Email Dashboard Data Pipeline
Orchestrates the complete data transformation from IEMS analysis to Email Dashboard
"""

import os
import sys
import sqlite3
import logging
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
import subprocess

# Add project root to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from api.services.EmailStorageService import EmailStorageService
from core.cache.EmailAnalysisCache import EmailAnalysisCache

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pricepro2006/CrewAI_Team/logs/data_pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class IEMSDataPipeline:
    def __init__(self, 
                 source_db: str,
                 target_db: str,
                 analysis_dir: str):
        """
        Initialize the data pipeline
        
        Args:
            source_db: Path to IEMS database
            target_db: Path to Email Dashboard database
            analysis_dir: Directory containing analysis results
        """
        self.source_db = source_db
        self.target_db = target_db
        self.analysis_dir = Path(analysis_dir)
        self.email_service = EmailStorageService()
        self.cache = EmailAnalysisCache()
        
    def setup_database(self) -> bool:
        """Initialize database with migration tables"""
        try:
            logger.info("Setting up migration tables...")
            
            # Run migration SQL script
            migration_script = Path(__file__).parent / "01_create_migration_tables.sql"
            
            with sqlite3.connect(self.target_db) as conn:
                with open(migration_script, 'r') as f:
                    conn.executescript(f.read())
                    
            logger.info("Migration tables created successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup database: {str(e)}")
            return False
            
    def parse_analysis_files(self) -> Dict[str, Any]:
        """Parse IEMS analysis result files"""
        try:
            logger.info("Starting analysis file parsing...")
            
            # Use the parser script
            parser_script = Path(__file__).parent / "parse_analysis_results.py"
            
            # Run parser
            result = subprocess.run(
                [sys.executable, str(parser_script)],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                logger.error(f"Parser failed: {result.stderr}")
                return {"status": "failed", "error": result.stderr}
                
            # Get statistics
            with sqlite3.connect(self.target_db) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM migration_analysis_temp")
                total_parsed = cursor.fetchone()[0]
                
            logger.info(f"Parsed {total_parsed} analysis batches")
            return {"status": "success", "records_parsed": total_parsed}
            
        except Exception as e:
            logger.error(f"Failed to parse analysis files: {str(e)}")
            return {"status": "failed", "error": str(e)}
            
    def transform_data(self) -> Dict[str, Any]:
        """Transform parsed data to Email Dashboard format"""
        try:
            logger.info("Starting data transformation...")
            
            # Run transformation SQL script
            transform_script = Path(__file__).parent / "02_transform_to_dashboard.sql"
            
            with sqlite3.connect(self.target_db) as conn:
                # Read and execute transformation script
                with open(transform_script, 'r') as f:
                    script_content = f.read()
                    
                # Execute the script
                conn.executescript(script_content)
                
                # Get statistics
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM emails WHERE graph_id LIKE 'IEMS_%'")
                total_transformed = cursor.fetchone()[0]
                
            logger.info(f"Transformed {total_transformed} emails")
            return {"status": "success", "records_transformed": total_transformed}
            
        except Exception as e:
            logger.error(f"Failed to transform data: {str(e)}")
            return {"status": "failed", "error": str(e)}
            
    def enrich_with_metadata(self) -> Dict[str, Any]:
        """Enrich transformed data with additional metadata"""
        try:
            logger.info("Enriching data with metadata...")
            
            with sqlite3.connect(self.target_db) as conn:
                cursor = conn.cursor()
                
                # Add timestamps based on batch numbers (simulate real email times)
                cursor.execute("""
                    UPDATE emails 
                    SET received_date = datetime('now', '-' || 
                        (CAST(SUBSTR(thread_id, 8) AS INTEGER) % 30) || ' days',
                        '-' || (CAST(SUBSTR(thread_id, 8) AS INTEGER) % 24) || ' hours')
                    WHERE graph_id LIKE 'IEMS_%' AND received_date IS NULL
                """)
                
                # Set sent dates slightly before received dates
                cursor.execute("""
                    UPDATE emails 
                    SET sent_date = datetime(received_date, '-5 minutes')
                    WHERE graph_id LIKE 'IEMS_%' AND sent_date IS NULL
                """)
                
                # Randomly mark some as read
                cursor.execute("""
                    UPDATE emails 
                    SET is_read = 1
                    WHERE graph_id LIKE 'IEMS_%' 
                    AND RANDOM() % 100 < 70  -- 70% read rate
                """)
                
                # Add due dates for critical items
                cursor.execute("""
                    UPDATE emails 
                    SET due_date = datetime(received_date, '+2 days')
                    WHERE graph_id LIKE 'IEMS_%' 
                    AND priority IN ('Critical', 'High')
                    AND due_date IS NULL
                """)
                
                conn.commit()
                
            logger.info("Metadata enrichment completed")
            return {"status": "success"}
            
        except Exception as e:
            logger.error(f"Failed to enrich metadata: {str(e)}")
            return {"status": "failed", "error": str(e)}
            
    def update_cache(self) -> Dict[str, Any]:
        """Update email analysis cache with new data"""
        try:
            logger.info("Updating analysis cache...")
            
            with sqlite3.connect(self.target_db) as conn:
                cursor = conn.cursor()
                
                # Get all IEMS emails with analysis
                cursor.execute("""
                    SELECT e.id, e.message_id, ea.deep_analysis
                    FROM emails e
                    JOIN email_analysis ea ON e.id = ea.email_id
                    WHERE e.graph_id LIKE 'IEMS_%'
                """)
                
                cached_count = 0
                for email_id, message_id, analysis_json in cursor.fetchall():
                    if analysis_json:
                        try:
                            analysis = json.loads(analysis_json)
                            self.cache.set(message_id, analysis, ttl=86400)  # 24 hour TTL
                            cached_count += 1
                        except json.JSONDecodeError:
                            logger.warning(f"Invalid JSON for email {email_id}")
                            
            logger.info(f"Cached {cached_count} email analyses")
            return {"status": "success", "cached_count": cached_count}
            
        except Exception as e:
            logger.error(f"Failed to update cache: {str(e)}")
            return {"status": "failed", "error": str(e)}
            
    def validate_migration(self) -> Dict[str, Any]:
        """Validate the migration results"""
        try:
            logger.info("Validating migration...")
            
            with sqlite3.connect(self.target_db) as conn:
                cursor = conn.cursor()
                
                validations = {}
                
                # Check email counts
                cursor.execute("SELECT COUNT(*) FROM emails WHERE graph_id LIKE 'IEMS_%'")
                validations['total_emails'] = cursor.fetchone()[0]
                
                # Check status distribution
                cursor.execute("""
                    SELECT status, COUNT(*) 
                    FROM emails 
                    WHERE graph_id LIKE 'IEMS_%'
                    GROUP BY status
                """)
                validations['status_distribution'] = dict(cursor.fetchall())
                
                # Check workflow distribution
                cursor.execute("""
                    SELECT workflow_type, COUNT(*) 
                    FROM emails 
                    WHERE graph_id LIKE 'IEMS_%'
                    GROUP BY workflow_type
                """)
                validations['workflow_distribution'] = dict(cursor.fetchall())
                
                # Check entities
                cursor.execute("""
                    SELECT entity_type, COUNT(*) 
                    FROM email_entities ee
                    JOIN emails e ON ee.email_id = e.id
                    WHERE e.graph_id LIKE 'IEMS_%'
                    GROUP BY entity_type
                """)
                validations['entity_counts'] = dict(cursor.fetchall())
                
                # Check for critical issues
                issues = []
                
                if validations['total_emails'] == 0:
                    issues.append("No emails migrated")
                    
                if not validations['status_distribution']:
                    issues.append("No status information found")
                    
                if not validations['workflow_distribution']:
                    issues.append("No workflow types found")
                    
                validations['issues'] = issues
                validations['valid'] = len(issues) == 0
                
            logger.info(f"Validation complete: {'PASSED' if validations['valid'] else 'FAILED'}")
            return validations
            
        except Exception as e:
            logger.error(f"Failed to validate migration: {str(e)}")
            return {"valid": False, "error": str(e)}
            
    def cleanup_temp_tables(self, keep_backup: bool = True) -> bool:
        """Clean up temporary migration tables"""
        try:
            logger.info("Cleaning up temporary tables...")
            
            with sqlite3.connect(self.target_db) as conn:
                cursor = conn.cursor()
                
                if keep_backup:
                    # Rename tables for backup
                    tables = [
                        'migration_analysis_temp',
                        'migration_entities_temp',
                        'migration_participants_temp',
                        'migration_action_items_temp'
                    ]
                    
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    for table in tables:
                        backup_name = f"{table}_backup_{timestamp}"
                        cursor.execute(f"ALTER TABLE {table} RENAME TO {backup_name}")
                        
                    logger.info(f"Migration tables backed up with timestamp {timestamp}")
                else:
                    # Drop tables
                    cursor.execute("DROP TABLE IF EXISTS migration_analysis_temp")
                    cursor.execute("DROP TABLE IF EXISTS migration_entities_temp")
                    cursor.execute("DROP TABLE IF EXISTS migration_participants_temp")
                    cursor.execute("DROP TABLE IF EXISTS migration_action_items_temp")
                    logger.info("Migration tables dropped")
                    
                conn.commit()
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to cleanup: {str(e)}")
            return False
            
    async def run_pipeline(self, skip_cleanup: bool = False) -> Dict[str, Any]:
        """Run the complete data pipeline"""
        logger.info("=" * 60)
        logger.info("Starting IEMS to Email Dashboard Data Pipeline")
        logger.info("=" * 60)
        
        pipeline_start = datetime.now()
        results = {
            "start_time": pipeline_start.isoformat(),
            "steps": {}
        }
        
        try:
            # Step 1: Setup database
            if not self.setup_database():
                results["status"] = "failed"
                results["error"] = "Database setup failed"
                return results
                
            # Step 2: Parse analysis files
            parse_result = self.parse_analysis_files()
            results["steps"]["parse"] = parse_result
            
            if parse_result["status"] != "success":
                results["status"] = "failed"
                return results
                
            # Step 3: Transform data
            transform_result = self.transform_data()
            results["steps"]["transform"] = transform_result
            
            if transform_result["status"] != "success":
                results["status"] = "failed"
                return results
                
            # Step 4: Enrich metadata
            enrich_result = self.enrich_with_metadata()
            results["steps"]["enrich"] = enrich_result
            
            # Step 5: Update cache
            cache_result = self.update_cache()
            results["steps"]["cache"] = cache_result
            
            # Step 6: Validate
            validation_result = self.validate_migration()
            results["steps"]["validation"] = validation_result
            
            # Step 7: Cleanup (optional)
            if not skip_cleanup:
                cleanup_success = self.cleanup_temp_tables()
                results["steps"]["cleanup"] = {"success": cleanup_success}
                
            # Calculate duration
            pipeline_end = datetime.now()
            duration = (pipeline_end - pipeline_start).total_seconds()
            
            results["end_time"] = pipeline_end.isoformat()
            results["duration_seconds"] = duration
            results["status"] = "success" if validation_result.get("valid", False) else "completed_with_issues"
            
            # Log summary
            logger.info("=" * 60)
            logger.info("Pipeline Summary:")
            logger.info(f"Status: {results['status']}")
            logger.info(f"Duration: {duration:.2f} seconds")
            logger.info(f"Emails migrated: {validation_result.get('total_emails', 0)}")
            logger.info("=" * 60)
            
        except Exception as e:
            logger.error(f"Pipeline failed with error: {str(e)}")
            results["status"] = "failed"
            results["error"] = str(e)
            
        return results

def main():
    """Main execution function"""
    # Configuration
    SOURCE_DB = "/home/pricepro2006/iems_project/iems.db"
    TARGET_DB = "/home/pricepro2006/CrewAI_Team/data/email_dashboard.db"
    ANALYSIS_DIR = "/home/pricepro2006/iems_project/analysis_results"
    
    # Create pipeline
    pipeline = IEMSDataPipeline(SOURCE_DB, TARGET_DB, ANALYSIS_DIR)
    
    # Run pipeline
    loop = asyncio.get_event_loop()
    results = loop.run_until_complete(pipeline.run_pipeline(skip_cleanup=False))
    
    # Save results
    results_file = Path("/home/pricepro2006/CrewAI_Team/logs/pipeline_results.json")
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
        
    logger.info(f"Pipeline results saved to {results_file}")
    
    # Exit with appropriate code
    sys.exit(0 if results.get("status") in ["success", "completed_with_issues"] else 1)

if __name__ == "__main__":
    main()