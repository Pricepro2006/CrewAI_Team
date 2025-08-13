#!/usr/bin/env python3
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
