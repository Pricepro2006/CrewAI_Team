#!/usr/bin/env python3
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
